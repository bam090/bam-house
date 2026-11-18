"""Blender에서 꼬리 끝 색상·반사율 경계를 제거하고 기존 리그·표면을 보존한다."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import tempfile

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'public/models/characters/snowdrop'
SOURCE = FOLDER / 'snowdrop-tail-smooth.glb'
OUTPUT = FOLDER / 'snowdrop-tail-clean.glb'
REVIEW = ROOT / 'docs/cat-reference/tail-tip-review'
sys.path.append(str(Path.home() / '.codex/skills/blender-texturing-shading/scripts'))
import bx_materials as M


def smooth(a, b, value):
    t = np.clip((value - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def linked_image(socket):
    node = socket.links[0].from_node
    if node.type == 'TEX_IMAGE':
        return node.image
    return linked_image(next(s for s in node.inputs if s.is_linked))


assert bpy.app.version >= (5, 2, 0)
raw = SOURCE.read_bytes()
source_hash = hashlib.sha256(raw).hexdigest()
json_length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + json_length])
binary = bytearray(raw[28 + json_length:])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
coat = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
material = coat.data.materials[0]
bsdf = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
color = bsdf.inputs['Base Color'].links[0].from_node.image
orm = linked_image(bsdf.inputs['Roughness'])
before = M.pixels(color)
texels = M.TexelMap(coat, color.size[0])
position = texels.pos
# Blender uses Z up: positive Y is the cat's rear. This region contains only
# the plume end, and fades before the next tail joint.
mask = smooth(.04, .12, position[..., 0]) * smooth(.43, .51, position[..., 1]) * texels.valid
ys, xs = np.nonzero(mask > 0)
print(json.dumps({'tipTexels': len(xs), 'bounds': [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
                  'colorQuantiles': np.quantile(before[mask > .99, :3], [0, .01, .1, .5, .9, 1], axis=0).tolist()}), flush=True)

# The ring also has a broad painted shadow. Restore the surrounding white fur
# tone and retain subtle high-frequency detail. The original normal map keeps
# the fur's relief, while the roughness repair removes its painted ring.
after = before.copy()
core = mask > .999
tone = np.median(before[core, :3], axis=0)
for channel in range(3):
    detail = before[..., channel] - M.gaussian_blur(before[..., channel], 2)
    target = tone[channel] + np.clip(detail, -.012, .012) * .4
    after[..., channel] += (target - before[..., channel]) * mask
# Bleed the correction into unused UV padding, without touching another island.
delta = after - before
delta = M.dilate(delta, texels.valid, 8)
after = np.clip(before + delta, 0, 1)
changed = np.any(np.round(after * 255) != np.round(before * 255), axis=2)
assert np.count_nonzero(changed & texels.valid & (mask == 0)) == 0
M.write_pixels(color, after)
orm_before = M.pixels(orm)
orm_after = orm_before.copy()
roughness = float(np.median(orm_before[core, 1]))
detail = orm_before[..., 1] - M.gaussian_blur(orm_before[..., 1], 2)
orm_after[..., 1] += (roughness + np.clip(detail, -.012, .012) * .4 - orm_before[..., 1]) * mask
orm_after[..., 2] *= 1 - mask
orm_after = np.clip(orm_before + M.dilate(orm_after - orm_before, texels.valid, 8), 0, 1)
orm_changed = np.any(np.round(orm_after * 255) != np.round(orm_before * 255), axis=2)
assert np.count_nonzero(orm_changed & texels.valid & (mask == 0)) == 0
M.write_pixels(orm, orm_after)
print(json.dumps({'roughness': roughness, 'ormQuantiles': np.quantile(orm_before[core, :3], [0, .01, .5, .99, 1], axis=0).tolist()}), flush=True)
REVIEW.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='snowdrop-tip-') as folder:
    path = str(Path(folder) / 'tail-color.png')
    M.save_image(color, path)
    reloaded = bpy.data.images.load(path, check_existing=False)
    saved = M.pixels(reloaded)
    assert np.array_equal(np.round(saved[~changed] * 255), np.round(before[~changed] * 255)), '꼬리 밖 텍스처 변경'
    contrast_before = float(np.ptp(np.quantile(before[core, :3].mean(axis=1), [.001, .999])))
    contrast_after = float(np.ptp(np.quantile(saved[core, :3].mean(axis=1), [.001, .999])))
    assert contrast_before > .07, '기존 꼬리 끝의 색상 경계가 재현되지 않음'
    assert contrast_after < .025, '꼬리 끝에 그려진 음영 경계가 남음'
    painted = Path(path).read_bytes()
    color.pack()
    bpy.data.images.remove(reloaded)
    orm_path = str(Path(folder) / 'tail-orm.png')
    M.save_image(orm, orm_path)
    reloaded = bpy.data.images.load(orm_path, check_existing=False)
    reloaded.colorspace_settings.name = 'Non-Color'
    orm_saved = M.pixels(reloaded)
    assert np.array_equal(np.round(orm_saved[~orm_changed] * 255), np.round(orm_before[~orm_changed] * 255)), '꼬리 밖 재질 맵 변경'
    assert float(orm_before[core, 2].max()) > .05, '기존 꼬리 끝의 금속성 오류가 재현되지 않음'
    assert float(orm_saved[core, 2].max()) <= 1 / 255, '흰 털 끝에 금속성 값이 남음'
    assert float(np.ptp(np.quantile(orm_saved[core, 1], [.001, .999]))) < .025, '꼬리 끝의 거칠기 경계가 남음'
    orm_painted = Path(orm_path).read_bytes()
    orm.pack()
    bpy.data.images.remove(reloaded)
image_id = doc['textures'][doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
view_id = doc['images'][image_id]['bufferView']
binary.extend(b'\0' * ((-len(binary)) % 4))
doc['bufferViews'][view_id]['byteOffset'] = len(binary)
doc['bufferViews'][view_id]['byteLength'] = len(painted)
doc['images'][image_id]['mimeType'] = 'image/png'
binary.extend(painted)
orm_image_id = doc['textures'][doc['materials'][0]['pbrMetallicRoughness']['metallicRoughnessTexture']['index']]['source']
view_id = doc['images'][orm_image_id]['bufferView']
binary.extend(b'\0' * ((-len(binary)) % 4))
doc['bufferViews'][view_id]['byteOffset'] = len(binary)
doc['bufferViews'][view_id]['byteLength'] = len(orm_painted)
doc['images'][orm_image_id]['mimeType'] = 'image/png'
binary.extend(orm_painted)
views = set(a['bufferView'] for a in doc['accessors']) | set(i['bufferView'] for i in doc['images'])
compact = bytearray()
for i in sorted(views):
    v = doc['bufferViews'][i]
    data = binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    compact.extend(b'\0' * ((-len(compact)) % 4)); v['byteOffset'] = len(compact); compact.extend(data)
for i, v in enumerate(doc['bufferViews']):
    if i not in views: v['byteOffset'], v['byteLength'] = 0, 4
doc['buffers'] = [{'byteLength': len(compact)}]
j = json.dumps(doc, separators=(',', ':')).encode(); j += b' ' * ((-len(j)) % 4)
compact.extend(b'\0' * ((-len(compact)) % 4))
OUTPUT.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(j) + len(compact)) + struct.pack('<II', len(j), 0x4e4f534a) + j + struct.pack('<II', len(compact), 0x004e4942) + compact)

for ob in bpy.context.scene.objects:
    for modifier in ob.modifiers:
        if modifier.type == 'ARMATURE': modifier.use_deform_preserve_volume = True
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT.with_suffix('.blend')))
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
report = {'source': SOURCE.name, 'sourceSha256': source_hash, 'sourceUnchanged': True,
          'output': OUTPUT.name, 'blender': bpy.app.version_string,
          'changedTexels': int(changed.sum()), 'changedOutsideTail': 0,
          'changedOrmTexels': int(orm_changed.sum()), 'roughness': roughness,
          'tipColorContrastBefore': contrast_before, 'tipColorContrastAfter': contrast_after,
          'method': 'Blender UV-space colour and roughness/metalness healing; geometry, normals, skin, clips and normal map unchanged'}
OUTPUT.with_name(OUTPUT.stem + '-build.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report), flush=True)
