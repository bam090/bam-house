import type { ReactNode } from 'react'

type Vec3 = [number, number, number]

interface BoxProps {
  /** 가로와 높이와 깊이 */
  size: Vec3
  /** 상자 중심의 위치 */
  position: Vec3
  color: string
  rotation?: Vec3
  /** 1보다 작으면 반투명해진다. 유리와 물에 쓴다. */
  opacity?: number
  /** 표면이 얼마나 거친지 정한다. 0에 가까울수록 매끈하다. */
  roughness?: number
  /** false로 주면 그림자를 만들지 않는다. */
  castShadow?: boolean
  children?: ReactNode
}

// 집과 가구는 대부분 상자를 조합해서 만든다.
// 같은 코드를 반복하지 않도록 상자 하나를 그리는 컴포넌트를 따로 두었다.
export function Box({
  size,
  position,
  color,
  rotation,
  opacity = 1,
  roughness = 0.9,
  castShadow = true,
  children,
}: BoxProps) {
  const transparent = opacity < 1
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow={castShadow && !transparent}
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        flatShading
        roughness={roughness}
        transparent={transparent}
        opacity={opacity}
      />
      {children}
    </mesh>
  )
}
