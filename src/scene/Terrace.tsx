import { useLayoutEffect, useRef } from 'react'
import { Matrix4 } from 'three'
import type { InstancedMesh } from 'three'
import { Box } from './Box'
import { palette } from './palette'
import { Cylinder, Planter, scatter } from './Shapes'
import { CABANA, DECK_HEIGHT, STAIRS, STAIRS_END_Z } from './walkable'

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
    <group>
    {/* 거실이 깊어진 만큼 데크와 수영장을 앞쪽으로 1m 옮겼다. 이 group 안의 z 좌표는 장면 좌표보다 1 작다. */}
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

      {/* 수영장 테두리. 어두운 돌이고 집 쪽과 양옆 세 변만 물보다 높다. */}
      <Box size={[7.4, 0.3, 0.3]} position={[0, 0.15, 7.35]} color={palette.charcoal} />
      <Box size={[0.3, 0.3, 3.6]} position={[-3.55, 0.15, 9.3]} color={palette.charcoal} />
      <Box size={[0.3, 0.3, 3.6]} position={[3.55, 0.15, 9.3]} color={palette.charcoal} />
      {/* 바다 쪽 테두리는 물 아래로 낮춰서 물이 가장자리까지 차 보이게 한다. */}
      <Box size={[7.4, 0.16, 0.3]} position={[0, 0.08, 11.25]} color={palette.charcoal} />
      {/* 넘친 물을 받는 홈. 데크에 어두운 띠로 표시한다. */}
      <Box size={[7.4, 0.02, 0.3]} position={[0, 0.011, 11.56]} color={palette.charcoal} castShadow={false} />

      {/* 수영장 물. 얇은 판을 반투명하게 만들어서 바닥까지 비쳐 보이게 한다. */}
      {/* 바다 쪽으로는 낮춘 테두리 위까지 덮는다. */}
      <Box
        size={[POOL.halfWidth * 2, 0.04, poolLength + 0.3]}
        position={[0, 0.18, poolCenterZ + 0.15]}
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

    </group>

      {/* 여기부터는 테라스 group을 옮기지 않은 장면 좌표로 놓는다. 걷는 범위(walkable.ts)와 같은 좌표다. */}

      {/* 데크 왼쪽의 선베드 두 개. 바다를 향해 나란히 놓는다. */}
      <Sunbed x={5.55} z={10.1} />
      <Sunbed x={7.35} z={10.1} />

      {/* 거실 계단 양 끝을 막는 돌 화단. 계단보다 조금 낮은 단으로 솟아 있다. */}
      <Planter minX={-8} maxX={STAIRS.minX} minZ={STAIRS.startZ} maxZ={STAIRS_END_Z} height={0.6} tufts={5} seed={1} />
      <Planter minX={STAIRS.maxX} maxX={7.2} minZ={STAIRS.startZ} maxZ={STAIRS_END_Z} height={0.6} tufts={6} seed={2} />
      {/* 침실 앞 데크 모서리의 화단. 가는 줄기의 나무 한 그루와 풀을 심는다. */}
      <Planter minX={7.2} maxX={9.8} minZ={6} maxZ={8} height={0.45} tufts={8} seed={3} />
      <SlenderTree x={8.6} y={0.45} z={7.1} />
      {/* 데크 앞쪽 두 화단 */}
      <Planter minX={-5.2} maxX={-4.2} minZ={13} maxZ={13.9} height={0.45} tufts={4} seed={4} />
      <Planter minX={8.4} maxX={9.6} minZ={12.9} maxZ={13.9} height={0.45} tufts={5} seed={5} />

      {/* 데크 앞 끝의 붙박이 돌 벤치 */}
      <Box size={[4.4, 0.45, 0.9]} position={[-7.4, 0.225, 13.45]} color={palette.stone} />
      <Box size={[4.2, 0.1, 0.8]} position={[-7.4, 0.5, 13.45]} color={palette.fabric} />

      {/* 카바나 아래의 식탁과 의자 넷 */}
      <Box size={[2.2, 0.06, 1]} position={[-7.2, 0.74, 8.9]} color={palette.teak} />
      {[-0.95, 0.95].map((dx) =>
        [-0.38, 0.38].map((dz) => (
          <Box key={`${dx}-${dz}`} size={[0.07, 0.71, 0.07]} position={[-7.2 + dx, 0.355, 8.9 + dz]} color={palette.woodDark} />
        )),
      )}
      {[-0.7, 0.7].map((dx) =>
        [-1, 1].map((side) => (
          <group key={`${dx}-${side}`} position={[-7.2 + dx, 0, 8.9 + side * 0.85]}>
            <Box size={[0.48, 0.06, 0.48]} position={[0, 0.45, 0]} color={palette.fabric} />
            <Box size={[0.48, 0.45, 0.06]} position={[0, 0.7, side * 0.24]} color={palette.wood} />
            <Box size={[0.4, 0.42, 0.4]} position={[0, 0.21, 0]} color={palette.woodDark} />
          </group>
        )),
      )}

      {/* 카바나 아래의 낮은 소파와 탁자. 소파는 바다를 본다. 쿠션 하나는 그린이다. */}
      <Box size={[3.1, 0.14, 0.95]} position={[-7.8, 0.12, 11.3]} color={palette.teak} />
      <Box size={[3, 0.22, 0.9]} position={[-7.8, 0.3, 11.3]} color={palette.fabric} />
      <Box size={[3, 0.42, 0.22]} position={[-7.8, 0.6, 10.96]} color={palette.fabric} />
      <Box size={[1.4, 0.3, 0.6]} position={[-7.8, 0.15, 12.3]} color={palette.teak} />
      <Box size={[0.46, 0.34, 0.14]} position={[-8.9, 0.6, 11.14]} rotation={[-0.2, 0, 0]} color={palette.green} />

      <Cabana />
    </group>
  )
}

// 선베드 하나. 머리 쪽이 집을 향하고 발 쪽이 바다를 향한다.
function Sunbed({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box size={[0.9, 0.15, 2.2]} position={[0, 0.3, 0]} color={palette.wood} />
      <Box size={[0.8, 0.1, 1.5]} position={[0, 0.42, 0.3]} color={palette.fabric} />
      <Box size={[0.8, 0.1, 0.8]} position={[0, 0.62, -0.85]} rotation={[0.6, 0, 0]} color={palette.fabric} />
      {[-0.38, 0.38].map((dx) =>
        [-0.95, 0.95].map((dz) => (
          <Box key={`${dx}-${dz}`} size={[0.08, 0.25, 0.08]} position={[dx, 0.12, dz]} color={palette.woodDark} />
        )),
      )}
    </group>
  )
}

// 줄기가 가늘고 잎이 성긴 나무. 줄기 세 갈래가 바깥으로 벌어지고 끝마다 작은 잎 덩어리가 달린다.
function SlenderTree({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      {[0, 1, 2].map((index) => {
        const angle = (index / 3) * Math.PI * 2 + 0.4
        const lean = 0.18 + scatter(index, 31) * 0.12
        const length = 2.6 + scatter(index, 32) * 0.6
        const tipX = Math.sin(lean) * length
        const tipY = Math.cos(lean) * length
        return (
          <group key={index} rotation={[0, angle, 0]}>
            <Cylinder
              radius={0.05}
              radiusTop={0.025}
              height={length}
              position={[tipX / 2, tipY / 2, 0]}
              rotation={[0, 0, -lean]}
              color={palette.trunk}
            />
            {[0, 1, 2].map((leaf) => (
              <mesh
                key={leaf}
                position={[
                  tipX + (scatter(leaf, index + 40) - 0.5) * 0.9,
                  tipY - 0.2 + scatter(leaf, index + 50) * 0.7,
                  (scatter(leaf, index + 60) - 0.5) * 0.9,
                ]}
                scale={[0.5, 0.32, 0.5]}
                castShadow
              >
                <icosahedronGeometry args={[1, 0]} />
                <meshStandardMaterial color={leaf === 1 ? palette.leafLight : palette.leaf} flatShading />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

// 살 지붕. 같은 모양의 나무 살을 z 방향으로 0.3m마다 놓는다.
// InstancedMesh는 같은 도형을 여러 자리에 한 번에 그리는 Three.js 기능이다. 살마다 mesh를 만드는 것보다 가볍다.
function CabanaSlats() {
  const mesh = useRef<InstancedMesh>(null)
  const [minX, maxX] = CABANA.postXs
  const [minZ, , maxZ] = CABANA.postZs
  const count = Math.round((maxZ - minZ) / CABANA.slatGap) + 1
  const height = CABANA.slatTop - CABANA.beamTop

  // 화면에 처음 그려지기 전에 살마다 놓일 자리를 정한다.
  useLayoutEffect(() => {
    const slats = mesh.current
    if (!slats) return
    const matrix = new Matrix4()
    for (let index = 0; index < count; index += 1) {
      matrix.setPosition((minX + maxX) / 2, CABANA.beamTop + height / 2, minZ - 0.05 + index * CABANA.slatGap)
      slats.setMatrixAt(index, matrix)
    }
    slats.instanceMatrix.needsUpdate = true
  }, [count, height, minX, maxX, minZ])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[maxX - minX + 0.4, height, 0.08]} />
      <meshStandardMaterial color={palette.oak} flatShading roughness={0.9} />
    </instancedMesh>
  )
}

function Cabana() {
  const { postXs, postZs, post, beamBottom, beamTop, tie } = CABANA
  const [minX, maxX] = postXs
  const [minZ, , maxZ] = postZs
  const beamY = (beamBottom + beamTop) / 2
  const beam = beamTop - beamBottom
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  return (
    <group>
      {postXs.map((x) =>
        postZs.map((z) => {
          // 천은 기둥의 안쪽에 드리운다.
          const clothX = x + (x < centerX ? 0.2 : -0.2)
          return (
            <group key={`${x}-${z}`}>
              <Box size={[post, beamBottom, post]} position={[x, beamBottom / 2, z]} color={palette.oak} />
              {/* 보에서 넓게 내려온 천을 묶은 자리에서 모았다가 아래로 다시 퍼지게 한다. */}
              <Cylinder radius={0.06} radiusTop={0.24} height={beamBottom - tie} position={[clothX, (beamBottom + tie) / 2, z]} color={palette.fabric} />
              <Cylinder radius={0.15} radiusTop={0.06} height={tie - 0.05} position={[clothX, (tie + 0.05) / 2, z]} color={palette.fabric} />
              <Box size={[0.16, 0.05, 0.16]} position={[clothX, tie, z]} color={palette.oak} />
            </group>
          )
        }),
      )}
      {/* 기둥 위를 두르는 보 */}
      {postXs.map((x) => (
        <Box key={x} size={[beam, beam, maxZ - minZ + post]} position={[x, beamY, centerZ]} color={palette.oak} />
      ))}
      {postZs.map((z) => (
        <Box key={z} size={[maxX - minX - post, beam, beam]} position={[centerX, beamY, z]} color={palette.oak} />
      ))}
      <CabanaSlats />
      {/* 정원 쪽 긴 변에 길게 친 얇은 반투명 천 */}
      <Box
        size={[0.02, beamBottom - 0.2, maxZ - minZ - post]}
        position={[minX, (beamBottom + 0.2) / 2, centerZ]}
        color={palette.white}
        opacity={0.35}
      />
    </group>
  )
}
