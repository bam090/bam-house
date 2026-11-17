import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { enableDualQuaternionSkinning } from '../src/scene/dual-quaternion.ts'
import { createCatAnimator, SNOWDROP_MODEL_FILE } from '../src/scene/cat-motion.ts'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
const references=import.meta.glob('../docs/cat-reference/white-turkish-angora-*.png',{eager:true,query:'?url',import:'default'})
const $ = s => document.querySelector(s)
const views = []
let loaded = false, playing = false, time = 0, clipName = 'rest', duration = 1
let walkSpeed = 0
let transition='clip', runtime=null, runtimeTime=0
const transitions={sit:['서기 → 앉기',null,'sit'],lie:['앉기 → 눕기','sit','lie'],sitBack:['눕기 → 앉기','lie','sit'],stand:['앉기 → 서기','sit','sit'],walk:['눕기 → 걷기','lie','walk']}
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
  return { renderer, scene, camera, controls, key, hemi, fill, grid }
}
views.push(view('#source'), view('#work'))
let syncing = false
views.forEach((v, i) => v.controls.addEventListener('change', () => {
  if (syncing) return
  syncing = true; const other = views[1 - i]; other.camera.position.copy(v.camera.position); other.controls.target.copy(v.controls.target); other.controls.update(); syncing = false
}))
function camera(position, target = [0, .45, 0]) { views[0].camera.position.set(...position); views[0].controls.target.set(...target); views[0].controls.update() }
$('#front').onclick = () => camera(clipName==='Jump' ? [0,.85,3.3] : [0,.6,2.6], [0,clipName==='Jump' ? .68 : .45,0])
$('#side').onclick = () => camera(clipName==='Jump' ? [3.3,.85,0] : [2.6,.55,0], [0,clipName==='Jump' ? .68 : .45,0])
$('#angle').onclick = () => camera(clipName==='Jump' ? [2.2,1.15,2.3] : [1.7,.9,1.8], [0,clipName==='Jump' ? .68 : .45,0])
$('#top').onclick = () => camera([0,3.1,.001], [0,.3,0])
$('#close').onclick = () => camera([.44, .86, 1.35], [-.075, .77, .43])
$('#face-front').onclick = () => camera([-.075, .78, 1.5], [-.075, .77, .43])
$('#rear').onclick = () => camera([-.075,.85,-2.3],[-.075,.42,-.12])
$('#rear-angle').onclick = () => camera([1.5,1.3,-1.7],[-.075,.42,-.12])
$('#legs-close').onclick = () => camera([1.55,.32,.10],[-.075,.20,-.12])
$('#legs-other').onclick = () => camera([-1.70,.32,.10],[-.075,.20,-.12])
$('#light').onchange = () => views.forEach(v => { const shade = $('#light').value === 'shade'; v.key.intensity = shade ? .35 : 2.6; v.hemi.intensity = shade ? .85 : 1.35; v.fill.intensity = shade ? .5 : .8; v.scene.background.set(shade ? '#777e80' : '#d9d5cc') })
function resetRuntime(){
  runtime?.dispose();const v=views[1];v.mixer.stopAllAction()
  for(const [o,p,q,s]of v.rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s)}
  runtime=createCatAnimator(v.model,v.clips,walkSpeed);runtimeTime=0
  const start=transitions[transition][1]
  for(let frame=0;frame<120;frame++)runtime.update(1/60,{speed:0,grounded:true,verticalSpeed:0},frame===0?start:null)
}
function sample(t) {
  if(transition!=='clip'){
    if(!runtime||t<runtimeTime-1e-6)resetRuntime()
    const target=transitions[transition][2]
    while(runtimeTime<t-1e-6){const dt=Math.min(1/60,t-runtimeTime);runtime.update(dt,{speed:target==='walk'?3:0,grounded:true,verticalSpeed:0},runtimeTime===0&&target!=='walk'?target:null);runtimeTime+=dt}
    return
  }
  for (const v of views) if (v.action) { v.action.time = t; v.mixer.update(0); v.model.updateMatrixWorld(true); v.model.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update() }) }
}
function pause() { playing = false; $('#play').textContent = '재생' }
function seek(p) { if (!loaded || clipName === 'rest') return; pause(); time = p * duration; sample(time); update() }
$('#phase').oninput = e => seek(Number(e.target.value) / 1000)
$('#start').onclick = () => seek(0)
$('#end').onclick = () => seek(1)
$('#play').onclick = () => { if(time>=duration)time=0; playing = !playing; $('#play').textContent = playing ? '정지' : '재생' }
function update() { $('#phase').value = Math.round(time / duration * 1000); $('#percent').value = `${(time / duration * 100).toFixed(1)}%` }
function selectMotion() {
  if (!loaded) return
  runtime?.dispose();runtime=null;transition='clip';$('#transition').value='clip'
  clipName = $('#motion').value; time = 0; pause()
  if(clipName==='Jump')camera([2.2,1.15,2.3],[0,.68,0])
  for (const v of views) {
    v.mixer.stopAllAction(); v.action = null
    for (const [o, p, q, s] of v.rest) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s) }
    if (clipName !== 'rest') { const clip = v.clips.find(c => c.name === clipName); if(!clip)continue; duration = clip.duration; v.action = v.mixer.clipAction(clip); v.action.setLoop(T.LoopOnce, 1); v.action.clampWhenFinished = true; v.action.play() }
    v.model.updateMatrixWorld(true)
  }
  $('#phase').disabled = $('#play').disabled = clipName === 'rest'
  if (clipName === 'rest') { duration = 1; $('#metrics').textContent = '기본 자세 · 외형과 텍스처 비교' }
  else { $('#metrics').textContent = `${{Walk:'걷기',Sit:'앉기',Lie:'눕기',Jump:'제자리 점프',EarFlick:'귀 털기'}[clipName]} · ${duration.toFixed(3)}초\n${clipName==='Walk'?`1배속 바닥 이동 속도 ${walkSpeed.toFixed(3)} 모델 단위/초`:['Sit','Lie'].includes(clipName)?'한 번 재생 후 자세 유지':'한 번 재생 후 기본 자세로 복귀'}`; playing = true; $('#play').textContent = '정지'; sample(0) }
  const reference={Sit:'sitting',Lie:'lying'}[clipName]
  $('#pose-reference').hidden=!reference
  if(reference){
    for(const angle of ['front','side','top'])$(`#ref-${angle}`).src=references[`../docs/cat-reference/white-turkish-angora-${reference}-${angle}.png`]
    time=duration;pause();sample(time)
  }
  update()
}
$('#motion').onchange = selectMotion
$('#transition').onchange=()=>{
  if(!loaded)return
  transition=$('#transition').value
  if(transition==='clip'){selectMotion();return}
  clipName='transition';duration=2;time=0;pause();resetRuntime();sample(0);update()
  $('#phase').disabled=$('#play').disabled=false;$('#pose-reference').hidden=true
  $('#metrics').textContent=`${transitions[transition][0]} · 실제 씬과 같은 자세 전환\n슬라이더로 중간 프레임을 멈춰 확인할 수 있습니다.`
}
window.addEventListener('keydown',e=>{if(e.repeat||e.target.closest?.('input,select,textarea,[contenteditable=true]'))return;const value={KeyX:'Sit',KeyC:'Lie'}[e.code];if(value){$('#motion').value=value;selectMotion();e.preventDefault()}})
try {
  const loader = new GLTFLoader(), files = ['snowdrop-source.glb',new URLSearchParams(location.search).get('rig')==='previous'?'snowdrop-player.glb':SNOWDROP_MODEL_FILE]
  const models = await Promise.all(files.map(f => loader.loadAsync(`/models/characters/snowdrop/${f}`)))
  models.forEach((gltf, i) => {
    const box = new T.Box3().setFromObject(gltf.scene), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3()); const v = views[i], group = new T.Group(); group.scale.setScalar(1 / size.y); group.position.set(-center.x / size.y, -box.min.y / size.y, -center.z / size.y)
    group.add(gltf.scene); v.scene.add(group); v.model = gltf.scene; v.clips = gltf.animations; v.mixer = new T.AnimationMixer(v.model); v.rest = []
    v.model.traverse(o => { v.rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if(o.isSkinnedMesh&&v.model.getObjectByName('Snowdrop')?.userData.skinning==='dualQuaternion')enableDualQuaternionSkinning(o) } })
  })
  views[1].helper=new T.SkeletonHelper(views[1].model);views[1].helper.visible=false;views[1].scene.add(views[1].helper)
  document.querySelector('a[href$="snowdrop-interactions.glb"]').href=`/models/characters/snowdrop/${files[1]}`
  document.querySelector('a[href$="snowdrop-interactions.blend"]').href='/models/characters/snowdrop/snowdrop-volume.blend'
  $('#work').previousElementSibling.firstChild.textContent=files[1]===SNOWDROP_MODEL_FILE?'02 · Snowdrop 표면 수정본':'02 · 수정 전 Snowdrop'
  if(files[1]!==SNOWDROP_MODEL_FILE)document.querySelector('a[href$="snowdrop-volume.blend"]').hidden=true
  walkSpeed = views[1].model.getObjectByName('Snowdrop').userData.gait.speed
  loaded = true; selectMotion(); $('#status').textContent = '원본·작업본과 5개 동작 로드 완료'
} catch (error) { $('#status').textContent = `불러오기 실패: ${error.message}`; console.error(error) }
$('#skeleton').onchange=()=>{if(views[1].helper)views[1].helper.visible=$('#skeleton').checked}
let last = performance.now(), groundDistance=0
function render(now) {
  const dt = T.MathUtils.clamp((now - last) / 1000, 0, .05); last = now
  if (loaded && clipName !== 'rest') { if (playing) { const step=dt*Number($('#speed').value);time+=step;if(clipName==='Walk'){time%=duration;groundDistance+=step*walkSpeed}else if(time>=duration){time=duration;pause()} } sample(time); update() }
  views[1].grid.position.z=clipName==='Walk'&&$('#ground').checked ? -(groundDistance%.1) : 0
  views.forEach(v => v.renderer.render(v.scene, v.camera)); requestAnimationFrame(render)
}
requestAnimationFrame(render)
