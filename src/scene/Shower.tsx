import { Box } from './Box'
import { palette } from './palette'
import { Cylinder, Glow } from './Shapes'
import { CEILING_HEIGHT, SHOWER } from './walkable'

// 욕실 모서리의 샤워부스. 2026-11-13 승인 A안이다.
// 침실 쪽 벽(z -1.1)에 트래버틴 판을 대고 가로로 긴 매립 선반(니치)과 간접등을 넣는다.
// 앞면과 입구 쪽은 투명 강화유리이고 수전과 레인샤워와 유리 틀은 모두 브라스다.
// 벽 판과 같은 돌로 만든 일체형 벤치를 뒷벽 오른쪽에 둔다.

/** 베이지 트래버틴과 그 가로 결 색 */
const TRAVERTINE = '#d9c7a7'
const GRAIN = '#c7b28e'
/** 니치 안쪽 깊은 면의 색. 그늘진 돌처럼 조금 어둡다. */
const NICHE_BACK = '#b9a27e'
/** 욕실 금속 마감. 거실과 주방 조명의 브라스와 맞춘다. */
const BRASS = palette.column

/** 뒷벽 트래버틴 판의 두께. 니치 깊이만큼 벽에서 앞으로 나온다. */
const PANEL = 0.12
/** 가로 니치. 바닥에서 잰 아랫면과 윗면 높이와 좌우 끝이다. */
const NICHE = { minX: 12.2, maxX: 13.7, bottom: 1.1, top: 1.38 } as const
/** 유리 높이 */
const GLASS_HEIGHT = 2.1

export function Shower() {
  const { minX, maxX, minZ, maxZ, entryZ, bench } = SHOWER
  const width = maxX - minX
  const centerX = (minX + maxX) / 2
  const wallFace = maxZ
  const panelFront = wallFace - PANEL
  const panelZ = wallFace - PANEL / 2
  const top = CEILING_HEIGHT - 0.01
  return (
    <group>
      {/* 샤워부스 바닥. 욕실 타일 위에 트래버틴 판을 깐다. */}
      <Box size={[width, 0.02, maxZ - minZ]} position={[centerX, 0.011, (minZ + maxZ) / 2]} color={TRAVERTINE} castShadow={false} />

      {/* 뒷벽 트래버틴 판. 니치 자리를 비우고 아래와 위와 양옆 네 조각으로 세운다. */}
      <Box size={[width, NICHE.bottom, PANEL]} position={[centerX, NICHE.bottom / 2, panelZ]} color={TRAVERTINE} />
      <Box size={[width, top - NICHE.top, PANEL]} position={[centerX, (top + NICHE.top) / 2, panelZ]} color={TRAVERTINE} />
      <Box size={[NICHE.minX - minX, NICHE.top - NICHE.bottom, PANEL]} position={[(minX + NICHE.minX) / 2, (NICHE.bottom + NICHE.top) / 2, panelZ]} color={TRAVERTINE} />
      <Box size={[maxX - NICHE.maxX, NICHE.top - NICHE.bottom, PANEL]} position={[(NICHE.maxX + maxX) / 2, (NICHE.bottom + NICHE.top) / 2, panelZ]} color={TRAVERTINE} />
      {/* 니치 안쪽 깊은 면. 벽 면에서 0.002m 띄운다. */}
      <Box size={[NICHE.maxX - NICHE.minX, NICHE.top - NICHE.bottom, 0.01]} position={[(NICHE.minX + NICHE.maxX) / 2, (NICHE.bottom + NICHE.top) / 2, wallFace - 0.007]} color={NICHE_BACK} castShadow={false} />
      {/* 니치 위아래의 매립 간접등. 니치 안쪽 윗면과 아랫면 가장자리에 붙인다. */}
      <Glow size={[NICHE.maxX - NICHE.minX - 0.04, 0.012, 0.02]} position={[(NICHE.minX + NICHE.maxX) / 2, NICHE.top - 0.007, panelFront + 0.02]} />
      <Glow size={[NICHE.maxX - NICHE.minX - 0.04, 0.012, 0.02]} position={[(NICHE.minX + NICHE.maxX) / 2, NICHE.bottom + 0.007, panelFront + 0.02]} />
      {/* 트래버틴 가로 결. 판 앞면에서 조금 띄운 얇은 띠를 높이마다 다르게 긋는다. */}
      {[0.32, 0.71, 1.62, 1.95, 2.38, 2.8, 3.17].map((y) => (
        <Box key={y} size={[width - 0.02, 0.012, 0.004]} position={[centerX, y, panelFront - 0.003]} color={GRAIN} castShadow={false} />
      ))}
      {/* 니치 안의 물건. 원목 트레이 위의 비누와 병 둘 */}
      <Box size={[0.3, 0.015, 0.08]} position={[12.6, NICHE.bottom + 0.008, wallFace - 0.06]} color={palette.oak} />
      <Box size={[0.08, 0.03, 0.05]} position={[12.55, NICHE.bottom + 0.03, wallFace - 0.06]} color={palette.white} />
      <Cylinder radius={0.025} height={0.17} position={[13.25, NICHE.bottom + 0.085, wallFace - 0.06]} color={palette.wall} />
      <Cylinder radius={0.022} height={0.13} position={[13.35, NICHE.bottom + 0.065, wallFace - 0.06]} color={palette.greige} />

      {/* 벽과 같은 돌로 만든 일체형 벤치. 뒷벽 판 앞에 붙는다. */}
      <Box size={[bench.maxX - bench.minX, bench.top, bench.maxZ - bench.minZ]} position={[(bench.minX + bench.maxX) / 2, bench.top / 2, (bench.minZ + bench.maxZ) / 2]} color={TRAVERTINE} />
      <Box size={[bench.maxX - bench.minX - 0.02, 0.012, 0.004]} position={[(bench.minX + bench.maxX) / 2, bench.top * 0.5, bench.minZ - 0.003]} color={GRAIN} castShadow={false} />

      {/* 천장 매립 사각 레인샤워. 천장 판 바로 아래에 붙인다. */}
      <Box size={[0.32, 0.015, 0.32]} position={[12.95, CEILING_HEIGHT - 0.011, -2.05]} color={BRASS} roughness={0.35} />
      <Box size={[0.28, 0.004, 0.28]} position={[12.95, CEILING_HEIGHT - 0.021, -2.05]} color={palette.columnCap} roughness={0.4} castShadow={false} />

      {/* 벽의 수전과 핸드 샤워기. 둥근 판과 레버, 세로 봉과 거기에 걸린 손잡이 샤워기 */}
      <Cylinder radius={0.06} height={0.012} position={[12.35, 0.85, panelFront - 0.006]} rotation={[Math.PI / 2, 0, 0]} color={BRASS} />
      <Box size={[0.1, 0.018, 0.018]} position={[12.39, 0.85, panelFront - 0.03]} color={BRASS} roughness={0.35} />
      {/* 손 샤워기 봉은 니치 아래에서 끝나게 해서 니치 앞을 가리지 않는다. */}
      <Cylinder radius={0.012} height={0.42} position={[12.62, 0.78, panelFront - 0.03]} color={BRASS} />
      <Cylinder radius={0.014} height={0.18} position={[12.62, 0.93, panelFront - 0.06]} rotation={[0.3, 0, 0]} color={BRASS} />
      <Cylinder radius={0.035} height={0.02} position={[12.62, 1.03, panelFront - 0.09]} rotation={[0.3, 0, 0]} color={BRASS} />

      {/* 투명 강화유리. 앞면 한 장과 입구 쪽 고정 판 한 장 */}
      <Box size={[width, GLASS_HEIGHT, 0.012]} position={[centerX, GLASS_HEIGHT / 2 + 0.03, minZ]} color={palette.glass} opacity={0.18} roughness={0.05} />
      <Box size={[0.012, GLASS_HEIGHT, entryZ - minZ]} position={[minX, GLASS_HEIGHT / 2 + 0.03, (minZ + entryZ) / 2]} color={palette.glass} opacity={0.18} roughness={0.05} />
      {/* 브라스 유리 틀. 유리 윗변과 아랫변의 가는 띠와 입구 쪽에서 뒷벽까지 잇는 지지 봉 */}
      {[0.03, GLASS_HEIGHT + 0.03].map((y) => (
        <group key={y}>
          <Box size={[width, 0.02, 0.024]} position={[centerX, y, minZ]} color={BRASS} roughness={0.35} />
          <Box size={[0.024, 0.02, entryZ - minZ + 0.012]} position={[minX, y, (minZ + entryZ) / 2]} color={BRASS} roughness={0.35} />
        </group>
      ))}
      <Box size={[0.016, 0.016, panelFront - entryZ]} position={[minX, GLASS_HEIGHT + 0.03, (entryZ + panelFront) / 2]} color={BRASS} roughness={0.35} />
    </group>
  )
}
