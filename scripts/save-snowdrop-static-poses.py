"""Save the two reviewed static meshes without adding animation or replacing the player."""
from pathlib import Path
import bpy

folder = Path(__file__).resolve().parent.parent / 'public/models/characters/snowdrop'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for name, offset in [('sit', 0), ('lie', 1.4)]:
    bpy.ops.import_scene.gltf(filepath=str(folder / f'snowdrop-{name}-static.glb'))
    meshes = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
    assert len(meshes) == 1
    obj = meshes[0]
    obj.name = '앉기_정지_검토본' if name == 'sit' else '눕기_정지_검토본'
    obj.location.x += offset
    assert obj.animation_data is None
    obj['용도'] = '레퍼런스 자세 검토. 동작 연결 전의 정지 메시.'
assert not bpy.data.actions
bpy.context.scene['검토 범위'] = '앉기·눕기 정지 자세. 플레이어 GLB와 기존 Blender 파일은 보존.'
bpy.ops.wm.save_as_mainfile(filepath=str(folder / 'snowdrop-static-poses.blend'))
print('STATIC_POSES_SAVED', [(obj.name, len(obj.data.vertices)) for obj in bpy.data.objects if obj.type == 'MESH'])
