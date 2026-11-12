import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Group } from 'three'
import { readMove, readTilt, readTurn, useKeyboard } from '../hooks/useKeyboard'
import { Cat } from './Cat'
import { groundHeight, resolveMove } from './walkable'

/** 고양이가 처음 서 있는 자리. 테라스의 오른쪽 앞이다. */
export const START_POSITION: [number, number, number] = [7, 0, 13]

/** 카메라가 바라보는 지점의 높이. 고양이의 등 높이다. */
const LOOK_HEIGHT = 0.35

/** 처음 시작할 때 카메라와 고양이 사이의 거리 */
const START_DISTANCE = 4.2

/** 마우스 휠로 바꿀 수 있는 거리의 범위 */
const MIN_DISTANCE = 1.8
const MAX_DISTANCE = 40

/** 처음 시작할 때 카메라가 고양이를 내려다보는 각도 */
const START_PITCH = 0.35

/** 내려다보는 각도의 범위. 너무 낮으면 바닥 아래로 가고 너무 높으면 정수리만 보인다. */
const MIN_PITCH = 0.06
const MAX_PITCH = 1.25

// 시선의 좌우 각도와 내려다보는 각도로 카메라의 위치를 계산한다.
function cameraOffset(yaw: number, pitch: number, distance: number): [number, number, number] {
  const flat = Math.cos(pitch) * distance
  return [
    Math.sin(yaw) * flat,
    LOOK_HEIGHT + Math.sin(pitch) * distance,
    Math.cos(yaw) * flat,
  ]
}

/** 고양이를 기준으로 카메라가 처음 떨어져 있는 거리 */
export const CAMERA_OFFSET = cameraOffset(0, START_PITCH, START_DISTANCE)

function clampPitch(value: number) {
  return Math.min(MAX_PITCH, Math.max(MIN_PITCH, value))
}

/** 방향키를 누르고 있을 때 1초에 시선이 도는 각도 */
const TURN_SPEED = 2.2

/** 마우스를 1픽셀 끌었을 때 시선이 도는 각도 */
const DRAG_SENSITIVITY = 0.006

/** 1초에 이동하는 거리 */
const SPEED = 4

/** 점프를 시작할 때 위로 올라가는 속도 */
const JUMP_SPEED = 4.6

/** 1초마다 아래로 당기는 속도의 크기 */
const GRAVITY = 14

// 매 프레임마다 새 객체를 만들지 않도록 계산용 벡터를 미리 만들어 둔다.
const cameraGoal = new Vector3()
const lookGoal = new Vector3()

// 두 각도 사이의 가장 짧은 회전 방향을 구한다.
// 이 계산이 없으면 고양이가 반대쪽으로 한 바퀴 돌아서 방향을 바꾼다.
function shortestAngle(from: number, to: number) {
  const difference = (to - from) % (Math.PI * 2)
  if (difference > Math.PI) return difference - Math.PI * 2
  if (difference < -Math.PI) return difference + Math.PI * 2
  return difference
}

// 키보드 입력을 받아서 고양이를 움직이고 카메라가 뒤에서 따라가게 한다.
export function Player() {
  const cat = useRef<Group>(null)
  const moving = useRef(false)
  const lookAt = useRef(new Vector3(START_POSITION[0], LOOK_HEIGHT, START_POSITION[2]))
  const keys = useKeyboard()
  // 시선의 좌우 각도. 0이면 카메라가 집의 뒤쪽 벽을 바라본다.
  const yaw = useRef(0)
  // 카메라가 고양이를 내려다보는 각도. 값이 클수록 위에서 내려다본다.
  const pitch = useRef(START_PITCH)
  // 카메라와 고양이 사이의 거리. 마우스 휠로 바꾼다.
  const distance = useRef(START_DISTANCE)
  // 위아래 방향의 속도. 점프하면 양수가 되고 중력 때문에 점점 줄어든다.
  const verticalSpeed = useRef(0)
  // 카메라가 기준으로 삼는 바닥 높이. 계단을 오를 때 화면이 덜컹거리지 않도록 천천히 따라간다.
  const cameraFloor = useRef(0)
  const canvas = useThree((state) => state.gl.domElement)

  // 마우스나 손가락으로 화면을 끌면 시선이 좌우와 위아래로 돈다.
  useEffect(() => {
    let dragging = false
    let lastX = 0
    let lastY = 0

    const handleDown = (event: PointerEvent) => {
      dragging = true
      lastX = event.clientX
      lastY = event.clientY
    }
    const handleMove = (event: PointerEvent) => {
      if (!dragging) return
      // 끄는 방향으로 시선이 따라간다. 왼쪽으로 끌면 왼쪽을 보고 위로 끌면 위를 본다.
      // 위를 보려면 카메라가 낮아져야 하므로 위로 끌 때(clientY 감소) 내려다보는 각도를 줄인다.
      yaw.current -= (event.clientX - lastX) * DRAG_SENSITIVITY
      pitch.current = clampPitch(pitch.current + (event.clientY - lastY) * DRAG_SENSITIVITY)
      lastX = event.clientX
      lastY = event.clientY
    }
    const handleUp = () => {
      dragging = false
    }

    // 휠을 굴리면 카메라가 가까워지거나 멀어진다.
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const next = distance.current * Math.exp(event.deltaY * 0.0012)
      distance.current = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, next))
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('pointerdown', handleDown)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('pointerdown', handleDown)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [canvas])

  useFrame((state, rawDelta) => {
    const group = cat.current
    if (!group) return

    // 탭을 오래 떠났다가 돌아오면 delta가 매우 커진다. 한 번에 멀리 튀지 않게 제한한다.
    const delta = Math.min(rawDelta, 0.05)

    // 좌우 방향키로 시선을 돌린다.
    yaw.current += readTurn(keys.current) * TURN_SPEED * delta
    // 위아래 방향키로 시선의 높낮이를 바꾼다. 시선을 올리면 카메라는 낮아진다.
    pitch.current = clampPitch(pitch.current - readTilt(keys.current) * TURN_SPEED * 0.6 * delta)

    // 시선 각도에서 앞쪽 방향과 오른쪽 방향을 구한다.
    const sin = Math.sin(yaw.current)
    const cos = Math.cos(yaw.current)
    const move = readMove(keys.current)
    // W를 누르면 카메라가 보는 쪽으로 가도록 입력을 시선 각도만큼 돌린다.
    const directionX = cos * move.x - sin * move.forward
    const directionZ = -sin * move.x - cos * move.forward
    const length = Math.hypot(directionX, directionZ)
    moving.current = length > 0

    if (length > 0) {
      // 대각선으로 갈 때 더 빨라지지 않도록 방향의 길이를 1로 맞춘다.
      const stepX = (directionX / length) * SPEED * delta
      const stepZ = (directionZ / length) * SPEED * delta
      const [nextX, nextZ] = resolveMove(
        group.position.x,
        group.position.z,
        group.position.x + stepX,
        group.position.z + stepZ,
        // 발 높이를 함께 넘겨서 가구 위로 올라설 수 있는지 판단하게 한다.
        group.position.y,
      )
      group.position.x = nextX
      group.position.z = nextZ

      // 고양이가 가는 방향을 바라보도록 천천히 돌린다.
      const targetAngle = Math.atan2(directionX, directionZ)
      group.rotation.y += shortestAngle(group.rotation.y, targetAngle) * Math.min(1, delta * 12)
    }

    // 지금 서 있는 자리의 바닥 높이. 거실과 계단은 테라스보다 높다.
    const floor = groundHeight(group.position.x, group.position.z)
    // 계단을 오를 때는 바닥보다 낮아진 만큼 바로 올려 세운다.
    if (group.position.y < floor) {
      group.position.y = floor
      verticalSpeed.current = 0
    }

    // 스페이스바를 누르면 점프한다. 바닥에 서 있을 때만 뛸 수 있다.
    const grounded = group.position.y <= floor
    if (grounded && keys.current.has('Space')) {
      verticalSpeed.current = JUMP_SPEED
    }
    // 점프 중이거나 계단을 내려가서 발밑이 비었을 때는 중력으로 떨어진다.
    if (!grounded || verticalSpeed.current > 0) {
      verticalSpeed.current -= GRAVITY * delta
      group.position.y = Math.max(floor, group.position.y + verticalSpeed.current * delta)
      if (group.position.y === floor) verticalSpeed.current = 0
    }

    // 카메라는 고양이 뒤쪽 위에서 부드럽게 따라간다.
    const smoothing = 1 - Math.exp(-6 * delta)
    cameraFloor.current += (floor - cameraFloor.current) * smoothing
    const [offsetX, offsetY, offsetZ] = cameraOffset(yaw.current, pitch.current, distance.current)
    cameraGoal.set(
      group.position.x + offsetX,
      // 점프할 때 화면이 함께 흔들리지 않도록 카메라의 높이는 바닥을 기준으로 잡는다.
      cameraFloor.current + offsetY,
      group.position.z + offsetZ,
    )
    state.camera.position.lerp(cameraGoal, smoothing)

    lookGoal.set(group.position.x, cameraFloor.current + LOOK_HEIGHT, group.position.z)
    lookAt.current.lerp(lookGoal, smoothing)
    state.camera.lookAt(lookAt.current)
  })

  return (
    <group ref={cat} position={START_POSITION} rotation={[0, Math.PI, 0]}>
      <Cat movingRef={moving} />
    </group>
  )
}
