import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createCatAnimator, walkPlaybackRate, jumpWithoutLift, jumpFlightPhase, SNOWDROP_WALK_SPEED, SNOWDROP_MODEL_FILE } from '../src/scene/cat-motion.ts'
import { createDualQuaternionPalette, deformCatVertex } from '../src/scene/dual-quaternion.ts'

Object.assign(globalThis, { ProgressEvent: class extends Event { constructor(type: string, data: object) { super(type); Object.assign(this, data) } } })
const bytes = await fs.readFile(new URL(`../public/models/characters/snowdrop/${SNOWDROP_MODEL_FILE}`, import.meta.url))
const length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length).toString())
delete json.images; delete json.textures; json.materials = [{}]
json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '')
const model = gltf.scene, spine = model.getObjectByName('Spine')!, head = model.getObjectByName('Head')!
const restY = spine.position.y
const sourceSpeed = model.getObjectByName('Snowdrop')!.userData.gait.speed
const motion = { speed: 0, grounded: true, verticalSpeed: 0, nearObject: false }
const savedRandom = Math.random; Math.random = () => .5
const animation = createCatAnimator(model, gltf.animations, sourceSpeed)
let coat: SkinnedMesh
model.traverse(o => { if (o instanceof SkinnedMesh) coat = o })
const controller = createDualQuaternionPalette(coat!)
const point = new Vector3()
const step = (n: number, checkSurface = false) => {
  let label = ''
  for (let i = 0; i < n; i++) {
    label = animation.update(1 / 60, motion, null)
    if (checkSurface) {
      model.updateMatrixWorld(true); controller.update()
      for (let v = 0; v < coat!.geometry.attributes.position.count; v++) {
        deformCatVertex(point,v,coat!,controller.palette)
        assert(point.y > -.006, `${label} transition below floor: ${point.y}`)
      }
    }
  }
  return label
}
try {
  assert.equal(SNOWDROP_WALK_SPEED, 3)
  assert.equal(walkPlaybackRate(3, sourceSpeed), 3)
  assert.equal(walkPlaybackRate(1.5, sourceSpeed), 1.5)
  assert.equal(walkPlaybackRate(0, sourceSpeed), 0)
  animation.update(1 / 60, motion, 'sit'); assert.equal(step(150, true), '앉기')
  const seatedY = spine.position.y, headQ = head.quaternion.clone().normalize()
  motion.nearObject = true
  assert.match(animation.update(1 / 60, motion, null), /앉기 · 귀 털기/)
  step(15)
  assert(Math.abs(spine.position.y - seatedY) < 1e-5, '귀 털기가 앉기를 덮어씀')
  assert(head.quaternion.clone().normalize().angleTo(headQ) < 1e-5, '귀 털기가 머리를 회전시킴')
  step(60); motion.nearObject = false; step(1); motion.nearObject = true
  assert(!animation.update(1 / 60, motion, null).includes('귀 털기'), '접근 쿨다운 실패')
  animation.update(1 / 60, motion, 'lie'); assert.equal(step(150, true), '눕기')
  const lieY = spine.position.y; assert(lieY < .27)
  animation.update(1 / 60, motion, 'sit'); assert.equal(step(150, true), '앉기')
  motion.speed = SNOWDROP_WALK_SPEED; assert.equal(step(80, true), '걷기')
  motion.grounded = false; motion.verticalSpeed = 4.6
  assert.equal(step(1), '상승')
  for (let i = 0; i <= 60; i++) { motion.verticalSpeed = 4.6 - i * 9.2 / 60; step(1); assert(spine.position.y <= restY+.00001) }
  motion.speed = 0; motion.grounded = true; motion.verticalSpeed = 0
  assert.equal(step(1), '착지'); assert.equal(step(60), '대기')
  let flicks = 0, last = false
  for (let i = 0; i < 2400; i++) { const active = step(1).includes('귀 털기'); if (active && !last) flicks++; last = active }
  assert(flicks >= 2 && flicks <= 4, `자동 귀 털기 빈도 ${flicks}`)
  const jump = jumpWithoutLift(gltf.animations.find(c => c.name === 'Jump')!, restY)
  const ys = jump.tracks.find(t => t.name === 'Spine.position')!.values.filter((_, i) => i % 3 === 1)
  assert(Math.max(...ys) <= restY+.000001)
  assert.equal(jumpFlightPhase(4.6), .28); assert.equal(jumpFlightPhase(0), .5); assert.equal(jumpFlightPhase(-4.6), .72)
  console.log('PASS: 3m/s, Sit/Lie transitions, additive ear-only overlay, proximity cooldown, idle ears, physics-only Jump')
} finally { animation.dispose(); Math.random = savedRandom }
