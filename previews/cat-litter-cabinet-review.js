import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const stage = document.querySelector('#stage')
const panes = [...stage.querySelectorAll('.view')]
const status = document.querySelector('#status')
const detail = document.querySelector('#detail')
const angles = { front: [0, 0], angle: [-.54, .33], side: [-Math.PI / 2, .12] }
const files = ['Meshy_AI_Arched_Fluted_Oak_Cab_1116014353_texture.glb', 'cat-litter-cabinet-oak-refined.glb']
let angle = 'angle'

try {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.domElement.setAttribute('aria-hidden', 'true')
  stage.append(renderer.domElement)

  const scene = new THREE.Scene()
  const room = new RoomEnvironment()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(room, 0.04).texture
  scene.environmentIntensity = .54
  room.dispose()
  pmrem.dispose()

  const key = new THREE.DirectionalLight('#fff2e3', 2.25)
  key.position.set(-3.8, 3.5, 2)
  scene.add(key)
  const fill = new THREE.DirectionalLight('#e9efff', .42)
  fill.position.set(3, 1.5, -2)
  scene.add(fill)

  const subject = new THREE.Group()
  scene.add(subject)
  const camera = new THREE.OrthographicCamera()
  const models = [null, null]

  function render() {
    const stageBox = stage.getBoundingClientRect()
    const width = Math.round(stageBox.width), height = Math.round(stageBox.height)
    renderer.setSize(width, height, false)
    renderer.setScissorTest(false)
    renderer.setClearColor(0, 0)
    renderer.clear()
    renderer.setScissorTest(true)
    const [yaw, pitch] = angles[angle]
    const close = detail.getAttribute('aria-pressed') === 'true'
    const target = close
      ? angle === 'side' ? new THREE.Vector3(-.74, .015, 0) : new THREE.Vector3(-.42, .06, .23)
      : new THREE.Vector3(0, .015, 0)
    camera.position.setFromSphericalCoords(4, Math.PI / 2 - pitch, yaw).add(target)
    camera.lookAt(target)
    for (const [i, pane] of panes.entries()) {
      const box = pane.getBoundingClientRect()
      const x = Math.round(box.left - stageBox.left), y = Math.round(stageBox.bottom - box.bottom)
      const w = Math.round(box.width), h = Math.round(box.height)
      const aspect = w / h
      const span = close ? Math.max(.67, 1.11 / aspect) : Math.max(1.36, 2.21 / aspect)
      camera.top = span / 2
      camera.bottom = -camera.top
      camera.right = camera.top * aspect
      camera.left = -camera.right
      camera.near = .1
      camera.far = 12
      camera.updateProjectionMatrix()
      renderer.setViewport(x, y, w, h)
      renderer.setScissor(x, y, w, h)
      subject.clear()
      if (models[i]) subject.add(models[i])
      renderer.render(scene, camera)
    }
  }

  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => {
      document.querySelector('[data-view][aria-pressed="true"]').setAttribute('aria-pressed', 'false')
      button.setAttribute('aria-pressed', 'true')
      angle = button.dataset.view
      render()
    })
  }
  detail.addEventListener('click', () => {
    detail.setAttribute('aria-pressed', String(detail.getAttribute('aria-pressed') === 'false'))
    render()
  })
  new ResizeObserver(render).observe(stage)
  const loader = new GLTFLoader()
  const loaded = await Promise.allSettled(files.map(async (file, i) => {
    const { scene: model } = await loader.loadAsync(`/models/bathroom/cat-litter-cabinet/${file}`)
    models[i] = model
    render()
  }))
  const failed = loaded.flatMap((result, i) => result.status === 'rejected' ? [i ? '수정본' : '원본'] : [])
  status.textContent = failed.length ? `${failed.join('과 ')}을 불러오지 못했습니다.` : '두 모델에 같은 조명과 카메라를 적용했습니다.'
} catch (error) {
  status.textContent = '3D 미리보기를 열 수 없습니다. 브라우저의 WebGL 설정을 확인해 주세요.'
  console.error(error)
}
