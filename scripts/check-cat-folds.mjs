import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createCatAnimator, createCatTailSwayClip } from '../src/scene/cat-motion.ts'
import * as T from 'three'
import { MeshBVH, ExtendedTriangle } from 'three-mesh-bvh'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createDualQuaternionPalette, deformCatVertex } from '../src/scene/dual-quaternion.ts'
globalThis.ProgressEvent=class extends Event{constructor(type,data){super(type);Object.assign(this,data)}}
const path=process.argv.slice(2).find(a=>a.endsWith('.glb'))||new URL('../public/models/characters/snowdrop/snowdrop-volume.glb',import.meta.url)
const bytes=await fs.readFile(path),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length))
delete json.images;delete json.textures;json.materials=[{}];json.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');let mesh;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o})
const rest=mesh.geometry.attributes.position,index=mesh.geometry.index,skin=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight
const geometry=mesh.geometry.clone(),position=geometry.attributes.position,controller=createDualQuaternionPalette(mesh),point=new T.Vector3()
const keys=new Map(),weld=[]
for(let i=0;i<rest.count;i++){const key=[rest.getX(i),rest.getY(i),rest.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(!keys.has(key))keys.set(key,keys.size);weld.push(keys.get(key))}
const triangles=Array.from({length:index.count/3},(_,i)=>[index.getX(i*3),index.getX(i*3+1),index.getX(i*3+2)])
const candidates=triangles.map((vertices,i)=>({vertices,i})).filter(({vertices})=>vertices.every(v=>rest.getZ(v)<.05&&rest.getY(v)<.55))
const pureTail=Array.from({length:rest.count},(_,v)=>[0,1,2,3].reduce((sum,k)=>sum+(mesh.skeleton.bones[skin.array[v*4+k]].name.startsWith('Tail')?weights.array[v*4+k]:0),0)>.99999)
const tailEdges=[]
for(const vertices of triangles)for(let k=0;k<3;k++){
  const a=vertices[k],b=vertices[(k+1)%3]
  if(a<b&&pureTail[a]&&pureTail[b]){const length=new T.Vector3().fromBufferAttribute(rest,a).distanceTo(new T.Vector3().fromBufferAttribute(rest,b));if(length>.001)tailEdges.push({a,b,length})}
}
assert(tailEdges.length>100,'Tail section coverage missing')
const bvh=new MeshBVH(geometry,{indirect:true}),tri=new ExtendedTriangle(),bounds=new T.Box3(),line=new T.Line3(),mixer=new T.AnimationMixer(gltf.scene)
const label=vertices=>{const sums=new Map();for(const v of vertices)for(let k=0;k<4;k++){const n=mesh.skeleton.bones[skin.array[v*4+k]].name;sums.set(n,(sums.get(n)||0)+weights.array[v*4+k])}return [...sums].sort((a,b)=>b[1]-a[1])[0][0]}
const rows=[]
const walking=process.argv.includes('--walk')
const swaying=process.argv.includes('--tail'),tailClip=createCatTailSwayClip()
function inspect(name){
  gltf.scene.updateMatrixWorld(true);controller.update()
  for(let i=0;i<rest.count;i++){deformCatVertex(point,i,mesh,controller.palette);position.setXYZ(i,...point.toArray())}
  bvh.refit();let count=0,totalLength=0;const groups={},examples=[]
  for(const {vertices,i}of candidates){
    tri.a.fromBufferAttribute(position,vertices[0]);tri.b.fromBufferAttribute(position,vertices[1]);tri.c.fromBufferAttribute(position,vertices[2]);tri.needsUpdate=true
    bounds.setFromPoints([tri.a,tri.b,tri.c]);const shared=vertices.map(v=>weld[v])
    bvh.shapecast({intersectsBounds:box=>box.intersectsBox(bounds),intersectsTriangle:(other,j)=>{
      if(j<=i||triangles[j].some(v=>shared.includes(weld[v])))return false
      if(tri.intersectsTriangle(other,line)&&line.distance()>.0005){count++;totalLength+=line.distance();const key=[label(vertices),label(triangles[j])].sort().join(' / ');groups[key]=(groups[key]||0)+1;if(examples.length<8)examples.push({triangles:[i,j],rest:vertices.map(v=>[rest.getX(v),rest.getY(v),rest.getZ(v)]),at:line.getCenter(new T.Vector3()).toArray()})}
      return false
    }})
  }
  let tailStrain=0
  for(const {a,b,length}of tailEdges)tailStrain=Math.max(tailStrain,Math.abs(new T.Vector3().fromBufferAttribute(position,a).distanceTo(new T.Vector3().fromBufferAttribute(position,b))/length-1))
  rows.push({name,intersections:count,totalLength,tailStrain,groups,examples})
}
inspect('Rest')
for(const name of (swaying?['TailSway','Walk']:walking?['Walk']:['Sit','Lie'])){
  mixer.stopAllAction()
  const clip=name==='TailSway'?tailClip:gltf.animations.find(c=>c.name===name),action=mixer.clipAction(clip)
  action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play()
  const overlay=swaying&&name==='Walk'?mixer.clipAction(tailClip).setEffectiveWeight(.8).play():null
  for(const tailPhase of (overlay?Array.from({length:12},(_,i)=>i/12):[0])){
    if(overlay)overlay.time=tailClip.duration*tailPhase
    for(const phase of (swaying?Array.from({length:33},(_,i)=>i/32):walking?Array.from({length:121},(_,i)=>i/120):process.argv.includes('--quick')?[0,.25,.4,.45,.5,.55,.7,1]:Array.from({length:21},(_,i)=>i/20))){action.time=clip.duration*phase;mixer.update(0);inspect(`${name} ${phase}${overlay?` tail ${tailPhase}`:''}`)}
  }
}
mixer.stopAllAction()
const animator=createCatAnimator(gltf.scene,gltf.animations,gltf.scene.getObjectByName('Snowdrop').userData.gait.speed)
const motion={speed:0,grounded:true,verticalSpeed:0,nearObject:false}
if(swaying)for(let frame=0;frame<100;frame++)animator.update(1/60,motion,null)
for(const [name,command,frames]of (walking||process.argv.includes('--quick')?[]:[['서기→앉기','sit',120],['앉기→눕기','lie',120],['눕기→앉기','sit',120],['앉기→서기','sit',90],['서기→눕기','lie',120],['전환 중 앉기','sit',10],['전환 중 눕기','lie',10],['다시 앉기','sit',120]])){
  for(let frame=0;frame<frames;frame++){animator.update(1/60,motion,frame===0?command:null);if(frame%4===0||frame===frames-1)inspect(`${name} ${frame}`)}
}
animator.dispose()
const report={method:'Non-adjacent rear triangles, welded seam exclusion, intersection segment > 0.0005 model units',samples:rows.length,maxIntersections:Math.max(...rows.map(r=>r.intersections)),maxTailStrain:Math.max(...rows.map(r=>r.tailStrain)),tailEdges:tailEdges.length,rows}
await fs.writeFile(new URL(swaying?'../docs/snowdrop-tail-validation.json':walking?'../docs/snowdrop-walk-fold-validation.json':'../docs/snowdrop-fold-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({samples:rows.length,max:report.maxIntersections,failures:rows.filter(r=>r.intersections).map(({name,intersections,totalLength,groups})=>({name,intersections,totalLength,groups}))},null,2))
if(!process.argv.includes('--inspect')){
  assert(report.maxIntersections===0,'Rear surface self-intersection')
  if(!walking){
    assert(report.maxTailStrain<.03,'Tail surface stretched during sway')
    for(const row of rows.filter(r=>/^(Rest|Sit |Lie )/.test(r.name)))assert(row.tailStrain<.001,'Resting tail section changed shape')
  }
}
