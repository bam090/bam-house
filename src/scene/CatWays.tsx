import { useMemo } from 'react'
import { Shape, SplineCurve, Vector2 } from 'three'
import { Box } from './Box'
import { palette } from './palette'
import { Cylinder, Extruded, FACE_X, LAY_FLAT, arcBand } from './Shapes'
import { CATWALK, CAT_HOLE, CAT_POLE, CEILING_HEIGHT, HOUSE } from './walkable'

// 고양이가 다니는 길을 그리는 파일이다. 캣폴과 캣워크와 벽 통로의 디딤이 들어 있다.
// 자리와 높이는 walkable.ts의 CAT_POLE과 CATWALK와 CAT_HOLE 값을 그대로 쓴다. 그래서 보이는 모양과 걷는 자리가 어긋나지 않는다.

/** 선반 판의 두께 */
const BOARD = 0.04

// 벽에 단 원목 선반 한 장. top이 윗면 높이다.
function Shelf({ minX, maxX, minZ, maxZ, top }: { minX: number; maxX: number; minZ: number; maxZ: number; top: number }) {
  return (
    <Box
      size={[maxX - minX, BOARD, maxZ - minZ]}
      position={[(minX + maxX) / 2, top - BOARD / 2, (minZ + maxZ) / 2]}
      color={palette.oak}
    />
  )
}

// 로프 구름다리. 좁은 나무 발판을 가운데가 조금 처지게 늘어놓고 양쪽 가장자리를 밧줄로 잇는다.
// x 방향으로 놓는다. 걷는 높이는 선반과 같게 두고 처진 모양은 눈에 보이는 것만 다르다.
function RopeBridge({ fromX, toX, minZ, maxZ, top }: { fromX: number; toX: number; minZ: number; maxZ: number; top: number }) {
  const planks = Math.round((toX - fromX) / 0.2)
  const step = (toX - fromX) / planks
  const depth = maxZ - minZ
  const centerZ = (minZ + maxZ) / 2
  // 가운데에서 가장 많이 처지는 포물선
  const sag = (ratio: number) => -0.07 * 4 * ratio * (1 - ratio)
  return (
    <group>
      {Array.from({ length: planks }, (_, index) => {
        const ratio = (index + 0.5) / planks
        const slope = Math.atan2(sag((index + 1) / planks) - sag(index / planks), step)
        return (
          <group key={index} position={[fromX + step * (index + 0.5), top - BOARD / 2 + sag(ratio), centerZ]} rotation={[0, 0, slope]}>
            <Box size={[step - 0.04, BOARD, depth - 0.04]} position={[0, 0, 0]} color={palette.wood} />
            {[-1, 1].map((side) => (
              <Box
                key={side}
                size={[step + 0.01, 0.025, 0.025]}
                position={[0, 0.02, side * (depth / 2 - 0.02)]}
                color={palette.rugLiving}
                castShadow={false}
              />
            ))}
          </group>
        )
      })}
    </group>
  )
}

// 구름다리 구간이 있는 벽 선반. 구름다리 앞뒤는 선반이고 가운데만 구름다리다.
function WalkWithBridge({ walk }: { walk: { minX: number; maxX: number; minZ: number; maxZ: number; top: number; bridge: readonly [number, number] } }) {
  const [from, to] = walk.bridge
  return (
    <group>
      <Shelf minX={walk.minX} maxX={from} minZ={walk.minZ} maxZ={walk.maxZ} top={walk.top} />
      <RopeBridge fromX={from} toX={to} minZ={walk.minZ} maxZ={walk.maxZ} top={walk.top} />
      <Shelf minX={to} maxX={walk.maxX} minZ={walk.minZ} maxZ={walk.maxZ} top={walk.top} />
    </group>
  )
}

// 천장까지 닿는 캣폴. 흰 기둥 둘레에 원목 발판을 돌려 달고 한 자리에는 투명 해먹을 단다.
function CatPole() {
  const { x, z, radius, steps, house } = CAT_POLE
  // 숨숨집의 벽. 방 쪽(+z)만 트인 C자 띠를 위에서 본 윤곽으로 그려서 세운다.
  const shell = useMemo(
    () => ({
      wall: arcBand(house.x, house.z, house.radius - 0.07, house.radius, 135, 405),
      rim: arcBand(house.x, house.z, house.radius - 0.09, house.radius + 0.015, 133, 407),
    }),
    [house],
  )
  return (
    <group>
      <Cylinder radius={0.05} height={CEILING_HEIGHT} position={[x, CEILING_HEIGHT / 2, z]} color={palette.white} />
      <Cylinder radius={0.2} radiusTop={0.12} height={0.05} position={[x, 0.025, z]} color={palette.white} />
      {/* 기둥 맨 아래의 스크래처. 굵은 밧줄을 감은 모양으로 띠를 여러 줄 두른다. */}
      <Cylinder radius={0.085} height={CAT_POLE.scratchTop - 0.05} position={[x, (CAT_POLE.scratchTop + 0.05) / 2, z]} color={palette.rugLiving} />
      {Array.from({ length: 7 }, (_, index) => (
        <Cylinder key={index} radius={0.092} height={0.02} position={[x, 0.09 + index * 0.055, z]} color={palette.wetSand} />
      ))}
      <Cylinder radius={0.1} height={0.04} position={[x, CEILING_HEIGHT - 0.02, z]} color={palette.white} />
      {/* 맨 위의 숨숨집. 원목 발판과 아이보리 방석과 C자 벽과 원목 테두리 */}
      <Box size={[Math.abs(house.x - x) + 0.06, 0.04, 0.08]} position={[(house.x + x) / 2, house.top - 0.06, z]} color={palette.oak} />
      <Cylinder radius={house.radius + 0.015} height={BOARD} position={[house.x, house.top - BOARD / 2 - 0.01, house.z]} color={palette.oak} />
      <Cylinder radius={house.radius - 0.08} height={0.03} position={[house.x, house.top, house.z]} color={palette.wall} />
      <Extruded shape={shell.wall} depth={0.3} position={[0, house.top - 0.01, 0]} rotation={LAY_FLAT} color={palette.fabric} roughness={1} />
      <Extruded shape={shell.rim} depth={0.025} position={[0, house.top + 0.29, 0]} rotation={LAY_FLAT} color={palette.oak} />
      {steps.map((step) => (
        <group key={step.top}>
          {/* 기둥에서 발판까지 뻗은 받침 */}
          <Box
            size={[Math.abs(step.x - x) + 0.06, 0.04, Math.abs(step.z - z) + 0.06]}
            position={[(step.x + x) / 2, step.top - 0.06, (step.z + z) / 2]}
            color={palette.oak}
          />
          {step.hammock ? (
            <group position={[step.x, step.top, step.z]}>
              {/* 투명한 반구 해먹과 그 테두리 */}
              <mesh position={[0, -0.01, 0]}>
                <sphereGeometry args={[radius - 0.02, 14, 7, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
                <meshStandardMaterial color={palette.glass} transparent opacity={0.35} roughness={0.1} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
                <torusGeometry args={[radius - 0.015, 0.015, 6, 28]} />
                <meshStandardMaterial color={palette.oak} roughness={0.9} />
              </mesh>
            </group>
          ) : (
            <group>
              <Cylinder radius={radius} height={BOARD} position={[step.x, step.top - BOARD / 2 - 0.01, step.z]} color={palette.oak} />
              <Cylinder radius={radius - 0.05} height={0.02} position={[step.x, step.top - 0.01, step.z]} color={palette.fabric} />
            </group>
          )}
        </group>
      ))}
    </group>
  )
}

// 통로로 올라가는 통나무 스툴. 위가 조금 좁고 윗면은 밝은 나무색이다.
function LogStool({ x, z, radius, height }: { x: number; z: number; radius: number; height: number }) {
  return (
    <group>
      <Cylinder radius={radius} radiusTop={radius * 0.9} height={height - 0.01} position={[x, (height - 0.01) / 2, z]} color={palette.sofaWood} />
      <Cylinder radius={radius * 0.9} height={0.01} position={[x, height - 0.005, z]} color={palette.woodFloor} />
    </group>
  )
}

// 물결 스크래처. S자로 휜 띠를 옆에서 본 윤곽으로 그려서 폭만큼 밀어낸다.
function WaveScratcher() {
  const shape = useMemo(() => {
    // 띠의 가운데 선. 바닥을 따라가다가 한쪽 끝에서 말려 올라가 물결 모양 윗면이 된다. 점은 (z, 높이)다.
    const line = new SplineCurve([
      new Vector2(0.36, 0.04),
      new Vector2(0.9, 0.035),
      new Vector2(1.36, 0.05),
      new Vector2(1.46, 0.17),
      new Vector2(1.34, 0.3),
      new Vector2(1.05, 0.27),
      new Vector2(0.75, 0.24),
      new Vector2(0.5, 0.31),
      new Vector2(0.34, 0.33),
    ])
    const points = line.getPoints(48)
    const half = 0.032
    const upper: Vector2[] = []
    const lower: Vector2[] = []
    points.forEach((point, index) => {
      // 앞뒤 점을 이은 방향에 직각으로 띠의 두께만큼 벌린다.
      const before = points[Math.max(0, index - 1)]
      const after = points[Math.min(points.length - 1, index + 1)]
      const along = new Vector2().subVectors(after, before).normalize()
      const across = new Vector2(-along.y, along.x).multiplyScalar(half)
      upper.push(new Vector2().addVectors(point, across))
      lower.push(new Vector2().subVectors(point, across))
    })
    return new Shape([...upper, ...lower.reverse()])
  }, [])
  return <Extruded shape={shape} depth={0.45} position={[6.75, 0, 0]} rotation={FACE_X} color={palette.rugLiving} />
}

// 고양이가 다니는 길 전체. House의 바닥 group 안에 넣는다.
export function CatWays() {
  const { livingBack, livingSide, bedroom, bedroomSteps } = CATWALK
  const hole = CAT_HOLE
  const wallFace = HOUSE.wingX + 0.125
  return (
    <group>
      <CatPole />
      {/* 거실 캣워크. 캣폴 맨 위 발판에서 시작해서 뒤쪽 벽과 왼쪽 벽을 따라 곡선 책장 위까지 간다. */}
      <WalkWithBridge walk={livingBack} />
      <Shelf minX={livingBack.maxX} maxX={livingSide.maxX} minZ={livingBack.minZ} maxZ={livingBack.maxZ} top={livingBack.top} />
      <Shelf minX={livingSide.minX} maxX={livingSide.maxX} minZ={livingBack.maxZ} maxZ={livingSide.maxZ} top={livingSide.top} />

      {/* 통로로 올라가는 디딤. 낮은 스툴과 높은 스툴과 통로 아래의 물결 스크래처 */}
      <LogStool x={6.55} z={-0.7} radius={0.25} height={0.4} />
      <LogStool x={6.55} z={-0.1} radius={0.3} height={0.75} />
      <WaveScratcher />

      {/* 통로의 침실 쪽. 벽에서 내민 디딤판과 문 쪽으로 붙여 놓은 원목 상자와 도넛 방석 */}
      <Shelf minX={wallFace + 0.03} maxX={hole.ledgeMaxX} minZ={hole.minZ - 0.05} maxZ={hole.maxZ + 0.05} top={hole.bottom} />
      <Box size={[0.5, 0.48, 0.6]} position={[7.45, 0.24, 1.15]} color={palette.oak} />
      <mesh position={[7.45, 0.54, 1.15]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.17, 0.07, 8, 20]} />
        <meshStandardMaterial color={palette.fabric} flatShading roughness={1} />
      </mesh>
      <Cylinder radius={0.15} height={0.06} position={[7.45, 0.51, 1.15]} color={palette.wall} />

      {/* 침실 계단 선반과 침대 머리 쪽 벽의 캣워크 */}
      {bedroomSteps.map((step) => (
        <Shelf key={step.top} {...step} />
      ))}
      <WalkWithBridge walk={bedroom} />
    </group>
  )
}
