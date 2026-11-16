import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
const $ = s => document.querySelector(s)
const views = []
let loaded = false, playing = false, time = 0, clipName = 'rest', duration = 1
function view(selector) {
  const host = $(selector), renderer = new T.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap; host.append(renderer.domElement)
  const scene = new T.Scene(); scene.background = new T.Color('#d9d5cc')
  const hemi = new T.HemisphereLight('#e6efff', '#8c8174', 1.35); scene.add(hemi, new T.AmbientLight('#fffdf9', .35))
  const key = new T.DirectionalLight('#fff4e3', 2.6); key.position.set(2, 3, 2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: .1, far: 8 }); key.shadow.bias = -.00015; key.shadow.normalBias = .002; scene.add(key)
  const fill = new T.DirectionalLight('#d8e8ff', .8); fill.position.set(-2, 1.3, -1.5); scene.add(fill)
  const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: '#c5bfb2', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.002; floor.receiveShadow = true; scene.add(floor)
  const grid = new T.GridHelper(10, 100, '#a9aaa0', '#b4b5aa'); grid.position.y = -.001; scene.add(grid)
  const camera = new T.PerspectiveCamera(32, 1, .01, 120); camera.position.set(1.7, .9, 1.8)
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, .45, 0); controls.enablePan = false; controls.enableZoom = false; controls.update()
  new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight, false); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix() }).observe(host)
  return { renderer, scene, camera, controls, key, hemi, fill }
}
views.push(view('#source'), view('#work'))
let syncing = false
views.forEach((v, i) => v.controls.addEventListener('change', () => {
  if (syncing) return
  syncing = true; const other = views[1 - i]; other.camera.position.copy(v.camera.position); other.controls.target.copy(v.controls.target); other.controls.update(); syncing = false
}))
function camera(position, target = [0, .45, 0]) { views[0].camera.position.set(...position); views[0].controls.target.set(...target); views[0].controls.update() }
$('#front').onclick = () => camera([0, .6, 2.6])
$('#side').onclick = () => camera([2.6, .55, 0])
$('#angle').onclick = () => camera([1.7, .9, 1.8])
$('#close').onclick = () => camera([.54, .73, 1.15], [0, .64, .35])
$('#face-front').onclick = () => camera([0, .66, 1.28], [0, .64, .35])
$('#light').onchange = () => views.forEach(v => { const shade = $('#light').value === 'shade'; v.key.intensity = shade ? .35 : 2.6; v.hemi.intensity = shade ? .85 : 1.35; v.fill.intensity = shade ? .5 : .8; v.scene.background.set(shade ? '#777e80' : '#d9d5cc') })
function sample(t) { for (const v of views) if (v.action) { v.action.time = t; v.mixer.update(0); v.model.updateMatrixWorld(true); v.model.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update() }) } }
function pause() { playing = false; $('#play').textContent = '재생' }
function seek(p) { if (!loaded || clipName === 'rest') return; pause(); time = p * duration; sample(time); update() }
$('#phase').oninput = e => seek(Number(e.target.value) / 1000)
$('#start').onclick = () => seek(0)
$('#end').onclick = () => seek(1)
$('#play').onclick = () => { playing = !playing; $('#play').textContent = playing ? '정지' : '재생' }
function update() { $('#phase').value = Math.round(time / duration * 1000); $('#percent').value = `${(time / duration * 100).toFixed(1)}%` }
function selectMotion() {
  if (!loaded) return
  clipName = $('#motion').value; time = 0; pause()
  for (const v of views) {
    v.mixer.stopAllAction(); v.action = null
    for (const [o, p, q, s] of v.rest) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s) }
    if (clipName !== 'rest') { const clip = v.clips.find(c => c.name === clipName); duration = clip.duration; v.action = v.mixer.clipAction(clip); v.action.setLoop(T.LoopOnce, 1); v.action.clampWhenFinished = true; v.action.play() }
    v.model.updateMatrixWorld(true)
  }
  $('#phase').disabled = $('#play').disabled = clipName === 'rest'
  if (clipName === 'rest') { duration = 1; $('#metrics').textContent = '기본 자세 · 얼굴 비교\n원본 리그와 별도 저장한 얼굴 작업본' }
  else { $('#metrics').textContent = `${clipName} · ${duration.toFixed(3)}초 · 원본 동작\n꼬리의 반복 경계와 발 접지를 확인하세요.`; playing = true; $('#play').textContent = '정지'; sample(0) }
  update()
}
$('#motion').onchange = selectMotion
try {
  const loader = new GLTFLoader(), files = ['cat-source-motion.glb', 'cat-angora-reference.glb']
  const models = await Promise.all(files.map(f => loader.loadAsync(`/models/characters/skater-cat/${f}`)))
  const box = new T.Box3().setFromObject(models[0].scene), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3())
  models.forEach((gltf, i) => {
    const v = views[i], group = new T.Group(); group.scale.setScalar(1 / size.y); group.position.set(-center.x / size.y, -box.min.y / size.y, -center.z / size.y)
    group.add(gltf.scene); v.scene.add(group); v.model = gltf.scene; v.clips = gltf.animations; v.mixer = new T.AnimationMixer(v.model); v.rest = []
    v.model.traverse(o => { v.rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); if (o.isMesh) { o.castShadow = o.name === 'Cat'; o.receiveShadow = o.name === 'Cat'; o.frustumCulled = false } })
  })
  loaded = true; selectMotion(); $('#status').textContent = '두 모델과 Walk·run 클립 로드 완료'
} catch (error) { $('#status').textContent = `불러오기 실패: ${error.message}`; console.error(error) }
let last = performance.now()
function render(now) {
  const dt = T.MathUtils.clamp((now - last) / 1000, 0, .05); last = now
  if (loaded && clipName !== 'rest') { if (playing) time = (time + dt * Number($('#speed').value)) % duration; sample(time); update() }
  views.forEach(v => v.renderer.render(v.scene, v.camera)); requestAnimationFrame(render)
}
requestAnimationFrame(render)
