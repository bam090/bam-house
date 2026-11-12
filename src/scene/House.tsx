import { Box } from './Box'
import { palette } from './palette'
import { DECK_HEIGHT, FLOOR_HEIGHT, STAIRS, STEP_COUNT, STEP_HEIGHT } from './walkable'

// 집의 크기를 정한 값이다.
// 다음 단계에서 고양이가 벽을 통과하지 못하게 막을 때도 이 값을 쓴다.
export const ROOM = {
  /** 거실의 가로 절반 길이 */
  halfWidth: 8,
  /** 거실의 깊이 절반 길이 */
  halfDepth: 6,
  /** 거실 바닥에서 천장까지의 높이 */
  height: 3.5,
} as const

// 평평한 지붕의 단층 건물이다.
// 뒤쪽 벽만 막혀 있고 왼쪽과 오른쪽은 유리창이며 테라스 쪽은 열려 있다.
// 거실 바닥은 수영장 데크보다 FLOOR_HEIGHT만큼 높고 앞쪽 계단으로 내려간다.
// 데크 윗면이 이 컴포넌트의 높이 0이다. 장면에서는 테라스와 함께 DECK_HEIGHT만큼 올려서 놓는다.
export function House() {
  const { halfWidth: w, halfDepth: d, height: h } = ROOM
  const columnZ = [-d, 0, d]

  return (
    <group>
      {/* 집 아래의 돌 받침. 데크 돌판과 같은 높이에서 땅속까지 내려간다. */}
      <Box size={[w * 2, DECK_HEIGHT + 1.2, d * 2]} position={[0, -(DECK_HEIGHT + 1.2) / 2, 0]} color={palette.stone} />

      {/* 거실을 받치는 돌 받침. 옆면이 바닥 판과 겹쳐 깜빡이지 않도록 조금 안쪽으로 들였다. */}
      <Box
        size={[w * 2 - 0.1, FLOOR_HEIGHT - 0.1, d * 2 - 0.1]}
        position={[0, (FLOOR_HEIGHT - 0.1) / 2, 0]}
        color={palette.stoneDark}
      />

      {/* 거실 앞 계단. 위쪽 단부터 차례로 낮아진다. */}
      {Array.from({ length: STEP_COUNT }, (_, index) => {
        const top = FLOOR_HEIGHT - STEP_HEIGHT * (index + 1)
        const z = STAIRS.startZ + STAIRS.stepDepth * (index + 0.5)
        return (
          <Box
            key={index}
            size={[STAIRS.halfWidth * 2, top, STAIRS.stepDepth]}
            position={[0, top / 2, z]}
            color={palette.stone}
          />
        )
      })}

      {/* 거실 바닥 위의 모든 것은 이 group 안에 있어서 바닥 높이만큼 함께 올라간다. */}
      <group position={[0, FLOOR_HEIGHT, 0]}>
        {/* 거실 바닥 */}
        <Box size={[w * 2, 0.2, d * 2]} position={[0, -0.1, 0]} color={palette.woodFloor} />

        {/* 뒤쪽 벽. 3단계 이후에 여기에 TV를 건다. */}
        <Box size={[w * 2, h, 0.25]} position={[0, h / 2, -d]} color={palette.wall} />

        {/* 왼쪽 유리창은 바다를 향하고 오른쪽 유리창은 숲을 향한다. */}
        <Box size={[0.08, h, d * 2]} position={[-w, h / 2, 0]} color={palette.glass} opacity={0.22} roughness={0.1} />
        <Box size={[0.08, h, d * 2]} position={[w, h / 2, 0]} color={palette.glass} opacity={0.22} roughness={0.1} />

        {/* 유리창 사이사이에 세운 나무 기둥 */}
        {columnZ.map((z) => (
          <group key={z}>
            <Box size={[0.22, h, 0.22]} position={[-w, h / 2, z]} color={palette.wood} />
            <Box size={[0.22, h, 0.22]} position={[w, h / 2, z]} color={palette.wood} />
          </group>
        ))}

        {/* 평평한 지붕. 벽보다 바깥으로 나오게 해서 처마를 만든다. */}
        <Box size={[w * 2 + 2.4, 0.35, d * 2 + 2.4]} position={[0, h + 0.18, 0]} color={palette.stone} />
        <Box size={[w * 2 + 1.6, 0.12, d * 2 + 1.6]} position={[0, h - 0.05, 0]} color={palette.wood} />

        {/* 지붕이 햇빛을 가리기 때문에 실내에 따뜻한 색 조명을 따로 둔다. */}
        <pointLight position={[-w / 2, h - 0.9, 0]} intensity={22} distance={16} color="#ffe2b8" />
        <pointLight position={[w / 2, h - 0.9, 0]} intensity={22} distance={16} color="#ffe2b8" />
      </group>
    </group>
  )
}
