import assert from 'node:assert/strict'
import * as T from 'three'
import { MeshBVH } from 'three-mesh-bvh'

// 원본의 넓게 붙은 수염 면을 닫고, 머리에 붙는 가는 곡선으로 교체한다.
export function cleanSnowdropWhiskers(geometry, headBone) {
  const p = geometry.attributes.position, sourceCount = p.count, faceCenter = -.063
  const weld = new Map(), ids = [], representatives = []
  for (let i = 0; i < sourceCount; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e5)).join(',')
    if (!weld.has(key)) { weld.set(key, representatives.length); representatives.push(i) }
    ids.push(weld.get(key))
  }
  const outside = i => {
    const d = Math.abs(p.getX(i) - faceCenter), y = p.getY(i)
    return y > .645 && y < .716 && d > .022 && p.getZ(i) > .605 - .7 * Math.max(0, d - .018)
  }
  const index = [], edges = new Map(), removed = new Set()
  let removedTriangles = 0
  for (let i = 0; i < geometry.index.count; i += 3) {
    const tri = [0, 1, 2].map(k => geometry.index.getX(i + k))
    const cut = tri.some(outside)
    if (cut) { removedTriangles++; tri.forEach(v => removed.add(ids[v])) }
    else {
      index.push(...tri)
      for (let k = 0; k < 3; k++) {
        const a = tri[k], b = tri[(k + 1) % 3], wa = ids[a], wb = ids[b]
        if (wa === wb) continue
        const key = [Math.min(wa, wb), Math.max(wa, wb)].join(',')
        const edge = edges.get(key)
        if (edge) edge.count++
        else edges.set(key, { a, b, wa, wb, count: 1 })
      }
    }
  }
  const boundary = [...edges.values()].filter(e => e.count === 1 && removed.has(e.wa) && removed.has(e.wb))
  const next = new Map()
  for (const edge of boundary) {
    assert(!next.has(edge.wa), '수염 절단 경계가 갈라졌습니다.')
    next.set(edge.wa, edge)
  }
  const loops = []
  while (next.size) {
    const start = next.keys().next().value, loop = []
    let at = start
    do {
      const edge = next.get(at)
      assert(edge, '수염 절단 경계가 닫히지 않았습니다.')
      loop.push(edge.a); next.delete(at); at = edge.wb
    } while (at !== start)
    loops.push(loop)
  }
  assert(loops.length > 0 && loops.length < 30)

  const attrs = Object.fromEntries(Object.entries(geometry.attributes).map(([name, a]) => [name, Array.from(a.array)]))
  const point = new T.Vector3(), forehead = new T.Vector3(faceCenter, .80, .57)
  let whiteVertex = 0, nearest = Infinity
  for (let i = 0; i < sourceCount; i++) {
    const distance = point.fromBufferAttribute(p, i).distanceToSquared(forehead)
    if (distance < nearest) { nearest = distance; whiteVertex = i }
  }
  const whiteUV = new T.Vector2().fromBufferAttribute(geometry.attributes.uv, whiteVertex)
  const addVertex = (position, normal, uv = whiteUV) => {
    const i = attrs.position.length / 3
    attrs.position.push(...position.toArray()); attrs.normal.push(...normal.toArray()); attrs.uv.push(...uv.toArray())
    attrs.skinIndex.push(headBone, 0, 0, 0); attrs.skinWeight.push(1, 0, 0, 0)
    return i
  }
  const boundaryVertices = new Set(boundary.flatMap(e => [representatives[e.wa], representatives[e.wb]]))
  const capIndexStart = index.length
  for (const loop of loops) {
    const center = new T.Vector3(), normal = new T.Vector3()
    for (const i of loop) {
      center.add(point.fromBufferAttribute(p, i))
      normal.add(point.fromBufferAttribute(geometry.attributes.normal, i))
    }
    center.divideScalar(loop.length); normal.normalize()
    // 긴 삼각형을 한 점에 모으면 입가가 별 모양으로 꺾이므로 안쪽 고리로 면을 나눈다.
    let ring = loop
    for (let level = 1; level <= 4; level++) {
      const inner = loop.map(i => addVertex(new T.Vector3().fromBufferAttribute(p, i).lerp(center, level / 5), normal))
      for (let i = 0; i < loop.length; i++) {
        const next = (i + 1) % loop.length
        index.push(ring[next], ring[i], inner[i], ring[next], inner[i], inner[next])
      }
      ring = inner
    }
    const middle = addVertex(center, normal)
    for (let i = 0; i < loop.length; i++) index.push(ring[(i + 1) % loop.length], ring[i], middle)
  }
  const capEnd = attrs.position.length / 3
  const faceIndexCount = index.length
  const smooth = (a, b, x) => { const t = T.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
  const neighbours = Array.from({ length: capEnd }, () => new Set())
  for (let i = sourceCount; i < capEnd; i++) ids[i] = i
  for (let i = 0; i < sourceCount; i++) ids[i] = representatives[ids[i]]
  for (let i = 0; i < index.length; i += 3) {
    const tri = index.slice(i, i + 3).map(v => ids[v])
    for (const a of tri) for (const b of tri) if (a !== b) neighbours[a].add(b)
  }
  const masks = Array.from({ length: capEnd }, (_, i) => {
    const [x, y, z] = attrs.position.slice(i * 3, i * 3 + 3), d = Math.abs(x - faceCenter)
    return smooth(.018, .030, d) * (1 - smooth(.070, .090, d)) * smooth(.645, .662, y) *
      (1 - smooth(.707, .725, y)) * smooth(.535, .575, z)
  })
  let points = Array.from({ length: capEnd }, (_, i) => new T.Vector3().fromArray(attrs.position, i * 3))
  for (let pass = 0; pass < 100; pass++) points = points.map((p, i) => {
    if (!masks[i] || !neighbours[i].size) return p
    const mean = new T.Vector3()
    for (const n of neighbours[i]) mean.add(points[n])
    return p.clone().lerp(mean.divideScalar(neighbours[i].size), .55 * masks[i])
  })
  for (let i = 0; i < capEnd; i++) if (masks[ids[i]] > 0) points[ids[i]].toArray(attrs.position, i * 3)
  // 손상되지 않은 입가 둘레에 곡면을 맞춰, 메운 부분의 꺼짐과 접힌 능선을 없앤다.
  const cutVertices = new Set([...removed].map(id => representatives[id]))
  const fits = [-1, 1].map(side => {
    const matrix = Array.from({ length: 6 }, () => new Float64Array(7))
    for (const i of representatives) {
      if (cutVertices.has(i)) continue
      const d = (p.getX(i) - faceCenter) * side, y = p.getY(i), z = p.getZ(i)
      if (d < .018 || d > .100 || y < .650 || y > .742 || z < .535 || geometry.attributes.normal.getZ(i) < .35) continue
      if (!(d > .069 || d < .024 || y < .664 || y > .723)) continue
      const u = (d - .045) / .045, v = (y - .695) / .05, basis = [1, u, v, u * u, u * v, v * v]
      for (let a = 0; a < 6; a++) { for (let b = 0; b < 6; b++) matrix[a][b] += basis[a] * basis[b]; matrix[a][6] += basis[a] * z }
    }
    for (let k = 0; k < 6; k++) {
      let pivot = k
      for (let j = k + 1; j < 6; j++) if (Math.abs(matrix[j][k]) > Math.abs(matrix[pivot][k])) pivot = j
      ;[matrix[k], matrix[pivot]] = [matrix[pivot], matrix[k]]
      assert(Math.abs(matrix[k][k]) > 1e-8, '입가 곡면을 맞출 기준점이 부족합니다.')
      const scale = matrix[k][k]; for (let b = k; b <= 6; b++) matrix[k][b] /= scale
      for (let a = 0; a < 6; a++) if (a !== k) { const factor = matrix[a][k]; for (let b = k; b <= 6; b++) matrix[a][b] -= factor * matrix[k][b] }
    }
    return matrix.map(row => row[6])
  })
  const faceBlend = [], faceNormals = []
  for (let i = 0; i < capEnd; i++) {
    const [x, y, z] = attrs.position.slice(i * 3, i * 3 + 3), side = x < faceCenter ? -1 : 1, d = Math.abs(x - faceCenter)
    const blend = smooth(.018, .030, d) * (1 - smooth(.070, .095, d)) * smooth(.647, .669, y) * (1 - smooth(.715, .741, y)) * smooth(.535, .575, z)
    faceBlend[i] = blend
    const c = fits[side < 0 ? 0 : 1], u = (d - .045) / .045, v = (y - .695) / .05
    const depth = c[0] + c[1] * u + c[2] * v + c[3] * u * u + c[4] * u * v + c[5] * v * v
    attrs.position[i * 3 + 2] += blend * T.MathUtils.clamp(depth - z, -.020, .020)
    faceNormals[i] = new T.Vector3(-side * (c[1] + 2 * c[3] * u + c[4] * v) / .045, -(c[2] + c[4] * u + 2 * c[5] * v) / .05, 1).normalize()
  }
  const face = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(attrs.position, 3)).setIndex(index)
  const surface = new MeshBVH(face)
  const whiskers = []
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
    const rootX = .029 + row * .002
    const start = new T.Vector3(faceCenter + side * rootX, .702 - row * .008, .605 - .7 * (rootX - .018) - .007)
    const hit = surface.raycastFirst(new T.Ray(new T.Vector3(start.x, start.y, 1), new T.Vector3(0, 0, -1)), T.DoubleSide)
    assert(hit, '수염 뿌리를 붙일 얼굴 표면이 없습니다.')
    // 사용자가 승인한 수염 곡선은 유지하고 주변 입가만 다듬는다.
    start.z = (side < 0 ? [.5895412043, .5841641501, .5754707232, .5663056746] : [.5898934826, .5853167996, .5760293826, .5672269836])[row]
    const end = new T.Vector3(faceCenter + side * (.148 + (row % 2) * .014), start.y + [.007, -.001, -.014, -.026][row], .577 - row * .007)
    const c1 = start.clone().add(new T.Vector3(side * .040, .006, .010))
    const c2 = end.clone().add(new T.Vector3(-side * .037, .014, .012))
    const curve = new T.CubicBezierCurve3(start, c1, c2, end), segments = 24, radial = 8
    const first = attrs.position.length / 3
    for (let s = 0; s <= segments; s++) {
      const t = s / segments, center = curve.getPoint(t), tangent = curve.getTangent(t)
      const u = new T.Vector3(0, 0, 1).cross(tangent).normalize(), v = tangent.clone().cross(u).normalize()
      const radius = .00105 * (1 - t) ** .8 + .000035
      for (let r = 0; r < radial; r++) {
        const angle = r / radial * Math.PI * 2
        const normal = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle))
        addVertex(center.clone().addScaledVector(normal, radius), normal)
      }
    }
    for (let s = 0; s < segments; s++) for (let r = 0; r < radial; r++) {
      const a = first + s * radial + r, b = first + s * radial + (r + 1) % radial
      index.push(a, b, a + radial, b, b + radial, a + radial)
    }
    const base = addVertex(start, curve.getTangent(0).negate()), tip = addVertex(end, curve.getTangent(1))
    for (let r = 0; r < radial; r++) {
      index.push(base, first + (r + 1) % radial, first + r)
      const last = first + segments * radial
      index.push(tip, last + r, last + (r + 1) % radial)
    }
    whiskers.push({ side, row, first, count: attrs.position.length / 3 - first })
  }
  face.dispose()
  for (const [name, data] of Object.entries(attrs)) {
    const original = geometry.attributes[name]
    geometry.setAttribute(name, new T.BufferAttribute(new original.array.constructor(data), original.itemSize))
  }
  geometry.setIndex(index)
  // 기존 모프 대응을 유지하고, 잘라 닫은 수염 뿌리의 법선만 갱신한다.
  const normals = geometry.clone(); normals.computeVertexNormals()
  const averages = new Map()
  for (let i = 0; i < sourceCount; i++) if (masks[ids[i]] > 0 || boundaryVertices.has(ids[i])) {
    if (!averages.has(ids[i])) averages.set(ids[i], new T.Vector3())
    averages.get(ids[i]).add(point.fromBufferAttribute(normals.attributes.normal, i))
  }
  for (let i = 0; i < sourceCount; i++) if (averages.has(ids[i])) {
    const blend = boundaryVertices.has(ids[i]) ? 1 : masks[ids[i]]
    const normal = point.fromBufferAttribute(geometry.attributes.normal, i).lerp(averages.get(ids[i]).clone().normalize(), blend).normalize()
    geometry.attributes.normal.setXYZ(i, ...normal.toArray())
  }
  for (let i = sourceCount; i < capEnd; i++) geometry.attributes.normal.setXYZ(i, ...point.fromBufferAttribute(normals.attributes.normal, i).toArray())
  for (let i = 0; i < capEnd; i++) if (faceBlend[i] > 0) geometry.attributes.normal.setXYZ(i, ...point.fromBufferAttribute(geometry.attributes.normal, i).lerp(faceNormals[i], faceBlend[i]).normalize().toArray())
  normals.dispose()
  // 잘못 구워진 수염 뿌리 색·노멀을 흰 털 영역으로 옮긴다. UV 경계를 분리해 다른 무늬가 섞이지 않게 한다.
  attrs.normal = Array.from(geometry.attributes.normal.array)
  const patchVertices = new Map()
  for (let i = 0; i < faceIndexCount; i += 3) {
    const tri = index.slice(i, i + 3)
    const withinPad = v => {
      const [x, y, z] = attrs.position.slice(v * 3, v * 3 + 3), d = Math.abs(x - faceCenter)
      return d > .023 && d < .095 && y > .650 && y < .717 && z > .535
    }
    // 메운 면은 모두 같은 흰 털 영역을 사용해야 얼굴 UV와 이마 UV 사이의 다른 무늬를 가로지르지 않는다.
    if (i < capIndexStart && (!tri.every(withinPad) || !tri.some(v => masks[ids[v]] > .05))) continue
    for (let k = 0; k < 3; k++) {
      const v = tri[k]
      if (!patchVertices.has(v)) {
        const copy = attrs.position.length / 3; patchVertices.set(v, copy)
        for (const [name, values] of Object.entries(attrs)) {
          const size = geometry.attributes[name].itemSize
          values.push(...(name === 'uv' ? whiteUV.toArray() : values.slice(v * size, (v + 1) * size)))
        }
      }
      index[i + k] = patchVertices.get(v)
    }
  }
  for (const [name, data] of Object.entries(attrs)) {
    const original = geometry.attributes[name]
    geometry.setAttribute(name, new T.BufferAttribute(new original.array.constructor(data), original.itemSize))
  }
  geometry.setIndex(index)
  for (const targets of Object.values(geometry.morphAttributes)) for (const target of targets) {
    const array = new Float32Array(attrs.position.length); array.set(target.array); target.array = array; target.count = array.length / 3
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return { removedTriangles, caps: loops.map(l => l.length), capIndexStart, capIndexEnd: faceIndexCount, sourceCount, patchVertices: patchVertices.size, whiskers }
}
