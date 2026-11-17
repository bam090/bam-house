import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as T from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { skinDualQuaternion } from './dual-quaternion-skin.mjs'

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
  const lower = bone(front ? `Calf_Front_${suffix}` : `Calf_back_${suffix}`, [x, front ? .27 : .30, front ? .28 : -.13], upper)
  const end = bone(front ? (side > 0 ? 'Foot_front_L2' : 'Foot_front_L2.002') : `Foot_Back_${suffix}`, [x, front ? .085 : .20, front ? .29 : -.28], lower)
  const foot = bone(front ? `Foot_front_${suffix}` : (side > 0 ? 'Foot_Back_L2' : 'Foot_Back_L2.002'), [x, .027, front ? .335 : -.225], end)
  legs.push({ side, front, upper, lower, end, foot, phase: 0 })
}
assert.equal(bones.length, 28)
root.updateMatrixWorld(true)
const skeleton = new T.Skeleton(bones); skeleton.calculateInverses()
const smooth = (a,b,x) => { const t = T.MathUtils.clamp((x-a)/(b-a),0,1); return t*t*(3-2*t) }
function weights(p) {
  const w = new Map(), add = (i,v) => w.set(i,(w.get(i)||0)+v)
  const headMix = Math.max(smooth(.56,.70,p.y)*smooth(.10,.25,p.z),smooth(.38,.46,p.z)*smooth(.45,.54,p.y))
  // The crown stays on Head; a height-only mask split the skull between the two ears.
  const earMix = smooth(.815,.90,p.y)*smooth(.065,.105,Math.abs(p.x-cx)), jawMix = (1-smooth(.66,.705,p.y))*smooth(.47,.54,p.z)*headMix*.55
  add(ears[p.x > cx ? 0 : 1], headMix*earMix); add(jaw,jawMix*(1-earMix)); add(head,(headMix-jawMix)*(1-earMix))
  const tailMix = smooth(.33,.46,-p.z)*Math.max(smooth(.14,.23,p.y),smooth(.37,.43,-p.z))*(1-headMix)
  if (tailMix) {
    let distance = Infinity, segment = 0, along = 0
    for (let k=0;k<tail.length-1;k++) { const a=rests[tail[k]], delta=rests[tail[k+1]].clone().sub(a), t=T.MathUtils.clamp(p.clone().sub(a).dot(delta)/delta.lengthSq(),0,1), d=p.distanceToSquared(a.clone().addScaledVector(delta,t)); if(d<distance){distance=d;segment=k;along=t} }
    add(tail[segment],tailMix*(1-along));add(tail[segment+1],tailMix*along)
  }
  const leg = legs.find(l => l.front === (p.z>.04) && l.side === (p.x>cx ? 1 : -1))
  const legRegion = leg.front ? smooth(.04,.17,p.z) : 1-smooth(-.16,-.06,p.z)
  const limbSide = 1-smooth(.18,.30,p.y)*(1-smooth(.025,.075,Math.abs(p.x-cx)))
  const legMix = limbSide*(1-smooth(leg.front ? .24 : .35,leg.front ? .43 : .53,p.y))*legRegion*(1-headMix)*(1-tailMix)
  const pawMix = 1-smooth(.085,.14,p.y), upperMix = smooth(leg.front ? .20 : .14,leg.front ? .34 : .27,p.y), lowerMix = smooth(leg.front ? .07 : .115,leg.front ? .13 : .20,p.y)
  add(leg.foot,legMix*pawMix);add(leg.upper,legMix*(1-pawMix)*upperMix);add(leg.lower,legMix*(1-pawMix)*(1-upperMix)*lowerMix);add(leg.end,legMix*(1-pawMix)*(1-upperMix)*(1-lowerMix))
  const torso = Math.max(0,1-headMix-tailMix-legMix), n = smooth(.39,.63,p.y)*smooth(.17,.35,p.z), c=smooth(-.18,.19,p.z)
  add(neck,torso*n);add(chest,torso*(1-n)*c);add(body,torso*(1-n)*(1-c))
  const best=[...w].filter(([,v])=>v>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4), sum=best.reduce((s,[,v])=>s+v,0)
  assert(sum>0);while(best.length<4)best.push([body,0]);return {ids:best.map(([i])=>i),values:best.map(([,v])=>v/sum)}
}
const ids=[], values=[], pos=geometry.attributes.position
for(let i=0;i<pos.count;i++){const w=weights(new T.Vector3().fromBufferAttribute(pos,i));ids.push(...w.ids);values.push(...w.values)}
// Diffuse weights across welded surface neighbours, including UV seams.
const welded=new Map(),vertexNodes=[],nodes=[]
for(let i=0;i<pos.count;i++){
  const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v*1e5)).join(',')
  if(!welded.has(key)){welded.set(key,nodes.length);nodes.push({vertex:i,neighbours:new Set(),w:new Float64Array(28)})}
  const n=welded.get(key);vertexNodes.push(n);nodes[n].w.fill(0)
  for(let k=0;k<4;k++)nodes[n].w[ids[i*4+k]]+=values[i*4+k]
}
for(let i=0;i<geometry.index.count;i+=3){const tri=[0,1,2].map(k=>vertexNodes[geometry.index.getX(i+k)]);for(const a of tri)for(const b of tri)if(a!==b)nodes[a].neighbours.add(b)}
for(let pass=0;pass<24;pass++){
  const next=nodes.map(n=>{
    const result=n.w.slice(),y=pos.getY(n.vertex)
    if(y<.06||y>.72||!n.neighbours.size)return result
    for(let k=0;k<28;k++){let sum=0;for(const j of n.neighbours)sum+=nodes[j].w[k];result[k]=n.w[k]*.45+.55*sum/n.neighbours.size}
    return result
  });nodes.forEach((n,i)=>n.w=next[i])
}
for(let i=0;i<pos.count;i++){
  const best=Array.from(nodes[vertexNodes[i]].w,(v,k)=>[k,v]).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((s,b)=>s+b[1],0)
  best.forEach(([id,v],k)=>{ids[i*4+k]=id;values[i*4+k]=v/sum})
}
geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(values,4))
const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial());mesh.name='Snowdrop_Coat';root.add(mesh);mesh.bind(skeleton)

// Static studies only. These landmarks are not animation keyframes.
function reset(){bones.forEach((b,i)=>{b.quaternion.identity();b.position.copy(rests[i]);const parent=definitions[i].parent;if(parent!=null)b.position.sub(rests[parent])});root.updateMatrixWorld(true)}
function rotateWorld(i,q){const parent=bones[i].parent.getWorldQuaternion(new T.Quaternion());bones[i].quaternion.copy(parent.invert().multiply(q));root.updateMatrixWorld(true)}
function aim(i,end,target){const start=bones[i].getWorldPosition(new T.Vector3());rotateWorld(i,new T.Quaternion().setFromUnitVectors(rests[end].clone().sub(rests[i]).normalize(),target.clone().sub(start).normalize()))}
function solveLeg(leg,paw,wristHeight){
  const lastLength=rests[leg.end].distanceTo(rests[leg.foot]),dy=wristHeight-paw.y
  const wrist=paw.clone().add(new T.Vector3(0,dy,-Math.sqrt(lastLength**2-dy**2)))
  const hip=bones[leg.upper].getWorldPosition(new T.Vector3()),delta=wrist.clone().sub(hip),distance=delta.length(),axis=delta.normalize()
  const upper=rests[leg.upper].distanceTo(rests[leg.lower]),lower=rests[leg.lower].distanceTo(rests[leg.end])
  assert(distance<upper+lower&&distance>Math.abs(upper-lower),`Unreachable ${leg.front?'fore':'hind'} leg: ${distance}`)
  const along=(upper**2-lower**2+distance**2)/(2*distance)
  const pole=new T.Vector3(0,0,leg.front?-1:1);pole.addScaledVector(axis,-pole.dot(axis)).normalize()
  const knee=hip.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(upper**2-along**2))
  aim(leg.upper,leg.lower,knee);aim(leg.lower,leg.end,wrist);aim(leg.end,leg.foot,paw);rotateWorld(leg.foot,new T.Quaternion())
  return {side:leg.side,front:leg.front,hip:hip.toArray(),knee:knee.toArray(),hock:wrist.toArray(),paw:paw.toArray()}
}
function pose(name){
  reset();const sitting=name==='sit'
  bones[body].position.y=sitting?.265:.255;bones[body].rotation.x=sitting?-.55:0
  bones[neck].rotation.x=sitting?.32:-.06;bones[head].rotation.x=sitting?.23:.06
  root.updateMatrixWorld(true)
  for(let k=0;k<tail.length-1;k++){
    const start=bones[tail[k]].getWorldPosition(new T.Vector3()),length=rests[tail[k]].distanceTo(rests[tail[k+1]])
    const dy=Math.max(-length*.9, [.13,.105,.11,.135][k]-start.y)
    const horizontal=rests[tail[k+1]].clone().sub(rests[tail[k]]);horizontal.y=0;horizontal.normalize()
    aim(tail[k],tail[k+1],start.clone().addScaledVector(horizontal,Math.sqrt(length**2-dy**2)).add(new T.Vector3(0,dy,0)))
  }
  rotateWorld(tail.at(-1),bones[tail.at(-2)].getWorldQuaternion(new T.Quaternion()))
  return legs.map(leg=>{
    const paw=rests[leg.foot].clone();paw.z=leg.front?(sitting?.30:.68):(sitting?.125:.055)
    if(!leg.front)paw.x+=leg.side*.025
    return solveLeg(leg,paw,leg.front?(sitting?.085:.048):.075)
  })
}
function normalsFor(surface){
  surface.computeVertexNormals();const n=nodes.map(()=>new T.Vector3())
  for(let i=0;i<pos.count;i++)n[vertexNodes[i]].add(new T.Vector3().fromBufferAttribute(surface.attributes.normal,i))
  n.forEach(p=>p.normalize());for(let i=0;i<pos.count;i++)surface.attributes.normal.setXYZ(i,...n[vertexNodes[i]].toArray())
}
async function save(model,name){
  const output=unpack(Buffer.from(await new GLTFExporter().parseAsync(model,{binary:true})))
  const chunks=[output.bin];let bytes=output.bin.length
  output.json.images=source.json.images.map(image=>{const view=source.json.bufferViews[image.bufferView],data=source.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),padding=(4-bytes%4)%4;if(padding){chunks.push(Buffer.alloc(padding));bytes+=padding}const index=output.json.bufferViews.length;output.json.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:data.length});chunks.push(data);bytes+=data.length;return {...image,bufferView:index}})
  for(const field of ['textures','samplers','materials'])if(source.json[field])output.json[field]=source.json[field]
  output.json.buffers=[{byteLength:bytes}]
  const json=Buffer.from(JSON.stringify(output.json)),jp=Buffer.alloc((4-json.length%4)%4,32),bin=Buffer.concat(chunks),bp=Buffer.alloc((4-bin.length%4)%4),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+jp.length+bin.length+bp.length,8);jh.writeUInt32LE(json.length+jp.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length+bp.length);bh.writeUInt32LE(0x004e4942,4)
  await fs.writeFile(new URL(`snowdrop-${name}-static.glb`,folder),Buffer.concat([header,jh,json,jp,bh,bin,bp]))
}
// Pose-specific surface cage: the existing standing mesh has no fold topology.
// Keep the face rigid; shape the folded limbs around the new contact landmarks.
const cageY=[0,.06,.12,.20,.30,.40,.50,.65]
const cageValues=[0,.35,.06,.35,.09,.31,.125,.25,.195,.19,.26,.10,.32,.015,.38,0]
const cage=new T.CubicInterpolant(cageY,cageValues,2)
const tailCurve=new T.CatmullRomCurve3(tail.map(i=>rests[i]))
const restingTailCurve=new T.CatmullRomCurve3([[cx,.16,-.32],[-.06,.09,-.43],[0,.085,-.53],[.105,.09,-.62],[.205,.105,-.70]].map(V))
const tailSamples=Array.from({length:161},(_,i)=>{const t=i/160;return {rest:tailCurve.getPoint(t),target:restingTailCurve.getPoint(t),rotation:new T.Quaternion().setFromUnitVectors(tailCurve.getTangent(t),restingTailCurve.getTangent(t))}})
function tailSurface(p){let closest=tailSamples[0],distance=Infinity;for(const sample of tailSamples){const d=p.distanceToSquared(sample.rest);if(d<distance){distance=d;closest=sample}}return p.clone().sub(closest.rest).applyQuaternion(closest.rotation).add(closest.target)}
function staticSurface(p,n,name){
  const sitting=name==='sit', result=p.clone()
  result.y-=sitting?.24*(1-smooth(-.40,.32,p.z)):.265
  if(sitting)result.z-=.015
  const w=nodes[n].w,fore=legs.filter(l=>l.front).flatMap(l=>[l.upper,l.lower,l.end,l.foot]).reduce((a,i)=>a+w[i],0)
  const tailWeight=tail.reduce((a,i)=>a+w[i],0)
  const faceWeight=[head,jaw,...ears].reduce((a,i)=>a+w[i],0)
  const sourceIndex=nodes[n].vertex
  const posed=skinDualQuaternion(p,ids.slice(sourceIndex*4,sourceIndex*4+4),values.slice(sourceIndex*4,sourceIndex*4+4),skeleton.boneMatrices)
  const forePoint=sitting?p.clone().add(new T.Vector3(0,0,-.015)):posed
  if(!sitting){
    const forearm=smooth(.06,.13,p.y)*(1-smooth(.25,.35,p.y))
    forePoint.y=T.MathUtils.lerp(forePoint.y,.045+(p.z-.28)*.5,forearm)
  }
  result.lerp(forePoint,fore)
  const c=cage.evaluate(p.y),hind=p.clone();hind.y=c[0]-.13*smooth(.08,.16,p.y)*(1-smooth(.30,.52,p.y))*(1-smooth(-.30,-.16,p.z));hind.z+=c[1]+(sitting?0:-.07);hind.x+=(p.x>cx?1:-1)*.018
  const side=p.x>cx?1:-1
  const radial=new T.Vector3((p.x-(cx+side*.095))/.12,(p.y-.32)/.28,(p.z+.22)/.18).normalize()
  const haunch=new T.Vector3(cx+side*.11+radial.x*.115,(sitting?.18:.16)+radial.y*(sitting?.20:.17),-.08+radial.z*.20)
  const sculpt=smooth(.075,.18,p.y)*(1-smooth(.30,.62,p.y))*(1-smooth(-.06,.025,p.z))*smooth(.025,.065,Math.abs(p.x-cx))
  hind.z=T.MathUtils.lerp(hind.z,.05+(hind.z-.05)*.84,smooth(.08,.17,p.y))
  hind.y+=(sitting?.10:0)*smooth(.40,.60,p.y)*smooth(-.40,.05,p.z)
  hind.lerp(haunch,sculpt)
  result.lerp(hind,(1-smooth(-.08,.13,p.z))*(1-tailWeight))
  // Keep the original face intact instead of stretching its eyes and muzzle.
  const face=p.clone();if(sitting)face.z-=.015;else face.y-=.24
  result.lerp(face,faceWeight)
  const tailPoint=tailSurface(p)
  result.lerp(tailPoint,tailWeight)
  if(p.y>.06&&result.y<.025)result.y=.004+.021*Math.exp((result.y-.025)/.021)
  return result
}
const report={sourceSha256:createHash('sha256').update(sourceBytes).digest('hex'),staticOnly:true,method:'Reference contact landmarks, pose-specific surface cage and forearm/haunch corrections; no animation exported',poses:{}}
for(const name of ['sit','lie']){
  const landmarks=pose(name);skeleton.update()
  const points=nodes.map((n,i)=>staticSurface(new T.Vector3().fromBufferAttribute(pos,n.vertex),i,name))
  // Relax the generated surface's joint folds without shrinking the whole haunch.
  for(let pass=0;pass<40;pass++){
    const next=points.map((p,i)=>{
      const n=nodes[i],y=pos.getY(n.vertex);if(y<.07||y>.70)return p.clone()
      const mean=new T.Vector3();for(const j of n.neighbours)mean.add(points[j]);mean.multiplyScalar(1/n.neighbours.size)
      return p.clone().lerp(mean,pass%2?-.53:.5)
    });points.splice(0,points.length,...next)
  }
  const surface=new T.BufferGeometry();surface.setIndex(geometry.index.clone());surface.setAttribute('uv',geometry.attributes.uv.clone());surface.setAttribute('position',new T.Float32BufferAttribute(vertexNodes.flatMap(n=>points[n].toArray()),3));normalsFor(surface)
  surface.computeBoundingBox()
  assert(surface.boundingBox.min.y>=-.001,`${name}: below floor`)
  const contacts=legs.map(leg=>{
    const patch=[];for(let i=0;i<pos.count;i++)if(pos.getY(i)<.04&&(pos.getZ(i)>.04)===leg.front&&(pos.getX(i)>cx?1:-1)===leg.side)patch.push(i)
    assert(patch.length>0)
    const minY=Math.min(...patch.map(i=>surface.attributes.position.getY(i)))
    const advance=patch.reduce((sum,i)=>sum+surface.attributes.position.getZ(i)-pos.getZ(i),0)/patch.length
    assert(minY>=-.001&&minY<.012,`${name}: paw contact ${minY}`)
    if(!leg.front)assert(advance>.20,`${name}: hind paw did not advance`)
    return {front:leg.front,side:leg.side,minY,advance}
  })
  let faceError=0,forearmTop=0
  for(let i=0;i<pos.count;i++){
    const p=new T.Vector3().fromBufferAttribute(surface.attributes.position,i)
    assert(p.toArray().every(Number.isFinite))
    if(pos.getY(i)>.72&&pos.getZ(i)>.30){const expected=new T.Vector3().fromBufferAttribute(pos,i).add(name==='sit'?V([0,0,-.015]):V([0,-.24,0]));faceError=Math.max(faceError,p.distanceTo(expected))}
    if(pos.getY(i)>.1&&pos.getY(i)<.25&&pos.getZ(i)>.15)forearmTop=Math.max(forearmTop,p.y)
  }
  assert(faceError<1e-6,`${name}: face distorted`)
  if(name==='lie')assert(forearmTop<.09,`Forearm raised ${forearmTop}`)
  const output=new T.Mesh(surface,new T.MeshStandardMaterial());output.name=`Snowdrop_${name}_static`;output.userData={staticStudy:true,landmarks,source:'Meshy user supplied',rigAttribution:'JonasDichelle, CC BY 3.0',note:'정지 자세 검토용. 동작 연결과 씬 적용 전.'}
  await save(output,name)
  report.poses[name]={landmarks,contacts,faceError,forearmTop,minY:surface.boundingBox.min.y,bounds:surface.boundingBox,triangles:surface.index.count/3}
}
await fs.writeFile(new URL('snowdrop-static-poses.json',folder),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
