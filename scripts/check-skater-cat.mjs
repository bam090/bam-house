import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
const folder = new URL('../public/models/characters/skater-cat/', import.meta.url)
const source = await fs.readFile(new URL('cat.glb', folder))
assert.equal(createHash('sha256').update(source).digest('hex'), 'a3f2974161f2f014ef488334ce0768a5654dab8dbbb19b7e59cdfd0139cd3295', 'Original GLB changed')
const bytes = await fs.readFile(new URL('cat-angora-walk.glb', folder))
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
let gait
const model = gltf.scene, meshes = []
model.traverse(o => { if (o.userData.gait) gait = o.userData.gait; if (o.isSkinnedMesh) meshes.push(o) })
assert.equal(gltf.animations.length, 1); assert.equal(meshes[0].skeleton.bones.length, 25)
assert(meshes.some(m => m.material.name === 'Soft_white_coat' || m.material.name === 'Soft white coat'))
assert(!meshes.some(m => m.name === 'Longhair_groom'), 'Individual strands should be removed')
assert(meshes.filter(m => m.name.startsWith('Eye_')).length === 2)
let triangles = 0
for (const mesh of meshes) {
  const g = mesh.geometry; triangles += (g.index?.count || g.attributes.position.count) / 3
  const ids = g.attributes.skinIndex, w = g.attributes.skinWeight
  for (let i = 0; i < w.count; i++) {
    let sum = 0
    for (let j = 0; j < 4; j++) { const value = w.array[i * 4 + j]; assert(Number.isFinite(value) && value >= 0); sum += value; assert(ids.array[i * 4 + j] < 25) }
    assert(Math.abs(sum - 1) < 1e-5)
  }
}
const mixer = new T.AnimationMixer(model), action = mixer.clipAction(gltf.animations[0]); action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play()
function sample(t) { action.time = t; mixer.update(0); model.updateMatrixWorld(true); meshes.forEach(m => m.skeleton.update()) }
const body = model.getObjectByName('Original_mesh_weighted'), p = body.geometry.attributes.position, point = new T.Vector3()
const feet = gait.legs.map(l => model.getObjectByName(l.name)), prev = [], first = [], sole = []
for (let i = 0; i < p.count; i++) if (p.getY(i) < .025) sole.push(i)
let minY = Infinity, contactError = 0, velocityError = 0, seamError = 0
const frames = 997, dt = gait.duration / frames
for (let f = 0; f <= frames; f++) {
  const phase = f / frames; sample(phase * gait.duration)
  gait.legs.forEach((l, i) => {
    const t = (phase + l.phase) % 1, contact = t < gait.stance, foot = feet[i].getWorldPosition(new T.Vector3())
    if (contact) contactError = Math.max(contactError, Math.abs(foot.y - l.rest[1]))
    if (f && contact && prev[i].contact && t > prev[i].t) velocityError = Math.max(velocityError, Math.abs((foot.z - prev[i].z) / dt + gait.speed))
    prev[i] = { contact, t, z: foot.z }
  })
  for (const i of sole) { point.fromBufferAttribute(p, i); body.applyBoneTransform(i, point); minY = Math.min(minY, point.y) }
  if (f === 0 || f === frames) for (let i = 0; i < p.count; i++) {
    point.fromBufferAttribute(p, i); body.applyBoneTransform(i, point)
    if (!f) first.push(point.clone()); else seamError = Math.max(seamError, point.distanceTo(first[i]))
  }
}
// Detect a discontinuous front/hind weight boundary in the belly.
const edges = new Set(), idx = body.geometry.index
for (let i = 0; i < idx.count; i += 3) for (let j = 0; j < 3; j++) { const a = idx.getX(i + j), b = idx.getX(i + (j + 1) % 3); if (Math.abs(p.getZ(a)) < .16 && p.getY(a) > .3 && p.getY(a) < .44) edges.add([Math.min(a, b), Math.max(a, b)].join(',')) }
let maxBellyStretch = 1, worstEdge
const a = new T.Vector3(), b = new T.Vector3()
for (const phase of [.125, .25, .5, .75, .875]) {
  sample(phase * gait.duration)
  for (const e of edges) {
    const [i, j] = e.split(',').map(Number); a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, j); const length = a.distanceTo(b)
    body.applyBoneTransform(i, a); body.applyBoneTransform(j, b)
    if (length > .0005 && a.distanceTo(b) / length > maxBellyStretch) { maxBellyStretch = a.distanceTo(b) / length; worstEdge = { phase, i, j, a: new T.Vector3().fromBufferAttribute(p, i).toArray(), b: new T.Vector3().fromBufferAttribute(p, j).toArray() } }
  }
}
assert(contactError < .0005, `contact: ${contactError}`)
assert(minY > -.0005, `penetration: ${minY}`)
assert(velocityError < .006, `slip: ${velocityError}`)
assert(seamError < 1e-5, `seam: ${seamError}`)
console.log({ worstEdge })
assert(maxBellyStretch < 1.6, `belly stretch: ${maxBellyStretch}`)
const result = { passed: true, sampledFrames: frames + 1, bones: 25, clips: gltf.animations.map(c => c.name), triangles, bytes: bytes.length, soleVertices: sole.length, contactHeightErrorMm: contactError * 1000, soleMinimumMm: minY * 1000, stanceSpeedErrorMmPerSecond: velocityError * 1000, loopSeamMm: seamError * 1000, maxBellyEdgeStretch: maxBellyStretch, originalGlbSha256: createHash('sha256').update(source).digest('hex'), originalFbxSha256: createHash('sha256').update(await fs.readFile(new URL('cat.fbx', folder))).digest('hex') }
await fs.writeFile(new URL('../docs/skater-cat-validation.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
console.log(result)
