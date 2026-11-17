import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { createDualQuaternionPalette, deformCatVertex } from '../src/scene/dual-quaternion.ts'
globalThis.ProgressEvent=class extends Event{constructor(type,values){super(type);Object.assign(this,values)}}
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.()})}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.()})}}
const folder=new URL('../public/models/characters/snowdrop/',import.meta.url)
const unpack=b=>{const n=b.readUInt32LE(12);return{json:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)}}
const source=unpack(await fs.readFile(new URL('snowdrop-volume.glb',folder)))
const json=structuredClone(source.json);delete json.images;delete json.textures;json.materials=[{}];json.buffers[0].uri=`data:application/octet-stream;base64,${source.bin.toString('base64')}`
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(json),'');let mesh;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o});assert(mesh)
const controller=createDualQuaternionPalette(mesh),mixer=new T.AnimationMixer(gltf.scene)
for(const name of ['Sit','Lie']){
  mixer.stopAllAction();const clip=gltf.animations.find(c=>c.name===name),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.time=clip.duration;mixer.update(0);gltf.scene.updateMatrixWorld(true);controller.update()
  const geometry=mesh.geometry.clone();geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.morphAttributes={}
  const p=geometry.attributes.position,point=new T.Vector3()
  for(let i=0;i<p.count;i++){deformCatVertex(point,i,mesh,controller.palette);p.setXYZ(i,...point.toArray())}
  geometry.computeVertexNormals();geometry.computeBoundingBox()
  const landmarks=gltf.scene.getObjectByName('Snowdrop').userData.gait.legs.map(leg=>{
    const [hip,knee,hock,paw]=leg.jointNames.map(j=>gltf.scene.getObjectByName(j).getWorldPosition(new T.Vector3()).toArray())
    return {front:leg.front,side:leg.side,hip,knee,hock,paw}
  })
  const result=new T.Mesh(geometry,new T.MeshStandardMaterial());result.name=`Snowdrop_${name.toLowerCase()}_static`;result.userData={staticStudy:true,sourceRig:'snowdrop-volume.glb',skinMethod:'Dual quaternion; exact clip endpoint, no separate sculpt',landmarks}
  const output=unpack(Buffer.from(await new GLTFExporter().parseAsync(result,{binary:true})))
  let bytes=output.bin.length;const parts=[output.bin]
  output.json.images=source.json.images.map(image=>{const view=source.json.bufferViews[image.bufferView],data=source.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),padding=(4-bytes%4)%4;parts.push(Buffer.alloc(padding));bytes+=padding;const index=output.json.bufferViews.length;output.json.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:data.length});parts.push(data);bytes+=data.length;return{...image,bufferView:index}})
  for(const field of ['materials','textures','samplers'])output.json[field]=source.json[field]
  output.json.buffers=[{byteLength:bytes}]
  const j=Buffer.from(JSON.stringify(output.json)),jp=Buffer.alloc((4-j.length%4)%4,32),b=Buffer.concat(parts),bp=Buffer.alloc((4-b.length%4)%4),h=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8)
  h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+jp.length+b.length+bp.length,8);jh.writeUInt32LE(j.length+jp.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(b.length+bp.length);bh.writeUInt32LE(0x004e4942,4)
  await fs.writeFile(new URL(`snowdrop-${name.toLowerCase()}-volume-static.glb`,folder),Buffer.concat([h,jh,j,jp,bh,b,bp]));console.log(name,geometry.boundingBox)
}
