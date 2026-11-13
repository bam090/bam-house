import { useMemo } from 'react'
import { Path, Shape } from 'three'
import { Box } from './Box'
import { palette } from './palette'
import { Cylinder, Extruded, FACE_X, Faucet, FlutedGlass, LAY_FLAT, Pot, arcBand } from './Shapes'
import { HOUSE } from './walkable'

// 침실과 욕실과 변기 칸의 가구를 그리는 파일이다. 좌표는 장면 좌표이고 높이는 방바닥에서 잰 값이다.
// 자리와 크기는 docs/house-spec.md 5번과 같다.

type Vec3 = [number, number, number]

// 주름 잡힌 리넨 커튼. 얇은 판을 앞뒤로 조금씩 어긋나게 세워서 주름을 낸다.
function Curtain({ along, at, from, to }: { along: 'x' | 'z'; at: number; from: number; to: number }) {
  const folds = Math.round((to - from) / 0.09)
  const width = (to - from) / folds
  return (
    <group>
      {Array.from({ length: folds }, (_, index) => {
        const run = from + width * (index + 0.5)
        const shift = index % 2 === 0 ? 0.025 : -0.025
        const position: Vec3 = along === 'x' ? [run, 1.7, at + shift] : [at + shift, 1.7, run]
        const size: Vec3 = along === 'x' ? [width, 3.3, 0.04] : [0.04, 3.3, width]
        return <Box key={index} size={size} position={position} color={palette.fabric} castShadow={false} />
      })}
    </group>
  )
}

// 침대. 머리가 욕실 쪽 칸막이 벽을 향한다. 낮은 나무 받침과 짙은 회색 옆 띠와 흰 누빔 윗면으로 쌓는다.
function Bed() {
  const x = 11.4
  const z = 0.225
  return (
    <group>
      <Box size={[2.2, 0.14, 2.15]} position={[x, 0.07, z]} color={palette.oak} />
      <Box size={[2.16, 0.26, 2.11]} position={[x, 0.27, z]} color={palette.charcoal} />
      <Box size={[2.2, 0.1, 2.15]} position={[x, 0.45, z]} color={palette.white} />
      {/* 누빔 줄 */}
      {[-0.55, -0.15].map((lineZ) => (
        <Box key={lineZ} size={[2.2, 0.004, 0.015]} position={[x, 0.502, lineZ]} color={palette.stoneDark} castShadow={false} />
      ))}
      {[-0.55, 0, 0.55].map((dx) => (
        <Box key={dx} size={[0.015, 0.004, 1.05]} position={[x + dx, 0.502, -0.325]} color={palette.stoneDark} castShadow={false} />
      ))}
      {/* 머리판은 윗면보다 0.1m 높은 턱만 둔다. */}
      <Box size={[2.2, 0.6, 0.07]} position={[x, 0.3, -0.885]} color={palette.oak} />
      {/* 큰 크림색 베개 둘과 가운데 그린 쿠션 */}
      {[-0.52, 0.52].map((dx) => (
        <Box key={dx} size={[0.88, 0.16, 0.5]} position={[x + dx, 0.58, -0.55]} color={palette.fabric} />
      ))}
      <Box size={[0.42, 0.3, 0.12]} position={[x, 0.66, -0.3]} rotation={[-0.3, 0, 0]} color={palette.green} />
      {/* 크림색 이불은 발치 쪽 절반만 덮는다. */}
      <Box size={[2.26, 0.1, 1.1]} position={[x, 0.55, 0.77]} color={palette.fabric} />
      {/* 비스듬히 걸친 그린 담요와 한쪽 끝의 술 장식 */}
      <group position={[x + 0.1, 0.615, 0.62]} rotation={[0, 0.5, 0]}>
        <Box size={[0.62, 0.03, 1.3]} position={[0, 0, 0]} color={palette.green} />
        {[-0.26, -0.13, 0, 0.13, 0.26].map((dx) => (
          <Box key={dx} size={[0.035, 0.03, 0.1]} position={[dx, 0, 0.7]} color={palette.green} castShadow={false} />
        ))}
      </group>
    </group>
  )
}

function Bedroom() {
  const shapes = useMemo(() => {
    // 고리 콘솔의 다리. 둥근 고리를 앞에서 본 윤곽이다.
    const ring = new Shape()
    ring.absarc(0, 0.375, 0.375, 0, Math.PI * 2, false)
    const hole = new Path()
    hole.absarc(0, 0.375, 0.3, 0, Math.PI * 2, true)
    ring.holes.push(hole)
    return { ring, chairBack: arcBand(10.6, 4.8, 0.38, 0.5, 195, 345) }
  }, [])

  return (
    <group>
      <Box size={[4, 0.02, 3.7]} position={[11.4, 0.011, 1.15]} color={palette.rugBedroom} castShadow={false} />
      <Bed />
      {/* 협탁 둘 */}
      {[10.05, 12.75].map((x) => (
        <Box key={x} size={[0.4, 0.45, 0.45]} position={[x, 0.225, -0.575]} color={palette.oak} />
      ))}
      {/* 침대 오른쪽 구석의 바닥 조명은 없앴다. 그 자리에 S자 캣타워가 있다(CatWays.tsx). */}
      {/* 벽시계. 검은 철사 고리 두 겹과 나무 축과 바늘 둘 */}
      <group position={[10.05, 1.9, -0.86]}>
        {[0.45, 0.36].map((radius) => (
          <mesh key={radius}>
            <torusGeometry args={[radius - 0.012, 0.012, 6, 40]} />
            <meshStandardMaterial color={palette.columnCap} roughness={0.6} />
          </mesh>
        ))}
        <Cylinder radius={0.045} height={0.06} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} color={palette.oak} />
        <Box size={[0.02, 0.3, 0.012]} position={[0.06, 0.12, 0.02]} rotation={[0, 0, -0.45]} color={palette.columnCap} />
        <Box size={[0.02, 0.2, 0.012]} position={[-0.08, 0.04, 0.02]} rotation={[0, 0, 1.1]} color={palette.columnCap} />
      </group>
      {/* 안락의자. 둥근 방석에 반원 등받이를 세운다. 등받이가 방 안쪽(-z)에 있어서 앉으면 바다를 본다. */}
      <Cylinder radius={0.5} height={0.42} position={[10.6, 0.21, 4.8]} color={palette.wall} />
      <Extruded shape={shapes.chairBack} depth={0.4} position={[0, 0.42, 0]} rotation={LAY_FLAT} color={palette.wall} />
      {/* 안락의자 옆의 작은 원형 원목 탁자와 책과 컵 */}
      <Cylinder radius={0.22} height={0.03} position={[11.4, 0.435, 5.0]} color={palette.oak} />
      <Cylinder radius={0.03} height={0.4} position={[11.4, 0.22, 5.0]} color={palette.oak} />
      <Cylinder radius={0.14} height={0.02} position={[11.4, 0.01, 5.0]} color={palette.oak} />
      <Box size={[0.2, 0.03, 0.14]} position={[11.36, 0.465, 5.04]} rotation={[0, 0.3, 0]} color={palette.green} />
      <Cylinder radius={0.035} height={0.07} position={[11.5, 0.485, 4.92]} color={palette.white} />
      {/* 이동식 스탠드 화면. 둥근 받침과 기둥과 평평한 판 */}
      <group position={[12.6, 0, 3.6]}>
        <Cylinder radius={0.25} height={0.04} position={[0, 0.02, 0]} color={palette.white} />
        {/* 기둥은 흰 뒤판 뒤에 세운다. 화면과 같은 자리에 세우면 검은 화면 앞으로 튀어나온다. */}
        <Cylinder radius={0.025} height={1.1} position={[0, 0.59, 0.06]} color={palette.white} />
        <Box size={[0.8, 0.5, 0.025]} position={[0, 1.2, 0.02]} color={palette.white} />
        <Box size={[0.76, 0.46, 0.02]} position={[0, 1.2, 0]} color={palette.blackGlass} roughness={0.2} />
      </group>
      {/* 타워형 공기청정기 */}
      <Cylinder radius={0.16} height={1} position={[13.4, 0.5, 5.3]} color={palette.white} />
      <Cylinder radius={0.12} height={0.01} position={[13.4, 1.005, 5.3]} color={palette.charcoal} />
      {/* 고리 콘솔과 화병 둘 */}
      <Box size={[1.8, 0.05, 0.35]} position={[8.2, 0.775, 5.625]} color={palette.oak} />
      {[7.75, 8.65].map((x) => (
        <Extruded key={x} shape={shapes.ring} depth={0.3} position={[x, 0, 5.475]} color={palette.oak} />
      ))}
      <Cylinder radius={0.1} radiusTop={0.05} height={0.36} position={[7.75, 0.98, 5.62]} color={palette.wall} />
      <Cylinder radius={0.07} radiusTop={0.09} height={0.2} position={[8.1, 0.9, 5.62]} color={palette.green} />
      {/* 큰 화분 */}
      <Pot position={[7.55, 0, 4.95]} radius={0.3} height={0.55} scale={1.6} seed={41} shape="cylinder" color={palette.greige} />
      {/* 유리문 양 끝의 크림색 리넨 커튼 */}
      <Curtain along="x" at={5.78} from={9.3} to={9.85} />
      <Curtain along="x" at={5.78} from={13.25} to={13.8} />
      <Curtain along="z" at={13.8} from={1.6} to={2.15} />
    </group>
  )
}

// 구불구불한 나무 틀 거울. 벽에서 본 윤곽에 타원 구멍을 뚫고 그 안에 거울을 넣는다.
function WavyMirror({ z }: { z: number }) {
  const shape = useMemo(() => {
    const frame = new Shape()
    for (let index = 0; index <= 60; index += 1) {
      const angle = (index / 60) * Math.PI * 2
      const wobble = 1 + 0.08 * Math.sin(angle * 6)
      const pz = Math.cos(angle) * 0.42 * wobble
      const py = 1.75 + Math.sin(angle) * 0.56 * wobble
      if (index === 0) frame.moveTo(pz, py)
      else frame.lineTo(pz, py)
    }
    const hole = new Path()
    hole.absellipse(0, 1.75, 0.3, 0.43, 0, Math.PI * 2, true, 0)
    frame.holes.push(hole)
    return frame
  }, [])
  return (
    <group position={[HOUSE.wingX + 0.125, 0, z]}>
      <Extruded shape={shape} depth={0.04} position={[0.045, 0, 0]} rotation={FACE_X} color={palette.oak} />
      {/* 거울 유리. 틀 구멍보다 조금 큰 타원이라서 가장자리가 틀 안에 묻힌다. 네모로 만들면 모서리가 물결 틀 밖으로 튀어나온다. */}
      {/* 원기둥을 옆으로 눕힌 뒤 위아래와 앞뒤를 다르게 늘려서 납작한 타원 판을 만든다. */}
      <mesh position={[0.012, 1.75, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.47, 1, 0.34]}>
        <cylinderGeometry args={[1, 1, 0.01, 32]} />
        <meshStandardMaterial color={palette.glass} roughness={0.05} />
      </mesh>
    </group>
  )
}

function Bathroom() {
  const tub = { minX: 10.9, maxX: 13.9, minZ: -5.85, maxZ: -4.25, height: 0.55, water: 0.45 }
  const tubX = (tub.minX + tub.maxX) / 2
  const tubZ = (tub.minZ + tub.maxZ) / 2
  return (
    <group>
      {/* 바닥의 0.6m 격자 줄눈 */}
      {Array.from({ length: 11 }, (_, index) => (
        <Box key={index} size={[0.015, 0.004, 5]} position={[7.6 + index * 0.6, 0.003, -3.5]} color={palette.stoneDark} castShadow={false} />
      ))}
      {Array.from({ length: 7 }, (_, index) => (
        <Box key={index} size={[7, 0.004, 0.015]} position={[10.5, 0.003, -5.4 + index * 0.6]} color={palette.stoneDark} castShadow={false} />
      ))}

      {/* 욕조. 돌 턱 네 면이 물을 두르고 물은 턱보다 0.1m 낮다. */}
      <Box size={[3, tub.height, 0.15]} position={[tubX, tub.height / 2, tub.maxZ - 0.075]} color={palette.counter} />
      <Box size={[3, tub.height, 0.15]} position={[tubX, tub.height / 2, tub.minZ + 0.075]} color={palette.counter} />
      {[tub.minX + 0.1, tub.maxX - 0.1].map((x) => (
        <Box key={x} size={[0.2, tub.height, 1.3]} position={[x, tub.height / 2, tubZ]} color={palette.counter} />
      ))}
      <Box size={[2.6, 0.1, 1.3]} position={[tubX, 0.05, tubZ]} color={palette.white} />
      <Box size={[2.6, 0.02, 1.3]} position={[tubX, tub.water - 0.01, tubZ]} color={palette.water} opacity={0.5} roughness={0.1} />
      <Faucet position={[tub.maxX - 0.1, tub.height, tubZ]} height={0.28} reach={0.22} turn={Math.PI} />

      {/* 세면대. 흰 대야 둘과 흰 수전 둘과 나무 틀 거울 둘 */}
      <Box size={[0.65, 0.85, 2.8]} position={[7.475, 0.425, -3.9]} color={palette.oak} />
      <Box size={[0.65, 0.05, 2.8]} position={[7.475, 0.875, -3.9]} color={palette.counter} />
      {[-4.6, -3.2].map((z) => (
        <group key={z}>
          <Cylinder radius={0.16} radiusTop={0.21} height={0.11} position={[7.53, 0.955, z]} color={palette.white} />
          <Faucet position={[7.24, 0.9, z]} height={0.3} reach={0.16} />
          <WavyMirror z={z} />
        </group>
      ))}

      {/* 샤워 칸. 세로줄 유리 칸막이와 흰 레인 샤워기 */}
      <Box size={[1.7, 0.02, 1.7]} position={[13.05, 0.011, -2]} color={palette.stoneDark} castShadow={false} />
      <FlutedGlass along="x" at={-2.9} from={12.2} to={13.9} height={2.2} />
      <Box size={[0.04, 1.2, 0.04]} position={[13.05, 1.6, -1.13]} color={palette.white} />
      <Box size={[0.04, 0.04, 0.6]} position={[13.05, 2.2, -1.42]} color={palette.white} />
      <Cylinder radius={0.18} height={0.03} position={[13.05, 2.165, -1.72]} color={palette.white} />

      {/* 수건 걸이 */}
      <Box size={[0.8, 0.03, 0.03]} position={[10.4, 1.3, -1.16]} color={palette.oak} />
      <Box size={[0.5, 0.6, 0.04]} position={[10.4, 1.02, -1.16]} color={palette.white} />
      {/* 나무 스툴과 화분. 스툴은 변기 칸 가는 길에 걸리지 않도록 수건 걸이 아래에 둔다. */}
      <Cylinder radius={0.17} radiusTop={0.2} height={0.45} position={[10.6, 0.225, -1.5]} color={palette.wood} />
      <Pot position={[8.4, 0, -5.4]} seed={42} shape="footed" color={palette.white} />
    </group>
  )
}

function ToiletRoom() {
  return (
    <group>
      {/* 벽에 붙은 일체형 흰 변기. 바닥에서 떠 있다. */}
      <Box size={[0.22, 0.5, 0.44]} position={[7.26, 0.35, -7.7]} color={palette.white} roughness={0.4} />
      <Box size={[0.28, 0.3, 0.4]} position={[7.5, 0.3, -7.7]} color={palette.white} roughness={0.4} />
      <Cylinder radius={0.2} height={0.3} position={[7.6, 0.3, -7.7]} color={palette.white} />
      <Cylinder radius={0.19} height={0.02} position={[7.6, 0.46, -7.7]} color={palette.wall} />
      {/* 가림벽과 나무 선반 두 단 */}
      <Box size={[0.15, 2.1, 1.45]} position={[8.525, 1.05, -7.625]} color={palette.wall} />
      {[1.2, 1.6].map((y) => (
        <Box key={y} size={[0.2, 0.03, 0.7]} position={[8.7, y, -7.35]} color={palette.oak} />
      ))}
      <Cylinder radius={0.05} radiusTop={0.03} height={0.18} position={[8.7, 1.305, -7.5]} color={palette.wall} />
      <Box size={[0.14, 0.1, 0.2]} position={[8.7, 1.665, -7.2]} color={palette.green} />
      {/* 손 씻는 대 자리에는 고양이 화장실 장이 있다(Decor.tsx). */}
      <Pot position={[10.5, 0, -6.6]} seed={43} />
    </group>
  )
}

// 침실 쪽 날개의 가구 전체
export function WingRooms() {
  return (
    <group>
      <Bedroom />
      <Bathroom />
      <ToiletRoom />
    </group>
  )
}
