import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Path, Shape } from 'three'
import type { Group } from 'three'
import { Box } from './Box'
import { WingRooms } from './InteriorRooms'
import { palette } from './palette'
import { Cylinder, Extruded, FACE_X, Faucet, Glow, LAY_FLAT, arcBand } from './Shapes'
import { CEILING_HEIGHT, HOUSE, SOFA } from './walkable'

// 집 안의 가구를 그리는 파일이다. 좌표는 장면 좌표이고 높이는 거실 바닥에서 잰 값이다.
// 자리와 크기는 docs/house-spec.md 4번과 같다. 걷기 규칙(walkable.ts)의 윗면 높이도 같은 값을 쓴다.

/** 뒤쪽 벽 선반에서 TV를 걸 자리로 비워 둔 범위 */
const TV_BAY = { minX: -1.5, maxX: 4.5, bottom: 0.7, top: 3.1 } as const

// 거실 오른쪽 앞의 주방. 벽으로 막지 않고 조리대와 아일랜드 식탁으로 영역을 나눈다.
function Kitchen() {
  const { minX, maxX, minZ, maxZ } = HOUSE.kitchen
  // 문짝과 가전 앞판은 장의 앞면보다 1cm 앞에 붙인다.
  const tallFace = -6.89
  const lowFace = -7.14
  return (
    <group>
      {/* 주방 바닥의 돌 타일 */}
      <Box
        size={[maxX - minX, 0.02, maxZ - minZ]}
        position={[(minX + maxX) / 2, 0.011, (minZ + maxZ) / 2]}
        color={palette.stone}
        castShadow={false}
      />

      {/* 키 큰 장. 냉장고와 오븐을 넣는다. */}
      <Box size={[0.9, 2.25, 1.6]} position={[-7.35, 1.125, -0.75]} color={palette.wall} />
      {/* 네 문 냉장고. 위 두 짝은 무광 흰색이고 아래 두 짝은 베이지다. 손잡이와 로고가 없다. */}
      {[-0.6625, -0.1875].map((z) => (
        <group key={z}>
          <Box size={[0.02, 1.28, 0.455]} position={[tallFace, 1.56, z]} color={palette.white} roughness={1} />
          <Box size={[0.02, 0.84, 0.455]} position={[tallFace, 0.48, z]} color={palette.fridgeLower} roughness={1} />
        </group>
      ))}
      {/* 오븐. 검은 유리 문 */}
      <Box size={[0.02, 0.46, 0.55]} position={[tallFace, 1.23, -1.225]} color={palette.blackGlass} roughness={0.2} />

      {/* 유리문을 따라 놓은 하부장과 상판 */}
      <Box size={[0.65, 0.9, 4.5]} position={[-7.475, 0.45, 2.35]} color={palette.greige} />
      <Box size={[0.65, 0.05, 4.5]} position={[-7.475, 0.925, 2.35]} color={palette.counter} />
      {/* 싱크대. 상판에 넣은 개수대와 흰 수전 */}
      <Box size={[0.36, 0.012, 0.62]} position={[-7.38, 0.95, 0.5]} color={palette.stoneDark} roughness={0.4} castShadow={false} />
      <Faucet position={[-7.65, 0.95, 0.5]} height={0.5} />
      {/* 식기세척기. 무광 흰색 평평한 문짝 */}
      <Box size={[0.02, 0.8, 0.56]} position={[lowFace, 0.46, 1.2]} color={palette.white} roughness={1} />
      {/* 정수기 */}
      <Box size={[0.3, 0.43, 0.2]} position={[-7.6, 1.165, 1.8]} color={palette.white} />
      <Box size={[0.1, 0.04, 0.08]} position={[-7.42, 1.28, 1.8]} color={palette.white} />
      {/* 인덕션. 상판에 넣은 검은 유리 판 */}
      <Box size={[0.5, 0.012, 0.7]} position={[-7.47, 0.95, 2.5]} color={palette.blackGlass} roughness={0.2} castShadow={false} />
      {/* 서랍 세 단의 틈 */}
      {[0.3, 0.6].map((y) => (
        <Box key={y} size={[0.02, 0.015, 0.96]} position={[lowFace, y, 3.4]} color={palette.stoneDark} castShadow={false} />
      ))}
      {/* 로봇청소기 자리. 하부장 아래를 비우고 청소기를 넣어 둔다. */}
      <Box size={[0.02, 0.18, 0.62]} position={[lowFace, 0.09, 4.25]} color={palette.charcoal} castShadow={false} />
      <Cylinder radius={0.17} height={0.09} position={[-7.1, 0.045, 4.25]} color={palette.white} />

      {/* 아일랜드 식탁과 의자 둘 */}
      <Box size={[0.9, 0.9, 3.6]} position={[-5.55, 0.45, 2.3]} color={palette.wall} />
      <Box size={[0.9, 0.05, 3.6]} position={[-5.55, 0.925, 2.3]} color={palette.counter} />
      {[1.5, 3.1].map((z) => (
        <group key={z} position={[-4.75, 0, z]}>
          <Cylinder radius={0.16} height={0.03} position={[0, 0.015, 0]} color={palette.oak} />
          <Cylinder radius={0.035} height={0.42} position={[0, 0.23, 0]} color={palette.oak} />
          <Cylinder radius={0.2} height={0.06} position={[0, 0.47, 0]} color={palette.oak} />
        </group>
      ))}

      {/* 크림색 벽에 단 나무 선반 두 단과 그 위의 그릇 */}
      {[1.2, 1.7].map((top) => (
        <Box key={top} size={[0.25, 0.04, 1.4]} position={[-7.725, top - 0.02, -2.85]} color={palette.oak} />
      ))}
      {[-3.3, -3.05, -2.4].map((z) => (
        <Cylinder key={z} radius={0.05} radiusTop={0.06} height={0.11} position={[-7.72, 1.255, z]} color={palette.white} />
      ))}
      <Cylinder radius={0.07} radiusTop={0.04} height={0.24} position={[-7.72, 1.82, -3.2]} color={palette.green} />
      <Box size={[0.16, 0.2, 0.3]} position={[-7.72, 1.8, -2.5]} color={palette.fabric} />
    </group>
  )
}

// 거실 뒤쪽 벽을 덮는 선반과 수납장. 가운데 TV 자리는 비워 둔다.
function ShelfWall() {
  const minX = HOUSE.minX + 0.2
  const maxX = 6.2
  const z = HOUSE.minZ + 0.35
  const sections = [
    { from: minX, to: TV_BAY.minX },
    { from: TV_BAY.maxX, to: maxX },
  ]
  const shelfHeights = [1.3, 1.9, 2.5, 3.1]

  return (
    <group>
      {/* 선반 뒤판과 아래 수납장 */}
      <Box size={[maxX - minX, 3.1, 0.04]} position={[(minX + maxX) / 2, 1.55, HOUSE.minZ + 0.15]} color={palette.oakLight} />
      <Box size={[maxX - minX, 0.7, 0.45]} position={[(minX + maxX) / 2, 0.35, z]} color={palette.greige} />
      {/* TV 자리. 4단계에서 여기에 대형 TV를 건다. */}
      <Box
        size={[TV_BAY.maxX - TV_BAY.minX, TV_BAY.top - TV_BAY.bottom, 0.05]}
        position={[(TV_BAY.minX + TV_BAY.maxX) / 2, (TV_BAY.bottom + TV_BAY.top) / 2, HOUSE.minZ + 0.17]}
        color={palette.wall}
      />
      {sections.map((section) => {
        const width = section.to - section.from
        const center = (section.from + section.to) / 2
        const dividers = Math.max(2, Math.round(width / 1.2) + 1)
        return (
          <group key={section.from}>
            {shelfHeights.map((y) => (
              <Box key={y} size={[width, 0.05, 0.4]} position={[center, y, z]} color={palette.oak} />
            ))}
            {Array.from({ length: dividers }, (_, index) => (
              <Box
                key={index}
                size={[0.05, 2.4, 0.4]}
                position={[section.from + (width * index) / (dividers - 1), 1.9, z]}
                color={palette.oak}
              />
            ))}
          </group>
        )
      })}
      {/* 선반 위의 화병과 책 */}
      {[-6.6, -4.3, -2.2, 5.0, 5.9].map((x, index) => (
        <Cylinder
          key={x}
          radius={0.09}
          radiusTop={0.05}
          height={0.34}
          position={[x, shelfHeights[index % 3] + 0.2, z]}
          color={index % 2 === 0 ? palette.wall : palette.oak}
        />
      ))}
      {[-5.5, -3.0, 5.5].map((x, index) => (
        <Box
          key={x}
          size={[0.4, 0.24, 0.2]}
          position={[x, shelfHeights[(index + 1) % 3] + 0.145, z]}
          color={index === 1 ? palette.fabric : palette.green}
        />
      ))}
    </group>
  )
}

// 통나무 조명. 굵기가 다른 줄기 둘 사이의 틈에서 빛이 난다.
function LogLamp() {
  return (
    <group position={[6.5, 0, -5.45]}>
      <Cylinder radius={0.1} radiusTop={0.08} height={1.8} position={[-0.08, 0.9, 0]} color={palette.oak} />
      <Cylinder radius={0.08} radiusTop={0.06} height={1.5} position={[0.1, 0.75, 0.04]} color={palette.wood} />
      <Glow size={[0.05, 1.3, 0.05]} position={[0.02, 0.8, 0.03]} />
      <pointLight position={[0, 1, 0.3]} intensity={3} distance={4} color="#ffd9a0" />
    </group>
  )
}

// 곡선 책장. 옆에서 본 윤곽에 모양이 다른 칸 세 개를 뚫어서 벽 쪽으로 밀어낸다.
function CurvedBookcase() {
  const shape = useMemo(() => {
    const outline = new Shape()
    outline.moveTo(-3, 0)
    outline.lineTo(-1.1, 0)
    outline.lineTo(-1.1, 1.55)
    outline.quadraticCurveTo(-1.1, 2.1, -1.75, 2.1)
    outline.lineTo(-2.6, 2.1)
    outline.quadraticCurveTo(-3, 2.1, -3, 1.75)
    outline.lineTo(-3, 0)

    // 아래 칸은 모서리가 둥근 네모다.
    const low = new Path()
    low.moveTo(-2.75, 0.12)
    low.lineTo(-1.35, 0.12)
    low.quadraticCurveTo(-1.25, 0.12, -1.25, 0.22)
    low.lineTo(-1.25, 0.6)
    low.quadraticCurveTo(-1.25, 0.7, -1.35, 0.7)
    low.lineTo(-2.75, 0.7)
    low.quadraticCurveTo(-2.85, 0.7, -2.85, 0.6)
    low.lineTo(-2.85, 0.22)
    low.quadraticCurveTo(-2.85, 0.12, -2.75, 0.12)

    // 가운데 칸은 위가 둥근 아치다.
    const middle = new Path()
    middle.moveTo(-2.85, 0.85)
    middle.lineTo(-1.25, 0.85)
    middle.lineTo(-1.25, 1.15)
    middle.quadraticCurveTo(-1.25, 1.5, -2.05, 1.5)
    middle.quadraticCurveTo(-2.85, 1.5, -2.85, 1.15)
    middle.lineTo(-2.85, 0.85)

    // 위 칸은 동그라미다.
    const high = new Path()
    high.absarc(-2, 1.8, 0.2, 0, Math.PI * 2, false)

    outline.holes.push(low, middle, high)
    return outline
  }, [])

  return (
    <group>
      <Extruded shape={shape} depth={0.35} position={[6.85, 0, 0]} rotation={FACE_X} color={palette.oak} />
      <Box size={[0.02, 2, 1.8]} position={[6.835, 1.02, -2.05]} color={palette.oakLight} castShadow={false} />
      {/* 칸 안의 책과 화병 */}
      <Box size={[0.2, 0.3, 0.5]} position={[6.7, 0.27, -2.4]} color={palette.fabric} />
      <Box size={[0.2, 0.24, 0.3]} position={[6.7, 0.24, -1.7]} color={palette.green} />
      <Cylinder radius={0.09} radiusTop={0.05} height={0.34} position={[6.68, 1.02, -2.3]} color={palette.wall} />
      <Box size={[0.2, 0.1, 0.36]} position={[6.7, 0.9, -1.65]} color={palette.wood} />
    </group>
  )
}

// 초승달 소파와 통나무 탁자와 러그
function Lounge() {
  const { x, z, inner, outer, from, to } = SOFA
  const shapes = useMemo(() => {
    // 통나무를 세로로 켠 탁자. 타원에 굴곡을 조금 넣어서 손으로 깎은 모양을 낸다.
    const table = new Shape()
    for (let index = 0; index <= 24; index += 1) {
      const angle = (index / 24) * Math.PI * 2
      const wobble = 1 + 0.07 * Math.sin(angle * 3 + 0.6)
      const px = 1.5 + Math.cos(angle) * 0.8 * wobble
      const pz = -0.85 + Math.sin(angle) * 0.4 * wobble
      if (index === 0) table.moveTo(px, -pz)
      else table.lineTo(px, -pz)
    }
    return {
      base: arcBand(x, z, inner, outer, from, to),
      seat: arcBand(x, z, inner + 0.03, outer - 0.3, from + 1, to - 1),
      shell: arcBand(x, z, outer - 0.1, outer, from, to),
      back: arcBand(x, z, outer - 0.32, outer - 0.1, from + 1, to - 1),
      table,
    }
  }, [x, z, inner, outer, from, to])

  return (
    <group>
      <Box size={[6.2, 0.02, 5.2]} position={[1.5, 0.011, -0.4]} color={palette.rugLiving} castShadow={false} />
      {/* 나무 몸통 위에 방석을 얹고 바깥 가장자리에 등받이를 세운다. 방석 윗면이 0.45m다. */}
      <Extruded shape={shapes.base} depth={0.23} position={[0, 0.02, 0]} rotation={LAY_FLAT} color={palette.sofaWood} />
      <Extruded shape={shapes.seat} depth={0.2} position={[0, 0.25, 0]} rotation={LAY_FLAT} color={palette.fabric} />
      <Extruded shape={shapes.shell} depth={0.6} position={[0, 0.25, 0]} rotation={LAY_FLAT} color={palette.sofaWood} />
      <Extruded shape={shapes.back} depth={0.38} position={[0, 0.45, 0]} rotation={LAY_FLAT} color={palette.fabric} />
      {/* 양 끝의 그린 쿠션 */}
      {[from + 7, to - 7].map((degree) => {
        const angle = (degree * Math.PI) / 180
        return (
          <Box
            key={degree}
            size={[0.46, 0.36, 0.16]}
            position={[x + Math.cos(angle) * 2.56, 0.64, z + Math.sin(angle) * 2.56]}
            rotation={[0, Math.PI / 2 - angle, 0]}
            color={palette.green}
          />
        )
      })}
      <Extruded shape={shapes.table} depth={0.33} position={[0, 0.02, 0]} rotation={LAY_FLAT} color={palette.wood} />
    </group>
  )
}

// 실링팬. 흰 날개 세 장이 3초에 한 바퀴 돌고 가운데에 조명이 달려 있다.
function CeilingFan() {
  const blades = useRef<Group>(null)
  // useFrame은 화면을 그릴 때마다 불리는 함수다. delta는 앞 화면에서 지난 시간(초)이다.
  useFrame((_, delta) => {
    if (blades.current) blades.current.rotation.y += ((Math.PI * 2) / 3) * delta
  })
  const bladeHeight = 3.1
  return (
    <group position={[1.5, 0, 0]}>
      <Cylinder radius={0.03} height={CEILING_HEIGHT - bladeHeight} position={[0, (CEILING_HEIGHT + bladeHeight) / 2, 0]} color={palette.white} />
      <Cylinder radius={0.14} height={0.12} position={[0, bladeHeight, 0]} color={palette.white} />
      <Glow size={[0.16, 0.05, 0.16]} position={[0, bladeHeight - 0.085, 0]} />
      <group ref={blades} position={[0, bladeHeight, 0]}>
        {[0, 1, 2].map((index) => (
          <group key={index} rotation={[0, (index / 3) * Math.PI * 2, 0]}>
            <Box size={[0.98, 0.02, 0.17]} position={[0.61, 0, 0]} color={palette.white} castShadow={false} />
          </group>
        ))}
      </group>
      {/* 거실 조명 하나를 실링팬 자리로 옮겼다. */}
      <pointLight position={[0, bladeHeight - 0.25, 0]} intensity={22} distance={16} color="#ffe2b8" />
    </group>
  )
}

// 집 안의 가구 전체. House의 바닥 group 안에 넣어서 바닥 높이만큼 함께 올라간다.
export function Interior() {
  return (
    <group>
      <Kitchen />
      <ShelfWall />
      <LogLamp />
      <CurvedBookcase />
      <Lounge />
      <CeilingFan />
      <WingRooms />
    </group>
  )
}
