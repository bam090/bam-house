import { Box } from './Box'
import { palette } from './palette'
import { DECK_HEIGHT } from './walkable'

/** 수영장의 깊이. 물 높이가 아니라 데크 윗면에서 바닥까지 잰 값이다. */
export const POOL_DEPTH = 1.5

/** 수영장 안쪽 범위. 이 테라스 group 안의 좌표다. */
const POOL = { halfWidth: 3.4, minZ: 7.5, maxZ: 11.1 } as const

/** 데크 돌판의 범위. 이 테라스 group 안의 좌표다. */
const DECK = { halfWidth: 10, minZ: 5, maxZ: 13 } as const

/** 돌 받침이 땅속으로 들어가는 깊이. 수영장 아래를 판 땅이 보이지 않도록 깊게 둔다. */
const BASE_BOTTOM = -(DECK_HEIGHT + 1.2)

/** 데크에서 잔디로 내려가는 계단 한 단의 깊이 */
const SIDE_STEP_DEPTH = 0.35

/** 데크에서 잔디로 내려가는 계단이 놓이는 z 범위. 데크 길이 전체다. */
const SIDE_STAIRS = { minZ: DECK.minZ, maxZ: DECK.maxZ } as const

// 거실 앞에 있는 돌바닥 테라스와 수영장이다.
// 방문자는 이 테라스에서 출발해서 거실로 들어간다.
// 데크 윗면이 이 컴포넌트의 높이 0이다. 장면에서는 집과 함께 DECK_HEIGHT만큼 올려서 놓는다.
export function Terrace() {
  const poolLength = POOL.maxZ - POOL.minZ
  const poolCenterZ = (POOL.minZ + POOL.maxZ) / 2
  const baseHeight = -BASE_BOTTOM
  const baseY = BASE_BOTTOM / 2
  const sideWidth = DECK.halfWidth - POOL.halfWidth

  return (
    // 거실이 깊어진 만큼 테라스 전체를 앞쪽으로 1m 옮겼다.
    <group position={[0, 0, 1]}>
      {/* 데크 돌판과 돌 받침. 가운데에 수영장 구멍이 나도록 네 덩어리로 나눴다. */}
      <Box
        size={[DECK.halfWidth * 2, baseHeight, POOL.minZ - DECK.minZ]}
        position={[0, baseY, (DECK.minZ + POOL.minZ) / 2]}
        color={palette.stone}
      />
      <Box
        size={[DECK.halfWidth * 2, baseHeight, DECK.maxZ - POOL.maxZ]}
        position={[0, baseY, (POOL.maxZ + DECK.maxZ) / 2]}
        color={palette.stone}
      />
      {[-1, 1].map((side) => (
        <Box
          key={side}
          size={[sideWidth, baseHeight, poolLength]}
          position={[side * (POOL.halfWidth + sideWidth / 2), baseY, poolCenterZ]}
          color={palette.stone}
        />
      ))}

      {/* 수영장 바닥과 안쪽 벽. 밝은 타일 색으로 칠해서 물속이 비쳐 보이게 한다. */}
      <Box
        size={[POOL.halfWidth * 2, 0.2, poolLength]}
        position={[0, -POOL_DEPTH - 0.1, poolCenterZ]}
        color={palette.poolTile}
      />
      {[POOL.minZ, POOL.maxZ].map((z) => (
        <Box
          key={z}
          size={[POOL.halfWidth * 2, POOL_DEPTH, 0.04]}
          position={[0, -POOL_DEPTH / 2, z + (z === POOL.minZ ? 0.02 : -0.02)]}
          color={palette.poolTile}
          castShadow={false}
        />
      ))}
      {[-1, 1].map((side) => (
        <Box
          key={side}
          size={[0.04, POOL_DEPTH, poolLength]}
          position={[side * (POOL.halfWidth - 0.02), -POOL_DEPTH / 2, poolCenterZ]}
          color={palette.poolTile}
          castShadow={false}
        />
      ))}

      {/* 수영장 테두리 네 개 */}
      <Box size={[7.4, 0.3, 0.3]} position={[0, 0.15, 7.35]} color={palette.stoneDark} />
      <Box size={[7.4, 0.3, 0.3]} position={[0, 0.15, 11.25]} color={palette.stoneDark} />
      <Box size={[0.3, 0.3, 3.6]} position={[-3.55, 0.15, 9.3]} color={palette.stoneDark} />
      <Box size={[0.3, 0.3, 3.6]} position={[3.55, 0.15, 9.3]} color={palette.stoneDark} />

      {/* 수영장 물. 얇은 판을 반투명하게 만들어서 바닥까지 비쳐 보이게 한다. */}
      <Box
        size={[POOL.halfWidth * 2, 0.04, poolLength]}
        position={[0, 0.18, poolCenterZ]}
        color={palette.water}
        opacity={0.55}
        roughness={0.1}
      />

      {/* 데크 양옆에서 잔디로 내려가는 두 단 계단. 데크 앞끝에서 집 앞면까지 이어진다. */}
      {[-1, 1].map((side) =>
        [1, 2].map((step) => {
          const top = -(DECK_HEIGHT / 3) * step
          const height = top - BASE_BOTTOM
          return (
            <Box
              key={`${side}-${step}`}
              size={[SIDE_STEP_DEPTH, height, SIDE_STAIRS.maxZ - SIDE_STAIRS.minZ]}
              position={[
                side * (DECK.halfWidth + SIDE_STEP_DEPTH * (step - 0.5)),
                BASE_BOTTOM + height / 2,
                (SIDE_STAIRS.minZ + SIDE_STAIRS.maxZ) / 2,
              ]}
              color={palette.stone}
            />
          )
        }),
      )}

      {/* 바다 쪽에 놓은 선베드 */}
      <group position={[-7.5, 0, 9.2]} rotation={[0, 0.25, 0]}>
        <Box size={[0.9, 0.15, 2.2]} position={[0, 0.3, 0]} color={palette.wood} />
        <Box size={[0.8, 0.1, 1.5]} position={[0, 0.42, 0.3]} color={palette.fabric} />
        <Box size={[0.8, 0.1, 0.8]} position={[0, 0.62, -0.85]} rotation={[0.6, 0, 0]} color={palette.fabric} />
        <Box size={[0.08, 0.25, 0.08]} position={[-0.38, 0.12, 0.95]} color={palette.woodDark} />
        <Box size={[0.08, 0.25, 0.08]} position={[0.38, 0.12, 0.95]} color={palette.woodDark} />
        <Box size={[0.08, 0.25, 0.08]} position={[-0.38, 0.12, -0.95]} color={palette.woodDark} />
        <Box size={[0.08, 0.25, 0.08]} position={[0.38, 0.12, -0.95]} color={palette.woodDark} />
      </group>
    </group>
  )
}

