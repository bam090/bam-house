import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as T from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(v => { this.result = v; this.onloadend?.() }) }
  readAsDataURL(blob) { blob.arrayBuffer().then(v => { this.result = `data:${blob.type};base64,${Buffer.from(v).toString('base64')}`; this.onloadend?.() }) }
}
const folder = new URL('../public/models/characters/snowdrop/', import.meta.url)
const sourceBytes = await fs.readFile(new URL('snowdrop-source.glb', folder))
function unpack(bytes) { const length = bytes.readUInt32LE(12); return { json: JSON.parse(bytes.subarray(20, 20 + length)), bin: bytes.subarray(28 + length) } }
const source = unpack(sourceBytes), primitive = source.json.meshes[0].primitives[0]
assert(source.json.nodes.length === 1 && !source.json.skins && !source.json.animations)
function attribute(index) {
  const a = source.json.accessors[index], v = source.json.bufferViews[a.bufferView]
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type], Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType]
  assert(Type && width && !v.byteStride)
  const offset = (v.byteOffset || 0) + (a.byteOffset || 0), bytes = source.bin.subarray(offset, offset + a.count * width * Type.BYTES_PER_ELEMENT)
  return new T.BufferAttribute(new Type(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)), width)
}
const geometry = new T.BufferGeometry()
for (const [key, name] of Object.entries({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' })) geometry.setAttribute(name, attribute(primitive.attributes[key]))
geometry.setIndex(attribute(primitive.indices)); geometry.computeBoundingBox()
const box = geometry.boundingBox.clone(), height = box.max.y - box.min.y, centerZ = (box.max.z + box.min.z) / 2
geometry.translate(0, -box.min.y, -centerZ).scale(1 / height, 1 / height, 1 / height)
const root = new T.Group(); root.name = 'Snowdrop'
const bones = [], rests = [], definitions = [], V = a => new T.Vector3(...a), cx = -.075
const sourceRig = JSON.parse(await fs.readFile(new URL('../docs/skater-cat-blend-inspection.json', import.meta.url))).objects.find(o => o.type === 'ARMATURE')
function bone(sourceName, position, parent) {
  assert(sourceRig.bones.some(b => b.name === sourceName), `Missing source bone ${sourceName}`)
  const b = new T.Bone(), index = bones.length; b.name = sourceName.replaceAll('.', '_'); b.userData.sourceBone = sourceName
  bones.push(b); rests.push(V(position)); definitions.push({ name: b.name, sourceName, parent, rest: position })
  b.position.copy(rests[index]); if (parent == null) root.add(b); else { b.position.sub(rests[parent]); bones[parent].add(b) }
  return index
}
const body = bone('Spine', [cx, .52, -.20])
const chest = bone('Spine.003', [cx, .52, .22], body)
const neck = bone('Neck', [cx, .64, .33], chest)
const head = bone('Head', [cx, .76, .43], neck)
const jaw = bone('Mouth', [cx, .69, .48], head)
const ears = [bone('Ear', [.045, .84, .405], head), bone('Ear.006', [-.18, .84, .405], head)]
const tail = []
for (const [i, p] of [[-.075,.49,-.33],[-.06,.38,-.395],[.0,.29,-.455],[.105,.247,-.515],[.205,.29,-.59]].entries()) tail.push(bone(['Tail','Tail.002','Tail.004','Tail.006','Tail.007'][i], p, i ? tail[i-1] : body))
const legs = []
for (const side of [1, -1]) for (const front of [true, false]) {
  const suffix = side > 0 ? 'L' : 'R', x = cx + side * (front ? .075 : .095)
  const upper = bone(front ? `Thigh_front_${suffix}` : `Thigh_Back_${suffix}`, [x, front ? .48 : .50, front ? .27 : -.22], front ? chest : body)
  const lower = bone(front ? `Calf_Front_${suffix}` : `Calf_back_${suffix}`, [x, front ? .27 : .30, front ? .20 : -.13], upper)
  const end = bone(front ? (side > 0 ? 'Foot_front_L2' : 'Foot_front_L2.002') : `Foot_Back_${suffix}`, [x, front ? .085 : .12, front ? .265 : -.30], lower)
  const foot = bone(front ? `Foot_front_${suffix}` : (side > 0 ? 'Foot_Back_L2' : 'Foot_Back_L2.002'), [x, .027, front ? .315 : -.225], end)
  legs.push({ side, front, upper, lower, end, foot, phase: 0 })
}
assert.equal(bones.length, 28)
root.updateMatrixWorld(true)
const skeleton = new T.Skeleton(bones); skeleton.calculateInverses()
const smooth = (a,b,x) => { const t = T.MathUtils.clamp((x-a)/(b-a),0,1); return t*t*(3-2*t) }
function weights(p) {
  const w = new Map(), add = (i,v) => w.set(i,(w.get(i)||0)+v)
  const headMix = Math.max(smooth(.56,.70,p.y)*smooth(.10,.25,p.z),smooth(.38,.46,p.z)*smooth(.45,.54,p.y))
  const earMix = smooth(.82,.90,p.y), jawMix = (1-smooth(.66,.705,p.y))*smooth(.47,.54,p.z)*headMix*.55
  add(ears[p.x > cx ? 0 : 1], headMix*earMix); add(jaw,jawMix*(1-earMix)); add(head,(headMix-jawMix)*(1-earMix))
  const tailMix = smooth(.33,.41,-p.z)*Math.max(smooth(.14,.23,p.y),smooth(.37,.43,-p.z))*(1-headMix)
  if (tailMix) {
    let distance = Infinity, segment = 0, along = 0
    for (let k=0;k<tail.length-1;k++) { const a=rests[tail[k]], delta=rests[tail[k+1]].clone().sub(a), t=T.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1), d=p.distanceToSquared(a.clone().addScaledVector(delta,t)); if(d<distance){distance=d;segment=k;along=t} }
    add(tail[segment],tailMix*(1-along));add(tail[segment+1],tailMix*along)
  }
  const leg = legs.find(l => l.front === (p.z>.04) && l.side === (p.x>cx ? 1 : -1))
  const legRegion = leg.front ? smooth(.04,.17,p.z) : 1-smooth(-.16,-.06,p.z)
  const legMix = (1-smooth(leg.front ? .29 : .27,.49,p.y))*legRegion*(1-headMix)*(1-tailMix)
  const pawMix = 1-smooth(.045,.10,p.y), upperMix = smooth(leg.front ? .20 : .23,leg.front ? .34 : .38,p.y), lowerMix = smooth(leg.front ? .07 : .115,leg.front ? .13 : .20,p.y)
  add(leg.foot,legMix*pawMix);add(leg.upper,legMix*(1-pawMix)*upperMix);add(leg.lower,legMix*(1-pawMix)*(1-upperMix)*lowerMix);add(leg.end,legMix*(1-pawMix)*(1-upperMix)*(1-lowerMix))
  const torso = Math.max(0,1-headMix-tailMix-legMix), n = smooth(.39,.63,p.y)*smooth(.17,.35,p.z), c=smooth(-.18,.19,p.z)
  add(neck,torso*n);add(chest,torso*(1-n)*c);add(body,torso*(1-n)*(1-c))
  const best=[...w].filter(([,v])=>v>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4), sum=best.reduce((s,[,v])=>s+v,0)
  assert(sum>0);while(best.length<4)best.push([body,0]);return {ids:best.map(([i])=>i),values:best.map(([,v])=>v/sum)}
}
const ids=[], values=[], pos=geometry.attributes.position
for(let i=0;i<pos.count;i++){const w=weights(new T.Vector3().fromBufferAttribute(pos,i));ids.push(...w.ids);values.push(...w.values)}
geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(values,4))
const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial());mesh.name='Snowdrop_Coat';root.add(mesh);mesh.bind(skeleton)

// Reuse the source Walk's cycle and footfall order, then fit stride and contact to this mesh.
const motionBytes=await fs.readFile(new URL('../public/models/characters/skater-cat/cat-source-motion.glb',import.meta.url))
const sourceMotion=await new GLTFLoader().parseAsync(motionBytes.buffer.slice(motionBytes.byteOffset,motionBytes.byteOffset+motionBytes.length),'')
const sourceWalk=sourceMotion.animations.find(a=>a.name==='Walk'), sourceMixer=new T.AnimationMixer(sourceMotion.scene), sourceAction=sourceMixer.clipAction(sourceWalk);sourceAction.play()
for(const leg of legs){
  const name=definitions[leg.foot].sourceName.replaceAll('.',''), b=sourceMotion.scene.getObjectByName(name);assert(b,name)
  let highest=-Infinity,peak=0
  for(let i=0;i<240;i++){sourceAction.time=sourceWalk.duration*i/240;sourceMixer.update(0);sourceMotion.scene.updateMatrixWorld(true);const y=b.getWorldPosition(new T.Vector3()).y;if(y>highest){highest=y;peak=i/240}}
  leg.phase=(.84-peak+1)%1
}
const stance=.68,stride=.14,lift=.047,duration=sourceWalk.duration
function reset(){bones.forEach((b,i)=>{b.quaternion.identity();b.position.copy(rests[i]);const parent=definitions[i].parent;if(parent!=null)b.position.sub(rests[parent])});root.updateMatrixWorld(true)}
function rotateWorld(i,q){const parent=bones[i].parent.getWorldQuaternion(new T.Quaternion());bones[i].quaternion.copy(parent.invert().multiply(q));root.updateMatrixWorld(true)}
function aim(i,end,target){const start=bones[i].getWorldPosition(new T.Vector3());rotateWorld(i,new T.Quaternion().setFromUnitVectors(rests[end].clone().sub(rests[i]).normalize(),target.clone().sub(start).normalize()))}
let maxReachError=0
function solveLeg(leg,target){
  const ankle=target.clone().add(rests[leg.end].clone().sub(rests[leg.foot])), hip=bones[leg.upper].getWorldPosition(new T.Vector3()), delta=ankle.clone().sub(hip), raw=delta.length(), axis=delta.normalize()
  const l1=rests[leg.upper].distanceTo(rests[leg.lower]),l2=rests[leg.lower].distanceTo(rests[leg.end]),d=T.MathUtils.clamp(raw,Math.abs(l1-l2)+1e-5,l1+l2-1e-5)
  maxReachError=Math.max(maxReachError,Math.abs(d-raw));assert(Math.abs(d-raw)<.012,`Unreachable ${definitions[leg.foot].name}: ${raw} / ${l1+l2}`)
  const along=(l1*l1-l2*l2+d*d)/(2*d), bend=new T.Vector3(0,0,leg.front?-1:1);bend.addScaledVector(axis,-bend.dot(axis)).normalize()
  const knee=hip.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)))
  aim(leg.upper,leg.lower,knee);aim(leg.lower,leg.end,ankle);aim(leg.end,leg.foot,target);rotateWorld(leg.foot,new T.Quaternion())
}
function walkFoot(leg,p){const t=(p+leg.phase)%1,target=rests[leg.foot].clone();if(t<stance)target.z+=stride*(.5-t/stance);else{const u=(t-stance)/(1-stance),s=u*u*(3-2*u),m=-(1-stance)/stance;target.z+=stride*(-.5+s+m*(2*u**3-3*u*u+u));target.y+=lift*Math.sin(Math.PI*u)**2}return target}
function pose(name,p){
  reset()
  if(name==='EarFlick'){
    ears.forEach((i,k)=>{const u=T.MathUtils.clamp((p-k*.08)/.84,0,1),envelope=Math.sin(Math.PI*u)**2;bones[i].rotation.z=(k?1:-1)*.28*Math.sin(u*Math.PI*4)*envelope;bones[i].rotation.x=.20*Math.sin(u*Math.PI*4+.4)*envelope})
    bones[head].rotation.y=.035*Math.sin(p*Math.PI*4)*Math.sin(p*Math.PI)**2;root.updateMatrixWorld(true);return
  }
  let targets=legs.map(l=>rests[l.foot].clone())
  if(name==='Walk'){
    bones[body].position.y-=.014-.002*Math.cos(p*Math.PI*4)
    bones[body].position.x+=.002*Math.sin(p*Math.PI*2)
    bones[neck].rotation.x=.008*Math.sin(p*Math.PI*4);bones[head].rotation.x=-.006*Math.sin(p*Math.PI*4)
    targets=legs.map(l=>walkFoot(l,p));tail.forEach((i,k)=>bones[i].rotation.y=.018*Math.sin(p*Math.PI*2-k*.4))
  }else if(name==='Sit'){
    const s=smooth(.05,.88,p);bones[body].position.y-=.235*s;bones[body].position.z-=.02*s;bones[body].rotation.x=-.53*s
    bones[neck].rotation.x=.31*s;bones[head].rotation.x=.22*s
    targets.forEach((v,i)=>{if(!legs[i].front){v.x+=legs[i].side*.025*s;v.z+=.025*s}})
  }else if(name==='Jump'){
    let h=0,feet=0,fold=0
    if(p<.18)h=-.065*smooth(0,.18,p)
    else if(p<.28){h=-.065+.125*smooth(.18,.28,p);feet=.06*smooth(.23,.28,p)}
    else if(p<.72){const u=(p-.28)/.44;h=.06+.36*Math.sin(Math.PI*u);fold=Math.sin(Math.PI*u);feet=.06+.40*fold}
    else if(p<.82){h=.06-.11*smooth(.72,.82,p);feet=.06*(1-smooth(.72,.80,p))}
    else h=-.05*(1-smooth(.82,1,p))
    bones[body].position.y+=h;bones[neck].rotation.x=-.04*fold;bones[head].rotation.x=.04*fold
    targets.forEach((v,i)=>{v.y+=feet;v.z+=(legs[i].front?-.025:.025)*fold})
  }
  root.updateMatrixWorld(true)
  if(name==='Sit')rotateWorld(tail[0],new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.65*smooth(.05,.88,p)))
  legs.forEach((l,i)=>solveLeg(l,targets[i]));root.updateMatrixWorld(true)
}
const clips=[]
for(const [name,seconds] of [['Walk',duration],['Sit',1.3],['Jump',1.5],['EarFlick',.72]]){
  const phases=[...new Set([...Array.from({length:181},(_,i)=>i/180),...(name==='Walk'?legs.flatMap(l=>[(1-l.phase)%1,(1+stance-l.phase)%1]):[])])].sort((a,b)=>a-b),times=[],samples=bones.map(()=>({q:[],p:[]}))
  for(const phase of phases){pose(name,name==='Walk'&&phase===1?0:phase);times.push(phase*seconds);bones.forEach((b,i)=>{samples[i].q.push(...b.quaternion.toArray());samples[i].p.push(...b.position.toArray())})}
  clips.push(new T.AnimationClip(name,seconds,bones.flatMap((b,i)=>[new T.QuaternionKeyframeTrack(`${b.name}.quaternion`,times,samples[i].q),...(i===body?[new T.VectorKeyframeTrack(`${b.name}.position`,times,samples[i].p)]:[])])))
}
reset()
const gait={duration,stance,stride,speed:stride/(duration*stance),lift,legs:legs.map(l=>({...l,name:bones[l.foot].name,rest:rests[l.foot].toArray()}))}
root.userData={sourceModel:'Meshy_AI_Snowdrop_1116030454_texture.glb (user supplied)',rigSource:'JonasDichelle — Rigged and animated Cat, CC BY 3.0',rigSourceUrl:'https://blendswap.com/blend/18519',modifications:'28 selected bone roles refit to Snowdrop; original Walk timing adapted with foot IK; Sit, Jump and EarFlick authored separately',gait}
const output=unpack(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,animations:clips})))
const chunks=[output.bin];let bytes=output.bin.length
output.json.images=source.json.images.map(image=>{const view=source.json.bufferViews[image.bufferView],data=source.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),padding=(4-bytes%4)%4;if(padding){chunks.push(Buffer.alloc(padding));bytes+=padding}const index=output.json.bufferViews.length;output.json.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:data.length});chunks.push(data);bytes+=data.length;return {...image,bufferView:index}})
for(const field of ['textures','samplers','materials'])if(source.json[field])output.json[field]=source.json[field]
output.json.buffers=[{byteLength:bytes}]
const json=Buffer.from(JSON.stringify(output.json)),jp=Buffer.alloc((4-json.length%4)%4,32),bin=Buffer.concat(chunks),bp=Buffer.alloc((4-bin.length%4)%4),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8)
header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+jp.length+bin.length+bp.length,8);jh.writeUInt32LE(json.length+jp.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length+bp.length);bh.writeUInt32LE(0x004e4942,4)
await fs.writeFile(new URL('snowdrop-interactions.glb',folder),Buffer.concat([header,jh,json,jp,bh,bin,bp]))
const report={sourceSha256:createHash('sha256').update(sourceBytes).digest('hex'),sourceVertices:pos.count,triangles:geometry.index.count/3,bones:definitions,clips:clips.map(c=>({name:c.name,duration:c.duration})),gait,maxReachError,textureBytesPreserved:true}
await fs.writeFile(new URL('snowdrop-build.json',folder),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({bones:bones.length,triangles:report.triangles,clips:report.clips,maxReachError},null,2))
