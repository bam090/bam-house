import { AdditiveAnimationBlendMode, AnimationClip, AnimationMixer, LoopOnce, NumberKeyframeTrack, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'
import type { Object3D } from 'three'
import { createCatContactIK } from './cat-contact-ik.ts'

export const CAT_REVIEW_SPOTS = {
  terrace: { label: '테라스', x: 7, z: 13, yaw: Math.PI },
  stairs: { label: '거실 계단 아래', x: 0, z: 7.75, yaw: 0 },
  living: { label: '거실 바닥', x: 0, z: 3, yaw: Math.PI },
  sofa: { label: '소파 앞', x: 1.5, z: .05, yaw: Math.PI },
  seat: { label: '소파 좌판', x: 1.5, z: 1.25, yaw: 0 },
  bedroom: { label: '침실 그늘', x: 9, z: 2.5, yaw: Math.PI },
} as const
export type CatReviewSpot = keyof typeof CAT_REVIEW_SPOTS

export const SNOWDROP_SCALE = 0.64
export const SNOWDROP_MODEL_FILE = 'snowdrop-volume.glb'
export const SNOWDROP_WALK_SPEED = 3
export const PLAYER_JUMP_SPEED = 4.6
export type CatVariant = 'snowdrop' | 'legacy'
export type CatCommand = 'sit' | 'lie' | 'ears' | null
export interface CatTrialInput { remaining: number; forward: number; jump: boolean }
export interface CatMotion { speed: number; grounded: boolean; verticalSpeed: number; nearObject?: boolean }
export interface PlayerStatus extends CatMotion { x: number; y: number; z: number; pose: string; jumpPeak: number }

// 점프 위치는 Player 물리에서만 올린다. 클립에는 웅크리는 움직임만 남긴다.
export function jumpWithoutLift(clip: AnimationClip, restY: number) {
  const result = clip.clone()
  const track = result.tracks.find(t => t.name === 'Spine.position')
  if (!track) throw new Error('Snowdrop 점프의 몸통 위치 트랙이 없습니다.')
  for (const goal of result.tracks.filter(t => t.name.startsWith('CatGoal_'))) {
    for (let i = 1; i < goal.values.length; i += 3) goal.values[i] -= Math.max(0, track.values[i] - restY)
  }
  for (let i = 1; i < track.values.length; i += 3) track.values[i] = Math.min(restY, track.values[i])
  return result
}

export function jumpFlightPhase(verticalSpeed: number) {
  return .28 + .44 * Math.max(0, Math.min(1, (PLAYER_JUMP_SPEED - verticalSpeed) / (2 * PLAYER_JUMP_SPEED)))
}

// 4m/s에서 쓰던 4배 주기를 이동 속도에 비례시킨다. 3m/s에서는 3배다.
export function walkPlaybackRate(speed: number, sourceSpeed: number) {
  return Math.min(speed / (sourceSpeed * SNOWDROP_SCALE), 4 * speed / 4)
}

export function createCatAnimator(model: Object3D, clips: AnimationClip[], sourceSpeed: number) {
  const spine = model.getObjectByName('Spine')
  if (!spine || !(sourceSpeed > 0)) throw new Error('Snowdrop 리그 또는 보폭 데이터가 없습니다.')
  const idleTracks: (QuaternionKeyframeTrack | VectorKeyframeTrack | NumberKeyframeTrack)[] = []
  model.traverse(o => {
    if (o.type === 'Bone') idleTracks.push(new QuaternionKeyframeTrack(`${o.name}.quaternion`, [0, 1], [...o.quaternion.toArray(), ...o.quaternion.toArray()]))
  })
  idleTracks.push(new VectorKeyframeTrack('Spine.position', [0, 1], [...spine.position.toArray(), ...spine.position.toArray()]))
  const morphTrack = clips.flatMap(c => c.tracks).find(t => t.name === 'Snowdrop_Coat.morphTargetInfluences')
  if (morphTrack) idleTracks.push(new NumberKeyframeTrack(morphTrack.name, [0, 1], new Array(morphTrack.getValueSize() * 2).fill(0)))
  const mixer = new AnimationMixer(model)
  const solveContacts = createCatContactIK(model)
  const actions = Object.fromEntries([...clips, new AnimationClip('Idle', 1, idleTracks)].map(c => {
    const clip = c.name === 'Jump' ? jumpWithoutLift(c, spine.position.y) : c.name === 'EarFlick'
      ? new AnimationClip('EarFlick', c.duration, c.tracks.filter(t => /^Ear(?:_006)?\.quaternion$/.test(t.name)), AdditiveAnimationBlendMode) : c
    const action = mixer.clipAction(clip).setLoop(LoopOnce, 1)
    action.clampWhenFinished = true; action.play(); action.setEffectiveWeight(c.name === 'Idle' ? 1 : 0)
    return [c.name, action]
  }))
  for (const name of ['Idle', 'Walk', 'Jump', 'Sit', 'Lie', 'EarFlick']) if (!actions[name]) throw new Error(`${name} 동작이 없습니다.`)
  let walkTime = 0, poseTime = 0, earTime = Infinity, landing = Infinity, wasGrounded = true
  let restPose: 'Sit' | 'Lie' = 'Sit', resting = false, idleTime = 0, cooldown = 0, nearBefore = false
  let nextIdle = 8 + Math.random() * 6
  return {
    update(dt: number, motion: CatMotion, command: CatCommand) {
      const moving = motion.speed > .005
      if ((command === 'sit' || command === 'lie') && motion.grounded && !moving) {
        const next = command === 'sit' ? 'Sit' : 'Lie'
        // A reversing command must not jump the time of a pose that still contributes to the mesh.
        if (next !== restPose) poseTime = resting
          ? actions[next].getEffectiveWeight() < .001 ? actions[next].getClip().duration : actions[next].time
          : 0
        resting = next !== restPose || !resting
        restPose = next
      }
      if (moving || !motion.grounded) resting = false
      idleTime = moving || !motion.grounded ? 0 : idleTime + dt
      cooldown = Math.max(0, cooldown - dt)
      const approaching = !!motion.nearObject && !nearBefore
      nearBefore = !!motion.nearObject
      if (motion.grounded && cooldown === 0 && (command === 'ears' || approaching || idleTime >= nextIdle)) {
        earTime = 0; cooldown = 10 + Math.random() * 6; idleTime = 0; nextIdle = 8 + Math.random() * 8
      }
      if (!motion.grounded) earTime = Infinity
      let target = 'Idle', label = '대기'
      if (!motion.grounded) {
        target = 'Jump'; label = motion.verticalSpeed > 0 ? '상승' : '하강'
        actions.Jump.time = actions.Jump.getClip().duration * jumpFlightPhase(motion.verticalSpeed)
        landing = Infinity; poseTime = 0
      } else {
        if (!wasGrounded) landing = 0
        landing += dt
        if (landing < .18) {
          target = 'Jump'; label = '착지'
          actions.Jump.time = actions.Jump.getClip().duration * (.72 + .28 * landing / .18)
        } else {
          poseTime = Math.max(0, Math.min(actions[restPose].getClip().duration, poseTime + dt * (resting ? 1 : -2.2)))
          if (poseTime > 0) { target = restPose; label = resting ? restPose === 'Sit' ? '앉기' : '눕기' : '일어서기'; actions[restPose].time = poseTime }
          else if (moving) {
            target = 'Walk'; label = '걷기'
            // shortcut: 빠른 이동에서는 발 미끄러짐이 남는다. 달리기를 추가할 때 보폭을 다시 맞춘다.
            walkTime = (walkTime + dt * walkPlaybackRate(motion.speed, sourceSpeed)) % actions.Walk.getClip().duration
            actions.Walk.time = walkTime
          }
        }
      }
      const earActive = earTime < actions.EarFlick.getClip().duration
      if (earActive) { earTime += dt; actions.EarFlick.time = Math.min(earTime, actions.EarFlick.getClip().duration); label += ' · 귀 털기' }
      wasGrounded = motion.grounded
      const blendRate = !motion.grounded ? 7 : resting ? 5 : 24
      const blend = 1 - Math.exp(-dt * blendRate)
      for (const [name, action] of Object.entries(actions)) {
        if (name === 'EarFlick') action.setEffectiveWeight(earActive ? 1 : 0)
        else action.setEffectiveWeight(action.getEffectiveWeight() + ((name === target ? 1 : 0) - action.getEffectiveWeight()) * blend)
      }
      mixer.update(0)
      solveContacts()
      return label
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(model) },
  }
}
