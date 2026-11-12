import { useMemo } from 'react'
import { Instance, Instances } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, Color, PlaneGeometry } from 'three'
import { palette } from './palette'
import { TRUNK_HEIGHT, makePlants, shorelinePoints } from './plants'
import {
  BEACH_WIDTH,
  PLATEAU_Y,
  SEA_LEVEL,
  distanceFromPlateau,
  shoreDistance,
  terrainHeight,
} from './terrain'

/** 지형 한 변의 길이 */
const TERRAIN_SIZE = 480
/** 지형을 나누는 칸의 수. 클수록 굴곡이 세밀해진다. */
const TERRAIN_SEGMENTS = 190
/** 지형의 중심. 해변과 곶이 지형 안에 들어오도록 집에서 조금 옮겼다. */
const TERRAIN_CENTER = { x: -30, z: 20 }

// 평평한 판을 만든 뒤에 꼭짓점마다 높이와 색을 정해서 지형을 만든다.
function makeTerrainGeometry() {
  const geometry = new PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
  // 판은 처음에 세워져 있다. 바닥에 눕힌 뒤에 중심을 옮긴다.
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(TERRAIN_CENTER.x, 0, TERRAIN_CENTER.z)

  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const sand = new Color(palette.sand)
  const wetSand = new Color(palette.wetSand)
  const lawn = new Color(palette.grass)
  const slope = new Color(palette.slope)
  const hill = new Color(palette.hill)
  const color = new Color()

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const z = positions.getZ(index)
    const height = terrainHeight(x, z)
    positions.setY(index, height)

    // 물가에서의 거리와 높이에 따라 색을 고른다.
    const shore = shoreDistance(x, z)
    if (shore < 3) {
      // 물에 젖은 모래
      color.copy(wetSand)
    } else if (shore < BEACH_WIDTH) {
      color.copy(wetSand).lerp(sand, Math.min(1, (shore - 3) / 4))
    } else if (shore < BEACH_WIDTH + 7) {
      // 해변이 풀밭으로 바뀌는 경계
      color.copy(sand).lerp(slope, (shore - BEACH_WIDTH) / 7)
    } else if (distanceFromPlateau(x, z) < 9 && height > PLATEAU_Y - 2.4) {
      // 집 주변의 잔디 마당
      color.copy(lawn)
    } else if (height > PLATEAU_Y + 3) {
      color.copy(slope).lerp(hill, Math.min(1, (height - PLATEAU_Y - 3) / 16))
    } else {
      color.copy(slope)
    }
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

// 물가를 따라 이어지는 띠 모양의 판을 만든다. 파도 거품을 그리는 데 쓴다.
function makeFoamGeometry(offsetNear: number, offsetFar: number) {
  const points = shorelinePoints(-270, 210, 4)
  const positions = new Float32Array(points.length * 6)
  const indices: number[] = []

  points.forEach((point, index) => {
    positions.set([point.x, 0, point.z + offsetNear, point.x, 0, point.z + offsetFar], index * 6)
    if (index < points.length - 1) {
      const start = index * 2
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2)
    }
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const LEAVES_PER_PALM = 7

// 집이 놓인 언덕과 바다로 내려가는 비탈과 해변과 숲이다.
export function Landscape() {
  // useMemo는 계산 결과를 기억해 두는 React 기능이다.
  // 화면을 다시 그릴 때마다 지형과 나무 위치를 새로 계산하지 않게 한다.
  const terrain = useMemo(makeTerrainGeometry, [])
  const { palms, bushes } = useMemo(makePlants, [])
  const foamNear = useMemo(() => makeFoamGeometry(-0.4, 4), [])
  const foamFar = useMemo(() => makeFoamGeometry(9, 10.6), [])

  return (
    <group>
      {/* 땅 */}
      <mesh geometry={terrain} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>

      {/* 바다 */}
      <mesh position={[0, SEA_LEVEL, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color={palette.sea} roughness={0.25} />
      </mesh>

      {/* 물가의 파도 거품. 수면보다 조금 위에 두어서 수면과 겹쳐 깜빡이지 않게 한다. */}
      <mesh geometry={foamNear} position={[0, SEA_LEVEL + 0.12, 0]}>
        <meshStandardMaterial color={palette.foam} transparent opacity={0.9} />
      </mesh>
      <mesh geometry={foamFar} position={[0, SEA_LEVEL + 0.12, 0]}>
        <meshStandardMaterial color={palette.foam} transparent opacity={0.6} />
      </mesh>

      {/* 덤불. 같은 모양을 여러 개 그릴 때는 Instances로 묶어서 한 번에 그린다. */}
      <Instances limit={bushes.length} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading />
        {bushes.map((bush, index) => (
          <Instance
            key={index}
            position={[bush.x, bush.y + bush.scale * 0.55, bush.z]}
            rotation={[0, bush.turn, 0]}
            scale={bush.scale}
            color={bush.light ? palette.leafLight : palette.leaf}
          />
        ))}
      </Instances>

      {/* 야자수 줄기 */}
      <Instances limit={palms.length} castShadow>
        <cylinderGeometry args={[0.1, 0.17, TRUNK_HEIGHT, 6]} />
        <meshStandardMaterial color={palette.trunk} flatShading />
        {palms.map((palm, index) => (
          <Instance
            key={index}
            position={[palm.x, palm.y + (TRUNK_HEIGHT * palm.scale) / 2 - 0.2, palm.z]}
            rotation={[0, palm.turn, 0.08]}
            scale={palm.scale}
          />
        ))}
      </Instances>

      {/* 야자수 잎. 줄기 꼭대기에서 일곱 장이 바깥으로 퍼진다. */}
      <Instances limit={palms.length * LEAVES_PER_PALM} castShadow>
        <boxGeometry args={[1.8, 0.05, 0.45]} />
        <meshStandardMaterial flatShading />
        {palms.map((palm, palmIndex) =>
          Array.from({ length: LEAVES_PER_PALM }, (_, leafIndex) => (
            <group
              key={`${palmIndex}-${leafIndex}`}
              position={[palm.x, palm.y + TRUNK_HEIGHT * palm.scale - 0.2, palm.z]}
              rotation={[0, palm.turn + (leafIndex / LEAVES_PER_PALM) * Math.PI * 2, 0]}
              scale={palm.scale}
            >
              <Instance
                position={[0.85, -0.18, 0]}
                rotation={[0, 0, -0.4]}
                color={leafIndex % 2 === 0 ? palette.leaf : palette.leafLight}
              />
            </group>
          )),
        )}
      </Instances>
    </group>
  )
}
