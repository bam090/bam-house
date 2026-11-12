import { Box } from './Box'
import { palette } from './palette'

// 거실 앞에 있는 돌바닥 테라스와 수영장이다.
// 방문자는 이 테라스에서 출발해서 거실로 들어간다.
export function Terrace() {
  return (
    // 거실이 깊어진 만큼 테라스 전체를 앞쪽으로 1m 옮겼다.
    <group position={[0, 0, 1]}>
      {/* 돌바닥 */}
      <Box size={[20, 0.2, 8]} position={[0, -0.1, 9]} color={palette.stone} />

      {/* 수영장 테두리 네 개 */}
      <Box size={[7.4, 0.3, 0.3]} position={[0, 0.15, 7.35]} color={palette.stoneDark} />
      <Box size={[7.4, 0.3, 0.3]} position={[0, 0.15, 11.25]} color={palette.stoneDark} />
      <Box size={[0.3, 0.3, 3.6]} position={[-3.55, 0.15, 9.3]} color={palette.stoneDark} />
      <Box size={[0.3, 0.3, 3.6]} position={[3.55, 0.15, 9.3]} color={palette.stoneDark} />

      {/* 수영장 물. 반투명한 파란색으로 표현한다. */}
      <Box
        size={[6.8, 0.2, 3.6]}
        position={[0, 0.12, 9.3]}
        color={palette.water}
        opacity={0.85}
        roughness={0.15}
      />

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
