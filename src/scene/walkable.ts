// 고양이가 걸을 수 있는 범위와 바닥 높이를 계산하는 파일이다.
// 물리 엔진을 쓰지 않고 좌표가 어느 사각형 안에 있는지만 검사한다.
// 벽과 유리와 기둥과 물은 지나갈 수 없고 가구와 화단은 윗면 높이가 있는 바닥이다.
// 자리와 높이는 docs/house-spec.md와 같다. 가구를 옮기면 이 파일의 숫자도 함께 고친다.

interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** 집 안의 방 배치. 집의 중심이 원점이고 바다는 +z 방향이다. */
// 집에서 바다를 볼 때 왼쪽이 +x이고 오른쪽이 -x다.
export const HOUSE = {
  /** 집 전체의 범위. 거실과 침실과 욕실을 모두 합친 것이다. */
  minX: -8,
  maxX: 14,
  minZ: -6,
  maxZ: 6,
  /** 거실과 침실 쪽 날개를 나누는 칸막이 벽의 x 좌표 */
  wingX: 7,
  /** 침실과 욕실을 나누는 칸막이 벽의 z 좌표. 이 값보다 z가 크면 침실이다. */
  bathZ: -1,
  /** 거실과 침실 사이 문 자리의 z 범위 */
  bedroomDoor: { minZ: 1.5, maxZ: 4.5 },
  /** 침실과 욕실 사이 문 자리의 x 범위 */
  bathDoor: { minX: 7.6, maxX: 9.2 },
  /** 주방 영역. 거실 오른쪽 앞에 있고 벽으로 막지 않는다. */
  kitchen: { minX: -8, maxX: -4, minZ: -1, maxZ: 6 },
  /** 욕실 뒤에 붙은 변기 칸. 오른쪽 벽이 욕실 오른쪽 벽과 한 줄이다. */
  toilet: { minX: 7, maxX: 11, minZ: -8.5, maxZ: -6 },
  /** 욕실과 변기 칸 사이 문 자리의 x 범위 */
  toiletDoor: { minX: 9.2, maxX: 10.1 },
} as const

/** 거실과 침실 사이 문의 높이. House.tsx의 문 위쪽 벽과 같은 값이다. */
export const DOOR_HEIGHT = 2.7
/** 욕실 문과 변기 칸 문의 높이 */
export const LOW_DOOR_HEIGHT = 2.4

/** 거실 바닥에서 천장까지의 높이 */
export const CEILING_HEIGHT = 3.5

/** 식물을 심지 않는 자리. 침실과 욕실과 욕실 옆 돌 벽 뜰이 첫째이고 변기 칸이 둘째다. */
export const PLANT_KEEP_OUT: Rect[] = [
  { minX: 7, maxX: 16.1, minZ: -6.8, maxZ: 6.15 },
  { minX: 6.55, maxX: 11.45, minZ: -8.95, maxZ: -6 },
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
  stepDepth: 0.4,
  /** 계단의 단 수. 높이 차이를 이 수로 나눈 만큼씩 내려간다. */
  risers: 5,
  /** 계단의 x 범위. 양 끝은 돌 화단이 막고 있다. */
  minX: -6.6,
  maxX: 5.6,
} as const

/** 계단 한 단의 높이 */
export const STEP_HEIGHT = FLOOR_HEIGHT / STAIRS.risers

/** 바닥에 놓인 계단 판의 수. 맨 아래 단은 데크 바닥이라서 판이 하나 적다. */
export const STEP_COUNT = STAIRS.risers - 1

/** 계단이 끝나는 z 좌표 */
export const STAIRS_END_Z = STAIRS.startZ + STAIRS.stepDepth * STEP_COUNT

/** 초승달 소파. 중심에서 잰 반지름과 각도(도)다. 휜 안쪽이 TV(-z)를 향한다. */
export const SOFA = { x: 1.5, z: -1.6, inner: 2.05, outer: 3.0, from: 35, to: 145 } as const

/** 1인용 소파. 초승달 소파의 -x 쪽 끝 옆이다. */
// 초승달 소파가 그리는 원(가운데 SOFA.x와 SOFA.z) 위의 168도 자리에 놓고 원의 가운데를 보게 돌린다.
// 그래서 초승달 소파가 한 자리 더 이어진 것처럼 보인다. turn은 y축으로 도는 각도다.
export const SINGLE_SOFA = { x: -1.0, z: -1.07, turn: -1.36 } as const

/** 거실 캣워크 끝과 벽 통로를 잇는 곡선 디딤 선반. 침실 쪽 벽(x 7)의 거실 면에 붙는다. */
// 높은 쪽(highTop)에서 평평하게 시작해서 curveFrom부터 curveTo까지 S자로 내려와 낮은 쪽(lowTop)에서 평평하게 끝난다.
// 높은 쪽은 곡선 책장 끝(z -1.1)에서 0.35m 떨어뜨렸다. 낮은 쪽은 통로 위쪽 벽(1.85m)에 몸이 걸리지 않는 높이다.
export const CAT_RAMP = {
  minX: 6.525,
  maxX: 6.875,
  fromZ: -0.75,
  toZ: 0.3,
  curveFrom: -0.5,
  curveTo: 0.15,
  highTop: 1.75,
  lowTop: 1.3,
} as const

/** 곡선 디딤 선반의 z 자리에서 윗면 높이. 방바닥에서 잰다. */
export function rampTop(z: number) {
  const { curveFrom, curveTo, highTop, lowTop } = CAT_RAMP
  const t = Math.min(1, Math.max(0, (z - curveFrom) / (curveTo - curveFrom)))
  // smoothstep. 양 끝에서 기울기가 0이라서 평평한 구간과 매끄럽게 이어진다.
  const eased = t * t * (3 - 2 * t)
  return highTop + (lowTop - highTop) * eased
}

/** 욕실 모서리의 샤워부스. maxZ는 침실 쪽 벽의 욕실 면이고 entryZ까지 입구 쪽 고정 유리다. */
// bench는 뒷벽 트래버틴 판 앞의 일체형 벤치이고 top은 윗면 높이다.
export const SHOWER = {
  minX: 12.0,
  maxX: 13.93,
  minZ: -3.0,
  maxZ: -1.1,
  entryZ: -2.4,
  bench: { minX: 12.9, maxX: 13.93, minZ: -1.62, maxZ: -1.22, top: 0.45 },
} as const

/** 거실 통유리창 옆 구석의 바닥 화병 자리 */
export const FLOOR_VASE = { x: -7.45, z: -5.15 } as const

/** 고양이 화장실 장. 변기 칸 뒤쪽 벽(손 씻는 대 자리)에 붙는다. top은 윗면 높이다. */
export const CAT_LITTER = { minX: 8.9, maxX: 10.6, minZ: -8.35, maxZ: -7.8, top: 0.65 } as const

/** 침실 S자 캣타워. 침대 머리 쪽 벽 오른쪽 구석에 세운다. 침실 캣워크 끝에서 발판을 밟고 바닥까지 내려온다. */
// 발판은 반원 방석이고 벽에서 방 쪽으로 튀어나온다. x는 발판 가운데이고 top은 방바닥에서 잰 윗면 높이다.
export const CAT_TOWER = {
  /** S자 기둥 판이 벽에 붙는 z 범위 */
  spineMinZ: -0.88,
  spineMaxZ: -0.76,
  /** 반타원 발판의 가로 반지름과 벽에서 튀어나온 깊이 */
  radiusX: 0.34,
  depth: 0.42,
  /** 발판에 몸이 이만큼만 걸쳐도 올라선 것으로 본다. 다른 가구보다 작게 잡아서 좌우 발판이 조금 겹쳐도 걸어서 내려서게 한다. */
  margin: 0.05,
  steps: [
    // 오른쪽 발판은 침실 오른쪽 벽의 안쪽 면(x 13.7)을 넘지 않게 두고 왼쪽 발판은 협탁 위로 뻗게 둔다.
    { x: 12.9, top: 2.15 },
    { x: 13.34, top: 1.6 },
    { x: 12.9, top: 1.05 },
    { x: 13.34, top: 0.5 },
  ],
} as const

/** 카바나. 데크 오른쪽에 기둥 여섯 개를 세우고 그 위에 보와 살 지붕을 얹는다. */
export const CABANA = {
  postXs: [-9.85, -4.45],
  postZs: [7.7, 10.65, 13.6],
  /** 각기둥 한 변의 길이 */
  post: 0.18,
  /** 보의 아랫면과 윗면 높이 */
  beamBottom: 2.95,
  beamTop: 3.13,
  /** 살 지붕의 윗면 높이 */
  slatTop: 3.25,
  /** 살 사이의 간격 */
  slatGap: 0.3,
  /** 천을 묶는 높이 */
  tie: 1.25,
} as const

/** 캣폴. 바닥에서 천장까지 닿는 기둥 둘레에 발판을 돌려 단다. top은 방바닥에서 잰 발판 윗면 높이다. */
export const CAT_POLE = {
  x: -5,
  z: -5,
  /** 둥근 발판의 반지름. 고양이 몸에 맞춰 처음 값(0.25m)의 1.3배로 키웠다. */
  radius: 0.325,
  // 발판은 기둥 둘레를 한 방향으로 돌며 올라간다. 왼쪽(-x)과 뒤(-z)와 오른쪽(+x 해먹) 순서다.
  // 바닥에서 첫 발판까지 한 번에 뛸 수 있도록 첫 발판을 점프 높이(0.75m)보다 낮은 0.7m에 둔다.
  steps: [
    { x: -5.39, z: -5, top: 0.7, hammock: false },
    { x: -5, z: -5.39, top: 1.35, hammock: false },
    { x: -4.61, z: -5, top: 2.0, hammock: true },
  ],
  /** 맨 위의 숨숨집. 기둥 앞(+z)에 두고 둥근 발판에 C자 모양 벽을 두른다. */
  // 고양이 키가 0.64m라서 천장(3.5m)에 머리가 닿지 않도록 캣폴에서는 2.5m를 가장 높은 자리로 한다.
  // openDeg는 벽이 트인 방향이다. +x가 0도이고 +z 쪽으로 돈다. -45도는 오른쪽 뒤이고 해먹과 캣워크가 있는 쪽이다.
  // wall은 C자 벽의 높이다. 발판과 함께 1.3배로 키웠다.
  house: { x: -5, z: -4.61, top: 2.5, radius: 0.39, wall: 0.39, openDeg: -45 },
  /** 기둥 맨 아래에 밧줄을 감은 스크래처 구간의 높이 */
  scratchTop: 0.65,
} as const

/** 캣워크. 벽에 단 선반과 로프 구름다리다. top은 방바닥에서 잰 높이이고 bridge는 구름다리 구간이다. */
export const CATWALK = {
  /** 거실 뒤쪽 벽을 따라가는 구간. x 방향으로 길다. */
  livingBack: { minX: -3.9, maxX: 6.5, minZ: -5.45, maxZ: -5.1, top: 2.8, bridge: [-2.7, -1.3] },
  /** 거실 왼쪽 벽을 따라 곡선 책장 위까지 가는 구간. z 방향으로 길다. */
  livingSide: { minX: 6.525, maxX: 6.875, minZ: -5.45, maxZ: -1.0, top: 2.8 },
  /** 침대 머리 쪽 벽을 따라가는 구간. x 방향으로 길다. */
  bedroom: { minX: 7.3, maxX: 12.9, minZ: -0.9, maxZ: -0.55, top: 2.6, bridge: [9.4, 10.6] },
  /** 침실 왼쪽 벽의 계단 선반 둘. 통로에서 침실 캣워크로 올라가는 길이다. */
  bedroomSteps: [
    { minX: 7.125, maxX: 7.475, minZ: -0.6, maxZ: 0.2, top: 1.7 },
    { minX: 7.125, maxX: 7.6, minZ: -0.9, maxZ: -0.5, top: 2.3 },
  ],
} as const

/** 거실과 침실 사이 벽에 뚫은 고양이 통로. 높이는 방바닥에서 잰다. */
export const CAT_HOLE = {
  minZ: 0.35,
  maxZ: 1.05,
  bottom: 1.1,
  top: 1.85,
  /** 침실 쪽으로 내민 디딤판이 끝나는 x 좌표 */
  ledgeMaxX: 7.6,
} as const

/** 수영장 물이 차 있는 범위. 지금은 들어갈 수 없다. 나중에 수영하는 동작을 넣을 때 이 범위를 쓴다. */
export const POOL_WATER: Rect = { minX: -3.4, maxX: 3.4, minZ: 8.5, maxZ: 12.4 }

/** 걸어서 올라설 수 있는 높이 차이. 계단 한 단(0.18m)이 이 안에 들어온다. */
export const STEP_UP = 0.25

/** 점프 중에 발이 윗면보다 이만큼 낮아도 올라선 것으로 본다. */
export const JUMP_GRACE = 0.1

/** 고양이 몸이 차지하는 폭의 절반. 가구의 범위를 이만큼 넓혀서 계산한다. */
// 고양이의 자리는 점 하나로 계산한다. 가구 범위를 넓히지 않으면 몸이 가구 속으로 파묻히고 좁은 의자에 올라서기도 어렵다.
// 넓힌 범위 덕분에 오르지 못하는 가구 앞에서는 몸 폭만큼 떨어져서 멈추고 몸이 조금만 걸쳐도 그 가구 위에 선다.
export const BODY = 0.22

/** 고양이 몸의 높이. 높이가 있는 벽에 몸이 걸치는지 볼 때 쓴다. */
export const CAT_HEIGHT = 0.4

/** 발에서 귀 끝까지의 높이(0.64m)에 여유 0.02m를 더한 값. 점프할 때 머리가 천장을 뚫지 않게 막는 데 쓴다. */
export const CAT_TALL = 0.66

// 걸을 수 있는 구역. 방과 문 자리와 계단과 데크를 사각형으로 이어 붙였다.
// 방은 벽 안쪽 면에서 조금 들여서 잡았다. 그래서 벽과 유리는 따로 적지 않아도 지나갈 수 없다.
const WALK_AREAS: Rect[] = [
  // 거실과 주방
  { minX: -7.6, maxX: 6.6, minZ: -5.6, maxZ: 5.9 },
  // 거실 앞 끝과 계단과 화단을 잇는 자리. 거실 앞면은 벽이 없이 열려 있다.
  { minX: -7.6, maxX: 6.6, minZ: 5.8, maxZ: 6.2 },
  // 거실과 침실 사이 문 자리
  { minX: 6.5, maxX: 7.5, minZ: 1.8, maxZ: 4.2 },
  // 침실
  { minX: 7.4, maxX: 13.6, minZ: -0.6, maxZ: 5.6 },
  // 거실과 침실 사이 벽의 고양이 통로. 통로 아래 벽이 높이 1.1m 디딤이라서 그 높이로 올라와야 지나간다.
  { minX: 6.5, maxX: 7.5, minZ: CAT_HOLE.minZ + 0.1, maxZ: CAT_HOLE.maxZ - 0.1 },
  // 침실과 욕실 사이 문 자리
  { minX: 7.9, maxX: 8.9, minZ: -1.5, maxZ: -0.5 },
  // 욕실
  { minX: 7.4, maxX: 13.6, minZ: -5.6, maxZ: -1.4 },
  // 욕실과 변기 칸 사이 문 자리. 미닫이문이 끝까지 밀려 있어서 문 폭 전체로 지나간다.
  { minX: 9.25, maxX: 10.05, minZ: -6.4, maxZ: -5.5 },
  // 변기 칸
  { minX: 7.3, maxX: 10.7, minZ: -8.2, maxZ: -6.3 },
  // 데크
  { minX: -9.6, maxX: 9.6, minZ: 6.1, maxZ: 13.6 },
]

// 높이와 상관없이 지나갈 수 없는 자리. 얇은 것은 빠르게 걸어도 뚫리지 않도록 0.3m 넘게 잡았다.
const BLOCKERS: Rect[] = [
  POOL_WATER,
  // 욕조 안쪽 물
  { minX: 11.1, maxX: 13.7, minZ: -5.7, maxZ: -4.4 },
  // 샤워부스의 투명 유리. 앞면 한 장과 입구 쪽 고정 판 한 장
  { minX: SHOWER.minX, maxX: SHOWER.maxX, minZ: SHOWER.minZ - 0.05, maxZ: SHOWER.minZ + 0.05 },
  { minX: SHOWER.minX - 0.05, maxX: SHOWER.minX + 0.05, minZ: SHOWER.minZ, maxZ: SHOWER.entryZ },
  // 거실 뒤쪽의 아치 벽. 벽면보다 0.15m 앞까지 막아서 낮은 장 위에 섰을 때 몸이 벽에 묻히지 않게 한다.
  { minX: -4.6, maxX: 6.875, minZ: -5.9, maxZ: -5.3 },
  // 캣폴의 기둥
  { minX: CAT_POLE.x - 0.1, maxX: CAT_POLE.x + 0.1, minZ: CAT_POLE.z - 0.1, maxZ: CAT_POLE.z + 0.1 },
  // 변기 칸의 가림벽
  { minX: 8.35, maxX: 8.7, minZ: -8.35, maxZ: -6.9 },
  // 카바나 기둥 여섯 개
  ...CABANA.postXs.flatMap((x) =>
    CABANA.postZs.map((z) => ({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2 })),
  ),
]

/** 윗면에 올라설 수 있는 물건. top은 데크 윗면에서 잰 높이다. */
interface Surface extends Rect {
  top: number
  /** 휜 물건은 사각형 안에서도 이 부채꼴 띠 안에 있을 때만 올라선 것으로 본다. */
  arc?: { x: number; z: number; inner: number; outer: number; from: number; to: number }
}

// 데크 위 물건. 높이는 데크 윗면에서 잰다.
function onDeck(minX: number, maxX: number, minZ: number, maxZ: number, top: number): Surface {
  return { minX, maxX, minZ, maxZ, top }
}

// 집 안 물건. 높이는 방바닥에서 잰다.
function onFloor(minX: number, maxX: number, minZ: number, maxZ: number, top: number): Surface {
  return { minX, maxX, minZ, maxZ, top: FLOOR_HEIGHT + top }
}

// 가운데 자리와 한 변의 절반 길이로 정사각형 물건을 적는다.
function onFloorAt(x: number, z: number, half: number, top: number): Surface {
  return onFloor(x - half, x + half, z - half, z + half, top)
}

// 초승달 소파의 방석이나 등받이
function sofaBand(inner: number, outer: number, top: number): Surface {
  return {
    ...onFloor(SOFA.x - SOFA.outer, SOFA.x + SOFA.outer, SOFA.z, SOFA.z + SOFA.outer, top),
    arc: { x: SOFA.x, z: SOFA.z, inner, outer, from: SOFA.from, to: SOFA.to },
  }
}

const SURFACES: Surface[] = [
  // 수영장 테두리. 집 쪽과 양옆 세 변이 데크보다 높다.
  onDeck(-3.7, 3.7, 8.2, 8.5, 0.3),
  onDeck(-3.7, -3.4, 8.5, 12.1, 0.3),
  onDeck(3.4, 3.7, 8.5, 12.1, 0.3),
  // 선베드 두 개
  onDeck(5.1, 6.0, 9.0, 11.2, 0.47),
  onDeck(6.9, 7.8, 9.0, 11.2, 0.47),
  // 계단 양 끝의 돌 화단과 침실 앞 화단과 데크 앞쪽 두 화단
  onDeck(-8, STAIRS.minX, STAIRS.startZ, STAIRS_END_Z, 0.6),
  onDeck(STAIRS.maxX, 7.2, STAIRS.startZ, STAIRS_END_Z, 0.6),
  onDeck(7.2, 9.8, 6, 8, 0.45),
  onDeck(-5.2, -4.2, 13, 13.9, 0.45),
  onDeck(8.4, 9.6, 12.9, 13.9, 0.45),
  // 데크 앞 끝의 돌 벤치
  onDeck(-9.6, -5.2, 13, 13.9, 0.55),
  // 카바나 아래의 식탁과 의자 넷
  onDeck(-8.3, -6.1, 8.4, 9.4, 0.77),
  ...[-7.9, -6.5].flatMap((x) => [8.05, 9.75].map((z) => onDeck(x - 0.24, x + 0.24, z - 0.24, z + 0.24, 0.48))),
  // 카바나 아래의 소파 방석과 등받이와 탁자
  onDeck(-9.35, -6.25, 10.85, 11.75, 0.41),
  onDeck(-9.35, -6.25, 10.85, 11.07, 0.81),
  onDeck(-8.5, -7.1, 12, 12.6, 0.3),

  // 주방: 키 큰 장(냉장고와 오븐)과 조리대와 수전과 정수기와 아일랜드 식탁과 의자 둘
  onFloor(-7.8, -6.9, -1.55, 0.05, 2.25),
  onFloor(-7.8, -7.15, 0.1, 4.6, 0.95),
  onFloor(-7.7, -7.4, 0.35, 0.65, 1.45),
  onFloor(-7.726, -7.224, 1.719, 1.881, 1.38),
  onFloor(-6, -5.1, 0.5, 4.1, 0.95),
  onFloorAt(-4.75, 1.5, 0.2, 0.5),
  onFloorAt(-4.75, 3.1, 0.2, 0.5),

  // 거실: 아치 벽 앞의 낮은 장
  onFloor(-4.4, 6.2, -5.45, -5.0, 0.7),
  // 고양이 통로 아래의 벽. 통로 바닥 높이의 디딤이다.
  onFloor(HOUSE.wingX - 0.125, HOUSE.wingX + 0.125, CAT_HOLE.minZ, CAT_HOLE.maxZ, CAT_HOLE.bottom),
  // 통로로 올라가는 통나무 스툴 둘과 통로 아래의 물결 스크래처
  onFloor(6.3, 6.8, -0.95, -0.45, 0.4),
  onFloor(6.25, 6.85, -0.4, 0.2, 0.75),
  onFloor(6.3, 6.75, 0.3, 1.5, 0.35),
  // 침실 쪽 통로 옆의 디딤 상자와 방석. 통로 바로 아래가 아니라 문 쪽으로 붙여 놓았다.
  onFloor(7.2, 7.7, 0.85, 1.45, 0.6),
  // 통나무 조명과 곡선 책장과 통나무 탁자
  onFloorAt(6.5, -5.2, 0.2, 1.8),
  onFloor(6.5, 6.85, -3, -1.1, 2.1),
  onFloor(0.7, 2.3, -1.25, -0.45, 0.35),
  // 아치 스탠드의 받침과 대. 대가 높아서 지나가거나 올라설 수 없다.
  onFloorAt(4.4, 0.9, 0.1, 2.0),
  // 통유리창 옆 구석의 바닥 화병
  onFloorAt(FLOOR_VASE.x, FLOOR_VASE.z, 0.22, 0.6),
  // 소파 옆의 바닥 쿠션 둘과 거실 앞의 큰 야자 화분과 아일랜드 끝의 고양이 식기
  onFloorAt(4.7, -0.55, 0.32, 0.16),
  onFloorAt(4.45, -1.35, 0.28, 0.16),
  // 1인용 소파의 방석과 등받이. 등받이는 뒤쪽 절반이다.
  onFloorAt(SINGLE_SOFA.x, SINGLE_SOFA.z, 0.46, 0.45),
  onFloorAt(6.1, 5.25, 0.3, 0.6),
  onFloor(-5.8, -5.3, 4.115, 4.335, 0.12),
  // 초승달 소파의 방석과 등받이
  sofaBand(SOFA.inner, SOFA.outer, 0.45),
  sofaBand(SOFA.outer - 0.32, SOFA.outer, 0.85),

  // 침실: 침대와 협탁 둘과 바닥 조명과 안락의자와 옆 탁자와 스탠드 화면과 공기청정기와 고리 콘솔과 큰 화분
  onFloor(10.3, 12.5, -0.85, 1.3, 0.5),
  onFloor(9.85, 10.25, -0.8, -0.35, 0.45),
  onFloor(12.55, 12.95, -0.8, -0.35, 0.45),
  onFloorAt(10.6, 4.8, 0.5, 0.42),
  onFloorAt(11.4, 5.0, 0.22, 0.45),
  onFloor(12.2, 13.0, 3.5, 3.7, 1.45),
  onFloorAt(13.4, 5.3, 0.16, 1),
  onFloor(7.3, 9.1, 5.45, 5.8, 0.8),
  onFloorAt(7.55, 4.95, 0.3, 0.55),

  // 침대 발치의 벤치
  onFloor(10.6, 12.2, 1.45, 1.85, 0.42),

  // 샤워부스 안의 트래버틴 벤치
  onFloor(SHOWER.bench.minX, SHOWER.bench.maxX, SHOWER.bench.minZ, SHOWER.bench.maxZ, SHOWER.bench.top),

  // 욕실: 욕조 돌 턱 네 면과 세면대와 수전 둘과 나무 스툴과 화분
  onFloor(10.9, 13.9, -4.4, -4.25, 0.55),
  onFloor(10.9, 13.9, -5.85, -5.7, 0.55),
  onFloor(10.9, 11.1, -5.85, -4.25, 0.55),
  onFloor(13.7, 13.9, -5.85, -4.25, 0.55),
  onFloor(7.15, 7.8, -5.3, -2.5, 0.9),
  onFloorAt(7.55, -4.6, 0.18, 1.077),
  onFloorAt(7.55, -3.2, 0.18, 1.077),
  onFloorAt(7.3, -4.6, 0.15, 1.2),
  onFloorAt(7.3, -3.2, 0.15, 1.2),
  onFloorAt(10.6, -1.5, 0.2, 0.45),
  onFloorAt(8.4, -5.4, 0.14, 0.55),

  // 욕실의 라탄 바구니
  onFloorAt(13.5, -3.6, 0.21, 0.44),

  // 변기 칸: 변기와 화분과 고양이 화장실 장
  onFloor(7.15, 7.8, -7.95, -7.45, 0.45),
  // 고양이 화장실 장
  onFloor(CAT_LITTER.minX, CAT_LITTER.maxX, CAT_LITTER.minZ, CAT_LITTER.maxZ, CAT_LITTER.top),
  onFloorAt(10.5, -6.6, 0.26, 0.5),
]

/** 떠 있는 발판. 캣폴 발판과 캣워크처럼 아래가 비어 있는 것이다. top은 데크 윗면에서 잰 높이다. */
// 아래를 걸어서 지나갈 수 있고 아래에서 점프하면 통과해서 올라선다.
// 발보다 위에 있는 발판은 없는 것으로 보기 때문에 한 자리에 바닥과 발판이 위아래로 겹칠 수 있다.
export interface Floating extends Rect {
  top: number
  /** 몸이 얼마나 걸쳐야 올라선 것으로 볼지. 주지 않으면 몸 폭의 절반(BODY)이다. */
  margin?: number
  /** 윗면 높이가 z에 따라 바뀌는 판이면 그 높이를 구하는 함수다. 방바닥에서 잰 높이를 돌려준다. */
  topAt?: (z: number) => number
}

// 방바닥에서 잰 높이로 떠 있는 발판을 적는다.
function floatAt(minX: number, maxX: number, minZ: number, maxZ: number, top: number, margin?: number): Floating {
  return { minX, maxX, minZ, maxZ, top: FLOOR_HEIGHT + top, margin }
}

const FLOATING: Floating[] = [
  // 캣폴의 발판과 해먹
  ...CAT_POLE.steps.map((step) =>
    floatAt(step.x - CAT_POLE.radius, step.x + CAT_POLE.radius, step.z - CAT_POLE.radius, step.z + CAT_POLE.radius, step.top),
  ),
  floatAt(
    CAT_POLE.house.x - CAT_POLE.house.radius,
    CAT_POLE.house.x + CAT_POLE.house.radius,
    CAT_POLE.house.z - CAT_POLE.house.radius,
    CAT_POLE.house.z + CAT_POLE.house.radius,
    CAT_POLE.house.top,
  ),
  // 거실 캣워크
  floatAt(CATWALK.livingBack.minX, CATWALK.livingBack.maxX, CATWALK.livingBack.minZ, CATWALK.livingBack.maxZ, CATWALK.livingBack.top),
  floatAt(CATWALK.livingSide.minX, CATWALK.livingSide.maxX, CATWALK.livingSide.minZ, CATWALK.livingSide.maxZ, CATWALK.livingSide.top),
  // 통로에서 침실 쪽으로 내민 디딤판
  floatAt(HOUSE.wingX + 0.125, CAT_HOLE.ledgeMaxX, CAT_HOLE.minZ - 0.05, CAT_HOLE.maxZ + 0.05, CAT_HOLE.bottom),
  // 침실 계단 선반과 침실 캣워크
  ...CATWALK.bedroomSteps.map((step) => floatAt(step.minX, step.maxX, step.minZ, step.maxZ, step.top)),
  floatAt(CATWALK.bedroom.minX, CATWALK.bedroom.maxX, CATWALK.bedroom.minZ, CATWALK.bedroom.maxZ, CATWALK.bedroom.top),
  // 거실 캣워크 끝과 벽 통로를 잇는 곡선 디딤 선반. 윗면 높이가 z에 따라 바뀐다.
  { ...floatAt(CAT_RAMP.minX, CAT_RAMP.maxX, CAT_RAMP.fromZ, CAT_RAMP.toZ, CAT_RAMP.highTop), topAt: rampTop },
  // 침실 S자 캣타워의 반타원 발판. 벽 쪽 곧은 변에서 방 쪽으로 깊이만큼 튀어나온다.
  ...CAT_TOWER.steps.map((step) =>
    floatAt(
      step.x - CAT_TOWER.radiusX,
      step.x + CAT_TOWER.radiusX,
      CAT_TOWER.spineMaxZ - 0.1,
      CAT_TOWER.spineMaxZ + CAT_TOWER.depth,
      step.top,
      CAT_TOWER.margin,
    ),
  ),
]

/** 높이가 있는 벽. 고양이 몸이 from과 to 사이 높이에 걸칠 때만 막는다. 높이는 데크 윗면에서 잰다. */
// 벽 중간에 뚫은 고양이 통로의 위쪽 벽처럼 일부 높이만 막는 자리에 쓴다.
interface Barrier extends Rect {
  from: number
  to: number
}

const BARRIERS: Barrier[] = [
  // 고양이 통로 위쪽의 벽. 몸이 통로보다 높이 올라가 있으면 지나가지 못한다.
  {
    minX: HOUSE.wingX - 0.38,
    maxX: HOUSE.wingX + 0.38,
    minZ: CAT_HOLE.minZ,
    maxZ: CAT_HOLE.maxZ,
    from: FLOOR_HEIGHT + CAT_HOLE.top,
    to: FLOOR_HEIGHT + CEILING_HEIGHT,
  },
  // 문 위쪽 벽. 문 높이보다 높은 곳(캣워크 등)에서는 문 자리를 지나가지 못한다.
  // 벽 두께에 몸 길이의 절반쯤(0.25m)을 더해서 고양이 머리가 벽에 묻히기 전에 멈추게 한다.
  // 침실과 욕실 사이 문(2.4m). 침실 캣워크(2.6m)가 바로 위를 지난다.
  {
    minX: HOUSE.bathDoor.minX,
    maxX: HOUSE.bathDoor.maxX,
    minZ: HOUSE.bathZ - 0.35,
    maxZ: HOUSE.bathZ + 0.35,
    from: FLOOR_HEIGHT + LOW_DOOR_HEIGHT,
    to: FLOOR_HEIGHT + CEILING_HEIGHT,
  },
  // 욕실과 변기 칸 사이 문(2.4m)
  {
    minX: HOUSE.toiletDoor.minX,
    maxX: HOUSE.toiletDoor.maxX,
    minZ: HOUSE.minZ - 0.375,
    maxZ: HOUSE.minZ + 0.375,
    from: FLOOR_HEIGHT + LOW_DOOR_HEIGHT,
    to: FLOOR_HEIGHT + CEILING_HEIGHT,
  },
  // 거실과 침실 사이 문(2.7m)
  {
    minX: HOUSE.wingX - 0.375,
    maxX: HOUSE.wingX + 0.375,
    minZ: HOUSE.bedroomDoor.minZ,
    maxZ: HOUSE.bedroomDoor.maxZ,
    from: FLOOR_HEIGHT + DOOR_HEIGHT,
    to: FLOOR_HEIGHT + CEILING_HEIGHT,
  },
]

function contains(rect: Rect, x: number, z: number) {
  return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ
}

// 고양이 몸이 이 물건에 걸쳐 있는지 본다. 물건의 범위를 몸 폭의 절반만큼 넓혀서 검사한다.
// margin은 범위를 넓히는 정도다. 주지 않으면 몸 폭의 절반(BODY)이다.
function onSurface(surface: Surface, x: number, z: number, margin = BODY) {
  const outside =
    x < surface.minX - margin || x > surface.maxX + margin || z < surface.minZ - margin || z > surface.maxZ + margin
  if (outside) return false
  const arc = surface.arc
  if (!arc) return true
  const distance = Math.hypot(x - arc.x, z - arc.z)
  const degree = (Math.atan2(z - arc.z, x - arc.x) * 180) / Math.PI
  // 띠의 양 끝도 몸 폭만큼 넓힌다. 5도는 소파 반지름에서 약 0.22m다.
  return (
    distance >= arc.inner - BODY && distance <= arc.outer + BODY && degree >= arc.from - 5 && degree <= arc.to + 5
  )
}

// 고양이가 서 있는 자리의 바닥 높이를 구한다. 몸이 걸친 것 가운데 가장 높은 윗면을 돌려준다.
// 데크는 DECK_HEIGHT이고 거실은 그보다 FLOOR_HEIGHT만큼 높으며 계단은 단마다 낮아진다.
// footY는 지금 발의 높이다. 떠 있는 발판은 발이 그 윗면에 닿을 만큼 올라왔을 때만 바닥으로 친다.
// footY를 주지 않으면 떠 있는 발판을 뺀 높이를 돌려준다.
// rising은 점프해서 올라가는 중인지다. 올라가는 중에는 발이 발판 윗면을 완전히 넘어야 그 발판을 바닥으로 친다.
// margin은 가구 범위를 넓히는 폭이다. 고양이는 몸 폭의 절반(BODY)이고 장난감 공처럼 작은 것은 더 작게 준다.
export function groundHeight(x: number, z: number, footY = -Infinity, rising = false, margin = BODY) {
  let top = baseHeight(x, z)
  for (const surface of SURFACES) {
    if (surface.top > top && onSurface(surface, x, z, margin)) top = surface.top
  }
  return Math.max(DECK_HEIGHT + top, floatingHeight(x, z, footY, FLOATING, rising))
}

// 그 자리의 천장 높이를 돌려준다. 집 안이면 천장이고 밖이면 끝이 없다.
export function ceilingHeight(x: number, z: number) {
  const inside = contains(HOUSE, x, z) || contains(HOUSE.toilet, x, z)
  return inside ? DECK_HEIGHT + FLOOR_HEIGHT + CEILING_HEIGHT : Infinity
}

// 발 아래에 있는 떠 있는 발판 가운데 가장 높은 윗면을 돌려준다. 없으면 -Infinity다.
// floats를 따로 주면 그 목록으로 계산한다. 검사 스크립트가 쓴다.
// 올라가는 중(rising)에는 여유 높이(JUMP_GRACE)를 주지 않는다.
// 여유를 주면 올라가다가 발판 0.1m 아래에서 바로 올라서고 그 자리에서 다시 점프가 되어 한 번에 여러 발판을 뛰어오른다.
export function floatingHeight(x: number, z: number, footY: number, floats: Floating[] = FLOATING, rising = false) {
  let best = -Infinity
  for (const float of floats) {
    // 경사진 판은 걸어 올라가는 동안 한 화면에 올라가는 높이를 받아 주도록 걸어 오르는 높이(STEP_UP)까지 여유를 준다.
    const grace = rising ? 0 : float.topAt ? STEP_UP : JUMP_GRACE
    const top = DECK_HEIGHT + (float.topAt ? FLOOR_HEIGHT + float.topAt(z) : float.top)
    if (top > best && top <= footY + grace && onSurface(float, x, z, float.margin)) best = top
  }
  return best
}

// 가구를 뺀 바닥의 높이. 데크를 기준으로 잰다.
function baseHeight(x: number, z: number) {
  // 거실과 침실과 욕실과 변기 칸은 모두 같은 높이의 바닥이다.
  if (contains(HOUSE, x, z) || contains(HOUSE.toilet, x, z)) return FLOOR_HEIGHT
  const onStairs = x >= STAIRS.minX && x <= STAIRS.maxX && z > STAIRS.startZ && z < STAIRS_END_Z
  if (onStairs) {
    const step = Math.floor((z - STAIRS.startZ) / STAIRS.stepDepth)
    return FLOOR_HEIGHT - STEP_HEIGHT * (step + 1)
  }
  return 0
}

// 그 자리에 설 수 있는지 본다. 벽과 유리와 기둥과 물이 막는다. 윗면 높이는 따지지 않는다.
// footY는 발의 높이다. 높이가 있는 벽은 몸이 그 높이에 걸칠 때만 막는다. 주지 않으면 그 자리의 바닥 높이로 본다.
export function isWalkable(x: number, z: number, footY = groundHeight(x, z)) {
  const insideArea = WALK_AREAS.some((area) => contains(area, x, z))
  if (!insideArea) return false
  if (BLOCKERS.some((blocker) => contains(blocker, x, z))) return false
  const foot = footY - DECK_HEIGHT
  return !BARRIERS.some((barrier) => contains(barrier, x, z) && foot + CAT_HEIGHT > barrier.from && foot < barrier.to)
}

// 다음 위치로 갈 수 있으면 그 위치를 돌려준다.
// footY는 지금 발의 높이다. 다음 자리의 윗면이 발보다 너무 높으면 가지 못한다.
// 서 있을 때는 STEP_UP까지 걸어서 올라서고 점프 중에는 발이 윗면보다 JUMP_GRACE 낮은 높이까지 오면 올라선다.
// 벽에 비스듬히 부딪혔을 때는 한 축만 움직여서 벽을 따라 미끄러지게 한다.
export function resolveMove(
  currentX: number,
  currentZ: number,
  nextX: number,
  nextZ: number,
  footY: number,
): [number, number] {
  const grounded = footY <= groundHeight(currentX, currentZ, footY) + 0.001
  const reach = footY + (grounded ? STEP_UP : JUMP_GRACE)
  const canStand = (x: number, z: number) => isWalkable(x, z, footY) && groundHeight(x, z, footY) <= reach
  if (canStand(nextX, nextZ)) return [nextX, nextZ]
  if (canStand(nextX, currentZ)) return [nextX, currentZ]
  if (canStand(currentX, nextZ)) return [currentX, nextZ]
  return [currentX, currentZ]
}
