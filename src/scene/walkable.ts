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
