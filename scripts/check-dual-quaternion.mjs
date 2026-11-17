import assert from 'node:assert/strict'
import { Bone, BufferGeometry, Float32BufferAttribute, Group, Matrix4, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three'
import { skinDualQuaternion } from './dual-quaternion-skin.mjs'
import { createDualQuaternionPalette, deformDualQuaternion } from '../src/scene/dual-quaternion.ts'
const identity=new Matrix4(), twist=new Matrix4().makeRotationY(Math.PI)
const p=new Vector3(1,0,0)
const result=skinDualQuaternion(p,[0,1],[.5,.5],[...identity.elements,...twist.elements])
assert(Math.abs(result.length()-1)<1e-10,'Twist collapsed limb radius')
assert(p.clone().applyMatrix4(identity).lerp(p.clone().applyMatrix4(twist),.5).length()<1e-10)
const transform=new Matrix4().makeRotationZ(.7).setPosition(2,3,-1)
assert(skinDualQuaternion(p,[0],[1],transform.elements).distanceTo(p.clone().applyMatrix4(transform))<1e-10)
console.log('PASS: rigid transform and radius preserved through 180-degree blended twist')

// Exercise the actual web palette, including the scaled/rotated player parent.
const geometry = new BufferGeometry()
geometry.setAttribute('position', new Float32BufferAttribute([1,0,0],3))
geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0,1,0,0],4))
geometry.setAttribute('skinWeight', new Float32BufferAttribute([.5,.5,0,0],4))
const root = new Group(), a = new Bone(), b = new Bone(), mesh = new SkinnedMesh(geometry,new MeshBasicMaterial())
root.add(a,b,mesh);root.updateMatrixWorld(true);mesh.bind(new Skeleton([a,b]))
const controller=createDualQuaternionPalette(mesh)
b.rotation.y=Math.PI;root.updateMatrixWorld(true);controller.update()
const before=deformDualQuaternion(p.clone(),0,geometry,controller.palette)
assert(Math.abs(before.length()-1)<1e-6,'Web DQ collapsed a twisted limb')
root.scale.setScalar(.64);root.rotation.y=.7;root.position.set(2,3,-4);root.updateMatrixWorld(true);controller.update()
assert(deformDualQuaternion(p.clone(),0,geometry,controller.palette).distanceTo(before)<1e-6,'Outer player transform leaked into skinning')
root.scale.setScalar(1);root.rotation.set(0,0,0);root.position.set(0,0,0)
for(const bone of [a,b]){bone.rotation.set(0,0,.7);bone.position.set(2,3,-1)}
root.updateMatrixWorld(true);controller.update()
assert(deformDualQuaternion(p.clone(),0,geometry,controller.palette).distanceTo(p.clone().applyMatrix4(transform))<1e-6)
console.log('PASS: shared web palette, rigid transform, twist radius, outer player scale/rotation')
