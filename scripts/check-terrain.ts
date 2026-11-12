// 지형과 나무 배치가 정해 둔 조건을 지키는지 숫자로 검사하는 스크립트다.
// 실행 방법: node scripts/check-terrain.ts
import { bushTop, makePlants, palmTop } from '../src/scene/plants.ts'
import {
  BEACH_WIDTH,
  PLATEAU_Y,
  SEA_LEVEL,
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
    if (terrainHeight(x, z) !== PLATEAU_Y) uneven += 1
  }
}
check('집과 테라스 자리가 평평함', uneven === 0, `높이가 다른 지점 ${uneven}개`)

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

// 3. 테라스 앞쪽의 풀과 나무는 꼭대기가 눈높이보다 낮아야 한다.
const { palms, bushes } = makePlants()
const inFront = (plant: { x: number; z: number }) => plant.z > 17 && plant.x > -60 && plant.x < 50 && plant.z < shoreZ(plant.x)
const tallBushes = bushes.filter((bush) => inFront(bush) && bushTop(bush) > EYE_HEIGHT - 0.5).length
const tallPalms = palms.filter((palm) => inFront(palm) && palmTop(palm) > EYE_HEIGHT - 0.5).length
check('테라스 앞쪽 식물이 눈높이보다 낮음', tallBushes + tallPalms === 0, `높은 덤불 ${tallBushes}개와 높은 야자수 ${tallPalms}개`)
check('식물 수', bushes.length >= 900 && palms.length >= 120, `덤불 ${bushes.length}개와 야자수 ${palms.length}개`)
const frontBushes = bushes.filter(inFront).length
check('테라스 앞쪽 비탈이 풀로 덮임', frontBushes >= 120, `앞쪽 덤불 ${frontBushes}개`)

// 4. 해변의 폭이 일정한 범위에 있어야 한다.
let minWidth = Infinity
let maxWidth = 0
for (let x = -100; x <= 60; x += 5) {
  let width = 0
  for (let offset = 0; offset < 60; offset += 0.5) {
    const height = terrainHeight(x, shoreZ(x) - offset)
    if (height > SEA_LEVEL && height < SEA_LEVEL + 1.75) width += 0.5
  }
  minWidth = Math.min(minWidth, width)
  maxWidth = Math.max(maxWidth, width)
}
check('해변 폭이 18m에서 30m 사이', minWidth >= 18 && maxWidth <= 30, `최소 ${minWidth}m 최대 ${maxWidth}m`)

// 5. 물가에서 6m 나간 곳은 수면보다 1m 이상 깊어야 한다. 얕으면 수면과 겹쳐 깜빡인다.
let shallow = 0
for (let x = -250; x <= 190; x += 5) {
  if (terrainHeight(x, shoreZ(x) + 6) > SEA_LEVEL - 1) shallow += 1
}
check('물속 땅이 수면과 겹치지 않음', shallow === 0, `얕은 지점 ${shallow}개`)

// 6. 마당에서 해변까지의 높이 차이
const drop = PLATEAU_Y - (SEA_LEVEL + 0.1)
check('마당과 물가의 높이 차이가 12m 이상', drop >= 12, `${drop.toFixed(1)}m`)

if (failed > 0) {
  console.log(`\n실패한 검사 ${failed}개`)
  process.exit(1)
}
console.log('\n모든 검사 통과')
