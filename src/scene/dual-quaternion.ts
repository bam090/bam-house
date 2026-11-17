import { Matrix4, MeshDepthMaterial, MeshDistanceMaterial, Quaternion, RGBADepthPacking, Vector3 } from 'three'
import type { BufferGeometry, Material, SkinnedMesh } from 'three'

export interface DualQuaternionPalette { real: Float32Array; dual: Float32Array }

// Work in mesh-local bind space so a player's outer scale does not scale the quaternion.
export function createDualQuaternionPalette(mesh: SkinnedMesh) {
  const count = mesh.skeleton.bones.length
  const palette: DualQuaternionPalette = { real: new Float32Array(count * 4), dual: new Float32Array(count * 4) }
  const matrix = new Matrix4(), position = new Vector3(), rotation = new Quaternion(), scale = new Vector3()
  return { palette, update() {
    mesh.skeleton.update()
    for (let i = 0; i < count; i++) {
      matrix.fromArray(mesh.skeleton.boneMatrices!, i * 16).premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix)
      matrix.decompose(position, rotation, scale)
      if (Math.max(Math.abs(scale.x - 1), Math.abs(scale.y - 1), Math.abs(scale.z - 1)) > .001) throw new Error('고양이 뼈에 크기 변형이 들어 있습니다.')
      rotation.normalize().toArray(palette.real, i * 4)
      const { x, y, z, w } = rotation, { x: tx, y: ty, z: tz } = position
      palette.dual.set([.5 * (tx * w + ty * z - tz * y), .5 * (-tx * z + ty * w + tz * x), .5 * (tx * y - ty * x + tz * w), -.5 * (tx * x + ty * y + tz * z)], i * 4)
    }
  } }
}

// Same equation as the vertex shader; used by exported stills and deformation checks.
export function deformDualQuaternion(point: Vector3, vertex: number, geometry: BufferGeometry, palette: DualQuaternionPalette) {
  const indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight
  const ids = [indices.getX(vertex), indices.getY(vertex), indices.getZ(vertex), indices.getW(vertex)]
  const ws = [weights.getX(vertex), weights.getY(vertex), weights.getZ(vertex), weights.getW(vertex)]
  const r = palette.real, d = palette.dual, reference = ids[0] * 4
  let x = 0, y = 0, z = 0, w = 0, dx = 0, dy = 0, dz = 0, dw = 0
  for (let k = 0; k < 4; k++) {
    const i = ids[k] * 4, sign = r[i] * r[reference] + r[i + 1] * r[reference + 1] + r[i + 2] * r[reference + 2] + r[i + 3] * r[reference + 3] < 0 ? -1 : 1, weight = ws[k] * sign
    x += r[i] * weight; y += r[i + 1] * weight; z += r[i + 2] * weight; w += r[i + 3] * weight
    dx += d[i] * weight; dy += d[i + 1] * weight; dz += d[i + 2] * weight; dw += d[i + 3] * weight
  }
  const length = Math.hypot(x, y, z, w)
  x /= length; y /= length; z /= length; w /= length; dx /= length; dy /= length; dz /= length; dw /= length
  const vx = point.x, vy = point.y, vz = point.z, ux = 2 * (y * vz - z * vy), uy = 2 * (z * vx - x * vz), uz = 2 * (x * vy - y * vx)
  return point.set(vx + w * ux + y * uz - z * uy + 2 * (w * dx - dw * x + y * dz - z * dy), vy + w * uy + z * ux - x * uz + 2 * (w * dy - dw * y + z * dx - x * dz), vz + w * uz + x * uy - y * ux + 2 * (w * dz - dw * z + x * dy - y * dx))
}

// Morphs are evaluated before skinning by Three's vertex shader.
export function deformCatVertex(point: Vector3, vertex: number, mesh: SkinnedMesh, palette: DualQuaternionPalette) {
  const geometry = mesh.geometry
  point.fromBufferAttribute(geometry.attributes.position, vertex)
  for (let k = 0; k < (mesh.morphTargetInfluences?.length ?? 0); k++) {
    const weight = mesh.morphTargetInfluences![k], morph = geometry.morphAttributes.position?.[k]
    if (weight && morph) {
      point.x += weight * morph.getX(vertex); point.y += weight * morph.getY(vertex); point.z += weight * morph.getZ(vertex)
    }
  }
  return deformDualQuaternion(point, vertex, geometry, palette)
}

export function enableDualQuaternionSkinning(mesh: SkinnedMesh) {
  const controller = createDualQuaternionPalette(mesh), count = mesh.skeleton.bones.length
  const uniforms = { catReal: { value: controller.palette.real }, catDual: { value: controller.palette.dual } }
  const declarations = `
#ifdef USE_SKINNING
uniform vec4 catReal[${count}];
uniform vec4 catDual[${count}];
vec3 catRotate(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void catBlend(out vec4 r, out vec4 d) {
  r=vec4(0.0); d=vec4(0.0);
  vec4 reference=catReal[int(skinIndex.x)];
  for(int k=0;k<4;k++) {
    int i=int(skinIndex[k]);
    float weight=skinWeight[k]*(dot(reference,catReal[i])<0.0?-1.0:1.0);
    r+=weight*catReal[i]; d+=weight*catDual[i];
  }
  float len=length(r); r/=len; d/=len;
}
#endif`
  function patch(material: Material) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <skinning_pars_vertex>', `#include <skinning_pars_vertex>\n${declarations}`)
        .replace('#include <skinbase_vertex>', '#ifdef USE_SKINNING\nvec4 catR,catD;catBlend(catR,catD);\n#endif')
        .replace('#include <skinnormal_vertex>', '#ifdef USE_SKINNING\nobjectNormal=catRotate(catR,objectNormal);\n#ifdef USE_TANGENT\nobjectTangent=catRotate(catR,objectTangent);\n#endif\n#endif')
        .replace('#include <skinning_vertex>', '#ifdef USE_SKINNING\ntransformed=catRotate(catR,transformed)+2.0*(catR.w*catD.xyz-catD.w*catR.xyz+cross(catR.xyz,catD.xyz));\n#endif')
    }
    material.customProgramCacheKey = () => `snowdrop-dq-${count}`
    material.needsUpdate = true
  }
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => m.clone())
  materials.forEach(patch); mesh.material = Array.isArray(mesh.material) ? materials : materials[0]
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking }), distance = new MeshDistanceMaterial()
  patch(depth); patch(distance); mesh.customDepthMaterial = depth; mesh.customDistanceMaterial = distance
  mesh.onBeforeRender = controller.update; mesh.onBeforeShadow = controller.update
  return { ...controller, dispose() { materials.forEach(m => m.dispose()); depth.dispose(); distance.dispose() } }
}
