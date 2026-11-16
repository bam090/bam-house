"""Create an editable reference-face copy and inspect the source actions for the web."""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'public/models/characters/skater-cat'
SOURCE = FOLDER / 'cat.blend'
original_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE), use_scripts=False)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
rig = bpy.data.objects['Armature']
cat = bpy.data.objects['Cat']
original_eyes = [bpy.data.objects['Sphere'], bpy.data.objects['Sphere.001']]
for obj in [cat, *original_eyes]:
    for modifier in obj.modifiers:
        if modifier.type == 'PARTICLE_SYSTEM':
            modifier.show_viewport = False
            modifier.show_render = False
    for particle in obj.particle_systems:
        particle.use_hair_dynamics = False
rig.data.pose_position = 'REST'
scene.frame_set(0)
bpy.context.view_layer.update()

def smooth(a, b, x):
    t = min(1, max(0, (x-a)/(b-a)))
    return t*t*(3-2*t)

def srgb(color):
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in color)

def material(name, color, roughness=.9, vertex_colors=False, sheen=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*srgb(color), 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Sheen Weight'].default_value = sheen
    p.inputs['Sheen Roughness'].default_value = .8
    if vertex_colors:
        attr = m.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'CoatColor'
        m.node_tree.links.new(attr.outputs['Color'], p.inputs['Base Color'])
    return m

coat = material('White soft coat', (.95,.947,.93), sheen=.65)
eye_material = material('Blue grey iris and pupil', (1,1,1), .24, True)
p = eye_material.node_tree.nodes.get('Principled BSDF')
p.inputs['Coat Weight'].default_value = .45
p.inputs['Coat Roughness'].default_value = .14
cat.data.materials.clear(); cat.data.materials.append(coat)
for polygon in cat.data.polygons: polygon.material_index = 0; polygon.use_smooth = True
for obj in original_eyes:
    obj.data.materials.clear(); obj.data.materials.append(material('Original eye proxy', (.28,.42,.33), .3))
    for polygon in obj.data.polygons: polygon.material_index = 0

# Apply subdivision in the rest pose; the existing armature groups are interpolated.
for obj in [cat]:
    bpy.context.view_layer.objects.active = obj
    if obj.data.shape_keys:
        assert len(obj.data.shape_keys.key_blocks) == 1, 'Preserve any authored shape keys'
        obj.shape_key_clear()
    for modifier in list(obj.modifiers):
        if modifier.type == 'SUBSURF':
            modifier.levels = 2
            bpy.ops.object.modifier_apply(modifier=modifier.name)

# Use the same normalization for both exports and for the reference-face edit.
points = [cat.matrix_world @ v.co for v in cat.data.vertices]
low = Vector(tuple(min(v[i] for v in points) for i in range(3)))
high = Vector(tuple(max(v[i] for v in points) for i in range(3)))
height = high.z-low.z
center_y = (low.y+high.y)/2

def web(p): return Vector((p.x/height, (p.z-low.z)/height, -(p.y-center_y)/height))
def native(p): return Vector((p.x*height, center_y-p.z*height, low.z+p.y*height))

def export(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [rig, *objects]: obj.hide_set(False); obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    rig.data.pose_position = 'POSE'
    rig.animation_data.action = bpy.data.actions['Walk']
    scene.frame_set(0)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
        export_bake_animation=True, export_frame_range=False, export_frame_step=1,
        export_anim_slide_to_zero=True, export_def_bones=True, export_rest_position_armature=True,
        export_extras=True, export_morph=False, export_apply=False)

# Retain an exact sampled baseline, including legacy constraint behavior.
export(FOLDER/'cat-source-motion.glb', [cat, *original_eyes])
rig.data.pose_position = 'REST'; scene.frame_set(0); bpy.context.view_layer.update()

# Measurements from front / side / top references: rounder eyes, shorter muzzle,
# less angular cheeks, a small triangular nose, and softly pink inner ears.
positions = [web(v.co) for v in cat.data.vertices]
colors = []
for vertex, p in zip(cat.data.vertices, positions):
    base = p.copy()
    for side in [-1, 1]:
        dx, dy = base.x-side*.041, base.y-.640
        radius = math.sqrt((dx/.060)**2+(dy/.058)**2)
        w = (1-smooth(.3, 1.2, radius))*smooth(.34,.39,base.z)
        p.x += (side*.010 + dx*.22)*w
        p.y += (.010+dy*.72)*w
        # Set the globe into a broader socket rather than placing it on the skin.
        p.z += .002*w
    muzzle = smooth(.38,.47,base.z)*(1-smooth(.605,.635,base.y))
    p.z -= .028*muzzle
    jaw=smooth(.36,.41,base.z)*(1-smooth(.557,.574,base.y))
    closed_y=.60+(p.y-.60)*math.cos(.18)+(p.z-.35)*math.sin(.18)
    p.y += (closed_y-p.y)*jaw
    p.x *= 1-.13*muzzle
    cheek = math.exp(-((abs(base.x)-.075)/.035)**2-((base.y-.605)/.042)**2)*smooth(.33,.4,base.z)
    p.x += (1 if p.x>=0 else -1)*.005*cheek
    vertex.co = native(p)
    ear = smooth(.70,.75,base.y)*smooth(.27,.33,base.z)
    # Inner face of each ear only; preserve the white silhouette and rim.
    normal = vertex.normal
    pink = ear*smooth(.25,.8,-normal.y)*(1-smooth(.115,.135,abs(base.x)))*.8
    shade = .95+.009*math.sin(base.x*80+base.y*35)*math.sin(base.z*60)
    colors.append(srgb((shade,shade-.16*pink,shade-.12*pink)))

# Locally relax the sharp source lip crease after changing the muzzle proportion.
adjacency = [set() for _ in cat.data.vertices]
for edge in cat.data.edges:
    a,b=edge.vertices; adjacency[a].add(b);adjacency[b].add(a)
for _ in range(90):
    points=[v.co.copy() for v in cat.data.vertices]
    for i, v in enumerate(cat.data.vertices):
        p=web(points[i]); w=smooth(.36,.42,p.z)*smooth(.51,.54,p.y)*(1-smooth(.575,.600,p.y))
        if w>0 and adjacency[i]:
            average=sum((points[j] for j in adjacency[i]),Vector())/len(adjacency[i])
            v.co=points[i].lerp(average,.5*w)
attr=cat.data.color_attributes.new(name='CoatColor',type='FLOAT_COLOR',domain='POINT')
for c,value in zip(attr.data,colors):c.color=(*value,1)
soft_coat=material('Reference white coat', (1,1,1), .94, True, .65)
cat.data.materials[0]=soft_coat
cat.data.update()

# Original eyes carry weights from the nose and ear groups. The new globes follow
# Head only so facial proportions stay stable during both source actions.
for obj in original_eyes: bpy.data.objects.remove(obj,do_unlink=True)
new_objects=[]
for side in [-1,1]:
    center=Vector((side*.051,.650,.414))
    outward=Vector((side*.22,.065,1)).normalized()
    native_out=Vector((outward.x,-outward.z,outward.y))
    rotation=Vector((0,0,1)).rotation_difference(native_out)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96,ring_count=64,radius=.023*height,location=native(center))
    eye=bpy.context.object;eye.name=f'Angora_eye_{"L" if side>0 else "R"}'
    for vertex in eye.data.vertices:
        vertex.co=rotation@vertex.co
    color_attr=eye.data.color_attributes.new(name='CoatColor',type='FLOAT_COLOR',domain='POINT')
    for vertex, data in zip(eye.data.vertices,color_attr.data):
        local=(rotation.inverted()@vertex.co).normalized(); r=math.hypot(local.x,local.y); angle=math.atan2(local.y,local.x)
        color=Vector((.78,.80,.78))
        if local.z>0:
            grain=.035*math.sin(angle*57+r*40)+.015*math.sin(angle*103)
            color=Vector((.49+grain,.60+grain,.65+grain))
            color=color.lerp(Vector((.25,.32,.35)),smooth(.64,.71,r)*(1-smooth(.71,.77,r)))
            color=color.lerp(Vector((.78,.80,.78)),smooth(.72,.80,r))
            color=color.lerp(Vector((.025,.043,.05)),1-smooth(.44,.48,math.hypot(local.x/.96,local.y)))
        data.color=(*srgb(color),1)
    eye.data.materials.append(eye_material)
    for polygon in eye.data.polygons:polygon.use_smooth=True
    # Apply location so skinning shares the source armature's coordinate space.
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    eye.parent=rig
    group=eye.vertex_groups.new(name='Head');group.add(list(range(len(eye.data.vertices))),1,'REPLACE')
    modifier=eye.modifiers.new('Source Head binding','ARMATURE');modifier.object=rig
    new_objects.append(eye)

# Paint the existing nose surface instead of attaching a pink bead.
for vertex,data in zip(cat.data.vertices,cat.data.color_attributes['CoatColor'].data):
    p=web(vertex.co)
    nose_y=.592
    ny=(p.y-nose_y)/.0075
    half_width=.013*(.78+.22*max(-1,min(1,ny)))
    mask=(1-smooth(.7,1,abs(p.x)/half_width))*(1-smooth(.65,1,abs(ny)))*smooth(.438,.451,p.z)
    if mask:
        current=Vector(data.color[:3]); tint=Vector(srgb((.78,.57,.57)))
        data.color=(*current.lerp(tint,mask),1)

rig['source_credit']='JonasDichelle, Rigged and animated Cat, CC BY 3.0'
rig['source_actions']='Walk: 1–28; run: 1–15; 24 fps'
rig['reference_face']='docs/cat-reference/white-turkish-angora-{front,side,top}.png'
rig['web_hair_note']='Source hair settings retained in cat.blend; individual strands omitted from the web preview by request.'
rig.data.pose_position='POSE';rig.animation_data.action=bpy.data.actions['Walk'];scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(FOLDER/'cat-angora-reference.blend'))
export(FOLDER/'cat-angora-reference.glb',[cat,*new_objects])
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==original_hash
print('REFERENCE_EXPORT_DONE',json.dumps({'height':height,'min_z':low.z,'center_y':center_y,'source_hash':original_hash,'working_vertices':len(cat.data.vertices),'eye_vertices':[len(o.data.vertices) for o in new_objects]}))
