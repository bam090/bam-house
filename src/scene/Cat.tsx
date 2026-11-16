import { useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'

const FUR = '#fbfaf7'
const FUR_SHADE = '#ece8e0'
const PINK = '#f2b8c0'
const EYE = '#3d8fe0'

interface CatProps {
  /** 지금 걷고 있는지 알려 주는 값. 부모 컴포넌트가 매 프레임 갱신한다. */
  movingRef: RefObject<boolean>
}

// 집 안 그늘에서는 흰 털이 회색으로 보여서 털이 스스로 옅은 흰빛을 조금 내게 했다.
// sheen은 천이나 털처럼 표면이 보송한 물체의 가장자리에 생기는 옅은 광택이다.
function Fur({ color = FUR }: { color?: string }) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.9}
      sheen={1}
      sheenRoughness={0.5}
      sheenColor="#ffffff"
      emissive="#fff6ea"
      emissiveIntensity={0.22}
    />
  )
}

// 파란 눈의 흰색 터키시 앙고라다.
// 임시로 도형을 조합해서 만들었고 나중에 3D 모델 파일로 바꿀 수 있다.
// 머리가 +z 방향을 보도록 만들었다.
export function Cat({ movingRef }: CatProps) {
  const body = useRef<Group>(null)
  const tail = useRef<Group>(null)
  const legs = useRef<(Group | null)[]>([])
  const walkPhase = useRef(0)

  // useFrame에 넘긴 함수는 화면을 한 번 그릴 때마다 실행된다.
  useFrame((state, delta) => {
    const moving = movingRef.current
    if (moving) walkPhase.current += delta * 14

    // 걷는 동안 앞뒤 다리가 엇갈려서 흔들린다. 멈추면 천천히 제자리로 돌아온다.
    legs.current.forEach((leg, index) => {
      if (!leg) return
      const direction = index === 0 || index === 3 ? 1 : -1
      const target = moving ? Math.sin(walkPhase.current) * 0.7 * direction : 0
      leg.rotation.x += (target - leg.rotation.x) * Math.min(1, delta * 12)
    })

    if (body.current) {
      const bob = moving ? Math.abs(Math.sin(walkPhase.current)) * 0.03 : 0
      body.current.position.y = bob
    }

    // 꼬리는 항상 좌우로 천천히 흔들린다.
    if (tail.current) {
      tail.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.35
    }
  })

  const legPositions: [number, number][] = [
    [-0.13, 0.25],
    [0.13, 0.25],
    [-0.13, -0.25],
    [0.13, -0.25],
  ]

  return (
    <group scale={0.7}>
      <group ref={body}>
        {/* 몸통 */}
        <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.45, 6, 12]} />
          <Fur />
        </mesh>
        {/* 가슴 털 */}
        <mesh position={[0, 0.4, 0.27]} castShadow>
          <sphereGeometry args={[0.2, 12, 10]} />
          <Fur color={FUR_SHADE} />
        </mesh>

        {/* 머리 */}
        <group position={[0, 0.66, 0.4]}>
          <mesh castShadow>
            <sphereGeometry args={[0.2, 16, 12]} />
            <Fur />
          </mesh>
          {/* 귀 */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.11, 0.17, 0]} rotation={[0, 0, side * -0.25]}>
              <mesh castShadow>
                <coneGeometry args={[0.07, 0.16, 4]} />
                <Fur />
              </mesh>
              <mesh position={[0, -0.01, 0.025]} scale={[0.6, 0.7, 0.6]}>
                <coneGeometry args={[0.07, 0.16, 4]} />
                <meshStandardMaterial color={PINK} />
              </mesh>
            </group>
          ))}
          {/* 파란 눈 */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.085, 0.02, 0.17]}>
              <sphereGeometry args={[0.038, 10, 8]} />
              <meshStandardMaterial color={EYE} roughness={0.2} />
            </mesh>
          ))}
          {/* 주둥이와 코 */}
          <mesh position={[0, -0.05, 0.17]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <Fur />
          </mesh>
          <mesh position={[0, -0.035, 0.235]}>
            <sphereGeometry args={[0.018, 8, 6]} />
            <meshStandardMaterial color={PINK} />
          </mesh>
        </group>

        {/* 길고 풍성한 꼬리 */}
        <group ref={tail} position={[0, 0.5, -0.4]}>
          <mesh position={[0, 0.16, -0.1]} rotation={[-0.6, 0, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.3, 4, 10]} />
            <Fur />
          </mesh>
          <mesh position={[0, 0.42, -0.2]} rotation={[-0.15, 0, 0]} castShadow>
            <capsuleGeometry args={[0.095, 0.22, 4, 10]} />
            <Fur color={FUR_SHADE} />
          </mesh>
        </group>
      </group>

      {/* 다리 네 개. 회전의 중심이 다리 위쪽에 오도록 group으로 감쌌다. */}
      {legPositions.map(([x, z], index) => (
        <group
          key={index}
          position={[x, 0.3, z]}
          ref={(node) => {
            legs.current[index] = node
          }}
        >
          <mesh position={[0, -0.15, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.2, 4, 8]} />
            <Fur />
          </mesh>
        </group>
      ))}
    </group>
  )
}
