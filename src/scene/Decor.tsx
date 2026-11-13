import { useMemo } from 'react'
import { Shape } from 'three'
import { Box } from './Box'
import { palette } from './palette'
import { Cylinder, Extruded, Glow, LAY_FLAT, Pot, arcBand } from './Shapes'
import { LITTER_BOX, SINGLE_SOFA } from './walkable'

// 구역별 오브제와 고양이 용품을 그리는 파일이다. 높이는 모두 방바닥에서 잰다.
// 올라설 수 있는 큰 물건(벤치와 바닥 쿠션과 화장실 장 등)의 높이는 walkable.ts의 SURFACES에 따로 적는다.
// 부클레와 해초와 트래버틴 같은 재질은 색과 굵은 요철 모양으로만 흉내 낸다.

type Spot = [number, number, number]

// 화병. 불룩한 몸통 위에 좁은 목을 얹는다. position은 바닥면의 가운데다.
function Vase({ position, height, radius = 0.07, color = palette.wall }: { position: Spot; height: number; radius?: number; color?: string }) {
  const [x, y, z] = position
  const belly = height * 0.7
  return (
    <group>
      <Cylinder radius={radius * 0.75} radiusTop={radius} height={belly} position={[x, y + belly / 2, z]} color={color} />
      <Cylinder radius={radius} radiusTop={radius * 0.45} height={height - belly} position={[x, y + belly + (height - belly) / 2, z]} color={color} />
    </group>
  )
}

// 해초나 라탄으로 짠 바구니. 몸통 둘레에 조금 굵은 띠를 둘러서 짜임의 요철을 낸다.
function Basket({ position, radius, height, color = palette.wetSand }: { position: Spot; radius: number; height: number; color?: string }) {
  const [x, y, z] = position
  const bands = Math.max(2, Math.round(height / 0.09))
  return (
    <group>
      <Cylinder radius={radius * 0.85} radiusTop={radius} height={height} position={[x, y + height / 2, z]} color={color} />
      {Array.from({ length: bands }, (_, index) => {
        const ratio = (index + 0.5) / bands
        return (
          <Cylinder
            key={index}
            radius={radius * (0.85 + 0.15 * ratio) + 0.008}
            height={height / bands / 2.5}
            position={[x, y + height * ratio, z]}
            color={palette.wood}
          />
        )
      })}
    </group>
  )
}

/** 책 묶음에 차례로 쓰는 색 */
const BOOK_COLORS = [palette.wall, palette.green, palette.greige, palette.rugBedroom]

// 눕혀서 쌓은 책 묶음. 위로 갈수록 조금씩 작아지고 조금씩 돌아가 있다.
function Books({ position, count, turn = 0 }: { position: Spot; count: number; turn?: number }) {
  const [x, y, z] = position
  return (
    <group position={[x, y, z]} rotation={[0, turn, 0]}>
      {Array.from({ length: count }, (_, index) => (
        <Box
          key={index}
          size={[0.26 - index * 0.025, 0.035, 0.19 - index * 0.015]}
          position={[0, 0.0175 + index * 0.035, 0]}
          rotation={[0, index * 0.18, 0]}
          color={BOOK_COLORS[index % BOOK_COLORS.length]}
        />
      ))}
    </group>
  )
}

// 초. holder가 true면 구멍이 숭숭 난 트래버틴 받침 위에 올린다.
function Candle({ position, holder = false }: { position: Spot; holder?: boolean }) {
  const [x, y, z] = position
  const base = holder ? 0.07 : 0
  return (
    <group>
      {holder && <Cylinder radius={0.06} radiusTop={0.05} height={0.07} position={[x, y + 0.035, z]} color={palette.roughStone} />}
      {holder && <Cylinder radius={0.062} height={0.012} position={[x, y + 0.03, z]} color={palette.roughStoneDark} />}
      <Cylinder radius={0.028} height={0.09} position={[x, y + base + 0.045, z]} color={palette.wall} />
      <Glow size={[0.012, 0.02, 0.012]} position={[x, y + base + 0.1, z]} />
    </group>
  )
}

// 낮은 그릇. 위가 넓다.
function Bowl({ position, radius = 0.09, color = palette.wall }: { position: Spot; radius?: number; color?: string }) {
  const [x, y, z] = position
  return <Cylinder radius={radius * 0.5} radiusTop={radius} height={radius * 0.6} position={[x, y + radius * 0.3, z]} color={color} />
}

// 작은 공 하나. 과일과 장난감 공에 쓴다.
function Ball({ position, radius, color }: { position: Spot; radius: number; color: string }) {
  return (
    <mesh position={position} castShadow>
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
      {/* 조리대: 벽에 기대 세운 원목 도마 세트와 스톤 양념통과 조리도구 통과 커피 머신 */}
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          size={[0.025, 0.34 - index * 0.05, 0.24 - index * 0.03]}
          position={[-7.76 + index * 0.035, counter + (0.34 - index * 0.05) / 2, 1.3]}
          rotation={[0, 0, -0.1]}
          color={index === 1 ? palette.sofaWood : palette.oak}
        />
      ))}
      {[3.1, 3.21, 3.32].map((z) => (
        <group key={z}>
          <Cylinder radius={0.035} height={0.08} position={[-7.68, counter + 0.04, z]} color={palette.stoneDark} />
          <Cylinder radius={0.037} height={0.015} position={[-7.68, counter + 0.0875, z]} color={palette.oak} />
        </group>
      ))}
      <Cylinder radius={0.06} radiusTop={0.065} height={0.14} position={[-7.66, counter + 0.07, 3.6]} color={palette.wall} />
      {[-0.25, 0.05, 0.3].map((lean) => (
        <Cylinder key={lean} radius={0.008} height={0.24} position={[-7.66 + lean * 0.05, counter + 0.2, 3.6 + lean * 0.06]} rotation={[lean, 0, 0]} color={palette.oak} />
      ))}
      <Box size={[0.26, 0.3, 0.2]} position={[-7.62, counter + 0.15, 4.2]} color={palette.white} />
      <Box size={[0.1, 0.06, 0.16]} position={[-7.46, counter + 0.25, 4.2]} color={palette.charcoal} />
      <Box size={[0.14, 0.015, 0.18]} position={[-7.44, counter + 0.0075, 4.2]} color={palette.charcoal} />
      <Cylinder radius={0.03} height={0.06} position={[-7.44, counter + 0.045, 4.2]} color={palette.wall} />

      {/* 벽 선반 두 단. 두꺼운 통나무 판 위에 병과 유리 화병과 초 쟁반을 올린다. */}
      {[1.2, 1.7].map((top) => (
        <Extruded key={top} shape={slab} depth={0.07} position={[0, top - 0.07, 0]} rotation={LAY_FLAT} color={palette.sofaWood} />
      ))}
      <Vase position={[-7.72, 1.2, -3.35]} height={0.24} radius={0.045} color={palette.green} />
      <Vase position={[-7.72, 1.2, -3.2]} height={0.19} radius={0.04} color={palette.wall} />
      {/* 유리 화병. transparent와 opacity로 반투명하게 만든다. */}
      <mesh position={[-7.72, 1.31, -2.6]}>
        <cylinderGeometry args={[0.06, 0.045, 0.22, 10]} />
        <meshStandardMaterial color={palette.glass} transparent opacity={0.45} roughness={0.1} />
      </mesh>
      <Box size={[0.14, 0.015, 0.34]} position={[-7.72, 1.7075, -2.55]} color={palette.oak} />
      <Candle position={[-7.72, 1.715, -2.65]} />
      <Candle position={[-7.72, 1.715, -2.47]} />
      <Bowl position={[-7.72, 1.7, -3.25]} radius={0.08} color={palette.wall} />

      {/* 아일랜드: 원목 쟁반 위의 세라믹 화병과 과일 그릇 */}
      <Box size={[0.3, 0.02, 0.46]} position={[-5.55, counter + 0.01, 2.55]} color={palette.oak} />
      <Vase position={[-5.55, counter + 0.02, 2.45]} height={0.24} radius={0.075} color={palette.wall} />
      <Bowl position={[-5.55, counter, 3.35]} radius={0.15} color={palette.stoneDark} />
      <Ball position={[-5.6, counter + 0.1, 3.32]} radius={0.045} color={palette.column} />
      <Ball position={[-5.5, counter + 0.1, 3.3]} radius={0.045} color={palette.leafLight} />
      <Ball position={[-5.54, counter + 0.1, 3.41]} radius={0.045} color={palette.column} />
    </group>
  )
}

// 거실: 아치 벽감 안과 통나무 탁자 위와 바닥 쿠션과 큰 야자 화분과 왼쪽 벽의 추상화
function LivingDecor() {
  /** 벽감 안에서 물건을 놓는 z 좌표 */
  const nicheZ = -5.63
  // 1인용 소파의 등받이. 위에서 본 윤곽이고 뒤쪽(+z) 반 바퀴를 감싼다. 바깥은 나무 껍데기이고 안쪽은 직물 등받이다.
  const chair = useMemo(
    () => ({
      shell: arcBand(0, 0, 0.47, 0.56, 10, 170),
      back: arcBand(0, 0, 0.3, 0.47, 14, 166),
    }),
    [],
  )
  return (
    <group>
      {/* 왼쪽 큰 벽감 (x -4.3~-2.9). 칸마다 한두 개만 놓아서 여백을 둔다. */}
      <Basket position={[-3.95, 1.0, nicheZ]} radius={0.15} height={0.27} />
      <Books position={[-3.3, 1.0, nicheZ]} count={3} turn={0.1} />
      <Vase position={[-3.7, 1.5, nicheZ]} height={0.3} radius={0.08} color={palette.wall} />
      <Candle position={[-3.2, 1.5, nicheZ]} holder />
      {/* 가운데 작은 벽감 (x -2.5~-1.8) */}
      <Vase position={[-2.15, 1.0, nicheZ]} height={0.34} radius={0.09} color={palette.stoneDark} />
      <Basket position={[-2.15, 1.5, nicheZ]} radius={0.11} height={0.17} color={palette.wood} />
      <Candle position={[-2.15, 2.0, nicheZ]} holder />
      {/* 오른쪽 큰 벽감 (x 4.9~5.9) */}
      <Books position={[5.2, 1.0, nicheZ]} count={4} turn={-0.15} />
      <Basket position={[5.62, 1.0, nicheZ]} radius={0.13} height={0.2} />
      <Vase position={[5.55, 1.5, nicheZ]} height={0.26} radius={0.07} color={palette.green} />
      <Pot position={[5.15, 1.5, nicheZ]} radius={0.07} height={0.1} scale={0.4} seed={52} />
      <Candle position={[5.4, 2.0, nicheZ]} holder />

      {/* 통나무 탁자 (윗면 0.35m): 리모컨과 초와 작은 그릇 */}
      {/* 리모컨. 나중에 이것을 눌러서 TV 채널을 넘긴다. 흰 몸통 위에 전원 단추와 둥근 방향 단추가 있다. */}
      <group position={[1.15, 0.35, -0.88]} rotation={[0, 0.35, 0]}>
        <Box size={[0.055, 0.02, 0.19]} position={[0, 0.01, 0]} color={palette.white} roughness={0.5} />
        <Cylinder radius={0.008} height={0.004} position={[0, 0.022, -0.07]} color={palette.column} />
        <Cylinder radius={0.018} height={0.004} position={[0, 0.022, -0.025]} color={palette.greige} />
        <Box size={[0.03, 0.004, 0.012]} position={[0, 0.022, 0.03]} color={palette.greige} />
        <Box size={[0.03, 0.004, 0.012]} position={[0, 0.022, 0.055]} color={palette.greige} />
      </group>
      <Candle position={[1.7, 0.35, -0.72]} />
      <Bowl position={[1.95, 0.35, -0.95]} radius={0.08} color={palette.stoneDark} />

      {/* 원형 바닥 쿠션 둘. 소파에 앉아 TV를 볼 때 오른쪽(+x) 끝 옆에 둔다. 굵은 직물로 보이게 옆면에 띠를 두른다. */}
      {[
        { x: 4.7, z: -0.55, radius: 0.32, color: palette.fabric },
        { x: 4.45, z: -1.35, radius: 0.28, color: palette.rugBedroom },
      ].map((cushion) => (
        <group key={cushion.x}>
          <Cylinder radius={cushion.radius} height={0.16} position={[cushion.x, 0.08, cushion.z]} color={cushion.color} />
          <Cylinder radius={cushion.radius + 0.012} height={0.05} position={[cushion.x, 0.08, cushion.z]} color={cushion.color} />
        </group>
      ))}
      {/* 거실 앞 왼쪽 쌍기둥 옆의 큰 야자 화분 */}
      <Pot position={[6.1, 0, 5.25]} radius={0.3} height={0.6} scale={2.2} seed={44} />

      {/* 왼쪽 벽의 추상화. 통나무 조명과 곡선 책장 사이에 건다. 원목 틀 안에 크림색 바탕과 도형 셋이 있다. */}
      <group position={[6.875, 1.55, -4.1]}>
        <Box size={[0.05, 1.0, 1.3]} position={[-0.025, 0, 0]} color={palette.oak} />
        <Box size={[0.02, 0.88, 1.18]} position={[-0.055, 0, 0]} color={palette.wall} roughness={1} />
        {/* 도형은 바탕에서 조금씩 더 띄워서 서로 같은 평면에 놓이지 않게 한다. */}
        <Cylinder radius={0.24} height={0.006} position={[-0.069, 0.1, 0.22]} rotation={[0, 0, Math.PI / 2]} color={palette.green} />
        <Box size={[0.006, 0.5, 0.36]} position={[-0.073, -0.12, -0.2]} color={palette.wood} />
        <Box size={[0.006, 0.12, 0.7]} position={[-0.077, -0.3, 0.05]} color={palette.greige} />
      </group>

      {/* 장난감 공 둘. 바닥 쿠션 옆에 모아 둔다. */}
      <Ball position={[3.85, 0.081, -1.95]} radius={0.06} color={palette.green} />
      <Ball position={[4.0, 0.081, -1.82]} radius={0.06} color={palette.blue} />

      {/* 1인용 소파. 소파에 앉아 TV를 볼 때 왼쪽(-x) 끝 옆에 둔다. 초승달 소파가 그리는 원 위에 놓고 그 원의 가운데를 보게 돌린다. */}
      {/* 초승달 소파와 같은 재료다. 나무 몸통 위에 둥근 방석을 얹고 뒤쪽 반 바퀴에 등받이를 세운다. */}
      <group position={[SINGLE_SOFA.x, 0, SINGLE_SOFA.z]} rotation={[0, SINGLE_SOFA.turn, 0]}>
        <Cylinder radius={0.5} height={0.23} position={[0, 0.135, 0]} color={palette.sofaWood} />
        <Cylinder radius={0.46} height={0.2} position={[0, 0.35, 0]} color={palette.fabric} />
        <Extruded shape={chair.shell} depth={0.6} position={[0, 0.25, 0]} rotation={LAY_FLAT} color={palette.sofaWood} />
        <Extruded shape={chair.back} depth={0.38} position={[0, 0.45, 0]} rotation={LAY_FLAT} color={palette.fabric} />
      </group>
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
      {/* 침대 위 벽의 액자 셋. 벽면(z -0.875)에 붙인다. */}
      {[10.95, 11.4, 11.85].map((x, index) => (
        <group key={x} position={[x, 1.72, -0.875]}>
          <Box size={[0.36, 0.46, 0.03]} position={[0, 0, 0.015]} color={palette.oak} />
          <Box size={[0.3, 0.4, 0.01]} position={[0, 0, 0.033]} color={palette.wall} roughness={1} />
          <Box size={[0.14, 0.18, 0.006]} position={[0, index === 1 ? 0.03 : -0.03, 0.04]} color={[palette.green, palette.wood, palette.greige][index]} />
        </group>
      ))}
    </group>
  )
}

// 욕실: 욕조 쟁반과 초와 병. 세면대 디스펜서와 접은 수건. 바닥 매트와 라탄 바구니와 원목 사다리 수건걸이
function BathroomDecor() {
  /** 사다리가 벽에 기댄 각도 */
  const lean = 0.21
  // 사다리의 높이 h인 자리의 z 좌표. 발은 z -5.5에 있고 위로 갈수록 벽 쪽으로 간다.
  const ladderZ = (h: number) => -5.5 - Math.tan(lean) * h
  return (
    <group>
      {/* 욕조 턱 두 변에 걸친 원목 쟁반 */}
      <Box size={[0.24, 0.025, 1.56]} position={[12.3, 0.5625, -5.05]} color={palette.oak} />
      <Candle position={[12.3, 0.575, -5.25]} />
      <Vase position={[12.3, 0.575, -4.9]} height={0.18} radius={0.035} color={palette.green} />
      {/* 세면대: 대야 사이의 디스펜서와 끝에 접어 둔 수건 */}
      <Cylinder radius={0.035} height={0.13} position={[7.5, 0.965, -3.9]} color={palette.wall} />
      <Box size={[0.06, 0.012, 0.02]} position={[7.52, 1.045, -3.9]} color={palette.charcoal} />
      <Cylinder radius={0.008} height={0.03} position={[7.5, 1.045, -3.9]} color={palette.charcoal} />
      {[0, 1].map((index) => (
        <Box key={index} size={[0.3 - index * 0.02, 0.05, 0.22 - index * 0.02]} position={[7.5, 0.925 + index * 0.05, -2.78]} color={palette.white} roughness={1} />
      ))}
      {/* 욕조 앞 바닥 매트 */}
      <Box size={[1.3, 0.02, 0.6]} position={[12.3, 0.014, -3.85]} color={palette.fabric} roughness={1} castShadow={false} />
      <Basket position={[9.3, 0, -5.35]} radius={0.22} height={0.42} color={palette.wood} />
      {/* 뒤쪽 벽에 기대 세운 사다리 수건걸이. 세로대 둘과 가로대 넷과 걸쳐 놓은 수건 */}
      {[10.27, 10.69].map((x) => (
        <Box key={x} size={[0.04, 1.78, 0.04]} position={[x, 0.87, ladderZ(0.87)]} rotation={[-lean, 0, 0]} color={palette.oak} />
      ))}
      {[0.4, 0.8, 1.2, 1.55].map((h) => (
        <Box key={h} size={[0.38, 0.03, 0.03]} position={[10.48, h, ladderZ(h)]} color={palette.oak} />
      ))}
      <Box size={[0.3, 0.4, 0.02]} position={[10.48, 1.0, ladderZ(1.2) + 0.035]} color={palette.white} roughness={1} />
    </group>
  )
}

// 고양이 용품: 아일랜드 바다 쪽 끝의 식기와 거실 구석의 화장실 장
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

      {/* 원목 화장실 장. 거실 뒤쪽 구석의 주방 쪽 벽에 붙여서 캣폴 옆에 둔다. */}
      {/* 방 쪽(+x) 면의 왼쪽에 아치 입구가 있고 오른쪽은 세로 살 문이다. group 안의 자리는 장의 가운데에서 잰 값이다. */}
      <group position={[LITTER_BOX.x, 0, LITTER_BOX.z]}>
        <Box size={[0.6, 0.6, 0.7]} position={[0, 0.3, 0]} color={palette.oak} />
        <Box size={[0.64, 0.03, 0.74]} position={[0, 0.615, 0]} color={palette.oakLight} />
        {/* 아치 입구. 어두운 네모 위에 둥근 판을 겹쳐서 위가 둥근 구멍처럼 보이게 한다. 둘은 색이 같다. */}
        <Box size={[0.012, 0.3, 0.26]} position={[0.304, 0.17, -0.18]} color={palette.columnCap} castShadow={false} />
        <Cylinder radius={0.13} height={0.01} position={[0.304, 0.32, -0.18]} rotation={[0, 0, Math.PI / 2]} color={palette.columnCap} />
        {[0, 1, 2, 3, 4].map((index) => (
          <Box key={index} size={[0.014, 0.5, 0.025]} position={[0.307, 0.3, 0.06 + index * 0.055]} color={palette.oakLight} castShadow={false} />
        ))}
      </group>
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
