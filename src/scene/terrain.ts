import { POOL_DIG } from './walkable.ts'

// 땅의 높이를 계산하는 파일이다.
// 좌표 하나를 넣으면 그 자리의 땅 높이를 돌려준다.
// 지형을 그릴 때와 나무를 심을 때 같은 함수를 써서 나무가 땅에 정확히 붙게 한다.
//
// 참고한 사진의 구조는 이렇다.
// - 집의 테라스와 수영장은 바다를 정면으로 바라본다. 이 프로젝트에서는 +z 방향이다.
// - 테라스 앞에 좁은 잔디 띠가 있고 그 끝이 둥글게 휘면서 수풀로 덮인 가파른 비탈로 이어진다.
// - 넓은 해변이 마당 바로 아래에 있고 활처럼 휘어서 왼쪽(-x)의 숲 언덕 밑으로 이어진다.
// - 해변 바로 뒤에서 숲으로 덮인 언덕이 높이 솟고 멀리 왼쪽에서는 곶이 바다로 튀어나온다.
// - 집 뒤쪽(-z)도 숲으로 덮인 언덕이 올라간다.

/** 집이 있는 평지의 높이. 거실 바닥과 테라스 바닥이 0이다. */
// 바닥과 정확히 같은 높이면 두 면이 겹쳐서 깜빡이므로 2cm만 낮춘다. 눈으로는 턱이 보이지 않는다.
export const PLATEAU_Y = -0.02

/** 바다 수면의 높이 */
export const SEA_LEVEL = -15

/** 집 앞쪽 해변의 폭. 집에서 바다를 볼 때 왼쪽 끝의 숲 언덕 앞에서는 점점 좁아진다. */
export const BEACH_WIDTH = 35

/** 비탈의 가장 짧은 수평 길이. 바다 쪽 비탈은 비탈 꼭대기에서 해변 뒤쪽까지 이어진다. */
const MIN_SLOPE_LENGTH = 12

/** 비탈이 휘어진 정도. 1보다 클수록 위쪽이 가파르고 아래쪽이 완만해진다. */
// 위쪽이 가파르게 떨어져야 마당 끝에 선 사람의 시선이 비탈에 걸리지 않고 해변까지 닿는다.
const SLOPE_CURVE = 2

/** 해변이 물에서 뒤쪽으로 갈수록 높아지는 비율. 해변이 넓어서 완만하게 둔다. */
export const BEACH_RISE = 0.04

/** 마당 끝이 둥글게 휘는 정도. 높이 단위이고 클수록 휘는 구간이 길어진다. */
// 약 3m 구간에 걸쳐 평평한 잔디가 비탈로 부드럽게 바뀐다.
const LIP_ROUNDING = 2.2

// 집과 테라스가 놓인 평지의 범위다. 위에서 보면 반원 모양이고 이 안은 높이가 일정하다.
// 곧은 변은 마당 끝(z 15)이고 둥근 쪽이 집 뒤와 양옆을 감싼다.
// 잔디도 이 반원을 따라 깔려서 숲과의 경계가 둥글게 보인다.
const PLATEAU = { centerX: 0, centerZ: 15, radius: 26 }

/** 비탈을 둥글게 다듬기 전에 비탈 꼭대기가 놓이는 z 좌표 */
// 평지 끝(15)과 이 값 사이에서 잔디가 둥글게 휘어 비탈로 이어진다.
const SLOPE_TOP_Z = 18

// 값이 from에서 to로 갈 때 0에서 1로 부드럽게 바뀌는 함수다.
function smoothstep(from: number, to: number, value: number) {
  const ratio = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return ratio * ratio * (3 - 2 * ratio)
}

/** 평지의 가장자리에서 얼마나 떨어져 있는지 구한다. 평지 안이면 0이다. */
export function distanceFromPlateau(x: number, z: number) {
  const dx = x - PLATEAU.centerX
  const dz = z - PLATEAU.centerZ
  if (dz > 0) {
    // 마당 끝보다 바다 쪽이다. 반원의 곧은 변까지의 거리를 잰다.
    return Math.hypot(Math.max(Math.abs(dx) - PLATEAU.radius, 0), dz)
  }
  // 반원의 둥근 쪽이다. 중심에서 떨어진 거리에서 반지름을 뺀다.
  return Math.max(Math.hypot(dx, dz) - PLATEAU.radius, 0)
}

/** x 위치에서 물가가 놓이는 z 좌표. 이 값보다 z가 크면 바다다. */
export function shoreZ(x: number) {
  // 집 앞쪽에서 물가가 안으로 조금 들어와서 활 모양의 만을 만든다.
  const bay = -6 * Math.exp(-(((x + 40) / 80) ** 2))
  // 왼쪽에서는 땅이 바다로 튀어나와서 곶이 된다. 해변이 이 곶 밑으로 휘어 들어간다.
  const headland = 60 * smoothstep(-80, -170, x)
  // 오른쪽 끝에서도 땅이 조금 나와서 만의 반대편을 닫는다.
  const nearPoint = 22 * smoothstep(70, 170, x)
  // 집 정면(x 0)에서 비탈 길이가 50m가 되도록 물가 위치를 정했다.
  return 107.7 + bay + headland + nearPoint
}

/** x 위치에서의 해변 폭 */
// 집에서 바다를 볼 때 왼쪽(+x)으로 갈수록 해변이 좁아지다가 숲 언덕 앞에서 끝난다.
// 그 뒤로는 숲 비탈이 모래사장 없이 바로 물속으로 들어간다.
export function beachWidthAt(x: number) {
  return BEACH_WIDTH * (1 - smoothstep(50, 100, x))
}

/** 비탈 잔디의 사다리꼴 모양. 마당 끝에서 좁고 모래사장 쪽에서 넓다. */
const LAWN_STRIP = {
  /** 사다리꼴이 시작하는 z 좌표. 마당 끝이다. */
  startZ: 14,
  /** 마당 끝에서의 폭의 절반 */
  nearHalfWidth: 13,
  /** 모래사장 쪽에서의 폭의 절반 */
  farHalfWidth: 30,
  /** 폭이 넓어지는 구간의 길이. 마당 끝에서 집 정면 모래사장 뒤쪽까지다. */
  length: 54,
} as const

/** z 위치에서 비탈 잔디 폭의 절반 */
function lawnStripHalfWidth(z: number) {
  const ratio = Math.min(1, Math.max(0, (z - LAWN_STRIP.startZ) / LAWN_STRIP.length))
  return LAWN_STRIP.nearHalfWidth + (LAWN_STRIP.farHalfWidth - LAWN_STRIP.nearHalfWidth) * ratio
}

/** 비탈 잔디의 사다리꼴 바깥으로 얼마나 떨어져 있는지 구한다. 안쪽이면 0이고 앞뒤로 벗어나면 Infinity다. */
// 테라스에서 바다를 보는 시야 통로이기도 하다. 이 안에는 나무와 덤불을 심지 않는다.
export function distanceFromLawnStrip(x: number, z: number) {
  const beachBack = shoreZ(x) - beachWidthAt(x)
  if (z < LAWN_STRIP.startZ || z > beachBack + 2) return Infinity
  return Math.max(0, Math.abs(x) - lawnStripHalfWidth(z))
}

/** 사다리꼴 잔디 안에서 지피식물이 덮는 자리인지 구한다. */
// 참고 사진처럼 잔디 아래쪽 약 40%와 잔디 양옆 가장자리를 지피식물이 덮는다.
// 잔디와의 경계는 사인 함수로 구불구불하게 만들어서 물결 모양이 되게 한다.
export function inGroundCover(x: number, z: number) {
  if (distanceFromLawnStrip(x, z) !== 0) return false
  // 아래쪽 무리: 모래사장 뒤쪽에서 약 22m 위까지 덮는다.
  const beachBack = shoreZ(x) - beachWidthAt(x)
  const driftTop = beachBack - 22 + 3 * Math.sin(x * 0.18) + 2 * Math.sin(x * 0.07 + 1)
  if (z > driftTop) return true
  // 양옆 띠: 사다리꼴 가장자리에서 안쪽으로 4m에서 8m를 덮는다.
  const bandWidth = 6 + 2 * Math.sin(z * 0.21 + (x > 0 ? 0 : 2))
  return lawnStripHalfWidth(z) - Math.abs(x) < bandWidth
}

/** 집 오른쪽 정원의 안쪽 경계 x 좌표. 이 값보다 x가 작으면(더 오른쪽이면) 정원이다. */
// 테라스 옆은 테라스 화단 바깥부터 시작하고 경계가 물결처럼 오르내린다.
// 집 옆은 유리벽 바로 바깥부터 시작해서 집 옆 화단이 된다.
// 집 뒤에서는 정원이 집 뒤쪽 벽을 따라 왼쪽으로 돌아 들어가서 집 뒤 가운데를 지나 끝난다.
export function houseGardenEdge(z: number) {
  if (z >= 5.5) return -13.8 - Math.sin(z * 0.5)
  if (z >= -6.3) return -8.4
  return 6 + 1.5 * Math.sin(z * 0.9)
}

/** 집에서 바다를 볼 때 오른쪽(-x)과 집 뒤에 있는 반원 잔디의 정원 자리인지 구한다. */
export function inHouseGarden(x: number, z: number) {
  return distanceFromPlateau(x, z) === 0 && z <= 15 && x < houseGardenEdge(z)
}

/** 반원 잔디 바깥에서 숲까지 이어지는 띠인지 구한다. */
// 정원과 숲 사이가 잔디로 비어 보이지 않도록 지피식물과 나무를 채우는 자리다.
// 바깥 경계는 위치마다 6m에서 12m 사이로 오르내려서 숲과 자연스럽게 섞인다.
export function inGardenFringe(x: number, z: number) {
  if (z > 15) return false
  const distance = distanceFromPlateau(x, z)
  const outer = 9 + 3 * Math.sin(x * 0.2 + z * 0.15)
  if (distance > 0) return distance < outer
  // 집에서 바다를 볼 때 왼쪽(+x)은 반원 잔디 안쪽 가장자리 3m에서 6m까지도 채워서 숲과 잔디를 잇는다.
  // 테라스 화단 바깥(x 13.5 이상)에서만 채워서 테라스 옆 잔디는 비워 둔다.
  if (x < 13.5) return false
  const rimDepth = 4.5 + 1.5 * Math.sin(z * 0.4)
  return PLATEAU.radius - Math.hypot(x - PLATEAU.centerX, z - PLATEAU.centerZ) < rimDepth
}

/** 지피식물 무리의 색 번호. 0부터 3까지이고 가까운 자리는 같은 번호가 나와서 색별로 무리를 짓는다. */
export function groundCoverShade(x: number, z: number) {
  const wave = Math.sin(x * 0.33 + z * 0.12) * Math.cos(z * 0.29 - x * 0.08)
  return Math.min(3, Math.floor(((wave + 1) / 2) * 4))
}

/** 테라스에서 바다를 바라보는 시야 통로 안인지 구한다. 비탈 잔디의 사다리꼴과 같은 범위다. */
export function inViewCorridor(x: number, z: number) {
  return distanceFromLawnStrip(x, z) === 0
}

/** 물가에서 육지 쪽으로 얼마나 들어왔는지 구한다. 음수면 바다 안쪽이다. */
export function shoreDistance(x: number, z: number) {
  return shoreZ(x) - z
}

// 물가에서의 거리로 정해지는 해안의 단면이다.
// 물속 → 해변 → 비탈 → 마당 높이 순서로 올라간다.
// beachWidth는 그 자리의 해변 폭이고 slopeLength는 해변 뒤쪽에서 마당 높이까지 올라가는 비탈의 수평 길이다.
function coastHeight(shore: number, beachWidth: number, slopeLength: number) {
  const beachBack = SEA_LEVEL + 0.1 + beachWidth * BEACH_RISE
  if (shore < 0) {
    // 물속에서는 땅이 빠르게 깊어진다. 수면과 거의 같은 높이로 겹치면 화면이 깜빡이기 때문이다.
    return Math.max(SEA_LEVEL - 10, SEA_LEVEL + 0.1 + shore * 0.3)
  }
  if (shore < beachWidth) {
    return SEA_LEVEL + 0.1 + shore * BEACH_RISE
  }
  // 비탈은 아래쪽이 완만하고 위쪽으로 갈수록 가팔라진다.
  // 이렇게 오목한 모양이어야 위쪽이 아래쪽 해변을 가리지 않는다.
  // ratio는 비탈 꼭대기를 넘어가면 1보다 커지고 그만큼 높이도 마당보다 높게 계산된다.
  const ratio = (shore - beachWidth) / slopeLength
  const slope = beachBack + (PLATEAU_Y - beachBack) * ratio ** SLOPE_CURVE
  // 비탈과 마당 높이 중 낮은 쪽을 고르되 꺾이는 자리는 둥글게 이어 붙인다.
  return smoothMin(slope, PLATEAU_Y, LIP_ROUNDING)
}

// 두 값 중 작은 값을 고르는데 두 값이 가까운 구간에서는 부드럽게 섞는다.
// 그냥 Math.min을 쓰면 마당과 비탈이 만나는 자리가 날카롭게 꺾인다.
function smoothMin(a: number, b: number, softness: number) {
  const mix = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / softness))
  return b + (a - b) * mix - softness * mix * (1 - mix)
}

/** x 위치에서 해변 뒤쪽부터 마당 끝까지의 비탈 길이 */
function slopeLengthAt(x: number) {
  return Math.max(MIN_SLOPE_LENGTH, shoreZ(x) - beachWidthAt(x) - SLOPE_TOP_Z)
}

/** 언덕이 평지보다 얼마나 높이 솟는지 구한다. 굴곡은 넣지 않은 값이다. */
export function hillAmount(x: number, z: number) {
  const shore = shoreDistance(x, z)
  // 집 뒤쪽 언덕
  const back = 30 * smoothstep(-12, -120, z)
  // 해변 바로 뒤에서 솟는 숲 언덕. 사진에서 해변을 감싸는 언덕이다.
  const beachHill = 40 * Math.exp(-(((x + 125) / 40) ** 2 + ((z - 38) / 40) ** 2))
  // 곶의 언덕
  const headland = 46 * Math.exp(-(((x + 160) / 50) ** 2 + ((z - 45) / 80) ** 2))
  // 오른쪽의 낮은 구릉
  const near = 10 * smoothstep(62, 150, x)
  // 집 가까이와 해변에서는 언덕이 솟지 않게 누른다.
  // 해변이 끝난 뒤부터 언덕이 솟아야 모래 색이 언덕 비탈 위로 번지지 않는다.
  const beachWidth = beachWidthAt(x)
  const awayFromHouse = smoothstep(3, 38, distanceFromPlateau(x, z))
  const awayFromBeach = smoothstep(beachWidth + 2, beachWidth + 30, shore)
  return (back + beachHill + headland + near) * awayFromHouse * awayFromBeach
}

export function terrainHeight(x: number, z: number) {
  // 수영장 아래는 수영장 바닥보다 낮게 판다.
  if (Math.abs(x) <= POOL_DIG.halfWidth && z >= POOL_DIG.minZ && z <= POOL_DIG.maxZ) return POOL_DIG.bottom
  if (distanceFromPlateau(x, z) === 0) return PLATEAU_Y

  const shore = shoreDistance(x, z)
  const hill = hillAmount(x, z)

  // 땅이 밋밋하지 않도록 굴곡을 더한다. 언덕에서는 크게 주고 바다 쪽 비탈에서는 작게 준다.
  const rolling =
    (Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06) * 2.2 + Math.sin(x * 0.031 + z * 0.043) * 3) *
    (0.1 + Math.min(1, hill / 10)) *
    smoothstep(3, 30, distanceFromPlateau(x, z)) *
    smoothstep(beachWidthAt(x), beachWidthAt(x) + 20, shore)

  return coastHeight(shore, beachWidthAt(x), slopeLengthAt(x)) + hill + rolling
}
