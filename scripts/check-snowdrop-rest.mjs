import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createDualQuaternionPalette, deformCatVertex } from '../src/scene/dual-quaternion.ts'
import { createCatContactIK } from '../src/scene/cat-contact-ik.ts'
import { createCatAnimator, createCatTailSwayClip, SNOWDROP_MODEL_FILE } from '../src/scene/cat-motion.ts'

globalThis.ProgressEvent = class extends Event { constructor(type, data) { super(type); Object.assign(this, data) } }
const folder = new URL('../public/models/characters/snowdrop/', import.meta.url)
async function unpack(path) {
  const bytes = await fs.readFile(path), length = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.subarray(20, 20 + length)), bin = bytes.subarray(28 + length)
  const view = index => { const v = json.bufferViews[index]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength) }
  const accessor = index => { const a = json.accessors[index]; return view(a.bufferView) }
  return { json, bin, view, accessor }
}
const original = await unpack(new URL('snowdrop-volume.glb', folder))
const outputPath = process.argv.find(a => a.endsWith('.glb')) ?? new URL(SNOWDROP_MODEL_FILE, folder)
const output = await unpack(outputPath)
const sourceMesh = original.json.meshes[0].primitives[0], workMesh = output.json.meshes[0].primitives[0]
for (const key of Object.keys(sourceMesh.attributes)) assert.deepEqual(output.accessor(workMesh.attributes[key]), original.accessor(sourceMesh.attributes[key]), `${key}: 기본 외형 변경`)
assert.deepEqual(output.accessor(workMesh.indices), original.accessor(sourceMesh.indices))
for (let i = 0; i < original.json.images.length; i++) assert.deepEqual(output.view(output.json.images[i].bufferView), original.view(original.json.images[i].bufferView), '원본 텍스처 변경')
for (const name of ['Walk', 'Jump', 'EarFlick']) {
  const a = original.json.animations.find(c => c.name === name), b = output.json.animations.find(c => c.name === name)
  assert.deepEqual(a, b, `${name}: 동작 구조 변경`)
  for (const [i, s] of a.samplers.entries()) for (const key of ['input', 'output']) {
    if (key === 'output' && a.channels.some(c => c.sampler === i && c.target.path === 'weights')) {
      const before = original.accessor(s.output), after = output.accessor(s.output)
      const originalWidth = original.json.meshes[0].primitives[0].targets.length
      const outputWidth = output.json.meshes[0].primitives[0].targets.length
      for (let frame = 0; frame < before.length / (originalWidth * 4); frame++) {
        assert.deepEqual(after.subarray(frame * outputWidth * 4, (frame * outputWidth + originalWidth) * 4), before.subarray(frame * originalWidth * 4, (frame + 1) * originalWidth * 4), `${name}: 기존 보정 동작 변경`)
        for (let j = originalWidth; j < outputWidth; j++) assert.equal(after.readFloatLE((frame * outputWidth + j) * 4), 0)
      }
    } else assert.deepEqual(output.accessor(s[key]), original.accessor(s[key]), `${name}: 동작 데이터 변경`)
  }
}
for (let i = 4; i < sourceMesh.targets.length; i++) for (const key of ['POSITION', 'NORMAL']) assert.deepEqual(output.accessor(workMesh.targets[i][key]), original.accessor(sourceMesh.targets[i][key]), '걷기 보정 형상 변경')
const json = structuredClone(output.json)
delete json.images; delete json.textures; json.materials = [{}]
json.buffers[0].uri = `data:application/octet-stream;base64,${output.bin.toString('base64')}`
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '')
let mesh; gltf.scene.traverse(o => { if (o.isSkinnedMesh) mesh = o })
const palette = createDualQuaternionPalette(mesh), mixer = new T.AnimationMixer(gltf.scene), ik = createCatContactIK(gltf.scene)
const geometry = mesh.geometry, p = geometry.attributes.position, ids = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight
const used = [...new Set(geometry.index.array)], point = new T.Vector3(), points = new Float32Array(p.count * 3)
const tail = used.filter(i => [0, 1, 2, 3].reduce((s, k) => s + (mesh.skeleton.bones[ids.array[i * 4 + k]].name.startsWith('Tail') ? weights.array[i * 4 + k] : 0), 0) > .99999)
assert(tail.length > 500)
const distalTail = tail.filter(i => p.getZ(i) < -.46)
gltf.scene.updateMatrixWorld(true)
const tailBone = gltf.scene.getObjectByName('Tail'), tailStart = tailBone.getWorldPosition(new T.Vector3())
const tailAxis = gltf.scene.getObjectByName('Tail_002').getWorldPosition(new T.Vector3()).sub(tailStart).normalize()
const rings = Array.from({ length: 12 }, (_, ring) => tail.filter(i => {
  const along = point.fromBufferAttribute(p, i).sub(tailStart).dot(tailAxis)
  return along >= ring * .035 && along < (ring + 1) * .035
})).filter(vertices => vertices.length > 12)
function sectionArea(vertices, values, axis) {
  const u = new T.Vector3(1, 0, 0).addScaledVector(axis, -axis.x).normalize(), v = new T.Vector3().crossVectors(axis, u)
  let x = 0, y = 0, xx = 0, xy = 0, yy = 0
  for (const i of vertices) {
    point.fromArray(values, i * 3)
    const a = point.dot(u), b = point.dot(v)
    x += a; y += b; xx += a * a; xy += a * b; yy += b * b
  }
  const n = vertices.length; x /= n; y /= n
  return Math.sqrt(Math.max(0, (xx / n - x * x) * (yy / n - y * y) - (xy / n - x * y) ** 2))
}
const restAreas = rings.map(vertices => sectionArea(vertices, p.array, tailAxis))
function spread(vertices, values) {
  const center = new T.Vector3(), covariance = new Array(9).fill(0), v = new T.Vector3()
  for (const i of vertices) center.add(v.fromArray(values, i * 3))
  center.divideScalar(vertices.length)
  for (const i of vertices) {
    const a = v.fromArray(values, i * 3).sub(center).toArray()
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) covariance[r * 3 + c] += a[r] * a[c] / vertices.length
  }
  return Math.sqrt(Math.max(0, new T.Matrix3().fromArray(covariance).determinant()))
}
const haunches = [-1, 1].map(side => used.filter(i => p.getY(i) > .28 && p.getY(i) < .48 && p.getZ(i) > -.29 && p.getZ(i) < -.10 && (p.getX(i) + .075) * side > .06))
const ankles = [-1, 1].map(side => used.filter(i => p.getY(i) > .10 && p.getY(i) < .15 && (p.getX(i) + .075) * side > 0 &&
  [0, 1, 2, 3].reduce((sum, k) => sum + ([18, 19, 26, 27].includes(ids.array[i * 4 + k]) ? weights.array[i * 4 + k] : 0), 0) > .5))
assert(ankles.every(vertices => vertices.length > 200), '뒷발목 검사 영역 누락')
const ankleAxis = new T.Vector3(0, -.173, .115).normalize()
const ankleBones = ['Foot_Back_R', 'Foot_Back_L'].map(name => gltf.scene.getObjectByName(name))
const ankleAreas = ankles.map(vertices => sectionArea(vertices, p.array, ankleAxis))
const report = { preserved: ['base mesh', 'UV', 'textures', 'weights', 'Walk', 'Jump', 'EarFlick', 'walk correctives'], clips: [] }
for (const name of ['Sit', 'Lie']) {
  mixer.stopAllAction()
  const clip = gltf.animations.find(c => c.name === name), action = mixer.clipAction(clip)
  action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play()
  let minimumY = Infinity, maximumTailError = 0, maximumIKError = 0, minimumRootWidthRatio = Infinity, maximumRootWidthRatio = 0, minimumAnkleVolumeRatio = Infinity, minimumAnkleWidthRatio = Infinity, maximumAnkleWidthRatio = 0
  for (let frame = 0; frame <= 60; frame++) {
    action.time = clip.duration * frame / 60; mixer.update(0); gltf.scene.updateMatrixWorld(true)
    const rotations = mesh.skeleton.bones.map(b => b.quaternion.clone().normalize())
    ik()
    mesh.skeleton.bones.forEach((b, i) => { maximumIKError = Math.max(maximumIKError, rotations[i].angleTo(b.quaternion.clone().normalize())) })
    palette.update()
    for (const i of used) {
      deformCatVertex(point, i, mesh, palette.palette)
      assert(point.toArray().every(Number.isFinite), `${name}: 잘못된 정점`)
      points.set(point.toArray(), i * 3); minimumY = Math.min(minimumY, point.y)
    }
    ankles.forEach((vertices, i) => {
      minimumAnkleVolumeRatio = Math.min(minimumAnkleVolumeRatio, spread(vertices, points) / spread(vertices, p.array))
      const axis = ankleAxis.clone().applyQuaternion(ankleBones[i].getWorldQuaternion(new T.Quaternion()))
      const width = Math.sqrt(sectionArea(vertices, points, axis) / ankleAreas[i])
      minimumAnkleWidthRatio = Math.min(minimumAnkleWidthRatio, width)
      maximumAnkleWidthRatio = Math.max(maximumAnkleWidthRatio, width)
    })
    const anchor = distalTail[0], a = new T.Vector3().fromArray(points, anchor * 3), restA = new T.Vector3().fromBufferAttribute(p, anchor)
    for (const i of distalTail) {
      const distance = point.fromArray(points, i * 3).distanceTo(a), restDistance = point.fromBufferAttribute(p, i).distanceTo(restA)
      maximumTailError = Math.max(maximumTailError, Math.abs(distance - restDistance))
    }
    const axis = tailAxis.clone().applyQuaternion(tailBone.getWorldQuaternion(new T.Quaternion()))
    rings.forEach((vertices, i) => {
      const ratio = Math.sqrt(sectionArea(vertices, points, axis) / restAreas[i])
      minimumRootWidthRatio = Math.min(minimumRootWidthRatio, ratio); maximumRootWidthRatio = Math.max(maximumRootWidthRatio, ratio)
    })
    const left = gltf.scene.getObjectByName('Foot_Back_L2').getWorldPosition(new T.Vector3())
    const right = gltf.scene.getObjectByName('Foot_Back_L2_002').getWorldPosition(new T.Vector3())
    assert(Math.abs(left.z - right.z) < 1e-5 && Math.abs(left.y - right.y) < 1e-5, '뒷발 접지가 좌우로 어긋남')
  }
  assert(minimumY > -.006, `${name}: 바닥 침범 ${minimumY}`)
  // The surface sculpt moves small facets; section checks independently protect thickness.
  assert(maximumTailError < .008, `${name}: 꼬리 표면 보정 범위 초과 ${maximumTailError}`)
  // A folded band becomes shorter; measure the cross-section, independently of its bend.
  assert(minimumAnkleWidthRatio > .85 && maximumAnkleWidthRatio < 1.15, `${name}: 뒷발목 단면 손실/부풀음 ${minimumAnkleWidthRatio}..${maximumAnkleWidthRatio}`)
  assert(minimumRootWidthRatio > .9 && maximumRootWidthRatio < 1.1, `${name}: 꼬리 뿌리 단면 손실 ${minimumRootWidthRatio}..${maximumRootWidthRatio}`)
  assert(maximumIKError < .003, `${name}: 웹 IK와 Blender 포즈 불일치 ${maximumIKError}`)
  const pelvisY = gltf.scene.getObjectByName('Spine').getWorldPosition(new T.Vector3()).y
  const chestY = gltf.scene.getObjectByName('Spine_003').getWorldPosition(new T.Vector3()).y
  assert(name === 'Sit' ? pelvisY < .205 : chestY < .325, `${name}: 체중이 내려앉지 않은 높은 자세`)
  const haunchVolumeRatio = haunches.map(vertices => spread(vertices, points) / spread(vertices, p.array))
  assert(Math.min(...haunchVolumeRatio) > .75, `${name}: 허벅지 부피 손실 ${haunchVolumeRatio}`)
  const rearPaws = ['Foot_Back_L2', 'Foot_Back_L2_002'].map(n => gltf.scene.getObjectByName(n).getWorldPosition(new T.Vector3()))
  assert(rearPaws.every(p => name === 'Sit' ? p.z > .10 : p.z > -.04 && p.z < .025), `${name}: 뒷발이 접힌 허벅지 아래에서 벗어남`)
  const sway = mixer.clipAction(createCatTailSwayClip(gltf.animations)).setEffectiveWeight(name === 'Sit' ? .45 : .35).play()
  let swayMinimumY = Infinity, swayRootMin = Infinity, swayRootMax = 0
  for (let frame = 0; frame <= 72; frame++) {
    sway.time = sway.getClip().duration * frame / 72
    mixer.update(0); ik(); palette.update()
    for (const i of used) {
      deformCatVertex(point, i, mesh, palette.palette); points.set(point.toArray(), i * 3)
      swayMinimumY = Math.min(swayMinimumY, point.y)
    }
    const axis = tailAxis.clone().applyQuaternion(tailBone.getWorldQuaternion(new T.Quaternion()))
    rings.forEach((vertices, i) => {
      const ratio = Math.sqrt(sectionArea(vertices, points, axis) / restAreas[i])
      swayRootMin = Math.min(swayRootMin, ratio); swayRootMax = Math.max(swayRootMax, ratio)
    })
  }
  assert(swayMinimumY > -.006, `${name}: 살랑거리는 꼬리 바닥 침범 ${swayMinimumY}`)
  assert(swayRootMin > .9 && swayRootMax < 1.1, `${name}: 살랑거릴 때 꼬리 단면 손실 ${swayRootMin}..${swayRootMax}`)
  report.clips.push({ name, frames: 61, minimumY, maximumTailError, minimumRootWidthRatio, maximumRootWidthRatio, minimumAnkleVolumeRatio, minimumAnkleWidthRatio, maximumAnkleWidthRatio, maximumIKError, pelvisY, chestY, haunchVolumeRatio, rearPaws, swayMinimumY, swayRootMin, swayRootMax })
}
mixer.stopAllAction()
const animator = createCatAnimator(gltf.scene, gltf.animations, gltf.scene.getObjectByName('Snowdrop').userData.gait.speed)
const motion = { speed: 0, grounded: true, verticalSpeed: 0, nearObject: false, moveRequested: false }
let transitionAnkleMin = Infinity, transitionAnkleMax = 0
for (const command of ['sit', 'lie', 'sit', 'lie', null]) {
  motion.moveRequested = command === null
  for (let frame = 0; frame < 120; frame++) {
    const state = animator.update(1 / 60, motion, frame === 0 ? command : null)
    if (state.startsWith('걷기')) break
    gltf.scene.updateMatrixWorld(true); palette.update()
    for (const i of ankles.flat()) { deformCatVertex(point, i, mesh, palette.palette); points.set(point.toArray(), i * 3) }
    ankles.forEach((vertices, i) => {
      const axis = ankleAxis.clone().applyQuaternion(ankleBones[i].getWorldQuaternion(new T.Quaternion()))
      const width = Math.sqrt(sectionArea(vertices, points, axis) / ankleAreas[i])
      transitionAnkleMin = Math.min(transitionAnkleMin, width); transitionAnkleMax = Math.max(transitionAnkleMax, width)
    })
  }
}
animator.dispose()
assert(transitionAnkleMin > .85 && transitionAnkleMax < 1.15, `자세 전환 중 뒷발목 변형 ${transitionAnkleMin}..${transitionAnkleMax}`)
report.transitions = { frames: 600, transitionAnkleMin, transitionAnkleMax }
const outputName = String(outputPath).split('/').at(-1).replace('.glb', '-validation.json')
await fs.writeFile(new URL(`../docs/${outputName}`, import.meta.url), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
console.log('PASS: 원본 외형·기존 동작 보존, 낮은 휴식 자세, 접지, 좌우 뒷발, 꼬리 단면, 웹 IK 일치')
