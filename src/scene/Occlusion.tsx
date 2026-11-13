import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box3, Raycaster, Vector3 } from 'three'
import type { Group, Material, Mesh, Object3D } from 'three'
import { CEILING_HEIGHT, DECK_HEIGHT, FLOOR_HEIGHT, HOUSE } from './walkable'

// 카메라와 고양이 사이를 가리는 것을 처리하는 파일이다.
// 벽은 반투명하게 바꾸고 지붕과 카바나 살 지붕은 숨긴다. 캣워크는 처리하지 않는다.

/** 고양이 몸의 가운데 자리. Player가 매 화면마다 고친다. 다른 파일은 읽기만 한다. */
export const catFocus = new Vector3()

/** 천장의 장면 높이 */
const CEILING_Y = DECK_HEIGHT + FLOOR_HEIGHT + CEILING_HEIGHT

/** 반투명하게 바꿀 때의 불투명도 */
const FADED = 0.25

/** 카메라가 넘어가지 못하는 벽. 처음 한 화면에서 FadeBlockingWalls가 채운다. */
// 불투명하고 키가 2m 이상이며 폭이 0.8m 이상인 벽만 넣는다. 유리와 기둥과 캣폴처럼 가는 것은 넣지 않는다.
const cameraWalls: Mesh[] = []

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }

// 고양이가 rect 범위 안에 있는지 본다.
function catIn(rect: Rect) {
  return catFocus.x >= rect.minX && catFocus.x <= rect.maxX && catFocus.z >= rect.minZ && catFocus.z <= rect.maxZ
}

// 매 화면마다 새 객체를 만들지 않도록 계산용 객체를 미리 만든다.
const raycaster = new Raycaster()
const direction = new Vector3()
const bounds = new Box3()
const size = new Vector3()

// 카메라에서 고양이까지 광선을 쏘아서 targets 가운데 광선에 걸리는 물체를 돌려준다.
// Raycaster는 한 점에서 한 방향으로 직선을 쏘아 그 직선에 닿는 물체를 찾는 three.js 도구다.
// recursive가 true면 targets 안에 든 물체까지 모두 검사한다.
function blockers(camera: Vector3, targets: Object3D[], recursive = false) {
  direction.subVectors(catFocus, camera)
  const distance = direction.length()
  if (distance < 0.01 || targets.length === 0) return []
  raycaster.set(camera, direction.normalize())
  raycaster.near = 0
  // 고양이 몸 바로 앞의 물체는 고양이가 올라선 가구일 수 있어서 0.3m 앞에서 멈춘다.
  raycaster.far = Math.max(0, distance - 0.3)
  return raycaster.intersectObjects(targets, recursive).map((hit) => hit.object)
}

// 벽처럼 키가 크고 얇은 것만 고른다. 바닥과 가구와 선반은 고르지 않는다.
// userData.noFade가 있는 group 아래는 건너뛴다. 돌 벽처럼 작은 돌이 붙어 있어서 벽만 흐려지면 어색한 것에 쓴다.
function collectWalls(root: Object3D, found: Mesh[] = []) {
  for (const child of root.children) {
    if (child.userData.noFade) continue
    const mesh = child as Mesh
    if (mesh.isMesh && !(mesh as { isInstancedMesh?: boolean }).isInstancedMesh) {
      bounds.setFromObject(mesh).getSize(size)
      if (size.y >= 1.8 && Math.min(size.x, size.z) <= 0.45) found.push(mesh)
    }
    collectWalls(child, found)
  }
  return found
}

interface FadeState {
  transparent: boolean
  opacity: number
  depthWrite: boolean
}

// 재질을 반투명하게 바꾸거나 원래대로 되돌린다. 원래 값은 처음 바꿀 때 userData에 적어 둔다.
function setFaded(mesh: Mesh, faded: boolean) {
  if (mesh.userData.faded === faded) return
  const material = mesh.material as Material
  const original: FadeState = mesh.userData.fadeOriginal ?? {
    transparent: material.transparent,
    opacity: material.opacity,
    depthWrite: material.depthWrite,
  }
  mesh.userData.fadeOriginal = original
  mesh.userData.faded = faded
  material.transparent = faded || original.transparent
  // 원래 반투명한 유리는 원래 값의 3분의 1 정도로 더 옅게 만든다. 세로줄 유리처럼 줄무늬가 시야를 가리지 않게 한다.
  material.opacity = faded ? Math.min(original.opacity * 0.35, FADED) : original.opacity
  material.depthWrite = faded ? false : original.depthWrite
  // transparent를 바꾸면 셰이더를 다시 만들어야 해서 needsUpdate를 켠다.
  material.needsUpdate = true
}

// 안에 든 벽 가운데 카메라와 고양이 사이에 낀 것을 반투명하게 바꾼다.
export function FadeBlockingWalls({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null)
  const walls = useRef<Mesh[] | null>(null)
  useFrame(({ camera }) => {
    if (!group.current) return
    // 장면은 움직이지 않으므로 벽 목록은 처음 한 번만 만든다. 첫 화면에서 위치 계산이 끝난 뒤에 만든다.
    if (!walls.current) {
      group.current.updateWorldMatrix(true, true)
      walls.current = collectWalls(group.current)
      for (const wall of walls.current) {
        bounds.setFromObject(wall).getSize(size)
        const opaque = !(wall.material as Material).transparent
        if (opaque && size.y >= 2 && Math.max(size.x, size.z) >= 0.8) cameraWalls.push(wall)
      }
    }
    const hits = new Set(blockers(camera.position, walls.current))
    for (const wall of walls.current) setFaded(wall, hits.has(wall))
  })
  return <group ref={group}>{children}</group>
}

// 화면에서만 지우고 그림자는 그대로 만들게 한다.
// visible을 false로 하면 그림자도 사라져서 지붕을 숨길 때 집 안이 갑자기 밝아진다.
// colorWrite는 화면에 색을 칠할지이고 depthWrite는 뒤에 있는 물체를 가릴지다. 둘 다 끄면 화면에는 보이지 않는다.
// 그림자는 재질과 상관없이 따로 계산하므로 그대로 남는다.
function setHidden(root: Object3D, hidden: boolean) {
  if (root.userData.hidden === hidden) return
  root.userData.hidden = hidden
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const material = mesh.material as Material
    material.colorWrite = !hidden
    material.depthWrite = !hidden
  })
}

// 카메라와 고양이 사이를 가리면 안에 든 것을 모두 숨긴다. 지붕과 카바나 살 지붕에 쓴다.
// alsoWhen을 주면 광선에 걸리지 않아도 그 조건이 참일 때 숨긴다.
// 숨긴 물체도 광선 검사는 그대로 받아서 숨겼다 보였다를 반복하지 않는다.
export function HideWhenBlocking({ children, alsoWhen }: { children: ReactNode; alsoWhen?: (camera: Vector3) => boolean }) {
  const group = useRef<Group>(null)
  useFrame(({ camera }) => {
    const target = group.current
    if (!target) return
    const blocked = blockers(camera.position, target.children, true).length > 0
    setHidden(target, blocked || Boolean(alsoWhen?.(camera.position)))
  })
  return <group ref={group}>{children}</group>
}

// 카메라가 벽 뒤로 넘어가지 않게 목표 자리를 고양이 쪽으로 당긴다.
// 고양이(target)에서 카메라 목표(goal)까지 직선 셋을 쏜다. 가운데 하나와 카메라 자리에서 좌우로 0.3m 벌린 둘이다.
// 셋 가운데 가장 가까이에서 벽에 닿은 자리보다 0.25m 앞으로 목표를 옮긴다. 옆 직선은 벽 모서리가 화면 반을 덮는 것을 막는다.
// 벽에 닿아서 당겼으면 true를 돌려준다.
const toGoal = new Vector3()
const aim = new Vector3()
const sideways = new Vector3()
export function keepCameraInRoom(target: Vector3, goal: Vector3) {
  if (cameraWalls.length === 0) return false
  // 카메라 목표가 집 안(지붕 아래)에 있을 때만 당긴다. 집 밖이나 지붕 위에서는 벽을 반투명하게만 바꾼다.
  // 카메라를 멀리 뺀 채 방을 옮겨 다닐 때 문 옆 벽에 걸려서 화면이 확대됐다가 돌아오지 않게 한다.
  const inHouse = (rect: Rect) => goal.x >= rect.minX && goal.x <= rect.maxX && goal.z >= rect.minZ && goal.z <= rect.maxZ
  if (goal.y >= CEILING_Y || !(inHouse(HOUSE) || inHouse(HOUSE.toilet))) return false
  toGoal.subVectors(goal, target)
  const distance = toGoal.length()
  if (distance < 0.5) return false
  sideways.set(-toGoal.z, 0, toGoal.x).normalize().multiplyScalar(0.3)
  let nearest = distance
  for (const offset of [0, 1, -1]) {
    aim.copy(goal).addScaledVector(sideways, offset).sub(target)
    const length = aim.length()
    raycaster.set(target, aim.normalize())
    raycaster.near = 0
    raycaster.far = length
    const hit = raycaster.intersectObjects(cameraWalls, false)[0]
    // 옆 직선은 가운데 직선보다 길어서 같은 비율로 줄여서 비교한다.
    if (hit) nearest = Math.min(nearest, (hit.distance / length) * distance - 0.25)
  }
  if (nearest >= distance) return false
  const pulledTo = Math.max(0.4, nearest)
  goal.copy(target).addScaledVector(toGoal.normalize(), pulledTo)
  // 1.5m보다 가까이 당겨지면 고양이 몸이 화면을 덮으므로 모자란 만큼 카메라를 위로 올려서 내려다보게 한다.
  // 집 안에서는 천장 0.15m 아래까지만 올린다.
  if (pulledTo < 1.5) {
    const limit = target.y < CEILING_Y ? CEILING_Y - 0.15 : Infinity
    goal.y = Math.min(goal.y + (1.5 - pulledTo) * 3, limit)
  }
  return true
}

// 지붕 조각을 숨기는 조건을 만든다. 고양이가 rooms 가운데 한 방에 있고 카메라가 천장보다 높으면 숨긴다.
// 함수를 돌려주는 함수다. 조각마다 덮는 방이 달라서 방 목록을 넣어 조건을 하나씩 만든다.
export function cameraAboveCeilingIn(rooms: Rect[]) {
  return (camera: Vector3) => rooms.some(catIn) && camera.y > CEILING_Y - 0.05
}
