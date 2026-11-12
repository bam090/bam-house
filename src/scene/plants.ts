// 나무와 덤불을 심을 자리를 계산하는 파일이다.
// 화면을 그리는 코드와 분리해 두어서 검사 스크립트가 이 계산만 따로 불러 쓸 수 있다.
import {
  beachWidthAt,
  distanceFromPlateau,
  hillAmount,
  distanceFromLawnStrip,
  groundCoverShade,
  inGroundCover,
  inGardenFringe,
  inHouseGarden,
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
  /** 잎 색을 고르는 번호. 0은 어두운 초록이고 2는 밝은 초록이다. */
  shade: number
}

/** 야자수 줄기의 기본 높이 */
export const TRUNK_HEIGHT = 3.4

/** 활엽수 줄기의 기본 높이 */
export const TREE_TRUNK_HEIGHT = 2.2

/** 활엽수 잎 덩어리의 반지름. 위아래로 납작하게 눌러서 넓게 퍼진 모양을 만든다. */
export const TREE_CROWN = { radius: 1.7, flatten: 0.55 } as const

/** 지피식물 덩어리를 위아래로 누르는 비율. 땅에 낮게 깔린 모양이 된다. */
export const COVER_FLATTEN = 0.3

const BUSH_COUNT = 1500
const PALM_COUNT = 230
const TREE_COUNT = 260
/** 정해진 자리에 심는 지피식물과 별도로 지형 전체에 흩어 심는 지피식물의 수 */
const COVER_COUNT = 3100

/** 지피식물 무리 사이에 심는 낮은 나무의 수 */
const LOW_TREE_COUNT = 7

/** 덤불의 꼭대기 높이 */
export function bushTop(bush: Plant) {
  return bush.y + bush.scale * 1.55
}

/** 야자수의 꼭대기 높이 */
export function palmTop(palm: Plant) {
  return palm.y + TRUNK_HEIGHT * palm.scale + 0.3
}

/** 활엽수의 꼭대기 높이 */
export function treeTop(tree: Plant) {
  return tree.y + (TREE_TRUNK_HEIGHT + TREE_CROWN.radius * TREE_CROWN.flatten * 2) * tree.scale
}

/** 지피식물의 꼭대기 높이 */
export function coverTop(cover: Plant) {
  return cover.y + cover.scale * COVER_FLATTEN
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

// 참고 사진의 식물 배치를 따른다.
// - 테라스에서 바다를 보는 시야 통로는 사다리꼴 잔디다.
//   잔디 아래쪽과 양옆 가장자리는 지피식물 무리가 덮고 그 사이에 낮은 나무 몇 그루가 선다.
// - 테라스 가장자리에는 낮은 화단이 붙어 있다.
// - 집에서 바다를 볼 때 오른쪽(-x)에는 야자수와 넓게 퍼진 활엽수가 숲을 이룬다.
// - 왼쪽(+x)에는 둥근 관목과 작은 나무가 있다.
// - 해변과 숲 사이에는 잔디와 낮은 덤불 띠가 있고 가장자리에 야자수가 선다.
export function makePlants() {
  const random = seededRandom(11)
  // 사진에서 집 바로 옆에 서 있는 야자수 한 그루를 먼저 심는다.
  const palms: Plant[] = [
    { x: 12.6, y: terrainHeight(12.6, 12), z: 12, scale: 1.5, turn: 0.6, shade: 2 },
  ]
  const bushes: Plant[] = []
  const trees: Plant[] = []
  const covers: Plant[] = []
  const lowTrees: Plant[] = []
  const gardenTrees: Plant[] = []

  // 지피식물 한 포기를 심는다. 색은 자리마다 정해진 무리 색을 따른다.
  const plantCover = (x: number, z: number, scale: number, turn: number) => {
    covers.push({ x, y: terrainHeight(x, z), z, scale, turn, shade: groundCoverShade(x, z) })
  }

  // 테라스 양옆과 앞쪽 두 모서리의 화단. 테라스 돌바닥 바로 바깥에 붙인다.
  for (let z = 6.3; z <= 14.2; z += 0.7) {
    for (const side of [-1, 1]) {
      for (let offset = 0; offset < 2.5; offset += 0.8) {
        // 데크 양옆 계단(x 10~10.7) 바깥에서 시작한다.
        const x = side * (10.8 + offset + random() * 0.3)
        plantCover(x, z + random() * 0.3, 0.35 + random() * 0.3, random() * Math.PI * 2)
      }
    }
  }
  // 앞쪽 두 모서리에서는 화단이 테라스 앞으로 꺾여 들어온다.
  for (let x = 6.5; x <= 12.8; x += 0.7) {
    for (const side of [-1, 1]) {
      for (let z = 14.3; z < 16.6; z += 0.8) {
        plantCover(side * (x + random() * 0.3), z, 0.35 + random() * 0.3, random() * Math.PI * 2)
      }
    }
  }

  // 집에서 바다를 볼 때 오른쪽의 정원. 참고 사진에서 건물 옆을 감싸는 식물 덩어리를 따른다.
  // 정원은 집 오른쪽에서 시작해서 집 뒤편까지 이어진다.
  // 바닥은 회색빛 초록 지피식물로 덮고 집 유리벽과 뒤쪽 벽 바로 옆 2m는 밝은 색 화단으로 만든다.
  for (let x = -26; x <= 8; x += 0.9) {
    for (let z = -12; z <= 15; z += 0.9) {
      const px = x + (random() - 0.5) * 0.5
      const pz = z + (random() - 0.5) * 0.5
      if (!inHouseGarden(px, pz)) continue
      const besideHouse = (pz < 5.5 && pz > -6.3 && px > -10.4) || (pz <= -6.3 && pz > -8.3)
      const scale = 0.4 + random() * 0.35
      covers.push({
        x: px,
        y: terrainHeight(px, pz),
        z: pz,
        scale,
        turn: random() * Math.PI * 2,
        shade: besideHouse ? 1 + Math.floor(random() * 2) : 3,
      })
    }
  }
  // 둥근 관목 무리. 무리마다 덤불 서너 개를 모아 심는다.
  const shrubClumps = [
    [-15.5, 12],
    [-19.5, 8.5],
    [-16, 0.5],
    [-12.5, -3.5],
    [-21.5, 3.5],
    [-11.5, -7],
    [-6, -9.5],
    [0.5, -10],
    [4.5, -8.8],
  ]
  for (const [cx, cz] of shrubClumps) {
    for (let index = 0; index < 4; index += 1) {
      const x = cx + (random() - 0.5) * 2.4
      const z = cz + (random() - 0.5) * 2.4
      if (!inHouseGarden(x, z)) continue
      bushes.push({
        x,
        y: terrainHeight(x, z),
        z,
        scale: 0.5 + random() * 0.3,
        turn: random() * Math.PI * 2,
        shade: Math.floor(random() * 3),
      })
    }
  }
  // 작은 활엽수 두 그루와 야자수 두 그루
  gardenTrees.push(
    { x: -18, y: terrainHeight(-18, 5), z: 5, scale: 1.1, turn: 0.4, shade: 1 },
    { x: -14, y: terrainHeight(-14, -6.5), z: -6.5, scale: 1.2, turn: 2.1, shade: 0 },
    { x: -2.5, y: terrainHeight(-2.5, -9.8), z: -9.8, scale: 1.0, turn: 0.9, shade: 1 },
  )
  palms.push(
    { x: -22, y: terrainHeight(-22, 12), z: 12, scale: 1.3, turn: 1.2, shade: 2 },
    { x: -17.5, y: terrainHeight(-17.5, -2.5), z: -2.5, scale: 1.4, turn: 2.8, shade: 1 },
    { x: 3.5, y: terrainHeight(3.5, -10.2), z: -10.2, scale: 1.2, turn: 0.3, shade: 2 },
  )

  // 반원 잔디 바깥에서 숲까지 이어지는 띠. 바닥은 지피식물로 덮고 덤불과 작은 나무와 야자수를 섞는다.
  for (let x = -45; x <= 45; x += 1) {
    for (let z = -40; z <= 15; z += 1) {
      const px = x + (random() - 0.5) * 0.7
      const pz = z + (random() - 0.5) * 0.7
      if (!inGardenFringe(px, pz)) continue
      const y = terrainHeight(px, pz)
      const turn = random() * Math.PI * 2
      covers.push({ x: px, y, z: pz, scale: 0.45 + random() * 0.4, turn, shade: groundCoverShade(px, pz) })
      const roll = random()
      if (roll < 0.1) {
        bushes.push({ x: px, y, z: pz, scale: 0.6 + random() * 0.5, turn, shade: Math.floor(random() * 3) })
      } else if (roll < 0.135) {
        gardenTrees.push({ x: px, y, z: pz, scale: 0.9 + random() * 0.4, turn, shade: Math.floor(random() * 2) })
      } else if (roll < 0.15) {
        palms.push({ x: px, y, z: pz, scale: 1 + random() * 0.4, turn, shade: 2 })
      }
    }
  }

  // 지피식물 무리 사이의 낮은 나무. 시야 통로 가운데보다 양옆에 더 많이 둔다.
  for (let attempt = 0; attempt < 2000 && lowTrees.length < LOW_TREE_COUNT; attempt += 1) {
    const side = random() < 0.5 ? -1 : 1
    const x = side * (6 + random() * 22)
    const z = 46 + random() * 22
    if (!inGroundCover(x, z) || shoreDistance(x, z) < beachWidthAt(x) + 3) continue
    // 다른 낮은 나무와 8m 이상 떨어뜨린다.
    if (lowTrees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 8)) continue
    lowTrees.push({
      x,
      y: terrainHeight(x, z),
      z,
      scale: 0.75 + random() * 0.2,
      turn: random() * Math.PI * 2,
      shade: Math.floor(random() * 2),
    })
  }

  // 아래 반복문은 정원과 화단처럼 정해진 자리에 심은 식물과 별도로 정한 수만큼 더 심는다.
  const palmLimit = palms.length + PALM_COUNT
  const bushLimit = bushes.length + BUSH_COUNT
  const treeLimit = trees.length + TREE_COUNT
  const coverLimit = covers.length + COVER_COUNT

  const full = () =>
    palms.length >= palmLimit &&
    bushes.length >= bushLimit &&
    trees.length >= treeLimit &&
    covers.length >= coverLimit

  for (let attempt = 0; attempt < 160000 && !full(); attempt += 1) {
    let x: number
    let z: number
    const areaRoll = random()
    if (areaRoll < 0.35) {
      // 테라스 앞 비탈에 따로 촘촘하게 심는다.
      x = -90 + random() * 180
      const top = 15.5
      z = top + random() * Math.max(0, shoreZ(x) - beachWidthAt(x) - top)
    } else if (areaRoll < 0.65) {
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
    const shade = Math.floor(random() * 3)

    const shore = shoreDistance(x, z)
    const beachWidth = beachWidthAt(x)
    // 바다와 해변에는 심지 않는다.
    if (shore < beachWidth + 1) continue

    const height = terrainHeight(x, z)
    const plant = { x, y: height, z, turn, shade }

    // 사다리꼴 비탈 잔디 안에는 나무와 덤불을 심지 않는다.
    // 모래사장 바로 앞에만 낮은 지피식물을 띠로 깐다.
    // 숲이 시작하는 거리를 나무마다 다르게 해서 잔디 가장자리가 곧게 보이지 않게 한다.
    const strip = distanceFromLawnStrip(x, z)
    if (strip < 1 + scaleRoll * 5) {
      // 잔디 바깥 가장자리와 지피식물 자리와 모래사장 앞에는 지피식물을 깐다.
      const coverSpot = strip > 0 || inGroundCover(x, z) || shore < beachWidth + 5
      if (coverSpot && covers.length < coverLimit) plantCover(x, z, 0.4 + scaleRoll * 0.6, turn)
      continue
    }

    // 잔디 마당에는 심지 않는다. 숲이 시작하는 거리를 나무마다 다르게 해서 경계가 곧게 보이지 않게 한다.
    // 집 오른쪽과 뒤편은 정원 바깥 띠를 따로 채웠으므로 그 띠 안에는 더 심지 않는다.
    const forestEdge = 5 + scaleRoll * 6
    if (distanceFromPlateau(x, z) < forestEdge || inGardenFringe(x, z)) continue

    const hill = hillAmount(x, z)
    // 해변 바로 뒤의 띠. 잔디와 낮은 덤불이 섞이고 가장자리에 야자수가 선다.
    const nearBeach = shore < beachWidth + 8
    if (nearBeach) {
      if (kindRoll < 0.18) {
        if (palms.length < palmLimit) palms.push({ ...plant, scale: 0.9 + scaleRoll * 0.35 })
      } else if (kindRoll < 0.6) {
        if (covers.length < coverLimit) plantCover(x, z, 0.4 + scaleRoll * 0.6, turn)
      } else if (bushes.length < bushLimit) {
        bushes.push({ ...plant, scale: 0.35 + scaleRoll * 0.35 })
      }
      continue
    }

    if (hill < 1.5 && z > 14) {
      // 시야 통로 양옆의 비탈이다.
      if (x < 0) {
        // 오른쪽 옆: 야자수와 넓게 퍼진 활엽수 숲
        if (kindRoll < 0.3) {
          if (palms.length < palmLimit) palms.push({ ...plant, scale: 0.9 + scaleRoll * 0.45 })
        } else if (kindRoll < 0.65) {
          if (trees.length < treeLimit) trees.push({ ...plant, scale: 0.9 + scaleRoll * 0.6 })
        } else if (bushes.length < bushLimit) {
          bushes.push({ ...plant, scale: 0.7 + scaleRoll * 0.7 })
        }
      } else if (kindRoll < 0.15) {
        // 왼쪽 옆: 작은 나무가 섞인 둥근 관목
        if (trees.length < treeLimit) trees.push({ ...plant, scale: 0.6 + scaleRoll * 0.3 })
      } else if (kindRoll < 0.2) {
        if (palms.length < palmLimit) palms.push({ ...plant, scale: 0.8 + scaleRoll * 0.3 })
      } else if (bushes.length < bushLimit) {
        bushes.push({ ...plant, scale: 0.5 + scaleRoll * 0.6 })
      }
      continue
    }

    // 집에서 바다를 볼 때 왼쪽(+x)의 집 옆은 관목과 작은 나무만 둔다.
    if (x > 0 && z > -10 && distanceFromPlateau(x, z) < 30) {
      if (kindRoll < 0.15) {
        if (trees.length < treeLimit) trees.push({ ...plant, scale: 0.6 + scaleRoll * 0.3 })
      } else if (bushes.length < bushLimit) {
        bushes.push({ ...plant, scale: 0.5 + scaleRoll * 0.6 })
      }
      continue
    }

    // 집 옆과 뒤쪽과 언덕의 숲이다. 멀리 있는 나무는 크게 만들어서 언덕이 숲으로 덮인 것처럼 보이게 한다.
    const farBoost = 1 + Math.min(2.2, distanceFromPlateau(x, z) / 45)
    if (kindRoll > 0.82) {
      if (palms.length < palmLimit) {
        palms.push({ ...plant, scale: (0.9 + scaleRoll * 0.8) * Math.min(1.5, farBoost) })
      }
    } else if (kindRoll > 0.62) {
      if (trees.length < treeLimit) {
        trees.push({ ...plant, scale: (0.9 + scaleRoll * 0.6) * Math.min(1.8, farBoost) })
      }
    } else if (bushes.length < bushLimit) {
      bushes.push({ ...plant, scale: (0.8 + scaleRoll * 0.9) * farBoost })
    }
  }

  return { palms, bushes, trees, covers, lowTrees, gardenTrees }
}

/** 물가를 따라 x 좌표를 일정한 간격으로 나눈 목록. 파도 거품을 그릴 때 쓴다. */
export function shorelinePoints(fromX: number, toX: number, step: number) {
  const points: { x: number; z: number }[] = []
  for (let x = fromX; x <= toX; x += step) {
    points.push({ x, z: shoreZ(x) })
  }
  return points
}
