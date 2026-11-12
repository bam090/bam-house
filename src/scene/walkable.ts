// 고양이가 걸을 수 있는 범위를 계산하는 파일이다.
// 물리 엔진을 쓰지 않고 좌표가 허용된 사각형 안에 있는지만 검사한다.

interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// 걸을 수 있는 구역. 거실과 테라스 두 개의 사각형이다.
const WALK_AREAS: Rect[] = [
  { minX: -7.6, maxX: 7.6, minZ: -5.4, maxZ: 6.2 },
  { minX: -9.6, maxX: 9.6, minZ: 6, maxZ: 13.6 },
]

// 걸을 수 없는 물체가 차지한 자리. 가구를 추가하면 여기에 사각형을 더한다.
const OBSTACLES: Rect[] = [
  // 수영장
  { minX: -3.95, maxX: 3.95, minZ: 8, maxZ: 12.6 },
  // 선베드
  { minX: -8.3, maxX: -6.7, minZ: 8.9, maxZ: 11.5 },
]

/** 수영장 데크가 잔디보다 높은 정도. 데크와 집은 이 높이의 돌 받침 위에 놓인다. */
export const DECK_HEIGHT = 0.5

/** 수영장 아래를 파는 범위와 깊이. 장면 전체 좌표다. */
// 수영장이 데크에서 1.5m 깊이라서 그 자리의 땅을 수영장 바닥보다 낮게 파야 물속에 땅이 비치지 않는다.
// 지형은 1.5m 간격의 점으로 그려서 판 자리 둘레 1.5m까지 비스듬히 이어진다. 그 비탈이 데크 돌 받침 안에 숨도록 범위를 잡았다.
export const POOL_DIG = { halfWidth: 4, minZ: 8, maxZ: 12.6, bottom: -2 } as const

/** 거실 바닥이 수영장 데크보다 높은 정도 */
export const FLOOR_HEIGHT = 0.9

/** 거실 앞 계단. 거실 앞면(z 6)에서 바깥으로 내려간다. */
export const STAIRS = {
  /** 계단이 시작하는 z 좌표. 거실 앞면이다. */
  startZ: 6,
  /** 계단 한 단의 깊이 */
  stepDepth: 0.3,
  /** 계단의 단 수. 높이 차이를 이 수로 나눈 만큼씩 내려간다. */
  risers: 5,
  /** 계단 폭의 절반. 거실 폭과 같다. */
  halfWidth: 8,
} as const

/** 계단 한 단의 높이 */
export const STEP_HEIGHT = FLOOR_HEIGHT / STAIRS.risers

/** 바닥에 놓인 계단 판의 수. 맨 아래 단은 데크 바닥이라서 판이 하나 적다. */
export const STEP_COUNT = STAIRS.risers - 1

/** 계단이 끝나는 z 좌표 */
export const STAIRS_END_Z = STAIRS.startZ + STAIRS.stepDepth * STEP_COUNT

// 고양이가 서 있는 자리의 바닥 높이를 구한다.
// 데크는 DECK_HEIGHT이고 거실은 그보다 FLOOR_HEIGHT만큼 높으며 계단은 단마다 낮아진다.
export function groundHeight(x: number, z: number) {
  return DECK_HEIGHT + heightAboveDeck(x, z)
}

// 데크를 기준으로 잰 바닥 높이
function heightAboveDeck(x: number, z: number) {
  if (Math.abs(x) > STAIRS.halfWidth) return 0
  if (z <= STAIRS.startZ) return z >= -6 ? FLOOR_HEIGHT : 0
  if (z < STAIRS_END_Z) {
    const step = Math.floor((z - STAIRS.startZ) / STAIRS.stepDepth)
    return FLOOR_HEIGHT - STEP_HEIGHT * (step + 1)
  }
  return 0
}

function contains(rect: Rect, x: number, z: number) {
  return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ
}

export function isWalkable(x: number, z: number) {
  const insideArea = WALK_AREAS.some((area) => contains(area, x, z))
  const insideObstacle = OBSTACLES.some((obstacle) => contains(obstacle, x, z))
  return insideArea && !insideObstacle
}

// 다음 위치로 갈 수 있으면 그 위치를 돌려준다.
// 벽에 비스듬히 부딪혔을 때는 한 축만 움직여서 벽을 따라 미끄러지게 한다.
export function resolveMove(
  currentX: number,
  currentZ: number,
  nextX: number,
  nextZ: number,
): [number, number] {
  if (isWalkable(nextX, nextZ)) return [nextX, nextZ]
  if (isWalkable(nextX, currentZ)) return [nextX, currentZ]
  if (isWalkable(currentX, nextZ)) return [currentX, nextZ]
  return [currentX, currentZ]
}
