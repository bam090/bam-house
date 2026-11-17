import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createCatAnimator, SNOWDROP_MODEL_FILE } from '../src/scene/cat-motion.ts'
import { createDualQuaternionPalette, deformCatVertex } from '../src/scene/dual-quaternion.ts'

globalThis.ProgressEvent=class extends Event{constructor(type,data){super(type);Object.assign(this,data)}}
const file=process.argv.find(a=>a.endsWith('.glb'))||SNOWDROP_MODEL_FILE
const bytes=await fs.readFile(new URL(`../public/models/characters/snowdrop/${file}`,import.meta.url))
const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length))
delete json.images;delete json.textures;json.materials=[{}]
json.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+length).toString('base64')}`
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'')
let mesh;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o});assert(mesh)
const p=mesh.geometry.attributes.position,index=mesh.geometry.index,rig=gltf.scene.getObjectByName('Snowdrop')
const dq=rig.userData.skinning==='dualQuaternion',controller=dq?createDualQuaternionPalette(mesh):null
if(dq)for(const clip of gltf.animations.filter(c=>['Sit','Lie'].includes(c.name)))for(const track of clip.tracks.filter(t=>t.name.startsWith('Tail')&&t.name.endsWith('.quaternion'))){
  assert(new T.Quaternion().fromArray(track.values).angleTo(new T.Quaternion())<1e-5,`${clip.name}: tail does not return to its rest pose`)
}
const edges=[],seen=new Set(),seams=[],welded=new Map()
const point=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3()
for(let i=0;i<p.count;i++){
  const key=[p.getX(i),p.getY(i),p.getZ(i)].join(',')
  if(welded.has(key))seams.push([welded.get(key),i]);else welded.set(key,i)
}
for(let i=0;i<index.count;i+=3)for(let k=0;k<3;k++){
  const u=index.getX(i+k),v=index.getX(i+(k+1)%3),key=u<v?`${u},${v}`:`${v},${u}`
  if(seen.has(key))continue;seen.add(key)
  if(Math.max(p.getZ(u),p.getZ(v))>.12||Math.max(p.getY(u),p.getY(v))>.72)continue
  const rest=a.fromBufferAttribute(p,u).distanceTo(b.fromBufferAttribute(p,v))
  if(rest>.0005)edges.push({u,v,rest})
}
const current=new Float32Array(p.count*3),previous=new Float32Array(p.count*3)
let lastRotations=[],lastPositions=[]
let hasPrevious=false
function inspect(){
  gltf.scene.updateMatrixWorld(true);mesh.skeleton.update();controller?.update()
  let step=0,seam=0,stretch=0,worstEdge=null,stepVertex=0
  for(let i=0;i<p.count;i++){
    if(dq){deformCatVertex(point,i,mesh,controller.palette)}else mesh.getVertexPosition(i,point)
    assert(point.toArray().every(Number.isFinite))
    current.set(point.toArray(),i*3)
    if(hasPrevious){const distance=point.distanceTo(a.fromArray(previous,i*3));if(distance>step){step=distance;stepVertex=i}}
  }
  const distance=(u,v)=>a.fromArray(current,u*3).distanceTo(b.fromArray(current,v*3))
  for(const e of edges){const ratio=distance(e.u,e.v)/e.rest;if(ratio>stretch){stretch=ratio;worstEdge=[e.u,e.v]}}
  for(const [u,v]of seams)seam=Math.max(seam,distance(u,v))
  const rotations=mesh.skeleton.bones.map(b=>b.getWorldQuaternion(new T.Quaternion()))
  const positions=mesh.skeleton.bones.map(b=>b.getWorldPosition(new T.Vector3()).toArray())
  const jointChange=lastRotations.length?rotations.map((q,i)=>({name:mesh.skeleton.bones[i].name,angle:q.angleTo(lastRotations[i]),from:lastPositions[i],to:positions[i]})).sort((a,b)=>b.angle-a.angle).slice(0,3):[]
  lastRotations=rotations;lastPositions=positions
  previous.set(current);hasPrevious=true
  return {step,seam,stretch,worstEdge,stepVertex,jointChange}
}
const animator=createCatAnimator(gltf.scene,gltf.animations,rig.userData.gait.speed)
const motion={speed:0,grounded:true,verticalSpeed:0,nearObject:false},rows=[]
const scenarios=[['서기→앉기','sit',0,90],['앉기→눕기','lie',0,90],['눕기→앉기','sit',0,90],['앉기→서기','sit',0,60],['서기→눕기','lie',0,100],['눕기→걷기',null,3,80],['걷기→앉기','sit',0,90],['앉기→눕기 전환 시작','lie',0,10],['전환 중 앉기','sit',0,10],['전환 중 눕기','lie',0,90],['눕기 중 귀 털기','ears',0,50],['눕기→점프·착지','jump',0,120],['착지→앉기','sit',0,90],['앉기→점프·착지','jump',0,120]]
inspect()
for(const [name,command,speed,frames]of scenarios){
  motion.speed=speed;const row={name,frames,speed,maxEdgeStretch:0,maxSeamGap:0,maxVertexStep:0,worstEdge:null}
  for(let frame=0;frame<frames;frame++){
    motion.grounded=command!=='jump'||frame>=40;motion.verticalSpeed=motion.grounded?0:4.6-14*frame/60
    animator.update(1/60,motion,frame===0&&command!=='jump'?command:null)
    if(frame%2===0){const s=inspect();if(s.stretch>row.maxEdgeStretch){row.maxEdgeStretch=s.stretch;row.worstEdge=s.worstEdge;row.worstEdgeFrame=frame}row.maxSeamGap=Math.max(row.maxSeamGap,s.seam);if(s.step>row.maxVertexStep){row.maxVertexStep=s.step;row.worstStep={frame,vertex:s.stepVertex,rest:[p.getX(s.stepVertex),p.getY(s.stepVertex),p.getZ(s.stepVertex)],jointChange:s.jointChange}}}
  }
  rows.push(row)
}
animator.dispose()
const report={file,method:dq?'dualQuaternion':'linear + morph',rearEdges:edges.length,duplicateVertexPairs:seams.length,sampleHz:30,rows}
console.log(JSON.stringify(report,null,2))
await fs.writeFile(new URL(`../docs/${file.replace('.glb','')}-surface-validation.json`,import.meta.url),JSON.stringify(report,null,2)+'\n')
if(!process.argv.includes('--inspect'))for(const row of rows){
  assert(row.maxSeamGap<1e-5,`${row.name}: seam opened ${row.maxSeamGap}`)
  assert(row.maxEdgeStretch<4,`${row.name}: surface spike ${row.maxEdgeStretch}`)
  // Fast walking has a deliberately accelerated swing; bound pose changes separately.
  if(row.speed===0)assert(row.maxVertexStep<.08,`${row.name}: sudden surface jump ${row.maxVertexStep}`)
}
if(!process.argv.includes('--inspect'))console.log('PASS: rear surface stretch, welded seams, pose transition continuity, tail rest pose')
