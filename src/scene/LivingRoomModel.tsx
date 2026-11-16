import { Suspense, useMemo } from 'react'
import type { ComponentProps } from 'react'
import { useLoader } from '@react-three/fiber'
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

function Model({ file, x, y = 0, z, turn = 0, width = Infinity, maxDepth = Infinity, height = Infinity, ivory = false, originalMaterial = false, pitch = 0, castShadow = true }: {
  file: string
  x: number
  y?: number
  z: number
  turn?: number
  width?: number
  maxDepth?: number
  height?: number
  ivory?: boolean
  originalMaterial?: boolean
  pitch?: number
  castShadow?: boolean
}) {
  const { scene } = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/${file}`)
  const model = useMemo(() => {
    const furniture = new Group()
    const model = scene.clone()
    model.rotation.x = pitch
    furniture.add(model)
    const bounds = new Box3().setFromObject(furniture)
    const size = bounds.getSize(new Vector3())
    const scale = Math.min(width / size.x, maxDepth / size.z, height / size.y)
    const offset = bounds.getCenter(new Vector3())
    offset.y = bounds.min.y
    furniture.position.copy(offset.multiplyScalar(-scale))
    furniture.scale.setScalar(scale)
    furniture.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = castShadow
        object.receiveShadow = true
        if (!originalMaterial && object.material instanceof MeshStandardMaterial) {
          const material = object.material.clone()
          material.metalness = 0
          // 라운지 소파의 노란 기를 줄이고 GLB에 들어 있는 부클레 결을 살린다.
          if (ivory) material.color.setRGB(0.94, 0.98, 1.24)
          object.material = material
        }
      }
    })
    return furniture
  }, [scene, width, maxDepth, height, ivory, originalMaterial, pitch, castShadow])

  return (
    <group position={[x, y, z]} rotation={[0, turn, 0]}>
      <primitive object={model} />
    </group>
  )
}

export function LivingRoomModel(props: ComponentProps<typeof Model>) {
  return <Suspense fallback={null}><Model {...props} /></Suspense>
}
