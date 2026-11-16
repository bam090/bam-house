"""Read the supplied Blender source without enabling embedded Python scripts."""
import bpy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/models/characters/skater-cat/cat.blend'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE), use_scripts=False)

def animation_info(obj):
    data = obj.animation_data
    if not data:
        return None
    return {
        'active_action': data.action.name if data.action else None,
        'nla_tracks': [{'name': track.name, 'mute': track.mute, 'strips': [{'name': s.name, 'action': s.action.name if s.action else None, 'start': s.frame_start, 'end': s.frame_end, 'action_start': s.action_frame_start, 'action_end': s.action_frame_end, 'repeat': s.repeat, 'scale': s.scale} for s in track.strips]} for track in data.nla_tracks],
        'drivers': [d.data_path for d in data.drivers],
    }

objects = []
for obj in bpy.data.objects:
    item = {'name': obj.name, 'type': obj.type, 'parent': obj.parent.name if obj.parent else None, 'dimensions': list(obj.dimensions), 'matrix_world': [list(row) for row in obj.matrix_world], 'animation': animation_info(obj), 'modifiers': [{'name': m.name, 'type': m.type, 'object': getattr(getattr(m, 'object', None), 'name', None), 'viewport': m.show_viewport, 'render': m.show_render} for m in obj.modifiers]}
    if obj.type == 'MESH':
        item.update(vertices=len(obj.data.vertices), polygons=len(obj.data.polygons), groups=[g.name for g in obj.vertex_groups], shape_keys=[k.name for k in obj.data.shape_keys.key_blocks] if obj.data.shape_keys else [], materials=[s.material.name if s.material else None for s in obj.material_slots])
    if obj.type == 'ARMATURE':
        item['bones'] = [{'name': b.name, 'parent': b.parent.name if b.parent else None, 'head': list(b.head_local), 'tail': list(b.tail_local), 'deform': b.use_deform} for b in obj.data.bones]
        item['constraints'] = [{'bone': p.name, 'constraints': [{'name': c.name, 'type': c.type, 'target': getattr(getattr(c, 'target', None), 'name', None), 'subtarget': getattr(c, 'subtarget', None), 'influence': c.influence} for c in p.constraints]} for p in obj.pose.bones if p.constraints]
    item['hair'] = [{'name': p.name, 'type': p.settings.type, 'count': p.settings.count, 'length': p.settings.hair_length, 'children': p.settings.child_type, 'child_percent': p.settings.child_percent, 'render_children': p.settings.rendered_child_count, 'dynamic': p.use_hair_dynamics, 'material': p.settings.material, 'density_group': p.vertex_group_density, 'length_group': p.vertex_group_length} for p in obj.particle_systems]
    objects.append(item)

actions = []
for action in bpy.data.actions:
    curves = list(action.fcurves)
    paths = sorted(set(f.data_path for f in curves))
    actions.append({'name': action.name, 'frame_range': list(action.frame_range), 'curves': len(curves), 'keyframes': sum(len(f.keyframe_points) for f in curves), 'paths': paths, 'users': action.users, 'fake_user': action.use_fake_user})

result = {'source': str(SOURCE.relative_to(ROOT)), 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'blender_version': bpy.app.version_string, 'fps': bpy.context.scene.render.fps, 'fps_base': bpy.context.scene.render.fps_base, 'scene_frame_range': [bpy.context.scene.frame_start, bpy.context.scene.frame_end], 'objects': objects, 'actions': actions, 'images': [{'name': i.name, 'path': i.filepath, 'packed': bool(i.packed_file), 'size': list(i.size)} for i in bpy.data.images]}
output = ROOT / 'docs/skater-cat-blend-inspection.json'
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('SKATER_INSPECTION', json.dumps({'objects': [(o['name'], o['type'], o.get('vertices'), len(o.get('bones', []))) for o in objects], 'actions': [{k: a[k] for k in ('name', 'frame_range', 'curves', 'keyframes')} for a in actions], 'fps': result['fps'], 'hair': [(o['name'], o['hair']) for o in objects if o['hair']], 'report': str(output)}, ensure_ascii=False))
