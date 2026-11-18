import { useMemo } from 'react'
import { Instance, Instances } from '@react-three/drei'
import { BufferAttribute, BufferGeometry, Color, PlaneGeometry } from 'three'
import { palette } from './palette'
import {
  COVER_FLATTEN,
  TREE_CROWN,
  TREE_TRUNK_HEIGHT,
  TRUNK_HEIGHT,
  makePlants,
  shorelinePoints,
} from './plants'
import {
  PLATEAU_Y,
  SEA_LEVEL,
  beachWidthAt,
  distanceFromPlateau,
  distanceFromLawnStrip,
  groundCoverShade,
  inGroundCover,
  inGardenFringe,
  inHouseGarden,
  shoreDistance,
  terrainHeight,
} from './terrain'

/** 지형 한 변의 길이 */
const TERRAIN_SIZE = 480
/** 지형을 나누는 칸의 수. 클수록 굴곡이 세밀해진다. 한 칸이 1.5m라서 마당 끝의 둥근 휨이 각지지 않는다. */
const TERRAIN_SEGMENTS = 320
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
  const coverColors = COVER_SHADES.map((shade) => new Color(shade))
  const color = new Color()

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const z = positions.getZ(index)
    const height = terrainHeight(x, z)
    positions.setY(index, height)

    // 물가에서의 거리와 높이에 따라 색을 고른다.
    const shore = shoreDistance(x, z)
    const beachWidth = beachWidthAt(x)
    if (shore < Math.min(3, beachWidth)) {
      // 물에 젖은 모래
      color.copy(wetSand)
    } else if (shore < beachWidth) {
      color.copy(wetSand).lerp(sand, Math.min(1, (shore - 3) / 4))
    } else if (shore < beachWidth + 6 && beachWidth > 1) {
      // 해변이 잔디로 바뀌는 경계
      color.copy(sand).lerp(lawn, (shore - beachWidth) / 6)
    } else if (shore < beachWidth + 14 && beachWidth > 1) {
      // 잔디가 비탈의 풀숲으로 바뀌는 경계
      color.copy(lawn).lerp(slope, (shore - beachWidth - 6) / 8)
    } else if (distanceFromPlateau(x, z) < 6 && height > PLATEAU_Y - 2.4) {
      // 집 주변의 반원 잔디 마당
      color.copy(lawn)
    } else if (distanceFromPlateau(x, z) < 12 && height > PLATEAU_Y - 2.4) {
      // 잔디가 숲 바닥으로 천천히 바뀌는 띠. 색이 한 번에 바뀌면 경계선이 또렷하게 보인다.
      color.copy(lawn).lerp(slope, (distanceFromPlateau(x, z) - 6) / 6)
    } else if (height > PLATEAU_Y + 3) {
      color.copy(slope).lerp(hill, Math.min(1, (height - PLATEAU_Y - 3) / 16))
    } else {
      color.copy(slope)
    }
    // 마당 끝에서 모래사장까지 사다리꼴 모양의 비탈 잔디를 깐다.
    // 사다리꼴 바깥 6m에 걸쳐 숲 바닥 색으로 천천히 바뀐다.
    const strip = distanceFromLawnStrip(x, z)
    if (strip < 6 && shore > beachWidth + 6) {
      color.lerp(lawn, 1 - strip / 6)
    }
    // 집 오른쪽 정원의 바닥은 회색빛 초록 지피식물 색으로 칠한다.
    if (inHouseGarden(x, z)) {
      color.lerp(coverColors[3], 0.75)
    } else if (inGardenFringe(x, z)) {
      // 정원 바깥 띠는 지피식물 무리 색으로 칠한다.
      color.lerp(coverColors[groundCoverShade(x, z)], 0.6)
    }
    // 지피식물이 덮는 자리는 땅도 그 무리의 색으로 칠해서 포기 사이로 잔디가 비치지 않게 한다.
    if (inGroundCover(x, z) && shore > beachWidth + 2) {
      color.lerp(coverColors[groundCoverShade(x, z)], 0.75)
    }
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** 바다 판 한 변의 길이 */
const SEA_SIZE = 3000
/** 바다 판을 나누는 칸의 수. 한 칸이 10m라서 물가의 색 변화가 부드럽게 보인다. */
const SEA_SEGMENTS = 300

// 바다 판을 만들고 물가에서 멀어질수록 옥색에서 짙은 파란색이 되도록 꼭짓점마다 색을 칠한다.
function makeSeaGeometry() {
  const geometry = new PlaneGeometry(SEA_SIZE, SEA_SIZE, SEA_SEGMENTS, SEA_SEGMENTS)
  geometry.rotateX(-Math.PI / 2)

  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const shallow = new Color(palette.seaShallow)
  const mid = new Color(palette.seaMid)
  const deep = new Color(palette.sea)
  const color = new Color()

  for (let index = 0; index < positions.count; index += 1) {
    // 물가에서 바다 쪽으로 몇 미터 나갔는지 구한다.
    const offshore = -shoreDistance(positions.getX(index), positions.getZ(index))
    if (offshore < 30) {
      color.copy(shallow).lerp(mid, Math.max(0, offshore) / 30)
    } else {
      color.copy(mid).lerp(deep, Math.min(1, (offshore - 30) / 90))
    }
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
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

/** 덤불 잎 색 세 가지. Plant의 shade 번호로 고른다. */
const LEAF_SHADES = [palette.leafDark, palette.leaf, palette.leafLight]

/** 지피식물 무리 색 네 가지. Plant의 shade 번호로 고른다. */
const COVER_SHADES = [palette.coverDark, palette.cover, palette.coverLight, palette.coverGray]

// 집이 놓인 언덕과 바다로 내려가는 비탈과 해변과 숲이다.
export function Landscape() {
  // useMemo는 계산 결과를 기억해 두는 React 기능이다.
  // 화면을 다시 그릴 때마다 지형과 나무 위치를 새로 계산하지 않게 한다.
  const terrain = useMemo(() => makeTerrainGeometry(), [])
  const { palms, bushes, trees: forestTrees, covers, lowTrees, gardenTrees } = useMemo(
    () => makePlants(),
    [],
  )
  // 숲의 활엽수와 낮은 나무와 정원 나무는 모양이 같아서 함께 그린다.
  const trees = useMemo(
    () => [...forestTrees, ...lowTrees, ...gardenTrees],
    [forestTrees, lowTrees, gardenTrees],
  )
  const sea = useMemo(() => makeSeaGeometry(), [])
  // 파도 거품 세 줄. 물가에 붙은 넓은 거품과 그 바깥에서 부서지는 파도 두 줄이다.
  const foamNear = useMemo(() => makeFoamGeometry(-0.4, 7), [])
  const foamMid = useMemo(() => makeFoamGeometry(11, 14), [])
  const foamFar = useMemo(() => makeFoamGeometry(20, 22), [])

  return (
    <group>
      {/* 땅 */}
      <mesh geometry={terrain} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>

      {/* 바다 */}
      <mesh geometry={sea} position={[0, SEA_LEVEL, 0]}>
        <meshStandardMaterial vertexColors roughness={0.25} />
      </mesh>

      {/* 물가의 파도 거품. 수면보다 조금 위에 두어서 수면과 겹쳐 깜빡이지 않게 한다. */}
      <mesh geometry={foamNear} position={[0, SEA_LEVEL + 0.12, 0]}>
        <meshStandardMaterial color={palette.foam} transparent opacity={0.9} />
      </mesh>
      <mesh geometry={foamMid} position={[0, SEA_LEVEL + 0.12, 0]}>
        <meshStandardMaterial color={palette.foam} transparent opacity={0.75} />
      </mesh>
      <mesh geometry={foamFar} position={[0, SEA_LEVEL + 0.12, 0]}>
        <meshStandardMaterial color={palette.foam} transparent opacity={0.5} />
      </mesh>

      {/* 식물은 움직이지 않으므로 인스턴스의 위치와 색은 처음 한 번만 계산한다. */}
      <Instances limit={bushes.length} frames={1} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading />
        {bushes.map((bush, index) => (
          <Instance
            key={index}
            position={[bush.x, bush.y + bush.scale * 0.55, bush.z]}
            rotation={[0, bush.turn, 0]}
            scale={bush.scale}
            color={LEAF_SHADES[bush.shade]}
          />
        ))}
      </Instances>

      {/* 지피식물. 덤불 모양을 위아래로 납작하게 눌러서 땅에 낮게 깔리게 한다. */}
      <Instances limit={covers.length} frames={1} receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading />
        {covers.map((cover, index) => (
          <Instance
            key={index}
            position={[cover.x, cover.y + cover.scale * COVER_FLATTEN * 0.4, cover.z]}
            rotation={[0, cover.turn, 0]}
            scale={[cover.scale, cover.scale * COVER_FLATTEN, cover.scale]}
            color={COVER_SHADES[cover.shade]}
          />
        ))}
      </Instances>

      {/* 활엽수 줄기 */}
      <Instances limit={trees.length} frames={1} castShadow>
        <cylinderGeometry args={[0.12, 0.2, TREE_TRUNK_HEIGHT, 6]} />
        <meshStandardMaterial color={palette.trunk} flatShading />
        {trees.map((tree, index) => (
          <Instance
            key={index}
            position={[tree.x, tree.y + (TREE_TRUNK_HEIGHT * tree.scale) / 2, tree.z]}
            rotation={[0, tree.turn, 0]}
            scale={tree.scale}
          />
        ))}
      </Instances>

      {/* 활엽수 잎 덩어리. 넓고 납작하게 펴서 줄기 위에 얹는다. */}
      <Instances limit={trees.length} frames={1} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial flatShading />
        {trees.map((tree, index) => (
          <Instance
            key={index}
            position={[
              tree.x,
              tree.y + (TREE_TRUNK_HEIGHT + TREE_CROWN.radius * TREE_CROWN.flatten) * tree.scale,
              tree.z,
            ]}
            rotation={[0, tree.turn, 0]}
            scale={[
              TREE_CROWN.radius * tree.scale,
              TREE_CROWN.radius * TREE_CROWN.flatten * tree.scale,
              TREE_CROWN.radius * tree.scale,
            ]}
            color={tree.shade === 0 ? palette.canopyDark : palette.canopy}
          />
        ))}
      </Instances>

      {/* 야자수 줄기 */}
      <Instances limit={palms.length} frames={1} castShadow>
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
      <Instances limit={palms.length * LEAVES_PER_PALM} frames={1} castShadow>
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
