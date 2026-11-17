import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
globalThis.ProgressEvent = class extends Event { constructor(type, data) { super(type); Object.assign(this, data) } }
const folder=new URL('../public/models/characters/snowdrop/',import.meta.url)
const player=process.argv.includes('--player')
const hash=b=>createHash('sha256').update(b).digest('hex')
function unpack(b){const n=b.readUInt32LE(12);return {json:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)}}
const sourceBytes=await fs.readFile(new URL('snowdrop-source.glb',folder)),source=unpack(sourceBytes),work=unpack(await fs.readFile(new URL(player?'snowdrop-player.glb':'snowdrop-interactions.glb',folder)))
const build=JSON.parse(await fs.readFile(new URL(player?'snowdrop-player-build.json':'snowdrop-build.json',folder)))
assert.equal(hash(sourceBytes),build.sourceSha256)
assert.deepEqual(work.json.materials,source.json.materials)
const imageBytes=(g,image)=>{const v=g.json.bufferViews[image.bufferView];return g.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)}
source.json.images.forEach((im,i)=>assert.equal(hash(imageBytes(source,im)),hash(imageBytes(work,work.json.images[i]))))
// Numerical skin checks do not need image decoding; the browser verifies the real materials.
const json=structuredClone(work.json);delete json.images;delete json.textures;json.materials=[{}];json.buffers[0].uri=`data:application/octet-stream;base64,${work.bin.toString('base64')}`
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');let mesh
gltf.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o});assert(mesh)
assert.equal(mesh.skeleton.bones.length,28);assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['EarFlick','Jump','Lie','Sit','Walk'])
const p=mesh.geometry.attributes.position,w=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex
assert.equal(p.count,build.sourceVertices)
assert.equal(mesh.geometry.morphAttributes.position.length,2)
for(const attribute of [...mesh.geometry.morphAttributes.position,...mesh.geometry.morphAttributes.normal])assert(attribute.array.every(Number.isFinite))
for(let i=0;i<p.count;i++){assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5);for(const k of ['getX','getY','getZ','getW'])assert(indices[k](i)<28)}
// The crown must never be assigned to either ear.
for(let i=0;i<p.count;i++)if(p.getY(i)>.815&&Math.abs(p.getX(i)+.075)<.065){
  for(const k of ['getX','getY','getZ','getW'])if(mesh.skeleton.bones[indices[k](i)].name.startsWith('Ear'))assert(w[k](i)<1e-7,`Crown vertex ${i} follows ear`)
}
const rest=[];gltf.scene.traverse(o=>rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]))
const mixer=new T.AnimationMixer(gltf.scene),point=new T.Vector3(),reports=[]
for(const clip of gltf.animations){
  mixer.stopAllAction();rest.forEach(([o,p,q,s])=>{o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s)})
  const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play()
  let minY=Infinity,maxY=-Infinity,contactError=0,slipError=0,seam=0,lowest;const previousFeet=new Map(),first=[];const frames=clip.name==='Walk'?480:180
  for(let frame=0;frame<=frames;frame++){
    const phase=frame/frames;action.time=clip.duration*phase;mixer.update(0);gltf.scene.updateMatrixWorld(true);mesh.skeleton.update()
    for(let i=0;i<p.count;i++){
      mesh.getVertexPosition(i,point);point.applyMatrix4(mesh.matrixWorld);assert(point.toArray().every(Number.isFinite));if(point.y<minY)lowest={vertex:i,phase,rest:[p.getX(i),p.getY(i),p.getZ(i)]};minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y)
      if(!frame)first.push(point.clone());else if(frame===frames)seam=Math.max(seam,point.distanceTo(first[i]))
    }
    if(clip.name==='Walk')for(const leg of build.gait.legs){
      const b=mesh.skeleton.bones.find(b=>b.name===leg.name),now=b.getWorldPosition(new T.Vector3()),t=(phase+leg.phase)%1,prior=previousFeet.get(leg.name)
      if(t<build.gait.stance){contactError=Math.max(contactError,Math.abs(now.y-leg.rest[1]));if(prior&&prior.t<t&&prior.t<build.gait.stance&&t>prior.t){const velocity=(now.z-prior.p.z)/(clip.duration/frames);slipError=Math.max(slipError,Math.abs(velocity+build.gait.speed))}}
      previousFeet.set(leg.name,{p:now.clone(),t})
    }
  }
  reports.push({name:clip.name,samples:frames+1,minSurfaceY:minY,maxSurfaceY:maxY,startEndVertexGap:seam,...(clip.name==='Walk'?{contactBoneHeightError:contactError,stanceSpeedError:slipError}:{})})
  assert(minY>-.004,`${clip.name}: below ground ${minY}, ${JSON.stringify(lowest)}`)
  if(!['Sit','Lie'].includes(clip.name))assert(seam<.0001,`${clip.name}: repeat/rest seam ${seam}`)
  if(clip.name==='Walk'){assert(contactError<.0001);assert(slipError<.005)}
}
const result={sourceHash:build.sourceSha256,texturesByteIdentical:true,bones:28,units:'Model normalized to 1 metre tall; game scale not applied',clips:reports}
await fs.writeFile(new URL(player?'../docs/snowdrop-player-validation.json':'../docs/snowdrop-validation.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))
