# Shared helpers for the Blender build scripts (run headless, see tools/build_models.sh).
# Models are authored in the game's convention (three.js: Y up, +Z forward) and converted to
# Blender's (Z up) on build, so the glTF export lands back exactly in game coordinates.
import math
import os
import random

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def lin(hex_color, a=1.0):
    """sRGB hex -> linear RGBA (what Blender colour attributes and glTF COLOR_0 store)."""
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (ch((hex_color >> 16) & 255), ch((hex_color >> 8) & 255), ch(hex_color & 255), a)


def to_blender(v):
    """three.js (x, y, z) -> Blender (x, -z, y)."""
    return Vector((v[0], -v[2], v[1]))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups next to the outputs


# ---------- Primitives (built in three.js space) ----------
def _torus(bm, R, r, arc, ts, rs):
    rings = []
    closed = abs(arc - math.tau) < 1e-6
    steps = ts if closed else ts + 1
    for i in range(steps):
        u = arc * i / ts
        ring = []
        for j in range(rs):
            v = math.tau * j / rs
            ring.append(bm.verts.new(((R + r * math.cos(v)) * math.cos(u), (R + r * math.cos(v)) * math.sin(u), r * math.sin(v))))
        rings.append(ring)
    for i in range(ts):
        a, b = rings[i], rings[(i + 1) % steps]
        for j in range(rs):
            bm.faces.new((a[j], b[j], b[(j + 1) % rs], a[(j + 1) % rs]))


def _lathe(bm, pts, n):
    rings = [[bm.verts.new((x * math.sin(math.tau * k / n), y, x * math.cos(math.tau * k / n))) for k in range(n)] for x, y in pts]
    for a, b in zip(rings, rings[1:]):
        for k in range(n):
            q = (a[k], a[(k + 1) % n], b[(k + 1) % n], b[k])
            if len({v.co.to_tuple(5) for v in q}) >= 3:
                bm.faces.new(q)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)


def prim(kind, *a, p=(0, 0, 0), r=(0, 0, 0), s=(1, 1, 1), bevel=0.0, seg=1, sub=0, rough=0.0, freq=1.5, seed=0, pre=None, yaw_last=False):
    """One primitive as a bmesh, in three.js space: scale, bevel/subdivide/roughen, rotate, move.
    kinds: box(w,h,d) cyl(rt,rb,h,n) cone(r,h,n) ball(r,detail) torus(R,r,arc,ts) lathe(pts,n)."""
    bm = bmesh.new()
    if kind == 'box':
        bmesh.ops.create_cube(bm, size=1.0)
        s = (s[0] * a[0], s[1] * a[1], s[2] * a[2])
    elif kind in ('cyl', 'cone'):
        rt, rb, h, n = (0, a[0], a[1], a[2] if len(a) > 2 else 8) if kind == 'cone' else (a[0], a[1], a[2], a[3] if len(a) > 3 else 8)
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=n, radius1=rb, radius2=max(rt, 1e-4), depth=h,
                              matrix=Matrix.Rotation(-math.pi / 2, 4, 'X'))
    elif kind == 'ball':
        bmesh.ops.create_icosphere(bm, subdivisions=a[1] if len(a) > 1 else 1, radius=a[0])
    elif kind == 'torus':
        _torus(bm, a[0], a[1], a[2] if len(a) > 2 else math.tau, a[3] if len(a) > 3 else 12, 5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    elif kind == 'lathe':
        _lathe(bm, a[0], a[1] if len(a) > 1 else 10)
    if pre:
        bmesh.ops.transform(bm, matrix=pre, verts=bm.verts)
    bmesh.ops.scale(bm, vec=Vector(s), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)
    if sub:
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=sub, use_grid_fill=True)
    if rough:
        bm.normal_update()
        off = Vector((seed * 7.1, seed * 3.3, seed * 5.7))
        for v in bm.verts:
            v.co += v.normal * noise.noise(v.co * freq + off) * rough
    # 'ZYX' here == three.js 'XYZ'; yaw_last tilts first, then turns (three.js 'YXZ').
    R = Euler(r, 'ZXY' if yaw_last else 'ZYX').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(p)) @ R, verts=bm.verts)
    return bm


class Model:
    """Collects coloured primitives into one mesh. swing/pivot feed the game's walk shader;
    bone tags a part for rigid skinning (bosses)."""

    def __init__(self, name, seed=1):
        self.name = name
        self.V, self.F, self.C, self.SW, self.SM, self.BONE = [], [], [], [], [], []
        self.rng = random.Random(seed)

    def add(self, bm, color, swing=0.0, pivot=0.0, jitter=0.06, smooth=False, bone=None, colors=None):
        base = len(self.V)
        bm.verts.index_update()
        for v in bm.verts:
            self.V.append(to_blender(v.co))
            self.SW.append((swing, pivot))
            self.BONE.append(bone)
        for f in bm.faces:
            self.F.append([base + v.index for v in f.verts])
            c = lin(colors(f) if colors else color)
            k = 1 + (self.rng.random() - 0.5) * jitter * 2
            self.C.append((min(1, c[0] * k), min(1, c[1] * k), min(1, c[2] * k), 1.0))
            self.SM.append(smooth)
        bm.free()
        return self

    def part(self, kind, *a, color=0xffffff, swing=0.0, pivot=0.0, jitter=0.06, smooth=False, bone=None, **kw):
        return self.add(prim(kind, *a, **kw), color, swing, pivot, jitter, smooth, bone)

    def build(self, collection=None, light=False):
        """light: shade faces by height (lit from above, darker underneath): reads as volume on small items."""
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([tuple(v) for v in self.V], [], self.F)
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        loop_cols = []
        zs = [v.z for v in self.V]
        z0, z1 = min(zs), max(zs)
        for poly, c in zip(me.polygons, self.C):
            if light and z1 > z0:
                t = (sum(self.V[i].z for i in self.F[poly.index]) / len(self.F[poly.index]) - z0) / (z1 - z0)
                k = 0.74 + 0.36 * t
                c = (min(1, c[0] * k), min(1, c[1] * k), min(1, c[2] * k), 1.0)
            loop_cols.extend(c * poly.loop_total)
        col.data.foreach_set('color', loop_cols)
        me.color_attributes.active_color = col
        me.color_attributes.render_color_index = 0
        me.polygons.foreach_set('use_smooth', self.SM)
        for k, name in enumerate(('_swx', '_swy')):
            att = me.attributes.new(name, 'FLOAT', 'POINT')
            att.data.foreach_set('value', [sw[k] for sw in self.SW])
        me.validate()
        ob = bpy.data.objects.new(self.name, me)
        (collection or bpy.context.scene.collection).objects.link(ob)
        return ob


def export_glb(path, objects, animations=False, draco=False, textured=False, sampled=False):
    """sampled: bake eased (bezier) keys into dense keys, since glTF only plays linear ones smoothly."""
    for ob in bpy.context.scene.objects:
        ob.select_set(ob in objects)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True,
        export_apply=True, export_vertex_color='ACTIVE', export_attributes=True,
        export_normals=True, export_texcoords=textured, export_materials='EXPORT' if textured else 'NONE',
        export_skins=animations, export_animations=animations, export_animation_mode='ACTIONS',
        export_force_sampling=sampled, export_frame_step=2, export_optimize_animation_size=True,
        export_draco_mesh_compression_enable=draco, export_draco_mesh_compression_level=7,
    )
    print('wrote', os.path.relpath(path, ROOT), f'{os.path.getsize(path) / 1024:.0f} KB')


# ---------- Rigs ----------
def make_armature(name, bones):
    """bones: list of (name, parent, head, tail) in three.js space. Roll is set so every bone's
    local X is world +X: rotating about X swings limbs forward/back (see pose())."""
    arm = bpy.data.armatures.new(name)
    ob = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    for bname, parent, head, tail in bones:
        eb = arm.edit_bones.new(bname)
        eb.head, eb.tail = to_blender(head), to_blender(tail)
        down = eb.tail.z < eb.head.z
        eb.align_roll(Vector((0, 1, 0)) if down else Vector((0, -1, 0)))
        if parent:
            eb.parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def skin(mesh_ob, arm_ob, weights):
    """weights: per vertex dict {bone: w}."""
    for bone in arm_ob.data.bones:
        mesh_ob.vertex_groups.new(name=bone.name)
    for i, wd in enumerate(weights):
        for bone, w in wd.items():
            if w > 0:
                mesh_ob.vertex_groups[bone].add([i], w, 'REPLACE')
    mod = mesh_ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm_ob
    mesh_ob.parent = arm_ob


def actions(arm_ob, clips, fps=30):
    """clips: {name: [(frame, {bone: degrees_about_X or (x, y, z) degrees}, {bone: (dx, dy, dz) location})]}.
    Positive X rotation: legs/arms (pointing down) swing BACK, spine/head (pointing up) lean FORWARD."""
    bpy.context.scene.render.fps = fps
    arm_ob.animation_data_create()
    for pb in arm_ob.pose.bones:
        pb.rotation_mode = 'XYZ'
    for name, keys in clips.items():
        act = bpy.data.actions.new(f'{arm_ob.name}|{name}')  # unique per rig; the game keeps what follows '|'
        act.use_fake_user = True
        arm_ob.animation_data.action = act
        # Only the bones this clip moves get keys, so clips can be layered in the game
        # (an attack moves the arm while the walk keeps the legs going).
        used = set()
        for _, rots, *locs in keys:
            used |= set(rots) | set(locs[0] if locs else {})
        for frame, rots, *locs in keys:
            for pb in arm_ob.pose.bones:
                if pb.name not in used:
                    continue
                rot = rots.get(pb.name, 0)
                rot = rot if isinstance(rot, tuple) else (rot, 0, 0)
                pb.rotation_euler = [math.radians(x) for x in rot]
                loc = (locs[0] if locs else {}).get(pb.name, (0, 0, 0))
                pb.location = loc
                pb.keyframe_insert('rotation_euler', frame=frame)
                pb.keyframe_insert('location', frame=frame)
    arm_ob.animation_data.action = None
    for pb in arm_ob.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
