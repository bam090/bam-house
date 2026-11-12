// 지형과 나무 배치가 정해 둔 조건을 지키는지 숫자로 검사하는 스크립트다.
// 실행 방법: node scripts/check-terrain.ts
import { coverTop, makePlants, treeTop } from '../src/scene/plants.ts'
import { POOL_DIG } from '../src/scene/walkable.ts'
import {
  BEACH_RISE,
  BEACH_WIDTH,
  PLATEAU_Y,
  SEA_LEVEL,
  beachWidthAt,
  distanceFromPlateau,
  inGardenFringe,
  inGroundCover,
  inHouseGarden,
  inViewCorridor,
  shoreDistance,
  shoreZ,
  terrainHeight,
} from '../src/scene/terrain.ts'

let failed = 0
function check(name: string, passed: boolean, detail: string) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}: ${detail}`)
  if (!passed) failed += 1
}

// 1. 집과 테라스가 놓인 자리는 평평해야 한다.
let uneven = 0
for (let x = -10; x <= 10; x += 1) {
  for (let z = -8; z <= 15; z += 1) {
    // 수영장 아래는 일부러 파 둔 자리라서 뺀다.
    const underPool = Math.abs(x) <= POOL_DIG.halfWidth && z >= POOL_DIG.minZ && z <= POOL_DIG.maxZ
    if (!underPool && terrainHeight(x, z) !== PLATEAU_Y) uneven += 1
  }
}
check('집과 테라스 자리가 평평함', uneven === 0, `높이가 다른 지점 ${uneven}개`)

// 1-2. 잔디 평지는 위에서 보면 반원이다. 집 뒤 가운데는 평지이고 뒤쪽 모서리는 평지 밖이어야 한다.
const halfCircle =
  distanceFromPlateau(0, -10) === 0 &&
  distanceFromPlateau(24, 14) === 0 &&
  distanceFromPlateau(20, -10) > 0 &&
  distanceFromPlateau(-20, -10) > 0
check('잔디 평지가 반원 모양', halfCircle, '뒤쪽 가운데는 안쪽이고 뒤쪽 모서리는 바깥쪽')

// 2. 테라스에 선 카메라에서 집 정면의 해변 110m 구간이 땅에 가려지지 않고 보여야 한다.
// 그 바깥은 곶과 구릉이 해변을 가려도 된다. 참고한 사진에서도 언덕이 해변의 끝을 가린다.
const EYE_HEIGHT = 1.7
let rays = 0
let blockedByGround = 0
for (const eyeX of [-8, 0, 8]) {
  for (let targetX = -60; targetX <= 50; targetX += 10) {
    rays += 1
    const eye = { x: eyeX, y: EYE_HEIGHT, z: 15 }
    const targetZ = shoreZ(targetX) - BEACH_WIDTH / 2
    const target = { x: targetX, y: terrainHeight(targetX, targetZ) + 0.2, z: targetZ }
    for (let step = 1; step < 200; step += 1) {
      const ratio = step / 200
      const x = eye.x + (target.x - eye.x) * ratio
      const z = eye.z + (target.z - eye.z) * ratio
      const lineY = eye.y + (target.y - eye.y) * ratio
      if (terrainHeight(x, z) > lineY) {
        blockedByGround += 1
        break
      }
    }
  }
}
check('테라스에서 해변이 땅에 가려지지 않음', blockedByGround === 0, `시선 ${rays}개 중 가려진 시선 ${blockedByGround}개`)

// 3. 사다리꼴 잔디 안에는 숲의 나무와 덤불이 없고 지피식물과 낮은 나무만 있어야 한다.
const { palms, bushes, trees, covers, lowTrees } = makePlants()
const inCorridor = (plant: { x: number; z: number }) => inViewCorridor(plant.x, plant.z) && plant.z > 15
const tallInCorridor = [...bushes, ...palms, ...trees].filter(inCorridor).length
check('사다리꼴 잔디에 숲의 나무와 덤불이 없음', tallInCorridor === 0, `잔디 안의 덤불과 야자수와 활엽수 ${tallInCorridor}개`)
const tallCovers = covers.filter((cover) => inCorridor(cover) && coverTop(cover) > EYE_HEIGHT - 0.5).length
check('지피식물이 눈높이보다 낮음', tallCovers === 0, `높은 지피식물 ${tallCovers}개`)
// 지피식물은 잔디 아래쪽 무리와 양옆 띠와 테라스 화단에만 있어야 한다. 잔디 가운데는 비어 있어야 한다.
const nearTerrace = (plant: { x: number; z: number }) => plant.z < 16.8 && Math.abs(plant.x) < 13.8
const coversOnLawn = covers.filter((cover) => inCorridor(cover) && !inGroundCover(cover.x, cover.z) && !nearTerrace(cover) && shoreDistance(cover.x, cover.z) > beachWidthAt(cover.x) + 5).length
const coversInDrift = covers.filter((cover) => inGroundCover(cover.x, cover.z)).length
check('지피식물이 무리와 띠에만 있음', coversOnLawn === 0 && coversInDrift >= 600, `무리와 띠 ${coversInDrift}개와 잔디 가운데 ${coversOnLawn}개`)
const bedCovers = covers.filter(nearTerrace).length
check('테라스 가장자리 화단', bedCovers >= 60, `화단 지피식물 ${bedCovers}개`)
// 낮은 나무는 지피식물 무리 안에 있고 꼭대기가 마당 높이보다 낮아야 바다 쪽 시야를 가리지 않는다.
const badLowTrees = lowTrees.filter((tree) => !inGroundCover(tree.x, tree.z) || treeTop(tree) > PLATEAU_Y).length
check('낮은 나무가 무리 안에 있고 마당보다 낮음', lowTrees.length >= 6 && badLowTrees === 0, `낮은 나무 ${lowTrees.length}그루 중 조건을 어긴 나무 ${badLowTrees}그루`)
const lowTreeHeights = lowTrees.map((tree) => treeTop(tree) - tree.y)
check('낮은 나무의 높이가 3m에서 4m', lowTreeHeights.every((height) => height >= 3 && height <= 4), lowTreeHeights.map((height) => height.toFixed(1)).join('m, ') + 'm')
// 집 오른쪽과 집 뒤편의 정원에 식물이 있어야 하고 왼쪽 잔디는 비어 있어야 한다.
const { gardenTrees } = makePlants()
const gardenPlants = [...covers, ...bushes, ...palms, ...gardenTrees].filter((plant) => inHouseGarden(plant.x, plant.z))
const behindHouse = gardenPlants.filter((plant) => plant.z < -6.3).length
// 왼쪽 반원 잔디는 가장자리만 채우고 안쪽은 비워 둔다.
const leftLawnPlants = [...covers, ...bushes, ...palms, ...trees].filter(
  (plant) =>
    distanceFromPlateau(plant.x, plant.z) === 0 &&
    plant.x > 13.8 &&
    plant.z < 14 &&
    !inGardenFringe(plant.x, plant.z),
).length
check(
  '집 오른쪽과 뒤편 정원',
  gardenPlants.length >= 300 && behindHouse >= 40 && gardenTrees.length >= 3 && leftLawnPlants === 0,
  `정원 식물 ${gardenPlants.length}개 중 집 뒤 ${behindHouse}개와 정원 나무 ${gardenTrees.length}그루와 왼쪽 잔디 식물 ${leftLawnPlants}개`,
)

// 사다리꼴은 마당 끝에서 폭 26m이고 모래사장 쪽에서 폭 60m다.
const nearWidth = [12.9, 13.1].map((x) => inViewCorridor(x, 14))
const farWidth = [29.5, 30.5].map((x) => inViewCorridor(x, 67))
check(
  '잔디가 사다리꼴 모양',
  nearWidth[0] && !nearWidth[1] && farWidth[0] && !farWidth[1],
  '마당 끝 폭 26m와 모래사장 쪽 폭 60m',
)
check(
  '식물 수',
  bushes.length >= 900 && palms.length >= 120 && trees.length >= 150,
  `덤불 ${bushes.length}개와 야자수 ${palms.length}개와 활엽수 ${trees.length}개와 지피식물 ${covers.length}개`,
)
// 오른쪽 옆(-x) 비탈에 숲이 있어야 한다.
const rightForest = [...palms, ...trees].filter((plant) => plant.x < 0 && plant.z > 14 && !inViewCorridor(plant.x, plant.z) && shoreDistance(plant.x, plant.z) > 0 && plant.x > -120).length
check('오른쪽 옆 비탈에 야자수와 활엽수 숲', rightForest >= 60, `${rightForest}그루`)

// 4. 해변의 폭이 일정한 범위에 있어야 한다.
// 해변 뒤쪽 끝의 높이보다 낮고 수면보다 높은 땅을 해변으로 센다.
const beachTop = SEA_LEVEL + 0.1 + BEACH_WIDTH * BEACH_RISE + 0.05
let minWidth = Infinity
let maxWidth = 0
for (let x = -100; x <= 40; x += 5) {
  let width = 0
  for (let offset = 0; offset < 80; offset += 0.5) {
    const height = terrainHeight(x, shoreZ(x) - offset)
    if (height > SEA_LEVEL && height < beachTop) width += 0.5
  }
  minWidth = Math.min(minWidth, width)
  maxWidth = Math.max(maxWidth, width)
}
check('해변 폭이 30m에서 40m 사이', minWidth >= 30 && maxWidth <= 40, `최소 ${minWidth}m 최대 ${maxWidth}m`)

// 4-2. 집에서 바다를 볼 때 왼쪽 끝 숲 언덕 앞에서는 해변이 끝나야 한다.
let sandAtForest = 0
for (let x = 100; x <= 200; x += 5) {
  if (beachWidthAt(x) > 0.01) sandAtForest += 1
  // 물가에서 5m 들어간 땅이 해변 높이보다 높아야 비탈이 바로 물로 들어간 것이다.
  if (terrainHeight(x, shoreZ(x) - 5) < SEA_LEVEL + 0.3) sandAtForest += 1
}
check('왼쪽 끝 숲 언덕 앞에 모래사장이 없음', sandAtForest === 0, `모래가 남은 지점 ${sandAtForest}개`)

// 5. 물가에서 6m 나간 곳은 수면보다 1m 이상 깊어야 한다. 얕으면 수면과 겹쳐 깜빡인다.
let shallow = 0
for (let x = -250; x <= 190; x += 5) {
  if (terrainHeight(x, shoreZ(x) + 6) > SEA_LEVEL - 1) shallow += 1
}
check('물속 땅이 수면과 겹치지 않음', shallow === 0, `얕은 지점 ${shallow}개`)

// 6. 마당 끝이 둥글게 휘어야 한다. 잔디 띠에서 비탈로 넘어가는 동안 기울기가 한 번에 크게 바뀌면 안 된다.
let sharpestTurn = 0
for (let x = -12; x <= 12; x += 2) {
  for (let z = 14; z < 22; z += 0.25) {
    const before = terrainHeight(x, z) - terrainHeight(x, z - 0.25)
    const after = terrainHeight(x, z + 0.25) - terrainHeight(x, z)
    sharpestTurn = Math.max(sharpestTurn, Math.abs(after - before) / 0.25)
  }
}
check('마당 끝이 둥글게 휨', sharpestTurn < 0.5, `25cm마다 바뀐 기울기의 최댓값 ${sharpestTurn.toFixed(2)}`)

// 6-2. 집 정면의 비탈 길이가 약 50m여야 한다. 마당 끝(z 15)에서 해변 뒤쪽까지 잰다.
const beachBackZ = shoreZ(0) - beachWidthAt(0)
const slopeLength = beachBackZ - 18
check('집 정면의 비탈 길이가 약 50m', Math.abs(slopeLength - 50) < 1, `${slopeLength.toFixed(1)}m`)

// 7. 마당에서 해변까지의 높이 차이
const drop = PLATEAU_Y - (SEA_LEVEL + 0.1)
check('마당과 물가의 높이 차이가 약 15m', drop > 14.5 && drop < 15.5, `${drop.toFixed(1)}m`)

if (failed > 0) {
  console.log(`\n실패한 검사 ${failed}개`)
  process.exit(1)
}
console.log('\n모든 검사 통과')
