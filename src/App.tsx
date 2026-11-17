import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sky } from '@react-three/drei'
import { House } from './scene/House'
import { FadeBlockingWalls } from './scene/Occlusion'
import { Landscape } from './scene/Landscape'
import { CAMERA_OFFSET, Player, START_POSITION } from './scene/Player'
import { CAT_REVIEW_SPOTS } from './scene/cat-motion'
import type { CatReviewSpot } from './scene/cat-motion'
import type { CatCommand, CatTrialInput, CatVariant, PlayerStatus } from './scene/cat-motion'
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
  const [variant, setVariant] = useState<CatVariant>(() => new URLSearchParams(location.search).get('cat') === 'legacy' ? 'legacy' : 'snowdrop')
  const [modelError, setModelError] = useState(false)
  const [spot, setSpot] = useState<CatReviewSpot>('terrace')
  const [reviewSpot, setReviewSpot] = useState<{ id: CatReviewSpot; tick: number } | null>(null)
  const commandRef = useRef<CatCommand>(null)
  const trialInputRef = useRef<CatTrialInput>({ remaining: 0, forward: 0, jump: false })
  const motionRef = useRef<PlayerStatus>({ x: 7, y: 0, z: 13, speed: 0, grounded: true, verticalSpeed: 0, pose: '불러오는 중', jumpPeak: 0, movementBlocked: false })
  const status = useRef<HTMLOutputElement>(null)
  const changeCat = (next: CatVariant) => {
    setVariant(next); setModelError(false)
    const url = new URL(location.href); url.searchParams.set('cat', next); history.replaceState(null, '', url)
  }
  const modelFailed = useCallback(() => { setModelError(true); setVariant('legacy') }, [])
  const poseCommand = (command: CatCommand) => {
    commandRef.current = command
    document.querySelector<HTMLCanvasElement>('canvas')?.focus()
  }
  useEffect(() => {
    const timer = window.setInterval(() => {
      const m = motionRef.current
      if (status.current) status.current.textContent = `${m.pose} · ${m.speed.toFixed(2)} m/s · ${m.grounded ? '지면' : '공중'}\n위치 ${m.x.toFixed(2)}, ${m.y.toFixed(2)}, ${m.z.toFixed(2)} · 점프 상승 ${m.jumpPeak.toFixed(2)}m`
    }, 150)
    return () => clearInterval(timer)
  }, [])
  return (
    <>
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: CAMERA_START, fov: 45, near: 0.3, far: 3000 }} onCreated={({ gl }) => { gl.domElement.tabIndex = 0; gl.domElement.setAttribute('aria-label', '밤하우스 플레이 화면') }}>
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
        // normalBias는 그림자를 받는 면을 그 면의 바깥 방향으로 0.08m 밀어서 계산한다.
        // 지붕 판이 벽 윗면과 맞닿아 있어서 이것이 없으면 벽 윗면과 지붕 옆면에 줄무늬 그림자가 생긴다.
        shadow-normalBias={0.08}
      />

      <Landscape />
      {/* 집과 수영장 데크는 잔디보다 DECK_HEIGHT만큼 높은 돌 받침 위에 놓인다. */}
      <group position={[0, DECK_HEIGHT, 0]}>
        {/* 카메라와 고양이 사이에 낀 벽과 기둥은 반투명하게 바꾼다. */}
        <FadeBlockingWalls>
          <House />
          <Terrace />
        </FadeBlockingWalls>
      </group>

      <Player variant={variant} motionRef={motionRef} commandRef={commandRef} trialInputRef={trialInputRef} reviewSpot={reviewSpot} onModelError={modelFailed} />
    </Canvas>
    <section className="cat-trial" aria-label="고양이 시험 적용">
      <label>고양이 <select aria-label="고양이 선택" value={variant} onChange={e => changeCat(e.target.value as CatVariant)}><option value="snowdrop">Snowdrop · 시험 적용</option><option value="legacy">기존 고양이</option></select></label>
      {variant === 'snowdrop' && <div className="cat-trial-actions"><button onClick={() => poseCommand('sit')}>앉기 / 일어서기 (X)</button><button onClick={() => poseCommand('lie')}>눕기 / 일어서기 (C)</button></div>}
      {modelError && <p role="status">모델을 불러오지 못해 기존 고양이로 전환했습니다.</p>}
      <details><summary>시험 위치와 상태</summary>
        <div className="cat-trial-actions"><select aria-label="확인 지점" value={spot} onChange={e => setSpot(e.target.value as CatReviewSpot)}>{Object.entries(CAT_REVIEW_SPOTS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select><button onClick={() => setReviewSpot({ id: spot, tick: Date.now() })}>이동</button></div>
        <div className="cat-trial-actions"><button onClick={() => { trialInputRef.current = { remaining: 2, forward: 1, jump: false } }}>앞으로 2초</button><button onClick={() => { trialInputRef.current = { remaining: 2, forward: -1, jump: false } }}>뒤로 2초</button></div>
        <div className="cat-trial-actions"><button onClick={() => { trialInputRef.current = { remaining: 0, forward: 0, jump: true } }}>제자리 점프</button><button onClick={() => { trialInputRef.current = { remaining: .25, forward: 1, jump: true } }}>앞으로 점프</button></div>
        <output ref={status} data-testid="player-status" />
      </details>
    </section>
    <p className="hint">WASD 이동 · X 앉기 · C 눕기 · Space 점프 · 방향키나 드래그로 시선 전환 · 휠로 확대와 축소</p>
    </>
  )
}

export default App
