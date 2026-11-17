import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshBVH } from 'three-mesh-bvh'
import { createDualQuaternionPalette, deformCatVertex } from '../src/scene/dual-quaternion.ts'
import { createCatAnimator } from '../src/scene/cat-motion.ts'
globalThis.ProgressEvent=class extends Event{constructor(type,data){super(type);Object.assign(this,data)}}
const folder=new URL('../public/models/characters/snowdrop/',import.meta.url)
const bytes=await fs.readFile(process.argv.find(a=>a.endsWith('.glb'))||new URL('snowdrop-volume.glb',folder)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length))
delete json.images;delete json.textures;json.materials=[{}];json.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');let mesh;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o});assert(mesh)
const p=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight,controller=createDualQuaternionPalette(mesh),point=new T.Vector3()
const boneWeight=(i,name)=>[0,1,2,3].reduce((sum,k)=>sum+(mesh.skeleton.bones[indices.array[i*4+k]].name===name?w.array[i*4+k]:0),0)
// Regression: repeated zero padding used to erase the pelvis influence entirely.
let pelvisBack=0
for(let i=0;i<p.count;i++)if(p.getY(i)>.60&&p.getZ(i)<-.12&&p.getZ(i)>-.23){assert(boneWeight(i,'Spine')>.85,'Pelvis weight was erased');pelvisBack++}
assert(pelvisBack>30)
for(let i=0;i<w.count;i++)assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5)
const tailWeights=Array.from({length:p.count},(_,i)=>[0,1,2,3].reduce((sum,k)=>sum+(mesh.skeleton.bones[indices.array[i*4+k]].name.startsWith('Tail')?w.array[i*4+k]:0),0))
const tailVertices=tailWeights.map(weight=>weight>.99999)
for(const [morphIndex,a] of mesh.geometry.morphAttributes.position.entries())for(let i=0;i<p.count;i++){
  const distance=Math.hypot(a.getX(i),a.getY(i),a.getZ(i))
  const posterior=morphIndex===mesh.morphTargetDictionary.SitFold&&p.getX(i)>-.06&&p.getY(i)>.18&&p.getY(i)<.50&&p.getZ(i)>-.38&&p.getZ(i)<-.30&&!tailVertices[i]
  // Matching the displaced attachment needs more travel than smoothing a local joint fold.
  assert(distance<(posterior?.05:.045),'Local pose correction moved too far')
  const legFold=p.getY(i)>.055&&p.getY(i)<.32&&p.getZ(i)<.02&&p.getZ(i)>-.40
  const tailRoot=p.getY(i)>.46&&p.getY(i)<.61&&p.getZ(i)<-.30&&p.getZ(i)>-.49&&Math.abs(p.getX(i)+.075)<.15
  const leftSit=[mesh.morphTargetDictionary.SitFold,mesh.morphTargetDictionary.SitMidFold].includes(morphIndex)&&p.getX(i)+.075>.015&&p.getY(i)<.63&&p.getZ(i)<.06&&p.getZ(i)>-.45
  if(!legFold&&!tailRoot&&!leftSit)assert(distance<1e-6,'Correction escaped the hind-leg, seated left-side and tail-attachment regions')
  if(tailVertices[i])assert(distance<1e-6,'Pose correction changed the tail tube')
}
const groups=['Spine','Spine_003','Head'].map(name=>({name,vertices:Array.from({length:p.count},(_,i)=>i).filter(i=>boneWeight(i,name)>.85)})).filter(g=>g.vertices.length>30)
// Use the anatomical haunch core: the support-weight patch also spans the folding ankle.
for(const side of [-1,1])groups.push({name:`HaunchCore_${side}`,vertices:Array.from({length:p.count},(_,i)=>i).filter(i=>p.getY(i)>.28&&p.getY(i)<.48&&p.getZ(i)>-.29&&p.getZ(i)<-.10&&(p.getX(i)+.075)*side>.06)})
function spread(vertices,positions){let count=0,x=0,y=0,z=0,xx=0,xy=0,xz=0,yy=0,yz=0,zz=0;for(const i of vertices){const a=positions[i*3],b=positions[i*3+1],c=positions[i*3+2];count++;x+=a;y+=b;z+=c;xx+=a*a;xy+=a*b;xz+=a*c;yy+=b*b;yz+=b*c;zz+=c*c}x/=count;y/=count;z/=count;xx=xx/count-x*x;xy=xy/count-x*y;xz=xz/count-x*z;yy=yy/count-y*y;yz=yz/count-y*z;zz=zz/count-z*z;return Math.sqrt(Math.max(0,xx*(yy*zz-yz*yz)-xy*(xy*zz-yz*xz)+xz*(xy*yz-yy*xz)))}
for(const g of groups)g.rest=spread(g.vertices,p.array)
const positions=new Float32Array(p.count*3)
function sample(){gltf.scene.updateMatrixWorld(true);controller.update();let min=Infinity,minVertex=0;for(let i=0;i<p.count;i++){deformCatVertex(point,i,mesh,controller.palette);assert(point.toArray().every(Number.isFinite));positions.set(point.toArray(),i*3);if(point.y<min){min=point.y;minVertex=i}}return{min,minVertex,ratios:Object.fromEntries(groups.map(g=>[g.name,spread(g.vertices,positions)/g.rest]))}}
function seatedSideMatch(){
    const reference=new T.BufferGeometry(),triangles=[],index=mesh.geometry.index
    for(let i=0;i<index.count;i+=3){const tri=[0,1,2].map(k=>index.getX(i+k));if(tri.every(v=>p.getX(v)<-.075&&p.getZ(v)<.10&&p.getY(v)<.65))triangles.push(...tri)}
    reference.setAttribute('position',new T.Float32BufferAttribute(positions.slice(),3));reference.setIndex(triangles)
    const bvh=new MeshBVH(reference,{indirect:true}),distances=[];let worst=null
    // Include the mixed posterior haunch; the tail-dominant tube has an intentionally asymmetric curve.
    for(let i=0;i<p.count;i++)if(p.getX(i)>-.025&&p.getY(i)<.48&&p.getZ(i)>-.36&&p.getZ(i)<-.08&&tailWeights[i]<.5){
      point.set(-.15-positions[i*3],positions[i*3+1],positions[i*3+2]);const distance=bvh.closestPointToPoint(point).distance;distances.push(distance)
      if(!worst||distance>worst.distance)worst={vertex:i,distance,rest:[p.getX(i),p.getY(i),p.getZ(i)],tailWeight:tailWeights[i]}
    }
    distances.sort((a,b)=>a-b);assert(distances.length>500)
    const result={vertices:distances.length,p95:distances[Math.floor(distances.length*.95)],max:distances.at(-1),worst}
    reference.dispose()
    assert(result.p95<.004&&result.max<.012,`Seated left rear surface differs from the right-side reference: ${JSON.stringify(result)}`)
    const rear=gltf.scene.getObjectByName('Snowdrop').userData.gait.legs.filter(l=>!l.front)
    for(let i=0;i<4;i++){
      const left=gltf.scene.getObjectByName(rear[0].jointNames[i]).getWorldPosition(new T.Vector3()),right=gltf.scene.getObjectByName(rear[1].jointNames[i]).getWorldPosition(new T.Vector3())
      assert(Math.abs(left.z-right.z)<1e-4,'Left rear joint slipped behind the right joint')
    }
    return result
}
const mixer=new T.AnimationMixer(gltf.scene),report={pelvisBackVertices:pelvisBack,method:'DQ GPU/CPU shared palette with local hind-leg pose corrections',clips:[],transitions:[]}
for(const clip of gltf.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play()
  let minY=Infinity,lowest=null,ratios=Object.fromEntries(groups.map(g=>[g.name,Infinity]));const frames=clip.name==='Walk'?120:60
  for(let frame=0;frame<=frames;frame++){action.time=clip.duration*frame/frames;mixer.update(0);const s=sample();if(s.min<minY){minY=s.min;lowest={frame,vertex:s.minVertex,rest:[p.getX(s.minVertex),p.getY(s.minVertex),p.getZ(s.minVertex)]}};for(const [name,r]of Object.entries(s.ratios))ratios[name]=Math.min(ratios[name],r)}
  if(clip.name==='Sit')report.seatedSideMatch=seatedSideMatch()
  report.clips.push({name:clip.name,frames:frames+1,minY,lowest,minimumRegionSpread:ratios})
}
mixer.stopAllAction();gltf.scene.updateMatrixWorld(true)
const animator=createCatAnimator(gltf.scene,gltf.animations,gltf.scene.getObjectByName('Snowdrop').userData.gait.speed)
const motion={speed:0,grounded:true,verticalSpeed:0,nearObject:false}
for(const [name,command,speed]of [['Stand → Sit','sit',0],['Sit → Lie','lie',0],['Lie → Sit','sit',0],['Sit → Walk',null,3]]){motion.speed=speed;animator.update(1/60,motion,command);let minY=Infinity,ratio=Infinity;for(let frame=0;frame<90;frame++){animator.update(1/60,motion,null);if(frame%2===0){const s=sample();minY=Math.min(minY,s.min);ratio=Math.min(ratio,...Object.values(s.ratios))}}const row={name,minY,minimumRegionSpread:ratio};if(command==='sit'){sample();row.seatedSideMatch=seatedSideMatch()}report.transitions.push(row)}
motion.speed=0;motion.grounded=false
let flightMin=Infinity,flightRatio=Infinity
for(let frame=0;frame<=60;frame++){motion.verticalSpeed=4.6-9.2*frame/60;animator.update(1/60,motion,null);const sampleResult=sample();flightMin=Math.min(flightMin,sampleResult.min);flightRatio=Math.min(flightRatio,...Object.values(sampleResult.ratios))}
motion.grounded=true;motion.verticalSpeed=0
for(let frame=0;frame<60;frame++){animator.update(1/60,motion,null);const sampleResult=sample();flightMin=Math.min(flightMin,sampleResult.min);flightRatio=Math.min(flightRatio,...Object.values(sampleResult.ratios))}
report.transitions.push({name:'Physics jump and landing',minY:flightMin,minimumRegionSpread:flightRatio})
animator.dispose()
await fs.writeFile(new URL('../docs/snowdrop-volume-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
if(!process.argv.includes('--inspect')){for(const row of [...report.clips,...report.transitions]){assert(row.minY>-.006,`${row.name}: below floor ${row.minY}`);const ratios=typeof row.minimumRegionSpread==='number'?[row.minimumRegionSpread]:Object.values(row.minimumRegionSpread);assert(Math.min(...ratios)>.75,`${row.name}: region spread fell below threshold`)}console.log('PASS: five clips, four pose transitions, physics jump/landing, pelvis weight regression, region spread')}
