import { Shape, Vector2 } from 'three'
import { Box } from './Box'
import { palette } from './palette'

type Vec3 = [number, number, number]

interface CylinderProps {
  /** 아래쪽 반지름 */
  radius: number
  /** 위쪽 반지름. 주지 않으면 아래쪽과 같고 0을 주면 원뿔이 된다. */
  radiusTop?: number
  height: number
  /** 원기둥 중심의 위치 */
  position: Vec3
  color: string
  rotation?: Vec3
}

// 원기둥이나 원뿔 하나를 그린다. 기둥과 화분과 풀잎에 쓴다.
export function Cylinder({ radius, radiusTop = radius, height, position, color, rotation }: CylinderProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[radiusTop, radius, height, 10]} />
      <meshStandardMaterial color={color} flatShading roughness={0.9} />
    </mesh>
  )
}

/** 쌍기둥에서 기둥 하나의 반지름 */
const COLUMN_RADIUS = 0.09

// 가는 둥근 기둥 두 개를 한 쌍으로 세운다. 몸통은 황토색이고 위아래 끝은 검은색이다.
// position은 기둥 바닥의 가운데이고 along은 두 기둥이 나란히 서는 방향이다.
export function TwinColumn({ position, height, along = 'x' }: { position: Vec3; height: number; along?: 'x' | 'z' }) {
  const foot = 0.3
  const head = 0.45
  const body = height - foot - head
  return (
    <group position={position}>
      {[-0.15, 0.15].map((offset) => {
        const x = along === 'x' ? offset : 0
        const z = along === 'z' ? offset : 0
        return (
          <group key={offset}>
            <Cylinder radius={COLUMN_RADIUS} height={foot} position={[x, foot / 2, z]} color={palette.columnCap} />
            <Cylinder radius={COLUMN_RADIUS} height={body} position={[x, foot + body / 2, z]} color={palette.column} />
            <Cylinder radius={COLUMN_RADIUS} height={head} position={[x, height - head / 2, z]} color={palette.columnCap} />
          </group>
        )
      })}
    </group>
  )
}

// 0과 1 사이의 숫자를 번호마다 다르게 돌려준다.
// 같은 번호에는 항상 같은 숫자가 나와서 새로고침해도 풀과 돌의 자리가 바뀌지 않는다.
export function scatter(index: number, salt = 0) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

// 길쭉한 풀 한 포기. 가는 원뿔 여러 개를 바깥으로 기울여서 만든다.
// lean은 잎이 바깥으로 기우는 정도다. 1보다 작게 주면 잎이 더 곧게 선다.
export function Tuft({ position, scale = 1, seed = 0, lean: leanScale = 1 }: { position: Vec3; scale?: number; seed?: number; lean?: number }) {
  const colors = [palette.leafDark, palette.leaf, palette.leafLight]
  return (
    <group position={position} scale={scale}>
      {Array.from({ length: 7 }, (_, index) => {
        const angle = (index / 7) * Math.PI * 2 + scatter(index, seed)
        const lean = index === 0 ? 0 : (0.35 + scatter(index, seed + 1) * 0.3) * leanScale
        const length = 0.6 + scatter(index, seed + 2) * 0.35
        return (
          <group key={index} rotation={[0, angle, 0]}>
            <Cylinder
              radius={0.05}
              radiusTop={0}
              height={length}
              position={[Math.sin(lean) * length * 0.5, Math.cos(lean) * length * 0.5, 0]}
              rotation={[0, 0, -lean]}
              color={colors[index % colors.length]}
            />
          </group>
        )
      })}
    </group>
  )
}

interface PlanterProps {
  /** 화단의 x 범위와 z 범위 */
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /** 데크 윗면에서 화단 윗면까지의 높이 */
  height: number
  /** 심는 풀의 수 */
  tufts: number
  seed?: number
}

// 돌로 두른 낮은 화단. 안쪽에 흙을 채우고 풀을 심는다.
export function Planter({ minX, maxX, minZ, maxZ, height, tufts, seed = 0 }: PlanterProps) {
  const width = maxX - minX
  const depth = maxZ - minZ
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  return (
    <group>
      <Box size={[width, height, depth]} position={[centerX, height / 2, centerZ]} color={palette.stone} />
      <Box size={[width - 0.3, 0.04, depth - 0.3]} position={[centerX, height + 0.01, centerZ]} color={palette.soil} />
      {Array.from({ length: tufts }, (_, index) => (
        <Tuft
          key={index}
          seed={seed + index}
          scale={0.8 + scatter(index, seed + 5) * 0.5}
          position={[
            minX + 0.3 + (width - 0.6) * scatter(index, seed + 3),
            height,
            minZ + 0.3 + (depth - 0.6) * scatter(index, seed + 4),
          ]}
        />
      ))}
    </group>
  )
}

interface FlutedGlassProps {
  /** 유리가 뻗는 방향 */
  along: 'x' | 'z'
  /** 유리가 서 있는 자리. along이 'x'면 z 좌표이고 'z'면 x 좌표다. */
  at: number
  from: number
  to: number
  height: number
}

// 세로줄 유리. 반투명한 유리판 앞에 가는 세로 살을 촘촘히 붙여서 줄무늬가 보이게 한다.
export function FlutedGlass({ along, at, from, to, height }: FlutedGlassProps) {
  const length = to - from
  const ribs = Math.round(length / 0.09)
  const size = (run: number, thick: number): Vec3 => (along === 'z' ? [thick, height, run] : [run, height, thick])
  const place = (run: number): Vec3 => (along === 'z' ? [at, height / 2, run] : [run, height / 2, at])
  return (
    <group>
      <Box size={size(length, 0.03)} position={place((from + to) / 2)} color={palette.glass} opacity={0.45} roughness={0.2} />
      {Array.from({ length: ribs }, (_, index) => (
        <Box
          key={index}
          size={size(0.03, 0.05)}
          position={place(from + (length * (index + 0.5)) / ribs)}
          color={palette.white}
          opacity={0.5}
          roughness={0.2}
        />
      ))}
    </group>
  )
}

/** 바닥에 그린 윤곽을 위로 밀어 올릴 때 쓰는 회전. 윤곽의 점은 (x, -z)로 적는다. */
export const LAY_FLAT: Vec3 = [-Math.PI / 2, 0, 0]

/** (z, 높이)로 그린 윤곽을 -x 방향으로 밀어낼 때 쓰는 회전 */
export const FACE_X: Vec3 = [0, -Math.PI / 2, 0]

interface ExtrudedProps {
  /** 밀어낼 윤곽. 구멍이 있으면 shape.holes에 넣는다. */
  shape: Shape
  /** 밀어내는 길이 */
  depth: number
  position: Vec3
  rotation?: Vec3
  color: string
  roughness?: number
}

// 종이에 그린 윤곽을 두께만큼 밀어내서 입체로 만든다. 휜 소파와 책장과 거울 틀에 쓴다.
// ExtrudeGeometry는 2D 윤곽(Shape)을 한 방향으로 밀어 두께를 주는 Three.js 도형이다.
export function Extruded({ shape, depth, position, rotation, color, roughness = 0.9 }: ExtrudedProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <extrudeGeometry args={[shape, { depth, bevelEnabled: false, curveSegments: 10 }]} />
      <meshStandardMaterial color={color} flatShading roughness={roughness} />
    </mesh>
  )
}

// 가운데가 빈 부채꼴 띠의 윤곽을 만든다. 각도는 도 단위이고 +x 방향이 0도이며 +z 쪽으로 돈다.
// LAY_FLAT으로 눕혀 쓰도록 점을 (x, -z)로 적는다.
export function arcBand(centerX: number, centerZ: number, inner: number, outer: number, fromDeg: number, toDeg: number) {
  const steps = 18
  const points: Vector2[] = []
  const at = (radius: number, index: number) => {
    const angle = ((fromDeg + ((toDeg - fromDeg) * index) / steps) * Math.PI) / 180
    return new Vector2(centerX + Math.cos(angle) * radius, -(centerZ + Math.sin(angle) * radius))
  }
  for (let index = 0; index <= steps; index += 1) points.push(at(outer, index))
  for (let index = steps; index >= 0; index -= 1) points.push(at(inner, index))
  return new Shape(points)
}

// 흰색 수전. 가는 기둥이 올라가서 물이 나오는 쪽으로 꺾인다.
// position은 기둥 바닥이고 turn은 꺾이는 방향이다. 0이면 +x 쪽으로 꺾인다.
export function Faucet({ position, height, reach = 0.2, turn = 0 }: { position: Vec3; height: number; reach?: number; turn?: number }) {
  return (
    <group position={position} rotation={[0, turn, 0]}>
      <Cylinder radius={0.022} height={height} position={[0, height / 2, 0]} color={palette.white} />
      <Box size={[reach, 0.04, 0.04]} position={[reach / 2, height - 0.02, 0]} color={palette.white} />
      <Box size={[0.04, 0.07, 0.04]} position={[reach - 0.02, height - 0.07, 0]} color={palette.white} />
    </group>
  )
}

// 화분 하나. 흰 화분에 흙을 채우고 풀을 심는다.
export function Pot({ position, radius = 0.26, height = 0.5, seed = 0, scale = 1.2 }: { position: Vec3; radius?: number; height?: number; seed?: number; scale?: number }) {
  return (
    <group position={position}>
      <Cylinder radius={radius * 0.8} radiusTop={radius} height={height} position={[0, height / 2, 0]} color={palette.wall} />
      <Cylinder radius={radius * 0.9} height={0.02} position={[0, height + 0.005, 0]} color={palette.soil} />
      <Tuft position={[0, height, 0]} scale={scale} seed={seed} lean={0.7} />
    </group>
  )
}

// 스스로 빛나는 상자. 조명 기구의 빛나는 부분에 쓴다.
export function Glow({ size, position, color = '#ffd9a0' }: { size: Vec3; position: Vec3; color?: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
    </mesh>
  )
}
