import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { CanvasTexture, Mesh, MeshStandardMaterial, SkinnedMesh } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { Cat } from './Cat'
import { createCatAnimator, SNOWDROP_MODEL_FILE, SNOWDROP_SCALE } from './cat-motion'
import type { CatCommand, PlayerStatus } from './cat-motion'
import { enableDualQuaternionSkinning } from './dual-quaternion'

class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function Model({ motionRef, commandRef }: { motionRef: RefObject<PlayerStatus>; commandRef: RefObject<CatCommand> }) {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/characters/snowdrop/${SNOWDROP_MODEL_FILE}?v=tail-clean-1`)
  const contact = useRef<Mesh>(null)
  const contactMap = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')!
    const gradient = context.createRadialGradient(32, 32, 4, 32, 32, 32)
    gradient.addColorStop(0, 'white'); gradient.addColorStop(1, 'black')
    context.fillStyle = gradient; context.fillRect(0, 0, 64, 64)
    return new CanvasTexture(canvas)
  }, [])
  useEffect(() => () => contactMap.dispose(), [contactMap])
  const actor = useMemo(() => {
    const model = clone(gltf.scene), materials: MeshStandardMaterial[] = [], skins: ReturnType<typeof enableDualQuaternionSkinning>[] = []
    model.traverse(o => {
      if (!(o instanceof Mesh)) return
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false
      const adjust = (source: MeshStandardMaterial) => {
        const material = source.clone()
        // 실내 그늘에서도 원본 흰 털과 눈 텍스처의 색을 읽을 수 있게 한다.
        material.emissive.set('#fffdf9'); material.emissiveMap = material.map; material.emissiveIntensity = .12
        materials.push(material); return material
      }
      o.material = Array.isArray(o.material) ? o.material.map(m => adjust(m as MeshStandardMaterial)) : adjust(o.material as MeshStandardMaterial)
      if (o instanceof SkinnedMesh && model.getObjectByName('Snowdrop')?.userData.skinning === 'dualQuaternion') skins.push(enableDualQuaternionSkinning(o))
    })
    const data = model.getObjectByName('Snowdrop')?.userData.gait
    return { model, sourceSpeed: data?.speed as number, materials, skins }
  }, [gltf])
  const animation = useRef<ReturnType<typeof createCatAnimator> | null>(null)
  useEffect(() => {
    animation.current = createCatAnimator(actor.model, gltf.animations, actor.sourceSpeed)
    return () => { animation.current?.dispose(); animation.current = null; actor.skins.forEach(s => s.dispose()); actor.materials.forEach(m => m.dispose()) }
  }, [actor, gltf.animations])
  useFrame((_, delta) => {
    if (contact.current) contact.current.visible = motionRef.current.grounded
    if (!animation.current) return
    motionRef.current.pose = animation.current.update(Math.min(delta, .05), motionRef.current, commandRef.current)
    motionRef.current.movementBlocked = animation.current.movementBlocked
    commandRef.current = null
  })
  return <>
    <mesh ref={contact} rotation={[-Math.PI / 2, 0, 0]} position={[0, .004, 0]}>
      <planeGeometry args={[.46, .7]} />
      <meshBasicMaterial color="black" alphaMap={contactMap} transparent opacity={.18} depthWrite={false} />
    </mesh>
    <group scale={SNOWDROP_SCALE} position={[.075 * SNOWDROP_SCALE, 0, -.14 * SNOWDROP_SCALE]}><primitive object={actor.model} dispose={null} /></group>
  </>
}

export function SnowdropCat({ moving, motionRef, commandRef, onError }: {
  moving: RefObject<boolean>; motionRef: RefObject<PlayerStatus>; commandRef: RefObject<CatCommand>; onError: () => void
}) {
  const fallback = <Cat movingRef={moving} />
  return <ModelBoundary fallback={fallback} onError={onError}><Suspense fallback={fallback}><Model motionRef={motionRef} commandRef={commandRef} /></Suspense></ModelBoundary>
}
