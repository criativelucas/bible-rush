# Heroes in 3D, sculpted from smooth shapes (ellipsoids, capsules, lofted rings and open cloak shells)
# with the silhouettes and colours of their sprite sheets (assets/heroes), but no texture: smooth
# shading, a soft top-lit gradient on every part, a skeleton with elbows plus a cloak or hair bone
# for follow-through, and eased clips. Parts are authored for a figure 1 unit tall (three.js axes:
# Y up, +Z forward, +X = the hero's left) and scaled to each hero's height.
# Output: assets/models/heroes/<id>.glb and assets/blender/heroes.blend. Run with tools/build_models.sh.
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
from lib import ROOT, actions, export_glb, lin, make_armature, prim, reset, skin, to_blender  # noqa: E402

PI = math.pi
V = lambda *a: Vector(a)
# Stylised proportions, like the reference art: a bigger head (scaled about the neck), big hands and feet.
HEAD, HAND, FOOT = 1.3, 1.38, 1.3
NECK = V(0, 0.83, 0)
PIX = 44  # pixel cells per unit of height for the painted mosaic (about 4 cm on a hero)


def phash(x, y, z):
    """0..1 from a cell: the same everywhere on a part, so the mosaic stays put when the hero moves."""
    h = (int(x) * 73856093) ^ (int(y) * 19349663) ^ (int(z) * 83492791)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0


def ss(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ---------- Shapes (return a bmesh in unit space) ----------
def ellipsoid(c, r, rot=(0, 0, 0), seg=14, rings=9):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    m = Matrix.Translation(V(*c)) @ Euler(rot, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((*r, 1))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return bm


def _rings_to_mesh(rings, apex0, apex1):
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, b in zip(vs, vs[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    for ring, apex in ((vs[0], apex0), (vs[-1], apex1)):
        c = bm.verts.new(apex)
        for i in range(n):
            bm.faces.new((ring[i], ring[(i + 1) % n], c))
    return bm


def loft(rings, seg=16, folds=0.0, nf=8):
    """Body of revolution-ish: rings (y, cx, cz, rx, rz) from bottom to top, closed at both ends.
    folds: cloth ripples around the hem, fading out toward the top."""
    ya, yb = rings[0][0], rings[-1][0]
    fold = lambda y, t: 1 + folds * math.sin(nf * t) * (1 - (y - ya) / (yb - ya))
    pts = [[V(cx + rx * fold(y, t) * math.cos(t), y, cz + rz * fold(y, t) * math.sin(t)) for t in (2 * PI * q / seg for q in range(seg))]
           for y, cx, cz, rx, rz in rings]
    (y0, x0, z0, rx0, rz0), (y1, x1, z1, rx1, rz1) = rings[0], rings[-1]
    return _rings_to_mesh(pts, V(x0, y0 - 0.2 * min(rx0, rz0), z0), V(x1, y1 + 0.2 * min(rx1, rz1), z1))


def capsule(a, b, ra, rb, seg=12):
    """Tapered tube from a to b with rounded ends (limbs, locks of hair, staffs)."""
    a, b = V(*a), V(*b)
    d = b - a
    L = d.length
    d.normalize()
    u = d.cross(V(0, 0, 1))
    u = (u if u.length > 1e-3 else d.cross(V(1, 0, 0))).normalized()
    w = d.cross(u)
    prof = [(-0.72 * ra, 0.7 * ra), (-0.35 * ra, 0.94 * ra), (0, ra), (L * 0.5, (ra + rb) / 2), (L, rb), (L + 0.35 * rb, 0.94 * rb), (L + 0.72 * rb, 0.7 * rb)]
    pts = [[a + d * s + (u * math.cos(2 * PI * q / seg) + w * math.sin(2 * PI * q / seg)) * r for q in range(seg)] for s, r in prof]
    return _rings_to_mesh(pts, a - d * ra, b + d * rb)


def shell(rings, gap, thick, seg=24, folds=0.0, nf=7):
    """Cloak: rings (y, cx, cz, rx, rz) around the back, open over `gap` radians each side of the front.
    Returns the bmesh and the set of inner-surface vertex indices (shaded darker)."""
    bm = bmesh.new()
    a0, a1 = PI / 2 + gap, PI / 2 + 2 * PI - gap
    out, inn = [], []
    ya, yb = rings[0][0], rings[-1][0]
    for y, cx, cz, rx, rz in rings:
        angs = [a0 + (a1 - a0) * j / seg for j in range(seg + 1)]
        f = [1 + folds * math.sin(nf * t) * (1 - (y - ya) / (yb - ya)) for t in angs]  # deeper folds at the hem
        out.append([bm.verts.new((cx + rx * k * math.cos(t), y, cz + rz * k * math.sin(t))) for t, k in zip(angs, f)])
        inn.append([bm.verts.new((cx + (rx * k - thick) * math.cos(t), y, cz + (rz * k - thick) * math.sin(t))) for t, k in zip(angs, f)])
    for k in range(len(rings) - 1):
        for j in range(seg):
            bm.faces.new((out[k][j], out[k][j + 1], out[k + 1][j + 1], out[k + 1][j]))
            bm.faces.new((inn[k][j + 1], inn[k][j], inn[k + 1][j], inn[k + 1][j + 1]))
        for j in (0, seg):  # the two front edges
            bm.faces.new((out[k][j], out[k + 1][j], inn[k + 1][j], inn[k][j]))
    for k in (0, len(rings) - 1):  # collar and hem
        for j in range(seg):
            bm.faces.new((out[k][j], inn[k][j], inn[k][j + 1], out[k][j + 1]))
    bm.verts.index_update()
    return bm, {v.index for ring in inn for v in ring}


def belt(y, rx, rz, r, cz=0.0, cx=0.0):
    return prim('torus', rx, r, 2 * PI, 24, p=(cx, y, cz), r=(PI / 2, 0, 0), s=(1, rz / rx, 1))


# ---------- The model: parts with colours and weights ----------
class Sculpt:
    def __init__(self, name, h):
        self.name, self.h = name, h
        self.V, self.F, self.FC, self.W, self.SM = [], [], [], [], []

    def add(self, shape, color, bone, smooth=True, shade=0.28, inner=None):
        """bone: name, or a function of the unit-space position -> {bone: weight}. Painted like pixel art:
        each face gets one flat colour, the part's light in three bands (darker at its bottom), and a
        fixed mosaic of slightly lighter and darker cells; a shell's inner surface is darker still.
        Head and hair parts are scaled up about the neck (stylised proportions)."""
        bm, inner = shape if isinstance(shape, tuple) else (shape, inner or set())
        if bone == 'head' or bone is locks:
            bmesh.ops.transform(bm, matrix=Matrix.Translation(NECK) @ Matrix.Scale(HEAD, 4) @ Matrix.Translation(-NECK), verts=bm.verts)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.verts.index_update()
        ys = [v.co.y for v in bm.verts]
        y0, y1 = min(ys), max(ys)
        c = lin(color)
        base = len(self.V)
        for v in bm.verts:
            self.V.append(to_blender(v.co * self.h))
            self.W.append(bone(v.co) if callable(bone) else {bone: 1.0})
        for f in bm.faces:
            ctr = f.calc_center_median()
            t = (ctr.y - y0) / (y1 - y0) if y1 > y0 else 1.0
            band = min(2, int(t * 3)) / 2  # 0, 0.5, 1: hard light bands
            cell = phash(math.floor(ctr.x * PIX), math.floor(ctr.y * PIX), math.floor(ctr.z * PIX))
            mosaic = 0.82 if cell < 0.24 else 1.12 if cell > 0.8 else 1.0
            inside = 0.62 if any(v.index in inner for v in f.verts) else 1.0
            k = (1 - shade + shade * band) * mosaic * inside
            col = (min(1, c[0] * k), min(1, c[1] * k), min(1, c[2] * k), 1.0)
            self.F.append([base + v.index for v in f.verts])
            self.FC.append([col] * len(f.verts))
            self.SM.append(smooth)
        bm.free()

    def build(self):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([tuple(v) for v in self.V], [], self.F)
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        flat = []
        for poly, cols in zip(me.polygons, self.FC):
            for c in cols[:poly.loop_total]:
                flat.extend(c)
        col.data.foreach_set('color', flat)
        me.color_attributes.active_color = col
        me.polygons.foreach_set('use_smooth', self.SM)
        me.validate()
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


# ---------- Weights ----------
def torso(p):
    t = ss(0.62, 0.72, p.y)
    return {'chest': t, 'spine': 1 - t}


def skirt(p, follow=0.85):
    """Cloth below the hips sways with the legs, more toward the hem."""
    if p.y >= 0.5:
        return torso(p)
    leg = ss(0.5, 0.22, p.y) * follow
    left = ss(-0.05, 0.05, p.x)
    return {'spine': 1 - leg, 'thigh.L': leg * left, 'thigh.R': leg * (1 - left)}


def cape(p):
    t = ss(0.76, 0.42, p.y)
    return {'cape': t, 'chest': 1 - t}


def locks(p):
    t = ss(0.86, 0.66, p.y)
    return {'hair': t, 'head': 1 - t}


# ---------- Shared anatomy ----------
def head(s, c, hair_cap=True):
    """Head, jaw, ears, nose, eyes and brows. c: skin, eye, brow (+ hair for the cap)."""
    s.add(ellipsoid((0, 0.912, 0.006), (0.061, 0.074, 0.066)), c['skin'], 'head')
    s.add(ellipsoid((0, 0.876, 0.02), (0.049, 0.04, 0.05)), c['skin'], 'head')
    s.add(ellipsoid((0, 0.902, 0.071), (0.011, 0.018, 0.013)), c['skin'], 'head', shade=0.35)
    for x in (-1, 1):
        s.add(ellipsoid((0.06 * x, 0.906, -0.002), (0.011, 0.02, 0.012)), c['skin'], 'head', shade=0.35)
        s.add(ellipsoid((0.024 * x, 0.922, 0.059), (0.013, 0.0095, 0.007), seg=10, rings=6), 0xf6f2ea, 'head', shade=0)
        s.add(ellipsoid((0.024 * x, 0.922, 0.0645), (0.0068, 0.0078, 0.0035), seg=10, rings=6), c['eye'], 'head', shade=0)
        s.add(ellipsoid((0.025 * x, 0.9395, 0.064), (0.017, c.get('brow_h', 0.0045), 0.007), rot=(0, 0, -0.18 * x), seg=10, rings=6), c['brow'], 'head', shade=0)
    s.add(capsule((0, 0.795, -0.004), (0, 0.86, 0.004), c.get('neck', 0.035), c.get('neck', 0.035) * 0.95), c['skin'], 'head')
    if hair_cap:
        s.add(ellipsoid((0, 0.938, -0.012), (0.069, 0.066, 0.072)), c['hair'], 'head')


def arms(s, c, sx, upper=(0.034, 0.03), fore=(0.03, 0.024), bent_right=None):
    """Upper arm, forearm and hand per side. bent_right: (elbow, wrist) for a right arm held up."""
    for x in (-1, 1):
        side = 'L' if x > 0 else 'R'
        sh = V(sx * x, 0.786, 0)
        el = V((sx + 0.012) * x, 0.625, -0.004)
        wr = V((sx + 0.02) * x, 0.478, 0.012)
        if x < 0 and bent_right:
            el, wr = V(*bent_right[0]), V(*bent_right[1])
        s.add(capsule(sh, el, *upper), c.get('arm', c['skin']), f'upperarm.{side}')
        s.add(capsule(el, wr, *fore), c.get('fore', c['skin']), f'forearm.{side}')
        d = (wr - el).normalized()
        hand = wr + d * 0.036
        s.add(ellipsoid(hand, (0.021 * HAND, 0.033 * HAND, 0.026 * HAND), rot=(0, 0, 0)), c['skin'], f'forearm.{side}')
        s.add(ellipsoid(hand + V(-0.015 * x, 0.014, 0.022), (0.009 * HAND, 0.016 * HAND, 0.009 * HAND)), c['skin'], f'forearm.{side}')
    return {'sh': sx}


def legs(s, c, lx, thigh=(0.05, 0.04), shin=(0.038, 0.028)):
    for x in (-1, 1):
        side = 'L' if x > 0 else 'R'
        hip, knee, ank = V(lx * x, 0.49, 0), V(lx * x, 0.27, 0.006), V(lx * x, 0.055, 0)
        s.add(capsule(hip, knee, *thigh), c['thigh'], f'thigh.{side}')
        s.add(capsule(knee, ank, *shin), c['shin'], f'shin.{side}')
        s.add(ellipsoid((lx * x, 0.028, 0.034), (0.031 * FOOT, 0.022 * FOOT, 0.058 * FOOT)), c['foot'], f'shin.{side}')
        for k in range(3):  # toes, as on the reference art
            s.add(ellipsoid((lx * x + (k - 1) * 0.016, 0.016, 0.098), (0.009, 0.009, 0.011), seg=8, rings=5), c['foot'], f'shin.{side}', shade=0.3)


# ---------- The three heroes ----------
def davi():
    s = Sculpt('davi', 1.75)
    skin_, hair, hair2 = 0xe0a47a, 0x6b3a1f, 0x8a4f2a
    cream, khaki, red, leather = 0xece0bf, 0xb3a07a, 0xc2412e, 0x7a4a24
    head(s, dict(skin=skin_, eye=0x4f6f8a, brow=hair, hair=hair))
    # Curly hair: little balls over the cap, off the face.
    k = 0
    for el in (0.35, 0.75, 1.15):
        n = 10 if el < 1 else 5
        for j in range(n):
            az = -PI * 0.95 + 1.9 * PI * j / max(1, n - 1) if el < 1 else 2 * PI * j / n
            if el < 0.5 and abs(math.sin(az / 2)) > 0.86:
                continue  # leave the forehead clear
            x = math.sin(az) * math.cos(el) * 0.068
            z = -math.cos(az) * math.cos(el) * 0.072 - 0.012
            y = 0.94 + math.sin(el) * 0.06
            s.add(ellipsoid((x, y, z), (0.031, 0.029, 0.031), seg=10, rings=7), hair if k % 2 else hair2, 'head')
            k += 1
    for x in (-1, 1):
        s.add(ellipsoid((0.058 * x, 0.9, -0.025), (0.022, 0.045, 0.034)), hair, 'head')
    s.add(ellipsoid((0, 0.862, 0.032), (0.058, 0.036, 0.044)), 0x5e3320, 'head')  # short full beard
    for x in (-1, 1):
        s.add(ellipsoid((0.045 * x, 0.88, 0.03), (0.02, 0.03, 0.03)), 0x5e3320, 'head')  # sideburns into the beard
    s.add(ellipsoid((0, 0.887, 0.068), (0.026, 0.007, 0.01)), 0x5e3320, 'head', shade=0)
    # Tunic, belt, sleeves, neckline.
    s.add(loft([(0.38, 0, 0.004, 0.122, 0.097), (0.46, 0, 0, 0.11, 0.082), (0.53, 0, 0, 0.1, 0.073), (0.62, 0, 0, 0.101, 0.071),
                (0.7, 0, 0, 0.113, 0.073), (0.77, 0, -0.003, 0.126, 0.07), (0.805, 0, -0.005, 0.1, 0.06), (0.826, 0, -0.005, 0.048, 0.044)], folds=0.05),
          cream, skirt)
    s.add(belt(0.53, 0.103, 0.075, 0.013), leather, 'spine')
    s.add(prim('box', 0.03, 0.026, 0.012, p=(0, 0.53, 0.078), bevel=0.003), 0xc08a3e, 'spine', smooth=False)
    arms(s, dict(skin=skin_), 0.135)
    for x in (-1, 1):
        s.add(capsule((0.136 * x, 0.778, 0), (0.142 * x, 0.69, -0.002), 0.04, 0.039), cream, f'upperarm.{"L" if x > 0 else "R"}')
    legs(s, dict(thigh=khaki, shin=skin_, foot=skin_), 0.058, thigh=(0.052, 0.042), shin=(0.03, 0.024))
    for x in (-1, 1):  # three-quarter trousers over the shins
        s.add(capsule((0.058 * x, 0.29, 0.004), (0.058 * x, 0.15, 0.003), 0.042, 0.038), khaki, f'shin.{"L" if x > 0 else "R"}')
    # V neck of the tunic.
    for x in (-1, 1):
        s.add(capsule((0.028 * x, 0.805, 0.064), (0, 0.745, 0.082), 0.005, 0.004, seg=6), 0x8a6a3e, 'chest')
    # Long sleeveless coat, red-orange, open at the front down to the knees, a dark trim on its edges.
    rings = [(0.3, 0, -0.008, 0.152, 0.118), (0.42, 0, -0.008, 0.142, 0.106), (0.55, 0, -0.006, 0.13, 0.094),
             (0.66, 0, -0.004, 0.13, 0.09), (0.75, 0, -0.004, 0.142, 0.088), (0.8, 0, -0.006, 0.142, 0.08), (0.822, 0, -0.008, 0.11, 0.07)]
    gap = 0.55
    s.add(shell(rings, gap=gap, thick=0.012, folds=0.05), red, cape)
    for j, a in enumerate((PI / 2 + gap, PI / 2 + 2 * PI - gap)):
        for r0, r1 in zip(rings, rings[1:]):
            e0 = (r0[1] + r0[3] * math.cos(a), r0[0], r0[2] + r0[4] * math.sin(a))
            e1 = (r1[1] + r1[3] * math.cos(a), r1[0], r1[2] + r1[4] * math.sin(a))
            s.add(capsule(e0, e1, 0.007, 0.007, seg=6), 0x6b1f1a, cape)
    s.add(shell([(0.3, 0, -0.008, 0.154, 0.12), (0.318, 0, -0.008, 0.153, 0.119)], gap=gap, thick=0.014), 0x8e2a1e, cape)  # hem
    # Sling in the right hand, shepherd's bag on the left hip.
    for dx in (-0.006, 0.006):
        s.add(capsule((-0.155 + dx, 0.44, 0.02), (-0.15 + dx, 0.3, 0.03), 0.0045, 0.0045, seg=6), leather, 'forearm.R')
    s.add(ellipsoid((-0.15, 0.29, 0.03), (0.018, 0.012, 0.022)), leather, 'forearm.R')
    s.add(capsule((-0.1, 0.785, 0.06), (0.115, 0.5, 0.075), 0.008, 0.008, seg=6), leather, torso)
    s.add(ellipsoid((0.125, 0.47, 0.05), (0.04, 0.05, 0.03)), 0x8a6a3e, 'spine')
    return s


def sansao():
    s = Sculpt('sansao', 1.95)
    skin_, hair, wrap, cream, leather = 0xc98a5a, 0x1f1a1c, 0x6b4426, 0xece4c8, 0x5a3a22
    head(s, dict(skin=skin_, eye=0x2a1a12, brow=hair, hair=hair, brow_h=0.006, neck=0.042))
    s.add(ellipsoid((0, 0.885, -0.05), (0.08, 0.1, 0.06)), hair, locks)
    s.add(ellipsoid((0, 0.955, -0.01), (0.078, 0.06, 0.08)), hair, 'head')  # volume on top
    for k in range(13):  # long wavy locks down the back and over the shoulders, curling at the ends
        a = -PI * 0.85 + 1.7 * PI * k / 12
        x0, z0 = math.sin(a) * 0.064, -math.cos(a) * 0.058 - 0.02
        xm, zm = math.sin(a) * 0.1, -math.cos(a) * 0.082 - 0.035
        x1, z1 = math.sin(a) * 0.11, -math.cos(a) * 0.08 - 0.03 + (0.04 if abs(math.sin(a)) > 0.9 else 0)
        y1 = 0.62 + 0.04 * (k % 3)
        s.add(capsule((x0, 0.93, z0), (xm, 0.78, zm), 0.028, 0.022, seg=8), hair if k % 2 else 0x2a2226, locks)
        s.add(capsule((xm, 0.78, zm), (x1, y1, z1), 0.022, 0.013, seg=8), hair if k % 2 else 0x2a2226, locks)
        s.add(ellipsoid((x1 + 0.012 * math.sin(a), y1 - 0.01, z1), (0.016, 0.014, 0.016), seg=8, rings=5), hair, locks)
    s.add(ellipsoid((0, 0.862, 0.04), (0.058, 0.046, 0.045)), hair, 'head')  # full beard
    s.add(ellipsoid((0, 0.888, 0.068), (0.03, 0.008, 0.01)), hair, 'head', shade=0)
    # Bare, broad torso: chest, pecs, abs, shoulders.
    s.add(loft([(0.5, 0, 0, 0.11, 0.076), (0.58, 0, 0, 0.111, 0.076), (0.65, 0, 0.003, 0.127, 0.081), (0.72, 0, 0.005, 0.147, 0.086),
                (0.77, 0, 0, 0.162, 0.081), (0.803, 0, -0.005, 0.12, 0.066), (0.828, 0, -0.005, 0.055, 0.05)]), skin_, torso)
    for x in (-1, 1):
        s.add(ellipsoid((0.056 * x, 0.735, 0.058), (0.062, 0.042, 0.036)), skin_, torso)
        for k, y in enumerate((0.67, 0.625, 0.58)):
            s.add(ellipsoid((0.026 * x, y, 0.072 - k * 0.002), (0.022, 0.018, 0.012), seg=10, rings=6), skin_, 'spine', shade=0.3)
        s.add(ellipsoid((0.165 * x, 0.772, 0), (0.052, 0.046, 0.052)), skin_, f'upperarm.{"L" if x > 0 else "R"}')
    arms(s, dict(skin=skin_), 0.165, upper=(0.045, 0.04), fore=(0.04, 0.03))
    for x in (-1, 1):  # leather wraps on the forearms
        side = 'L' if x > 0 else 'R'
        s.add(capsule((0.18 * x, 0.6, 0.0), (0.185 * x, 0.5, 0.01), 0.036, 0.032), wrap, f'forearm.{side}')
        for y in (0.58, 0.54, 0.51):
            s.add(belt(y, 0.036, 0.036, 0.006, cz=0.006 if y < 0.55 else 0.003, cx=(0.18 + (0.6 - y) * 0.05) * x), leather, f'forearm.{side}')
    # Wide belt, wrapped skirt and its front flap.
    s.add(belt(0.548, 0.116, 0.08, 0.02), leather, 'spine')
    s.add(belt(0.522, 0.12, 0.085, 0.01), wrap, 'spine')
    s.add(loft([(0.3, 0, 0.012, 0.152, 0.113), (0.34, 0, 0.01, 0.15, 0.11), (0.42, 0, 0.005, 0.14, 0.1), (0.5, 0, 0, 0.125, 0.09), (0.56, 0, 0, 0.115, 0.08)],
               folds=0.06, nf=9), cream, skirt)
    s.add(ellipsoid((0.0, 0.43, 0.105), (0.038, 0.1, 0.012)), 0x6b4426, skirt)  # the sash's hanging flap
    s.add(ellipsoid((0.0, 0.33, 0.112), (0.034, 0.03, 0.01)), 0x5a3a22, skirt)
    legs(s, dict(thigh=skin_, shin=wrap, foot=skin_), 0.07, thigh=(0.06, 0.047), shin=(0.045, 0.034))
    for x in (-1, 1):
        side = 'L' if x > 0 else 'R'
        for y in (0.22, 0.16, 0.1):
            s.add(belt(y, 0.042 - (0.22 - y) * 0.06, 0.042 - (0.22 - y) * 0.06, 0.006, cz=0.004, cx=0.07 * x), leather, f'shin.{side}')
        s.add(prim('box', 0.07, 0.014, 0.13, p=(0.07 * x, 0.007, 0.03), bevel=0.006), leather, f'shin.{side}', smooth=False)
    # The jawbone of a donkey (Jz 15:15), held in the right hand.
    s.add(capsule((-0.19, 0.47, 0.035), (-0.17, 0.3, 0.2), 0.03, 0.026), 0xefe6c8, 'forearm.R')
    s.add(capsule((-0.19, 0.47, 0.035), (-0.205, 0.56, -0.02), 0.026, 0.034), 0xefe6c8, 'forearm.R')
    s.add(ellipsoid((-0.172, 0.31, 0.19), (0.036, 0.03, 0.04)), 0xe2d6b0, 'forearm.R')  # the jaw's heavy end
    for k in range(5):
        t = 0.25 + k * 0.15
        s.add(ellipsoid((-0.19 + 0.02 * t + 0.012, 0.47 - 0.17 * t, 0.035 + 0.165 * t + 0.01), (0.009, 0.012, 0.009), seg=8, rings=5), 0xfffaf0, 'forearm.R')
    return s


def moises():
    s = Sculpt('moises', 1.9)
    skin_, white, white2, robe, orange, orange2, wood = 0xd99a72, 0xeceef2, 0xc9ccd6, 0xb9a27a, 0xd8642a, 0xa84520, 0x7a4a26
    head(s, dict(skin=skin_, eye=0x2a1a12, brow=white, hair=white, brow_h=0.008))
    s.add(ellipsoid((0, 0.945, -0.02), (0.074, 0.064, 0.074)), white, 'head')  # fuller crown
    s.add(ellipsoid((0, 0.885, -0.045), (0.074, 0.095, 0.052)), white, 'head')  # long white hair behind
    for x in (-1, 1):
        s.add(capsule((0.058 * x, 0.94, -0.02), (0.07 * x, 0.83, -0.03), 0.03, 0.022), white2, 'head')
    s.add(loft([(0.69, 0, 0.082, 0.014, 0.012), (0.72, 0, 0.08, 0.036, 0.026), (0.78, 0, 0.076, 0.056, 0.036),
                (0.84, 0, 0.066, 0.064, 0.042), (0.885, 0, 0.05, 0.058, 0.04)]), white, 'head')  # beard to the chest
    s.add(ellipsoid((0, 0.887, 0.07), (0.034, 0.01, 0.012)), white2, 'head', shade=0)
    # Robe to the ankles, rope belt, sash, mantle.
    s.add(loft([(0.06, 0, 0.006, 0.152, 0.122), (0.2, 0, 0, 0.142, 0.112), (0.4, 0, 0, 0.126, 0.092), (0.55, 0, 0, 0.116, 0.081),
                (0.66, 0, 0, 0.121, 0.081), (0.75, 0, -0.005, 0.136, 0.079), (0.8, 0, -0.008, 0.112, 0.066), (0.826, 0, -0.008, 0.054, 0.05)],
               folds=0.06, nf=9), robe, lambda p: skirt(p, 0.6))
    s.add(belt(0.55, 0.118, 0.083, 0.009), 0xd9c08a, 'spine')
    s.add(capsule((-0.105, 0.54, 0.072), (0.118, 0.79, 0.048), 0.02, 0.022), orange, torso)
    s.add(shell([(0.3, 0, -0.03, 0.152, 0.11), (0.5, 0, -0.025, 0.142, 0.1), (0.66, 0, -0.018, 0.142, 0.093),
                  (0.76, 0, -0.012, 0.15, 0.09), (0.81, 0, -0.01, 0.124, 0.074)], gap=0.95, thick=0.014, folds=0.07), orange, cape)
    s.add(shell([(0.27, 0, -0.035, 0.156, 0.114), (0.31, 0, -0.033, 0.154, 0.112)], gap=0.95, thick=0.016), orange2, cape)
    # Wide sleeves; the right arm is bent, hand up holding the staff.
    bent = ((-0.163, 0.64, 0.01), (-0.172, 0.632, 0.128))
    arms(s, dict(skin=skin_, arm=robe, fore=robe), 0.14, upper=(0.042, 0.045), fore=(0.046, 0.054), bent_right=bent)
    for x in (-1, 1):
        s.add(ellipsoid((0.06 * x, 0.026, 0.056), (0.03 * FOOT, 0.02 * FOOT, 0.05 * FOOT)), skin_, f'shin.{"L" if x > 0 else "R"}')
    # Staff with a carved knob, vertical through the right hand.
    s.add(capsule((-0.175, 0.0, 0.163), (-0.175, 1.0, 0.163), 0.013, 0.012, seg=8), wood, 'forearm.R')
    for k, (dx, dy, dz, r) in enumerate(((0, 1.03, 0, 0.034), (0.02, 1.05, 0.01, 0.024), (-0.018, 1.055, -0.006, 0.022), (0, 1.07, 0.012, 0.02))):
        s.add(ellipsoid((-0.175 + dx, dy, 0.163 + dz), (r, r * 1.1, r)), 0x8a5a32 if k % 2 else wood, 'forearm.R')
    return s


def josue():
    """Joshua: general of Israel. Bronze helmet and scale vest, blue cloak, sword, a ram's horn (Js 6:20)."""
    s = Sculpt('josue', 1.8)
    skin_, hair, bronze, bronze2 = 0xc98d64, 0x3a2618, 0xb07a3a, 0x8a5a24
    cream, blue, leather = 0xe8dcc0, 0x3e5f99, 0x6b4426
    head(s, dict(skin=skin_, eye=0x2a1a12, brow=hair, hair=hair, brow_h=0.006, neck=0.038))
    s.add(ellipsoid((0, 0.958, -0.006), (0.074, 0.052, 0.078)), bronze, 'head')  # helmet
    s.add(belt(0.93, 0.072, 0.077, 0.008, cz=-0.004), bronze2, 'head')
    s.add(prim('box', 0.012, 0.05, 0.11, p=(0, 1.0, -0.01), bevel=0.004), 0xb8463a, 'head', smooth=False)  # crest
    s.add(ellipsoid((0, 0.866, 0.036), (0.056, 0.038, 0.042)), hair, 'head')  # beard
    s.add(ellipsoid((0, 0.888, 0.068), (0.027, 0.007, 0.01)), hair, 'head', shade=0)
    s.add(loft([(0.4, 0, 0.004, 0.122, 0.097), (0.47, 0, 0, 0.11, 0.082), (0.54, 0, 0, 0.102, 0.074), (0.64, 0, 0, 0.104, 0.072),
                (0.72, 0, 0, 0.116, 0.074), (0.78, 0, -0.003, 0.13, 0.072), (0.808, 0, -0.005, 0.1, 0.06), (0.828, 0, -0.005, 0.05, 0.046)], folds=0.05),
          cream, skirt)
    s.add(loft([(0.53, 0, 0, 0.112, 0.082), (0.62, 0, 0, 0.113, 0.081), (0.71, 0, 0.002, 0.125, 0.083), (0.775, 0, -0.002, 0.138, 0.08),
                (0.8, 0, -0.004, 0.11, 0.068)]), bronze, torso, shade=0.3)  # scale vest
    for x in (-1, 1):
        s.add(ellipsoid((0.14 * x, 0.778, 0), (0.05, 0.034, 0.055)), bronze2, f'upperarm.{"L" if x > 0 else "R"}')
    s.add(belt(0.535, 0.112, 0.083, 0.014), leather, 'spine')
    s.add(prim('box', 0.034, 0.03, 0.012, p=(0, 0.535, 0.086), bevel=0.003), 0xe8b84a, 'spine', smooth=False)
    arms(s, dict(skin=skin_), 0.14)
    for x in (-1, 1):  # leather bracers
        s.add(capsule((0.153 * x, 0.6, 0.0), (0.158 * x, 0.51, 0.008), 0.032, 0.029), leather, f'forearm.{"L" if x > 0 else "R"}')
    legs(s, dict(thigh=skin_, shin=leather, foot=skin_), 0.062, thigh=(0.05, 0.04), shin=(0.036, 0.028))
    s.add(shell([(0.3, 0, -0.045, 0.158, 0.118), (0.5, 0, -0.035, 0.152, 0.106), (0.68, 0, -0.022, 0.15, 0.096),
                  (0.78, 0, -0.014, 0.158, 0.092), (0.812, 0, -0.01, 0.13, 0.075)], gap=0.85, thick=0.012, folds=0.06), blue, cape)
    s.add(capsule((0.125, 0.5, 0.05), (0.165, 0.26, 0.09), 0.016, 0.013), leather, 'spine')  # sword in its scabbard
    s.add(capsule((0.115, 0.53, 0.045), (0.11, 0.6, 0.04), 0.009, 0.009), 0xe8b84a, 'spine')
    s.add(prim('box', 0.06, 0.012, 0.016, p=(0.118, 0.53, 0.046), bevel=0.003), 0xe8b84a, 'spine', smooth=False)
    pts = [(-0.162, 0.44, 0.03), (-0.158, 0.39, 0.1), (-0.145, 0.38, 0.17), (-0.13, 0.42, 0.235)]  # ram's horn in the right hand
    for k, (a, b) in enumerate(zip(pts, pts[1:])):
        s.add(capsule(a, b, 0.012 + k * 0.007, 0.019 + k * 0.009), 0xd9c49a if k % 2 else 0xb89a6a, 'forearm.R')
    return s


def debora():
    """Deborah: prophetess and judge (Jz 4-5). Headscarf, long purple dress, a bow and a quiver."""
    s = Sculpt('debora', 1.68)
    skin_, hair, teal, purple, gold, leather = 0xd9a07a, 0x2a1a14, 0x2e8a8a, 0x6a4a8a, 0xe8b84a, 0x6b4426
    head(s, dict(skin=skin_, eye=0x3a2a1a, brow=hair, hair=hair))
    s.add(ellipsoid((0, 0.872, 0.066), (0.014, 0.005, 0.006), seg=10, rings=6), 0xb8584a, 'head', shade=0)  # lips
    s.add(ellipsoid((0, 0.945, -0.022), (0.075, 0.068, 0.08)), teal, 'head')  # headscarf
    s.add(loft([(0.74, 0, -0.072, 0.09, 0.04), (0.82, 0, -0.06, 0.082, 0.05), (0.9, 0, -0.045, 0.076, 0.06)]), teal, locks)
    for k in range(4):  # braid down the back, over the scarf
        s.add(ellipsoid((0, 0.82 - k * 0.055, -0.1 - k * 0.004), (0.022 - k * 0.002, 0.03, 0.02)), hair, locks)
    s.add(loft([(0.05, 0, 0.006, 0.14, 0.112), (0.2, 0, 0, 0.13, 0.102), (0.4, 0, 0, 0.114, 0.084), (0.53, 0, 0, 0.098, 0.072),
                (0.64, 0, 0, 0.104, 0.074), (0.73, 0, 0, 0.118, 0.074), (0.79, 0, -0.004, 0.118, 0.066), (0.82, 0, -0.006, 0.052, 0.046)],
               folds=0.07, nf=9), purple, lambda p: skirt(p, 0.6))
    s.add(belt(0.56, 0.1, 0.074, 0.012), gold, 'spine')
    s.add(capsule((-0.04, 0.55, 0.075), (-0.06, 0.4, 0.09), 0.012, 0.009), gold, 'spine')  # sash end
    arms(s, dict(skin=skin_, arm=purple), 0.13, upper=(0.036, 0.034), fore=(0.028, 0.022))
    for x in (-1, 1):
        s.add(ellipsoid((0.056 * x, 0.026, 0.05), (0.028 * FOOT, 0.018 * FOOT, 0.048 * FOOT)), 0x8a5a32, f'shin.{"L" if x > 0 else "R"}')
    # Bow in the left hand: an arc bulging forward and its string.
    c = (0.172, 0.47, -0.04)
    R, span = 0.26, 0.62 * PI  # a shallow arc, centred forward
    a0 = PI - span / 2
    s.add(prim('torus', R, 0.011, span, 16, p=c, r=(0, PI / 2, a0)), 0x7a4a26, 'forearm.L')
    ey, ez = math.sin(a0) * R, -math.cos(a0) * R
    s.add(capsule((c[0], c[1] + ey, c[2] + ez), (c[0], c[1] - ey, c[2] + ez), 0.003, 0.003, seg=5), 0xf3e6c4, 'forearm.L')
    s.add(capsule((0.07, 0.8, -0.1), (-0.035, 0.56, -0.108), 0.03, 0.026), leather, 'chest')  # quiver
    for k in range(3):
        s.add(prim('box', 0.012, 0.05, 0.022, p=(0.07 + k * 0.016, 0.85, -0.098), r=(0, 0, -0.4), bevel=0.003), 0xf3e6c4, 'chest', smooth=False)
    return s


HEROES = {
    'davi': dict(make=davi, sx=0.135, lx=0.058, attack='sling'),
    'sansao': dict(make=sansao, sx=0.165, lx=0.07, attack='club', hair=True),
    'moises': dict(make=moises, sx=0.14, lx=0.06, attack='staff', staff=True, robe=True),
    'josue': dict(make=josue, sx=0.14, lx=0.062, attack='horn'),
    'debora': dict(make=debora, sx=0.13, lx=0.056, attack='bow', robe=True, hair=True),
}


# ---------- Skeleton and clips ----------
def skeleton(cfg, h):
    P = lambda *a: tuple(c * h for c in a)
    sx, lx = cfg['sx'], cfg['lx']
    b = [
        ('spine', None, P(0, 0.5, 0), P(0, 0.66, 0)),
        ('chest', 'spine', P(0, 0.66, 0), P(0, 0.82, 0)),
        ('head', 'chest', P(0, 0.83, 0), P(0, 1.0, 0)),
    ]
    for x in (-1, 1):
        side = 'L' if x > 0 else 'R'
        el, wr = P((sx + 0.012) * x, 0.625, -0.004), P((sx + 0.02) * x, 0.478, 0.012)
        if x < 0 and cfg.get('staff'):
            el, wr = P(-0.163, 0.64, 0.01), P(-0.172, 0.632, 0.128)
        b += [
            (f'upperarm.{side}', 'chest', P(sx * x, 0.786, 0), el),
            (f'forearm.{side}', f'upperarm.{side}', el, wr),
            (f'thigh.{side}', 'spine', P(lx * x, 0.49, 0), P(lx * x, 0.27, 0.006)),
            (f'shin.{side}', f'thigh.{side}', P(lx * x, 0.27, 0.006), P(lx * x, 0.055, 0)),
        ]
    if cfg.get('hair'):
        b.append(('hair', 'head', P(0, 0.9, -0.07), P(0, 0.66, -0.09)))
    else:
        b.append(('cape', 'chest', P(0, 0.79, -0.08), P(0, 0.35, -0.11)))
    return b


def clips(cfg, h):
    """Degrees about each bone's X (+ = limbs back / torso forward), (x, twist, z) tuples to turn the
    torso; locations in metres. Keys are eased, so a few poses per clip read as fluid motion."""
    up = lambda dy: {'spine': (0, dy * h, 0)}
    flow = 'hair' if cfg.get('hair') else 'cape'
    staff = cfg.get('staff')
    arm_amp = 8 if staff else 18

    def walk_pose(s, passing):
        L, R = ('L', 'R') if s > 0 else ('R', 'L')
        if passing:
            r = {f'thigh.{L}': 4, f'shin.{L}': 6, f'thigh.{R}': -18, f'shin.{R}': 55, f'upperarm.{L}': 0, f'upperarm.{R}': 0,
                 f'forearm.{L}': -14, f'forearm.{R}': -14, 'spine': (6, 0, 0), 'chest': (2, 0, 0), 'head': (-4, 0, 0), flow: 22}
            loc = up(0.03)
        else:
            r = {f'thigh.{L}': -26, f'shin.{L}': 4, f'thigh.{R}': 20, f'shin.{R}': 24, f'upperarm.{L}': arm_amp, f'upperarm.{R}': -arm_amp,
                 f'forearm.{L}': -8, f'forearm.{R}': -26, 'spine': (5, 7 * s, 0), 'chest': (2, -12 * s, 0), 'head': (-4, 5 * s, 0), flow: 12}
            loc = up(-0.005)
        if staff:  # the staff hand stays steady
            r['upperarm.R'] = r.get('upperarm.R', 0) * 0.4
            r['forearm.R'] = 0
        return r, loc

    walk = []
    for f, s, passing in ((0, 1, False), (6, 1, True), (12, -1, False), (18, -1, True), (24, 1, False)):
        r, loc = walk_pose(s, passing)
        walk.append((f, r, loc))
    idle = [
        (0, {'chest': (0, 0, 0), 'head': (0, 0, 0), 'upperarm.L': 3, 'upperarm.R': 3, 'forearm.L': -6, 'forearm.R': -6 if not staff else 0, flow: 4}, up(0)),
        (36, {'chest': (-3, 2, 0), 'head': (-4, -6, 0), 'upperarm.L': 6, 'upperarm.R': 5, 'forearm.L': -11, 'forearm.R': -10 if not staff else -3, flow: 9}, up(0.01)),
        (72, {'chest': (0, 0, 0), 'head': (0, 0, 0), 'upperarm.L': 3, 'upperarm.R': 3, 'forearm.L': -6, 'forearm.R': -6 if not staff else 0, flow: 4}, up(0)),
    ]
    attack = {
        'sling': [(0, {}, {}), (4, {'upperarm.R': -165, 'forearm.R': -40, 'chest': (-4, 22, 0), 'spine': (0, 8, 0)}, {}),
                  (8, {'upperarm.R': -45, 'forearm.R': -6, 'chest': (10, -18, 0), 'spine': (4, -6, 0)}, {}), (15, {}, {})],
        'club': [(0, {}, {}), (5, {'upperarm.R': -172, 'forearm.R': -60, 'chest': (-8, 26, 0), 'spine': (-2, 8, 0)}, {}),
                 (9, {'upperarm.R': -22, 'forearm.R': -12, 'chest': (16, -22, 0), 'spine': (7, -8, 0)}, {}), (17, {}, {})],
        'staff': [(0, {}, {}), (4, {'upperarm.R': -14, 'forearm.R': 12, 'chest': (-5, 16, 0)}, {}),
                  (8, {'upperarm.R': -78, 'forearm.R': -8, 'chest': (10, -12, 0)}, {}), (15, {}, {})],
        'horn': [(0, {}, {}), (5, {'upperarm.R': -72, 'forearm.R': -96, 'chest': (-6, 8, 0), 'head': (-10, 0, 0)}, {}),  # the horn to the lips
                 (12, {'upperarm.R': -74, 'forearm.R': -98, 'chest': (-9, 8, 0), 'head': (-12, 0, 0)}, {}), (17, {}, {})],
        'bow': [(0, {}, {}), (4, {'upperarm.L': -86, 'upperarm.R': -82, 'forearm.R': -112, 'chest': (0, -16, 0)}, {}),  # draw...
                (7, {'upperarm.L': -86, 'upperarm.R': -60, 'forearm.R': -40, 'chest': (0, -12, 0)}, {}), (13, {}, {})],  # ...and loose
    }[cfg['attack']]
    raise_ = {'upperarm.L': -158, 'upperarm.R': -158, 'forearm.L': -12, 'forearm.R': -12, 'head': (-16, 0, 0), 'chest': (-8, 0, 0), flow: 26}
    cast = [(0, {}, {}), (7, raise_, up(0.04)), (18, raise_, up(0.04)), (24, {}, {})]
    jump_pose = {'thigh.L': -52, 'shin.L': 72, 'thigh.R': -14, 'shin.R': 42, 'upperarm.L': -72, 'upperarm.R': -50 if not staff else -20,
                 'forearm.L': -30, 'forearm.R': -30 if not staff else 0, 'spine': (6, 0, 0), flow: 36}
    slide_pose = {'spine': (-22, 0, 0), 'chest': (-6, 0, 0), 'thigh.L': -76, 'shin.L': 10, 'thigh.R': -30, 'shin.R': 76,
                  'upperarm.L': 30, 'upperarm.R': 22 if not staff else 0, 'forearm.L': -20, 'forearm.R': -20 if not staff else 0, flow: 42}
    return {
        'idle': idle, 'walk': walk, 'attack': attack, 'cast': cast,
        'jump': [(0, jump_pose, {}), (1, jump_pose, {})],
        'slide': [(0, slide_pose, up(-0.07)), (1, slide_pose, up(-0.07))],
    }


def build(name, cfg):
    s = cfg['make']()
    mesh_ob = s.build()
    arm_ob = make_armature(f'{name}_rig', skeleton(cfg, s.h))
    skin(mesh_ob, arm_ob, s.W)
    actions(arm_ob, clips(cfg, s.h))
    export_glb(os.path.join(ROOT, 'assets/models/heroes', f'{name}.glb'), [mesh_ob, arm_ob], animations=True, draco=True, sampled=True)
    print(name, f'{len(mesh_ob.data.polygons)} faces')
    return arm_ob


if __name__ == '__main__':
    reset()
    os.makedirs(os.path.join(ROOT, 'assets/blender'), exist_ok=True)
    rigs = [build(name, cfg) for name, cfg in HEROES.items()]
    for k, rig in enumerate(rigs):  # side by side in the .blend for editing
        rig.location.x = (k - 1) * 1.6
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'assets/blender/heroes.blend'))
