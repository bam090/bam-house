import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Path, SRGBColorSpace, Shape } from 'three'
import type { Group } from 'three'
import { Box } from './Box'
import { CatWays } from './CatWays'
import { WingRooms } from './InteriorRooms'
import { Decor } from './Decor'
import { Lamps } from './Lamps'
import { palette } from './palette'
import { Cylinder, Extruded, FACE_X, Faucet, Glow, LAY_FLAT, arcBand } from './Shapes'
import { CEILING_HEIGHT, HOUSE, SOFA } from './walkable'

// 집 안의 가구를 그리는 파일이다. 좌표는 장면 좌표이고 높이는 거실 바닥에서 잰 값이다.
// 자리와 크기는 docs/house-spec.md 4번과 같다. 걷기 규칙(walkable.ts)의 윗면 높이도 같은 값을 쓴다.

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
      {/* 인덕션. 상판에 넣은 흰 유리 판과 옅은 회색 화구 표시 셋 */}
      <Box size={[0.5, 0.012, 0.7]} position={[-7.47, 0.95, 2.5]} color={palette.white} roughness={0.2} castShadow={false} />
      {[
        { x: -7.56, z: 2.3, radius: 0.1 },
        { x: -7.56, z: 2.7, radius: 0.1 },
        { x: -7.36, z: 2.5, radius: 0.075 },
      ].map((burner) => (
        // ringGeometry는 가운데가 빈 납작한 고리다. 세워진 채로 만들어지므로 x축으로 -90도 돌려 눕힌다.
        <mesh key={`${burner.x}-${burner.z}`} position={[burner.x, 0.96, burner.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[burner.radius - 0.012, burner.radius, 28]} />
          <meshStandardMaterial color={palette.greige} roughness={0.4} />
        </mesh>
      ))}
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

      {/* 벽 선반과 조리대 위의 물건은 Decor.tsx에서 그린다. */}
    </group>
  )
}

/** 아치 벽. 뒤쪽 벽 앞에 덧댄 크림색 벽체이고 통유리창 자리에는 세우지 않는다. */
// 오른쪽 끝은 침실 쪽 벽의 거실 면(x 6.875)까지 채워서 모서리가 끊기지 않게 한다.
const ARCH_WALL = { minX: -4.6, maxX: HOUSE.wingX - 0.125, back: HOUSE.minZ + 0.125, front: -5.45 } as const

/** 아치 벽감 셋. 폭과 꼭대기 높이가 서로 다르다. shelves는 선반 윗면의 높이다. */
const NICHES = [
  { minX: -4.3, maxX: -2.9, top: 2.65, shelves: [1.5, 2.0, 2.3], glow: true },
  { minX: -2.5, maxX: -1.8, top: 2.5, shelves: [1.5, 2.0], glow: false },
  { minX: 4.9, maxX: 5.9, top: 2.65, shelves: [1.5, 2.0, 2.3], glow: true },
] as const

/** 벽감 바닥의 높이. 낮은 장의 상판(0.7m)과 겹쳐 보이지 않도록 0.3m 위에서 시작한다. */
const NICHE_BOTTOM = 1.0

/** 낮은 장. 아치 벽 앞에 놓는다. */
const CONSOLE = { minX: -4.4, maxX: 6.2, back: -5.45, front: -5.0, top: 0.7 } as const

/** TV 화면. 가운데 x 좌표와 크기와 아랫변 높이다. */
const TV = { x: 1.5, width: 3.2, height: 1.68, bottom: 0.9, frame: 0.12 } as const

// 모서리가 둥근 네모 윤곽을 그린다. 낮은 장의 구멍과 TV 테두리에 쓴다.
function roundedRect<T extends Path>(path: T, minX: number, minY: number, maxX: number, maxY: number, radius: number) {
  path.moveTo(minX + radius, minY)
  path.lineTo(maxX - radius, minY)
  path.quadraticCurveTo(maxX, minY, maxX, minY + radius)
  path.lineTo(maxX, maxY - radius)
  path.quadraticCurveTo(maxX, maxY, maxX - radius, maxY)
  path.lineTo(minX + radius, maxY)
  path.quadraticCurveTo(minX, maxY, minX, maxY - radius)
  path.lineTo(minX, minY + radius)
  path.quadraticCurveTo(minX, minY, minX + radius, minY)
  return path
}

// 거실 뒤쪽의 아치 벽. 크림색 벽체에 위가 둥근 벽감 셋을 파고 안에 나무 선반을 단다.
function ArchWall() {
  const { minX, maxX, back, front } = ARCH_WALL
  const shape = useMemo(() => {
    const wall = new Shape()
    wall.moveTo(minX, 0)
    wall.lineTo(maxX, 0)
    wall.lineTo(maxX, CEILING_HEIGHT)
    wall.lineTo(minX, CEILING_HEIGHT)
    wall.lineTo(minX, 0)
    for (const niche of NICHES) {
      const radius = (niche.maxX - niche.minX) / 2
      const hole = new Path()
      hole.moveTo(niche.minX, NICHE_BOTTOM)
      hole.lineTo(niche.maxX, NICHE_BOTTOM)
      hole.lineTo(niche.maxX, niche.top - radius)
      // 벽감의 위쪽은 반원이다.
      hole.absarc((niche.minX + niche.maxX) / 2, niche.top - radius, radius, 0, Math.PI, false)
      hole.lineTo(niche.minX, NICHE_BOTTOM)
      wall.holes.push(hole)
    }
    return wall
  }, [minX, maxX])

  return (
    <group>
      <Extruded shape={shape} depth={front - back} position={[0, 0, back]} color={palette.wall} />
      {NICHES.map((niche) => {
        const width = niche.maxX - niche.minX
        const center = (niche.minX + niche.maxX) / 2
        const radius = width / 2
        const spring = niche.top - radius
        return (
          <group key={niche.minX}>
            {/* 벽감 안쪽의 밝은 오크 뒤판 */}
            <Box
              size={[width, niche.top - NICHE_BOTTOM, 0.02]}
              position={[center, (niche.top + NICHE_BOTTOM) / 2, back + 0.012]}
              color={palette.oakLight}
              castShadow={false}
            />
            {niche.shelves.map((top) => {
              // 반원 구간에 걸친 선반은 벽감의 폭이 좁아지는 만큼 짧게 한다.
              const rise = Math.max(0, top - spring)
              const span = rise > 0 ? 2 * Math.sqrt(radius * radius - rise * rise) : width
              return (
                <Box
                  key={top}
                  size={[span, 0.04, front - back - 0.06]}
                  position={[center, top - 0.02, (back + front) / 2]}
                  color={palette.oak}
                />
              )
            })}
            {/* 맨 위 선반 아래의 간접 조명 띠 */}
            {niche.glow && <Glow size={[width * 0.6, 0.02, 0.03]} position={[center, niche.shelves[niche.shelves.length - 1] - 0.05, back + 0.06]} />}
          </group>
        )
      })}
    </group>
  )
}

// 아치 벽 앞의 낮은 장. 앞면에 폭이 다른 둥근 구멍을 뚫고 앞 가장자리가 물결 모양인 통나무 상판을 얹는다.
function LowConsole() {
  const { minX, maxX, back, front, top } = CONSOLE
  const shapes = useMemo(() => {
    const body = roundedRect(new Shape(), minX, 0.04, maxX, top - 0.08, 0.1)
    // 구멍의 폭을 번갈아 바꿔서 칸마다 모양이 다르게 한다.
    const widths = [1.5, 0.7, 1.9, 0.8, 1.6, 0.7, 1.3]
    let x = minX + 0.2
    for (const width of widths) {
      const height = width < 1 ? 0.36 : 0.4
      const bottom = 0.14
      body.holes.push(roundedRect(new Path(), x, bottom, x + width, bottom + height, height / 2 - 0.01))
      x += width + 0.2
    }

    // 상판은 위에서 본 윤곽이다. 뒤쪽은 곧고 앞쪽은 물결 모양이다. 눕혀 쓰므로 점을 (x, -z)로 적는다.
    const slab = new Shape()
    slab.moveTo(minX - 0.05, -back)
    slab.lineTo(maxX + 0.05, -back)
    const steps = 48
    for (let index = 0; index <= steps; index += 1) {
      const px = maxX + 0.05 - ((maxX - minX + 0.1) * index) / steps
      const wave = 0.035 * Math.sin(px * 1.9) + 0.02 * Math.sin(px * 4.3 + 1)
      slab.lineTo(px, -(front + 0.03 + wave))
    }
    slab.lineTo(minX - 0.05, -back)
    return { body, slab }
  }, [minX, maxX, back, front, top])

  return (
    <group>
      <Extruded shape={shapes.body} depth={front - back} position={[0, 0, back]} color={palette.sofaWood} />
      <Box
        size={[maxX - minX - 0.1, top - 0.2, 0.02]}
        position={[(minX + maxX) / 2, top / 2 - 0.02, back + 0.012]}
        color={palette.oakLight}
        castShadow={false}
      />
      <Extruded shape={shapes.slab} depth={0.08} position={[0, top - 0.08, 0]} rotation={LAY_FLAT} color={palette.oak} />
    </group>
  )
}

// TV 화면에 띄우는 밤하우스 썸네일을 그린다. 그림 파일을 쓰지 않고 canvas에 직접 그린다.
// canvas는 브라우저가 주는 2D 그림판이고 CanvasTexture는 그 그림을 3D 물체의 표면에 붙이는 Three.js 기능이다.
function makeThumbnail() {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 570
  const pen = canvas.getContext('2d')
  if (pen) {
    const { width, height } = canvas
    // 하늘과 해
    pen.fillStyle = '#cfeaf7'
    pen.fillRect(0, 0, width, height)
    pen.fillStyle = '#fbf3d6'
    pen.beginPath()
    pen.arc(880, 120, 54, 0, Math.PI * 2)
    pen.fill()
    // 바다. 먼 쪽은 짙고 물가는 옥색이다.
    pen.fillStyle = palette.sea
    pen.fillRect(0, 300, width, 80)
    pen.fillStyle = palette.seaMid
    pen.fillRect(0, 352, width, 40)
    pen.fillStyle = palette.seaShallow
    pen.fillRect(0, 380, width, 26)
    // 모래사장과 잔디 언덕
    pen.fillStyle = palette.sand
    pen.fillRect(0, 400, width, 50)
    pen.fillStyle = palette.grass
    pen.beginPath()
    pen.ellipse(400, 600, 760, 250, 0, 0, Math.PI * 2)
    pen.fill()
    // 언덕 위의 집. 얇은 지붕과 크림색 벽과 유리문
    pen.fillStyle = palette.wall
    pen.fillRect(250, 316, 330, 74)
    pen.fillStyle = palette.glass
    pen.fillRect(270, 330, 150, 60)
    pen.fillStyle = palette.oak
    pen.fillRect(232, 302, 366, 16)
    pen.fillRect(340, 330, 6, 60)
    pen.fillStyle = palette.stone
    pen.fillRect(214, 390, 400, 14)
    // 집 옆의 나무
    pen.fillStyle = palette.leafDark
    for (const [x, y, r] of [[170, 330, 46], [120, 372, 36], [660, 352, 40]]) {
      pen.beginPath()
      pen.arc(x, y, r, 0, Math.PI * 2)
      pen.fill()
    }
    // 흰 고양이. 몸과 머리와 귀와 꼬리와 파란 눈
    pen.fillStyle = palette.white
    pen.beginPath()
    pen.ellipse(860, 478, 46, 56, 0, 0, Math.PI * 2)
    pen.fill()
    pen.beginPath()
    pen.arc(860, 404, 38, 0, Math.PI * 2)
    pen.fill()
    pen.beginPath()
    pen.moveTo(828, 388)
    pen.lineTo(834, 348)
    pen.lineTo(858, 374)
    pen.moveTo(892, 388)
    pen.lineTo(886, 348)
    pen.lineTo(862, 374)
    pen.fill()
    pen.lineWidth = 16
    pen.lineCap = 'round'
    pen.strokeStyle = palette.white
    pen.beginPath()
    pen.moveTo(900, 512)
    pen.quadraticCurveTo(960, 500, 950, 440)
    pen.stroke()
    pen.fillStyle = palette.blue
    for (const x of [846, 874]) {
      pen.beginPath()
      pen.arc(x, 402, 6, 0, Math.PI * 2)
      pen.fill()
    }
    // 제목
    pen.fillStyle = '#5a4a30'
    pen.font = '700 96px "Helvetica Neue", Arial, sans-serif'
    pen.textAlign = 'left'
    pen.fillText('BAM HOUSE', 70, 170)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

// 아치 벽 가운데에 건 TV. 꿀색 오크 테두리 안에 썸네일 화면을 넣는다.
function Television() {
  const { x, width, height, bottom, frame } = TV
  const z = ARCH_WALL.front
  const thumbnail = useMemo(makeThumbnail, [])
  const shape = useMemo(() => {
    const outer = roundedRect(new Shape(), x - width / 2 - frame, bottom - frame, x + width / 2 + frame, bottom + height + frame, 0.1)
    const hole = new Path()
    hole.moveTo(x - width / 2, bottom)
    hole.lineTo(x + width / 2, bottom)
    hole.lineTo(x + width / 2, bottom + height)
    hole.lineTo(x - width / 2, bottom + height)
    hole.lineTo(x - width / 2, bottom)
    outer.holes.push(hole)
    return outer
  }, [x, width, height, bottom, frame])

  return (
    <group>
      <Extruded shape={shape} depth={0.07} position={[0, 0, z]} color={palette.oak} />
      {/* 화면은 조명과 상관없이 제 색으로 보이게 한다. */}
      <mesh position={[x, bottom + height / 2, z + 0.03]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={thumbnail} toneMapped={false} />
      </mesh>
    </group>
  )
}

// 통나무 조명. 굵기가 다른 줄기 둘 사이의 틈에서 빛이 난다.
function LogLamp() {
  return (
    <group position={[6.5, 0, -5.2]}>
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
      {/* 칸마다 뒤판을 따로 댄다. 한 장으로 대면 책장의 둥근 모서리 밖으로 뒤판이 튀어나온다. */}
      <Box size={[0.02, 0.62, 1.64]} position={[6.835, 0.41, -2.05]} color={palette.oakLight} castShadow={false} />
      <Box size={[0.02, 0.69, 1.64]} position={[6.835, 1.175, -2.05]} color={palette.oakLight} castShadow={false} />
      <Box size={[0.02, 0.44, 0.44]} position={[6.835, 1.8, -2]} color={palette.oakLight} castShadow={false} />
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
      // 방석과 나무 껍데기 사이의 빈틈을 메우는 띠. 이것이 없으면 소파 양 끝 단면에 네모난 구멍이 보인다.
      filler: arcBand(x, z, outer - 0.3, outer - 0.1, from + 1, to - 1),
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
      <Extruded shape={shapes.filler} depth={0.2} position={[0, 0.25, 0]} rotation={LAY_FLAT} color={palette.fabric} />
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
      <ArchWall />
      <LowConsole />
      <Television />
      <LogLamp />
      <CurvedBookcase />
      <Lounge />
      <CeilingFan />
      <WingRooms />
      <CatWays />
      <Lamps ceiling={CEILING_HEIGHT} />
      <Decor />
    </group>
  )
}
