import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
const $=s=>document.querySelector(s)
const query=new URLSearchParams(location.search)
const volume=query.get('rig')!=='previous'
$('#view').value=['front','side'].includes(query.get('view'))?query.get('view'):'both';$('#grid').dataset.view=$('#view').value
for(const id of ['sit','lie','view','landmarks'])$(`#${id}`).disabled=true
function share(name){history.replaceState(null,'',`?pose=${name}&view=${$('#view').value}${volume?'&rig=volume':''}`)}
const refs=import.meta.glob('../docs/cat-reference/white-turkish-angora-{sitting,lying}-{front,side}.png',{eager:true,query:'?url',import:'default'})
const views=['front','side'].map(direction=>{
  const host=$(`#${direction}`),renderer=new T.WebGLRenderer({antialias:true});host.append(renderer.domElement)
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap
  const scene=new T.Scene();scene.background=new T.Color('#c6c6bf');scene.add(new T.HemisphereLight('#edf3ff','#9e9a8e',2.6))
  const key=new T.DirectionalLight('#fff8ee',1.8);key.position.set(1.5,3,2.5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.radius=5;Object.assign(key.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.1,far:8});key.shadow.bias=-.0001;key.shadow.normalBias=.002;scene.add(key)
  const fill=new T.DirectionalLight('#e0e9ff',1.3);fill.position.set(-2,2,-1);scene.add(fill)
  const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#b9b9b1',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.002;floor.receiveShadow=true;scene.add(floor)
  const camera=new T.OrthographicCamera(-1,1,1,-1,.01,100)
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h,span=Math.max(1.23,1.62/aspect);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.position.set(...(direction==='front'?[-.075,.65,4]:[4,.65,0]));camera.lookAt(-.075,.48,0);camera.updateProjectionMatrix()}
  new ResizeObserver(resize).observe(host);resize();return {direction,scene,renderer,camera,model:null,helper:null}
})
const loader=new GLTFLoader()
let models
try{models=await Promise.all(['sit','lie'].map(async name=>[name,(await loader.loadAsync(`/models/characters/snowdrop/snowdrop-${name}-${volume?'volume-':''}static.glb`)).scene]))}catch(error){$('#status').textContent=`불러오기 실패: ${error.message}`;throw error}
const poses=Object.fromEntries(models)
function markers(model){
  const group=new T.Group();let data;model.traverse(o=>{if(o.userData.landmarks)data=o.userData.landmarks})
  for(const leg of data||[]){const material=new T.MeshBasicMaterial({color:leg.front?'#327ab0':'#a74339',depthTest:false});const points=[leg.hip,leg.knee,leg.hock,leg.paw].map(p=>new T.Vector3(...p));for(const p of points){const dot=new T.Mesh(new T.SphereGeometry(.009,10,6),material);dot.position.copy(p);dot.renderOrder=2;group.add(dot)}const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:material.color,depthTest:false}));line.renderOrder=2;group.add(line)}return group
}
let currentPose=query.get('pose')==='lie'?'lie':'sit'
function select(name){
  currentPose=name;share(name)
  for(const v of views){if(v.model)v.scene.remove(v.model);if(v.helper)v.scene.remove(v.helper);v.model=poses[name].clone(true);v.model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});v.scene.add(v.model);v.helper=markers(v.model);v.helper.visible=$('#landmarks').checked;v.scene.add(v.helper);$(`#${v.direction}-ref`).src=refs[`../docs/cat-reference/white-turkish-angora-${name==='sit'?'sitting':'lying'}-${v.direction}.png`]}
  for(const pose of ['sit','lie'])$(`#${pose}`).setAttribute('aria-pressed',String(pose===name))
  $('#front-note').textContent=name==='sit'?'앞발을 나란히 두고, 뒤쪽 허벅지의 둥근 폭을 확인합니다.':'앞발이 서로 나란한지, 팔꿈치가 바깥으로 벌어지지 않는지 확인합니다.'
  $('#side-note').textContent=name==='sit'?'뒷발이 앞발 뒤로 들어오고 엉덩이가 그 뒤에 내려앉는 형태입니다.':'가슴과 배를 낮추고 앞팔을 바닥으로 뻗은 자세입니다.'
  $('#status').textContent=`${name==='sit'?'앉기':'눕기'} 정지 자세 · 정면/옆면 로드 완료`;$('#download').href=`/models/characters/snowdrop/snowdrop-${name}-${volume?'volume-':''}static.glb`
}
$('#sit').onclick=()=>select('sit');$('#lie').onclick=()=>select('lie');$('#view').onchange=()=>{$('#grid').dataset.view=$('#view').value;share(currentPose)};$('#landmarks').onchange=()=>views.forEach(v=>v.helper.visible=$('#landmarks').checked)
for(const id of ['sit','lie','view','landmarks'])$(`#${id}`).disabled=false
window.addEventListener('keydown',e=>{if(e.repeat||e.target.closest?.('input,select,textarea,[contenteditable=true]'))return;const pose={KeyX:'sit',KeyC:'lie'}[e.code];if(pose){select(pose);e.preventDefault()}})
select(currentPose);function render(){views.forEach(v=>v.renderer.render(v.scene,v.camera));requestAnimationFrame(render)}render()
