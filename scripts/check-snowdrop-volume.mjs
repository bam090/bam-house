import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createDualQuaternionPalette, deformCatVertex } from '../src/scene/dual-quaternion.ts'
import { createCatAnimator } from '../src/scene/cat-motion.ts'
globalThis.ProgressEvent=class extends Event{constructor(type,data){super(type);Object.assign(this,data)}}
const folder=new URL('../public/models/characters/snowdrop/',import.meta.url)
const bytes=await fs.readFile(new URL('snowdrop-volume.glb',folder)),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length))
delete json.images;delete json.textures;json.materials=[{}];json.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');let mesh;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o});assert(mesh)
const p=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight,controller=createDualQuaternionPalette(mesh),point=new T.Vector3()
const boneWeight=(i,name)=>[0,1,2,3].reduce((sum,k)=>sum+(mesh.skeleton.bones[indices.array[i*4+k]].name===name?w.array[i*4+k]:0),0)
// Regression: repeated zero padding used to erase the pelvis influence entirely.
let pelvisBack=0
for(let i=0;i<p.count;i++)if(p.getY(i)>.60&&p.getZ(i)<-.12&&p.getZ(i)>-.23){assert(boneWeight(i,'Spine')>.85,'Pelvis weight was erased');pelvisBack++}
assert(pelvisBack>30)
for(let i=0;i<w.count;i++)assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5)
for(const a of mesh.geometry.morphAttributes.position)for(let i=0;i<p.count;i++){
  const distance=Math.hypot(a.getX(i),a.getY(i),a.getZ(i))
  assert(distance<.045,'Local fold correction moved too far')
  if(p.getY(i)<=.055||p.getY(i)>=.32||p.getZ(i)>=.02||p.getZ(i)<=-.40)assert(distance<1e-6,'Correction escaped the lower hind-leg region')
}
const groups=['Spine','Spine_003','Head'].map(name=>({name,vertices:Array.from({length:p.count},(_,i)=>i).filter(i=>boneWeight(i,name)>.85)})).filter(g=>g.vertices.length>30)
// Use the anatomical haunch core: the support-weight patch also spans the folding ankle.
for(const side of [-1,1])groups.push({name:`HaunchCore_${side}`,vertices:Array.from({length:p.count},(_,i)=>i).filter(i=>p.getY(i)>.28&&p.getY(i)<.48&&p.getZ(i)>-.29&&p.getZ(i)<-.10&&(p.getX(i)+.075)*side>.06)})
function spread(vertices,positions){let count=0,x=0,y=0,z=0,xx=0,xy=0,xz=0,yy=0,yz=0,zz=0;for(const i of vertices){const a=positions[i*3],b=positions[i*3+1],c=positions[i*3+2];count++;x+=a;y+=b;z+=c;xx+=a*a;xy+=a*b;xz+=a*c;yy+=b*b;yz+=b*c;zz+=c*c}x/=count;y/=count;z/=count;xx=xx/count-x*x;xy=xy/count-x*y;xz=xz/count-x*z;yy=yy/count-y*y;yz=yz/count-y*z;zz=zz/count-z*z;return Math.sqrt(Math.max(0,xx*(yy*zz-yz*yz)-xy*(xy*zz-yz*xz)+xz*(xy*yz-yy*xz)))}
for(const g of groups)g.rest=spread(g.vertices,p.array)
const positions=new Float32Array(p.count*3)
function sample(){gltf.scene.updateMatrixWorld(true);controller.update();let min=Infinity,minVertex=0;for(let i=0;i<p.count;i++){deformCatVertex(point,i,mesh,controller.palette);assert(point.toArray().every(Number.isFinite));positions.set(point.toArray(),i*3);if(point.y<min){min=point.y;minVertex=i}}return{min,minVertex,ratios:Object.fromEntries(groups.map(g=>[g.name,spread(g.vertices,positions)/g.rest]))}}
const mixer=new T.AnimationMixer(gltf.scene),report={pelvisBackVertices:pelvisBack,method:'DQ GPU/CPU shared palette with local hind-leg pose corrections',clips:[],transitions:[]}
for(const clip of gltf.animations){mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();let minY=Infinity,lowest=null,ratios=Object.fromEntries(groups.map(g=>[g.name,Infinity]));const frames=clip.name==='Walk'?120:60;for(let frame=0;frame<=frames;frame++){action.time=clip.duration*frame/frames;mixer.update(0);const s=sample();if(s.min<minY){minY=s.min;lowest={frame,vertex:s.minVertex,rest:[p.getX(s.minVertex),p.getY(s.minVertex),p.getZ(s.minVertex)]}};for(const [name,r]of Object.entries(s.ratios))ratios[name]=Math.min(ratios[name],r)}report.clips.push({name:clip.name,frames:frames+1,minY,lowest,minimumRegionSpread:ratios})}
mixer.stopAllAction();gltf.scene.updateMatrixWorld(true)
const animator=createCatAnimator(gltf.scene,gltf.animations,gltf.scene.getObjectByName('Snowdrop').userData.gait.speed)
const motion={speed:0,grounded:true,verticalSpeed:0,nearObject:false}
for(const [name,command,speed]of [['Stand → Sit','sit',0],['Sit → Lie','lie',0],['Lie → Sit','sit',0],['Sit → Walk',null,3]]){motion.speed=speed;animator.update(1/60,motion,command);let minY=Infinity,ratio=Infinity;for(let frame=0;frame<90;frame++){animator.update(1/60,motion,null);if(frame%2===0){const s=sample();minY=Math.min(minY,s.min);ratio=Math.min(ratio,...Object.values(s.ratios))}}report.transitions.push({name,minY,minimumRegionSpread:ratio})}
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
