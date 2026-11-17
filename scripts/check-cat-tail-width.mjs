import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createCatAnimator } from '../src/scene/cat-motion.ts'
import { createDualQuaternionPalette, deformCatVertex } from '../src/scene/dual-quaternion.ts'

globalThis.ProgressEvent=class extends Event{constructor(type,data){super(type);Object.assign(this,data)}}
const path=process.argv.find(a=>a.endsWith('.glb'))||new URL('../public/models/characters/snowdrop/snowdrop-volume.glb',import.meta.url)
const bytes=await fs.readFile(path)
const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length))
delete json.images;delete json.textures;json.materials=[{}]
json.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'')
let mesh;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o})
const geometry=mesh.geometry,p=geometry.attributes.position,skin=geometry.attributes.skinIndex,weight=geometry.attributes.skinWeight
const tail=mesh.skeleton.bones.filter(b=>b.name.startsWith('Tail'))
const rests=tail.map(b=>b.getWorldPosition(new T.Vector3())),controller=createDualQuaternionPalette(mesh)
const tailWeight=i=>[0,1,2,3].reduce((sum,k)=>sum+(mesh.skeleton.bones[skin.array[i*4+k]].name.startsWith('Tail')?weight.array[i*4+k]:0),0)
const rings=[],point=new T.Vector3()
for(let segment=0;segment<rests.length-1;segment++)for(const along of [.35,.75]){
  const axis=rests[segment+1].clone().sub(rests[segment]).normalize(),center=rests[segment].clone().lerp(rests[segment+1],along)
  const u=new T.Vector3(1,0,0).cross(axis).normalize(),v=axis.clone().cross(u).normalize(),vertices=[]
  for(let i=0;i<p.count;i++){
    point.fromBufferAttribute(p,i).sub(center)
    if(Math.abs(point.dot(axis))<.012&&point.length()<.075)vertices.push(i)
  }
  if(vertices.length<12)continue
  const pairs=[]
  for(let k=0;k<8;k++){
    const direction=u.clone().multiplyScalar(Math.cos(k*Math.PI/8)).addScaledVector(v,Math.sin(k*Math.PI/8))
    const ordered=vertices.map(i=>({i,projection:point.fromBufferAttribute(p,i).dot(direction)})).sort((a,b)=>a.projection-b.projection)
    const a=ordered[0].i,b=ordered.at(-1).i
    pairs.push({a,b,length:new T.Vector3().fromBufferAttribute(p,a).distanceTo(new T.Vector3().fromBufferAttribute(p,b))})
  }
  rings.push({name:`${tail[segment].name} ${along}`,vertices:vertices.length,minimumTailWeight:Math.min(...vertices.map(tailWeight)),pairs})
}
assert(rings.length>=6,'Tail cross-section coverage missing')
const a=new T.Vector3(),b=new T.Vector3(),rows=[]
function inspect(name){
  gltf.scene.updateMatrixWorld(true);controller.update()
  rows.push({name,rings:rings.map(r=>{
    const ratios=r.pairs.map(pair=>{deformCatVertex(a,pair.a,mesh,controller.palette);deformCatVertex(b,pair.b,mesh,controller.palette);return a.distanceTo(b)/pair.length})
    return {name:r.name,min:Math.min(...ratios),max:Math.max(...ratios)}
  })})
}
inspect('Rest')
const mixer=new T.AnimationMixer(gltf.scene)
for(const name of ['Sit','Lie']){
  mixer.stopAllAction();const clip=gltf.animations.find(c=>c.name===name),action=mixer.clipAction(clip).setLoop(T.LoopOnce,1)
  action.clampWhenFinished=true;action.play()
  for(let i=0;i<=30;i++){action.time=clip.duration*i/30;mixer.update(0);inspect(`${name} ${i/30}`)}
}
mixer.stopAllAction()
const animator=createCatAnimator(gltf.scene,gltf.animations,gltf.scene.getObjectByName('Snowdrop').userData.gait.speed)
const motion={speed:0,grounded:true,verticalSpeed:0}
for(let frame=0;frame<100;frame++)animator.update(1/60,motion,null)
for(const [name,command]of [['Stand → Sit','sit'],['Sit → Lie','lie'],['Lie → Sit','sit'],['Sit → Stand','sit']]){
  for(let frame=0;frame<120;frame++){animator.update(1/60,motion,frame===0?command:null);inspect(`${name} ${frame}`)}
}
animator.dispose()
const summary=rings.map(r=>({name:r.name,vertices:r.vertices,minimumTailWeight:r.minimumTailWeight,min:Math.min(...rows.flatMap(row=>row.rings.filter(x=>x.name===r.name).map(x=>x.min))),max:Math.max(...rows.flatMap(row=>row.rings.filter(x=>x.name===r.name).map(x=>x.max)))}))
const report={method:'Opposite vertex pairs across eight tail cross-sections; 3D diameter ratios avoid camera foreshortening',samples:rows.length,summary,rows}
await fs.writeFile(new URL('../docs/snowdrop-tail-width-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({samples:rows.length,summary},null,2))
if(!process.argv.includes('--inspect'))for(const r of summary){assert(r.min>.995,`${r.name}: tail cross-section narrowed ${r.min}`);assert(r.max<1.005,`${r.name}: tail cross-section widened ${r.max}`)}
