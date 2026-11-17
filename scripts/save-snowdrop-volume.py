from pathlib import Path
import bpy
folder = Path(__file__).resolve().parent.parent / 'public/models/characters/snowdrop'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.import_scene.gltf(filepath=str(folder / 'snowdrop-volume.glb'))
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
assert len(meshes) == 1
assert len(meshes[0].data.vertices) == 37416
armatures = [m for m in meshes[0].modifiers if m.type == 'ARMATURE']
assert len(armatures) == 1
armatures[0].use_deform_preserve_volume = True
assert len(armatures[0].object.data.bones) == 30
bpy.context.scene['변형 방식'] = 'Dual quaternion. 웹 미리보기의 공통 리그와 동일한 뼈·가중치·클립.'
bpy.context.scene['검토 상태'] = '엉덩이·다리 표면 수정본. 기본 Snowdrop 플레이어와 동일한 리그.'
bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'snowdrop-volume.blend'))
print('SAVED_VOLUME_RIG', len(armatures[0].object.data.bones), [a.name for a in bpy.data.actions])
