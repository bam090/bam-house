import { LivingRoomModel } from './LivingRoomModel'
import { Box } from './Box'
import { palette } from './palette'
import { Cylinder, Glow } from './Shapes'

// 집 안의 조명 기구를 그리는 파일이다. 색은 모두 전구색이다.
// 실제로 빛을 내는 조명(pointLight)은 소파 스탠드와 변기 칸 벽등 둘뿐이고 나머지는 빛나는 재질로만 표현한다.
// 실제 조명을 늘리면 화면을 그리는 계산이 무거워지기 때문이다.

type Spot = [number, number, number]

/** 전구색. 빛나는 면과 실제 조명에 함께 쓴다. */
const WARM = '#ffd9a0'

// 스스로 빛나는 것처럼 보이는 재질. emissive는 조명을 받지 않아도 그 색으로 밝게 보이게 하는 값이다.
function WarmGlass({ strength = 1.2 }: { strength?: number }) {
  return <meshStandardMaterial color="#fff4e0" emissive={WARM} emissiveIntensity={strength} roughness={0.6} />
}

// 받침 중심을 기존 자리 (4.4, 0.9)에 맞추고 갓은 소파 쪽으로 돌린다.
function ArcFloorLamp() {
  return (
    <group>
      <LivingRoomModel file="living-room/floor-lamp/floor-lamp-bronze-arc.glb" x={4.24} z={0.72} turn={-2.43} height={2.23} />
      <pointLight position={[4.23, 1.65, 0.71]} intensity={7} distance={6} color={WARM} />
    </group>
  )
}

// 48번 버섯형 램프. position은 램프를 올려놓는 면의 자리다.
function MushroomLamp({ position }: { position: Spot }) {
  const [x, y, z] = position
  return (
    <group>
      <Cylinder radius={0.07} height={0.02} position={[x, y + 0.01, z]} color={palette.oak} />
      <Cylinder radius={0.028} height={0.16} position={[x, y + 0.1, z]} color={palette.oak} />
      {/* 갓은 공의 위쪽 절반이다. sphereGeometry의 뒤쪽 값 넷은 좌우로 도는 범위와 위아래 범위다. */}
      <mesh position={[x, y + 0.17, z]}>
        <sphereGeometry args={[0.14, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <WarmGlass strength={0.9} />
      </mesh>
      <Cylinder radius={0.14} height={0.012} position={[x, y + 0.17, z]} color={palette.wall} />
    </group>
  )
}

// 54번 타원 벽등. position은 벽면 위의 자리이고 normal은 벽에서 방 쪽으로 나오는 방향이다.
function OvalSconce({ position, normal }: { position: Spot; normal: 'x-' | 'z-' }) {
  const [x, y, z] = position
  const alongX = normal === 'x-'
  // 벽에서 나오는 방향으로는 납작하고 위아래로는 긴 타원이다.
  const scale: Spot = alongX ? [0.05, 0.17, 0.1] : [0.1, 0.17, 0.05]
  const plate: Spot = alongX ? [0.02, 0.12, 0.06] : [0.06, 0.12, 0.02]
  return (
    <group>
      <Box size={plate} position={alongX ? [x - 0.01, y, z] : [x, y, z - 0.01]} color={palette.oak} />
      <mesh position={alongX ? [x - 0.045, y, z] : [x, y, z - 0.045]} scale={scale}>
        <sphereGeometry args={[1, 14, 10]} />
        <WarmGlass />
      </mesh>
    </group>
  )
}

// 53번 반원 벽등. 아래가 둥근 반달 모양 흰 도자기이고 평평한 윗면에서 빛이 위로 퍼진다.
// position은 벽면 위의 자리다. turn은 y축으로 도는 각도이고 0이면 -z 쪽을 보는 벽에 붙는다.
function HalfMoonSconce({ position, turn = 0, light = false }: { position: Spot; turn?: number; light?: boolean }) {
  return (
    <group position={position} rotation={[0, turn, 0]}>
      {/* 원기둥의 절반만 만들어서 벽 쪽으로 눕힌다. 뒤쪽 값 둘은 시작 각도와 도는 범위다. */}
      <mesh position={[0, 0, -0.045]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.09, 16, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={palette.white} roughness={0.8} />
      </mesh>
      <Glow size={[0.26, 0.012, 0.06]} position={[0, 0.007, -0.045]} />
      {/* 벽에 번진 빛. 윗면 위쪽 벽에 옅게 빛나는 반달을 한 장 붙인다. */}
      <mesh position={[0, 0.02, -0.004]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.3, 16, 0, Math.PI]} />
        <meshStandardMaterial color={WARM} emissive={WARM} emissiveIntensity={0.7} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {light && <pointLight position={[0, 0.25, -0.3]} intensity={6} distance={5} color={WARM} />}
    </group>
  )
}

// 조명 기구 전체. Interior에서 불러 넣는다. 높이는 모두 방바닥에서 잰다.
export function Lamps({ ceiling }: { ceiling: number }) {
  return (
    <group>
      {/* 아일랜드 위의 펜던트 */}
      <LivingRoomModel file="kitchen/pendant-light/pendant-brass-linear-champagne.glb" x={-5.55} y={ceiling-1.65} z={2.3} width={2.4} height={1.65} turn={Math.PI / 2} originalMaterial />
      {/* 소파 끝 뒤에 세운 아치 스탠드. 갓이 소파 쪽을 향한다. */}
      <ArcFloorLamp />
      {/* 침대 양옆 협탁 위의 버섯형 램프 */}
      <MushroomLamp position={[10.05, 0.45, -0.52]} />
      <MushroomLamp position={[12.75, 0.45, -0.52]} />
      {/* 침실 고리 콘솔 위의 타원 벽등. 거실 왼쪽 벽의 벽등은 두 개가 한눈에 겹쳐 보여서 없앴다. */}
      <OvalSconce position={[8.2, 1.8, 5.7]} normal="z-" />
      {/* 욕실의 침실 쪽 벽에 둘과 변기 위 벽에 하나. 변기 칸 벽등만 실제로 빛을 낸다. */}
      {/* 욕실 벽등은 수건 걸이 바로 위에 하나만 둔다. 샤워부스 간접등과 같은 전구색이다. */}
      <LivingRoomModel file="bathroom/wall-lamp/wall-lamp-light-oak.glb" x={10.4} y={1.65} z={-1.18} pitch={-Math.PI / 2} turn={Math.PI} width={0.28} originalMaterial />
      <HalfMoonSconce position={[7.125, 1.8, -7.7]} turn={-Math.PI / 2} light />
    </group>
  )
}
