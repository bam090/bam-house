import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
const $ = s => document.querySelector(s)
const views = []
let playing = true, time = 0, floorTime = 0, mixer, action, model, gait, rig
const state = { ready: false, verification: null }
window.skaterReview = state
function makeView(selector) {
  const host = $(selector), renderer = new T.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap
  host.append(renderer.domElement)
  const scene = new T.Scene(); scene.background = new T.Color('#d9d5cc')
  const hemi = new T.HemisphereLight('#e6efff', '#8c8174', 1.35); scene.add(hemi)
  scene.add(new T.AmbientLight('#fffdf9', .35))
  const key = new T.DirectionalLight('#fff4e3', 2.6); key.position.set(2, 3, 2); key.castShadow = true
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, top: 1.3, bottom: -1.3, near: .1, far: 8 }); key.shadow.bias = -.00015; key.shadow.normalBias = .002; scene.add(key)
  const fill = new T.DirectionalLight('#d8e8ff', .8); fill.position.set(-2, 1.3, -1.5); scene.add(fill)
  const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: '#c5bfb2', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.001; floor.receiveShadow = true; scene.add(floor)
  const grid = new T.GridHelper(20, 200, '#a9aaa0', '#b4b5aa'); grid.position.y = -.0005; scene.add(grid)
  const camera = new T.PerspectiveCamera(32, 1, .01, 220); camera.position.set(1.8, .9, 1.7)
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, .46, 0); controls.enablePan = false; controls.minDistance = .5; controls.maxDistance = 5; controls.maxPolarAngle = Math.PI * .49; controls.update()
  const resize = () => { renderer.setSize(host.clientWidth, host.clientHeight, false); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix() }
  new ResizeObserver(resize).observe(host); resize()
  return { renderer, scene, camera, controls, key, fill, hemi, grid }
}
for (const selector of ['#original', '#working']) views.push(makeView(selector))
let syncing = false
views.forEach((v, i) => v.controls.addEventListener('change', () => {
  if (syncing) return
  syncing = true; const other = views[1 - i]; other.camera.position.copy(v.camera.position); other.controls.target.copy(v.controls.target); other.controls.update(); syncing = false
}))
function setView(position, target = [0, .46, 0]) { views[0].camera.position.set(...position); views[0].controls.target.set(...target); views[0].controls.update() }
$('#side').onclick = () => setView([2.5, .53, 0])
$('#front').onclick = () => setView([0, .58, 2.55])
$('#angle').onclick = () => setView([1.8, .9, 1.7])
$('#close').onclick = () => setView([.65, .7, 1.12], [0, .61, .33])
$('#lighting').onchange = () => views.forEach(v => { const shade = $('#lighting').value === 'shade'; v.key.intensity = shade ? .35 : 2.6; v.hemi.intensity = shade ? .85 : 1.35; v.fill.intensity = shade ? .5 : .8; v.scene.background.set(shade ? '#777e80' : '#d9d5cc') })
function pause() { playing = false; $('#play').textContent = '걷기 재생'; $('#play').setAttribute('aria-pressed', 'false') }
function sample(seconds) { action.time = seconds; mixer.update(0); model.updateMatrixWorld(true); model.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update() }) }
function seek(phase) { if (!gait) return; pause(); time = phase * gait.duration; floorTime = time; sample(time); updateUI() }
$('#play').onclick = () => { playing = !playing; $('#play').textContent = playing ? '걷기 정지' : '걷기 재생'; $('#play').setAttribute('aria-pressed', String(playing)) }
$('#phase').oninput = e => seek(Number(e.target.value) / 1000)
$('#start').onclick = () => seek(0)
$('#end').onclick = () => seek(1)
$('#step').onclick = () => { if (gait) seek(((time + 1 / 60) % gait.duration) / gait.duration) }
$('#fur').onchange = () => { if (model) { const material = model.getObjectByName('Original_mesh_weighted').material; material.sheen = $('#fur').checked ? .8 : 0; material.needsUpdate = true } }
$('#rig').onchange = () => { if (rig) rig.visible = $('#rig').checked }
function updateUI() {
  const phase = time / gait.duration
  $('#phase').value = Math.round(phase * 1000); $('#phase-value').value = `${(phase * 100).toFixed(1)}%`
  gait.legs.forEach((leg, i) => { const contact = ((phase + leg.phase) % 1) < gait.stance; $('#contacts').children[i].dataset.contact = contact; $('#contacts').children[i].textContent = `${['오른 앞발', '오른 뒷발', '왼 앞발', '왼 뒷발'][i]} ${contact ? '접지' : '들기'}` })
}
function verify() {
  if (!gait) return
  const saved = time, body = model.getObjectByName('Original_mesh_weighted'), p = body.geometry.attributes.position
  const sole = gait.legs.map(l => { const ids = []; for (let i = 0; i < p.count; i++) if (p.getY(i) < .018 && Math.sign(p.getX(i)) === Math.sign(l.rest[0]) && (p.getZ(i) > 0) === (l.rest[2] > 0)) ids.push(i); return ids })
  const point = new T.Vector3(), prev = [], first = [], last = []
  let minY = Infinity, maxContactError = 0, maxSlip = 0, maxSeam = 0
  const frames = 997, dt = gait.duration / frames
  for (let f = 0; f <= frames; f++) {
    const phase = f / frames; sample(phase * gait.duration)
    gait.legs.forEach((leg, l) => {
      const t = (phase + leg.phase) % 1, contact = t < gait.stance
      const foot = model.getObjectByName(leg.name).getWorldPosition(new T.Vector3())
      if (contact) maxContactError = Math.max(maxContactError, Math.abs(foot.y - leg.rest[1]))
      if (f > 0 && contact && prev[l].contact && t > prev[l].t) maxSlip = Math.max(maxSlip, Math.abs((foot.z - prev[l].z) / dt + gait.speed))
      prev[l] = { z: foot.z, contact, t }
      for (const i of sole[l]) { point.fromBufferAttribute(p, i); body.applyBoneTransform(i, point); minY = Math.min(minY, point.y) }
    })
    if (f === 0 || f === frames) for (let i = 0; i < p.count; i++) { point.fromBufferAttribute(p, i); body.applyBoneTransform(i, point); (f === 0 ? first : last).push(point.clone()) }
  }
  first.forEach((p, i) => { maxSeam = Math.max(maxSeam, p.distanceTo(last[i])) })
  const result = { contactHeightError: maxContactError, soleMinY: minY, stanceSpeedError: maxSlip, seamPositionError: maxSeam, sampledFrames: frames + 1, soleVertices: sole.map(a => a.length) }
  result.passed = maxContactError < .0005 && minY > -.0005 && maxSlip < .006 && maxSeam < .00001
  state.verification = result
  $('#diagnostics').textContent = `${result.passed ? '통과' : '점검 필요'} · ${frames + 1}개 시점 / 실제 스킨 변형 검사\n접지 높이 오차 ${(maxContactError * 1000).toFixed(3)} mm · 발바닥 최저 ${(minY * 1000).toFixed(3)} mm\n접지 속도 오차 ${(maxSlip * 1000).toFixed(2)} mm/s\n루프 시작·끝 메시 차이 ${(maxSeam * 1000).toFixed(4)} mm`
  sample(saved)
}
$('#verify').onclick = verify
try {
  const loader = new GLTFLoader(), [source, work] = await Promise.all([loader.loadAsync('/models/characters/skater-cat/cat.glb'), loader.loadAsync('/models/characters/skater-cat/cat-angora-walk.glb')])
  const box = new T.Box3().setFromObject(source.scene), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3())
  const normalized = new T.Group(); normalized.add(source.scene); normalized.scale.setScalar(1 / size.y); normalized.position.set(-center.x / size.y, -box.min.y / size.y, -center.z / size.y); views[0].scene.add(normalized)
  model = work.scene; views[1].scene.add(model)
  model.traverse(o => { if (o.userData.gait) gait = o.userData.gait; if (o.isMesh) { o.castShadow = o.name === 'Original_mesh_weighted'; o.receiveShadow = o.name === 'Original_mesh_weighted'; o.frustumCulled = false } })
  source.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  mixer = new T.AnimationMixer(model); action = mixer.clipAction(work.animations[0]); action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play()
  rig = new T.SkeletonHelper(model); rig.visible = false; rig.material.depthTest = false; rig.renderOrder = 5; views[1].scene.add(rig)
  $('#contacts').replaceChildren(...gait.legs.map(() => document.createElement('span')))
  verify(); state.ready = true; $('#play').disabled = false; $('#status').textContent = '원본·작업본 로드 완료 · 25개 뼈 · 걷기 1개 · 1.36초'
} catch (error) { $('#status').textContent = `불러오기 실패: ${error.message}`; console.error(error) }
let last = performance.now()
function render(now) {
  const dt = T.MathUtils.clamp((now - last) / 1000, 0, .05); last = now
  if (gait) {
    if (playing) { const delta = dt * Number($('#speed').value); time = (time + delta) % gait.duration; floorTime += delta }
    sample(time); updateUI()
    views[1].grid.position.z = $('#treadmill').checked ? -(floorTime * gait.speed) % .1 : 0
  }
  views.forEach(v => v.renderer.render(v.scene, v.camera))
  requestAnimationFrame(render)
}
requestAnimationFrame(render)
