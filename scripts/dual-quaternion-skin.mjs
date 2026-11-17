import { Matrix4, Quaternion, Vector3 } from 'three'

// Kavan et al., Skinning with Dual Quaternions (2007). Bake to standard GLB morphs.
export function dualQuaternionTransform(indices, weights, matrices) {
  const real = [0,0,0,0], dual = [0,0,0,0], matrix = new Matrix4()
  const reference=new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(matrices,0))
  for(let k=0;k<indices.length;k++){
    if(!weights[k])continue
    matrix.fromArray(matrices,indices[k]*16)
    const rotation=new Quaternion().setFromRotationMatrix(matrix)
    const sign=reference.dot(rotation)<0?-1:1, w=weights[k]*sign
    const t=new Vector3().setFromMatrixPosition(matrix)
    const d=new Quaternion(t.x,t.y,t.z,0).multiply(rotation).toArray()
    rotation.toArray().forEach((v,j)=>{real[j]+=w*v;dual[j]+=w*.5*d[j]})
  }
  const length=Math.hypot(...real)
  const r=new Quaternion(...real.map(v=>v/length)), d=new Quaternion(...dual.map(v=>v/length))
  const translation=d.multiply(r.clone().conjugate())
  return {rotation:r,translation:new Vector3(translation.x,translation.y,translation.z).multiplyScalar(2)}
}

export function skinDualQuaternion(position, indices, weights, matrices) {
  const transform=dualQuaternionTransform(indices,weights,matrices)
  return position.clone().applyQuaternion(transform.rotation).add(transform.translation)
}
