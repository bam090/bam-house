"""Blender에서 휴식 자세와 보정 형상을 만들고 기존 웹 리그에 저장한다.

blender -b --factory-startup --disable-autoexec --python-exit-code 1 \
  --python scripts/refine-snowdrop-rest.py

원본 UV, 꼬리 밖 형상·가중치, 얼굴, 걷기·점프·귀 동작과 DQ 메타데이터를 보존한다.
"""
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'public/models/characters/snowdrop'
TAIL_ONLY = '--tail-only' in sys.argv
SOURCE = FOLDER / ('snowdrop-rest-paws.glb' if TAIL_ONLY else 'snowdrop-volume.glb')
OUTPUT = FOLDER / 'snowdrop-tail-smooth.glb'
REVIEW = ROOT / 'docs/cat-reference/tail-smooth-review'
SKILLS = Path.home() / '.codex/skills'
sys.path.extend([str(SKILLS / 'blender-sculpting/scripts'), str(SKILLS / 'blender-expert/scripts')])
from bx_sculpt import Sculptor
from bx_review import review

assert bpy.app.version >= (5, 2, 0)
raw = SOURCE.read_bytes()
source_hash = hashlib.sha256(raw).hexdigest()
json_length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + json_length])
binary = bytearray(raw[28 + json_length:])
sizes = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
dtypes = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}


def read(index):
    acc = doc['accessors'][index]
    view = doc['bufferViews'][acc['bufferView']]
    width = sizes[acc['type']]
    dtype = np.dtype(dtypes[acc['componentType']])
    offset = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    return np.ndarray((acc['count'], width), dtype=dtype, buffer=binary, offset=offset,
                      strides=(view.get('byteStride', width * dtype.itemsize), dtype.itemsize)).copy()


def replace(index, values):
    """기존 accessor 참조를 유지하고 데이터만 교체한다."""
    acc = doc['accessors'][index]
    values = np.asarray(values, dtype=dtypes[acc['componentType']]).reshape(-1, sizes[acc['type']])
    binary.extend(b'\0' * ((-len(binary)) % 4))
    acc['bufferView'] = len(doc['bufferViews'])
    acc.pop('byteOffset', None)
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': values.nbytes})
    binary.extend(values.tobytes())
    acc['count'] = len(values)
    if 'min' in acc:
        acc['min'], acc['max'] = values.min(axis=0).tolist(), values.max(axis=0).tolist()


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


primitive = doc['meshes'][0]['primitives'][0]
positions = read(primitive['attributes']['POSITION']).astype(float)
normals = read(primitive['attributes']['NORMAL']).astype(float)
ids = read(primitive['attributes']['JOINTS_0']).astype(int)
weights = read(primitive['attributes']['WEIGHTS_0']).astype(float)
triangles = read(primitive['indices']).reshape(-1, 3).astype(int)
joints = doc['skins'][0]['joints']
parents = {child: i for i, n in enumerate(doc['nodes']) for child in n.get('children', [])}
names = {n['name']: i for i, n in enumerate(doc['nodes'])}
rests = {}
for i in range(1, 31):
    rests[i] = rests.get(parents[i], Vector()) + Vector(doc['nodes'][i]['translation'])
legs = doc['nodes'][0]['extras']['gait']['legs']


# glTF Y-up -> Blender Z-up. All authored rest bones have identity rotation.
B = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
BI = B.inverted()

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
armature = bpy.data.armatures.new('RestPoseAuthoring')
rig = bpy.data.objects.new('RestPoseAuthoring', armature)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for i in range(1, 31):
    bone = armature.edit_bones.new(doc['nodes'][i]['name'])
    bone.head = B @ rests[i]
    bone.tail = bone.head + Vector((0, .05, 0))
    if parents[i] != 0:
        bone.parent = armature.edit_bones[doc['nodes'][parents[i]]['name']]
bpy.ops.object.mode_set(mode='OBJECT')


def bone(i):
    return rig.pose.bones[doc['nodes'][i]['name']]


def global_matrix(i):
    return BI @ bone(i).matrix @ B


def world_rotation(i, q):
    translation = bone(i).matrix.translation.copy()
    bone(i).matrix = Matrix.Translation(translation) @ B @ q.to_matrix().to_4x4() @ BI
    bpy.context.view_layer.update()


def aim(i, rest_direction, destination):
    direction = destination - global_matrix(i).translation
    world_rotation(i, rest_direction.normalized().rotation_difference(direction.normalized()))


max_reach_error = 0


def pose(name, amount):
    global max_reach_error
    s = amount
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
        pb.rotation_mode = 'QUATERNION'
    if name == 'Sit':
        delta = Vector((0, -.22 * s, .055 * s))
        angles = [-.55, .25, -.45, .75]
    else:
        delta = Vector((0, -.20 * s, 0))
        angles = [.05, -.05, -.07, .07]
    bone(1).location = B.to_3x3() @ delta
    for i, angle in enumerate(angles, 1):
        bone(i).rotation_quaternion = Quaternion((1, 0, 0), angle * s)
    bpy.context.view_layer.update()
    for i in (29, 30):
        world_rotation(i, Quaternion((1, 0, 0), (-.48 if name == 'Sit' else -.15) * s))
    # Share the lowering between the root and the plume angle to avoid a sharp fold.
    previous_pelvis = Vector((-.075, .40 - .15 * s, -.23 + (.08 * s if name == 'Sit' else 0)))
    previous_rotation = Quaternion((1, 0, 0), (-.40 if name == 'Sit' else .15) * s)
    previous_root = previous_pelvis + previous_rotation @ Vector((0, .09, -.10))
    root_delta = (previous_root - global_matrix(16).translation) * .55
    bone(16).location = B.to_3x3() @ (global_matrix(1).to_quaternion().inverted() @ root_delta)
    bpy.context.view_layer.update()
    tail_rotation = Quaternion((0, 1, 0), (0 if name == 'Sit' else .60) * s) @ Quaternion((1, 0, 0), (.38 if name == 'Sit' else .12) * s)
    for i in range(16, 21):
        world_rotation(i, tail_rotation)
    goals = {}
    for li, leg in enumerate(legs):
        upper, lower, end, foot = [names[n] for n in leg['jointNames']]
        a, b, c, d = [rests[i] for i in (upper, lower, end, foot)]
        target = d.copy()
        target.z += ((-.02 if leg['front'] else .33) if name == 'Sit' else (.265 if leg['front'] else .205)) * s
        if not leg['front']:
            target.x += leg['side'] * (.052 if name == 'Sit' else .035) * s
        if not leg['front'] or name == 'Lie':
            target.y += .018 * math.sin(math.pi * s) ** 2
        offset = c - d
        if not leg['front'] or name == 'Lie':
            height = .025 if leg['front'] else (.080 if name == 'Sit' else .100)
            offset = offset.lerp(Vector((0, height, -math.sqrt(offset.length_squared - height ** 2))), s)
        wrist = target + offset
        hip = global_matrix(upper).translation
        axis = wrist - hip
        l1, l2, raw_distance = (b - a).length, (c - b).length, axis.length
        distance = min(l1 + l2 - 1e-5, max(abs(l1 - l2) + 1e-5, raw_distance))
        max_reach_error = max(max_reach_error, abs(distance - raw_distance))
        assert abs(distance - raw_distance) < .012, (name, s, leg['jointNames'][0], raw_distance, l1 + l2)
        axis.normalize()
        along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance)
        pole = Vector((0, 0, -1 if leg['front'] else 1))
        pole = (pole - axis * pole.dot(axis)).normalized()
        knee = hip + axis * along + pole * math.sqrt(max(0, l1 * l1 - along * along))
        aim(upper, b - a, knee)
        aim(lower, c - b, wrist)
        aim(end, d - c, target)
        world_rotation(foot, Quaternion())
        goals[32 + li * 2], goals[33 + li * 2] = wrist, target
    matrices = {i: global_matrix(i) for i in range(1, 31)}
    return matrices, goals


def rotate(q, v):
    u = 2 * np.cross(q[:, :3], v)
    return v + q[:, 3:4] * u + np.cross(q[:, :3], u)


def deformation(matrices):
    real, dual = [], []
    for i in joints:
        m = matrices[i] @ Matrix.Translation(-rests[i])
        q = m.to_quaternion().normalized()
        xyz = np.array([q.x, q.y, q.z])
        t = np.array(m.translation)
        real.append([*xyz, q.w])
        dual.append([*(.5 * (q.w * t + np.cross(t, xyz))), -.5 * np.dot(t, xyz)])
    qr, qd = np.array(real)[ids], np.array(dual)[ids]
    signs = np.where(np.sum(qr * qr[:, :1], axis=2) < 0, -1, 1) * weights
    r, d = np.sum(qr * signs[:, :, None], axis=1), np.sum(qd * signs[:, :, None], axis=1)
    length = np.linalg.norm(r, axis=1)[:, None]
    r, d = r / length, d / length
    translation = 2 * (r[:, 3:4] * d[:, :3] - d[:, 3:4] * r[:, :3] + np.cross(r[:, :3], d[:, :3]))
    return r, translation


# Weld coincident UV seams for sculpting only; the exported index/UV data stay untouched.
used = np.unique(triangles)
_, representatives, weld_used = np.unique(np.round(positions[used], 5), axis=0, return_index=True, return_inverse=True)
representatives = used[representatives]
weld = np.zeros(len(positions), dtype=int)
weld[used] = weld_used
weld_faces = weld[triangles]
base = positions[representatives]
tail_weight = np.sum(weights * np.isin(ids, range(7, 12)), axis=1)
head_weight = np.sum(weights * np.isin(ids, range(3, 7)), axis=1)
rear_ankle_weight = np.sum(weights * np.isin(ids, [18, 19, 26, 27]), axis=1)
mask = smooth(.055, .13, positions[:, 1]) * (1 - smooth(.66, .75, positions[:, 1]))
mask *= 1 - smooth(.34, .45, positions[:, 2])
mask *= (1 - smooth(.98, .99999, tail_weight)) * (1 - smooth(.15, .65, head_weight))
# The haunch relaxation must not melt the weight-bearing ankle into a thin strap.
mask *= 1 - smooth(.25, .65, rear_ankle_weight)
mask = mask[representatives]
fold = mask * (1 - smooth(.27, .42, base[:, 1]))
root_region = smooth(.25, .35, positions[:, 1]) * (1 - smooth(.64, .72, positions[:, 1])) * (1 - smooth(-.27, -.17, positions[:, 2]))
root_region *= 1 - smooth(.12, .21, np.linalg.norm(positions - np.array(rests[16]), axis=1))
root_region *= smooth(-.46, -.41, positions[:, 2])
neck_region = smooth(.48, .58, base[:, 1]) * (1 - smooth(.72, .79, base[:, 1]))
neck_region *= (1 - smooth(.33, .43, base[:, 2])) * (1 - smooth(.70, .98, head_weight[representatives]))
snapshots, metrics = {}, {}


def sculpt_pose(name, amount):
    matrices, _ = pose(name, amount)
    q, t = deformation(matrices)
    deformed = rotate(q, positions) + t
    # Sculpt in Blender coordinates, with the same mask at every pose sample.
    co = deformed[representatives] @ np.array(B.to_3x3()).T
    mesh = bpy.data.meshes.new(f'{name}_{amount}_study')
    mesh.from_pydata(co.tolist(), [], weld_faces.tolist())
    mesh.update()
    ob = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.collection.objects.link(ob)
    sculpt = Sculptor(ob, symmetry_x=False)
    # Blend the entire hip/ankle attachment, including mixed tail-root weights.
    # Protect only the tail tube itself; pinning its blended attachment leaves a ridge.
    attachment = smooth(.40, .48, base[:, 1]) * (1 - smooth(.62, .68, base[:, 1])) * (1 - smooth(-.29, -.23, base[:, 2]))
    attachment *= 1 - smooth(.10, .18, np.linalg.norm(base - np.array(rests[16]), axis=1))
    haunch = mask * (1 - attachment) * (1 - smooth(.45, .63, base[:, 1])) * (1 - smooth(-.04, .12, base[:, 2]))
    sculpt.mask = 1 - haunch * amount
    sculpt.smooth(strength=.48, iterations=250, preserve_volume=False)
    sculpt._normals()
    sculpt.co += sculpt.vn * (.008 * haunch * amount)[:, None]
    # Recover the broad oval thigh mass after relaxing the folded skin.
    p = sculpt.co @ np.array(BI.to_3x3()).T
    side = np.where(base[:, 0] > -.075, 1, -1)
    center = np.column_stack((-.075 + side * .085, np.full(len(base), .155), np.full(len(base), -.135 if name == 'Sit' else -.17)))
    radii = np.array([.12, .155, .18])
    radial = (p - center) / radii
    envelope = center + radial / np.maximum(np.linalg.norm(radial, axis=1)[:, None], 1e-8) * radii
    outer = haunch * smooth(.035, .08, np.abs(base[:, 0] + .075))
    p += (envelope - p) * (outer * .72 * amount ** 3)[:, None]
    sculpt.co = p @ np.array(B.to_3x3()).T
    sculpt.mask = 1 - fold * amount
    sculpt.smooth(strength=.42, iterations=120, preserve_volume=False)
    sculpt.mask = 1 - mask * amount
    sculpt.smooth(strength=.44, iterations=240, preserve_volume=True)
    # Relax the exposed ankle gently after protecting it from the thigh correction.
    ankle = smooth(.035, .13, base[:, 1]) * smooth(.25, .65, rear_ankle_weight[representatives])
    sculpt.mask = 1 - ankle * amount
    sculpt.smooth(strength=.35, iterations=24, preserve_volume=True)
    # Keep a padded tarsus above the floor instead of the flattened DQ blend.
    p = sculpt.co @ np.array(BI.to_3x3()).T
    p[:, 1] += .010 * ankle * smooth(.008, .045, p[:, 1]) * amount ** 2
    foot_x = np.where(side > 0, matrices[24].translation.x, matrices[28].translation.x)
    p[:, 0] += (p[:, 0] - foot_x) * .12 * ankle * amount ** 2
    sculpt.co = p @ np.array(B.to_3x3()).T
    sculpt.mask = 1 - np.maximum(haunch, ankle) * amount
    sculpt.smooth(strength=.35, iterations=40, preserve_volume=False)
    # The reference has a gently sloping bib, not a spherical chest in front of the forelegs.
    p = sculpt.co @ np.array(BI.to_3x3()).T
    chest = smooth(.30, .43, base[:, 1]) * (1 - smooth(.66, .74, base[:, 1]))
    chest *= smooth(.20, .34, base[:, 2]) * (1 - smooth(.12, .21, np.abs(base[:, 0] + .075)))
    chest *= 1 - smooth(.15, .65, head_weight[representatives])
    p[:, 2] -= (.032 if name == 'Sit' else .012) * chest * amount
    sculpt.co = p @ np.array(B.to_3x3()).T
    sculpt.mask = 1 - np.maximum(neck_region, chest) * amount
    sculpt.smooth(strength=.42, iterations=160, preserve_volume=True)
    sculpt.mask = 1 - chest * amount
    sculpt.smooth(strength=.45, iterations=220, preserve_volume=False)
    sculpt.mask = 1 - neck_region * amount
    sculpt.smooth(strength=.42, iterations=160, preserve_volume=False)
    # A temporary voxel surface removes the folded collar at the tail attachment.
    # Transfer only this small region; keep the original topology, UVs and rig.
    sculpt.commit()
    proxy = ob.copy()
    proxy.data = ob.data.copy()
    bpy.context.collection.objects.link(proxy)
    bpy.context.view_layer.objects.active = proxy
    remesh = proxy.modifiers.new('AttachmentSurface', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = .004
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    surface = Sculptor(proxy, symmetry_x=False)
    surface.smooth(strength=.5, iterations=45, preserve_volume=False)
    surface.commit()
    tree = BVHTree.FromPolygons(surface.co.tolist(), surface.tris.tolist(), all_triangles=True)
    transfer = np.zeros_like(sculpt.co)
    finish_region = np.maximum(root_region[representatives], haunch * .75)
    for i in np.flatnonzero(finish_region > .001):
        target, _, _, _ = tree.find_nearest(Vector(sculpt.co[i]))
        if target is None:
            continue
        delta = np.array(target) - sculpt.co[i]
        transfer[i] = delta
    # Diffuse the projection field before moving vertices to avoid folded triangles.
    for _ in range(40):
        average = np.zeros_like(transfer)
        np.add.at(average, sculpt.edges[:, 0], transfer[sculpt.edges[:, 1]])
        np.add.at(average, sculpt.edges[:, 1], transfer[sculpt.edges[:, 0]])
        transfer = .5 * transfer + .5 * average / sculpt.deg[:, None]
    limits = np.where(tail_weight[representatives] > .99999, .003, .018)
    transfer *= np.minimum(1, limits / np.maximum(1e-8, np.linalg.norm(transfer, axis=1)))[:, None]
    sculpt.co += transfer * (finish_region * amount)[:, None]
    sculpt.mask = 1 - haunch * amount
    sculpt.smooth(strength=.35, iterations=30, preserve_volume=False)
    sculpt._normals()
    sculpt.co += sculpt.vn * (.003 * haunch * amount)[:, None]
    sculpt.mask = 1 - root_region[representatives] * amount
    sculpt.smooth(strength=.45, iterations=300, preserve_volume=False)
    # Remove small facets along the plume without shrinking its cross-section.
    tail_before = sculpt.co.copy()
    sculpt.mask = 1 - smooth(.70, .99999, tail_weight[representatives]) * amount
    sculpt.smooth(strength=.35, iterations=30, preserve_volume=False)
    tail_delta = sculpt.co - tail_before
    tail_delta *= np.minimum(1, .0035 / np.maximum(1e-8, np.linalg.norm(tail_delta, axis=1)))[:, None]
    sculpt.co = tail_before + tail_delta
    # Restore section thickness around the mesh centreline, not the offset bone axis.
    # Re-inflating individual original radii reintroduced the AI mesh's corrugated collar.
    rest_axis = np.array((rests[17] - rests[16]).normalized())
    rest_offset = base - np.array(rests[16])
    along = rest_offset @ rest_axis
    world_axis = np.array(matrices[16].to_quaternion() @ Vector(rest_axis))
    p = sculpt.co @ np.array(BI.to_3x3()).T
    u = np.array([1., 0, 0]) - rest_axis * rest_axis[0]
    u /= np.linalg.norm(u)
    basis = np.column_stack((u, np.cross(rest_axis, u)))
    world_basis = np.array(matrices[16].to_quaternion().to_matrix()) @ basis
    stations = np.linspace(-.04, .20, 25)
    centers, transforms = [], []
    for station in stations:
        section = np.exp(-((along - station) / .025) ** 2) * smooth(.80, .99999, tail_weight[representatives])
        section /= max(1e-8, section.sum())
        original_center, center = section @ base, section @ p
        original_uv, uv = (base - original_center) @ basis, (p - center) @ world_basis
        original_cov = original_uv.T @ (section[:, None] * original_uv)
        cov = uv.T @ (section[:, None] * uv)
        def matrix_power(matrix, power):
            eigenvalues, axes = np.linalg.eigh(matrix)
            return (axes * np.maximum(eigenvalues, 1e-9) ** power) @ axes.T
        transforms.append(matrix_power(original_cov, .5) @ matrix_power(cov, -.5))
        centers.append(center)
    center = np.column_stack([np.interp(along, stations, np.array(centers)[:, i]) for i in range(3)])
    transform = np.stack([np.interp(along, stations, np.array(transforms)[:, i, j]) for i in range(2) for j in range(2)], axis=1).reshape(-1, 2, 2)
    uv = (p - center) @ world_basis
    preserve = smooth(.80, .99999, tail_weight[representatives]) * root_region[representatives]
    p += ((np.einsum('nij,nj->ni', transform, uv) - uv) @ world_basis.T) * preserve[:, None]
    sculpt.co = p @ np.array(B.to_3x3()).T
    bpy.data.objects.remove(proxy, do_unlink=True)
    # Soft underside contact; protect paws and the complete tail tube.
    editable = mask > .001
    sculpt.co[editable, 2] = np.maximum(sculpt.co[editable, 2], .008 * mask[editable])
    sculpt.commit()
    mesh.shade_smooth()
    sculpt._normals()
    refined = sculpt.co @ np.array(BI.to_3x3()).T
    refined_normals = sculpt.vn @ np.array(BI.to_3x3()).T
    delta = np.zeros_like(positions)
    delta[used] = refined[weld[used]] - deformed[used]
    inverse = q.copy()
    inverse[:, :3] *= -1
    corrective = rotate(inverse, delta)
    normal_delta = np.zeros_like(normals)
    # Match geometric normals inside the edited area without touching facial shading.
    n = np.zeros_like(normals)
    n[used] = refined_normals[weld[used]]
    strength = smooth(.045, .09, positions[:, 1]) * (1 - smooth(.72, .79, positions[:, 1]))
    strength *= (1 - smooth(.36, .46, positions[:, 2])) * amount
    strength *= 1 - smooth(.70, .98, head_weight)
    strength = np.maximum(strength, smooth(.0002, .003, np.linalg.norm(delta, axis=1)))
    normal_delta = (rotate(inverse, n) - normals) * strength[:, None]
    if amount == 1:
        snapshots[name] = ob
        metrics[name] = {'pelvis': list(matrices[1].translation), 'chest': list(matrices[2].translation),
                         'maxCorrection': float(np.linalg.norm(corrective, axis=1).max()),
                         'minimumY': float(refined[:, 1].min())}
    else:
        bpy.data.objects.remove(ob, do_unlink=True)
    return corrective, normal_delta


if not TAIL_ONLY:
    for name, endpoint_index, midpoint_index in [('Sit', 0, 2), ('Lie', 1, 3)]:
        for amount, index in [(1., endpoint_index), (.5, midpoint_index)]:
            cp, cn = sculpt_pose(name, amount)
            replace(primitive['targets'][index]['POSITION'], cp)
            replace(primitive['targets'][index]['NORMAL'], cn)

    # Correct the shared attachment when the two endpoint actions overlap in the web mixer.
    sit_matrices, _ = pose('Sit', 1)
    lie_matrices, _ = pose('Lie', 1)
    for i in range(1, 31):
        locals_ = [m.get(parents[i], Matrix.Identity(4)).inverted() @ m[i] for m in (sit_matrices, lie_matrices)]
        translation = locals_[0].translation.lerp(locals_[1].translation, .5)
        rotation = locals_[0].to_quaternion().slerp(locals_[1].to_quaternion(), .5)
        rest_translation = rests[i] - rests.get(parents[i], Vector())
        bone(i).matrix_basis = Matrix.Translation(B.to_3x3() @ (translation - rest_translation)) @ B @ rotation.to_matrix().to_4x4() @ BI
    bpy.context.view_layer.update()
    blend_matrices = {i: global_matrix(i) for i in range(1, 31)}
    blend_q, blend_t = deformation(blend_matrices)
    blend_shape = sum(read(primitive['targets'][i]['POSITION']) for i in (0, 1)) * .5
    blend_normal = normals + sum(read(primitive['targets'][i]['NORMAL']) for i in (0, 1)) * .5
    blend_points = rotate(blend_q, positions + blend_shape) + blend_t
    blend_mesh = bpy.data.meshes.new('SitLie_Transition')
    blend_mesh.from_pydata((blend_points[representatives] @ np.array(B.to_3x3()).T).tolist(), [], weld_faces.tolist())
    blend_mesh.update()
    blend_object = bpy.data.objects.new('SitLie_Transition', blend_mesh)
    bpy.context.collection.objects.link(blend_object)
    blend_sculpt = Sculptor(blend_object, symmetry_x=False)
    blend_mask = root_region[representatives] * (1 - smooth(.8, .99999, tail_weight[representatives]))
    blend_sculpt.mask = 1 - blend_mask
    blend_sculpt.smooth(strength=.45, iterations=180, preserve_volume=False)
    blend_sculpt.commit()
    blend_sculpt._normals()
    blend_mesh.shade_smooth()
    blend_inverse = blend_q.copy()
    blend_inverse[:, :3] *= -1
    blend_delta = np.zeros_like(positions)
    blend_delta[used] = (blend_sculpt.co @ np.array(BI.to_3x3()).T)[weld[used]] - blend_points[used]
    blend_corrective = rotate(blend_inverse, blend_delta)
    blend_normals = np.zeros_like(normals)
    blend_normals[used] = (blend_sculpt.vn @ np.array(BI.to_3x3()).T)[weld[used]]
    blend_normal_delta = (rotate(blend_inverse, blend_normals) - blend_normal) * root_region[:, None]
    blend_target = {}
    for key, data in [('POSITION', blend_corrective), ('NORMAL', blend_normal_delta)]:
        index = len(doc['accessors'])
        doc['accessors'].append({'bufferView': 0, 'componentType': 5126, 'count': 0, 'type': 'VEC3'})
        if key == 'POSITION':
            doc['accessors'][-1].update(min=data.min(axis=0).tolist(), max=data.max(axis=0).tolist())
        replace(index, data)
        blend_target[key] = index
    primitive['targets'].append(blend_target)
    doc['meshes'][0]['extras']['targetNames'].append('RestBlendFold')
    doc['meshes'][0]['weights'].append(0)
    snapshots['SitLie'] = blend_object

    for animation in doc['animations']:
        if animation['name'] not in ('Sit', 'Lie'):
            for channel in animation['channels']:
                if channel['target']['path'] == 'weights':
                    index = animation['samplers'][channel['sampler']]['output']
                    replace(index, np.pad(read(index).reshape(-1, 12), ((0, 0), (0, 1))))
            continue
        name = animation['name']
        translation_accessor = len(doc['accessors'])
        doc['accessors'].append({'bufferView': 0, 'componentType': 5126, 'count': 0, 'type': 'VEC3'})
        animation['channels'].append({'sampler': len(animation['samplers']), 'target': {'node': 16, 'path': 'translation'}})
        animation['samplers'].append({'input': animation['samplers'][0]['input'], 'output': translation_accessor, 'interpolation': 'LINEAR'})
        times = read(animation['samplers'][0]['input']).ravel()
        samples = []
        for time in times:
            amount = float(smooth(.04, .92, time / times[-1]))
            matrices, goals = pose(name, amount)
            samples.append((amount, matrices, goals))
        for channel in animation['channels']:
            target = channel['target']
            node, path = target['node'], target['path']
            values = []
            for amount, matrices, goals in samples:
                if path == 'weights':
                    w = [0.] * 13
                    w[0 if name == 'Sit' else 1] = max(0, 2 * amount - 1)
                    w[2 if name == 'Sit' else 3] = 1 - abs(2 * amount - 1)
                    values.extend(w)
                elif node in goals:
                    values.append(list(goals[node]))
                else:
                    local = matrices.get(parents[node], Matrix.Identity(4)).inverted() @ matrices[node]
                    if path == 'rotation':
                        q = local.to_quaternion().normalized()
                        values.append([q.x, q.y, q.z, q.w])
                    elif path == 'translation':
                        values.append(list(local.translation))
            replace(animation['samplers'][channel['sampler']]['output'], values)

    doc['nodes'][0]['extras']['restRefinement'] = {'tool': f'Blender {bpy.app.version_string}', 'source': SOURCE.name,
        'method': 'Reference chest silhouette, relaxed neck and tail attachment, forward supported rear paws; DQ pose correctives'}

# Smooth the complete plume in Blender, including the corrective surfaces.
# Taubin relaxation preserves its fullness; the sacral attachment fades to zero.
finish = smooth(.55, .99999, tail_weight) * smooth(.35, .45, -positions[:, 2])
finish_used = finish[representatives]
collar = smooth(.08, .5, tail_weight) * (1 - smooth(.12, .18, np.linalg.norm(positions - np.array(rests[16]), axis=1)))
collar *= smooth(.30, .39, -positions[:, 2]) * smooth(.30, .38, positions[:, 1])
move_mask = np.maximum(finish, collar)
move_used = move_mask[representatives]
mesh = bpy.data.meshes.new('TailSurfaceFinish')
mesh.from_pydata((base @ np.array(B.to_3x3()).T).tolist(), [], weld_faces.tolist())
ob = bpy.data.objects.new(mesh.name, mesh); bpy.context.collection.objects.link(ob)
sculpt = Sculptor(ob, symmetry_x=False)
sculpt.mask = 1 - move_used
sculpt.edges = sculpt.edges[np.any(move_used[sculpt.edges] > 0, axis=1)]
before_positions, before_normals = positions.copy(), normals.copy()

# Fit one continuous centre curve and a broad radius profile, rather than
# preserving the AI mesh's alternating bulges in every cross-section.
centres = np.array([rests[i] for i in range(16, 21)])
knots = np.r_[0, np.cumsum(np.linalg.norm(np.diff(centres, axis=0), axis=1))]
knots /= knots[-1]
t = knots[1:-1, None]
controls = np.linalg.lstsq(np.hstack((3 * (1-t)**2 * t, 3 * (1-t) * t**2)),
    centres[1:-1] - (1-t)**3 * centres[0] - t**3 * centres[-1], rcond=None)[0]
curve_points = np.vstack((centres[0], controls, centres[-1]))

def curve(t):
    t = np.asarray(t)[:, None]; a, b, c, d = curve_points
    return (1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d

def curve_parameter(coords):
    samples = np.linspace(0, 1, 129)
    samples_co = curve(samples)
    result = np.zeros(len(coords))
    for start in range(0, len(coords), 2048):
        chunk = coords[start:start+2048]
        result[start:start+2048] = samples[np.argmin(np.sum((chunk[:,None] - samples_co)**2, axis=2), axis=1)]
    a, b, c, d = curve_points
    for _ in range(8):
        t = result[:,None]
        derivative = 3*(1-t)**2*(b-a) + 6*(1-t)*t*(c-b) + 3*t*t*(d-c)
        second = 6*(1-t)*(c-2*b+a) + 6*t*(d-2*c+b)
        difference = curve(result) - coords
        denominator = np.sum(derivative**2 + difference * second, axis=1)
        step = np.sum(difference * derivative, axis=1) / np.maximum(.01, denominator)
        result = np.clip(result - np.clip(step, -.05, .05), 0, 1)
    return result

core = np.flatnonzero(finish > 0)
base_t = curve_parameter(before_positions[core])
base_r = np.linalg.norm(before_positions[core] - curve(base_t), axis=1)
stations = np.linspace(.12, .92, 17)
radii = np.array([np.median(base_r[np.abs(base_t-s) < .06]) for s in stations])
radius_fit = np.polynomial.Polynomial.fit(stations, radii, 3)

def finish_surface(coords):
    sculpt.co = coords[representatives] @ np.array(B.to_3x3()).T
    sculpt.mask = 1 - move_used
    sculpt.smooth(strength=.5, iterations=240, preserve_volume=True)
    p = sculpt.co @ np.array(BI.to_3x3()).T
    selected = np.flatnonzero(finish_used > 0)
    t = curve_parameter(p[selected]); centre = curve(t)
    radial = p[selected] - centre
    radius = np.clip(radius_fit(t), .045, .085)
    target = centre + radial * (radius / np.maximum(1e-8, np.linalg.norm(radial, axis=1)))[:,None]
    p[selected] += (target - p[selected]) * (.95 * finish_used[selected])[:,None]
    sculpt.co = p @ np.array(B.to_3x3()).T
    sculpt.smooth(strength=.4, iterations=25, preserve_volume=True)
    result = coords.copy()
    result[used] = (sculpt.co @ np.array(BI.to_3x3()).T)[weld[used]]
    result[move_mask == 0] = coords[move_mask == 0]
    ns = np.zeros_like(normals)
    ns[used] = (sculpt.vn @ np.array(BI.to_3x3()).T)[weld[used]]
    # The smooth tube's analytic normals avoid shading dents caused by uneven
    # imported triangles. Its silhouette is already rebuilt in the mesh above.
    selected = np.flatnonzero(finish > 0)
    t = curve_parameter(result[selected]); radial = result[selected] - curve(t)
    radial /= np.maximum(1e-8, np.linalg.norm(radial, axis=1))[:,None]
    tt = t[:,None]; a,b,c,d = curve_points
    derivative = 3*(1-tt)**2*(b-a) + 6*(1-tt)*tt*(c-b) + 3*tt*tt*(d-c)
    speed = np.linalg.norm(derivative, axis=1)
    slope = radius_fit.deriv()(t) / speed * smooth(0, .08, t) * (1 - smooth(.90, 1, t))
    analytic = radial - derivative / speed[:,None] * slope[:,None]
    analytic /= np.linalg.norm(analytic, axis=1)[:,None]
    blend = .9 * finish[selected,None]
    ns[selected] = ns[selected] * (1-blend) + analytic * blend
    ns[selected] /= np.linalg.norm(ns[selected], axis=1)[:,None]
    return result, ns

positions, smooth_normals = finish_surface(before_positions)
normals = before_normals * (1 - move_mask[:, None]) + smooth_normals * move_mask[:, None]
normals /= np.maximum(1e-8, np.linalg.norm(normals, axis=1))[:, None]
normals[move_mask == 0] = before_normals[move_mask == 0]
for target in primitive['targets']:
    old_delta, old_normal = read(target['POSITION']), read(target['NORMAL'])
    coords, ns = finish_surface(before_positions + old_delta)
    delta = old_delta.copy(); delta[move_mask > 0] = (coords - positions)[move_mask > 0]
    target_normal = (before_normals + old_normal) * (1 - move_mask[:, None]) + ns * move_mask[:, None]
    target_normal /= np.maximum(1e-8, np.linalg.norm(target_normal, axis=1))[:, None]
    normal_delta = old_normal.copy(); normal_delta[move_mask > 0] = (target_normal - normals)[move_mask > 0]
    replace(target['POSITION'], delta); replace(target['NORMAL'], normal_delta)
replace(primitive['attributes']['POSITION'], positions)
replace(primitive['attributes']['NORMAL'], normals)

# Continuous four-joint weights remove the linear weight boundaries at each bend.
centres = np.array([rests[i] for i in range(16, 21)])
lengths = np.linalg.norm(np.diff(centres, axis=0), axis=1)
distance, arc = np.full(len(positions), np.inf), np.zeros(len(positions))
offset = 0.
for a, b, length in zip(centres[:-1], centres[1:], lengths):
    direction = (b - a) / length
    along = np.clip((before_positions - a) @ direction, 0, length)
    d = np.linalg.norm(before_positions - a - along[:, None] * direction, axis=1)
    closer = d < distance
    arc[closer] = offset + along[closer]; distance[closer] = d[closer]
    offset += length
field = arc[representatives].copy()
for _ in range(80):
    average = np.zeros(len(field))
    np.add.at(average, sculpt.edges[:, 0], field[sculpt.edges[:, 1]])
    np.add.at(average, sculpt.edges[:, 1], field[sculpt.edges[:, 0]])
    field += (average / sculpt.deg - field) * finish_used * .5
arc[used] = field[weld[used]]
u = arc / lengths.sum() * 4
new_weights = np.zeros((len(positions), 5))
for j in range(-1, 6):
    x = np.abs(u - j)
    w = np.where(x < 1, 2 / 3 - x * x + .5 * x ** 3, np.where(x < 2, (2 - x) ** 3 / 6, 0))
    new_weights[:, np.clip(j, 0, 4)] += w
new_weights /= np.maximum(1e-8, new_weights.sum(axis=1))[:, None]
weight_mask = smooth(.999, .99999, tail_weight) * smooth(.38, .46, -before_positions[:, 2])
for vertex in np.flatnonzero(weight_mask > 0):
    w = np.zeros(30)
    np.add.at(w, ids[vertex], weights[vertex] * (1 - weight_mask[vertex]))
    w[7:12] += new_weights[vertex] * weight_mask[vertex]
    selected = np.argsort(w)[-4:][::-1]
    ids[vertex], weights[vertex] = selected, w[selected] / w[selected].sum()
# The free joints must not pull the collar sideways. Keep its existing body/tail
# blend, but let the root joint carry the attachment instead of the distal joints.
anchor = collar * (1 - smooth(.35, .45, -before_positions[:, 2]))
for vertex in np.flatnonzero(anchor > 0):
    w = np.zeros(30); np.add.at(w, ids[vertex], weights[vertex])
    moved = w[8:12].sum() * anchor[vertex]
    w[8:12] *= 1 - anchor[vertex]; w[7] += moved
    selected = np.argsort(w)[-4:][::-1]
    ids[vertex], weights[vertex] = selected, w[selected] / w[selected].sum()
replace(primitive['attributes']['JOINTS_0'], ids)
replace(primitive['attributes']['WEIGHTS_0'], weights)
assert np.max(np.abs(weights.sum(axis=1) - 1)) < 1e-6
surface_metrics = {'vertices': int(np.sum(move_mask > 0)), 'maxMove': float(np.max(np.linalg.norm(positions - before_positions, axis=1))),
                   'radiusProfile': radii.tolist(),
                   'method': 'Blender Taubin relaxation, continuous centre/radius profile and cubic four-joint weights'}
doc['nodes'][0]['extras']['tailSurfaceRefinement'] = surface_metrics
bpy.data.objects.remove(ob, do_unlink=True)

# Pose-specific additive layers centre the curved plume around the body's midline.
# Rotate about world up, expressed in each posed joint's local coordinates.
doc['animations'] = [a for a in doc['animations'] if not a['name'].startswith('TailSway')]
times = np.linspace(0, 7.2, 217)
time_index = len(doc['accessors'])
doc['accessors'].append({'bufferView': 0, 'componentType': 5126, 'count': 0, 'type': 'SCALAR', 'min': [0], 'max': [7.2]})
replace(time_index, times)
tip_vertices = used[(positions[used, 2] < -.59) & (tail_weight[used] > .99999)]
assert len(tip_vertices) > 50
tail_specs = {}
def load_tail_base(state, amount=1):
    rig.animation_data_clear()
    pose('Sit', 0)
    if state == 'Idle':
        return
    animation = next(a for a in doc['animations'] if a['name'] == state)
    for channel in animation['channels']:
        node, path = channel['target']['node'], channel['target']['path']
        if node not in range(1, 31):
            continue
        values = read(animation['samplers'][channel['sampler']]['output'])
        value = values[0 if state == 'Walk' else round((len(values)-1)*amount)]
        if path == 'rotation':
            q = Quaternion((value[3], *value[:3]))
            bone(node).rotation_quaternion = (B @ q.to_matrix().to_4x4() @ BI).to_quaternion()
        elif path == 'translation':
            bone(node).location = B.to_3x3() @ (Vector(value) - (rests[node] - rests.get(parents[node], Vector())))
    bpy.context.view_layer.update()


pose_collar = root_region * smooth(.02, .12, tail_weight)
pose_collar_max = 0.
for state, amount, key in [('Sit', 1, 0), ('Lie', 1, 1), ('Sit', .5, 2), ('Lie', .5, 3)]:
    load_tail_base(state, amount)
    qr, tr = deformation({i: global_matrix(i) for i in range(1, 31)})
    target = primitive['targets'][key]
    old_delta, old_normal = read(target['POSITION']), read(target['NORMAL'])
    posed = rotate(qr, positions + old_delta) + tr
    mesh = bpy.data.meshes.new(f'{state}_CollarFinish')
    mesh.from_pydata((posed[representatives] @ np.array(B.to_3x3()).T).tolist(), [], weld_faces.tolist())
    ob = bpy.data.objects.new(mesh.name, mesh); bpy.context.collection.objects.link(ob)
    collar_sculpt = Sculptor(ob, symmetry_x=False)
    mask = pose_collar[representatives]
    collar_sculpt.mask = 1 - mask
    collar_sculpt.edges = collar_sculpt.edges[np.any(mask[collar_sculpt.edges] > 0, axis=1)]
    collar_sculpt.smooth(strength=.5, iterations=400, preserve_volume=True)
    if state == 'Lie':
        # The old lie corrective inflated this collar to compensate for the
        # uneven source tube. Relax that excess after rebuilding the surface.
        collar_sculpt.smooth(strength=.4, iterations=30, preserve_volume=False)
    finished = collar_sculpt.co @ np.array(BI.to_3x3()).T
    delta = np.zeros_like(positions)
    delta[used] = finished[weld[used]] - posed[used]
    length = np.linalg.norm(delta, axis=1)
    delta *= (.0045 * np.tanh(length / .010) / np.maximum(1e-8, length))[:,None]
    pose_collar_max = max(pose_collar_max, float(np.max(np.linalg.norm(delta, axis=1))))
    inverse = qr.copy(); inverse[:, :3] *= -1
    new_delta = old_delta.copy(); selected = pose_collar > 0
    new_delta[selected] += rotate(inverse, delta)[selected]
    finished_normals = np.zeros_like(normals)
    finished_normals[used] = (collar_sculpt.vn @ np.array(BI.to_3x3()).T)[weld[used]]
    local_normals = rotate(inverse, finished_normals)
    new_normal = old_normal.copy()
    new_normal[selected] += ((local_normals - normals - old_normal) * pose_collar[:,None] * .45)[selected]
    replace(target['POSITION'], new_delta); replace(target['NORMAL'], new_normal)
    bpy.data.objects.remove(ob, do_unlink=True)
surface_metrics['poseCollarMaxMove'] = pose_collar_max

bias_shares = (0, .15, .40, .45, 0)
for state, amplitude in [('Idle', 1.), ('Walk', .9), ('Sit', .9), ('Lie', .85)]:
    load_tail_base(state)
    matrices = {i: global_matrix(i) for i in range(1, 31)}
    axes = [matrices[i].to_quaternion().inverted() @ Vector((0, 1, 0)) for i in range(16, 21)]
    base_rotations = [bone(i).rotation_quaternion.copy() for i in range(16, 21)]
    # Keep the sacral attachment centred. Uncurl the plume over the free joints,
    # instead of yawing the whole attachment by roughly fifty degrees.
    lo, hi = 0., 2.4
    for _ in range(24):
        bias = (lo + hi) * .5
        for j in range(5):
            delta = B @ Quaternion(axes[j], bias * bias_shares[j]).to_matrix().to_4x4() @ BI
            bone(16 + j).rotation_quaternion = base_rotations[j] @ delta.to_quaternion()
        bpy.context.view_layer.update()
        qr, tr = deformation({i: global_matrix(i) for i in range(1, 31)})
        tip = Vector(np.mean((rotate(qr, positions) + tr)[tip_vertices], axis=0))
        if tip.x > matrices[16].translation.x:
            lo = bias
        else:
            hi = bias
    strengths = np.array((.020, .045, .16, .18, .15)) * amplitude
    tail_specs[state] = (bias, strengths, axes)
    clip_name = 'TailSway' + (state if state != 'Idle' else '')
    tail_animation = {'name': clip_name, 'channels': [], 'samplers': []}
    for j, strength in enumerate(strengths):
        i, values = 16 + j, []
        for time in times:
            phase = (time - j * .30) / 7.2 * math.tau
            angle = bias * bias_shares[j] + strength * (.90 * math.sin(phase) + .10 * math.sin(2 * phase))
            q = Quaternion(axes[j], angle)
            bone(i).rotation_quaternion = (B @ q.to_matrix().to_4x4() @ BI).to_quaternion()
            bone(i).keyframe_insert(data_path='rotation_quaternion', frame=1 + time * 30)
            values.append([q.x, q.y, q.z, q.w])
        index = len(doc['accessors'])
        doc['accessors'].append({'bufferView': 0, 'componentType': 5126, 'count': 0, 'type': 'VEC4'})
        replace(index, values)
        tail_animation['channels'].append({'sampler': j, 'target': {'node': i, 'path': 'rotation'}})
        tail_animation['samplers'].append({'input': time_index, 'output': index, 'interpolation': 'LINEAR'})
    rig.animation_data.action.name = clip_name
    doc['animations'].append(tail_animation)

# Review both extremes with the same additive composition as the browser.
rig.animation_data_clear()
for state in ('Sit', 'Lie'):
    for phase_time in (1.8, 5.4):
        load_tail_base(state)
        bias, strengths, axes = tail_specs[state]
        for j, strength in enumerate(strengths):
            phase = (phase_time - j * .30) / 7.2 * math.tau
            angle = bias * bias_shares[j] + strength * (.90 * math.sin(phase) + .10 * math.sin(2 * phase))
            delta = B @ Quaternion(axes[j], angle).to_matrix().to_4x4() @ BI
            bone(16 + j).rotation_quaternion = bone(16 + j).rotation_quaternion @ delta.to_quaternion()
        bpy.context.view_layer.update()
        qr, tr = deformation({i: global_matrix(i) for i in range(1, 31)})
        correction = read(primitive['targets'][0 if state == 'Sit' else 1]['POSITION'])
        coords = (rotate(qr, positions + correction) + tr)[representatives] @ np.array(B.to_3x3()).T
        mesh = bpy.data.meshes.new(f'{state}_tail_{phase_time}')
        mesh.from_pydata(coords.tolist(), [], weld_faces.tolist()); mesh.shade_smooth()
        ob = bpy.data.objects.new(mesh.name, mesh); bpy.context.collection.objects.link(ob)
        snapshots[mesh.name] = ob

# Compact buffer views so old replaced data do not increase the download size.
views = set(a['bufferView'] for a in doc['accessors']) | set(i['bufferView'] for i in doc['images'])
compact = bytearray()
for i in sorted(views):
    view = doc['bufferViews'][i]
    data = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
    compact.extend(b'\0' * ((-len(compact)) % 4))
    view['byteOffset'] = len(compact)
    compact.extend(data)
# Unreferenced views must still point to a valid buffer interval.
for i, view in enumerate(doc['bufferViews']):
    if i not in views:
        view['byteOffset'], view['byteLength'] = 0, 4
doc['buffers'] = [{'byteLength': len(compact)}]
j = json.dumps(doc, separators=(',', ':')).encode()
j += b' ' * ((-len(j)) % 4)
compact.extend(b'\0' * ((-len(compact)) % 4))
OUTPUT.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(j) + len(compact)) + struct.pack('<II', len(j), 0x4e4f534a) + j + struct.pack('<II', len(compact), 0x004e4942) + compact)

for name, ob in snapshots.items():
    review([ob], str(REVIEW / name.lower()), views=('front', 'right', 'threequarter', 'back'), modes=('matcap',), res=540)
    ob.hide_render = True
    ob.hide_set(True)
bpy.data.objects.remove(rig, do_unlink=True)
# Discard temporary authoring actions so imported clip names stay unambiguous.
for action in list(bpy.data.actions):
    if action.users == 0 and action.name.startswith('TailSway'):
        bpy.data.actions.remove(action)
bpy.ops.import_scene.gltf(filepath=str(OUTPUT))
for ob in bpy.context.scene.objects:
    for modifier in ob.modifiers:
        if modifier.type == 'ARMATURE':
            modifier.use_deform_preserve_volume = True
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT.with_suffix('.blend')))
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
report = {'blender': bpy.app.version_string, 'sourceSha256': source_hash, 'sourceUnchanged': True,
          'output': OUTPUT.name, 'bytes': OUTPUT.stat().st_size, 'maxReachError': max_reach_error, 'poses': metrics,
          'tailSurface': surface_metrics,
          'tailSway': {state: {'centreYaw': spec[0], 'centreShares': bias_shares, 'amplitudes': spec[1].tolist()} for state, spec in tail_specs.items()}}
OUTPUT.with_name(OUTPUT.stem + '-build.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
