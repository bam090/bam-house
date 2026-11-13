import { HideWhenBlocking, cameraAboveCeilingIn } from './Occlusion'
import { Box } from './Box'
import { Interior } from './Interior'
import { palette } from './palette'
import { FlutedGlass, Tuft, TwinColumn, scatter } from './Shapes'
import { CAT_HOLE, CEILING_HEIGHT, DECK_HEIGHT, DOOR_HEIGHT, FLOOR_HEIGHT, HOUSE, LOW_DOOR_HEIGHT, STAIRS, STEP_COUNT, STEP_HEIGHT } from './walkable'

// 문 높이(DOOR_HEIGHT와 LOW_DOOR_HEIGHT)는 걷기 규칙의 문 위쪽 벽과 같아야 해서 walkable.ts에 둔다.

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }

/** 방의 바닥 범위. 지붕 조각마다 어느 방 위에 있는지 정할 때 쓴다. */
const ROOMS = {
  living: { minX: -8, maxX: 7, minZ: -6, maxZ: 6 },
  bedroom: { minX: 7, maxX: 14, minZ: -1, maxZ: 6 },
  bath: { minX: 7, maxX: 14, minZ: -6, maxZ: -1 },
  toilet: { minX: 7, maxX: 11, minZ: -8.5, maxZ: -6 },
} as const

/** 지붕 조각. slab은 크림색 지붕 판이고 board는 그 아래 오크 천장 판이며 rooms는 그 조각이 덮는 방이다. */
// 고양이가 있는 방 위의 조각만 숨기려고 본채 지붕을 거실과 침실과 욕실 위의 세 조각으로 나눴다.
// 욕실 조각은 변기 칸 앞쪽(z -7.2~-6)도 덮어서 변기 칸에 있을 때도 함께 숨긴다.
// 천장 판은 지붕 바깥 가장자리에서만 0.1m 들이고 조각끼리 닿는 쪽은 끝까지 채워서 천장이 끊기지 않게 한다.
// beam은 지붕 바로 아래에 걸린 나무 가로대다. 지붕을 숨길 때 혼자 떠 있지 않도록 그 조각과 함께 숨긴다.
const ROOF_PIECES: { slab: Rect; board: Rect; rooms: Rect[]; beam?: Rect }[] = [
  {
    slab: { minX: -9.5, maxX: 7, minZ: -7.2, maxZ: 7.4 },
    board: { minX: -9.4, maxX: 7, minZ: -7.1, maxZ: 7.3 },
    rooms: [ROOMS.living],
    // 거실 앞면 위쪽의 나무 가로대
    beam: { minX: -8, maxX: 7, minZ: 5.86, maxZ: 6 },
  },
  {
    slab: { minX: 7, maxX: 15.2, minZ: -1, maxZ: 7.4 },
    board: { minX: 7, maxX: 15.1, minZ: -1, maxZ: 7.3 },
    rooms: [ROOMS.bedroom],
  },
  {
    slab: { minX: 7, maxX: 15.2, minZ: -7.2, maxZ: -1 },
    board: { minX: 7, maxX: 15.1, minZ: -7.1, maxZ: -1 },
    rooms: [ROOMS.bath, ROOMS.toilet],
  },
  {
    slab: { minX: 6.4, maxX: 11.5, minZ: -9, maxZ: -7.2 },
    board: { minX: 6.5, maxX: 11.4, minZ: -8.9, maxZ: -7.3 },
    rooms: [ROOMS.toilet],
  },
]

// 범위 값으로 상자를 그린다. bottom과 height는 아랫면 높이와 두께다.
function RectBox({ rect, bottom, height, color }: { rect: Rect; bottom: number; height: number; color: string }) {
  return (
    <Box
      size={[rect.maxX - rect.minX, height, rect.maxZ - rect.minZ]}
      position={[(rect.minX + rect.maxX) / 2, bottom + height / 2, (rect.minZ + rect.maxZ) / 2]}
      color={color}
    />
  )
}

/** 거실 오른쪽 벽에서 크림색 벽이 끝나고 유리문이 시작하는 z 좌표 */
const SIDE_GLASS_FROM = 0.1

/** 거실 뒤쪽 벽에 낸 통유리창의 x 범위 */
const BACK_WINDOW = { minX: -7.6, maxX: -4.6 } as const

/** 변기 칸 뒤쪽 벽에 낸 가로로 긴 창 */
/** 바깥벽을 방바닥보다 아래로 내려 묻는 깊이. */
// 벽이 방바닥 높이에서 끝나면 그림자 지도의 한 칸(약 3cm)이 벽 밑과 바깥을 함께 담아서 벽 밑동을 따라 햇빛이 가는 줄로 샌다.
// 벽을 바닥 판보다 깊이 내리면 그 칸이 모두 벽에 가려진다.
const SINK = 0.3

const TOILET_WINDOW = { minX: 8.8, maxX: 10.7, bottom: 2.2, top: 2.9 } as const

interface GlassWallProps {
  /** 벽이 뻗는 방향. 'z'면 z 방향으로 길고 'x'면 x 방향으로 길다. */
  along: 'x' | 'z'
  /** 벽이 서 있는 자리. along이 'z'면 x 좌표이고 'x'면 z 좌표다. */
  at: number
  from: number
  to: number
  /** 유리문 짝의 수 */
  panels: number
}

// 바닥에서 천장까지 닿는 나무틀 미닫이 유리문이다.
// 유리판 한 장에 위아래 가로대와 짝 사이 세로대를 덧붙여서 여러 짝으로 보이게 한다.
function GlassWall({ along, at, from, to, panels }: GlassWallProps) {
  const h = CEILING_HEIGHT
  const length = to - from
  const middle = (from + to) / 2
  // along 방향 길이와 두께를 받아서 상자의 크기와 위치로 바꾼다.
  const size = (run: number, height: number, thick: number): [number, number, number] =>
    along === 'z' ? [thick, height, run] : [run, height, thick]
  const place = (run: number, y: number): [number, number, number] => (along === 'z' ? [at, y, run] : [run, y, at])

  return (
    <group>
      {/* 유리 판은 위아래 가로대 안에 끝을 묻는다. 가로대와 높이가 같으면 윗면과 아랫면이 가로대 면과 겹쳐서 깜빡인다. */}
      <Box size={size(length, h - 0.04, 0.05)} position={place(middle, h / 2)} color={palette.glass} opacity={0.22} roughness={0.1} />
      {/* 아래 가로대와 위 가로대와 그 사이의 중간 가로대 */}
      <Box size={size(length, 0.12, 0.14)} position={place(middle, 0.06)} color={palette.oak} />
      <Box size={size(length, 0.12, 0.14)} position={place(middle, h - 0.06)} color={palette.oak} />
      <Box size={size(length, 0.08, 0.12)} position={place(middle, DOOR_HEIGHT)} color={palette.oak} />
      {/* 유리문 짝 사이의 세로대 */}
      {Array.from({ length: panels + 1 }, (_, index) => (
        <Box
          key={index}
          size={size(0.1, h, 0.14)}
          position={place(from + (length * index) / panels, h / 2)}
          color={palette.oak}
        />
      ))}
    </group>
  )
}

// 크림색 벽에 다는 좁은 나무 덧문. 틀 안에 가로 살을 촘촘히 끼운 모양이다.
// facing은 덧문이 달린 벽면이 바라보는 축이다.
function Shutter({ position, facing }: { position: [number, number, number]; facing: 'x' | 'z' }) {
  const width = 0.7
  const height = 2.4
  const size = (run: number, tall: number, thick: number): [number, number, number] =>
    facing === 'x' ? [thick, tall, run] : [run, tall, thick]
  return (
    <group position={position}>
      <Box size={size(width, height, 0.06)} position={[0, 0, 0]} color={palette.oak} />
      {Array.from({ length: 11 }, (_, index) => (
        <Box
          key={index}
          size={size(width - 0.16, 0.05, 0.1)}
          position={[0, -height / 2 + 0.2 + index * 0.2, 0]}
          color={palette.woodDark}
        />
      ))}
    </group>
  )
}

// 거칠게 쌓은 밝은 돌 벽. 매끈한 벽면 위에 크기가 다른 돌을 조금씩 튀어나오게 붙였다.
function RoughWall({ along, at, from, to, bottom, top, seed }: {
  along: 'x' | 'z'
  at: number
  from: number
  to: number
  bottom: number
  top: number
  seed: number
}) {
  const length = to - from
  const height = top - bottom
  const middle = (from + to) / 2
  const size = (run: number, tall: number, thick: number): [number, number, number] =>
    along === 'z' ? [thick, tall, run] : [run, tall, thick]
  const place = (run: number, y: number): [number, number, number] => (along === 'z' ? [at, y, run] : [run, y, at])
  // 돌을 아무 자리에나 흩어 놓아서 서로 겹치게 한다. 겹친 돌끼리는 두께를 다르게 준다.
  // 두께가 같으면 색이 다른 두 면이 같은 평면에 놓여서 그 자리가 깜빡인다.
  const count = Math.round(length * height * 1.6)
  const stones: { run: number; tall: number; center: number; y: number; thick: number }[] = []
  for (let index = 0; index < count; index += 1) {
    const run = 0.35 + scatter(index, seed) * 0.5
    const tall = 0.2 + scatter(index, seed + 1) * 0.2
    const center = from + run / 2 + (length - run) * scatter(index, seed + 2)
    const y = bottom + tall / 2 + (height - tall) * scatter(index, seed + 3)
    // 먼저 놓은 돌 가운데 이 돌과 겹치는 돌이 쓴 두께를 모은다. 맞닿기만 해도 겹친 것으로 본다.
    const taken = stones
      .filter((other) => Math.abs(other.center - center) <= (other.run + run) / 2 && Math.abs(other.y - y) <= (other.tall + tall) / 2)
      .map((other) => other.thick)
    // 0.36m에서 시작해서 겹치는 돌이 쓰지 않은 가장 얇은 두께를 고른다. 한 단계가 0.03m라서 면 사이가 0.015m 떨어진다.
    let thick = 0.36
    while (taken.some((value) => Math.abs(value - thick) < 0.001)) thick += 0.03
    stones.push({ run, tall, center, y, thick })
  }

  // noFade를 주어서 카메라와 고양이 사이에 끼어도 반투명하게 바꾸지 않는다. 벽만 흐려지고 붙은 돌은 그대로 남아서 어색하기 때문이다.
  return (
    <group userData={{ noFade: true }}>
      <Box size={size(length, height, 0.3)} position={place(middle, bottom + height / 2)} color={palette.roughStone} roughness={1} />
      {stones.map((stone, index) => (
        <Box
          key={index}
          size={size(stone.run, stone.tall, stone.thick)}
          position={place(stone.center, stone.y)}
          color={index % 3 === 0 ? palette.roughStoneDark : palette.stone}
          roughness={1}
          castShadow={false}
        />
      ))}
    </group>
  )
}

// 평평하고 얇은 지붕의 단층 집이다.
// 거실 왼쪽(+x)에 침실과 욕실이 붙고 욕실 뒤에 변기 칸이 붙는다.
// 거실 바닥은 수영장 데크보다 FLOOR_HEIGHT만큼 높고 앞쪽 계단으로 내려간다.
// 데크 윗면이 이 컴포넌트의 높이 0이다. 장면에서는 테라스와 함께 DECK_HEIGHT만큼 올려서 놓는다.
export function House() {
  const h = CEILING_HEIGHT
  const width = HOUSE.maxX - HOUSE.minX
  const depth = HOUSE.maxZ - HOUSE.minZ
  const centerX = (HOUSE.minX + HOUSE.maxX) / 2
  const wing = HOUSE.wingX
  const wingWidth = HOUSE.maxX - wing
  const wingCenter = (wing + HOUSE.maxX) / 2
  const door = HOUSE.bedroomDoor
  const bathDoor = HOUSE.bathDoor
  const toilet = HOUSE.toilet
  const toiletDoor = HOUSE.toiletDoor
  const hole = CAT_HOLE
  const toiletWidth = toilet.maxX - toilet.minX
  const toiletDepth = toilet.maxZ - toilet.minZ
  const toiletCenterX = (toilet.minX + toilet.maxX) / 2
  const toiletCenterZ = (toilet.minZ + toilet.maxZ) / 2
  const win = TOILET_WINDOW
  const stairsWidth = STAIRS.maxX - STAIRS.minX
  const stairsCenter = (STAIRS.minX + STAIRS.maxX) / 2
  // 돌 벽 뜰의 바닥은 잔디이고 벽은 욕실 창 위쪽 높이까지 올라간다.
  const courtBottom = -DECK_HEIGHT - 0.5
  const courtTop = FLOOR_HEIGHT + 2.5

  return (
    <group>
      {/* 집 아래의 돌 받침. 데크 돌판과 같은 높이에서 땅속까지 내려간다. */}
      <Box size={[width, DECK_HEIGHT + 1.2, depth]} position={[centerX, -(DECK_HEIGHT + 1.2) / 2, 0]} color={palette.stone} />
      <Box
        size={[toiletWidth, DECK_HEIGHT + 1.2, toiletDepth]}
        position={[toiletCenterX, -(DECK_HEIGHT + 1.2) / 2, toiletCenterZ]}
        color={palette.stone}
      />

      {/* 바닥을 받치는 돌 받침. 옆면이 바닥 판과 겹쳐 깜빡이지 않도록 조금 안쪽으로 들였다. */}
      <Box
        size={[width - 0.1, FLOOR_HEIGHT - 0.1, depth - 0.1]}
        position={[centerX, (FLOOR_HEIGHT - 0.1) / 2, 0]}
        color={palette.stoneDark}
      />
      <Box
        size={[toiletWidth - 0.1, FLOOR_HEIGHT - 0.1, toiletDepth]}
        position={[toiletCenterX, (FLOOR_HEIGHT - 0.1) / 2, toiletCenterZ - 0.05]}
        color={palette.stoneDark}
      />

      {/* 거실 앞 계단. 위쪽 단부터 차례로 낮아진다. 양 끝은 테라스의 돌 화단이 막는다. */}
      {Array.from({ length: STEP_COUNT }, (_, index) => {
        const top = FLOOR_HEIGHT - STEP_HEIGHT * (index + 1)
        const z = STAIRS.startZ + STAIRS.stepDepth * (index + 0.5)
        return (
          <Box
            key={index}
            size={[stairsWidth, top, STAIRS.stepDepth]}
            position={[stairsCenter, top / 2, z]}
            color={palette.stone}
          />
        )
      })}

      {/* 욕실 왼쪽의 돌 벽 뜰. 거친 돌 벽 세 면이 작은 정원을 두른다. */}
      <RoughWall along="z" at={15.6} from={-6.45} to={-0.55} bottom={courtBottom} top={courtTop} seed={1} />
      <RoughWall along="x" at={-6.3} from={14.1} to={15.45} bottom={courtBottom} top={courtTop} seed={2} />
      <RoughWall along="x" at={-0.7} from={14.1} to={15.45} bottom={courtBottom} top={courtTop} seed={3} />
      {/* 풀은 욕실 유리(x 14)에서 떨어뜨려 심고 잎을 곧게 세워서 유리를 넘지 않게 한다. */}
      {[-5.4, -4.2, -3.1, -1.8].map((z, index) => (
        <Tuft
          key={z}
          position={[14.7 + scatter(index, 9) * 0.35, -DECK_HEIGHT, z]}
          scale={1.3}
          seed={index + 20}
          lean={0.4}
        />
      ))}

      {/* 바닥 위의 모든 것은 이 group 안에 있어서 바닥 높이만큼 함께 올라간다. */}
      <group position={[0, FLOOR_HEIGHT, 0]}>
        {/* 거실과 침실은 나무 바닥이고 욕실과 변기 칸은 돌 바닥이다. */}
        <Box
          size={[wing - HOUSE.minX, 0.2, depth]}
          position={[(HOUSE.minX + wing) / 2, -0.1, 0]}
          color={palette.woodFloor}
        />
        <Box
          size={[wingWidth, 0.2, HOUSE.maxZ - HOUSE.bathZ]}
          position={[wingCenter, -0.1, (HOUSE.bathZ + HOUSE.maxZ) / 2]}
          color={palette.woodFloor}
        />
        <Box
          size={[wingWidth, 0.2, HOUSE.bathZ - HOUSE.minZ]}
          position={[wingCenter, -0.1, (HOUSE.minZ + HOUSE.bathZ) / 2]}
          color={palette.stone}
        />
        <Box size={[toiletWidth, 0.2, toiletDepth]} position={[toiletCenterX, -0.1, toiletCenterZ]} color={palette.stone} />

        {/* 뒤쪽 벽. 거실 오른쪽 끝에는 바닥부터 천장까지 통유리창을 낸다. 변기 칸 문 자리는 비우고 그 위만 막는다. */}
        <Box
          size={[BACK_WINDOW.minX - HOUSE.minX, h + SINK, 0.25]}
          position={[(HOUSE.minX + BACK_WINDOW.minX) / 2, (h - SINK) / 2, HOUSE.minZ]}
          color={palette.wall}
        />
        <GlassWall along="x" at={HOUSE.minZ} from={BACK_WINDOW.minX} to={BACK_WINDOW.maxX} panels={2} />
        <Box
          size={[toiletDoor.minX - BACK_WINDOW.maxX, h + SINK, 0.25]}
          position={[(BACK_WINDOW.maxX + toiletDoor.minX) / 2, (h - SINK) / 2, HOUSE.minZ]}
          color={palette.wall}
        />
        <Box
          size={[HOUSE.maxX - toiletDoor.maxX, h + SINK, 0.25]}
          position={[(toiletDoor.maxX + HOUSE.maxX) / 2, (h - SINK) / 2, HOUSE.minZ]}
          color={palette.wall}
        />
        <Box
          size={[toiletDoor.maxX - toiletDoor.minX, h - LOW_DOOR_HEIGHT, 0.25]}
          position={[(toiletDoor.minX + toiletDoor.maxX) / 2, (h + LOW_DOOR_HEIGHT) / 2, HOUSE.minZ]}
          color={palette.wall}
        />
        {/* 변기 칸의 세로줄 유리 미닫이문. 변기 칸 쪽 벽면을 따라 끝까지 밀려 있어서 문 자리가 모두 열린다. */}
        <FlutedGlass along="x" at={HOUSE.minZ - 0.17} from={toiletDoor.minX - 0.92} to={toiletDoor.minX - 0.02} height={LOW_DOOR_HEIGHT} />
        <Box
          size={[toiletDoor.maxX - toiletDoor.minX + 0.9, 0.08, 0.1]}
          position={[(toiletDoor.minX + toiletDoor.maxX) / 2 - 0.45, LOW_DOOR_HEIGHT + 0.04, HOUSE.minZ - 0.17]}
          color={palette.oak}
        />

        {/* 변기 칸의 양옆 벽과 뒤쪽 벽. 뒤쪽 벽에는 가로로 긴 창을 낸다. */}
        {[toilet.minX, toilet.maxX].map((x) => (
          <Box key={x} size={[0.25, h + SINK, toiletDepth - 0.25]} position={[x, (h - SINK) / 2, toiletCenterZ]} color={palette.wall} />
        ))}
        <Box
          size={[win.minX - toilet.minX + 0.125, h, 0.25]}
          position={[(toilet.minX - 0.125 + win.minX) / 2, h / 2, toilet.minZ]}
          color={palette.wall}
        />
        <Box
          size={[toilet.maxX + 0.125 - win.maxX, h, 0.25]}
          position={[(win.maxX + toilet.maxX + 0.125) / 2, h / 2, toilet.minZ]}
          color={palette.wall}
        />
        <Box
          size={[win.maxX - win.minX, win.bottom, 0.25]}
          position={[(win.minX + win.maxX) / 2, win.bottom / 2, toilet.minZ]}
          color={palette.wall}
        />
        <Box
          size={[win.maxX - win.minX, h - win.top, 0.25]}
          position={[(win.minX + win.maxX) / 2, (h + win.top) / 2, toilet.minZ]}
          color={palette.wall}
        />
        <Box
          size={[win.maxX - win.minX, win.top - win.bottom, 0.04]}
          position={[(win.minX + win.maxX) / 2, (win.bottom + win.top) / 2, toilet.minZ]}
          color={palette.glass}
          opacity={0.3}
          roughness={0.1}
        />
        {[win.bottom, win.top].map((y) => (
          <Box key={y} size={[win.maxX - win.minX, 0.06, 0.3]} position={[(win.minX + win.maxX) / 2, y, toilet.minZ]} color={palette.oak} />
        ))}

        {/* 거실 오른쪽 벽. 뒤쪽은 덧문이 달린 크림색 벽이고 주방 조리대 옆부터는 나무틀 유리문 네 짝이다. */}
        <Box
          size={[0.3, h + SINK, SIDE_GLASS_FROM - HOUSE.minZ]}
          position={[HOUSE.minX, (h - SINK) / 2, (HOUSE.minZ + SIDE_GLASS_FROM) / 2]}
          color={palette.wall}
        />
        <Shutter position={[HOUSE.minX - 0.17, 1.5, -4.5]} facing="x" />
        <GlassWall along="z" at={HOUSE.minX} from={SIDE_GLASS_FROM} to={HOUSE.maxZ} panels={4} />

        {/* 거실과 침실 쪽 날개 사이의 칸막이 벽. 문 자리는 비우고 그 위만 막는다. */}
        {/* 문 뒤쪽 벽에는 중간 높이에 고양이 통로를 뚫는다. 통로의 앞뒤와 아래위를 따로 막는다. */}
        <Box size={[0.25, h, hole.minZ - HOUSE.minZ]} position={[wing, h / 2, (HOUSE.minZ + hole.minZ) / 2]} color={palette.wall} />
        <Box size={[0.25, h, door.minZ - hole.maxZ]} position={[wing, h / 2, (hole.maxZ + door.minZ) / 2]} color={palette.wall} />
        {/* 통로 아래위 벽은 틀의 면과 같은 높이에서 겹쳐 깜빡이지 않도록 1cm씩 물렸다. */}
        <Box
          size={[0.25, hole.bottom - 0.01, hole.maxZ - hole.minZ]}
          position={[wing, (hole.bottom - 0.01) / 2, (hole.minZ + hole.maxZ) / 2]}
          color={palette.wall}
        />
        <Box
          size={[0.25, h - hole.top - 0.01, hole.maxZ - hole.minZ]}
          position={[wing, (h + hole.top + 0.01) / 2, (hole.minZ + hole.maxZ) / 2]}
          color={palette.wall}
        />
        {/* 통로를 두르는 원목 틀. 벽보다 두껍고 벽이 끝나는 면을 감싸도록 통로 가장자리에 걸쳐 놓는다. */}
        {[hole.bottom - 0.03, hole.top + 0.03].map((y) => (
          <Box key={y} size={[0.31, 0.06, hole.maxZ - hole.minZ + 0.06]} position={[wing, y, (hole.minZ + hole.maxZ) / 2]} color={palette.oak} />
        ))}
        {[hole.minZ, hole.maxZ].map((z) => (
          <Box key={z} size={[0.31, hole.top - hole.bottom, 0.06]} position={[wing, (hole.bottom + hole.top) / 2, z]} color={palette.oak} />
        ))}
        <Box size={[0.25, h, HOUSE.maxZ - door.maxZ]} position={[wing, h / 2, (door.maxZ + HOUSE.maxZ) / 2]} color={palette.wall} />
        <Box
          size={[0.25, h - DOOR_HEIGHT, door.maxZ - door.minZ]}
          position={[wing, (h + DOOR_HEIGHT) / 2, (door.minZ + door.maxZ) / 2]}
          color={palette.wall}
        />
        <Box size={[0.3, 0.1, door.maxZ - door.minZ]} position={[wing, DOOR_HEIGHT, (door.minZ + door.maxZ) / 2]} color={palette.oak} />

        {/* 침실과 욕실 사이의 칸막이 벽 */}
        <Box
          size={[bathDoor.minX - wing, h, 0.2]}
          position={[(wing + bathDoor.minX) / 2, h / 2, HOUSE.bathZ]}
          color={palette.wall}
        />
        <Box
          size={[HOUSE.maxX - bathDoor.maxX, h, 0.2]}
          position={[(bathDoor.maxX + HOUSE.maxX) / 2, h / 2, HOUSE.bathZ]}
          color={palette.wall}
        />
        <Box
          size={[bathDoor.maxX - bathDoor.minX, h - LOW_DOOR_HEIGHT, 0.2]}
          position={[(bathDoor.minX + bathDoor.maxX) / 2, (h + LOW_DOOR_HEIGHT) / 2, HOUSE.bathZ]}
          color={palette.wall}
        />

        {/* 침실 앞면. 거실 쪽 2.2m는 덧문이 달린 크림색 벽이고 나머지는 바다를 보는 유리문이다. */}
        <Box size={[2.2, h, 0.3]} position={[wing + 1.1, h / 2, HOUSE.maxZ - 0.15]} color={palette.wall} />
        <Shutter position={[wing + 1.1, 1.5, HOUSE.maxZ + 0.02]} facing="z" />
        <GlassWall along="x" at={HOUSE.maxZ - 0.05} from={wing + 2.2} to={HOUSE.maxX} panels={3} />

        {/* 침실과 욕실의 왼쪽 벽. 가운데 2.5m만 크림색 벽이고 양쪽은 유리문이다. */}
        <GlassWall along="z" at={HOUSE.maxX - 0.05} from={HOUSE.minZ} to={HOUSE.bathZ} panels={3} />
        <Box size={[0.3, h, 2.5]} position={[HOUSE.maxX - 0.15, h / 2, HOUSE.bathZ + 1.25]} color={palette.wall} />
        <Shutter position={[HOUSE.maxX + 0.02, 1.5, HOUSE.bathZ + 1.25]} facing="x" />
        <GlassWall along="z" at={HOUSE.maxX - 0.05} from={HOUSE.bathZ + 2.5} to={HOUSE.maxZ} panels={3} />

        {/* 거실 앞면 양 끝의 쌍기둥 */}
        <TwinColumn position={[HOUSE.minX + 0.05, 0, HOUSE.maxZ - 0.15]} height={h} along="z" />
        <TwinColumn position={[wing - 0.3, 0, HOUSE.maxZ - 0.15]} height={h} along="z" />

        <Interior />

        {/* 얇은 지붕. 크림색 판 아래에 밝은 오크 천장을 댔다. */}
        {/* 조각마다 따로 숨긴다. 고양이가 그 조각 아래 방에 있고 카메라가 천장보다 높거나 카메라와 고양이 사이를 가리면 숨긴다. */}
        {ROOF_PIECES.map((piece) => (
          <HideWhenBlocking key={`${piece.slab.minX}-${piece.slab.minZ}`} alsoWhen={cameraAboveCeilingIn(piece.rooms)}>
            <RectBox rect={piece.slab} bottom={h + 0.06} height={0.18} color={palette.wall} />
            <RectBox rect={piece.board} bottom={h} height={0.06} color={palette.oakLight} />
            {piece.beam && <RectBox rect={piece.beam} bottom={h - 0.14} height={0.14} color={palette.oak} />}
          </HideWhenBlocking>
        ))}

        {/* 지붕이 햇빛을 가리기 때문에 실내에 따뜻한 색 조명을 따로 둔다. */}
        <pointLight position={[-4, h - 0.9, 0]} intensity={22} distance={16} color="#ffe2b8" />
        <pointLight position={[10.5, h - 0.9, 2.5]} intensity={14} distance={12} color="#ffe2b8" />
        <pointLight position={[10.5, h - 0.9, -3.5]} intensity={12} distance={10} color="#ffe2b8" />
      </group>
    </group>
  )
}
