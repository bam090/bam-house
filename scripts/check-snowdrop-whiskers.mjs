import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'

function unpack(bytes) {
  const n = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + n)), bin = bytes.subarray(28 + n)
  const attribute = index => {
    const a = json.accessors[index], view = json.bufferViews[a.bufferView]
    const Type = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType]
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type]
    const offset = bin.byteOffset + (view.byteOffset || 0) + (a.byteOffset || 0)
    return new T.BufferAttribute(new Type(bin.buffer.slice(offset, offset + a.count * size * Type.BYTES_PER_ELEMENT)), size)
  }
  return { json, bin, attribute }
}
const folder = new URL('../public/models/characters/snowdrop/', import.meta.url)
const patchOnly = process.argv[2] === '--patch-only'
const work = unpack(await fs.readFile(patchOnly ? process.argv[3] : new URL('snowdrop-volume.glb', folder)))
const report = JSON.parse(await fs.readFile(patchOnly ? process.argv[4] : new URL('snowdrop-volume-build.json', folder)))
const { sourceCount, whiskers } = report.whiskerCleanup
const primitive = work.json.meshes[0].primitives[0]
const p = work.attribute(primitive.attributes.POSITION), normal = work.attribute(primitive.attributes.NORMAL)
const indices = work.attribute(primitive.indices), skin = work.attribute(primitive.attributes.JOINTS_0), weights = work.attribute(primitive.attributes.WEIGHTS_0)
const source = unpack(await fs.readFile(new URL('snowdrop-source.glb', folder)))
const sourceIndexCount = source.json.accessors[source.json.meshes[0].primitives[0].indices].count
const capStart = sourceIndexCount - report.whiskerCleanup.removedTriangles * 3
const capEnd = report.whiskerCleanup.capIndexEnd ?? capStart + report.whiskerCleanup.caps.reduce((sum, n) => sum + n, 0) * 3
const uv = work.attribute(primitive.attributes.TEXCOORD_0)
let maxPatchUVSpan = 0
for (let i = capStart; i < capEnd; i += 3) for (let k = 0; k < 3; k++) {
  const a = indices.getX(i + k), b = indices.getX(i + (k + 1) % 3)
  maxPatchUVSpan = Math.max(maxPatchUVSpan, Math.hypot(uv.getX(a) - uv.getX(b), uv.getY(a) - uv.getY(b)))
}
assert(maxPatchUVSpan < .02, `메운 입가가 다른 텍스처 무늬를 가로지릅니다: UV 간격 ${maxPatchUVSpan}`)
console.log(`PASS: 입가 텍스처 연결, 최대 UV 간격 ${maxPatchUVSpan}`)
if (patchOnly) process.exit(0)
assert.equal(whiskers.length, 8)
assert.equal(p.count, report.vertices)
for (const attribute of [p, normal, weights]) assert(attribute.array.every(Number.isFinite), '비정상 수염 속성')
const tubeVertices = new Set(whiskers.flatMap(w => Array.from({ length: w.count }, (_, i) => w.first + i)))
const bodyIndices = []
for (let i = 0; i < indices.count; i += 3) if (!tubeVertices.has(indices.getX(i))) bodyIndices.push(indices.getX(i), indices.getX(i + 1), indices.getX(i + 2))
const body = new T.BufferGeometry().setAttribute('position', p).setIndex(bodyIndices), bvh = new MeshBVH(body)
const head = work.json.skins[0].joints.findIndex(j => work.json.nodes[j].name === 'Head')
const morphPositions = primitive.targets.map(morph => work.attribute(morph.POSITION))
for (const w of whiskers) {
  const root = new T.Vector3()
  for (let i = 0; i < 8; i++) root.add(new T.Vector3().fromBufferAttribute(p, w.first + i))
  root.divideScalar(8)
  assert.equal(bvh.raycast(new T.Ray(root, new T.Vector3(0, 0, 1)), T.DoubleSide).length % 2, 1, `수염 ${w.side}/${w.row} 뿌리가 얼굴 밖에 떠 있습니다.`)
  for (let i = w.first; i < w.first + w.count; i++) {
    assert.equal(skin.getX(i), head); assert.equal(weights.getX(i), 1)
    for (const morph of morphPositions) assert.equal(morph.array.slice(i * 3, i * 3 + 3).some(v => v !== 0), false)
  }
}
const edges = new Map(), weld = new Map(), vertexIds = []
for (let i = 0; i < p.count; i++) {
  const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(',')
  if (!weld.has(key)) weld.set(key, weld.size)
  vertexIds.push(weld.get(key))
}
for (let i = 0; i < indices.count; i += 3) for (let k = 0; k < 3; k++) {
  const a = vertexIds[indices.getX(i + k)], b = vertexIds[indices.getX(i + (k + 1) % 3)]
  if (a === b) continue
  const key = [Math.min(a, b), Math.max(a, b)].join(','); edges.set(key, (edges.get(key) || 0) + 1)
}
assert.equal([...edges.values()].filter(n => n === 1).length, 0, '수염을 정리한 메시 표면에 열린 경계가 있습니다.')
if (process.argv[2]) {
  const before = unpack(await fs.readFile(process.argv[2])), old = before.json.meshes[0].primitives[0], oldP = before.attribute(old.attributes.POSITION)
  assert.equal(oldP.count, sourceCount)
  let changed = 0
  for (let i = 0; i < sourceCount; i++) {
    if ([0, 1, 2].some(k => oldP.array[i * 3 + k] !== p.array[i * 3 + k])) {
      changed++
      assert(oldP.getY(i) > .645 && oldP.getY(i) < .742 && Math.abs(oldP.getX(i) + .063) > .018 && Math.abs(oldP.getX(i) + .063) < .100 && oldP.getZ(i) > .535, `입가 밖의 표면이 바뀌었습니다: ${i}`)
    }
  }
  for (const key of ['JOINTS_0', 'WEIGHTS_0']) assert.deepEqual(work.attribute(primitive.attributes[key]).array.slice(0, sourceCount * 4), before.attribute(old.attributes[key]).array)
  for (let i = 0; i < old.targets.length; i++) for (const key of ['POSITION', 'NORMAL']) assert.deepEqual(work.attribute(primitive.targets[i][key]).array.slice(0, sourceCount * 3), before.attribute(old.targets[i][key]).array)
  for (let i = 0; i < before.json.animations.length; i++) for (let j = 0; j < before.json.animations[i].samplers.length; j++) for (const key of ['input', 'output']) assert.deepEqual(work.attribute(work.json.animations[i].samplers[j][key]).array, before.attribute(before.json.animations[i].samplers[j][key]).array)
  console.log(`PASS: 수염 뿌리 ${changed}개 정점만 수정, 기존 가중치·모프·5개 동작 데이터 보존`)
}
const preserve = process.argv.indexOf('--preserve-whiskers')
if (preserve !== -1) {
  const before = unpack(await fs.readFile(process.argv[preserve + 1])), previous = JSON.parse(await fs.readFile(process.argv[preserve + 2]))
  const old = before.json.meshes[0].primitives[0]
  for (let n = 0; n < whiskers.length; n++) for (const key of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
    const a = work.attribute(primitive.attributes[key]), b = before.attribute(old.attributes[key]), first = whiskers[n].first, last = previous.whiskerCleanup.whiskers[n].first
    assert.equal(whiskers[n].count, previous.whiskerCleanup.whiskers[n].count)
    for (let i = 0; i < whiskers[n].count * a.itemSize; i++) assert(Math.abs(a.array[first * a.itemSize + i] - b.array[last * b.itemSize + i]) < 1e-6, '승인된 수염 모양이 변경됐습니다.')
  }
  console.log('PASS: 기존 수염 8개의 모양·길이·굵기 보존')
}
console.log('PASS: 수염 8개, 얼굴 안에 묻힌 뿌리, 머리 연결, 열린 경계 없음')
