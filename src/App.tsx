import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { House } from './scene/House'
import { Landscape } from './scene/Landscape'
import { CAMERA_OFFSET, Player, START_POSITION } from './scene/Player'
import { Terrace } from './scene/Terrace'
import { DECK_HEIGHT } from './scene/walkable'

// 해의 위치다. 하늘 색과 햇빛 방향이 같은 값을 쓰도록 한곳에 두었다.
const SUN_POSITION: [number, number, number] = [-30, 40, 25]

// 카메라의 첫 위치. 고양이가 서 있는 자리에서 뒤쪽 위로 떨어진 곳이다.
const CAMERA_START: [number, number, number] = [
  START_POSITION[0] + CAMERA_OFFSET[0],
  START_POSITION[1] + CAMERA_OFFSET[1],
  START_POSITION[2] + CAMERA_OFFSET[2],
]

function App() {
  return (
    <>
    <Canvas shadows camera={{ position: CAMERA_START, fov: 45, near: 0.3, far: 3000 }}>
      {/* 낮 하늘 */}
      <Sky sunPosition={SUN_POSITION} turbidity={4} rayleigh={0.8} />

      {/* 하늘과 땅에서 고르게 들어오는 빛 */}
      <hemisphereLight args={['#ffffff', '#c9b79a', 0.9]} />

      {/* 햇빛. 그림자를 만드는 조명이다. */}
      <directionalLight
        position={SUN_POSITION}
        intensity={2.2}
        color="#fff3dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-far={120}
        shadow-bias={-0.0005}
      />

      <Landscape />
      {/* 집과 수영장 데크는 잔디보다 DECK_HEIGHT만큼 높은 돌 받침 위에 놓인다. */}
      <group position={[0, DECK_HEIGHT, 0]}>
        <House />
        <Terrace />
      </group>

      <Player />
    </Canvas>
    <p className="hint">WASD 이동 · Space 점프 · 방향키나 드래그로 시선 전환 · 휠로 확대와 축소</p>
    </>
  )
}

export default App
