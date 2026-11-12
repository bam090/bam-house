// 땅의 높이를 계산하는 파일이다.
// 좌표 하나를 넣으면 그 자리의 땅 높이를 돌려준다.
// 지형을 그릴 때와 나무를 심을 때 같은 함수를 써서 나무가 땅에 정확히 붙게 한다.
//
// 참고한 사진의 구조는 이렇다.
// - 집의 테라스와 수영장은 바다를 정면으로 바라본다. 이 프로젝트에서는 +z 방향이다.
// - 마당에서 해변까지 낮은 풀과 덤불로 덮인 완만한 비탈이 내려간다.
// - 해변은 활처럼 휘어 있고 멀리 왼쪽(-x)에서 숲으로 덮인 곶이 바다로 튀어나온다.
// - 집 뒤쪽(-z)과 곶 쪽은 숲으로 덮인 언덕이 올라간다.

/** 집이 있는 평지의 높이. 거실 바닥과 테라스 바닥이 0이라서 그보다 조금 낮게 둔다. */
export const PLATEAU_Y = -0.2

/** 바다 수면의 높이 */
export const SEA_LEVEL = -15

/** 해변의 폭 */
export const BEACH_WIDTH = 24

/** 해변 뒤쪽 끝에서 마당 높이까지 올라가는 비탈의 수평 길이. 길수록 완만하다. */
// 비탈이 카메라의 시선보다 완만해야 마당에서 해변까지 한눈에 보인다.
export const SLOPE_LENGTH = 52

/** 해변이 물에서 뒤쪽으로 갈수록 높아지는 비율 */
const BEACH_RISE = 0.065

// 집과 테라스가 놓인 평지의 범위다. 이 사각형 안은 높이가 일정하다.
const PLATEAU = { centerX: 0, centerZ: 3.5, halfWidth: 13, halfDepth: 13.5 }

// 값이 from에서 to로 갈 때 0에서 1로 부드럽게 바뀌는 함수다.
function smoothstep(from: number, to: number, value: number) {
  const ratio = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return ratio * ratio * (3 - 2 * ratio)
}

/** 평지의 가장자리에서 얼마나 떨어져 있는지 구한다. 평지 안이면 0이다. */
export function distanceFromPlateau(x: number, z: number) {
  const outsideX = Math.max(Math.abs(x - PLATEAU.centerX) - PLATEAU.halfWidth, 0)
  const outsideZ = Math.max(Math.abs(z - PLATEAU.centerZ) - PLATEAU.halfDepth, 0)
  return Math.hypot(outsideX, outsideZ)
}

/** x 위치에서 물가가 놓이는 z 좌표. 이 값보다 z가 크면 바다다. */
export function shoreZ(x: number) {
  // 집 앞쪽에서 물가가 안으로 조금 들어와서 활 모양의 만을 만든다.
  const bay = -6 * Math.exp(-(((x + 40) / 80) ** 2))
  // 멀리 왼쪽에서는 땅이 바다로 튀어나와서 곶이 된다.
  const headland = 75 * smoothstep(-120, -215, x)
  // 오른쪽 끝에서도 땅이 조금 나와서 만의 반대편을 닫는다.
  const nearPoint = 22 * smoothstep(70, 170, x)
  return 100 + bay + headland + nearPoint
}

/** 물가에서 육지 쪽으로 얼마나 들어왔는지 구한다. 음수면 바다 안쪽이다. */
export function shoreDistance(x: number, z: number) {
  return shoreZ(x) - z
}

// 물가에서의 거리만으로 정해지는 해안의 단면이다.
// 물속 → 해변 → 비탈 → 마당 높이 순서로 올라간다.
function coastHeight(shore: number) {
  if (shore < 0) {
    // 물속에서는 땅이 빠르게 깊어진다. 수면과 거의 같은 높이로 겹치면 화면이 깜빡이기 때문이다.
    return Math.max(SEA_LEVEL - 10, SEA_LEVEL + 0.1 + shore * 0.3)
  }
  const beachBack = SEA_LEVEL + 0.1 + BEACH_WIDTH * BEACH_RISE
  if (shore < BEACH_WIDTH) {
    return SEA_LEVEL + 0.1 + shore * BEACH_RISE
  }
  // 비탈은 거의 일정한 기울기로 올라간다. 위쪽이 볼록하면 그 뒤의 해변이 가려지기 때문이다.
  const ratio = Math.min(1, (shore - BEACH_WIDTH) / SLOPE_LENGTH)
  const shape = ratio * 0.85 + smoothstep(0, 1, ratio) * 0.15
  return beachBack + (PLATEAU_Y - beachBack) * shape
}

/** 언덕이 평지보다 얼마나 높이 솟는지 구한다. 굴곡은 넣지 않은 값이다. */
export function hillAmount(x: number, z: number) {
  const shore = shoreDistance(x, z)
  // 집 뒤쪽 언덕
  const back = 30 * smoothstep(-12, -120, z)
  // 해변 끝에서 솟는 곶의 언덕
  const headland = 46 * Math.exp(-(((x + 170) / 55) ** 2 + ((z - 30) / 85) ** 2))
  // 오른쪽의 낮은 구릉
  const near = 10 * smoothstep(62, 150, x)
  // 집 가까이와 해변에서는 언덕이 솟지 않게 누른다.
  const awayFromHouse = smoothstep(3, 38, distanceFromPlateau(x, z))
  const awayFromBeach = smoothstep(18, 46, shore)
  return (back + headland + near) * awayFromHouse * awayFromBeach
}

export function terrainHeight(x: number, z: number) {
  if (distanceFromPlateau(x, z) === 0) return PLATEAU_Y

  const shore = shoreDistance(x, z)
  const hill = hillAmount(x, z)

  // 땅이 밋밋하지 않도록 굴곡을 더한다. 언덕에서는 크게 주고 바다 쪽 비탈에서는 작게 준다.
  const rolling =
    (Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06) * 2.2 + Math.sin(x * 0.031 + z * 0.043) * 3) *
    (0.1 + Math.min(1, hill / 10)) *
    smoothstep(3, 30, distanceFromPlateau(x, z)) *
    smoothstep(BEACH_WIDTH, BEACH_WIDTH + 20, shore)

  return coastHeight(shore) + hill + rolling
}
