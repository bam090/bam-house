import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

// 1단계 확인용 화면이다.
// 3D 라이브러리가 제대로 설치됐는지 보려고 바닥과 상자 하나만 그린다.
// 2단계에서 집과 풍경으로 바꾼다.
function App() {
  return (
    <Canvas shadows camera={{ position: [4, 4, 6], fov: 45 }}>
      <color attach="background" args={['#bfe3f5']} />
      <hemisphereLight args={['#ffffff', '#c9b79a', 0.9]} />
      <directionalLight position={[-5, 8, 4]} intensity={1} castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#d9b88f" />
      </mesh>

      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>

      <OrbitControls />
    </Canvas>
  )
}

export default App
