import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

// Node has Blob but the Three exporter also needs FileReader.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.() }) }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.() }) }
}
const folder = new URL('../public/models/characters/skater-cat/', import.meta.url)
const original = await fs.readFile(new URL('cat.glb', folder))
const source = await new GLTFLoader().parseAsync(original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength), '')
source.scene.updateMatrixWorld(true)
let geometry
source.scene.traverse(o => { if (o.isMesh) geometry = o.geometry.clone().applyMatrix4(o.matrixWorld) })
geometry.computeBoundingBox()
const box = geometry.boundingBox, height = box.max.y - box.min.y, center = box.getCenter(new T.Vector3())
geometry.translate(-center.x, -box.min.y, -center.z).scale(1 / height, 1 / height, 1 / height)
geometry.deleteAttribute('color'); geometry.deleteAttribute('normal'); geometry.deleteAttribute('uv')
geometry = mergeVertices(geometry, 1e-5)
geometry.computeVertexNormals()
const root = new T.Group(); root.name = 'SkaterCat_Angora'
const bones = [], rests = [], names = new Map()
const vec = a => new T.Vector3(...a)
const smooth = (a, b, x) => { const t = T.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
// Broad coat volume replaces individual fibers. Keep the input file untouched.
const coatMask = [], coatColors = []
for (let i = 0; i < geometry.attributes.position.count; i++) {
  const p = new T.Vector3().fromBufferAttribute(geometry.attributes.position, i)
  const n = new T.Vector3().fromBufferAttribute(geometry.attributes.normal, i)
  const tailT = T.MathUtils.clamp((p.y - .59) / .43, 0, 1)
  const tailVolume = Math.sin(Math.PI * tailT) ** 1.3 * (1 - smooth(-.36, -.32, p.z))
  const ruffVolume = smooth(.1, .22, p.z) * (1 - smooth(.29, .38, p.z)) * smooth(.27, .43, p.y) * (1 - smooth(.57, .66, p.y))
  const face = smooth(.29, .36, p.z) * smooth(.48, .55, p.y)
  const coatAmount = smooth(.07, .25, p.y) * (1 - face)
  const clump = .94 + .06 * Math.cos(p.x * 72 + p.y * 12) * Math.sin(p.z * 30 - p.y * 8)
  p.x += n.x * tailVolume * .045
  p.z += n.z * tailVolume * .045
  p.addScaledVector(n, (ruffVolume * .018 + coatAmount * .006) * clump)
  // Bring the lower lip toward the muzzle and soften the long projecting mouth.
  const muzzle = smooth(.38, .48, p.z) * (1 - smooth(.6, .625, p.y))
  p.z -= .012 * muzzle
  p.y += (.566 - p.y) * .35 * smooth(.36, .43, p.z) * (1 - smooth(.562, .582, p.y))
  geometry.attributes.position.setXYZ(i, p.x, p.y, p.z)
  coatMask.push(coatAmount)
  const shade = .985 + .015 * Math.sin(p.x * 41 + p.y * 24) * Math.sin(p.z * 39 - p.y * 18)
  coatColors.push(shade, shade * .996, shade * .985)
}
// Relax the source's sharp lower-lip fold without changing the eyes or nose ridge.
const adjacency = Array.from({ length: geometry.attributes.position.count }, () => new Set())
for (let i = 0; i < geometry.index.count; i += 3) for (let j = 0; j < 3; j++) {
  const a = geometry.index.getX(i + j), b = geometry.index.getX(i + (j + 1) % 3)
  adjacency[a].add(b); adjacency[b].add(a)
}
const mouthWeights = Array.from({ length: geometry.attributes.position.count }, (_, i) => {
  const p = new T.Vector3().fromBufferAttribute(geometry.attributes.position, i)
  return smooth(.37, .44, p.z) * smooth(.515, .535, p.y) * (1 - smooth(.58, .606, p.y)) * (1 - smooth(.075, .1, Math.abs(p.x)))
})
for (let pass = 0; pass < 18; pass++) {
  const p = geometry.attributes.position, next = p.array.slice()
  mouthWeights.forEach((w, i) => {
    if (w <= 0) return
    for (let k = 0; k < 3; k++) {
      let average = 0; for (const j of adjacency[i]) average += p.array[j * 3 + k]
      next[i * 3 + k] += .45 * w * (average / adjacency[i].size - p.array[i * 3 + k])
    }
  })
  p.array.set(next)
}
geometry.computeVertexNormals()
for (let i = 0; i < geometry.attributes.normal.count; i++) {
  const p = new T.Vector3().fromBufferAttribute(geometry.attributes.position, i)
  const n = new T.Vector3().fromBufferAttribute(geometry.attributes.normal, i)
  const tangent = new T.Vector3(1, .1, 0).addScaledVector(n, -n.x - .1 * n.y).normalize()
  const wave = Math.sin(p.x * 145 + p.z * 62 + Math.sin(p.y * 27)) * Math.sin(p.y * 81 - p.z * 33)
  n.addScaledVector(tangent, wave * .035 * coatMask[i]).normalize()
  geometry.attributes.normal.setXYZ(i, n.x, n.y, n.z)
}
geometry.setAttribute('color', new T.Float32BufferAttribute(coatColors, 3))
function bone(name, position, parent) {
  const b = new T.Bone(); b.name = name
  const index = bones.length; bones.push(b); rests.push(vec(position)); names.set(name, index)
  b.position.copy(rests[index]); if (parent != null) { b.position.sub(rests[parent]); bones[parent].add(b) } else root.add(b)
  return index
}
const body = bone('body', [0, .46, -.12])
const chest = bone('chest', [0, .48, .13], body)
const neck = bone('neck', [0, .55, .24], chest)
const head = bone('head', [0, .64, .35], neck)
const tail = [bone('tail_0', [0, .52, -.41], body)]
for (let i = 1; i <= 4; i++) tail.push(bone(`tail_${i}`, [0, .52 + i * .115, -.41 - .012 * i], tail[i - 1]))
const legs = []
for (const side of [-1, 1]) for (const front of [true, false]) {
  const id = `${front ? 'front' : 'hind'}_${side > 0 ? 'L' : 'R'}`
  const x = side * (front ? .075 : .084)
  const hip = [x, front ? .44 : .45, front ? .145 : -.325]
  const knee = [x, front ? .235 : .285, front ? .115 : -.285]
  const ankle = [x, front ? .055 : .135, front ? .135 : -.405]
  const paw = [x, .022, front ? .18 : -.27]
  const upper = bone(`${id}_upper`, hip, front ? chest : body)
  const lower = bone(`${id}_lower`, knee, upper)
  const end = bone(`${id}_ankle`, ankle, lower)
  const foot = bone(`${id}_paw`, paw, end)
  legs.push({ id, front, side, upper, lower, end, foot, phase: front ? (side > 0 ? .25 : .75) : (side > 0 ? 0 : .5) })
}
root.updateMatrixWorld(true)
const skeleton = new T.Skeleton(bones)
skeleton.calculateInverses()
function weights(p) {
  const w = new Map(), add = (i, v) => w.set(i, (w.get(i) || 0) + v)
  const headMix = smooth(.22, .34, p.z) * smooth(.4, .53, p.y)
  const tailMix = smooth(.54, .62, p.y) * (1 - smooth(-.32, -.27, p.z)) * (1 - smooth(.1, .15, Math.abs(p.x)))
  const leg = legs.find(l => l.front === (p.z > -.06) && l.side === (p.x >= 0 ? 1 : -1))
  const legRegion = (leg.front ? smooth(-.06, .16, p.z) : 1 - smooth(-.34, -.1, p.z)) * smooth(0, .1, Math.abs(p.x))
  const legMix = (1 - smooth(leg.front ? .29 : .26, leg.front ? .43 : .44, p.y)) * (1 - headMix) * (1 - smooth(.1, .3, p.y) * (1 - legRegion))
  const torso = (1 - legMix) * (1 - headMix) * (1 - tailMix)
  const chestMix = smooth(-.22, .17, p.z)
  add(body, torso * (1 - chestMix)); add(chest, torso * chestMix)
  add(head, headMix * (1 - tailMix))
  if (tailMix) {
    const k = T.MathUtils.clamp((p.y - .52) / .115, 0, 4), i = Math.floor(k)
    add(tail[i], tailMix * (1 - (k - i))); add(tail[Math.min(4, i + 1)], tailMix * (k - i))
  }
  if (legMix) {
    const pawMix = 1 - smooth(.035, leg.front ? .075 : .09, p.y)
    add(leg.foot, pawMix * legMix)
    const upperMix = smooth(leg.front ? .17 : .21, leg.front ? .3 : .36, p.y)
    const lowerMix = smooth(leg.front ? .04 : .09, leg.front ? .09 : .19, p.y)
    const limb = (1 - pawMix) * legMix
    add(leg.upper, upperMix * limb)
    add(leg.lower, (1 - upperMix) * lowerMix * limb)
    add(leg.end, (1 - upperMix) * (1 - lowerMix) * limb)
  }
  const best = [...w].filter(([, v]) => v > 1e-8).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const sum = best.reduce((a, [, v]) => a + v, 0)
  while (best.length < 4) best.push([0, 0])
  return { ids: best.map(([i]) => i), values: best.map(([, v]) => v / sum) }
}
function skin(g, weightPositions) {
  const ids = [], values = [], p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const w = weights(weightPositions ? vec(weightPositions[i]) : new T.Vector3().fromBufferAttribute(p, i))
    assert(Math.abs(w.values.reduce((a, b) => a + b, 0) - 1) < 1e-6)
    ids.push(...w.ids); values.push(...w.values)
  }
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(ids, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(values, 4))
}
skin(geometry)
const coat = new T.MeshPhysicalMaterial({ name: 'Soft white coat', color: '#f3f2ed', vertexColors: true, roughness: .98, sheen: .8, sheenRoughness: .85, sheenColor: new T.Color('#ffffff'), specularIntensity: .2 })
const mesh = new T.SkinnedMesh(geometry, coat); mesh.name = 'Original_mesh_weighted'; root.add(mesh); mesh.bind(skeleton)

function rigidPart(name, g, material, position, scale, quaternion) {
  g.scale(...scale); if (quaternion) g.applyQuaternion(quaternion); g.translate(...position)
  const ids = [], values = []
  for (let i = 0; i < g.attributes.position.count; i++) { ids.push(head, 0, 0, 0); values.push(1, 0, 0, 0) }
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(ids, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(values, 4))
  const o = new T.SkinnedMesh(g, material); o.name = name; root.add(o); o.bind(skeleton)
}
// Shallow surface patches follow the sockets; no stacked eyeball or nose spheres.
const rayMesh = new T.Mesh(geometry, coat); rayMesh.updateMatrixWorld(true)
function surfacePatch(center, outward, sample, rings = 12, sectors = 64) {
  const right = new T.Vector3(outward.z, 0, -outward.x).normalize()
  const up = outward.clone().cross(right).normalize(), positions = [], colors = [], indices = []
  for (let ring = 0; ring <= rings; ring++) for (let sector = 0; sector <= sectors; sector++) {
    const r = ring / rings, angle = sector / sectors * Math.PI * 2
    const { x, y, color, lift } = sample(r, angle)
    const origin = center.clone().addScaledVector(right, x).addScaledVector(up, y).addScaledVector(outward, .08)
    const hit = new T.Raycaster(origin, outward.clone().negate(), 0, .2).intersectObject(rayMesh)[0]
    assert(hit, 'Facial patch must follow the source surface')
    positions.push(...hit.point.addScaledVector(outward, lift).toArray()); colors.push(...color.toArray())
    if (ring < rings && sector < sectors) {
      const a = ring * (sectors + 1) + sector, b = a + sectors + 1
      indices.push(a, b, b + 1, a, b + 1, a + 1)
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setIndex(indices); g.computeVertexNormals()
  for (let i = 0; i < g.attributes.normal.count; i++) {
    const n = new T.Vector3().fromBufferAttribute(g.attributes.normal, i)
    if (n.lengthSq() < .5) g.attributes.normal.setXYZ(i, outward.x, outward.y, outward.z)
  }
  return g
}
for (const side of [-1, 1]) {
  const out = new T.Vector3(side * .55, .1, .83).normalize()
  const ray = new T.Raycaster(new T.Vector3(side * .042, .642, .44).addScaledVector(out, .3), out.clone().negate())
  const hit = ray.intersectObject(rayMesh)[0]; assert(hit, 'eye socket')
  const g = surfacePatch(hit.point, out, (r, angle) => {
    const x = .014 * r * Math.cos(angle), y = .0068 * r * Math.sin(angle) * (.75 + .25 * Math.abs(Math.sin(angle))) + side * x * .16
    const pupil = Math.hypot(x / .0028, (y - side * x * .16) / .0047)
    const iris = Math.hypot(x / .0095, (y - side * x * .16) / .0095)
    const color = new T.Color('#709cae').lerp(new T.Color('#becbca'), smooth(.25, .95, iris) * .45)
    color.lerp(new T.Color('#344e58'), smooth(.8, 1.04, iris) * (1 - smooth(1.04, 1.3, iris)))
    color.lerp(new T.Color('#b9c0b9'), smooth(1.04, 1.35, iris))
    color.lerp(new T.Color('#15272c'), 1 - smooth(.83, 1.1, pupil))
    color.lerp(new T.Color('#e9e9e3'), smooth(.88, 1, r))
    return { x, y, color, lift: .0003 + .0011 * (1 - r * r) }
  })
  rigidPart(`Eye_${side}`, g, new T.MeshPhysicalMaterial({ name: 'Inset blue eyes', vertexColors: true, roughness: .3, clearcoat: .45, clearcoatRoughness: .2 }), [0, 0, 0], [1, 1, 1])
}
const noseRay = new T.Raycaster(new T.Vector3(0, .592, .8), new T.Vector3(0, 0, -1)), noseHit = noseRay.intersectObject(rayMesh)[0]
assert(noseHit, 'nose')
const nose = surfacePatch(noseHit.point, new T.Vector3(0, 0, 1), (r, angle) => {
  const y = .005 * r * Math.sin(angle), x = .0075 * r * Math.cos(angle) * (.74 + .26 * Math.sin(angle))
  const color = new T.Color('#bc9292').lerp(new T.Color('#d2adab'), (Math.sin(angle) + 1) * .24)
  color.lerp(new T.Color('#eeeae2'), smooth(.86, 1, r))
  return { x, y, color, lift: .0003 + .0008 * (1 - r * r) }
}, 8, 48)
rigidPart('Pink_nose', nose, new T.MeshStandardMaterial({ name: 'Soft pink nose', vertexColors: true, roughness: .85 }), [0, 0, 0], [1, 1, 1])

const duration = 1.36, stance = .68, stride = .16, lift = .048
function footTarget(leg, phase) {
  const t = (phase + leg.phase) % 1, p = rests[leg.foot].clone()
  if (t < stance) p.z += stride * (.5 - t / stance)
  else {
    const u = (t - stance) / (1 - stance), h = u * u * (3 - 2 * u), m = -(1 - stance) / stance
    p.z += stride * (-.5 + h + m * (2 * u ** 3 - 3 * u * u + u))
    p.y += lift * Math.sin(Math.PI * u) ** 2
  }
  return p
}
function setWorldRotation(index, q) {
  const parent = bones[index].parent
  bones[index].quaternion.copy(parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q))
  root.updateMatrixWorld(true)
}
function aim(index, restEnd, end) {
  const start = bones[index].getWorldPosition(new T.Vector3()), a = rests[restEnd].clone().sub(rests[index]).normalize(), b = end.clone().sub(start).normalize()
  setWorldRotation(index, new T.Quaternion().setFromUnitVectors(a, b))
}
function pose(phase) {
  bones.forEach(b => b.quaternion.identity())
  bones[body].position.copy(rests[body]).add(new T.Vector3(.002 * Math.sin(2 * Math.PI * phase), -.023 + .003 * Math.cos(4 * Math.PI * phase), 0))
  bones[neck].rotation.x = .012 * Math.sin(4 * Math.PI * phase)
  bones[head].rotation.x = -.008 * Math.sin(4 * Math.PI * phase)
  tail.forEach((i, k) => { bones[i].rotation.z = .018 * Math.sin(2 * Math.PI * phase - k * .45); bones[i].rotation.x = .008 * Math.sin(2 * Math.PI * phase - k * .5) })
  root.updateMatrixWorld(true)
  for (const leg of legs) {
    const target = footTarget(leg, phase), ankle = target.clone().add(rests[leg.end].clone().sub(rests[leg.foot]))
    const hip = bones[leg.upper].getWorldPosition(new T.Vector3()), delta = ankle.clone().sub(hip), d = delta.length(), axis = delta.normalize()
    const l1 = rests[leg.lower].distanceTo(rests[leg.upper]), l2 = rests[leg.end].distanceTo(rests[leg.lower])
    assert(d < l1 + l2, `unreachable ${leg.id}: ${d}`)
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), perpendicular = new T.Vector3(0, 0, leg.front ? -1 : 1).addScaledVector(axis, -(leg.front ? -1 : 1) * axis.z).normalize()
    const knee = hip.clone().addScaledVector(axis, along).addScaledVector(perpendicular, Math.sqrt(Math.max(0, l1 * l1 - along * along)))
    aim(leg.upper, leg.lower, knee); aim(leg.lower, leg.end, ankle); aim(leg.end, leg.foot, target)
    setWorldRotation(leg.foot, new T.Quaternion())
    assert(bones[leg.foot].getWorldPosition(new T.Vector3()).distanceTo(target) < 1e-6, 'IK contact')
  }
}
const times = [], samples = bones.map(() => ({ q: [], p: [] })), frames = 240
const phases = [...new Set([...Array.from({ length: frames + 1 }, (_, i) => i / frames), ...legs.flatMap(l => [(1 - l.phase) % 1, (1 + stance - l.phase) % 1])])].sort((a, b) => a - b)
for (const phase of phases) {
  times.push(phase * duration); pose(phase === 1 ? 0 : phase)
  bones.forEach((b, k) => { samples[k].q.push(...b.quaternion.toArray()); samples[k].p.push(...b.position.toArray()) })
}
const tracks = bones.flatMap((b, i) => [new T.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, samples[i].q), ...(i === body ? [new T.VectorKeyframeTrack(`${b.name}.position`, times, samples[i].p)] : [])])
const clip = new T.AnimationClip('Angora_Walk_InPlace', duration, tracks)
bones.forEach((b, i) => { b.quaternion.identity(); b.position.copy(rests[i]); const parent = bones.indexOf(b.parent); if (parent >= 0) b.position.sub(rests[parent]) })
root.updateMatrixWorld(true)
root.userData = { source: 'JonasDichelle — Rigged and animated Cat (CC BY)', sourceUrl: 'https://blendswap.com/blend/18519', distribution: 'https://github.com/nrz/ylikuutio#3d-models', modifications: 'Quadruped skinning, four-beat walk, soft white coat volume, inset blue eyes, softened muzzle', gait: { duration, stance, stride, speed: stride / (duration * stance), lift, legs: legs.map(l => ({ name: bones[l.foot].name, phase: l.phase, rest: rests[l.foot].toArray() })) } }
const output = await new GLTFExporter().parseAsync(root, { binary: true, animations: [clip], onlyVisible: false })
await fs.writeFile(new URL('cat-angora-walk.glb', folder), Buffer.from(output))
const report = { originalSha256: createHash('sha256').update(original).digest('hex'), sourceTriangles: geometry.index.count / 3, furTriangles: 0, coatStyle: 'soft-volume', bones: bones.length, duration, keyframes: phases.length, bytes: output.byteLength, gait: root.userData.gait }
await fs.writeFile(new URL('cat-angora-build.json', folder), JSON.stringify(report, null, 2) + '\n')
console.log(report)
