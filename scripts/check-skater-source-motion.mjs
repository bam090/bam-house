import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
const folder = new URL('../public/models/characters/skater-cat/', import.meta.url)
const inspection = JSON.parse(await fs.readFile(new URL('../docs/skater-cat-blend-inspection.json', import.meta.url)))
assert.equal(createHash('sha256').update(await fs.readFile(new URL('cat.blend', folder))).digest('hex'), inspection.sha256, 'Original Blender source changed')
const reports = []
for (const file of ['cat-source-motion.glb', 'cat-angora-reference.glb']) {
  const data = await fs.readFile(new URL(file, folder))
  const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
  const root = gltf.scene; root.updateMatrixWorld(true)
  const box = new T.Box3().setFromObject(root), height = box.max.y - box.min.y, minY = box.min.y
  const meshes = [], bones = []
  root.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); if (o.isBone) bones.push(o) })
  const body = root.getObjectByName('Cat'), p = body.geometry.attributes.position, rest = []
  root.traverse(o => rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]))
  assert.equal(meshes[0].skeleton.bones.length, 75)
  assert.deepEqual(gltf.animations.map(a => a.name).sort(), ['Walk', 'run'])
  for (const mesh of meshes) {
    const weights = mesh.geometry.attributes.skinWeight
    for (let i = 0; i < weights.count; i++) { const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i); assert(Math.abs(sum - 1) < 1e-4) }
  }
  const mixer = new T.AnimationMixer(root), clips = []
  for (const clip of gltf.animations) {
    mixer.stopAllAction(); rest.forEach(([o, p, q, s]) => { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s) })
    assert(Math.abs(clip.duration - (clip.name === 'Walk' ? 27 / 24 : 14 / 24)) < 1e-6)
    const action = mixer.clipAction(clip); action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play()
    const firstBones = [], firstVertices = [], point = new T.Vector3()
    let minSole = Infinity, maxMovement = 0, maxLoop = 0, maxLoopBody = 0, maxLoopBone = '', maxMeshSeam = 0
    const feet = []; for (let i = 0; i < p.count; i++) if (p.getY(i) < minY + .025 * height) feet.push(i)
    for (let frame = 0; frame <= 120; frame++) {
      action.time = clip.duration * frame / 120; mixer.update(0); root.updateMatrixWorld(true); meshes.forEach(m => m.skeleton.update())
      bones.forEach((b, i) => {
        b.getWorldPosition(point); assert(point.toArray().every(Number.isFinite))
        if (!frame) firstBones.push(point.clone())
        const distance = point.distanceTo(firstBones[i]) / height; maxMovement = Math.max(maxMovement, distance)
        if (frame === 120) { if (distance > maxLoop) { maxLoop = distance; maxLoopBone = b.name } if (!b.name.startsWith('Tail')) maxLoopBody = Math.max(maxLoopBody, distance) }
      })
      for (const i of feet) { point.fromBufferAttribute(p, i); body.applyBoneTransform(i, point); point.applyMatrix4(body.matrixWorld); minSole = Math.min(minSole, (point.y - minY) / height) }
      if (!frame || frame === 120) for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p, i); body.applyBoneTransform(i, point); point.applyMatrix4(body.matrixWorld)
        if (!frame) firstVertices.push(point.clone()); else maxMeshSeam = Math.max(maxMeshSeam, point.distanceTo(firstVertices[i]) / height)
      }
    }
    assert(maxMovement > .01, 'Clip contains no visible pose change')
    clips.push({ name: clip.name, durationSeconds: clip.duration, channels: clip.tracks.length, samples: 121, maxJointMotionMm: maxMovement * 1000, loopJointGapMm: maxLoop * 1000, loopJoint: maxLoopBone, loopNonTailJointGapMm: maxLoopBody * 1000, loopMeshGapMm: maxMeshSeam * 1000, minSoleRelativeToRestMm: minSole * 1000 })
  }
  reports.push({ file, bytes: data.length, skinBones: meshes[0].skeleton.bones.length, triangles: meshes.reduce((n,m) => n + (m.geometry.index?.count || m.geometry.attributes.position.count) / 3, 0), clips })
}
const output = { sourceHashUnchanged: true, units: 'Millimetres with the rest model height normalized to 1 metre', note: 'Data and animation sampling validated. Contact and loop quality are measurements, not a production-readiness pass.', models: reports }
await fs.writeFile(new URL('../docs/skater-cat-source-motion-validation.json', import.meta.url), JSON.stringify(output, null, 2) + '\n')
console.log(JSON.stringify(output, null, 2))
