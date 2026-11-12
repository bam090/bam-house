// 나무와 덤불을 심을 자리를 계산하는 파일이다.
// 화면을 그리는 코드와 분리해 두어서 검사 스크립트가 이 계산만 따로 불러 쓸 수 있다.
import {
  BEACH_WIDTH,
  PLATEAU_Y,
  distanceFromPlateau,
  hillAmount,
  shoreDistance,
  shoreZ,
  terrainHeight,
} from './terrain.ts'

export interface Plant {
  x: number
  y: number
  z: number
  scale: number
  turn: number
  /** 색을 두 가지로 나누기 위한 값 */
  light: boolean
}

/** 야자수 줄기의 기본 높이 */
export const TRUNK_HEIGHT = 3.4

const BUSH_COUNT = 1100
const PALM_COUNT = 170

/** 덤불의 꼭대기 높이 */
export function bushTop(bush: Plant) {
  return bush.y + bush.scale * 1.55
}

/** 야자수의 꼭대기 높이 */
export function palmTop(palm: Plant) {
  return palm.y + TRUNK_HEIGHT * palm.scale + 0.3
}

// 같은 시작값을 넣으면 항상 같은 순서의 숫자를 돌려주는 난수 함수다.
// Math.random을 쓰면 새로고침할 때마다 나무 위치가 바뀌기 때문에 이 함수를 쓴다.
function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

export function makePlants() {
  const random = seededRandom(11)
  // 사진에서 집 바로 옆에 서 있는 야자수 한 그루를 먼저 심는다.
  const palms: Plant[] = [
    { x: 12.6, y: terrainHeight(12.6, 12), z: 12, scale: 1.5, turn: 0.6, light: true },
  ]
  const bushes: Plant[] = []

  for (let attempt = 0; attempt < 80000; attempt += 1) {
    if (palms.length >= PALM_COUNT && bushes.length >= BUSH_COUNT) break

    // 절반은 집 가까이에 촘촘하게 심고 나머지는 지형 전체에 고르게 심는다.
    let x: number
    let z: number
    if (random() < 0.55) {
      const radius = 14 + random() * random() * 140
      const angle = random() * Math.PI * 2
      x = Math.cos(angle) * radius
      z = 3.5 + Math.sin(angle) * radius
    } else {
      x = -250 + random() * 440
      z = -200 + random() * 370
    }
    const scaleRoll = random()
    const turn = random() * Math.PI * 2
    const kindRoll = random()
    const light = random() > 0.5

    const shore = shoreDistance(x, z)
    // 잔디 마당과 해변과 바다에는 심지 않는다.
    if (distanceFromPlateau(x, z) < 3 || shore < BEACH_WIDTH + 2) continue

    const height = terrainHeight(x, z)
    const plant = { x, y: height, z, turn, light }
    const hill = hillAmount(x, z)

    if (hill < 1.5) {
      // 바다 쪽 비탈과 마당 주변의 낮은 땅이다.
      // 풀과 나무의 꼭대기가 마당 높이보다 낮아야 마당에서 해변이 가려지지 않는다.
      const below = Math.max(0, PLATEAU_Y - height)
      const inFrontOfTerrace = z > 14

      // 야자수는 마당보다 충분히 낮은 곳에만 심는다. 해변 뒤쪽에는 더 많이 모아 심는다.
      const palmChance = shore < BEACH_WIDTH + 22 ? 0.4 : 0.12
      if (below > 8 && kindRoll < palmChance) {
        if (palms.length < PALM_COUNT) palms.push({ ...plant, scale: 0.9 + scaleRoll * 0.35 })
        continue
      }

      // 덤불은 땅이 낮아질수록 크게 만든다. 마당 끝에서는 낮은 풀이고 비탈 아래에서는 큰 덤불이다.
      const tallest = inFrontOfTerrace ? below * 0.8 + 0.3 : below * 0.8 + 1.4
      const scale = Math.min(1.6, tallest / 1.55) * (0.55 + scaleRoll * 0.45)
      if (scale < 0.18) continue
      if (bushes.length < BUSH_COUNT) bushes.push({ ...plant, scale })
      continue
    }

    // 언덕의 숲이다. 멀리 있는 나무는 크게 만들어서 언덕이 숲으로 덮인 것처럼 보이게 한다.
    const farBoost = 1 + Math.min(2.2, distanceFromPlateau(x, z) / 45)
    if (kindRoll > 0.82) {
      if (palms.length < PALM_COUNT) {
        palms.push({ ...plant, scale: (0.9 + scaleRoll * 0.8) * Math.min(1.5, farBoost) })
      }
    } else if (bushes.length < BUSH_COUNT) {
      bushes.push({ ...plant, scale: (0.8 + scaleRoll * 0.9) * farBoost })
    }
  }

  return { palms, bushes }
}

/** 물가를 따라 x 좌표를 일정한 간격으로 나눈 목록. 파도 거품을 그릴 때 쓴다. */
export function shorelinePoints(fromX: number, toX: number, step: number) {
  const points: { x: number; z: number }[] = []
  for (let x = fromX; x <= toX; x += step) {
    points.push({ x, z: shoreZ(x) })
  }
  return points
}
