"""Save the exported web rig as an editable Blender copy without opening the originals."""
from pathlib import Path
import bpy

folder = Path(__file__).resolve().parents[1] / 'public/models/characters/snowdrop'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene.render.fps = 24
bpy.ops.import_scene.gltf(filepath=str(folder / 'snowdrop-interactions.glb'))
rigs = [o for o in bpy.data.objects if o.type == 'ARMATURE']
assert len(rigs) == 1 and len(rigs[0].data.bones) == 28
for action in bpy.data.actions:
    action.use_fake_user = True
assert len(bpy.data.actions) == 4
rig = rigs[0]
rig.data.pose_position = 'REST'
rig.show_in_front = True
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
rig['preview_note'] = 'REST for appearance review. Set Pose Position to Pose to inspect Walk, Sit, Jump, EarFlick actions.'
bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'snowdrop-interactions.blend'))
print('SNOWDROP_BLEND_SAVED', len(rig.data.bones), [a.name for a in bpy.data.actions])
