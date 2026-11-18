import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { DoubleSide, PMREMGenerator, Shape, Vector2 } from 'three'
import type { Texture } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Box } from './Box'
import { LivingRoomModel } from './LivingRoomModel'
import { palette } from './palette'
import { Cylinder, Extruded, Glow, LAY_FLAT, Pot } from './Shapes'
import { Toys } from './Toys'
import { ARECA_PALM, BROWN_CUSHION, CAT_LITTER, CAT_LITTER_CUSHION, DECK_HEIGHT, FLOOR_HEIGHT, FLOOR_VASE, GREEN_CUSHIONS, OLIVE_TREE, groundHeight } from './walkable'

// 구역별 오브제와 고양이 용품을 그리는 파일이다. 높이는 모두 방바닥에서 잰다.
// 올라설 수 있는 큰 물건(벤치와 바닥 쿠션과 화장실 장 등)의 높이는 walkable.ts의 SURFACES에 따로 적는다.
// 부클레와 해초와 트래버틴 같은 재질은 색과 굵은 요철 모양으로만 흉내 낸다.
// 조명을 뺀 장식 오브제는 같은 모양이 두 번 나오지 않게 하나하나 따로 만든다.

type Spot = [number, number, number]
/** 옆에서 본 윤곽의 점 목록. 점마다 [가운데에서 잰 반지름, 바닥에서 잰 높이]다. */
type Profile = [number, number][]

// 윤곽을 세로축으로 한 바퀴 돌려서 만든 물체. 화병과 그릇과 초처럼 둥근 물건에 쓴다.
// latheGeometry는 옆에서 본 윤곽을 세로축으로 돌려서 입체를 만드는 three.js 도형이다. 도자기 물레와 같은 방식이다.
function Turned({ position, profile, color, segments = 16, opacity = 1, scale = [1, 1, 1] }: {
  position: Spot
  profile: Profile
  color: string
  segments?: number
  opacity?: number
  scale?: Spot
}) {
  const points = useMemo(() => profile.map(([radius, height]) => new Vector2(radius, height)), [profile])
  return (
    <mesh position={position} scale={scale} castShadow={opacity === 1} receiveShadow>
      <latheGeometry args={[points, segments]} />
      <meshStandardMaterial color={color} flatShading roughness={0.85} transparent={opacity < 1} opacity={opacity} side={DoubleSide} />
    </mesh>
  )
}

// 촛불. 초의 윗면에서 조금 띄운다.
function Flame({ position }: { position: Spot }) {
  return <Glow size={[0.012, 0.022, 0.012]} position={position} />
}

// 고리 모양. 손잡이와 띠에 쓴다. rotation으로 세우거나 눕힌다.
function Ring({ position, radius, tube, color, rotation = [Math.PI / 2, 0, 0], arc = Math.PI * 2 }: {
  position: Spot
  radius: number
  tube: number
  color: string
  rotation?: Spot
  arc?: number
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <torusGeometry args={[radius, tube, 6, 20, arc]} />
      <meshStandardMaterial color={color} flatShading roughness={0.9} />
    </mesh>
  )
}

// 화병과 병의 윤곽. 하나씩만 쓴다.
/** 팔각으로 깎은 원통 화병 */
const FACETED_CYLINDER: Profile = [[0, 0], [0.055, 0], [0.065, 0.02], [0.065, 0.28], [0.058, 0.3], [0, 0.3]]
/** 납작한 플라스크 병. 앞뒤로 눌러서 쓴다. */
const FLASK: Profile = [[0, 0], [0.03, 0], [0.07, 0.05], [0.075, 0.1], [0.06, 0.15], [0.02, 0.18], [0.02, 0.255], [0.024, 0.26], [0, 0.26]]
/** 구석에 세운 흙빛 바닥 화병. 아래가 불룩하고 목이 좁다. */
const FLOOR_VASE_PROFILE: Profile = [[0, 0], [0.12, 0], [0.2, 0.12], [0.22, 0.26], [0.17, 0.42], [0.1, 0.52], [0.09, 0.57], [0.11, 0.6], [0, 0.58]]
/** 팜파스 풀 줄기 넷. 길이와 기울기가 서로 다르다. 기울기는 x축과 z축으로 도는 각도다. */
const PAMPAS = [
  { length: 0.75, tiltX: 0.12, tiltZ: 0.28 },
  { length: 0.9, tiltX: -0.08, tiltZ: -0.05 },
  { length: 0.7, tiltX: -0.3, tiltZ: -0.22 },
  { length: 0.55, tiltX: 0.25, tiltZ: -0.35 },
]
/** 넓고 얕은 나무 그릇 */
const CARVED_BOWL: Profile = [[0, 0], [0.06, 0], [0.1, 0.02], [0.115, 0.045], [0.105, 0.05], [0, 0.03]]

// 바구니 넷. 모양이 서로 다르다.
// 둘레에 띠를 두른 해초 바구니
// 뚜껑과 꼭지가 있는 라탄 바구니
function LiddedBasket({ position }: { position: Spot }) {
  const [x, y, z] = position
  return (
    <group>
      <Cylinder radius={0.1} height={0.15} position={[x, y + 0.075, z]} color={palette.wood} />
      <Cylinder radius={0.11} radiusTop={0.07} height={0.035} position={[x, y + 0.168, z]} color={palette.woodDark} />
      <Turned position={[x, y + 0.185, z]} profile={[[0, 0], [0.018, 0], [0.022, 0.02], [0, 0.03]]} color={palette.woodDark} segments={8} />
    </group>
  )
}

// 양쪽에 손잡이 고리가 달린 낮은 바구니
function TrayBasket({ position }: { position: Spot }) {
  const [x, y, z] = position
  return (
    <group>
      <Cylinder radius={0.12} radiusTop={0.14} height={0.1} position={[x, y + 0.05, z]} color={palette.wetSand} />
      {[-1, 1].map((side) => (
        <Ring key={side} position={[x + side * 0.15, y + 0.1, z]} radius={0.03} tube={0.007} rotation={[0, 0, 0]} arc={Math.PI} color={palette.wood} />
      ))}
    </group>
  )
}

// 키 큰 빨래 바구니. 세로 짜임을 흉내 내려고 각을 적게 주고 위 테두리와 밧줄 손잡이를 단다.
function LaundryBasket({ position }: { position: Spot }) {
  const [x, y, z] = position
  return (
    <group>
      <mesh position={[x, y + 0.22, z]} castShadow receiveShadow>
        <cylinderGeometry args={[0.21, 0.18, 0.44, 9]} />
        <meshStandardMaterial color={palette.wood} flatShading roughness={1} />
      </mesh>
      <Ring position={[x, y + 0.44, z]} radius={0.205} tube={0.015} color={palette.woodDark} />
      {[-1, 1].map((side) => (
        <Ring key={side} position={[x + side * 0.2, y + 0.4, z]} radius={0.04} tube={0.008} rotation={[0, Math.PI / 2, 0]} arc={Math.PI} color={palette.rugLiving} />
      ))}
    </group>
  )
}

// 촛대 일곱. 모양이 서로 다르다.
// 굵고 낮은 기둥 초


// 구멍이 숭숭 난 트래버틴 받침 위의 초
function TravertineCandle({ position }: { position: Spot }) {
  const [x, y, z] = position
  return (
    <group>
      <Cylinder radius={0.06} radiusTop={0.05} height={0.07} position={[x, y + 0.035, z]} color={palette.roughStone} />
      <Cylinder radius={0.062} height={0.012} position={[x, y + 0.03, z]} color={palette.roughStoneDark} />
      <Cylinder radius={0.028} height={0.09} position={[x, y + 0.115, z]} color={palette.wall} />
      <Flame position={[x, y + 0.172, z]} />
    </group>
  )
}

// 둥근 받침과 가는 대와 잔이 있는 놋쇠 촛대
function BrassCandlestick({ position }: { position: Spot }) {
  const [x, y, z] = position
  return (
    <group>
      <Turned
        position={[x, y, z]}
        profile={[[0, 0], [0.05, 0], [0.05, 0.01], [0.012, 0.02], [0.01, 0.12], [0.022, 0.13], [0.022, 0.14], [0, 0.14]]}
        color={palette.column}
        segments={12}
      />
      <Cylinder radius={0.01} height={0.1} position={[x, y + 0.19, z]} color={palette.wall} />
      <Flame position={[x, y + 0.252, z]} />
    </group>
  )
}

// 유리병에 부은 초
function JarCandle({ position }: { position: Spot }) {
  const [x, y, z] = position
  return (
    <group>
      <Cylinder radius={0.033} height={0.05} position={[x, y + 0.026, z]} color={palette.fabric} />
      <mesh position={[x, y + 0.045, z]}>
        <cylinderGeometry args={[0.04, 0.04, 0.09, 14, 1, true]} />
        <meshStandardMaterial color={palette.glass} transparent opacity={0.4} roughness={0.1} side={DoubleSide} />
      </mesh>
      <Flame position={[x, y + 0.065, z]} />
    </group>
  )
}

// 넓고 낮은 심지 셋 초
function ThreeWickCandle({ position }: { position: Spot }) {
  const [x, y, z] = position
  return (
    <group>
      <Cylinder radius={0.07} height={0.06} position={[x, y + 0.03, z]} color={palette.oakLight} />
      {[0, 2.1, 4.2].map((angle) => (
        <Flame key={angle} position={[x + Math.cos(angle) * 0.032, y + 0.072, z + Math.sin(angle) * 0.032]} />
      ))}
    </group>
  )
}

// 도자기 접시 위의 낮은 초
function CandleInSaucer({ position }: { position: Spot }) {
  const [x, y, z] = position
  return (
    <group>
      <Turned position={[x, y, z]} profile={[[0, 0], [0.04, 0], [0.06, 0.012], [0.062, 0.016], [0, 0.008]]} color={palette.stoneDark} segments={14} />
      <Cylinder radius={0.03} height={0.04} position={[x, y + 0.03, z]} color={palette.wall} />
      <Flame position={[x, y + 0.062, z]} />
    </group>
  )
}

/** 책 묶음에 차례로 쓰는 색 */
const BOOK_COLORS = [palette.wall, palette.green, palette.greige, palette.rugBedroom]

// 눕혀서 쌓은 책 셋. 위로 갈수록 조금씩 작아지고 조금씩 돌아가 있다.
function StackedBooks({ position }: { position: Spot }) {
  const [x, y, z] = position
  return (
    <group position={[x, y, z]} rotation={[0, 0.1, 0]}>
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          size={[0.26 - index * 0.025, 0.035, 0.19 - index * 0.015]}
          position={[0, 0.0175 + index * 0.035, 0]}
          rotation={[0, index * 0.18, 0]}
          color={BOOK_COLORS[index]}
        />
      ))}
    </group>
  )
}

// 세워 꽂은 책 넷과 돌 북엔드
function StandingBooks({ position }: { position: Spot }) {
  const [x, y, z] = position
  const heights = [0.22, 0.19, 0.24, 0.2]
  return (
    <group>
      {heights.map((height, index) => (
        <Box key={index} size={[0.035, height, 0.16]} position={[x + index * 0.038, y + height / 2, z]} color={BOOK_COLORS[(index + 1) % BOOK_COLORS.length]} />
      ))}
      <Box size={[0.05, 0.12, 0.12]} position={[x + 0.18, y + 0.06, z]} color={palette.roughStone} />
    </group>
  )
}

// 작은 공 하나. 과일에 쓴다.
function Ball({ position, radius, color, scale = [1, 1, 1] }: { position: Spot; radius: number; color: string; scale?: Spot }) {
  return (
    <mesh position={position} scale={scale} castShadow>
      <sphereGeometry args={[radius, 10, 8]} />
      <meshStandardMaterial color={color} flatShading roughness={0.8} />
    </mesh>
  )
}

// 주방: 조리대 위와 벽 선반과 아일랜드 위
function KitchenDecor() {
  // 가장자리가 울퉁불퉁한 두꺼운 나무판. 위에서 본 윤곽이고 벽 쪽은 곧고 방 쪽만 구불구불하다.
  const slab = useMemo(() => {
    const shape = new Shape()
    const fromZ = -3.6
    const toZ = -2.1
    shape.moveTo(-7.85, -fromZ)
    for (let index = 0; index <= 20; index += 1) {
      const z = fromZ + ((toZ - fromZ) * index) / 20
      const edge = -7.57 + 0.03 * Math.sin(index * 1.3) + 0.02 * Math.sin(index * 0.5 + 1)
      shape.lineTo(edge, -z)
    }
    shape.lineTo(-7.85, -toZ)
    shape.closePath()
    return shape
  }, [])
  const counter = 0.95
  return (
    <group>
      <LivingRoomModel file="kitchen/cutting-board/cutting-boards-middle-pair-optimized.glb" x={-7.46} y={counter} z={1.32} turn={Math.PI / 2} width={0.40} originalMaterial />
      <LivingRoomModel file="kitchen/spice-jars/kitchen-set-8-glass-pots-stable.glb" x={-7.65} y={counter} z={3.2} turn={Math.PI / 2} width={0.405} originalMaterial />
      {/* 걸이 브래킷 뒤쪽을 정수기 옆판에 맞춘다. */}
      <LivingRoomModel file="kitchen/wooden-ladles-and-spoons/wooden-ladles-and-spoons-web.glb" x={-7.49} y={counter + 0.116} z={1.921} height={0.25} originalMaterial />
      <LivingRoomModel file="kitchen/coffee-machine/white-retro-coffee-machine-and-grinder-web.glb" x={-7.48} y={counter} z={4.12} width={0.72} turn={Math.PI / 2} originalMaterial castShadow={false} />
      <LivingRoomModel file="kitchen/dish-soap/dish-soap-matte.glb" x={-7.66} y={counter} z={0.83} height={0.18} turn={Math.PI / 2} originalMaterial castShadow={false} />

      {/* 벽 선반 두 단. 두꺼운 통나무 판 위에 병과 꽃병과 유리 화병과 초 쟁반과 겹친 그릇을 올린다. */}
      {[1.2, 1.7].map((top) => (
        <Extruded key={top} shape={slab} depth={0.07} position={[0, top - 0.07, 0]} rotation={LAY_FLAT} color={palette.sofaWood} />
      ))}
      <LivingRoomModel file="kitchen/decorative-bottle/green-glass-bottle-vase.glb" x={-7.71} y={1.2} z={-3.34} height={0.24} originalMaterial />
      <LivingRoomModel file="kitchen/glass-vase/green-ribbed-glass-vase.glb" x={-7.71} y={1.2} z={-2.61} height={0.21} originalMaterial />
      <LivingRoomModel file="kitchen/candle-tray/candle-and-essence-web.glb" x={-7.71} y={1.7} z={-2.52} width={0.20} originalMaterial />
      <LivingRoomModel file="kitchen/tea-set/tea-set.glb" x={-7.71} y={1.7} z={-3.19} turn={Math.PI / 2} width={0.61} maxDepth={0.24} originalMaterial />
      <LivingRoomModel file="kitchen/wooden-tray/wooden-serving-tray-web-512.glb" x={-5.55} y={counter} z={2.45} turn={Math.PI / 2} width={0.44} originalMaterial />
      <LivingRoomModel file="kitchen/ceramic-vase/matte-ceramic-organic-vase-web-mesh.glb" x={-5.55} y={counter + 0.012} z={2.4} height={0.23} originalMaterial />
      <LivingRoomModel file="kitchen/fruit-bowl/footed-fruit-bowl-bam.glb" x={-5.55} y={counter} z={3.35} width={0.31} originalMaterial />
      <Ball position={[-5.6, counter + 0.158, 3.32]} radius={0.04} color={palette.column} />
      <Ball position={[-5.5, counter + 0.16, 3.31]} radius={0.044} color={palette.leafLight} />
      <Ball position={[-5.55, counter + 0.156, 3.4]} radius={0.038} color={palette.sand} scale={[1.3, 1, 1]} />
      <LivingRoomModel file="kitchen/salad-bowl/wooden-salad-bowl-and-cutlery-scene-light-oak.glb" x={-5.55} y={counter} z={1.42} height={0.15} maxDepth={0.65} originalMaterial />
    </group>
  )
}

// 거실: 아치 벽감 안과 통나무 탁자 위와 바닥 쿠션과 큰 야자 화분과 왼쪽 벽의 추상화
function LivingDecor() {
  /** 벽감 안에서 물건을 놓는 z 좌표 */
  const nicheZ = -5.63
  const tableTop = (x: number, z: number) => groundHeight(x, z) - DECK_HEIGHT - FLOOR_HEIGHT
  return (
    <group>
      {/* 왼쪽 큰 벽감 (x -4.3~-2.9). 칸마다 한두 개만 놓아서 여백을 둔다. */}
      <LivingRoomModel file="living-room/niche-basket/niche-basket-coiled-fiber-optimized.glb" x={-3.95} y={1} z={nicheZ} width={0.29} castShadow={false} />
      <StackedBooks position={[-3.3, 1.0, nicheZ]} />
      <Turned position={[-3.7, 1.5, nicheZ]} profile={FACETED_CYLINDER} color={palette.wall} segments={8} />
      <TravertineCandle position={[-3.2, 1.5, nicheZ]} />
      {/* 가운데 작은 벽감 (x -2.5~-1.8) */}
      <LivingRoomModel file="living-room/niche-vase/niche-vase-matte-organic-web-mesh.glb" x={-2.15} y={1} z={nicheZ} width={0.3} height={0.34} castShadow={false} />
      <LiddedBasket position={[-2.15, 1.5, nicheZ]} />
      <BrassCandlestick position={[-2.15, 2.0, nicheZ]} />
      {/* 오른쪽 큰 벽감 (x 4.9~5.9) */}
      <StandingBooks position={[5.05, 1.0, nicheZ]} />
      <TrayBasket position={[5.62, 1.0, nicheZ]} />
      <Turned position={[5.55, 1.5, nicheZ]} profile={FLASK} color={palette.green} scale={[1, 1, 0.55]} />
      <Pot position={[5.15, 1.5, nicheZ]} radius={0.07} height={0.1} scale={0.4} seed={52} shape="bowl" color={palette.roughStone} />
      <JarCandle position={[5.4, 2.0, nicheZ]} />

      {/* 커피 테이블: 리모컨과 초와 작은 그릇 */}
      {/* 리모컨. 나중에 이것을 눌러서 TV 채널을 넘긴다. 흰 몸통 위에 전원 단추와 둥근 방향 단추가 있다. */}
      <group position={[1.15, tableTop(1.15, -0.88), -0.88]} rotation={[0, 0.35, 0]}>
        <Box size={[0.055, 0.02, 0.19]} position={[0, 0.01, 0]} color={palette.white} roughness={0.5} />
        <Cylinder radius={0.008} height={0.004} position={[0, 0.022, -0.07]} color={palette.column} />
        <Cylinder radius={0.018} height={0.004} position={[0, 0.022, -0.025]} color={palette.greige} />
        <Box size={[0.03, 0.004, 0.012]} position={[0, 0.022, 0.03]} color={palette.greige} />
        <Box size={[0.03, 0.004, 0.012]} position={[0, 0.022, 0.055]} color={palette.greige} />
      </group>
      <ThreeWickCandle position={[1.7, tableTop(1.7, -0.72), -0.72]} />
      <Turned position={[1.95, tableTop(1.95, -0.95), -0.95]} profile={CARVED_BOWL} color={palette.sofaWood} />

      <LivingRoomModel file="unassigned/floor-cushion/floor-cushion-green-boucle-stack-optimized.glb" {...GREEN_CUSHIONS} />
      <LivingRoomModel file="living-room/floor-cushion/floor-cushion-round-velvet-web-mesh.glb" {...BROWN_CUSHION} />
      {/* 거실 앞 왼쪽 쌍기둥 옆의 큰 야자 화분 */}
      <LivingRoomModel file="living-room/areca-palm/areca-palm-rattan-planter-web-blender.glb" {...ARECA_PALM} />
      {/* +Z 정면을 거실 안쪽으로 돌린다. */}
      <LivingRoomModel file="living-room/wall-art/wall-art-cream-wave-relief-web-baked.glb" x={6.82} y={0.9} z={-4.1} turn={-Math.PI / 2} height={1.3} castShadow={false} />

      {/* 장난감 공 둘은 고양이가 굴릴 수 있어서 Toys.tsx에서 따로 그린다. */}
      <Toys />

      <LivingRoomModel file="plants/olive-tree/olive-tree-planter-web-blender.glb" {...OLIVE_TREE} />
      {/* 주방 로봇청소기 옆의 바닥 화병과 팜파스 */}
      <Turned position={[FLOOR_VASE.x, FLOOR_VASE.y, FLOOR_VASE.z]} profile={FLOOR_VASE_PROFILE} color={palette.teak} segments={18} />
      {PAMPAS.map((stem, index) => (
        <group key={index} position={[FLOOR_VASE.x, FLOOR_VASE.y + 0.55, FLOOR_VASE.z]} rotation={[stem.tiltX, 0, stem.tiltZ]}>
          <Cylinder radius={0.006} height={stem.length} position={[0, stem.length / 2, 0]} color={palette.wetSand} />
          {/* 이삭. 공을 위아래로 늘려서 솜털 같은 끝을 만든다. */}
          <Ball position={[0, stem.length + 0.08, 0]} radius={0.05} color={palette.fabric} scale={[0.7, 2.2, 0.7]} />
        </group>
      ))}

    </group>
  )
}

// 침실: 침대 발치의 부클레 벤치와 니트 담요와 침대 위 벽의 액자 셋. 협탁 위에는 조명만 둔다.
function BedroomDecor() {
  return (
    <group>
      {/* 벤치. 원목 다리 넷과 틀 위에 도톰한 부클레 방석을 얹는다. 윗면이 0.42m다. */}
      {[10.7, 12.1].map((x) =>
        [1.52, 1.78].map((z) => <Box key={`${x}-${z}`} size={[0.06, 0.26, 0.06]} position={[x, 0.13, z]} color={palette.oak} />),
      )}
      <Box size={[1.6, 0.04, 0.4]} position={[11.4, 0.28, 1.65]} color={palette.oak} />
      <Box size={[1.56, 0.12, 0.38]} position={[11.4, 0.36, 1.65]} color={palette.fabric} roughness={1} />
      {/* 접은 니트 담요. 두 겹으로 접힌 모양 */}
      <Box size={[0.42, 0.05, 0.32]} position={[11.9, 0.445, 1.65]} color={palette.rugBedroom} roughness={1} />
      <Box size={[0.4, 0.05, 0.3]} position={[11.9, 0.495, 1.65]} color={palette.rugBedroom} roughness={1} />
      {/* 침대 위 벽의 액자 셋. 벽면(z -0.875)에 붙인다. 액자마다 안에 든 그림이 다르다. */}
      <group position={[10.95, 1.72, -0.875]}>
        <Box size={[0.36, 0.46, 0.03]} position={[0, 0, 0.015]} color={palette.oak} />
        <Box size={[0.3, 0.4, 0.01]} position={[0, 0, 0.033]} color={palette.wall} roughness={1} />
        <Box size={[0.14, 0.18, 0.006]} position={[0, -0.03, 0.04]} color={palette.green} />
      </group>
      <group position={[11.4, 1.72, -0.875]}>
        <Box size={[0.36, 0.46, 0.03]} position={[0, 0, 0.015]} color={palette.oak} />
        <Box size={[0.3, 0.4, 0.01]} position={[0, 0, 0.033]} color={palette.wall} roughness={1} />
        <Cylinder radius={0.08} height={0.006} position={[0, 0.05, 0.04]} rotation={[Math.PI / 2, 0, 0]} color={palette.wood} />
      </group>
      <group position={[11.85, 1.72, -0.875]}>
        <Box size={[0.36, 0.46, 0.03]} position={[0, 0, 0.015]} color={palette.oak} />
        <Box size={[0.3, 0.4, 0.01]} position={[0, 0, 0.033]} color={palette.wall} roughness={1} />
        <Box size={[0.2, 0.025, 0.006]} position={[0, 0.06, 0.04]} color={palette.greige} />
        <Box size={[0.2, 0.025, 0.006]} position={[0, -0.02, 0.04]} color={palette.greige} />
        <Box size={[0.2, 0.025, 0.006]} position={[0, -0.1, 0.04]} color={palette.greige} />
      </group>
    </group>
  )
}

// 욕실: 욕조 쟁반과 초와 병. 세면대 디스펜서와 접은 수건. 바닥 매트와 빨래 바구니와 원목 사다리 수건걸이
function BathroomDecor() {
  return (
    <group>
      {/* 욕조 턱 두 변에 걸친 원목 쟁반과 접시 위의 초와 네모난 목욕 오일 병 */}
      <Box size={[0.24, 0.025, 1.56]} position={[12.3, 0.5625, -5.05]} color={palette.oak} />
      <CandleInSaucer position={[12.3, 0.575, -5.25]} />
      <Box size={[0.055, 0.12, 0.055]} position={[12.3, 0.635, -4.9]} color={palette.green} />
      <Cylinder radius={0.012} height={0.03} position={[12.3, 0.71, -4.9]} color={palette.oak} />
      {/* 세면대: 대야 사이의 디스펜서와 끝에 접어 둔 수건 */}
      <LivingRoomModel file="bathroom/soap-dispenser/soap-dispenser-scene-oat-optimized.glb" x={7.49} y={0.9} z={-3.91} height={0.16} originalMaterial />
      {[0, 1].map((index) => (
        <Box key={index} size={[0.3 - index * 0.02, 0.05, 0.22 - index * 0.02]} position={[7.5, 0.925 + index * 0.05, -2.78]} color={palette.white} roughness={1} />
      ))}
      {/* 욕조 앞 바닥 매트 */}
      <LivingRoomModel file="bathroom/bath-mat/beige-fur-bathmat-ivory.glb" x={10.35} y={0.005} z={-3.12} width={1.25} maxDepth={1.25} originalMaterial />
      {/* 빨래 바구니. 변기 칸 가는 길에 걸리지 않도록 욕조 옆 구석에 둔다. */}
      <LaundryBasket position={[13.5, 0, -3.6]} />
    </group>
  )
}

// 앞면은 +z를 보고 측면 입구는 가림벽 쪽을 향한다.
function LitterCabinet() {
  const { minX, maxX, minZ, maxZ, top } = CAT_LITTER
  const cushion = CAT_LITTER_CUSHION
  const renderer = useThree((state) => state.gl)
  const [envMap, setEnvMap] = useState<Texture>()

  useEffect(() => {
    // 변기 칸의 간접광을 장 재질에도 반사시킨다. 반사가 없으면 황동 손잡이 정면이 거의 검게 보인다.
    const room = new RoomEnvironment()
    const generator = new PMREMGenerator(renderer)
    const reflections = generator.fromScene(room, 0.04, 0.1, 100, { size: 64 })
    room.dispose()
    generator.dispose()
    setEnvMap(reflections.texture)
    return () => reflections.dispose()
  }, [renderer])

  return (
    <group>
      <LivingRoomModel
        file="bathroom/cat-litter-cabinet/cat-litter-cabinet-oak-refined-optimized.glb"
        x={(minX + maxX) / 2}
        z={(minZ + maxZ) / 2}
        height={top}
        originalMaterial
        envMap={envMap}
        envMapIntensity={0.42}
      />
      <Box
        size={[cushion.width, cushion.thickness, cushion.depth]}
        position={[cushion.x, top + cushion.thickness / 2, cushion.z]}
        color={palette.wall}
        roughness={1}
      />
    </group>
  )
}

// 고양이 용품: 아일랜드 바다 쪽 끝의 식기와 변기 칸의 화장실 장
function CatGoods() {
  return (
    <group>
      {/* 경사진 오크 받침에 그릇 둘을 끼운 식기. 앞(+z)이 낮다. 아일랜드의 바다 쪽 끝 면(z 4.1)에 붙여 놓는다. */}
      <group position={[-5.55, 0, 4.225]} rotation={[0.18, 0, 0]}>
        <Box size={[0.5, 0.1, 0.22]} position={[0, 0.07, 0]} color={palette.oak} />
        {[-0.12, 0.12].map((x) => (
          <group key={x}>
            <Cylinder radius={0.075} radiusTop={0.085} height={0.03} position={[x, 0.13, 0]} color={palette.white} />
            <Cylinder radius={0.07} height={0.006} position={[x, 0.143, 0]} color={x < 0 ? palette.blue : palette.wood} />
          </group>
        ))}
      </group>
      <LitterCabinet />
    </group>
  )
}

// 오브제 전체. Interior에서 불러 넣는다.
export function Decor() {
  return (
    <group>
      <KitchenDecor />
      <LivingDecor />
      <BedroomDecor />
      <BathroomDecor />
      <CatGoods />
    </group>
  )
}
