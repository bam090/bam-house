// 걷기 규칙이 정해 둔 조건을 지키는지 숫자로 검사하는 스크립트다.
// 실행 방법: node scripts/check-walk.ts
// 주요 지점의 바닥 높이와 지나갈 수 없는 자리를 보고 고양이를 실제 계산과 같은 순서로 움직여서 점프 길을 확인한다.
import { BODY, CAT_TALL, DECK_HEIGHT, FLOOR_HEIGHT, POOL_WATER, ceilingHeight, floatingHeight, groundHeight, isWalkable, resolveMove } from '../src/scene/walkable.ts'

// Player.tsx와 같은 값이다. 그 파일의 값을 바꾸면 여기도 함께 바꾼다.
const SPEED = 4
const JUMP_SPEED = 4.6
const GRAVITY = 14
/** 한 화면의 시간. 처음에는 1초에 60번 그리는 화면을 기준으로 한다. 느린 화면을 검사할 때 바꾼다. */
let FRAME = 1 / 60

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
  ['TV 아래 낮은 장', 1.5, -5.2, FLOOR + 0.7],
  ['통유리창 앞 바닥', -6, -5.4, FLOOR],
  ['침대', 11.4, 0.5, FLOOR + 0.5],
  ['협탁', 10.05, -0.5, FLOOR + 0.45],
  ['안락의자', 10.6, 4.8, FLOOR + 0.42],
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
  ['뒤쪽 벽 바깥', 0, -6.2],
  ['아치 벽', 0, -5.5],
  ['통유리창 바깥', -6, -6.2],
]
const open: [string, number, number][] = [
  ['거실과 침실 사이 문 자리', 7, 3],
  ['침실과 욕실 사이 문 자리', 8.4, -1],
  ['변기 칸 문의 열린 쪽', 9.9, -6],
  ['변기 칸 문의 왼쪽 끝', 9.3, -6],
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
  const floor = groundHeight(cat.x, cat.z, cat.y, cat.speed > 0)
  if (cat.y < floor) {
    cat.y = floor
    cat.speed = 0
  }
  const grounded = cat.y <= floor
  if (grounded && jump) cat.speed = JUMP_SPEED
  if (!grounded || cat.speed > 0) {
    const speedBefore = cat.speed
    cat.speed -= GRAVITY * FRAME
    cat.y = Math.max(floor, cat.y + ((speedBefore + cat.speed) / 2) * FRAME)
    if (cat.y === floor) cat.speed = 0
    const headLimit = ceilingHeight(cat.x, cat.z) - CAT_TALL
    if (cat.y > headLimit) {
      cat.y = Math.max(floor, headLimit)
      cat.speed = Math.min(cat.speed, 0)
    }
  }
}

// 목표 자리를 향해 간다. jump가 true면 출발할 때 한 번 점프한다. 도착한 뒤에는 바닥에 내려설 때까지 기다린다.
function go(cat: Cat, targetX: number, targetZ: number, jump: boolean) {
  for (let count = 0; count < 180; count += 1) {
    const distance = Math.hypot(targetX - cat.x, targetZ - cat.z)
    const arrived = distance < SPEED * FRAME
    // 발이 바닥 높이와 같아졌을 때가 내려선 때다. 발판에 막 닿은 화면에서는 발이 아직 발판보다 조금 낮다.
    if (arrived && near(cat.y, groundHeight(cat.x, cat.z, cat.y))) return
    if (arrived) frame(cat, 0, 0, false)
    else frame(cat, targetX - cat.x, targetZ - cat.z, jump && count === 0)
  }
}

// 3. 꼭 되어야 하는 점프 길
const route: [string, number, number, boolean, number][] = [
  ['아일랜드 의자', -4.75, 1.5, true, 0.5],
  ['아일랜드 식탁', -5.5, 1.5, true, 0.95],
  ['식탁 위를 걸어서 이동', -5.5, 1.2, false, 0.95],
  ['조리대', -7.4, 1.2, true, 0.95],
  ['수전 꼭대기', -7.5, 0.5, true, 1.45],
  ['냉장고 위', -7.3, -0.4, true, 2.25],
]
// 화면이 느리게 그려지는 기기에서도 되는지 1초에 60번과 30번과 20번으로 각각 확인한다.
for (const rate of [60, 30, 20]) {
  FRAME = 1 / rate
  const cat: Cat = { x: -4.2, z: 1.5, y: FLOOR, speed: 0 }
  const routeLog: string[] = []
  let routePassed = true
  for (const [name, x, z, jump, top] of route) {
    go(cat, x, z, jump)
    const arrived = Math.hypot(x - cat.x, z - cat.z) < 0.25 && near(cat.y, FLOOR + top)
    routeLog.push(`${name} ${arrived ? '도착' : `실패(높이 ${(cat.y - FLOOR).toFixed(2)})`}`)
    if (!arrived) routePassed = false
  }
  check(`거실 바닥에서 냉장고 위까지 점프 길(1초에 ${rate}번)`, routePassed, routeLog.join(' → '))
}
FRAME = 1 / 60

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
const stroller: Cat = { x: -7.2, z: 8, y: DECK_HEIGHT, speed: 0 }
go(stroller, -7.2, 7, false)
const stayedDown = near(stroller.y, DECK_HEIGHT)
go(stroller, -7.2, 7, true)
const jumpedUp = near(stroller.y, DECK_HEIGHT + 0.6)
check('화단은 점프로만 오름', stayedDown && jumpedUp, `걸어서 ${stayedDown ? '못 오름' : '올라감'}과 점프로 ${jumpedUp ? '오름' : '못 오름'}`)

// 7. 오르지 못하는 가구 앞에서는 몸 폭만큼 떨어져서 멈춘다. 가구 속으로 파묻히지 않는다.
const pusher: Cat = { x: -4.2, z: 2.3, y: FLOOR, speed: 0 }
go(pusher, -5.5, 2.3, false)
const gap = pusher.x - -5.1
check('가구 속으로 파묻히지 않음', gap >= BODY - 0.001 && gap < BODY + 0.1, `아일랜드 식탁 옆면에서 ${gap.toFixed(2)}m 떨어져 멈춤`)

// 8. 좁은 의자(0.4m) 위에서 멈춰 설 수 있다. 의자 쪽으로 계속 가도 식탁에 막혀 의자 위에 남는다.
const sitter: Cat = { x: -4.2, z: 1.5, y: FLOOR, speed: 0 }
go(sitter, -5.5, 1.5, true)
check('의자로 뛰면 의자 위에 섬', near(sitter.y, FLOOR + 0.5), `높이 ${(sitter.y - FLOOR).toFixed(2)}m`)

// 9. 떠 있는 발판은 발이 그 높이까지 올라왔을 때만 받친다. 아래에 서 있을 때는 없는 것으로 본다.
// 실제 발판 자리는 4단계에서 넣는다. 여기서는 거실 가운데에 높이 1m 발판 하나를 가정해서 계산만 확인한다.
const shelf = [{ minX: -0.3, maxX: 0.3, minZ: 2.7, maxZ: 3.3, top: FLOOR_HEIGHT + 1 }]
const shelfTop = FLOOR + 1
const under = floatingHeight(0, 3, FLOOR, shelf)
const almost = floatingHeight(0, 3, shelfTop - 0.09, shelf)
const tooLow = floatingHeight(0, 3, shelfTop - 0.2, shelf)
const above = floatingHeight(0, 3, shelfTop + 0.5, shelf)
const beside = floatingHeight(0.6, 3, shelfTop, shelf)
check(
  '떠 있는 발판은 발 아래에 있을 때만 받침',
  under === -Infinity && tooLow === -Infinity && beside === -Infinity && near(almost, shelfTop) && near(above, shelfTop),
  '아래와 옆에서는 받치지 않고 0.1m 안으로 올라오거나 위에 있으면 받침',
)

// 제자리에서 한 번 뛰고 내려설 때까지 기다린다.
function hop(cat: Cat) {
  frame(cat, 0, 0, true)
  for (let count = 0; count < 120 && !near(cat.y, groundHeight(cat.x, cat.z, cat.y)); count += 1) frame(cat, 0, 0, false)
}

// 길을 따라가면서 자리마다 기대한 높이에 섰는지 기록한다. 높이는 방바닥에서 잰 값이다.
function follow(cat: Cat, legs: [string, number, number, boolean, number][]) {
  const log: string[] = []
  let passed = true
  for (const [name, x, z, jump, top] of legs) {
    go(cat, x, z, jump)
    const arrived = Math.hypot(x - cat.x, z - cat.z) < 0.25 && near(cat.y, FLOOR + top)
    log.push(`${name} ${arrived ? '도착' : `실패(높이 ${(cat.y - FLOOR).toFixed(2)})`}`)
    if (!arrived) passed = false
  }
  return { passed, detail: log.join(' → ') }
}

// 10. 캣폴 옆에서 제자리 점프 네 번으로 맨 위 숨숨집(2.5m)까지 오른다. 거기서 한 번 더 뛰어 캣워크에 올라 곡선 책장 위까지 간다.
const climber: Cat = { x: -5, z: -4.85, y: FLOOR, speed: 0 }
const poleTops: number[] = []
for (let count = 0; count < 4; count += 1) {
  hop(climber)
  poleTops.push(climber.y - FLOOR)
}
const poleOk = [0.7, 1.35, 2, 2.5].every((top, index) => Math.abs(poleTops[index] - top) < 0.001)
check('캣폴을 제자리 점프로 오름', poleOk, `발판 높이 ${poleTops.map((top) => top.toFixed(1)).join(', ')}`)
const catwalk = follow(climber, [
  ['숨숨집에서 뛰어 캣워크로', -3.6, -5.1, true, 2.8],
  ['TV 위', 1.5, -5.1, false, 2.8],
  ['뒤쪽 모서리', 6.5, -5.1, false, 2.8],
  ['곡선 책장 위', 6.55, -1.2, false, 2.8],
])
check('캣폴에서 캣워크를 지나 곡선 책장 위까지', catwalk.passed, catwalk.detail)

// 10-1. 캣폴 옆에서 스페이스바를 0.3초 동안 누르고 있어도 첫 발판(0.7m)보다 높이 올라가지 않는다.
// 올라가는 중에 발판에 닿자마자 다시 점프가 되면 한 번에 여러 발판을 뛰어오른다.
const holder: Cat = { x: -5, z: -4.85, y: FLOOR, speed: 0 }
let holderTop = 0
for (let count = 0; count < 18; count += 1) {
  frame(holder, 0, 0, true)
  holderTop = Math.max(holderTop, holder.y - FLOOR)
}
check('캣폴에서 점프가 이어 붙지 않음', holderTop < 0.8, `0.3초 동안 가장 높이 올라간 발 높이 ${holderTop.toFixed(2)}m`)

// 10-2. 거실 캣워크 위에서 점프해도 귀가 천장을 넘지 않는다.
const jumper: Cat = { x: 1.5, z: -5.2, y: FLOOR + 2.8, speed: 0 }
let jumperTop = 0
frame(jumper, 0, 0, true)
for (let count = 0; count < 60; count += 1) {
  frame(jumper, 0, 0, false)
  jumperTop = Math.max(jumperTop, jumper.y - FLOOR)
}
check('캣워크에서 점프해도 천장 아래', jumperTop + 0.64 <= 3.5 && near(jumper.y, FLOOR + 2.8), `귀 높이 ${(jumperTop + 0.64).toFixed(2)}m이고 다시 캣워크에 내려섬`)

// 11. 캣워크 아래는 그대로 걸을 수 있다. 머리 위의 발판은 바닥으로 치지 않는다.
const underBack = groundHeight(-5.8, -5.2, FLOOR)
const underSide = groundHeight(6.5, -4, FLOOR)
const onConsole = groundHeight(0, -5.1, FLOOR + 0.7)
check(
  '캣워크 아래 바닥과 낮은 장',
  near(underBack, FLOOR) && near(underSide, FLOOR) && near(onConsole, FLOOR + 0.7),
  `통유리창 앞 ${(underBack - FLOOR).toFixed(2)}m와 왼쪽 벽 앞 ${(underSide - FLOOR).toFixed(2)}m와 낮은 장 ${(onConsole - FLOOR).toFixed(2)}m`,
)

// 12. 통나무 스툴 둘을 밟고 벽 통로를 지나 침실 바닥까지 간다.
const visitor: Cat = { x: 6, z: -0.7, y: FLOOR, speed: 0 }
const passage = follow(visitor, [
  ['낮은 스툴', 6.5, -0.7, true, 0.4],
  ['높은 스툴', 6.5, -0.1, true, 0.75],
  ['통로', 7, 0.7, true, 1.1],
  ['침실 쪽 디딤판', 7.45, 0.7, false, 1.1],
  ['침실 바닥', 8.4, 0.7, false, 0],
])
check('스툴을 밟고 벽 통로로 침실까지', passage.passed, passage.detail)

// 13. 물결 스크래처에서도 통로로 오를 수 있고 바닥에서는 통로를 지나가지 못한다.
const scratcher: Cat = { x: 6, z: 0.8, y: FLOOR, speed: 0 }
const fromScratcher = follow(scratcher, [
  ['물결 스크래처', 6.5, 0.8, true, 0.35],
  ['통로', 7, 0.7, true, 1.1],
])
const crawler: Cat = { x: 6.3, z: 0.7, y: FLOOR, speed: 0 }
go(crawler, 7.6, 0.7, false)
const stoppedByWall = crawler.x < 6.9
check('스크래처에서는 오르고 바닥에서는 못 지나감', fromScratcher.passed && stoppedByWall, `${fromScratcher.detail}. 바닥에서는 x ${crawler.x.toFixed(2)}에서 멈춤`)

// 14. 침실 쪽 디딤판에서 계단 선반 둘을 밟고 침실 캣워크 끝까지 간다. 침실 바닥에서 디딤 상자로도 올라온다.
const sleeper: Cat = { x: 8.2, z: 1.15, y: FLOOR, speed: 0 }
const bedroomWalk = follow(sleeper, [
  ['디딤 상자', 7.75, 1.15, true, 0.6],
  ['디딤판', 7.5, 0.8, true, 1.1],
  ['계단 선반 1.7m', 7.45, -0.1, true, 1.7],
  ['계단 선반 2.3m', 7.5, -0.55, true, 2.3],
  ['침실 캣워크', 8.2, -0.55, true, 2.6],
  ['캣워크 끝', 12.7, -0.55, false, 2.6],
])
check('침실 디딤에서 침실 캣워크 끝까지', bedroomWalk.passed, bedroomWalk.detail)

console.log(failed === 0 ? '\n모든 검사 통과' : `\n실패한 검사 ${failed}개`)
process.exit(failed === 0 ? 0 : 1)
