import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { LinearInterpolant, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createCatAnimator, createCatTailSwayClip, walkPlaybackRate, jumpWithoutLift, jumpFlightPhase, SNOWDROP_WALK_SPEED, SNOWDROP_MODEL_FILE } from '../src/scene/cat-motion.ts'
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
const savedRandom = Math.random; let randomSeed = 12345
// 고정 상수는 Three의 클립 UUID까지 같게 만들어 다른 동작이 같은 액션을 공유한다.
Math.random = () => ((randomSeed = (1664525 * randomSeed + 1013904223) >>> 0) / 2 ** 32)
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
  const tail = model.getObjectByName('Tail')!, tip = model.getObjectByName('Tail_007')!
  const initialSpine = spine.position.clone(), initialHead = head.quaternion.clone(), lastTail = tail.quaternion.clone()
  const tipMin = new Vector3(Infinity, Infinity, Infinity), tipMax = new Vector3(-Infinity, -Infinity, -Infinity)
  for (let frame = 0; frame < 420; frame++) {
    step(1); model.updateMatrixWorld(true)
    const end = tip.getWorldPosition(new Vector3()); tipMin.min(end); tipMax.max(end)
    assert(tail.quaternion.angleTo(lastTail) < .012, 'Tail motion snapped between frames'); lastTail.copy(tail.quaternion)
    assert(spine.position.distanceTo(initialSpine) < 1e-6 && head.quaternion.angleTo(initialHead) < 1e-6, 'Tail sway moved the body or head')
  }
  assert(tipMax.distanceTo(tipMin) > .025 && tipMax.distanceTo(tipMin) < .20, `Tail sway is invisible or excessive: ${tipMax.distanceTo(tipMin)}`)
  const gait = model.getObjectByName('Snowdrop')!.userData.gait
  const touchdowns = gait.legs.map((l: { phase: number }) => (1 - l.phase + 1) % 1).sort((a: number, b: number) => a - b)
  for (let i = 0; i < 4; i++) assert(Math.abs((touchdowns[(i + 1) % 4] - touchdowns[i] + 1) % 1 - .25) < 1e-6, 'Uneven four-beat footfalls')
  const walk = gltf.animations.find(c => c.name === 'Walk')!
  for (const track of [...walk.tracks, ...createCatTailSwayClip().tracks]) {
    const size = track.getValueSize()
    for (let i = 0; i < size; i++) assert(Math.abs(track.values[i] - track.values[track.values.length - size + i]) < 1e-5, `${track.name}: walk loop seam`)
  }
  const paws = walk.tracks.filter(t => /^CatGoal_\d_foot\.position$/.test(t.name)).map(t => new LinearInterpolant(t.times, t.values, 3))
  assert.equal(paws.length, 4)
  for (let frame = 0; frame < 240; frame++) {
    const t = walk.duration * frame / 240
    let grounded = 0
    for (const paw of paws) {
      const before = Array.from(paw.evaluate(t)), after = Array.from(paw.evaluate(t + walk.duration / 240))
      assert(before[1] >= .027 - 1e-5 && before[1] <= .062, 'Paw clearance outside walking range')
      if (Math.abs(before[1] - .027) < 1e-5) grounded++
      if (Math.abs(before[1] - .027) < 1e-6 && Math.abs(after[1] - .027) < 1e-6) {
        assert(Math.abs((after[2] - before[2]) / (walk.duration / 240) + sourceSpeed) < .005, 'Planted paw speed is not constant')
      }
    }
    assert(grounded >= 2, 'Walk lost its supporting paws')
  }
  assert.equal(SNOWDROP_WALK_SPEED, 3)
  assert(Math.abs(walkPlaybackRate(3, sourceSpeed) - 2.4) < 1e-6)
  assert(Math.abs(walkPlaybackRate(1.5, sourceSpeed) - 1.2) < 1e-6)
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
  console.log('PASS: smooth tail-only sway, tail/walk loop seams, even four-beat Walk, planted paw speed, low swing, 3m/s, Sit/Lie transitions, additive ear-only overlay, proximity cooldown, idle ears, physics-only Jump')
} finally { animation.dispose(); Math.random = savedRandom }
