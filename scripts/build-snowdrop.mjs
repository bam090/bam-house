import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as T from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { skinDualQuaternion, dualQuaternionTransform } from './dual-quaternion-skin.mjs'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshBVH } from 'three-mesh-bvh'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(v => { this.result = v; this.onloadend?.() }) }
  readAsDataURL(blob) { blob.arrayBuffer().then(v => { this.result = `data:${blob.type};base64,${Buffer.from(v).toString('base64')}`; this.onloadend?.() }) }
}
const folder = new URL('../public/models/characters/snowdrop/', import.meta.url)
const volume = process.argv.includes('--volume')
const player = volume || process.argv.includes('--player')
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
const body = bone('Spine', [cx, volume ? .40 : .52, volume ? -.23 : -.20])
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
  const upper = bone(front ? `Thigh_front_${suffix}` : `Thigh_Back_${suffix}`, [x, front ? .48 : (volume ? .40 : .50), front ? .27 : (volume ? -.23 : -.22)], front ? chest : body)
  const lower = bone(front ? `Calf_Front_${suffix}` : `Calf_back_${suffix}`, [x, front ? .27 : (volume ? .20 : .30), front ? .20 : -.13], upper)
  const end = bone(front ? (side > 0 ? 'Foot_front_L2' : 'Foot_front_L2.002') : `Foot_Back_${suffix}`, [x, front ? .085 : (volume ? .20 : .12), front ? .265 : (volume ? -.34 : -.30)], lower)
  const foot = bone(front ? `Foot_front_${suffix}` : (side > 0 ? 'Foot_Back_L2' : 'Foot_Back_L2.002'), [x, .027, front ? .315 : -.225], end)
  legs.push({ side, front, upper, lower, end, foot, phase: 0 })
}
const haunches=volume?[1,-1].map(side=>{
  const i=bone(`Thigh_Back_${side>0?'L':'R'}`,[cx+side*.095,.40,-.23],body)
  bones[i].name=`Haunch_Support_${side>0?'L':'R'}`;definitions[i].name=bones[i].name
  return i
}):[]
assert.equal(bones.length, volume?30:28)
root.updateMatrixWorld(true)
const skeleton = new T.Skeleton(bones); skeleton.calculateInverses()
const smooth = (a,b,x) => { const t = T.MathUtils.clamp((x-a)/(b-a),0,1); return t*t*(3-2*t) }
function weights(p) {
  const w = new Map(), add = (i,v) => w.set(i,(w.get(i)||0)+v)
  const headMix = Math.max(smooth(.56,.70,p.y)*smooth(.10,.25,p.z),smooth(.38,.46,p.z)*smooth(.45,.54,p.y))
  // The crown stays on Head; a height-only mask split the skull between the two ears.
  const earMix = smooth(.815,.90,p.y)*smooth(.065,.105,Math.abs(p.x-cx)), jawMix = (1-smooth(.66,.705,p.y))*smooth(.47,.54,p.z)*headMix*.55
  add(ears[p.x > cx ? 0 : 1], headMix*earMix); add(jaw,jawMix*(1-earMix)); add(head,(headMix-jawMix)*(1-earMix))
  let distance = Infinity, segment = 0, along = 0, rootDistance = 0, arc = 0
  for (let k=0;k<tail.length-1;k++) {
    const a=rests[tail[k]],delta=rests[tail[k+1]].clone().sub(a),raw=p.clone().sub(a).dot(delta)/delta.lengthSq(),t=T.MathUtils.clamp(raw,0,1),d=p.distanceToSquared(a.clone().addScaledVector(delta,t))
    if(d<distance){distance=d;segment=k;along=t;rootDistance=arc+(k===0?raw:t)*delta.length()}
    arc+=delta.length()
  }
  // Keep the visible tail tube on tail bones; pelvis weights flattened its root in resting poses.
  const tube=volume?smooth(-.06,.025,rootDistance)*(1-smooth(.075,.10+.05*smooth(.26,.34,p.y),Math.sqrt(distance))):0
  const tailMix = Math.max(tube,(1-smooth(volume ? .48 : .35,volume ? .60 : .48,p.y))*smooth(.35,.45,-p.z)*Math.max(smooth(volume?.24:.14,volume?.32:.23,p.y),smooth(.37,.43,-p.z)))*(1-headMix)
  add(tail[segment],tailMix*(1-along));add(tail[segment+1],tailMix*along)
  const leg = legs.find(l => l.front === (p.z>.04) && l.side === (p.x>cx ? 1 : -1))
  const legRegion = leg.front ? smooth(.04,.17,p.z) : 1-smooth(-.16,-.06,p.z)
  const limbSide = 1-smooth(.18,.30,p.y)*(1-smooth(.025,.075,Math.abs(p.x-cx)))
  const pelvicMass = volume && !leg.front ? 1-smooth(.12,.28,p.y) : 1
  const legMix = pelvicMass*limbSide*(1-smooth(leg.front ? .24 : .35,leg.front ? .43 : .53,p.y))*legRegion*(1-headMix)*(1-tailMix)
  const pawMix = 1-smooth(volume ? (leg.front ? .045 : .065) : .045,volume ? (leg.front ? .075 : .12) : .10,p.y), upperMix = smooth(leg.front ? .20 : .14,leg.front ? .34 : .27,p.y), lowerMix = smooth(leg.front ? .07 : .115,leg.front ? .13 : .20,p.y)
  add(leg.foot,legMix*pawMix);add(leg.upper,legMix*(1-pawMix)*upperMix);add(leg.lower,legMix*(1-pawMix)*(1-upperMix)*lowerMix);add(leg.end,legMix*(1-pawMix)*(1-upperMix)*(1-lowerMix))
  const torso = Math.max(0,1-headMix-tailMix-legMix), n = smooth(.39,.63,p.y)*smooth(.17,.35,p.z), c=smooth(-.18,.19,p.z)
  const haunch=volume?(1-smooth(.32,.55,p.y))*(1-smooth(-.10,.08,p.z))*smooth(-.40,-.23,p.z)*smooth(.025,.08,Math.abs(p.x-cx)):0
  if(haunch)add(haunches[p.x>cx?0:1],torso*haunch)
  add(neck,torso*(1-haunch)*n);add(chest,torso*(1-haunch)*(1-n)*c);add(body,torso*(1-haunch)*(1-n)*(1-c))
  const best=[...w].filter(([,v])=>v>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4), sum=best.reduce((s,[,v])=>s+v,0)
  assert(sum>0);while(best.length<4)best.push([body,0]);return {ids:best.map(([i])=>i),values:best.map(([,v])=>v/sum)}
}
const ids=[], values=[], pos=geometry.attributes.position
for(let i=0;i<pos.count;i++){const w=weights(new T.Vector3().fromBufferAttribute(pos,i));ids.push(...w.ids);values.push(...w.values)}
// Diffuse weights across welded surface neighbours, including UV seams.
const welded=new Map(),vertexNodes=[],nodes=[]
for(let i=0;i<pos.count;i++){
  const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v*1e5)).join(',')
  if(!welded.has(key)){welded.set(key,nodes.length);nodes.push({vertex:i,neighbours:new Set(),w:new Float64Array(bones.length)})}
  const n=welded.get(key);vertexNodes.push(n);nodes[n].w.fill(0)
  // Padding can repeat the pelvis index. Zero padding must not erase its real weight.
  for(let k=0;k<4;k++)nodes[n].w[ids[i*4+k]]+=values[i*4+k]
  assert(Math.abs(nodes[n].w.reduce((sum,v)=>sum+v,0)-1)<1e-6,'Welded weights lost an influence')
}
for(let i=0;i<geometry.index.count;i+=3){const tri=[0,1,2].map(k=>vertexNodes[geometry.index.getX(i+k)]);for(const a of tri)for(const b of tri)if(a!==b)nodes[a].neighbours.add(b)}
for(let pass=0;pass<24;pass++){
  const next=nodes.map(n=>{
    const result=n.w.slice(),y=pos.getY(n.vertex)
    if(y<.06||y>.72||!n.neighbours.size||(volume&&tail.reduce((sum,i)=>sum+n.w[i],0)>.99999))return result
    for(let k=0;k<bones.length;k++){let sum=0;for(const j of n.neighbours)sum+=nodes[j].w[k];result[k]=n.w[k]*.45+.55*sum/n.neighbours.size}
    return result
  });nodes.forEach((n,i)=>n.w=next[i])
}
for(let i=0;i<pos.count;i++){
  const best=Array.from(nodes[vertexNodes[i]].w,(v,k)=>[k,v]).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((s,b)=>s+b[1],0)
  best.forEach(([id,v],k)=>{ids[i*4+k]=id;values[i*4+k]=v/sum})
}
geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(values,4))
const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial());mesh.name='Snowdrop_Coat';root.add(mesh);mesh.bind(skeleton)

// Reuse the source Walk's cycle, then fit footfalls, stride and contact to this mesh.
const motionBytes=await fs.readFile(new URL('../public/models/characters/skater-cat/cat-source-motion.glb',import.meta.url))
const sourceMotion=await new GLTFLoader().parseAsync(motionBytes.buffer.slice(motionBytes.byteOffset,motionBytes.byteOffset+motionBytes.length),'')
const sourceWalk=sourceMotion.animations.find(a=>a.name==='Walk'), sourceMixer=new T.AnimationMixer(sourceMotion.scene), sourceAction=sourceMixer.clipAction(sourceWalk);sourceAction.play()
for(const leg of legs){
  const name=definitions[leg.foot].sourceName.replaceAll('.',''), b=sourceMotion.scene.getObjectByName(name);assert(b,name)
  let highest=-Infinity,peak=0
  for(let i=0;i<240;i++){sourceAction.time=sourceWalk.duration*i/240;sourceMixer.update(0);sourceMotion.scene.updateMatrixWorld(true);const y=b.getWorldPosition(new T.Vector3()).y;if(y>highest){highest=y;peak=i/240}}
  leg.phase=(.84-peak+1)%1
}
// Even four-beat footfalls: each forepaw follows the hind paw on the same side.
if(volume)for(const leg of legs)leg.phase=(.84+(leg.side<0?.5:0)-(leg.front?.25:0)+1)%1
const stance=volume?.64:.68,stride=volume?.38:player?.30:.14,lift=volume?.030:.047,duration=sourceWalk.duration
function reset(){bones.forEach((b,i)=>{b.quaternion.identity();b.position.copy(rests[i]);const parent=definitions[i].parent;if(parent!=null)b.position.sub(rests[parent])});root.updateMatrixWorld(true)}
function rotateWorld(i,q){const parent=bones[i].parent.getWorldQuaternion(new T.Quaternion());bones[i].quaternion.copy(parent.invert().multiply(q));root.updateMatrixWorld(true)}
function aim(i,end,target){const start=bones[i].getWorldPosition(new T.Vector3());rotateWorld(i,new T.Quaternion().setFromUnitVectors(rests[end].clone().sub(rests[i]).normalize(),target.clone().sub(start).normalize()))}
let maxReachError=0
function solveLeg(leg,target,fold=0,resting=0){
  const offset=rests[leg.end].clone().sub(rests[leg.foot])
  if(leg.front)offset.lerp(new T.Vector3(0,volume ? .042 : .018,-Math.sqrt(offset.lengthSq()-(volume ? .042 : .018)**2)),fold)
  else if(volume)offset.lerp(new T.Vector3(0,.060,-Math.sqrt(offset.lengthSq()-.060**2)),resting)
  const ankle=target.clone().add(offset), hip=bones[leg.upper].getWorldPosition(new T.Vector3()), delta=ankle.clone().sub(hip), raw=delta.length(), axis=delta.normalize()
  const l1=rests[leg.upper].distanceTo(rests[leg.lower]),l2=rests[leg.lower].distanceTo(rests[leg.end]),d=T.MathUtils.clamp(raw,Math.abs(l1-l2)+1e-5,l1+l2-1e-5)
  maxReachError=Math.max(maxReachError,Math.abs(d-raw));assert(Math.abs(d-raw)<.012,`Unreachable ${definitions[leg.foot].name}: ${raw} / ${l1+l2}`)
  const along=(l1*l1-l2*l2+d*d)/(2*d), bend=new T.Vector3(volume ? 0 : leg.side*(leg.front?.08:.6)*fold,0,leg.front?-1:1);bend.addScaledVector(axis,-bend.dot(axis)).normalize()
  const knee=hip.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)))
  aim(leg.upper,leg.lower,knee);aim(leg.lower,leg.end,ankle);aim(leg.end,leg.foot,target);rotateWorld(leg.foot,new T.Quaternion())
}
function walkFoot(leg,p){const t=(p+leg.phase)%1,target=rests[leg.foot].clone();if(t<stance)target.z+=stride*(.5-t/stance);else{const u=(t-stance)/(1-stance),s=u*u*(3-2*u),m=-(1-stance)/stance;target.z+=stride*(-.5+s+m*(2*u**3-3*u*u+u));target.y+=lift*Math.sin(Math.PI*u)**2}return target}
function restTail(amount,name) {
  if(volume){
    // Keep the authored plume curve rigid while resting; different segment twists flattened it.
    // Seated yaw pulled the mixed tail/pelvis attachment behind the left haunch.
    const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),(name==='Sit'?0:.60)*amount)
      .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),(name==='Sit'?.16:0)*amount))
    for(const i of tail)rotateWorld(i,rotation)
    return
  }
  for(let k=0;k<tail.length-1;k++){
    const start=bones[tail[k]].getWorldPosition(new T.Vector3()),restDelta=rests[tail[k+1]].clone().sub(rests[tail[k]])
    const y=T.MathUtils.lerp(start.y+restDelta.y,(volume?[.14,.10,.085,.085]:[.12,.115,.115,.12])[k],amount),dy=y-start.y
    const horizontal=new T.Vector3(restDelta.x*(volume?T.MathUtils.lerp(1,.30,amount):1),0,restDelta.z).normalize(),length=restDelta.length()
    const end=start.clone().addScaledVector(horizontal,Math.sqrt(Math.max(.0001,length*length-dy*dy)));end.y=y
    aim(tail[k],tail[k+1],end)
  }
  rotateWorld(tail.at(-1),bones[tail.at(-2)].getWorldQuaternion(new T.Quaternion()))
}
function pose(name,p){
  reset()
  if(name==='EarFlick'){
    ears.forEach((i,k)=>{const u=T.MathUtils.clamp((p-k*.08)/.84,0,1),envelope=Math.sin(Math.PI*u)**2;bones[i].rotation.z=(k?1:-1)*.28*Math.sin(u*Math.PI*4)*envelope;bones[i].rotation.x=.20*Math.sin(u*Math.PI*4+.4)*envelope})
    root.updateMatrixWorld(true);return
  }
  let targets=legs.map(l=>rests[l.foot].clone())
  if(name==='Walk'){
    bones[body].position.y-=(volume?.040:player?.020:.014)-.002*Math.cos(p*Math.PI*4)
    bones[body].position.x+=(volume?.001:.002)*Math.sin(p*Math.PI*2)
    bones[neck].rotation.x=.008*Math.sin(p*Math.PI*4);bones[head].rotation.x=-.006*Math.sin(p*Math.PI*4)
    targets=legs.map(l=>walkFoot(l,p))
    if(!volume)tail.forEach((i,k)=>bones[i].rotation.y=.018*Math.sin(p*Math.PI*2-k*.4))
  }else if(name==='Sit'){
    const s=smooth(.05,.88,p)
    if(volume){
      bones[body].position.y-=.15*s;bones[body].position.z+=.08*s;bones[body].rotation.x=-.40*s
      bones[chest].rotation.x=.20*s;bones[neck].rotation.x=-.60*s;bones[head].rotation.x=.80*s
      targets.forEach((v,i)=>{if(!legs[i].front){v.x+=legs[i].side*.045*s;v.z+=.36*s}else v.z-=.02*s})
    }else{
      bones[body].position.y-=.26*s;bones[body].position.z-=.015*s;bones[body].rotation.x=-.60*s
      bones[neck].rotation.x=.35*s;bones[head].rotation.x=.25*s
      targets.forEach((v,i)=>{if(!legs[i].front){v.x+=legs[i].side*.025*s;v.z+=.01*s}else v.z-=.015*s})
    }
  }else if(name==='Lie'){
    const s=smooth(.04,.90,p);bones[body].position.y-=(volume?.15:.265)*s
    if(volume){
      bones[body].rotation.x=.15*s;bones[chest].rotation.x=-.15*s
    }
    bones[neck].rotation.x=-.07*s;bones[head].rotation.x=.07*s
    targets.forEach((v,i)=>{v.z+=(legs[i].front?(volume?.385:.40):(volume?.28:0))*s;v.x+=legs[i].side*(legs[i].front?0:(volume?.045:.018))*s})
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
  if(volume&&['Sit','Lie'].includes(name)){const s=smooth(.05,.88,p);targets.forEach((v,i)=>{if(!legs[i].front||name==='Lie')v.y+=.025*Math.sin(Math.PI*s)**2})}
  root.updateMatrixWorld(true)
  if(volume&&name==='Walk'){
    // Lift the whole plume clear of the longer hind-leg sweep without flattening its sections.
    const rotation=new T.Quaternion().setFromEuler(new T.Euler(.38,.015*Math.sin(p*Math.PI*2),0))
    for(const i of tail)rotateWorld(i,rotation)
  }
  if(volume&&['Sit','Lie'].includes(name))for(const i of haunches)rotateWorld(i,new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-.40*smooth(.05,.88,p)))
  if(name==='Sit'||name==='Lie')restTail(smooth(.05,.88,p),name)
  legs.forEach((l,i)=>solveLeg(l,targets[i],name==='Lie'?smooth(.04,.90,p):0,['Sit','Lie'].includes(name)?smooth(.05,.88,p):0));root.updateMatrixWorld(true)
  if(volume&&name==='Walk')for(const leg of legs.filter(l=>!l.front)){
    const rotation=bones[body].getWorldQuaternion(new T.Quaternion()).slerp(bones[leg.upper].getWorldQuaternion(new T.Quaternion()),.65)
    rotateWorld(haunches[leg.side>0?0:1],rotation)
  }
  if(name==='Sit'||name==='Lie')for(const leg of legs){
    const hip=bones[leg.upper].getWorldPosition(new T.Vector3()),knee=bones[leg.lower].getWorldPosition(new T.Vector3())
    assert(knee.y<hip.y,`${name} phase ${p} ${bones[leg.upper].name}: knee ${knee.toArray()} above hip ${hip.toArray()}`)
    if(leg.front)assert(Math.abs(knee.x-hip.x)<.025,`${name}: foreleg bent sideways`)
    if(!volume&&name==='Lie'&&p===1&&leg.front){
      const wrist=bones[leg.end].getWorldPosition(new T.Vector3()),paw=bones[leg.foot].getWorldPosition(new T.Vector3())
      const angle=wrist.clone().sub(knee).angleTo(paw.sub(wrist))
      assert(angle<T.MathUtils.degToRad(25),`Lie: wrist overbent ${T.MathUtils.radToDeg(angle)}`)
    }
  }
}
// Folded poses need corrective shapes where the generated mesh has no joint loops.
// Match the seated left rear surface to its right-side counterpart, using rest-space correspondence.
const sitMirror=nodes.map(()=>null),sitMirrorEdges=[]
if(volume){
  const right=new T.BufferGeometry(),triangles=[]
  for(let i=0;i<geometry.index.count;i+=3){const tri=[0,1,2].map(k=>geometry.index.getX(i+k));if(tri.every(v=>pos.getX(v)<cx&&pos.getZ(v)<.10&&pos.getY(v)<.65))triangles.push(...tri)}
  right.setAttribute('position',pos);right.setIndex(triangles)
  const bvh=new MeshBVH(right,{indirect:true}),query=new T.Vector3(),triangle=new T.Triangle(),barycentric=new T.Vector3()
  nodes.forEach((n,i)=>{
    const x=pos.getX(n.vertex),y=pos.getY(n.vertex),z=pos.getZ(n.vertex)
    const weight=smooth(.015,.05,x-cx)*(1-smooth(.48,.63,y))*(1-smooth(-.08,.06,z))*smooth(-.45,-.36,z)*(1-smooth(.85,.999,tail.reduce((sum,k)=>sum+n.w[k],0)))
    if(!weight)return
    query.set(2*cx-x,y,z)
    const hit=bvh.closestPointToPoint(query),vertices=[0,1,2].map(k=>right.index.getX(hit.faceIndex*3+k))
    triangle.set(...vertices.map(v=>new T.Vector3().fromBufferAttribute(pos,v)));triangle.getBarycoord(hit.point,barycentric)
    sitMirror[i]={weight,nodes:vertices.map(v=>vertexNodes[v]),barycentric:barycentric.toArray()}
  })
  for(let i=0;i<nodes.length;i++)for(const j of nodes[i].neighbours)if(j>i&&(sitMirror[i]||sitMirror[j])){
    const length=new T.Vector3().fromBufferAttribute(pos,nodes[i].vertex).distanceTo(new T.Vector3().fromBufferAttribute(pos,nodes[j].vertex))
    if(length>.0005)sitMirrorEdges.push({i,j,length:length*3})
  }
  right.dispose()
}
const correctiveNames=volume?['Sit','Lie','SitMid','LieMid',...Array.from({length:8},(_,i)=>`Walk${i}`)]:['Sit','Lie'],correctives=[],correctiveNormals=[]
function correctiveWeight(corrective,clip,p){
  if(clip==='Walk'&&corrective.startsWith('Walk')){const d=Math.abs(p*8-Number(corrective.at(-1)));return Math.max(0,1-Math.min(d,8-d))}
  const amount=smooth(.05,.88,p)
  return corrective===clip?amount:corrective===`${clip}Mid`?4*amount*(1-amount):0
}
for(const name of correctiveNames){
  if(volume){
    const walking=name.startsWith('Walk'),mid=name.endsWith('Mid'),baseName=walking?'Walk':name.replace('Mid',''),baseIndex=baseName==='Sit'?0:1
    pose(baseName,walking?Number(name.at(-1))/8:mid?.465:1);skeleton.update()
    const transforms=nodes.map(n=>dualQuaternionTransform(ids.slice(n.vertex*4,n.vertex*4+4),values.slice(n.vertex*4,n.vertex*4+4),skeleton.boneMatrices))
    let points=nodes.map((n,i)=>{
      const point=new T.Vector3().fromBufferAttribute(pos,n.vertex)
      if(mid)point.addScaledVector(new T.Vector3().fromBufferAttribute(correctives[baseIndex],n.vertex),.5)
      return point.applyQuaternion(transforms[i].rotation).add(transforms[i].translation)
    })
    const original=points.map(p=>p.clone())
    const mask=nodes.map(n=>{
      const y=pos.getY(n.vertex),z=pos.getZ(n.vertex)
      const tailInfluence=tail.reduce((sum,i)=>sum+n.w[i],0)
      const legFold=smooth(.055,.09,y)*(1-smooth(.24,.32,y))*(1-smooth(-.06,.02,z))*smooth(-.40,walking?-.35:-.32,z)
      const tailRoot=baseName==='Sit'?smooth(.46,.50,y)*(1-smooth(.56,.61,y))*smooth(.30,.37,-z)*(1-smooth(.44,.49,-z))*(1-smooth(.09,.15,Math.abs(pos.getX(n.vertex)-cx))):0
      return Math.max(legFold,.35*tailRoot)*(1-smooth(.2,.95,tailInfluence))
    })
    for(let pass=0;pass<(walking?48:160);pass++)points=points.map((p,i)=>{
      if(!mask[i])return p
      const mean=new T.Vector3();for(const j of nodes[i].neighbours)mean.add(points[j]);mean.divideScalar(nodes[i].neighbours.size)
      return p.clone().lerp(mean,.45*mask[i])
    })
    // Keep local joint loops from stretching into a thin strip at the fixed boundary.
    const limits=[]
    for(let i=0;i<nodes.length;i++)for(const j of nodes[i].neighbours)if(j>i&&mask[i]+mask[j]>0){
      const length=new T.Vector3().fromBufferAttribute(pos,nodes[i].vertex).distanceTo(new T.Vector3().fromBufferAttribute(pos,nodes[j].vertex))
      if(length>.0005)limits.push({i,j,length:length*3})
    }
    for(let pass=0;pass<40;pass++)for(const {i,j,length}of limits){
      const delta=points[j].clone().sub(points[i]),distance=delta.length(),weight=mask[i]+mask[j]
      if(distance>length){delta.multiplyScalar((distance-length)/distance/weight);points[i].addScaledVector(delta,mask[i]);points[j].addScaledVector(delta,-mask[j])}
    }
    let normalsBeforeMirror=null
    if(baseName==='Sit'){
      const before=geometry.clone();before.setAttribute('position',new T.Float32BufferAttribute(vertexNodes.flatMap(n=>points[n].toArray()),3));before.computeVertexNormals()
      normalsBeforeMirror=nodes.map(()=>new T.Vector3());for(let i=0;i<pos.count;i++)normalsBeforeMirror[vertexNodes[i]].add(new T.Vector3().fromBufferAttribute(before.attributes.normal,i));normalsBeforeMirror.forEach(n=>n.normalize());before.dispose()
      let offsets=points.map((point,i)=>{
        const match=sitMirror[i];if(!match)return new T.Vector3()
        const target=new T.Vector3();match.nodes.forEach((n,k)=>target.addScaledVector(points[n],match.barycentric[k]));target.x=2*cx-target.x
        if(mid){const raw=new T.Vector3().fromBufferAttribute(pos,nodes[i].vertex).applyQuaternion(transforms[i].rotation).add(transforms[i].translation);target.lerp(raw,.5)}
        return target.sub(point).multiplyScalar(match.weight)
      })
      // The source sides have different topology; diffuse displacement to avoid nearest-face creases.
      for(let pass=0;pass<24;pass++)offsets=offsets.map((offset,i)=>{
        if(!sitMirror[i])return offset
        const mean=new T.Vector3();for(const j of nodes[i].neighbours)mean.add(offsets[j]);mean.divideScalar(nodes[i].neighbours.size)
        return offset.clone().lerp(mean,.55)
      })
      points.forEach((point,i)=>point.add(offsets[i]))
      for(let pass=0;pass<40;pass++)for(const {i,j,length}of sitMirrorEdges){
        const a=sitMirror[i]?.weight||0,b=sitMirror[j]?.weight||0,delta=points[j].clone().sub(points[i]),distance=delta.length()
        if(distance>length){delta.multiplyScalar((distance-length)/distance/(a+b));points[i].addScaledVector(delta,a);points[j].addScaledVector(delta,-b)}
      }
    }
    const surface=geometry.clone();surface.setAttribute('position',new T.Float32BufferAttribute(vertexNodes.flatMap(n=>points[n].toArray()),3));surface.computeVertexNormals()
    const normals=nodes.map(()=>new T.Vector3());for(let i=0;i<pos.count;i++)normals[vertexNodes[i]].add(new T.Vector3().fromBufferAttribute(surface.attributes.normal,i));normals.forEach(n=>n.normalize())
    const result=new Float32Array(pos.count*3),normalResult=new Float32Array(pos.count*3)
    for(let i=0;i<pos.count;i++){
      const node=vertexNodes[i],inverse=transforms[node].rotation.clone().invert()
      result.set(points[node].clone().sub(original[node]).applyQuaternion(inverse).toArray(),i*3)
      if(mask[node]){
        const normal=normals[node].clone().applyQuaternion(inverse).sub(new T.Vector3().fromBufferAttribute(geometry.attributes.normal,i))
        if(mid)normal.addScaledVector(new T.Vector3().fromBufferAttribute(correctiveNormals[baseIndex],i),-.5)
        normalResult.set(normal.toArray(),i*3)
      }else if(baseName==='Sit'&&sitMirror[node]){
        normalResult.set(normals[node].clone().sub(normalsBeforeMirror[node]).applyQuaternion(inverse).toArray(),i*3)
      }
    }
    const a=new T.BufferAttribute(result,3);a.name=`${name}Fold`;correctives.push(a);correctiveNormals.push(new T.BufferAttribute(normalResult,3));surface.dispose();continue
  }
  pose(name,1);skeleton.update()
  const points=nodes.map(n=>skinDualQuaternion(new T.Vector3().fromBufferAttribute(pos,n.vertex),ids.slice(n.vertex*4,n.vertex*4+4),values.slice(n.vertex*4,n.vertex*4+4),skeleton.boneMatrices))
  const mask=nodes.map(n=>{
    const y=pos.getY(n.vertex),z=pos.getZ(n.vertex)
    return Math.max(smooth(.065,.13,y)*(1-smooth(.49,.62,y))*(1-smooth(.04,.18,z))*smooth(-.42,-.31,z),smooth(.42,.54,y)*(1-smooth(.65,.73,y))*smooth(.20,.30,z)*(1-smooth(.47,.53,z)))
  })
  for(let pass=0;pass<60;pass++){
    const next=points.map((p,i)=>{
      const n=nodes[i];if(!mask[i]||!n.neighbours.size)return p.clone()
      const mean=new T.Vector3();for(const j of n.neighbours)mean.add(points[j]);mean.multiplyScalar(1/n.neighbours.size)
      return p.clone().lerp(mean,(pass%2?-.53:.5)*mask[i])
    });points.splice(0,points.length,...next)
  }
  points.forEach((point,i)=>{const n=nodes[i];if(pos.getY(n.vertex)>.06&&point.y<.025)point.y=.004+.021*Math.exp((point.y-.025)/.021)})
  const surface=new T.BufferGeometry();surface.setIndex(geometry.index);surface.setAttribute('position',new T.Float32BufferAttribute(vertexNodes.flatMap(n=>points[n].toArray()),3));surface.computeVertexNormals()
  const surfaceNormals=nodes.map(()=>new T.Vector3());for(let i=0;i<pos.count;i++)surfaceNormals[vertexNodes[i]].add(new T.Vector3().fromBufferAttribute(surface.attributes.normal,i));surfaceNormals.forEach(n=>n.normalize())
  const result=new Float32Array(pos.count*3),normalResult=new Float32Array(pos.count*3),blend=new T.Matrix4(),mat=new T.Matrix4()
  for(let i=0;i<pos.count;i++){
    blend.elements.fill(0)
    for(let k=0;k<4;k++){
      mat.fromArray(skeleton.boneMatrices,ids[i*4+k]*16)
      for(let j=0;j<16;j++)blend.elements[j]+=mat.elements[j]*values[i*4+k]
    }
    const sourceNormal=new T.Vector3().fromBufferAttribute(geometry.attributes.normal,i),normal=sourceNormal.clone().transformDirection(blend).copy(surfaceNormals[vertexNodes[i]]).normalize()
    const corrected=points[vertexNodes[i]].clone().applyMatrix4(blend.invert()).sub(new T.Vector3().fromBufferAttribute(pos,i))
    result.set(corrected.toArray(),i*3)
    normal.transformDirection(blend).sub(sourceNormal);normalResult.set(normal.toArray(),i*3)
  }
  const attribute=new T.BufferAttribute(result,3);attribute.name=`${name}Fold`;correctives.push(attribute);correctiveNormals.push(new T.BufferAttribute(normalResult,3));surface.dispose()
}
geometry.morphAttributes.position=correctives;geometry.morphAttributes.normal=correctiveNormals;geometry.morphTargetsRelative=true;mesh.updateMorphTargets()
const goals=volume?legs.flatMap((l,i)=>['end','foot'].map(j=>{const o=new T.Object3D();o.name=`CatGoal_${i}_${j}`;o.position.copy(rests[l[j]]);root.add(o);return {object:o,bone:l[j]}})):[]
const clips=[]
for(const [name,seconds] of [['Walk',duration],['Sit',1.3],['Lie',1.5],['Jump',1.5],['EarFlick',.72]]){
  const phases=[...new Set([...Array.from({length:181},(_,i)=>i/180),...(name==='Walk'?legs.flatMap(l=>[(1-l.phase)%1,(1+stance-l.phase)%1]):[])])].sort((a,b)=>a-b),times=[],samples=bones.map(()=>({q:[],p:[]})),goalSamples=goals.map(()=>[])
  for(const phase of phases){pose(name,name==='Walk'&&phase===1?0:phase);times.push(phase*seconds);bones.forEach((b,i)=>{samples[i].q.push(...b.quaternion.toArray());samples[i].p.push(...b.position.toArray())});goals.forEach((g,i)=>goalSamples[i].push(...bones[g.bone].getWorldPosition(new T.Vector3()).toArray()))}
  clips.push(new T.AnimationClip(name,seconds,[...goals.map((g,i)=>new T.VectorKeyframeTrack(`${g.object.name}.position`,times,goalSamples[i])),new T.NumberKeyframeTrack('Snowdrop_Coat.morphTargetInfluences',times,phases.flatMap(p=>correctiveNames.map(n=>correctiveWeight(n,name,p)))),...bones.flatMap((b,i)=>[new T.QuaternionKeyframeTrack(`${b.name}.quaternion`,times,samples[i].q),...(i===body?[new T.VectorKeyframeTrack(`${b.name}.position`,times,samples[i].p)]:[])])]))
}
reset()
const gait={duration,stance,stride,speed:stride/(duration*stance),lift,legs:legs.map(l=>({...l,name:bones[l.foot].name,rest:rests[l.foot].toArray(),...(volume?{jointNames:['upper','lower','end','foot'].map(k=>bones[l[k]].name),jointRests:['upper','lower','end','foot'].map(k=>rests[l[k]].toArray())}:{})}))}
root.userData={skinning:volume?'dualQuaternion':'linear',sourceModel:'Meshy_AI_Snowdrop_1116030454_texture.glb (user supplied)',rigSource:'JonasDichelle — Rigged and animated Cat, CC BY 3.0',rigSourceUrl:'https://blendswap.com/blend/18519',modifications:volume?'28 motion bones plus two haunch supports; local hind-leg and tail-attachment corrections; preserved tail cross-sections':'28 selected bone roles refit to Snowdrop; original Walk timing adapted with foot IK; Sit, Lie, Jump and EarFlick authored separately',gait}
const output=unpack(Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,animations:clips})))
const chunks=[output.bin];let bytes=output.bin.length
output.json.images=source.json.images.map(image=>{const view=source.json.bufferViews[image.bufferView],data=source.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),padding=(4-bytes%4)%4;if(padding){chunks.push(Buffer.alloc(padding));bytes+=padding}const index=output.json.bufferViews.length;output.json.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:data.length});chunks.push(data);bytes+=data.length;return {...image,bufferView:index}})
for(const field of ['textures','samplers','materials'])if(source.json[field])output.json[field]=source.json[field]
output.json.buffers=[{byteLength:bytes}]
const json=Buffer.from(JSON.stringify(output.json)),jp=Buffer.alloc((4-json.length%4)%4,32),bin=Buffer.concat(chunks),bp=Buffer.alloc((4-bin.length%4)%4),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8)
header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+jp.length+bin.length+bp.length,8);jh.writeUInt32LE(json.length+jp.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length+bp.length);bh.writeUInt32LE(0x004e4942,4)
await fs.writeFile(new URL(volume?'snowdrop-volume.glb':player?'snowdrop-player.glb':'snowdrop-interactions.glb',folder),Buffer.concat([header,jh,json,jp,bh,bin,bp]))
const report={sourceSha256:createHash('sha256').update(sourceBytes).digest('hex'),sourceVertices:pos.count,triangles:geometry.index.count/3,bones:definitions,clips:clips.map(c=>({name:c.name,duration:c.duration})),gait,maxReachError,textureBytesPreserved:true,deformation:{method:volume?'runtime dual-quaternion with local hind-leg and tail-attachment corrections':'dual-quaternion corrective shapes',smoothing:volume?'48 walk/160 rest local relaxation passes with bounded edge lengths; hind-leg folds and tail attachment only; tail tube pinned':'30 Taubin pairs, no 260-pass shrinking',lieWristAngleLimitDegrees:volume?null:25}}
await fs.writeFile(new URL(volume?'snowdrop-volume-build.json':player?'snowdrop-player-build.json':'snowdrop-build.json',folder),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({bones:bones.length,triangles:report.triangles,clips:report.clips,maxReachError},null,2))
