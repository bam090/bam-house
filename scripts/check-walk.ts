// 걷기 규칙이 정해 둔 조건을 지키는지 숫자로 검사하는 스크립트다.
// 실행 방법: node scripts/check-walk.ts
// 주요 지점의 바닥 높이와 지나갈 수 없는 자리를 보고 고양이를 실제 계산과 같은 순서로 움직여서 점프 길을 확인한다.
import { DECK_HEIGHT, FLOOR_HEIGHT, POOL_WATER, groundHeight, isWalkable, resolveMove } from '../src/scene/walkable.ts'

// Player.tsx와 같은 값이다. 그 파일의 값을 바꾸면 여기도 함께 바꾼다.
const SPEED = 4
const JUMP_SPEED = 4.6
const GRAVITY = 14
/** 한 화면의 시간. 1초에 60번 그리는 화면을 기준으로 한다. */
const FRAME = 1 / 60

let failed = 0
function check(name: string, passed: boolean, detail: string) {
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}: ${detail}`)
  if (!passed) failed += 1
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.001
/** 거실 바닥의 장면 높이 */
const FLOOR = DECK_HEIGHT + FLOOR_HEIGHT

// 1. 주요 지점의 바닥 높이. 집 안 물건은 방바닥에서 잰 높이로 적는다.
const heights: [string, number, number, number][] = [
  ['데크', 7, 13, DECK_HEIGHT],
  ['거실 바닥', 0, 3, FLOOR],
  ['침실 바닥', 9, 2.5, FLOOR],
  ['욕실 바닥', 9.5, -3, FLOOR],
  ['변기 칸 바닥', 9.5, -7, FLOOR],
  ['거실 계단 맨 위 단', 0, 6.2, DECK_HEIGHT + 0.72],
  ['거실 계단 맨 아래 단', 0, 7.4, DECK_HEIGHT + 0.18],
  ['아일랜드 의자', -4.75, 1.5, FLOOR + 0.5],
  ['아일랜드 식탁', -5.5, 2, FLOOR + 0.95],
  ['조리대', -7.4, 1.2, FLOOR + 0.95],
  ['주방 수전 꼭대기', -7.5, 0.5, FLOOR + 1.45],
  ['냉장고 위', -7.3, -0.4, FLOOR + 2.25],
  ['소파 방석', 1.5, 0.7, FLOOR + 0.45],
  ['소파 등받이', 1.5, 1.3, FLOOR + 0.85],
  ['소파 안쪽 러그', 1.5, 0.2, FLOOR],
  ['통나무 탁자', 1.5, -0.85, FLOOR + 0.35],
  ['TV 아래 수납장', 1.5, -5.5, FLOOR + 0.7],
  ['침대', 11.4, 0.5, FLOOR + 0.5],
  ['협탁', 10.05, -0.5, FLOOR + 0.45],
  ['안락의자', 8.9, 4.6, FLOOR + 0.42],
  ['욕조 돌 턱', 12.4, -4.3, FLOOR + 0.55],
  ['세면대', 7.6, -4, FLOOR + 0.9],
  ['나무 스툴', 10.5, -4.6, FLOOR + 0.45],
  ['변기', 7.6, -7.7, FLOOR + 0.45],
  ['손 씻는 대', 9.2, -8, FLOOR + 0.85],
  ['수영장 테두리', 0, 8.35, DECK_HEIGHT + 0.3],
  ['선베드', 5.55, 10, DECK_HEIGHT + 0.47],
  ['데크 돌 벤치', -7.4, 13.3, DECK_HEIGHT + 0.55],
  ['계단 옆 화단', -7.3, 7, DECK_HEIGHT + 0.6],
]
const wrongHeights = heights.filter(([, x, z, expected]) => !near(groundHeight(x, z), expected))
check(
  '주요 지점의 바닥 높이',
  wrongHeights.length === 0,
  wrongHeights.length === 0
    ? `${heights.length}곳이 모두 맞음`
    : wrongHeights.map(([name, x, z, expected]) => `${name} ${groundHeight(x, z).toFixed(2)}(기대 ${expected.toFixed(2)})`).join(', '),
)

// 2. 지나갈 수 없는 자리와 지나갈 수 있는 자리
const blocked: [string, number, number][] = [
  ['수영장 물', 0, 10],
  ['수영장 물 가장자리', POOL_WATER.minX + 0.05, 9],
  ['욕조 안쪽 물', 12.4, -5],
  ['샤워 칸 유리 칸막이', 13, -2.9],
  ['변기 칸 가림벽', 8.5, -7.5],
  ['카바나 기둥', -4.45, 10.65],
  ['거실 오른쪽 유리문 바깥', -8.2, 3],
  ['거실과 침실 사이 벽', 7, 0],
  ['변기 칸 미닫이문이 가린 쪽', 9.4, -6],
  ['뒤쪽 벽 바깥', 0, -6.2],
]
const open: [string, number, number][] = [
  ['거실과 침실 사이 문 자리', 7, 3],
  ['침실과 욕실 사이 문 자리', 8.4, -1],
  ['변기 칸 문의 열린 쪽', 9.9, -6],
  ['변기 앞', 7.9, -7.2],
  ['샤워 칸 안', 13, -2],
  ['카바나 아래', -7.2, 10.3],
]
const wrongBlocked = blocked.filter(([, x, z]) => isWalkable(x, z)).map(([name]) => name)
const wrongOpen = open.filter(([, x, z]) => !isWalkable(x, z)).map(([name]) => name)
check('지나갈 수 없는 자리', wrongBlocked.length === 0, wrongBlocked.length === 0 ? `${blocked.length}곳이 모두 막힘` : `뚫린 곳: ${wrongBlocked.join(', ')}`)
check('지나갈 수 있는 자리', wrongOpen.length === 0, wrongOpen.length === 0 ? `${open.length}곳이 모두 열림` : `막힌 곳: ${wrongOpen.join(', ')}`)

// 고양이의 자리와 발 높이와 위아래 속도
interface Cat {
  x: number
  z: number
  y: number
  speed: number
}

// 한 화면만큼 움직인다. Player.tsx의 useFrame과 같은 순서로 계산한다.
function frame(cat: Cat, directionX: number, directionZ: number, jump: boolean) {
  const length = Math.hypot(directionX, directionZ)
  if (length > 0) {
    const stepX = (directionX / length) * SPEED * FRAME
    const stepZ = (directionZ / length) * SPEED * FRAME
    const [nextX, nextZ] = resolveMove(cat.x, cat.z, cat.x + stepX, cat.z + stepZ, cat.y)
    cat.x = nextX
    cat.z = nextZ
  }
  const floor = groundHeight(cat.x, cat.z)
  if (cat.y < floor) {
    cat.y = floor
    cat.speed = 0
  }
  const grounded = cat.y <= floor
  if (grounded && jump) cat.speed = JUMP_SPEED
  if (!grounded || cat.speed > 0) {
    cat.speed -= GRAVITY * FRAME
    cat.y = Math.max(floor, cat.y + cat.speed * FRAME)
    if (cat.y === floor) cat.speed = 0
  }
}

// 목표 자리를 향해 간다. jump가 true면 출발할 때 한 번 점프한다. 도착한 뒤에는 바닥에 내려설 때까지 기다린다.
function go(cat: Cat, targetX: number, targetZ: number, jump: boolean) {
  for (let count = 0; count < 180; count += 1) {
    const distance = Math.hypot(targetX - cat.x, targetZ - cat.z)
    const arrived = distance < SPEED * FRAME
    if (arrived && cat.y <= groundHeight(cat.x, cat.z)) return
    if (arrived) frame(cat, 0, 0, false)
    else frame(cat, targetX - cat.x, targetZ - cat.z, jump && count === 0)
  }
}

// 3. 꼭 되어야 하는 점프 길
const cat: Cat = { x: -4.2, z: 1.5, y: FLOOR, speed: 0 }
const route: [string, number, number, boolean, number][] = [
  ['아일랜드 의자', -4.75, 1.5, true, 0.5],
  ['아일랜드 식탁', -5.5, 1.5, true, 0.95],
  ['식탁 위를 걸어서 이동', -5.5, 1.2, false, 0.95],
  ['조리대', -7.4, 1.2, true, 0.95],
  ['수전 꼭대기', -7.5, 0.5, true, 1.45],
  ['냉장고 위', -7.3, -0.4, true, 2.25],
]
const routeLog: string[] = []
let routePassed = true
for (const [name, x, z, jump, top] of route) {
  go(cat, x, z, jump)
  const arrived = Math.hypot(x - cat.x, z - cat.z) < 0.1 && near(cat.y, FLOOR + top)
  routeLog.push(`${name} ${arrived ? '도착' : `실패(높이 ${(cat.y - FLOOR).toFixed(2)})`}`)
  if (!arrived) routePassed = false
}
check('거실 바닥에서 냉장고 위까지 점프 길', routePassed, routeLog.join(' → '))

// 4. 바닥에서 바로 오를 수 없어야 하는 곳
const direct: [string, number, number, number, number][] = [
  ['바닥에서 조리대', -6.6, 1.2, -7.4, 1.2],
  ['바닥에서 아일랜드 식탁', -4.6, 2.3, -5.5, 2.3],
  ['바닥에서 냉장고 위', -6.4, -0.4, -7.3, -0.4],
]
const climbed = direct.filter(([, fromX, fromZ, toX, toZ]) => {
  const jumper: Cat = { x: fromX, z: fromZ, y: FLOOR, speed: 0 }
  go(jumper, toX, toZ, true)
  return jumper.y > FLOOR + 0.001
})
check('바닥에서 바로 오를 수 없는 곳', climbed.length === 0, climbed.length === 0 ? `${direct.length}곳이 모두 막힘` : `올라간 곳: ${climbed.map(([name]) => name).join(', ')}`)

// 5. 계단은 점프 없이 걸어서 오르내린다.
const walker: Cat = { x: -5.5, z: 9, y: DECK_HEIGHT, speed: 0 }
go(walker, -5.5, 5, false)
const wentUp = near(walker.y, FLOOR) && walker.z < 5.1
go(walker, -5.5, 9, false)
const wentDown = near(walker.y, DECK_HEIGHT) && walker.z > 8.9
check('계단을 걸어서 오르내림', wentUp && wentDown, `오르기는 ${wentUp ? '성공' : '실패'}이고 내려오기는 ${wentDown ? '성공' : '실패'}`)

// 6. 화단(0.6m)은 걸어서는 오르지 못하고 점프로 오른다.
const stroller: Cat = { x: -7.3, z: 8.2, y: DECK_HEIGHT, speed: 0 }
go(stroller, -7.3, 7, false)
const stayedDown = near(stroller.y, DECK_HEIGHT)
go(stroller, -7.3, 7, true)
const jumpedUp = near(stroller.y, DECK_HEIGHT + 0.6)
check('화단은 점프로만 오름', stayedDown && jumpedUp, `걸어서 ${stayedDown ? '못 오름' : '올라감'}과 점프로 ${jumpedUp ? '오름' : '못 오름'}`)

console.log(failed === 0 ? '\n모든 검사 통과' : `\n실패한 검사 ${failed}개`)
process.exit(failed === 0 ? 0 : 1)
