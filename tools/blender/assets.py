# Every non-hero model: mobs (both biomes), bosses (rigged + animated), relics, weapons, the scroll,
# projectiles, pickups and the scenery kit. Built from bevelled / roughened primitives with per-face
# colour variation. Coordinates are three.js (Y up, +Z forward); lib converts on build.
# Output: assets/models/{mobs,items,props}.glb, assets/models/bosses/*.glb, assets/blender/assets.blend.
# Run with tools/build_models.sh.
import math
import os
import random
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import lib  # noqa: E402
from lib import ROOT, Model, actions, export_glb, make_armature, prim, reset, skin  # noqa: E402

lib.SOFT = 0.32  # rounded, worn edges on everything built here (see lib.SOFT)

PI = math.pi
SKIN, SKIN2, SKIN3 = 0xd9a87a, 0xc98a5a, 0xb07a4e
WOOD, DARKWOOD, LEATHER = 0x8a5a2b, 0x5a3418, 0x7a4a24
BRONZE, GOLD, IRON, STONE, BONE = 0xc08a3e, 0xe8b84a, 0x9aa3ad, 0xa9a294, 0xece2c8
WHITE, CREAM, DARK, BLACK = 0xf4efe4, 0xe8dcc0, 0x1d1510, 0x2a1d14
BLUE, RED, LEAF = 0x3e5f99, 0xb8463a, 0x6f9a3e
BONE2, BONE3, RAG, RUST = 0xe6dcc2, 0xc9bc9c, 0x5e4c3c, 0x8a5a44  # Valley of Dry Bones
SLATE = [0x6f7887, 0x7c8594, 0x8a92a0, 0x969da9]
CAP, PALE, MOSS, TRUNK = 0xb9b6a8, 0xa7a69c, 0x7f9a4a, 0x6b5040
LEAVES = {
    'gold': [0xe8b83a, 0xd99a2e, 0xf2cf5a, 0xc98a26],
    'orange': [0xd9792e, 0xe8963a, 0xc2602a, 0xf0a848],
    'red': [0xb8452a, 0xd06a32, 0x9c3a24, 0xc85a3a],
    'green': [0x7a9a3e, 0x8fae4a, 0x6a8a36, 0x9ab852],
}
built = {}  # glb file -> objects


def out(group, m):
    ob = m.build(light=group == 'items')
    built.setdefault(group, []).append(ob)
    return ob


def shine(m, p, r, bone=None):
    """A white glint on the upper left of a gem or polished surface."""
    m.part('ball', r * 0.32, 1, p=(p[0] - r * 0.35, p[1] + r * 0.4, p[2] + r * 0.65), color=WHITE, jitter=0, bone=bone)


def moss_top(base, cover=MOSS, k=0.65):
    """Colour faces pointing up with moss, the rest with `base`."""
    return lambda f: cover if f.normal.y > k else base


# ---------- Humanoid mobs (legs/arms swing in the game's shader) ----------
def humanoid(m, h, c):
    """A soldier's body: tapered legs and arms, a torso with a waist and a chest, round hands, a soft head."""
    hip, sh = 0.62 * h, 1.1 * h
    for x, sw in ((-0.11 * h, 1), (0.11 * h, -1)):
        leg = dict(swing=sw, pivot=hip)
        m.part('cyl', 0.085 * h, 0.066 * h, 0.52 * h, 10, p=(x, 0.37 * h, 0), color=c['leg'], **leg)  # thigh to ankle
        m.part('box', 0.15 * h, 0.1 * h, 0.27 * h, p=(x, 0.05 * h, 0.03 * h), color=c['feet'], **leg)
        for y in (0.22, 0.32):
            m.part('cyl', 0.077 * h, 0.074 * h, 0.04 * h, 10, p=(x, y * h, 0), color=c.get('wrap', LEATHER), **leg)
    m.part('cyl', 0.2 * h, 0.29 * h, 0.3 * h, 12, p=(0, 0.61 * h, 0), color=c['bottom'])
    for k in range(8):  # kilt fringe
        a = k / 8 * 2 * PI
        m.part('box', 0.07 * h, 0.06 * h, 0.03 * h, p=(math.sin(a) * 0.28 * h, 0.47 * h, math.cos(a) * 0.28 * h), r=(0, a, 0),
               color=c.get('fringe', c['bottom']))
    # torso: narrow at the waist, broad at the chest, rounded shoulders, flatter front to back
    m.part('lathe', [(0.0, 0.72 * h), (0.17 * h, 0.72 * h), (0.19 * h, 0.8 * h), (0.225 * h, 0.95 * h), (0.235 * h, 1.06 * h),
                     (0.2 * h, 1.15 * h), (0.11 * h, 1.19 * h), (0.0, 1.2 * h)], 14, s=(1, 1, 0.64), color=c['top'], smooth=True)
    m.part('cyl', 0.2 * h, 0.2 * h, 0.07 * h, 14, p=(0, 0.75 * h, 0), s=(1.05, 1, 0.68), color=c.get('belt', LEATHER))
    m.part('box', 0.07 * h, 0.07 * h, 0.03 * h, p=(0, 0.75 * h, 0.14 * h), color=c.get('buckle', BRONZE))
    for x, sw in ((-0.285 * h, -0.7), (0.285 * h, 0.7)):
        arm = dict(swing=sw, pivot=sh)
        m.part('cyl', 0.066 * h, 0.055 * h, 0.42 * h, 10, p=(x, 0.9 * h, 0), color=c.get('arm', c['skin']), **arm)
        m.part('ball', 0.09 * h, 1, p=(x, 1.07 * h, 0), s=(1, 0.85, 1), color=c.get('sleeve', c['top']), **arm)  # shoulder
        m.part('cyl', 0.066 * h, 0.07 * h, 0.06 * h, 10, p=(x, 0.76 * h, 0), color=c.get('bracer', LEATHER), **arm)
        m.part('ball', 0.062 * h, 1, p=(x, 0.67 * h, 0.01 * h), s=(1, 1.1, 1), color=c['skin'], **arm)  # hand
    m.part('cyl', 0.08 * h, 0.09 * h, 0.08 * h, 10, p=(0, 1.2 * h, 0), color=c['skin'])
    m.part('box', 0.28 * h, 0.3 * h, 0.27 * h, p=(0, 1.34 * h, 0), color=c['skin'], soft=0.4)
    m.part('ball', 0.032 * h, 1, p=(0, 1.32 * h, 0.13 * h), s=(1, 1.3, 1), color=c['skin'])  # nose
    for x in (-0.062 * h, 0.062 * h):
        m.part('ball', 0.026 * h, 1, p=(x, 1.36 * h, 0.118 * h), s=(1, 1.15, 0.7), color=DARK)
        m.part('box', 0.07 * h, 0.018 * h, 0.02 * h, p=(x, 1.405 * h, 0.135 * h), r=(0, 0, -0.15 if x < 0 else 0.15), color=c.get('brow', BLACK), soft=0)
    if c.get('beard'):
        m.part('box', 0.26 * h, 0.12 * h, 0.09 * h, p=(0, 1.24 * h, 0.115 * h), color=c['beard'])
    return m


LH = lambda h: dict(swing=-0.7, pivot=1.1 * h)
RH = lambda h: dict(swing=0.7, pivot=1.1 * h)


def feathers(m, h, y, z=0.0, bone=None):
    for k in range(9):
        a = (k - 4) * 0.15
        m.part('box', 0.045 * h, 0.27 * h, 0.025 * h, p=(math.sin(a) * 0.15 * h, y, z + 0.02 * h), r=(0, 0, -a * 1.5),
               color=WHITE if k % 2 else CREAM, bevel=0.008 * h, bone=bone)


def nemes(m, h, y, a=BLUE, b=GOLD, z=0.0, bone=None):
    kw = dict(bone=bone)
    m.part('box', 0.33 * h, 0.17 * h, 0.31 * h, p=(0, y, z - 0.01 * h), color=b, bevel=0.03 * h, **kw)
    for k in range(3):
        m.part('box', 0.34 * h, 0.025 * h, 0.32 * h, p=(0, y - 0.05 * h + k * 0.045 * h, z - 0.01 * h), color=a, **kw)
    for x in (-0.17 * h, 0.17 * h):
        m.part('box', 0.09 * h, 0.28 * h, 0.07 * h, p=(x, y - 0.17 * h, z + 0.06 * h), color=b, bevel=0.01 * h, **kw)
        for k in range(3):
            m.part('box', 0.095 * h, 0.025 * h, 0.075 * h, p=(x, y - 0.25 * h + k * 0.07 * h, z + 0.06 * h), color=a, **kw)
    m.part('box', 0.3 * h, 0.24 * h, 0.06 * h, p=(0, y - 0.12 * h, z - 0.15 * h), color=b, bevel=0.01 * h, **kw)
    m.part('cone', 0.03 * h, 0.08 * h, 6, p=(0, y + 0.08 * h, z + 0.16 * h), color=GOLD, **kw)


def horse(m, color, plume, mane=BLACK, harness=LEATHER):
    m.part('box', 0.36, 0.4, 1.0, p=(0, 0.98, 0.55), color=color, bevel=0.07)
    m.part('box', 0.3, 0.12, 0.7, p=(0, 0.78, 0.55), color=color, bevel=0.04)
    m.part('box', 0.2, 0.46, 0.24, p=(0, 1.32, 1.02), r=(-0.5, 0, 0), color=color, bevel=0.04)
    m.part('box', 0.19, 0.2, 0.42, p=(0, 1.52, 1.22), color=color, bevel=0.04)
    m.part('box', 0.14, 0.14, 0.12, p=(0, 1.47, 1.45), color=DARK, bevel=0.02)
    for x in (-0.07, 0.07):
        m.part('cone', 0.035, 0.1, 4, p=(x, 1.67, 1.12), color=color)
        m.part('box', 0.03, 0.03, 0.02, p=(x * 1.4, 1.56, 1.36), color=DARK)
    m.part('box', 0.06, 0.36, 0.38, p=(0, 1.42, 0.95), r=(-0.5, 0, 0), color=mane)
    m.part('cone', 0.06, 0.26, 5, p=(0, 1.74, 1.14), color=plume)
    m.part('box', 0.08, 0.42, 0.08, p=(0, 0.93, 0.02), r=(0.5, 0, 0), color=mane)
    m.part('box', 0.38, 0.06, 0.12, p=(0, 1.0, 0.9), color=harness)
    m.part('box', 0.38, 0.06, 0.1, p=(0, 1.08, 0.3), color=harness)
    for x, z, sw in ((-0.12, 0.2, 1), (0.12, 0.2, -1), (-0.12, 0.9, -1), (0.12, 0.9, 1)):
        m.part('box', 0.1, 0.62, 0.1, p=(x, 0.45, z), color=color, bevel=0.02, swing=sw, pivot=0.76)
        m.part('box', 0.12, 0.1, 0.13, p=(x, 0.08, z), color=DARK, bevel=0.02, swing=sw, pivot=0.76)


def wheel(m, x, y, z, rim, spoke, r=0.34, bone=None):
    m.part('torus', r, 0.045, 2 * PI, 16, p=(x, y, z), r=(0, PI / 2, 0), color=rim, bone=bone)
    for k in range(6):
        m.part('box', 0.03, r * 2, 0.03, p=(x, y, z), r=(k * PI / 6, 0, 0), color=spoke, bone=bone)
    m.part('cyl', 0.07, 0.07, 0.12, 8, p=(x, y, z), r=(0, 0, PI / 2), color=spoke, bone=bone)


def chariot(m, cart, rim, spoke, horse_color, plume):
    horse(m, horse_color, plume)
    m.part('box', 0.06, 0.06, 0.9, p=(0, 0.82, 0.05), color=cart)
    m.part('box', 0.8, 0.1, 0.58, p=(0, 0.62, -0.4), color=cart, bevel=0.02)
    m.part('box', 0.8, 0.5, 0.07, p=(0, 0.9, -0.12), color=cart, bevel=0.02)
    for x in (-0.38, 0.38):
        m.part('box', 0.06, 0.36, 0.52, p=(x, 0.82, -0.4), color=cart, bevel=0.015)
    m.part('torus', 0.25, 0.025, PI, 10, p=(0, 1.08, -0.4), r=(0, 0, 0), color=rim)
    for x in (-0.46, 0.46):
        wheel(m, x, 0.36, -0.42, rim, spoke)
    m.part('cyl', 0.035, 0.035, 0.98, 6, p=(0, 0.36, -0.42), r=(0, 0, PI / 2), color=DARKWOOD)


def mobs():
    # Philistine soldier: feathered crown, round shield, spear.
    m = humanoid(Model('mob_0_ela', 11), 1, dict(skin=SKIN, top=0x9c4a32, bottom=0xe3d3ae, leg=SKIN, feet=LEATHER, fringe=0xb8463a, beard=0x4a2a18))
    m.part('box', 0.43, 0.1, 0.27, p=(0, 1.04, 0), color=BRONZE, bevel=0.015)
    m.part('box', 0.32, 0.07, 0.3, p=(0, 1.47, 0), color=BRONZE, bevel=0.015)
    for k in range(5):
        m.part('ball', 0.018, 1, p=(-0.12 + k * 0.06, 1.47, 0.15), color=GOLD)
    feathers(m, 1, 1.62)
    m.part('cyl', 0.26, 0.26, 0.05, 14, p=(-0.38, 0.84, 0.13), r=(PI / 2, 0, 0), color=0x8a5a32, bevel=0.01, **LH(1))
    m.part('torus', 0.26, 0.03, 2 * PI, 16, p=(-0.38, 0.84, 0.16), color=BRONZE, **LH(1))
    m.part('ball', 0.06, 1, p=(-0.38, 0.84, 0.17), color=BRONZE, **LH(1))
    m.part('cyl', 0.02, 0.02, 1.55, 6, p=(0.34, 0.95, 0.12), color=WOOD, **RH(1))
    m.part('cone', 0.05, 0.18, 6, p=(0.34, 1.81, 0.12), color=IRON, bevel=0.005, **RH(1))
    m.part('cyl', 0.03, 0.03, 0.08, 6, p=(0.34, 1.68, 0.12), color=LEATHER, **RH(1))
    out('mobs', m)

    # Egyptian soldier: striped headcloth, collar, khopesh, tall shield.
    m = humanoid(Model('mob_0_mar', 12), 1, dict(skin=SKIN3, top=SKIN3, sleeve=SKIN3, bottom=WHITE, leg=SKIN3, feet=LEATHER, fringe=GOLD, belt=BLUE, buckle=GOLD))
    m.part('cyl', 0.21, 0.23, 0.07, 14, p=(0, 1.16, 0), color=GOLD, bevel=0.01)
    m.part('cyl', 0.215, 0.235, 0.025, 14, p=(0, 1.13, 0), color=BLUE)
    nemes(m, 1, 1.47)
    m.part('box', 0.32, 0.5, 0.05, p=(-0.36, 0.85, 0.13), color=0x8a5a32, bevel=0.02, **LH(1))
    m.part('cyl', 0.16, 0.16, 0.05, 12, p=(-0.36, 1.1, 0.13), r=(PI / 2, 0, 0), color=0x8a5a32, **LH(1))
    for k in range(5):
        m.part('ball', 0.025, 0, p=(-0.36 + (k % 2 - 0.5) * 0.12, 0.7 + k * 0.08, 0.16), color=WHITE, **LH(1))
    m.part('cyl', 0.025, 0.025, 0.22, 6, p=(0.33, 0.66, 0.1), color=DARKWOOD, **RH(1))
    m.part('torus', 0.15, 0.03, PI * 1.1, 10, p=(0.33, 0.5, 0.2), r=(0, PI / 2, PI), color=BRONZE, **RH(1))
    out('mobs', m)

    # Slinger (Elá): olive tunic, red headband, sling, bag.
    m = humanoid(Model('mob_1_ela', 13), 0.95, dict(skin=SKIN, top=0x7d8a4a, bottom=0xcdbb8f, leg=SKIN, feet=LEATHER, beard=0x5a3418))
    m.part('box', 0.3, 0.06, 0.28, p=(0, 1.36, 0), color=RED)
    m.part('box', 0.05, 0.16, 0.03, p=(0.06, 1.28, -0.15), r=(0.3, 0, 0), color=RED)
    m.part('box', 0.18, 0.2, 0.1, p=(-0.22, 0.6, 0.12), color=LEATHER, bevel=0.02)
    m.part('box', 0.04, 0.6, 0.02, p=(0, 0.9, 0.13), r=(0, 0, 0.6), color=LEATHER)
    m.part('box', 0.015, 0.4, 0.015, p=(0.33, 0.47, 0.1), color=LEATHER, **RH(0.95))
    m.part('box', 0.09, 0.07, 0.09, p=(0.33, 0.27, 0.1), color=LEATHER, **RH(0.95))
    m.part('ball', 0.04, 1, p=(0.33, 0.25, 0.1), color=STONE, **RH(0.95))
    out('mobs', m)

    # Archer (Mar): bow and quiver.
    m = humanoid(Model('mob_1_mar', 14), 0.95, dict(skin=SKIN3, top=WHITE, sleeve=WHITE, bottom=WHITE, leg=SKIN3, feet=LEATHER, belt=RED))
    m.part('box', 0.3, 0.06, 0.28, p=(0, 1.36, 0), color=BLUE)
    m.part('torus', 0.36, 0.022, PI, 12, p=(-0.35, 0.82, 0.16), r=(0, PI / 2, -PI / 2), color=DARKWOOD, **LH(0.95))
    m.part('box', 0.008, 0.72, 0.008, p=(-0.35, 0.82, 0.16), color=WHITE, **LH(0.95))
    m.part('cyl', 0.07, 0.06, 0.5, 8, p=(0.1, 1.0, -0.17), r=(0.3, 0, 0.3), color=LEATHER, bevel=0.01)
    for k in range(3):
        m.part('box', 0.02, 0.12, 0.02, p=(0.15 + k * 0.03, 1.27, -0.24), r=(0.3, 0, 0.3), color=WHITE)
    out('mobs', m)

    # Chariots.
    m = Model('mob_2_ela', 15)
    chariot(m, WOOD, DARKWOOD, 0x6a4a2a, 0x7a5232, WHITE)
    humanoid_driver(m, 0x9c4a32, SKIN, philistine=True)
    out('mobs', m)
    m = Model('mob_2_mar', 16)
    chariot(m, GOLD, BLUE, GOLD, 0xeae4d8, RED)
    humanoid_driver(m, WHITE, SKIN3, philistine=False)
    out('mobs', m)

    # Anakim giant: leather vest, bronze helmet, beard, knotted club.
    m = humanoid(Model('mob_3_ela', 17), 1.8, dict(skin=0xb98560, top=0x6b4a2a, sleeve=0xb98560, bottom=0x5a3a20, leg=0xb98560, feet=LEATHER, beard=BLACK))
    m.part('box', 0.56, 0.24, 0.52, p=(0, 2.72, 0), color=BRONZE, bevel=0.04)
    m.part('box', 0.09, 0.24, 0.6, p=(0, 2.92, 0), color=RED, bevel=0.02)
    for x in (-0.26, 0.26):
        m.part('box', 0.06, 0.22, 0.3, p=(x, 2.5, 0.1), color=BRONZE)
    m.part('cyl', 0.08, 0.17, 1.15, 7, p=(0.52, 1.2, 0.22), r=(0.3, 0, 0), color=DARKWOOD, bevel=0.02, **RH(1.8))
    for k in range(3):
        m.part('ball', 0.07, 0, p=(0.52 + (k - 1) * 0.08, 1.55 - k * 0.15, 0.33 + k * 0.04), color=0x4a2a14, **RH(1.8))
    out('mobs', m)

    # Stone colossus (Mar): sandstone body, cracks, glowing eyes, staff.
    m = humanoid(Model('mob_3_mar', 18), 1.8, dict(skin=0xd8b98a, top=0xc9a46e, sleeve=0xd8b98a, bottom=0xd8b98a, leg=0xd8b98a, feet=0xb08a5a, belt=GOLD, brow=0x8a6a3e))
    nemes(m, 1.8, 2.66, 0x4a6aa8, 0xd8b98a)
    for x in (-0.12, 0.12):
        m.part('box', 0.1, 0.06, 0.05, p=(x, 2.44, 0.25), color=0x7ff0ff)
    for k in range(5):
        m.part('box', 0.02, 0.25, 0.02, p=(-0.2 + k * 0.1, 1.5 + (k % 2) * 0.3, 0.23), r=(0, 0, 0.4 * (k % 2 - 0.5)), color=0x8a6a3e)
    m.part('cyl', 0.05, 0.05, 2.2, 6, p=(0.56, 1.5, 0.15), color=0xc9a46e, **RH(1.8))
    m.part('torus', 0.14, 0.04, 2 * PI, 10, p=(0.56, 2.7, 0.15), color=GOLD, **RH(1.8))
    out('mobs', m)
    bone_mobs()
    jericho_mobs()
    new_mobs()


def tower_shield(m, h, face, rim, emblem=None):
    """A tall shield carried in front of the body (not swinging): the shield-bearer's wall."""
    m.part('box', 0.74 * h, 1.05 * h, 0.07 * h, p=(-0.06 * h, 0.82 * h, 0.3 * h), color=face, bevel=0.03 * h)
    m.part('box', 0.78 * h, 0.06 * h, 0.09 * h, p=(-0.06 * h, 1.33 * h, 0.3 * h), color=rim)
    m.part('box', 0.78 * h, 0.06 * h, 0.09 * h, p=(-0.06 * h, 0.31 * h, 0.3 * h), color=rim)
    for x in (-0.43, 0.31):
        m.part('box', 0.06 * h, 1.05 * h, 0.09 * h, p=(x * h, 0.82 * h, 0.3 * h), color=rim)
    if emblem:
        m.part('ball', 0.1 * h, 1, p=(-0.06 * h, 0.86 * h, 0.35 * h), color=emblem)


def new_mobs():
    # Runners (type 5): small and quick, they come in packs. Shield-bearers (type 6): slow, a wall of bronze.
    m = humanoid(Model('mob_5_ela', 51), 0.85, dict(skin=SKIN, top=0xb8643a, bottom=CREAM, leg=SKIN, feet=LEATHER, beard=0x4a2a18))
    m.part('box', 0.26, 0.05, 0.25, p=(0, 1.17, 0), color=RED)
    for k in range(3):
        m.part('box', 0.03, 0.14, 0.02, p=(-0.06 + k * 0.06, 1.27, -0.09), r=(0, 0, (k - 1) * 0.3), color=WHITE)
    for dz in (0.0, 0.06):  # two javelins
        m.part('cyl', 0.014, 0.014, 1.1, 6, p=(0.29, 0.8, 0.1 + dz), r=(0.15, 0, 0), color=WOOD, **RH(0.85))
        m.part('cone', 0.035, 0.12, 5, p=(0.29, 1.37, 0.18 + dz), r=(0.15, 0, 0), color=IRON, **RH(0.85))
    out('mobs', m)
    m = humanoid(Model('mob_5_mar', 52), 0.85, dict(skin=SKIN3, top=SKIN3, sleeve=SKIN3, bottom=WHITE, leg=SKIN3, feet=LEATHER, belt=BLUE, buckle=GOLD))
    m.part('box', 0.26, 0.05, 0.25, p=(0, 1.17, 0), color=BLUE)
    m.part('box', 0.05, 0.3, 0.02, p=(0.29, 0.5, 0.1), color=0xd8dee6, **RH(0.85))
    m.part('box', 0.1, 0.03, 0.05, p=(0.29, 0.66, 0.1), color=GOLD, **RH(0.85))
    out('mobs', m)
    m = skeleton(Model('mob_5_ossos', 53), 0.85, dict(top=RAG, sleeve=RAG))
    m.part('box', 0.3, 0.2, 0.28, p=(0, 1.17, -0.02), color=RAG, bevel=0.05)
    m.part('box', 0.05, 0.3, 0.02, p=(0.29, 0.5, 0.1), color=RUST, **RH(0.85))
    out('mobs', m)
    m = humanoid(Model('mob_5_jerico', 54), 0.85, dict(skin=SKIN2, top=PURPLE, bottom=CREAM, leg=SKIN2, feet=LEATHER, beard=0x2a1a10))
    m.part('box', 0.3, 0.22, 0.3, p=(0, 1.18, -0.02), color=PURPLE2, bevel=0.06)  # a spy's hood
    m.part('box', 0.05, 0.3, 0.02, p=(0.29, 0.5, 0.1), color=0xd8dee6, **RH(0.85))
    out('mobs', m)

    m = humanoid(Model('mob_6_ela', 61), 1.25, dict(skin=SKIN, top=0x8a5a32, bottom=0x5a3a20, leg=SKIN, feet=LEATHER, beard=0x3a2214, belt=BRONZE))
    m.part('box', 0.4, 0.12, 0.38, p=(0, 1.85, 0), color=BRONZE, bevel=0.02)
    feathers(m, 1.25, 2.02)
    tower_shield(m, 1.25, 0x8a5a32, BRONZE, BRONZE)
    m.part('cyl', 0.022, 0.022, 1.3, 6, p=(0.4, 1.2, 0.16), color=WOOD, **RH(1.25))
    m.part('cone', 0.05, 0.16, 6, p=(0.4, 1.92, 0.16), color=IRON, **RH(1.25))
    out('mobs', m)
    m = humanoid(Model('mob_6_mar', 62), 1.25, dict(skin=SKIN3, top=GOLD, sleeve=SKIN3, bottom=WHITE, leg=SKIN3, feet=LEATHER, belt=BLUE, buckle=GOLD))
    nemes(m, 1.25, 1.84)
    tower_shield(m, 1.25, 0xeae4d8, GOLD, BLUE)
    m.part('torus', 0.18, 0.035, PI * 1.1, 10, p=(0.4, 0.65, 0.25), r=(0, PI / 2, PI), color=BRONZE, **RH(1.25))
    out('mobs', m)
    m = skeleton(Model('mob_6_ossos', 63), 1.25, dict(bottom=0x3a2e24))
    m.part('box', 0.4, 0.16, 0.38, p=(0, 1.86, 0), color=RUST, bevel=0.04)
    tower_shield(m, 1.25, 0x5e4c3c, BONE3)
    for k in range(5):  # a shield of ribs
        m.part('box', 0.62 * 1.25, 0.035 * 1.25, 0.03, p=(-0.06 * 1.25, (0.5 + k * 0.17) * 1.25, 0.35 * 1.25), color=BONE2)
    out('mobs', m)
    m = humanoid(Model('mob_6_jerico', 64), 1.25, dict(skin=SKIN2, top=BRONZE, sleeve=PURPLE, bottom=PURPLE, leg=SKIN2, feet=LEATHER, beard=BLACK, belt=GOLD))
    m.part('cone', 0.22, 0.38, 8, p=(0, 1.98, 0), color=BRONZE)
    tower_shield(m, 1.25, PURPLE, BRONZE, GOLD)
    m.part('cyl', 0.022, 0.022, 1.4, 6, p=(0.4, 1.2, 0.16), color=WOOD, **RH(1.25))
    m.part('cone', 0.05, 0.18, 6, p=(0.4, 1.97, 0.16), color=IRON, **RH(1.25))
    out('mobs', m)


PURPLE, PURPLE2, BRICK = 0x6a3a6a, 0x8a4a8a, [0xc9a46e, 0xbf9963, 0xd2ad78, 0xb58e5a]  # Jericho


def jericho_mobs():
    # Canaanite guard: purple tunic, tall bronze helmet, small round shield, spear.
    m = humanoid(Model('mob_0_jerico', 41), 1, dict(skin=SKIN2, top=PURPLE, bottom=CREAM, leg=SKIN2, feet=LEATHER, fringe=PURPLE2, beard=0x2a1a10))
    m.part('cone', 0.17, 0.32, 8, p=(0, 1.58, 0), color=BRONZE)
    m.part('cyl', 0.17, 0.17, 0.04, 8, p=(0, 1.44, 0), color=0x8a6a2e)
    m.part('cyl', 0.2, 0.2, 0.05, 12, p=(-0.38, 0.84, 0.13), r=(PI / 2, 0, 0), color=BRONZE, bevel=0.01, **LH(1))
    m.part('cyl', 0.02, 0.02, 1.6, 6, p=(0.34, 0.95, 0.12), color=WOOD, **RH(1))
    m.part('cone', 0.05, 0.2, 6, p=(0.34, 1.84, 0.12), color=IRON, **RH(1))
    out('mobs', m)
    # Archer: red tunic and headband, a bow.
    m = humanoid(Model('mob_1_jerico', 42), 0.95, dict(skin=SKIN2, top=0xa83a32, bottom=CREAM, leg=SKIN2, feet=LEATHER, beard=0x2a1a10))
    m.part('box', 0.3, 0.05, 0.28, p=(0, 1.38, 0), color=PURPLE)
    m.part('torus', 0.36, 0.022, PI, 12, p=(-0.35, 0.82, 0.16), r=(0, PI / 2, -PI / 2), color=DARKWOOD, **LH(0.95))
    m.part('box', 0.008, 0.72, 0.008, p=(-0.35, 0.82, 0.16), color=WHITE, **LH(0.95))
    m.part('cyl', 0.07, 0.06, 0.5, 8, p=(0.1, 1.0, -0.17), r=(0.3, 0, 0.3), color=LEATHER, bevel=0.01)
    out('mobs', m)
    # Chariot of the king's guard.
    m = Model('mob_2_jerico', 43)
    chariot(m, WOOD, BRONZE, BRONZE, 0x7a5232, PURPLE)
    humanoid_driver(m, PURPLE, SKIN2, philistine='canaan')
    out('mobs', m)
    # Guardian of the wall: bronze armour, tower shield, long spear.
    m = humanoid(Model('mob_3_jerico', 44), 1.8, dict(skin=SKIN2, top=BRONZE, sleeve=PURPLE, bottom=PURPLE, leg=SKIN2, feet=LEATHER, beard=BLACK, belt=GOLD))
    m.part('cone', 0.3, 0.5, 8, p=(0, 2.85, 0), color=BRONZE)
    m.part('box', 0.12, 1.5, 0.9, p=(-0.62, 1.4, 0.2), color=0x8a5a2b, bevel=0.04, **LH(1.8))
    m.part('box', 0.14, 1.4, 0.08, p=(-0.64, 1.4, 0.2), color=BRONZE, **LH(1.8))
    m.part('cyl', 0.035, 0.035, 2.8, 6, p=(0.56, 1.7, 0.2), color=WOOD, **RH(1.8))
    m.part('cone', 0.08, 0.35, 6, p=(0.56, 3.25, 0.2), color=IRON, **RH(1.8))
    out('mobs', m)


def skeleton(m, h, c=None):
    """Dry bones standing up (Ez 37:7): a humanoid in bone colours with ribs, hollow eyes and teeth."""
    c = {**dict(skin=BONE2, top=BONE2, sleeve=BONE2, bottom=RAG, leg=BONE2, feet=BONE3, fringe=0x4a3a2c, belt=0x4a3a2c, brow=BONE3, arm=BONE2, bracer=BONE3, wrap=BONE3), **(c or {})}
    humanoid(m, h, c)
    for k in range(4):  # gaps between the ribs
        m.part('box', 0.34 * h, 0.022 * h, 0.02 * h, p=(0, 0.86 * h + k * 0.075 * h, 0.128 * h), color=DARK)
    m.part('box', 0.04 * h, 0.3 * h, 0.02 * h, p=(0, 0.95 * h, 0.13 * h), color=BONE3)  # sternum
    for x in (-0.07 * h, 0.07 * h):  # hollow eyes over the humanoid's eyes
        m.part('box', 0.08 * h, 0.075 * h, 0.03 * h, p=(x, 1.36 * h, 0.13 * h), color=DARK)
        m.part('box', 0.02 * h, 0.02 * h, 0.02 * h, p=(x, 1.36 * h, 0.147 * h), color=0xffd06a)  # a spark of the breath to come
    m.part('box', 0.04 * h, 0.05 * h, 0.02 * h, p=(0, 1.3 * h, 0.15 * h), color=DARK)
    for k in range(5):
        m.part('box', 0.03 * h, 0.035 * h, 0.02 * h, p=(-0.07 * h + k * 0.035 * h, 1.235 * h, 0.14 * h), color=WHITE)
    m.part('box', 0.2 * h, 0.012 * h, 0.02 * h, p=(0, 1.215 * h, 0.14 * h), color=DARK)
    return m


def bone_mobs():
    # Bone warrior: rusty helmet, notched sword, cracked shield.
    m = skeleton(Model('mob_0_ossos', 31), 1)
    m.part('box', 0.32, 0.12, 0.3, p=(0, 1.5, 0), color=RUST, bevel=0.03)
    m.part('box', 0.05, 0.16, 0.26, p=(0, 1.6, -0.02), r=(0.2, 0, 0), color=0x6a3a2a)
    m.part('cyl', 0.24, 0.24, 0.05, 12, p=(-0.38, 0.84, 0.13), r=(PI / 2, 0, 0), color=0x4a3a2c, bevel=0.01, **LH(1))
    m.part('torus', 0.24, 0.03, 1.6 * PI, 14, p=(-0.38, 0.84, 0.16), color=RUST, **LH(1))
    m.part('box', 0.05, 0.62, 0.02, p=(0.34, 0.95, 0.15), r=(0.25, 0, 0), color=0x9a8a7a, bevel=0.005, **RH(1))
    m.part('box', 0.16, 0.04, 0.06, p=(0.34, 0.66, 0.08), color=RUST, **RH(1))
    out('mobs', m)
    # Bone archer: a ragged hood and a bow.
    m = skeleton(Model('mob_1_ossos', 32), 0.95, dict(top=RAG, sleeve=RAG))
    m.part('box', 0.34, 0.24, 0.32, p=(0, 1.37, -0.02), color=RAG, bevel=0.06)
    m.part('box', 0.22, 0.2, 0.1, p=(0, 1.18, -0.16), r=(0.4, 0, 0), color=RAG, bevel=0.03)
    m.part('torus', 0.36, 0.022, PI, 12, p=(-0.35, 0.82, 0.16), r=(0, PI / 2, -PI / 2), color=0x5a4632, **LH(0.95))
    m.part('box', 0.008, 0.72, 0.008, p=(-0.35, 0.82, 0.16), color=BONE3, **LH(0.95))
    m.part('cyl', 0.07, 0.06, 0.5, 8, p=(0.1, 1.0, -0.17), r=(0.3, 0, 0.3), color=0x4a3a2c, bevel=0.01)
    out('mobs', m)
    # Bone chariot: a skeletal horse and a skeleton at the reins.
    m = Model('mob_2_ossos', 33)
    chariot(m, 0x5e4c3c, 0x3a2e24, BONE3, BONE2, 0x7a2a2a)
    for k in range(4):  # the horse's ribs
        m.part('box', 0.38, 0.03, 0.05, p=(0, 0.95 + (k % 2) * 0.12, 0.35 + k * 0.15), color=DARK)
    m.part('box', 0.2, 0.06, 0.03, p=(0, 1.55, 1.44), color=DARK)
    humanoid_driver(m, RAG, BONE2, philistine=None)
    out('mobs', m)
    # Bone giant: horned skull helm and a femur for a club.
    m = skeleton(Model('mob_3_ossos', 34), 1.8, dict(bottom=0x3a2e24))
    m.part('box', 0.56, 0.22, 0.52, p=(0, 2.72, 0), color=RUST, bevel=0.04)
    for x in (-1, 1):
        m.part('cone', 0.09, 0.5, 6, p=(x * 0.36, 2.92, 0), r=(0, 0, -x * 0.7), color=BONE3)
        m.part('cone', 0.1, 0.3, 6, p=(x * 0.5, 2.0, 0), r=(0, 0, -x * 1.2), color=BONE2)  # shoulder spikes
    m.part('cyl', 0.09, 0.11, 1.2, 8, p=(0.52, 1.2, 0.22), r=(0.3, 0, 0), color=BONE2, **RH(1.8))
    for dy in (0.55, -0.6):
        for dx in (-0.07, 0.07):
            m.part('ball', 0.13, 1, p=(0.52 + dx, 1.2 + dy, 0.22 + dy * 0.3), color=BONE3, **RH(1.8))
    out('mobs', m)


def humanoid_driver(m, top, skin, philistine):
    z = -0.42
    m.part('box', 0.32, 0.4, 0.22, p=(0, 1.2, z), color=top, bevel=0.03)
    m.part('box', 0.24, 0.24, 0.22, p=(0, 1.55, z), color=skin, bevel=0.03)
    for x in (-0.05, 0.05):
        m.part('box', 0.04, 0.04, 0.02, p=(x, 1.57, z + 0.11), color=DARK)
    m.part('box', 0.08, 0.3, 0.08, p=(-0.2, 1.25, z + 0.08), r=(-0.6, 0, 0), color=skin)
    m.part('box', 0.08, 0.3, 0.08, p=(0.2, 1.25, z + 0.08), r=(-0.6, 0, 0), color=skin)
    if philistine == 'canaan':  # Jericho: a tall bronze helmet
        m.part('cone', 0.15, 0.26, 8, p=(0, 1.78, z), color=BRONZE)
    elif philistine is None:  # a skeleton: hollow eyes, rusty helmet
        for x in (-0.05, 0.05):
            m.part('box', 0.06, 0.06, 0.02, p=(x, 1.58, z + 0.115), color=DARK)
        m.part('box', 0.27, 0.12, 0.26, p=(0, 1.7, z), color=RUST, bevel=0.03)
    elif philistine:
        m.part('box', 0.26, 0.05, 0.24, p=(0, 1.68, z), color=BRONZE)
        feathers(m, 0.85, 1.8, z)
    else:
        nemes(m, 0.85, 1.72, z=z)


# ---------- Bosses (rigged, rigid skinning, animated) ----------
def goliath():
    m = Model('golias', 21)
    S = 0.85
    leg = lambda b: dict(bone=b)
    for x, b in ((-0.42, 'leg.L'), (0.42, 'leg.R')):
        m.part('cyl', 0.3, 0.23, 1.75, 12, p=(x, 1.05, 0), color=0x4a3b2a, **leg(b))
        m.part('cyl', 0.33, 0.29, 0.95, 12, p=(x, 0.65, 0.02), color=BRONZE, **leg(b))  # greaves (1 Sm 17:6)
        for k in range(3):
            m.part('cyl', 0.335, 0.335, 0.05, 12, p=(x, 0.35 + k * 0.3, 0.02), color=0x8a6a2e, **leg(b))
        m.part('box', 0.64, 0.25, 0.98, p=(x, 0.12, 0.12), color=LEATHER, bevel=0.05, **leg(b))
    body = dict(bone='hips')
    m.part('cyl', 0.8, 1.0, 0.75, 12, p=(0, 1.95, 0), color=0x6b4a2a, bevel=0.03, **body)
    for k in range(12):
        a = k / 12 * 2 * PI
        m.part('box', 0.3, 0.5, 0.06, p=(math.sin(a) * 0.98, 1.7, math.cos(a) * 0.98), r=(0, a, 0), color=0x8a5a2b, **body)
    m.part('lathe', [(0.0, 2.15), (0.84, 2.15), (0.92, 2.4), (1.0, 2.85), (1.03, 3.25), (0.93, 3.6), (0.55, 3.8), (0.0, 3.84)], 16, s=(1, 1, 0.6), color=0x9c7a3e, smooth=True, **body)
    for row in range(6):  # scale armour (1 Sm 17:5)
        for k in range(7):
            m.part('ball', 0.16, 1, s=(1, 0.82, 0.34), p=(sx := -0.78 + k * 0.26 + (row % 2) * 0.13, 2.3 + row * 0.24, 0.63 * math.sqrt(max(0.0, 1 - (sx / 1.03) ** 2)) + 0.02), r=(0.2, math.asin(max(-0.9, min(0.9, sx / 1.03))) * 0.8, 0),
                   color=0xb08a42 if (row + k) % 2 else 0x8a6a2e, bevel=0.02, **body)
    m.part('cyl', 0.9, 0.9, 0.24, 16, p=(0, 2.2, 0), s=(1, 1, 0.66), color=LEATHER, **body)
    m.part('box', 0.3, 0.22, 0.08, p=(0, 2.2, 0.62), color=GOLD, **body)
    for x in (-1.0, 1.0):
        m.part('ball', 0.48, 1, p=(x, 3.65, 0), color=BRONZE, **body)
        m.part('torus', 0.4, 0.06, 2 * PI, 12, p=(x, 3.5, 0), r=(PI / 2, 0, 0), color=0x8a6a2e, **body)
    hd = dict(bone='head')
    m.part('cyl', 0.24, 0.27, 0.32, 12, p=(0, 3.95, 0), color=SKIN2, **hd)
    m.part('box', 0.82, 0.86, 0.8, p=(0, 4.45, 0), color=SKIN2, soft=0.42, **hd)
    m.part('box', 0.74, 0.55, 0.3, p=(0, 4.2, 0.38), color=BLACK, soft=0.7, **hd)
    for x in (-0.18, 0.18):
        m.part('box', 0.14, 0.1, 0.04, p=(x, 4.57, 0.41), color=WHITE, **hd)
        m.part('box', 0.07, 0.08, 0.04, p=(x, 4.57, 0.43), color=DARK, **hd)
        m.part('box', 0.2, 0.06, 0.05, p=(x, 4.68, 0.41), r=(0, 0, -0.2 if x < 0 else 0.2), color=BLACK, **hd)
    m.part('box', 0.12, 0.16, 0.12, p=(0, 4.42, 0.44), color=SKIN2, bevel=0.03, **hd)
    m.part('ball', 0.52, 2, p=(0, 4.86, 0), s=(1, 0.8, 1), color=BRONZE, **hd)  # bronze helmet (1 Sm 17:5)
    m.part('box', 0.16, 0.5, 1.15, p=(0, 5.4, 0), color=RED, bevel=0.06, **hd)
    for x in (-0.47, 0.47):
        m.part('box', 0.08, 0.45, 0.52, p=(x, 4.55, 0.15), color=BRONZE, bevel=0.02, **hd)
    m.part('box', 0.1, 0.3, 0.08, p=(0, 4.75, 0.48), color=BRONZE, **hd)
    for x, b in ((-1.2, 'arm.L'), (1.2, 'arm.R')):
        a = dict(bone=b)
        m.part('cyl', 0.25, 0.21, 1.5, 12, p=(x, 2.95, 0), color=SKIN2, **a)
        m.part('cyl', 0.27, 0.25, 0.42, 12, p=(x, 2.6, 0), color=BRONZE, **a)
        m.part('ball', 0.25, 1, p=(x, 2.08, 0.02), s=(1, 1.05, 1.1), color=SKIN2, **a)
    sh = dict(bone='arm.L')
    m.part('box', 0.22, 2.0, 1.6, p=(-1.45, 2.65, 0.25), color=BRONZE, soft=0.9, **sh)
    m.part('torus', 0.55, 0.06, 2 * PI, 16, p=(-1.58, 2.65, 0.25), r=(0, PI / 2, 0), color=0x8a6a2e, **sh)
    m.part('ball', 0.3, 1, p=(-1.6, 2.65, 0.25), color=GOLD, **sh)
    sp = dict(bone='arm.R')
    m.part('cyl', 0.11, 0.11, 4.8, 8, p=(1.2, 2.75, 0.3), color=DARKWOOD, **sp)  # spear like a weaver's beam
    for k in range(3):
        m.part('cyl', 0.13, 0.13, 0.1, 8, p=(1.2, 2.3 + k * 0.4, 0.3), color=LEATHER, **sp)
    m.part('cone', 0.2, 0.8, 6, p=(1.2, 5.55, 0.3), color=IRON, bevel=0.01, **sp)
    bones = [
        ('hips', None, (0, 1.9, 0), (0, 3.7, 0)),
        ('head', 'hips', (0, 3.85, 0), (0, 5.2, 0)),
        ('leg.L', 'hips', (-0.42, 1.9, 0), (-0.42, 0.1, 0)),
        ('leg.R', 'hips', (0.42, 1.9, 0), (0.42, 0.1, 0)),
        ('arm.L', 'hips', (-1.2, 3.65, 0), (-1.2, 2.0, 0)),
        ('arm.R', 'hips', (1.2, 3.65, 0), (1.2, 2.0, 0)),
    ]
    clips = {
        'idle': [(0, {}, {}), (30, {'hips': 2, 'head': -3, 'arm.L': 4, 'arm.R': 4}, {'hips': (0, 0.03, 0)}), (60, {}, {})],
        'walk': [(0, {'leg.L': -25, 'leg.R': 25, 'arm.L': 12, 'arm.R': -12, 'hips': 4}, {'hips': (0, 0, 0)}),
                 (8, {'leg.L': 0, 'leg.R': 0, 'arm.L': 0, 'arm.R': 0, 'hips': 4}, {'hips': (0, 0.12, 0)}),
                 (15, {'leg.L': 25, 'leg.R': -25, 'arm.L': -12, 'arm.R': 12, 'hips': 4}, {'hips': (0, 0, 0)}),
                 (23, {'leg.L': 0, 'leg.R': 0, 'arm.L': 0, 'arm.R': 0, 'hips': 4}, {'hips': (0, 0.12, 0)}),
                 (30, {'leg.L': -25, 'leg.R': 25, 'arm.L': 12, 'arm.R': -12, 'hips': 4}, {'hips': (0, 0, 0)})],
        'spear': [(0, {}, {}), (14, {'arm.R': -160, 'hips': -8}, {}), (28, {'arm.R': -165, 'hips': -10}, {}), (33, {'arm.R': -40, 'hips': 10}, {}), (40, {}, {})],
        'stomp': [(0, {}, {}), (26, {'leg.R': -70, 'hips': -12, 'arm.L': -30, 'arm.R': -30}, {'hips': (0, 0.2, 0)}),
                  (36, {'leg.R': 5, 'hips': 12}, {'hips': (0, -0.15, 0)}), (48, {}, {})],
        'summon': [(0, {}, {}), (10, {'arm.L': -165, 'arm.R': -165, 'head': -15}, {}), (24, {'arm.L': -165, 'arm.R': -165, 'head': -15}, {}), (32, {}, {})],
        # Held poses (the game turns the body for the swing): the spear levelled, the shield raised.
        'sweep': [(0, {}, {}), (8, {'arm.R': -95, 'arm.L': -30, 'hips': 6}, {}), (40, {'arm.R': -95, 'arm.L': -30, 'hips': 6}, {})],
    }
    rigged('golias', m, bones, clips, S)


def pharaoh():
    m = Model('farao', 22)
    hz = 1.3
    hb = dict(bone='horse')
    m.part('ball', 0.5, 2, p=(0, 1.4, hz + 0.8), s=(0.66, 0.78, 1.75), color=0xeae4d8, **hb)  # barrel
    m.part('box', 0.36, 0.85, 0.42, p=(0, 1.95, hz + 1.6), r=(-0.5, 0, 0), color=0xeae4d8, bevel=0.08, **hb)
    m.part('box', 0.32, 0.34, 0.68, p=(0, 2.35, hz + 1.95), color=0xeae4d8, bevel=0.07, **hb)
    m.part('box', 0.24, 0.22, 0.2, p=(0, 2.27, hz + 2.33), color=0xc9c2b4, bevel=0.04, **hb)
    for x in (-0.12, 0.12):
        m.part('cone', 0.06, 0.18, 4, p=(x, 2.58, hz + 1.75), color=0xeae4d8, **hb)
        m.part('box', 0.05, 0.05, 0.03, p=(x * 1.4, 2.42, hz + 2.2), color=DARK, **hb)
    m.part('box', 0.08, 0.6, 0.65, p=(0, 2.15, hz + 1.5), r=(-0.5, 0, 0), color=BLUE, **hb)
    m.part('cone', 0.1, 0.5, 5, p=(0, 2.78, hz + 1.85), color=RED, **hb)
    m.part('box', 0.66, 0.14, 0.3, p=(0, 1.55, hz + 1.5), color=GOLD, bevel=0.02, **hb)
    m.part('box', 0.68, 0.14, 0.25, p=(0, 1.62, hz + 0.6), color=GOLD, bevel=0.02, **hb)
    m.part('box', 0.1, 0.5, 0.1, p=(0, 1.25, hz + 0.0), r=(0.5, 0, 0), color=0xc9c2b4, **hb)
    for k, (x, z) in enumerate(((-0.2, hz + 0.15), (0.2, hz + 0.15), (-0.2, hz + 1.45), (0.2, hz + 1.45))):
        lb = dict(bone=f'hleg.{k}')
        m.part('box', 0.17, 1.0, 0.17, p=(x, 0.58, z), color=0xeae4d8, bevel=0.03, **lb)
        m.part('box', 0.2, 0.12, 0.22, p=(x, 0.06, z), color=DARK, bevel=0.02, **lb)
    cb = dict(bone='chariot')
    m.part('box', 0.1, 0.1, 1.6, p=(0, 1.0, 0.8), color=GOLD, **cb)
    m.part('box', 1.8, 0.2, 1.3, p=(0, 0.95, -0.4), color=GOLD, bevel=0.04, **cb)
    m.part('box', 1.8, 0.95, 0.12, p=(0, 1.45, 0.22), color=GOLD, bevel=0.03, **cb)
    for k in range(5):
        m.part('box', 0.25, 0.25, 0.03, p=(-0.7 + k * 0.35, 1.45, 0.29), r=(0, 0, PI / 4), color=BLUE, **cb)
    m.part('box', 1.82, 0.12, 0.14, p=(0, 1.75, 0.22), color=BLUE, **cb)
    for x in (-0.88, 0.88):
        m.part('box', 0.1, 0.7, 1.2, p=(x, 1.35, -0.4), color=GOLD, bevel=0.03, **cb)
    m.part('cyl', 0.09, 0.09, 2.2, 8, p=(0, 0.75, -0.4), r=(0, 0, PI / 2), color=DARKWOOD, **cb)
    wheel(m, -1.0, 0.75, -0.4, RED, GOLD, r=0.7, bone='wheel.L')
    wheel(m, 1.0, 0.75, -0.4, RED, GOLD, r=0.7, bone='wheel.R')
    K = 1.7
    kx, ky, kz = 0, 1.05, -0.45
    kp = lambda x, y, z: (kx + x * K, ky + y * K, kz + z * K)
    kb = dict(bone='king')
    m.part('cyl', 0.3 * K, 0.4 * K, 0.6 * K, 10, p=kp(0, 0.3, 0), color=WHITE, **kb)
    m.part('box', 0.55 * K, 0.65 * K, 0.35 * K, p=kp(0, 0.95, 0), color=SKIN3, bevel=0.05, **kb)
    m.part('cyl', 0.33 * K, 0.35 * K, 0.09 * K, 14, p=kp(0, 1.22, 0), color=GOLD, **kb)
    m.part('cyl', 0.34 * K, 0.36 * K, 0.04 * K, 14, p=kp(0, 1.18, 0), color=BLUE, **kb)
    m.part('box', 0.38 * K, 0.4 * K, 0.36 * K, p=kp(0, 1.5, 0), color=SKIN3, bevel=0.05, **kb)
    for x in (-0.08, 0.08):
        m.part('box', 0.06 * K, 0.04 * K, 0.02 * K, p=kp(x, 1.53, 0.185), color=DARK, **kb)
    m.part('box', 0.07 * K, 0.18 * K, 0.06 * K, p=kp(0, 1.27, 0.19), color=BLUE, **kb)
    nemes(m, 1.3 * K, ky + 1.68 * K, z=kz, bone='king')
    m.part('cone', 0.15 * K, 0.5 * K, 8, p=kp(0, 2.02, -0.02), color=WHITE, **kb)
    for x, b in ((-0.38, 'arm.L'), (0.38, 'arm.R')):
        ab = dict(bone=b)
        m.part('box', 0.17 * K, 0.6 * K, 0.18 * K, p=kp(x, 0.92, 0), color=SKIN3, bevel=0.03, **ab)
        m.part('cyl', 0.11 * K, 0.11 * K, 0.08 * K, 8, p=kp(x, 0.75, 0), color=GOLD, **ab)
    m.part('cyl', 0.035 * K, 0.035 * K, 0.8 * K, 6, p=kp(-0.38, 0.6, 0.1), color=GOLD, bone='arm.L')
    m.part('torus', 0.1 * K, 0.035 * K, PI * 1.3, 8, p=kp(-0.28, 1.0, 0.1), color=BLUE, bone='arm.L')
    m.part('cyl', 0.035 * K, 0.035 * K, 2.4 * K, 6, p=kp(0.38, 1.1, 0.2), color=WOOD, bone='arm.R')
    m.part('cone', 0.07 * K, 0.25 * K, 5, p=kp(0.38, 2.4, 0.2), color=IRON, bone='arm.R')
    bones = [
        ('chariot', None, (0, 0.75, -0.4), (0, 1.6, -0.4)),
        ('wheel.L', 'chariot', (-1.0, 0.75, -0.4), (-1.0, 1.3, -0.4)),
        ('wheel.R', 'chariot', (1.0, 0.75, -0.4), (1.0, 1.3, -0.4)),
        ('horse', 'chariot', (0, 0.05, hz), (0, 0.9, hz)),
        ('king', 'chariot', kp(0, 0.6, 0), kp(0, 1.2, 0)),
        ('arm.L', 'king', kp(-0.38, 1.2, 0), kp(-0.38, 0.62, 0)),
        ('arm.R', 'king', kp(0.38, 1.2, 0), kp(0.38, 0.62, 0)),
    ]
    for k, (x, z) in enumerate(((-0.2, hz + 0.15), (0.2, hz + 0.15), (-0.2, hz + 1.45), (0.2, hz + 1.45))):
        bones.append((f'hleg.{k}', 'horse', (x, 1.08, z), (x, 0.1, z)))
    gallop = lambda s: {'hleg.0': 30 * s, 'hleg.1': -30 * s, 'hleg.2': -30 * s, 'hleg.3': 30 * s, 'wheel.L': (0, 0, 0), 'wheel.R': (0, 0, 0)}
    walk = []
    for f in range(0, 31, 5):
        k = math.sin(f / 30 * 2 * PI)
        g = gallop(k)
        g['wheel.L'] = g['wheel.R'] = -360 * f / 30
        walk.append((f, g, {'chariot': (0, abs(k) * 0.05, 0)}))
    clips = {
        'idle': [(0, {}, {}), (30, {'king': 2, 'arm.L': 4, 'arm.R': 4, 'hleg.0': -4}, {}), (60, {}, {})],
        'walk': walk,
        'spear': [(0, {}, {}), (14, {'arm.R': -160, 'king': -6}, {}), (28, {'arm.R': -165, 'king': -8}, {}), (33, {'arm.R': -40, 'king': 8}, {}), (40, {}, {})],
        'stomp': [(0, {}, {}), (26, {'horse': -28, 'hleg.2': -40, 'hleg.3': -40}, {}), (36, {'horse': 4}, {}), (48, {}, {})],
        'summon': [(0, {}, {}), (10, {'arm.L': -165, 'arm.R': -165}, {}), (24, {'arm.L': -165, 'arm.R': -165}, {}), (32, {}, {})],
    }
    rigged('farao', m, bones, clips, 1.0)


def gogue():
    """Gog, prince of Magog (Ez 38-39): blackened iron, horned helm, a war axe and a skull shield."""
    m = Model('gogue', 23)
    S = 0.85
    IRONK, IRONL, ASH, CRIMSON = 0x4a4a52, 0x6a6a76, 0x9a7a6a, 0x8a2020
    for x, b in ((-0.42, 'leg.L'), (0.42, 'leg.R')):
        lg = dict(bone=b)
        m.part('cyl', 0.3, 0.23, 1.75, 12, p=(x, 1.05, 0), color=0x3a2e2a, **lg)
        m.part('cyl', 0.33, 0.29, 0.95, 12, p=(x, 0.65, 0.02), color=IRONK, **lg)
        m.part('cone', 0.12, 0.3, 6, p=(x, 1.1, 0.4), r=(PI / 2, 0, 0), color=IRONL, **lg)  # knee spike
        m.part('box', 0.66, 0.25, 0.98, p=(x, 0.12, 0.12), color=0x2a2220, bevel=0.05, **lg)
    body = dict(bone='hips')
    m.part('cyl', 0.8, 1.0, 0.75, 12, p=(0, 1.95, 0), color=0x3a2a2a, bevel=0.03, **body)
    for k in range(12):
        a = k / 12 * 2 * PI
        m.part('box', 0.3, 0.55, 0.06, p=(math.sin(a) * 0.98, 1.68, math.cos(a) * 0.98), r=(0, a, 0), color=IRONK if k % 2 else IRONL, **body)
    m.part('lathe', [(0.0, 2.15), (0.84, 2.15), (0.92, 2.4), (1.0, 2.85), (1.03, 3.25), (0.93, 3.6), (0.55, 3.8), (0.0, 3.84)], 16, s=(1, 1, 0.6), color=IRONK, smooth=True, **body)
    for row in range(6):  # lamellar plates
        for k in range(7):
            m.part('ball', 0.16, 1, s=(1, 0.82, 0.34), p=(sx := -0.78 + k * 0.26 + (row % 2) * 0.13, 2.3 + row * 0.24, 0.63 * math.sqrt(max(0.0, 1 - (sx / 1.03) ** 2)) + 0.02), r=(0.2, math.asin(max(-0.9, min(0.9, sx / 1.03))) * 0.8, 0),
                   color=IRONL if (row + k) % 2 else 0x55555f, bevel=0.02, **body)
    m.part('cyl', 0.9, 0.9, 0.26, 16, p=(0, 2.2, 0), s=(1, 1, 0.66), color=CRIMSON, **body)
    m.part('box', 1.7, 2.6, 0.12, p=(0, 2.4, -0.62), r=(-0.08, 0, 0), color=CRIMSON, bevel=0.03, **body)  # cape
    for x in (-1.0, 1.0):
        m.part('ball', 0.5, 1, p=(x, 3.65, 0), color=IRONL, **body)
        for k in range(3):
            m.part('cone', 0.1, 0.45, 6, p=(x * (1.05 + k * 0.05), 3.95, -0.25 + k * 0.25), r=(0, 0, -x * 0.5), color=0x2a2a30, **body)
    hd = dict(bone='head')
    m.part('cyl', 0.24, 0.27, 0.32, 12, p=(0, 3.95, 0), color=ASH, **hd)
    m.part('box', 0.82, 0.86, 0.8, p=(0, 4.45, 0), color=ASH, soft=0.42, **hd)
    m.part('box', 0.74, 0.6, 0.3, p=(0, 4.15, 0.38), color=0x1a1414, soft=0.7, **hd)
    for k in range(3):  # braided beard
        m.part('cyl', 0.07, 0.04, 0.5, 6, p=(-0.2 + k * 0.2, 3.75, 0.5), color=0x1a1414, **hd)
    for x in (-0.18, 0.18):
        m.part('box', 0.14, 0.08, 0.04, p=(x, 4.57, 0.41), color=0xff5a3a, **hd)
        m.part('box', 0.22, 0.06, 0.05, p=(x, 4.68, 0.41), r=(0, 0, -0.3 if x < 0 else 0.3), color=0x1a1414, **hd)
    m.part('ball', 0.53, 2, p=(0, 4.88, 0), s=(1, 0.8, 1), color=IRONK, **hd)
    for x in (-1, 1):  # great curled horns
        for k in range(5):
            a = k * 0.42
            m.part('ball', 0.2 - k * 0.025, 1, p=(x * (0.55 + math.sin(a) * 0.45), 5.1 + math.cos(a) * 0.5 - 0.1 * k, -0.05 * k), color=BONE3 if k % 2 else BONE2, **hd)
    for x, b in ((-1.2, 'arm.L'), (1.2, 'arm.R')):
        a_ = dict(bone=b)
        m.part('cyl', 0.25, 0.21, 1.5, 12, p=(x, 2.95, 0), color=ASH, **a_)
        m.part('cyl', 0.27, 0.25, 0.5, 12, p=(x, 2.55, 0), color=IRONK, **a_)
        m.part('ball', 0.25, 1, p=(x, 2.08, 0.02), s=(1, 1.05, 1.1), color=ASH, **a_)
    sh = dict(bone='arm.L')
    m.part('cyl', 0.9, 0.9, 0.18, 16, p=(-1.5, 2.65, 0.25), r=(0, 0, PI / 2), color=0x3a2e24, **sh)
    m.part('torus', 0.88, 0.07, 2 * PI, 18, p=(-1.6, 2.65, 0.25), r=(0, PI / 2, 0), color=IRONL, **sh)
    m.part('ball', 0.32, 1, p=(-1.62, 2.72, 0.25), s=(0.5, 1, 1), color=BONE2, **sh)  # skull emblem
    for z in (0.15, 0.35):
        m.part('box', 0.06, 0.1, 0.1, p=(-1.75, 2.75, z), color=DARK, **sh)
    ax = dict(bone='arm.R')
    m.part('cyl', 0.1, 0.1, 4.2, 8, p=(1.2, 2.6, 0.3), color=DARKWOOD, **ax)
    for z in (-1, 1):  # double-bitted axe head
        m.part('box', 0.12, 1.0, 0.75, p=(1.2, 4.35, 0.3 + z * 0.45), color=IRONL, bevel=0.04, **ax)
        m.part('box', 0.14, 0.9, 0.1, p=(1.2, 4.35, 0.3 + z * 0.82), color=0xc9ccd6, **ax)
    bones = [
        ('hips', None, (0, 1.9, 0), (0, 3.7, 0)),
        ('head', 'hips', (0, 3.85, 0), (0, 5.2, 0)),
        ('leg.L', 'hips', (-0.42, 1.9, 0), (-0.42, 0.1, 0)),
        ('leg.R', 'hips', (0.42, 1.9, 0), (0.42, 0.1, 0)),
        ('arm.L', 'hips', (-1.2, 3.65, 0), (-1.2, 2.0, 0)),
        ('arm.R', 'hips', (1.2, 3.65, 0), (1.2, 2.0, 0)),
    ]
    clips = {
        'idle': [(0, {}, {}), (30, {'hips': 3, 'head': -4, 'arm.L': 5, 'arm.R': 6}, {'hips': (0, 0.04, 0)}), (60, {}, {})],
        'walk': [(0, {'leg.L': -25, 'leg.R': 25, 'arm.L': 10, 'arm.R': -14, 'hips': 6}, {'hips': (0, 0, 0)}),
                 (8, {'leg.L': 0, 'leg.R': 0, 'arm.L': 0, 'arm.R': 0, 'hips': 6}, {'hips': (0, 0.14, 0)}),
                 (15, {'leg.L': 25, 'leg.R': -25, 'arm.L': -10, 'arm.R': 14, 'hips': 6}, {'hips': (0, 0, 0)}),
                 (23, {'leg.L': 0, 'leg.R': 0, 'arm.L': 0, 'arm.R': 0, 'hips': 6}, {'hips': (0, 0.14, 0)}),
                 (30, {'leg.L': -25, 'leg.R': 25, 'arm.L': 10, 'arm.R': -14, 'hips': 6}, {'hips': (0, 0, 0)})],
        'spear': [(0, {}, {}), (14, {'arm.R': -165, 'hips': -10}, {}), (28, {'arm.R': -170, 'hips': -12}, {}), (33, {'arm.R': -35, 'hips': 14}, {}), (40, {}, {})],
        'stomp': [(0, {}, {}), (24, {'arm.R': -160, 'arm.L': -40, 'hips': -10}, {'hips': (0, 0.25, 0)}),
                  (34, {'arm.R': -20, 'hips': 18}, {'hips': (0, -0.2, 0)}), (48, {}, {})],
        'summon': [(0, {}, {}), (10, {'arm.L': -150, 'arm.R': -170, 'head': -18}, {}), (24, {'arm.L': -150, 'arm.R': -170, 'head': -18}, {}), (32, {}, {})],
        'spin': [(0, {}, {}), (8, {'arm.R': -100, 'arm.L': -65, 'hips': 6, 'head': -6}, {}), (40, {'arm.R': -100, 'arm.L': -65, 'hips': 6, 'head': -6}, {})],
    }
    rigged('gogue', m, bones, clips, S)


def rei():
    """The king of Jericho (Js 2:2): a crown, purple robes, gold breastplate, a sceptre-spear and a gold shield."""
    m = Model('rei', 24)
    S = 0.82
    for x, b in ((-0.42, 'leg.L'), (0.42, 'leg.R')):
        lg = dict(bone=b)
        m.part('cyl', 0.3, 0.23, 1.75, 12, p=(x, 1.05, 0), color=SKIN2, **lg)
        m.part('cyl', 0.32, 0.28, 0.7, 12, p=(x, 0.5, 0.02), color=BRONZE, **lg)
        m.part('box', 0.64, 0.25, 0.98, p=(x, 0.12, 0.12), color=LEATHER, bevel=0.05, **lg)
    body = dict(bone='hips')
    m.part('cyl', 0.85, 1.15, 1.2, 14, p=(0, 1.7, 0), color=PURPLE, bevel=0.03, **body)  # royal robe
    m.part('lathe', [(0.0, 2.15), (0.84, 2.15), (0.92, 2.4), (1.0, 2.85), (1.03, 3.25), (0.93, 3.6), (0.55, 3.8), (0.0, 3.84)], 16, s=(1, 1, 0.6), color=PURPLE2, smooth=True, **body)
    m.part('ball', 0.72, 2, p=(0, 3.0, 0.42), s=(1, 0.85, 0.32), color=GOLD, **body)  # breastplate
    for k in range(3):
        m.part('box', 1.3 - k * 0.2, 0.06, 0.05, p=(0, 2.6 + k * 0.3, 0.66), color=0xc99a2e, **body)
    m.part('cyl', 0.9, 0.9, 0.26, 16, p=(0, 2.2, 0), s=(1, 1, 0.66), color=GOLD, **body)
    m.part('box', 1.8, 2.6, 0.12, p=(0, 2.4, -0.62), r=(-0.08, 0, 0), color=PURPLE, bevel=0.03, **body)  # cape
    for x in (-1.0, 1.0):
        m.part('ball', 0.48, 1, p=(x, 3.65, 0), color=GOLD, **body)
    hd = dict(bone='head')
    m.part('cyl', 0.24, 0.27, 0.32, 12, p=(0, 3.95, 0), color=SKIN2, **hd)
    m.part('box', 0.82, 0.86, 0.8, p=(0, 4.45, 0), color=SKIN2, soft=0.42, **hd)
    m.part('box', 0.74, 0.6, 0.3, p=(0, 4.15, 0.38), color=BLACK, soft=0.7, **hd)
    for x in (-0.18, 0.18):
        m.part('box', 0.14, 0.1, 0.04, p=(x, 4.57, 0.41), color=WHITE, **hd)
        m.part('box', 0.07, 0.08, 0.04, p=(x, 4.57, 0.43), color=DARK, **hd)
        m.part('box', 0.2, 0.06, 0.05, p=(x, 4.68, 0.41), r=(0, 0, -0.2 if x < 0 else 0.2), color=BLACK, **hd)
    m.part('box', 0.86, 0.3, 0.84, p=(0, 4.9, 0), color=BLACK, bevel=0.08, **hd)  # hair under the crown
    m.part('cyl', 0.5, 0.48, 0.3, 12, p=(0, 5.08, 0), color=GOLD, **hd)
    for k in range(6):
        a = k / 6 * 2 * PI
        m.part('cone', 0.1, 0.32, 5, p=(math.sin(a) * 0.46, 5.36, math.cos(a) * 0.46), color=GOLD, **hd)
    m.part('ball', 0.09, 1, p=(0, 5.12, 0.5), color=0xd94a4a, **hd)
    for x, b in ((-1.2, 'arm.L'), (1.2, 'arm.R')):
        a_ = dict(bone=b)
        m.part('cyl', 0.25, 0.21, 1.5, 12, p=(x, 2.95, 0), color=PURPLE2, **a_)
        m.part('ball', 0.25, 1, p=(x, 2.08, 0.02), s=(1, 1.05, 1.1), color=SKIN2, **a_)
        m.part('cyl', 0.26, 0.26, 0.18, 10, p=(x, 2.35, 0), color=GOLD, **a_)
    sh = dict(bone='arm.L')
    m.part('cyl', 0.85, 0.85, 0.16, 16, p=(-1.5, 2.65, 0.25), r=(0, 0, PI / 2), color=GOLD, **sh)
    m.part('cyl', 0.5, 0.5, 0.18, 12, p=(-1.52, 2.65, 0.25), r=(0, 0, PI / 2), color=PURPLE, **sh)
    m.part('ball', 0.2, 1, p=(-1.6, 2.65, 0.25), color=GOLD, **sh)
    sp = dict(bone='arm.R')
    m.part('cyl', 0.1, 0.1, 4.6, 8, p=(1.2, 2.75, 0.3), color=GOLD, **sp)
    m.part('cone', 0.22, 0.8, 6, p=(1.2, 5.45, 0.3), color=0xd8dde3, bevel=0.01, **sp)
    m.part('ball', 0.22, 1, p=(1.2, 4.9, 0.3), color=GOLD, **sp)
    bones = [
        ('hips', None, (0, 1.9, 0), (0, 3.7, 0)),
        ('head', 'hips', (0, 3.85, 0), (0, 5.2, 0)),
        ('leg.L', 'hips', (-0.42, 1.9, 0), (-0.42, 0.1, 0)),
        ('leg.R', 'hips', (0.42, 1.9, 0), (0.42, 0.1, 0)),
        ('arm.L', 'hips', (-1.2, 3.65, 0), (-1.2, 2.0, 0)),
        ('arm.R', 'hips', (1.2, 3.65, 0), (1.2, 2.0, 0)),
    ]
    clips = {
        'idle': [(0, {}, {}), (30, {'hips': 2, 'head': -4, 'arm.L': 4, 'arm.R': 5}, {'hips': (0, 0.03, 0)}), (60, {}, {})],
        'walk': [(0, {'leg.L': -22, 'leg.R': 22, 'arm.L': 10, 'arm.R': -12, 'hips': 4}, {'hips': (0, 0, 0)}),
                 (8, {'leg.L': 0, 'leg.R': 0, 'arm.L': 0, 'arm.R': 0, 'hips': 4}, {'hips': (0, 0.12, 0)}),
                 (15, {'leg.L': 22, 'leg.R': -22, 'arm.L': -10, 'arm.R': 12, 'hips': 4}, {'hips': (0, 0, 0)}),
                 (23, {'leg.L': 0, 'leg.R': 0, 'arm.L': 0, 'arm.R': 0, 'hips': 4}, {'hips': (0, 0.12, 0)}),
                 (30, {'leg.L': -22, 'leg.R': 22, 'arm.L': 10, 'arm.R': -12, 'hips': 4}, {'hips': (0, 0, 0)})],
        'spear': [(0, {}, {}), (14, {'arm.R': -160, 'hips': -8}, {}), (28, {'arm.R': -165, 'hips': -10}, {}), (33, {'arm.R': -40, 'hips': 10}, {}), (40, {}, {})],
        'stomp': [(0, {}, {}), (26, {'leg.R': -70, 'hips': -12, 'arm.L': -30, 'arm.R': -30}, {'hips': (0, 0.2, 0)}),
                  (36, {'leg.R': 5, 'hips': 12}, {'hips': (0, -0.15, 0)}), (48, {}, {})],
        'summon': [(0, {}, {}), (10, {'arm.L': -150, 'arm.R': -165, 'head': -15}, {}), (24, {'arm.L': -150, 'arm.R': -165, 'head': -15}, {}), (32, {}, {})],
        'shield': [(0, {}, {}), (8, {'arm.L': -95, 'arm.R': -160, 'head': -10}, {}), (40, {'arm.L': -95, 'arm.R': -160, 'head': -10}, {})],
    }
    rigged('rei', m, bones, clips, S)


def rigged(name, m, bones, clips, scale):
    if scale != 1:
        m.V = [v * scale for v in m.V]
        bones = [(n, p, tuple(c * scale for c in h), tuple(c * scale for c in t)) for n, p, h, t in bones]
    mesh = m.build()
    arm = make_armature(f'{name}_rig', bones)
    skin(mesh, arm, [{b: 1.0} for b in m.BONE])
    actions(arm, clips)
    export_glb(os.path.join(ROOT, 'assets/models/bosses', f'{name}.glb'), [mesh, arm], animations=True, draco=True)
    arm.location.x = {'golias': 8, 'farao': -8, 'rei': 24, 'isbi': 32, 'janes': 40, 'ogue': 48, 'adonizedeque': 56}.get(name, 16)


# ---------- Hidden bosses (main.js BOSS_KITS isbi/janes/ogue/adonizedeque; 10% of runs) ----------
GIANT_BONES = [
    ('hips', None, (0, 1.9, 0), (0, 3.7, 0)),
    ('head', 'hips', (0, 3.85, 0), (0, 5.2, 0)),
    ('leg.L', 'hips', (-0.42, 1.9, 0), (-0.42, 0.1, 0)),
    ('leg.R', 'hips', (0.42, 1.9, 0), (0.42, 0.1, 0)),
    ('arm.L', 'hips', (-1.2, 3.65, 0), (-1.2, 2.0, 0)),
    ('arm.R', 'hips', (1.2, 3.65, 0), (1.2, 2.0, 0)),
]


def giant_clips(stride=25, lean=4):
    """Every clip a hidden boss may play: its moves borrow the map bosses' blows."""
    step = lambda s, up: ({'leg.L': -stride * s, 'leg.R': stride * s, 'arm.L': 11 * s, 'arm.R': -12 * s, 'hips': lean}, {'hips': (0, 0.13 if up else 0, 0)})
    walk = [(f, *step(sg, up)) for f, sg, up in ((0, 1, 0), (8, 0, 1), (15, -1, 0), (23, 0, 1), (30, 1, 0))]
    return {
        'idle': [(0, {}, {}), (30, {'hips': 3, 'head': -4, 'arm.L': 5, 'arm.R': 6}, {'hips': (0, 0.04, 0)}), (60, {}, {})],
        'walk': walk,
        'spear': [(0, {}, {}), (14, {'arm.R': -162, 'hips': -9}, {}), (28, {'arm.R': -168, 'hips': -11}, {}), (33, {'arm.R': -38, 'hips': 12}, {}), (40, {}, {})],
        'stomp': [(0, {}, {}), (24, {'arm.R': -150, 'arm.L': -40, 'leg.R': -45, 'hips': -10}, {'hips': (0, 0.25, 0)}),
                  (34, {'arm.R': -20, 'leg.R': 5, 'hips': 16}, {'hips': (0, -0.2, 0)}), (48, {}, {})],
        'summon': [(0, {}, {}), (10, {'arm.L': -160, 'arm.R': -168, 'head': -16}, {}), (24, {'arm.L': -160, 'arm.R': -168, 'head': -16}, {}), (32, {}, {})],
        'sweep': [(0, {}, {}), (8, {'arm.R': -95, 'arm.L': -30, 'hips': 6}, {}), (40, {'arm.R': -95, 'arm.L': -30, 'hips': 6}, {})],
        'spin': [(0, {}, {}), (8, {'arm.R': -100, 'arm.L': -65, 'hips': 6, 'head': -6}, {}), (40, {'arm.R': -100, 'arm.L': -65, 'hips': 6, 'head': -6}, {})],
        'shield': [(0, {}, {}), (8, {'arm.L': -95, 'arm.R': -160, 'head': -10}, {}), (40, {'arm.L': -95, 'arm.R': -160, 'head': -10}, {})],
    }


def giant(m, skin, legs, kilt, torso, trim, plates=None, belt=LEATHER, boots=LEATHER, sleeve=None, beard=BLACK, eyes=WHITE, robe=None):
    """A big warrior's body on GIANT_BONES; the boss adds its helmet, weapon and shield."""
    for x, b in ((-0.42, 'leg.L'), (0.42, 'leg.R')):
        lg = dict(bone=b)
        m.part('cyl', 0.3, 0.23, 1.75, 12, p=(x, 1.05, 0), color=legs, **lg)
        m.part('cyl', 0.33, 0.29, 0.9, 12, p=(x, 0.62, 0.02), color=trim, **lg)
        m.part('box', 0.64, 0.25, 0.98, p=(x, 0.12, 0.12), color=boots, bevel=0.05, **lg)
    body = dict(bone='hips')
    if robe:
        m.part('cyl', 0.85, 1.15, 1.25, 14, p=(0, 1.7, 0), color=robe, bevel=0.03, **body)
    else:
        m.part('cyl', 0.8, 1.0, 0.75, 12, p=(0, 1.95, 0), color=kilt, bevel=0.03, **body)
        for k in range(12):
            a = k / 12 * 2 * PI
            m.part('box', 0.3, 0.52, 0.06, p=(math.sin(a) * 0.98, 1.7, math.cos(a) * 0.98), r=(0, a, 0), color=trim if k % 2 else kilt, **body)
    m.part('lathe', [(0.0, 2.15), (0.84, 2.15), (0.92, 2.4), (1.0, 2.85), (1.03, 3.25), (0.93, 3.6), (0.55, 3.8), (0.0, 3.84)], 16, s=(1, 1, 0.6), color=torso, smooth=True, **body)
    if plates:
        for row in range(6):
            for k in range(7):
                sx = -0.78 + k * 0.26 + (row % 2) * 0.13
                m.part('ball', 0.16, 1, s=(1, 0.82, 0.34), p=(sx, 2.3 + row * 0.24, 0.63 * math.sqrt(max(0.0, 1 - (sx / 1.03) ** 2)) + 0.02),
                       r=(0.2, math.asin(max(-0.9, min(0.9, sx / 1.03))) * 0.8, 0), color=plates[(row + k) % 2], bevel=0.02, **body)
    m.part('cyl', 0.9, 0.9, 0.24, 16, p=(0, 2.2, 0), s=(1, 1, 0.66), color=belt, **body)
    m.part('box', 0.3, 0.22, 0.08, p=(0, 2.2, 0.62), color=GOLD, **body)
    for x in (-1.0, 1.0):
        m.part('ball', 0.48, 1, p=(x, 3.65, 0), color=trim, **body)
    hd = dict(bone='head')
    m.part('cyl', 0.24, 0.27, 0.32, 12, p=(0, 3.95, 0), color=skin, **hd)
    m.part('box', 0.82, 0.86, 0.8, p=(0, 4.45, 0), color=skin, soft=0.42, **hd)
    if beard is not None:
        m.part('box', 0.74, 0.58, 0.3, p=(0, 4.16, 0.38), color=beard, soft=0.7, **hd)
    for x in (-0.18, 0.18):
        m.part('box', 0.14, 0.1, 0.04, p=(x, 4.57, 0.41), color=eyes, **hd)
        if eyes == WHITE:
            m.part('box', 0.07, 0.08, 0.04, p=(x, 4.57, 0.43), color=DARK, **hd)
        m.part('box', 0.22, 0.06, 0.05, p=(x, 4.69, 0.41), r=(0, 0, -0.28 if x < 0 else 0.28), color=DARK, **hd)
    m.part('box', 0.12, 0.16, 0.12, p=(0, 4.42, 0.44), color=skin, bevel=0.03, **hd)
    for x, b in ((-1.2, 'arm.L'), (1.2, 'arm.R')):
        a_ = dict(bone=b)
        m.part('cyl', 0.25, 0.21, 1.5, 12, p=(x, 2.95, 0), color=sleeve or skin, **a_)
        m.part('cyl', 0.27, 0.25, 0.42, 12, p=(x, 2.55, 0), color=trim, **a_)
        m.part('ball', 0.25, 1, p=(x, 2.08, 0.02), s=(1, 1.05, 1.1), color=skin, **a_)


def isbi():
    """Ishbi-benob, of the sons of the giant: a bronze spear of 300 shekels and a new sword (2 Sm 21:16)."""
    m = Model('isbi', 31)
    DSKIN, KILT, PLUME = 0x9a6a48, 0x9a2a24, 0xd94a3a
    giant(m, DSKIN, 0x5a3a24, KILT, 0x7a4a26, BRONZE, plates=(0xc89a48, 0x9a6a2e), beard=0x2a1a10)
    hd = dict(bone='head')
    m.part('cyl', 0.5, 0.46, 0.34, 14, p=(0, 4.86, 0), color=BRONZE, **hd)  # the Philistine band...
    for k in range(13):  # ...and its crown of feathers, red and white
        a = (k - 6) * 0.2
        m.part('box', 0.1, 0.62, 0.05, p=(math.sin(a) * 0.46, 5.25, math.cos(a) * 0.12 - 0.05), r=(0, a, -a * 0.6), color=PLUME if k % 2 else WHITE, bevel=0.02, **hd)
    for x in (-0.47, 0.47):
        m.part('box', 0.08, 0.45, 0.5, p=(x, 4.5, 0.12), color=BRONZE, bevel=0.02, **hd)
    sp = dict(bone='arm.R')
    m.part('cyl', 0.14, 0.14, 5.2, 8, p=(1.2, 2.8, 0.3), color=BRONZE, **sp)  # all bronze, heavier than Goliath's
    for k in range(4):
        m.part('cyl', 0.17, 0.17, 0.1, 8, p=(1.2, 2.0 + k * 0.45, 0.3), color=0x7a5a2a, **sp)
    m.part('cone', 0.32, 1.2, 6, p=(1.2, 5.95, 0.3), color=0xe0a85a, bevel=0.02, **sp)
    sw = dict(bone='arm.L')
    m.part('box', 0.12, 1.9, 0.32, p=(-1.2, 1.15, 0.45), color=0xd8dee6, bevel=0.02, **sw)  # the new sword
    m.part('box', 0.6, 0.12, 0.16, p=(-1.2, 2.1, 0.45), color=GOLD, **sw)
    m.part('cone', 0.17, 0.4, 4, p=(-1.2, 0.05, 0.45), r=(PI, 0, 0), color=0xd8dee6, **sw)
    rigged('isbi', m, GIANT_BONES, giant_clips(), 1.0)


def janes():
    """Jannes, Pharaoh's magician (2 Tm 3:8): shaven head, linen and leopard skin, a staff become a serpent."""
    m = Model('janes', 32)
    LINEN, SPOT, ORB = 0xf0e8d6, 0xd9a440, 0x7af0a0
    giant(m, SKIN3, SKIN3, LINEN, LINEN, GOLD, belt=BLUE, boots=0xc9a46e, beard=None, robe=LINEN, sleeve=SKIN3)
    body = dict(bone='hips')
    m.part('box', 0.5, 1.9, 0.08, p=(0.25, 2.9, 0.6), r=(0, 0, -0.55), color=SPOT, bevel=0.02, **body)  # leopard skin
    for k in range(8):
        m.part('ball', 0.07, 1, p=(-0.15 + (k % 3) * 0.2, 2.3 + k * 0.17, 0.66), s=(1, 1, 0.3), color=DARK, **body)
    m.part('cyl', 1.02, 1.0, 0.2, 18, p=(0, 3.62, 0), s=(1, 1, 0.66), color=GOLD, **body)  # broad collar
    m.part('cyl', 1.06, 1.02, 0.1, 18, p=(0, 3.5, 0), s=(1, 1, 0.66), color=BLUE, **body)
    hd = dict(bone='head')
    m.part('box', 0.1, 0.08, 0.05, p=(-0.19, 4.52, 0.43), color=BLACK, **hd)  # kohl round the eyes
    m.part('box', 0.1, 0.08, 0.05, p=(0.19, 4.52, 0.43), color=BLACK, **hd)
    m.part('ball', 0.43, 2, p=(0, 4.62, 0), s=(1, 0.9, 1), color=SKIN3, **hd)  # shaven
    m.part('cyl', 0.06, 0.04, 0.4, 6, p=(0, 4.05, 0.42), color=BLACK, **hd)  # plaited beard
    st = dict(bone='arm.R')
    m.part('cyl', 0.08, 0.08, 4.6, 8, p=(1.2, 2.5, 0.35), color=DARKWOOD, **st)
    for k in range(9):  # the serpent coiled up the staff
        a = k * 1.4
        m.part('ball', 0.13, 1, p=(1.2 + math.sin(a) * 0.14, 2.6 + k * 0.28, 0.35 + math.cos(a) * 0.14), color=0x3c6b34 if k % 2 else 0x2f5e32, **st)
    m.part('ball', 0.2, 1, p=(1.2, 5.0, 0.48), s=(0.9, 0.7, 1.4), color=0x3c6b34, **st)  # its head, hood spread
    m.part('box', 0.5, 0.45, 0.06, p=(1.2, 4.9, 0.38), color=0x2f5e32, bevel=0.02, **st)
    for x in (-0.07, 0.07):
        m.part('ball', 0.04, 1, p=(1.2 + x, 5.06, 0.72), color=RED, **st)
    ob = dict(bone='arm.L')
    m.part('ball', 0.3, 2, p=(-1.2, 1.75, 0.2), color=ORB, **ob)  # a glow of enchantment in the open hand
    m.part('torus', 0.38, 0.03, 2 * PI, 14, p=(-1.2, 1.75, 0.2), r=(PI / 2, 0, 0), color=GOLD, **ob)
    rigged('janes', m, GIANT_BONES, giant_clips(20, 2), 0.78)


def ogue():
    """Og, king of Bashan, the last of the Rephaim, whose bed was of iron (Dt 3:11): iron crown and club."""
    m = Model('ogue', 33)
    ASH2, IRONK, IRONL, FUR = 0x8a7462, 0x4a4a52, 0x6a6a76, 0x5a4232
    giant(m, ASH2, 0x3a2e2a, FUR, IRONK, IRONL, plates=(IRONL, 0x55555f), belt=0x2a2220, boots=0x2a2220, beard=0x2a1e18, eyes=0xffb24a)
    body = dict(bone='hips')
    for x in (-1.0, 1.0):  # fur over the shoulders
        m.part('ball', 0.62, 1, p=(x * 0.95, 3.75, -0.1), s=(1, 0.6, 1), color=FUR, **body)
    m.part('box', 1.9, 2.8, 0.14, p=(0, 2.3, -0.62), r=(-0.08, 0, 0), color=FUR, bevel=0.04, **body)
    hd = dict(bone='head')
    m.part('box', 0.86, 0.5, 0.84, p=(0, 4.82, 0), color=0x2a1e18, bevel=0.08, **hd)  # hair
    m.part('cyl', 0.52, 0.5, 0.28, 10, p=(0, 5.0, 0), color=IRONK, **hd)
    for k in range(8):  # an iron crown of spikes
        a = k / 8 * 2 * PI
        m.part('cone', 0.09, 0.42 if k % 2 else 0.3, 4, p=(math.sin(a) * 0.48, 5.32, math.cos(a) * 0.48), color=IRONL, **hd)
    for k in range(4):  # the beard to the chest, braided
        m.part('cyl', 0.08, 0.05, 0.7, 6, p=(-0.27 + k * 0.18, 3.7, 0.5), color=0x2a1e18, **hd)
    cl = dict(bone='arm.R')
    m.part('cyl', 0.12, 0.12, 2.0, 8, p=(1.2, 2.2, 0.35), color=DARKWOOD, **cl)
    m.part('cyl', 0.42, 0.3, 2.2, 10, p=(1.2, 4.2, 0.35), color=IRONK, **cl)  # the iron club
    for k in range(10):
        a = k * 2.4
        m.part('cone', 0.1, 0.36, 4, p=(1.2 + math.sin(a) * 0.4, 3.5 + k * 0.17, 0.35 + math.cos(a) * 0.4), r=(math.cos(a) * 1.5, 0, -math.sin(a) * 1.5), color=IRONL, **cl)
    sh = dict(bone='arm.L')  # a shield like the iron bedstead: a frame of bars
    for y in (1.8, 2.6, 3.4):
        m.part('box', 0.14, 0.12, 1.7, p=(-1.55, y, 0.25), color=IRONL, **sh)
    for z in (-0.55, 0.25, 1.05):
        m.part('box', 0.16, 1.9, 0.12, p=(-1.55, 2.6, z), color=IRONK, **sh)
    rigged('ogue', m, GIANT_BONES, giant_clips(22, 7), 1.0)


def adonizedeque():
    """Adoni-zedek, king of Jerusalem, who called four kings against Gibeon (Js 10:1-5)."""
    m = Model('adonizedeque', 34)
    SILVER, ROYAL, GREY = 0xc9d2dc, 0x2e4f8a, 0x9a948c
    giant(m, SKIN2, 0x3a2e2a, ROYAL, ROYAL, SILVER, belt=GOLD, boots=LEATHER, beard=GREY, robe=ROYAL, sleeve=WHITE)
    body = dict(bone='hips')
    m.part('ball', 0.74, 2, p=(0, 3.0, 0.42), s=(1, 0.85, 0.32), color=SILVER, **body)  # silver breastplate
    m.part('torus', 0.26, 0.05, 2 * PI, 16, p=(0, 3.05, 0.66), color=GOLD, **body)  # a gold sun disc
    m.part('ball', 0.13, 1, p=(0, 3.05, 0.68), s=(1, 1, 0.4), color=GOLD, **body)
    m.part('box', 1.85, 2.7, 0.12, p=(0, 2.4, -0.62), r=(-0.08, 0, 0), color=0xb8283a, bevel=0.03, **body)  # cape
    hd = dict(bone='head')
    m.part('box', 0.86, 0.32, 0.84, p=(0, 4.88, 0), color=GREY, bevel=0.08, **hd)
    m.part('cyl', 0.5, 0.47, 0.34, 12, p=(0, 5.08, 0), color=GOLD, **hd)
    for k in range(8):  # a tall crown, gems between the points
        a = k / 8 * 2 * PI
        m.part('cone', 0.09, 0.5, 5, p=(math.sin(a) * 0.46, 5.48, math.cos(a) * 0.46), color=GOLD, **hd)
        m.part('ball', 0.06, 1, p=(math.sin(a + 0.4) * 0.5, 5.1, math.cos(a + 0.4) * 0.5), color=0x3a8ad9 if k % 2 else 0xd94a4a, **hd)
    sw = dict(bone='arm.R')
    m.part('box', 0.1, 2.6, 0.28, p=(1.2, 3.3, 0.45), color=0xe2e8ee, bevel=0.02, **sw)
    m.part('box', 0.7, 0.12, 0.16, p=(1.2, 2.0, 0.45), color=GOLD, **sw)
    m.part('cone', 0.15, 0.42, 4, p=(1.2, 4.8, 0.45), color=0xe2e8ee, **sw)
    sh = dict(bone='arm.L')
    m.part('cyl', 0.95, 0.95, 0.16, 18, p=(-1.5, 2.65, 0.25), r=(0, 0, PI / 2), color=SILVER, **sh)
    m.part('cyl', 0.7, 0.7, 0.18, 16, p=(-1.52, 2.65, 0.25), r=(0, 0, PI / 2), color=ROYAL, **sh)
    m.part('torus', 0.92, 0.06, 2 * PI, 18, p=(-1.6, 2.65, 0.25), r=(0, PI / 2, 0), color=GOLD, **sh)
    m.part('ball', 0.22, 1, p=(-1.62, 2.65, 0.25), color=GOLD, **sh)
    rigged('adonizedeque', m, GIANT_BONES, giant_clips(22, 4), 0.88)


# ---------- Relics, weapons, the scroll ----------
def items():
    def mk(name, seed=1):
        return Model(name, seed)
    m = mk('relic_efode')
    m.part('box', 0.9, 1.0, 0.12, color=GOLD, bevel=0.03)
    m.part('box', 0.72, 0.82, 0.14, color=BLUE, bevel=0.02)
    for k in range(12):  # twelve stones, one per tribe (Êx 28:17-21)
        p = (-0.22 + (k % 3) * 0.22, 0.3 - (k // 3) * 0.2, 0.09)
        m.part('cyl', 0.095, 0.095, 0.03, 8, p=(p[0], p[1], 0.075), r=(PI / 2, 0, 0), color=GOLD)
        m.part('ball', 0.075, 1, p=p, color=[0xd94a4a, 0x4ad97a, 0x4a8ad9, 0xe8c84a, 0xb04ad9, 0x7fe0e0][k % 6])
        shine(m, p, 0.075)
    for x in (-0.38, 0.38):
        m.part('torus', 0.06, 0.02, 2 * PI, 8, p=(x, 0.55, 0), color=GOLD)
    out('items', m)
    m = mk('relic_urim')
    for x, c in ((-0.27, WHITE), (0.27, 0x2a2a35)):
        m.part('torus', 0.3, 0.035, 2 * PI, 16, p=(x, 0, 0.0), color=GOLD)
        m.part('ball', 0.28, 1, p=(x, 0, 0.02), s=(1, 1, 0.7), color=c)
        shine(m, (x, 0, 0.02), 0.28)
    m.part('box', 0.18, 0.02, 0.02, p=(-0.27, 0.05, 0.29), color=GOLD)
    out('items', m)
    m = mk('relic_oleo')
    for k in range(6):
        m.part('cyl', 0.05 + k * 0.035, 0.05 + (k + 1) * 0.035, 0.2, 10, p=(math.sin(k * 0.25) * 0.3 - 0.1, 0.45 - k * 0.18, 0), r=(0, 0, k * 0.15),
               color=0xe8dcc0 if k < 4 else 0xc8b890)
    m.part('cyl', 0.27, 0.27, 0.08, 12, p=(0.05, -0.62, 0), color=GOLD)
    m.part('ball', 0.08, 1, p=(-0.1, 0.58, 0), color=GOLD)
    out('items', m)
    m = mk('relic_sandalias')
    for x, a in ((-0.22, 0.15), (0.22, -0.15)):
        m.part('box', 0.3, 0.06, 0.8, p=(x, 0, 0), r=(0, a, 0), color=LEATHER, bevel=0.02)
        for z in (-0.15, 0.1, 0.3):
            m.part('box', 0.32, 0.05, 0.05, p=(x + z * a * 0.4, 0.06, z), r=(0, a, 0), color=DARKWOOD)
        m.part('torus', 0.09, 0.02, PI, 8, p=(x - 0.05 * a, 0.08, -0.32), r=(0, a, 0), color=DARKWOOD)
    out('items', m)
    m = mk('relic_tunica')
    m.part('box', 0.7, 0.95, 0.2, color=0xd94a4a, bevel=0.04)
    m.part('box', 1.25, 0.3, 0.2, p=(0, 0.32, 0), color=0xd94a4a, bevel=0.04)
    for k, c in enumerate([0x4a8ad9, 0xe8c84a, 0x4ad97a, 0x9a4ad9, 0xf08a3a]):
        m.part('box', 0.72, 0.08, 0.22, p=(0, -0.38 + k * 0.15, 0), color=c)
    m.part('box', 0.2, 0.08, 0.22, p=(0, 0.44, 0.02), color=DARK)
    out('items', m)
    m = mk('relic_vaso')
    m.part('lathe', [(0, -0.45), (0.3, -0.42), (0.4, -0.15), (0.35, 0.15), (0.16, 0.32), (0.19, 0.45), (0.14, 0.47)], 14, color=0xb0643a)
    m.part('cyl', 0.38, 0.38, 0.06, 14, color=0x7a3a1e)
    for x in (-0.28, 0.28):
        m.part('torus', 0.1, 0.03, PI, 8, p=(x, 0.18, 0), r=(0, 0, PI / 2 if x > 0 else -PI / 2), color=0xb0643a)
    m.part('ball', 0.08, 1, p=(0.0, 0.52, 0), color=GOLD)
    out('items', m)
    m = mk('relic_couraca')
    m.part('box', 0.9, 0.95, 0.35, color=BRONZE, bevel=0.06)
    for row in range(4):
        for k in range(5):
            m.part('box', 0.17, 0.15, 0.05, p=(-0.34 + k * 0.17 + (row % 2) * 0.08, -0.3 + row * 0.2, 0.19), r=(0.2, 0, 0), color=0xb08a42 if (row + k) % 2 else 0x8a6a2e)
    for x in (-0.5, 0.5):
        m.part('ball', 0.25, 1, p=(x, 0.42, 0), color=BRONZE)
    out('items', m)
    m = mk('relic_shofar')
    for k in range(9):
        a = k * 0.36
        m.part('cyl', 0.05 + k * 0.022, 0.05 + (k + 1) * 0.022, 0.2, 9, p=(math.cos(a) * 0.4 - 0.2, math.sin(a) * 0.4, 0), r=(0, 0, a),
               color=0xe8dcc0 if k > 6 else 0xb89a6a if k % 2 else 0xa08458)
    out('items', m)
    m = mk('relic_ezequias')
    m.part('cyl', 0.55, 0.62, 0.15, 16, p=(0, -0.2, 0), color=STONE, bevel=0.02)
    m.part('cyl', 0.46, 0.46, 0.04, 16, p=(0, -0.1, 0), color=CREAM)
    m.part('box', 0.05, 0.45, 0.32, p=(0, 0.1, 0), r=(0, 0, 0), color=BRONZE)
    for k in range(10):
        a = k / 10 * PI + PI / 2
        m.part('box', 0.03, 0.02, 0.12, p=(math.cos(a) * 0.36, -0.07, math.sin(a) * 0.36), r=(0, -a, 0), color=DARK)
    for k in range(3):  # the steps the shadow went back on (2 Rs 20:11)
        m.part('box', 0.9 - k * 0.2, 0.08, 0.25, p=(0, -0.32 + k * 0.08, 0.5 - k * 0.1), color=PALE)
    out('items', m)
    m = mk('relic_cordao')
    for k in range(3):
        m.part('torus', 0.34 - k * 0.04, 0.06, 2 * PI, 16, p=(0, k * 0.1, 0), r=(1.25, 0, 0), color=0xc8243a if k % 2 else 0xe03a50)
    m.part('box', 0.07, 0.55, 0.07, p=(0.34, -0.3, 0), color=0xc8243a)
    m.part('cone', 0.08, 0.15, 6, p=(0.34, -0.62, 0), r=(PI, 0, 0), color=0xe03a50)
    out('items', m)
    m = mk('relic_pedras')
    for k, p in enumerate([(-0.3, 0, 0), (0.3, 0, 0.05), (0, 0, -0.25), (0, 0, 0.3), (0, 0.25, 0)]):  # five smooth stones (1 Sm 17:40)
        m.part('ball', 0.2, 2, p=p, s=(1.2, 0.8, 1), color=[0xb8b0a0, 0x9c958a, 0xc9c2b4, 0xa9a294, 0xd4cdbf][k], smooth=True, rough=0.02, seed=k)
        shine(m, p, 0.16)
    out('items', m)
    m = mk('relic_aguia')
    for sd in (-1, 1):
        for k in range(5):
            m.part('box', 0.13, 0.72 - k * 0.1, 0.05, p=(sd * (0.13 + k * 0.12), 0.12 - k * 0.04, 0), r=(0, 0, sd * (0.45 + k * 0.22)),
                   color=WHITE if k % 2 else 0x8a5a32, bevel=0.01)
    m.part('ball', 0.1, 1, p=(0, -0.05, 0.02), color=0x8a5a32)
    out('items', m)

    # Weapons (level-up icons; the wheel also orbits the hero in game).
    m = mk('weapon_funda')
    for x, a in ((-0.15, 0.35), (0.15, -0.35)):
        m.part('box', 0.03, 0.8, 0.03, p=(x, 0, 0), r=(0, 0, a), color=LEATHER)
    m.part('box', 0.3, 0.12, 0.2, p=(0, -0.38, 0), color=LEATHER, bevel=0.03)
    m.part('ball', 0.13, 2, p=(0, -0.3, 0.06), color=STONE, smooth=True)
    m.part('torus', 0.06, 0.02, 2 * PI, 8, p=(-0.28, 0.4, 0), color=LEATHER)
    out('items', m)
    m = mk('weapon_flechas')
    m.part('torus', 0.6, 0.04, PI, 14, r=(0, 0, -PI / 2), color=WOOD)
    m.part('box', 0.012, 1.2, 0.012, color=WHITE)
    for k in range(2):
        m.part('box', 0.03, 1.3, 0.03, p=(0.22 + k * 0.08, 0, 0), r=(0, 0, 0.5), color=WOOD)
        m.part('cone', 0.06, 0.18, 4, p=(-0.1 + k * 0.08, 0.6, 0), r=(0, 0, 0.5), color=IRON)
        m.part('box', 0.1, 0.12, 0.01, p=(0.52 + k * 0.08, -0.55, 0), r=(0, 0, 0.5), color=WHITE)
    out('items', m)
    m = mk('weapon_queixada')  # a donkey's jawbone (Jz 15:15): body, the rising branch, a row of teeth
    m.part('box', 1.0, 0.24, 0.14, p=(-0.05, -0.1, 0), r=(0, 0, 0.12), color=BONE, bevel=0.06)
    m.part('box', 0.26, 0.6, 0.14, p=(0.48, 0.18, 0), r=(0, 0, -0.35), color=BONE, bevel=0.06)
    m.part('ball', 0.11, 1, p=(0.6, 0.48, 0), color=BONE)
    for k in range(7):
        m.part('box', 0.09, 0.13, 0.11, p=(-0.45 + k * 0.12, 0.06 + k * 0.014, 0), color=WHITE, bevel=0.015)
    m.part('box', 0.98, 0.05, 0.15, p=(-0.05, -0.22, 0), r=(0, 0, 0.12), color=0xc9bc9c)
    out('items', m)
    m = mk('weapon_cajado')
    m.part('cyl', 0.05, 0.06, 1.6, 8, color=WOOD)
    for k in range(3):
        m.part('torus', 0.12, 0.045, 2 * PI, 10, p=(0, -0.4 + k * 0.32, 0), r=(PI / 2 + 0.3, 0, 0), color=0x5fa04a if k % 2 else 0x7fbf5a)
    m.part('box', 0.16, 0.12, 0.24, p=(0, 0.62, 0.1), color=0x5fa04a, bevel=0.03)
    for x in (-0.05, 0.05):
        m.part('box', 0.04, 0.04, 0.02, p=(x, 0.66, 0.22), color=GOLD)
    m.part('box', 0.02, 0.02, 0.12, p=(0, 0.6, 0.28), color=RED)
    out('items', m)
    for name in ('weapon_rodas', 'proj_wheel'):
        m = mk(name)
        m.part('torus', 0.6, 0.07, 2 * PI, 20, color=GOLD)
        m.part('torus', 0.38, 0.05, 2 * PI, 16, color=BRONZE)
        for k in range(4):
            m.part('box', 0.05, 1.2, 0.05, r=(0, 0, k * PI / 4), color=BRONZE)
        m.part('ball', 0.1, 1, color=GOLD)
        for k in range(10):  # wheels full of eyes (Ez 1:18)
            a = k / 10 * 2 * PI
            m.part('ball', 0.09, 1, p=(math.cos(a) * 0.6, math.sin(a) * 0.6, 0.06), color=WHITE)
            m.part('ball', 0.045, 1, p=(math.cos(a) * 0.6, math.sin(a) * 0.6, 0.13), color=0x2a6fbf)
        out('items', m)
    m = mk('weapon_sarca')
    for k, (x, y, z, r) in enumerate(((0, -0.2, 0, 0.35), (0.25, -0.1, 0.1, 0.28), (-0.25, -0.15, 0.05, 0.25), (0.05, -0.25, -0.2, 0.25))):
        m.part('ball', r, 1, p=(x, y, z), color=0x4f7f34 if k % 2 else 0x5f9a3e, rough=0.04, seed=k)
    for k, (x, h, c) in enumerate(((0, 0.6, 0xff8a3d), (0.18, 0.45, 0xffd25a), (-0.16, 0.4, 0xffd25a), (0.05, 0.3, 0xfff1a0))):
        m.part('cone', 0.16 - k * 0.02, h, 6, p=(x, 0.15 + h / 2, 0.02 * k), color=c)
    out('items', m)
    m = mk('weapon_granizo')
    for k, (x, y, z, r) in enumerate(((0, 0, 0, 0.32), (0.35, 0.25, 0, 0.22), (-0.3, 0.3, 0.1, 0.18), (0.1, -0.35, 0.1, 0.12))):
        m.part('ball', r, 1, p=(x, y, z), color=0xdff4ff if k % 2 else 0xbfe6ff, rough=0.03, seed=k)
    out('items', m)
    m = mk('weapon_trombeta')
    m.part('cyl', 0.04, 0.04, 1.1, 8, r=(0, 0, PI / 2), color=0xd8dde3)
    m.part('cone', 0.24, 0.42, 14, p=(0.72, 0, 0), r=(0, 0, PI / 2), color=0xd8dde3)
    m.part('torus', 0.23, 0.02, 2 * PI, 14, p=(0.52, 0, 0), r=(0, PI / 2, 0), color=GOLD)
    m.part('cyl', 0.07, 0.07, 0.1, 8, p=(-0.55, 0, 0), r=(0, 0, PI / 2), color=GOLD)
    out('items', m)
    m = mk('scroll')
    m.part('box', 0.8, 0.9, 0.03, color=0xf3e6c4)
    for y in (0.48, -0.48):
        m.part('cyl', 0.07, 0.07, 1.0, 8, p=(0, y, 0), r=(0, 0, PI / 2), color=DARKWOOD)
        for x in (-0.52, 0.52):
            m.part('ball', 0.06, 1, p=(x, y, 0), color=GOLD)
    for k, y in enumerate((0.25, 0.12, -0.01, -0.14)):
        m.part('box', 0.55 - k * 0.07, 0.03, 0.02, p=(0, y, 0.02), color=0x8a6a3e)
    m.part('cyl', 0.1, 0.1, 0.05, 10, p=(0.18, -0.3, 0.03), r=(PI / 2, 0, 0), color=RED)
    out('items', m)

    # Projectiles and pickups (forward is +Z).
    m = mk('proj_stone')
    m.part('ball', 1, 1, color=STONE, rough=0.15, seed=3)
    out('items', m)
    m = mk('proj_arrow')
    m.part('cyl', 0.12, 0.12, 4, 6, r=(PI / 2, 0, 0), color=WOOD)
    m.part('cone', 0.3, 0.8, 4, p=(0, 0, 2.3), r=(PI / 2, 0, 0), color=IRON)
    for a in (0, PI / 2):
        m.part('box', 0.6, 0.05, 0.8, p=(0, 0, -1.7), r=(0, 0, a), color=WHITE)
    out('items', m)
    m = mk('proj_snake')
    for k in range(5):
        m.part('ball', 0.55 - k * 0.07, 1, p=(math.sin(k * 1.3) * 0.3, 0, -k * 0.7), color=0x8fcf6a if k % 2 else 0x5fa04a)
    m.part('box', 0.7, 0.4, 0.8, p=(0, 0, 0.6), color=0x5fa04a, bevel=0.1)
    for x in (-0.22, 0.22):
        m.part('box', 0.12, 0.12, 0.05, p=(x, 0.15, 0.9), color=0xf2c14e)
    m.part('box', 0.06, 0.04, 0.5, p=(0, -0.1, 1.15), color=RED)
    out('items', m)
    m = mk('proj_spear')
    m.part('cyl', 0.1, 0.1, 3.6, 8, r=(PI / 2, 0, 0), color=DARKWOOD)
    m.part('cone', 0.18, 0.7, 6, p=(0, 0, 2.1), r=(PI / 2, 0, 0), color=IRON)
    for k in range(2):
        m.part('cyl', 0.12, 0.12, 0.1, 8, p=(0, 0, 0.8 + k * 0.4), r=(PI / 2, 0, 0), color=LEATHER)
    out('items', m)
    m = mk('proj_hail')
    m.part('ball', 0.35, 1, color=0xdff4ff, rough=0.05)
    m.part('ball', 0.2, 1, p=(0.25, 0.15, 0.1), color=0xbfe6ff)
    out('items', m)
    m = mk('proj_mana')
    m.part('cone', 0.22, 0.3, 4, p=(0, 0.15, 0), color=0xbff0ff)
    m.part('cone', 0.22, 0.3, 4, p=(0, -0.15, 0), r=(PI, 0, 0), color=0x9fe0ff)
    m.part('cone', 0.1, 0.14, 4, p=(0, 0.1, 0.06), color=WHITE)
    out('items', m)
    m = mk('proj_coin')
    m.part('cyl', 0.22, 0.22, 0.07, 14, r=(PI / 2, 0, 0), color=GOLD, bevel=0.01)
    m.part('torus', 0.19, 0.015, 2 * PI, 14, p=(0, 0, 0.04), color=0xc99a2e)
    m.part('box', 0.07, 0.18, 0.03, p=(0, 0, 0.04), color=0xc99a2e)
    out('items', m)
    stage2_items(mk)


FIRE, FIRE2, FIRE3 = 0xff8a3d, 0xffd25a, 0xfff1a0


def axe_head(m, s=1.0):
    m.part('box', 0.5 * s, 0.32 * s, 0.07 * s, p=(0.12 * s, 0.25 * s, 0), color=IRON, bevel=0.02 * s)
    m.part('box', 0.1 * s, 0.5 * s, 0.075 * s, p=(0.36 * s, 0.25 * s, 0), color=0xd8dde3, bevel=0.015 * s)
    m.part('cyl', 0.06 * s, 0.06 * s, 0.14 * s, 8, p=(-0.12 * s, 0.25 * s, 0), r=(PI / 2, 0, 0), color=DARK)


def stage2_items(mk):
    # New weapons.
    m = mk('weapon_machado')  # the axe head that floated (2 Rs 6:6)
    m.part('cyl', 0.045, 0.05, 1.2, 8, p=(-0.12, -0.25, 0), color=WOOD)
    axe_head(m, 1.3)
    for k in range(3):
        m.part('ball', 0.05, 1, p=(0.3 + k * 0.12, -0.45 + k * 0.05, 0.05), color=0x9fd8ff)
    out('items', m)
    m = mk('weapon_carros')  # a chariot of fire (2 Rs 2:11)
    m.part('box', 0.8, 0.1, 0.55, p=(0, 0.1, 0), color=GOLD, bevel=0.02)
    m.part('box', 0.8, 0.45, 0.06, p=(0, 0.35, 0.25), color=GOLD, bevel=0.02)
    for x in (-0.42, 0.42):
        wheel(m, x, 0.05, 0.0, 0xd97a2a, GOLD, r=0.3)
    for k, (x, h, c) in enumerate(((-0.25, 0.7, FIRE), (0.05, 0.9, FIRE2), (0.3, 0.6, FIRE), (0, 0.5, FIRE3))):
        m.part('cone', 0.16, h, 6, p=(x, 0.3 + h / 2, -0.15 + k * 0.06), color=c)
    out('items', m)
    m = mk('weapon_gafanhotos')  # locusts on the east wind (Êx 10:13)
    for k, (x, y, s) in enumerate(((0, 0, 1.3), (0.38, 0.3, 0.8), (-0.35, 0.28, 0.8), (0.1, -0.4, 0.7))):
        locust(m, x, y, 0, s)
    out('items', m)
    m = mk('weapon_fogo')  # fire from heaven (1 Rs 18:38)
    for k, (x, y, r) in enumerate(((0, 0.5, 0.35), (0.3, 0.55, 0.28), (-0.3, 0.55, 0.26))):
        m.part('ball', r, 1, p=(x, y, 0), s=(1.2, 0.7, 1), color=0xb8b0c0 if k else 0xc9c2d0)
    for k, (x, h, c) in enumerate(((0, 1.0, FIRE), (0.12, 0.8, FIRE2), (-0.1, 0.7, FIRE3))):
        m.part('cone', 0.17 - k * 0.03, h, 6, p=(x, 0.3 - h / 2, 0.02 * k), r=(PI, 0, 0), color=c)
    out('items', m)
    # Projectiles.
    m = mk('proj_axe')
    m.part('cyl', 0.06, 0.06, 0.6, 6, p=(0, -0.1, 0), color=WOOD)
    axe_head(m, 1.6)
    out('items', m)
    m = mk('proj_chariot')  # forward +Z
    m.part('box', 1.6, 0.18, 1.2, p=(0, 0.75, -0.6), color=GOLD, bevel=0.03)
    m.part('box', 1.6, 0.8, 0.12, p=(0, 1.15, 0.0), color=GOLD, bevel=0.03)
    for x in (-0.9, 0.9):
        wheel(m, x, 0.62, -0.6, 0xd97a2a, GOLD, r=0.62)
    m.part('box', 0.1, 0.1, 1.6, p=(0, 0.75, 0.8), color=GOLD)
    for x in (-0.35, 0.35):  # horses of fire
        m.part('box', 0.34, 0.42, 1.1, p=(x, 1.05, 1.9), color=FIRE, bevel=0.08)
        m.part('box', 0.22, 0.5, 0.26, p=(x, 1.45, 2.4), r=(-0.5, 0, 0), color=FIRE2, bevel=0.05)
        m.part('box', 0.2, 0.2, 0.42, p=(x, 1.7, 2.6), color=FIRE2, bevel=0.05)
        for z in (1.5, 2.3):
            m.part('cone', 0.08, 0.6, 5, p=(x, 0.5, z), r=(PI, 0, 0), color=FIRE)
        m.part('cone', 0.12, 0.6, 5, p=(x, 1.75, 2.15), r=(-0.8, 0, 0), color=FIRE3)
    for k in range(7):  # the blaze behind
        m.part('cone', 0.25, 1.2 - k * 0.1, 5, p=((k % 3 - 1) * 0.5, 1.3, -1.0 - k * 0.15), r=(-1.2, 0, 0), color=[FIRE, FIRE2, FIRE3][k % 3])
    out('items', m)
    m = mk('proj_locust')
    locust(m, 0, 0, 0, 1)
    out('items', m)
    m = mk('proj_fire')  # a column of fire, base at y = 0
    for k, (r, h, c) in enumerate(((0.9, 5.0, FIRE), (0.6, 6.0, FIRE2), (0.32, 6.5, FIRE3))):
        m.part('cyl', r * 0.5, r, h, 10, p=(0, h / 2, 0), color=c, jitter=0)
    out('items', m)
    # New relics.
    m = mk('relic_manto')  # Elijah's mantle (2 Rs 2:13), folded
    for k in range(3):
        m.part('box', 0.9 - k * 0.05, 0.12, 0.7, p=(0, -0.2 + k * 0.13, 0), r=(0, k * 0.08, 0), color=[0x8a6a4a, 0x7a5a3a, 0x9a7a5a][k], bevel=0.05)
    m.part('box', 0.92, 0.04, 0.1, p=(0, 0.12, 0.3), color=GOLD)
    m.part('torus', 0.12, 0.03, 2 * PI, 10, p=(0.3, 0.17, 0.1), r=(PI / 2, 0, 0), color=GOLD)
    out('items', m)
    m = mk('relic_mel')  # a honeycomb (Jz 14:8)
    for k in range(7):
        a = k / 6 * 2 * PI
        x, y = (0, 0) if k == 6 else (math.cos(a) * 0.3, math.sin(a) * 0.3)
        m.part('cyl', 0.16, 0.16, 0.22, 6, p=(x, y, 0), r=(PI / 2, 0, 0), color=0xe8a82a if k % 2 else 0xf0bc3a)
        m.part('cyl', 0.11, 0.11, 0.23, 6, p=(x, y, 0.005), r=(PI / 2, 0, 0), color=0xb8721a)
    m.part('ball', 0.08, 1, p=(0.05, -0.42, 0.08), s=(0.8, 1.3, 0.8), color=0xf6c84a)
    shine(m, (0, 0, 0.1), 0.2)
    out('items', m)
    m = mk('relic_anel')  # Joseph's signet ring (Gn 41:42)
    m.part('torus', 0.38, 0.08, 2 * PI, 20, color=GOLD)
    m.part('cyl', 0.2, 0.2, 0.12, 10, p=(0, 0.42, 0), color=GOLD)
    m.part('cyl', 0.15, 0.15, 0.13, 10, p=(0, 0.43, 0), color=0x3a8a5a)
    shine(m, (0, 0.5, 0), 0.15)
    out('items', m)
    m = mk('relic_cetro')  # the sceptre of Judah (Gn 49:10)
    m.part('cyl', 0.05, 0.06, 1.3, 8, p=(0, -0.1, 0), color=GOLD)
    m.part('ball', 0.17, 1, p=(0, 0.62, 0), color=GOLD)
    for k in range(5):
        a = k / 5 * 2 * PI
        m.part('cone', 0.05, 0.18, 5, p=(math.cos(a) * 0.12, 0.8, math.sin(a) * 0.12), color=GOLD)
    m.part('ball', 0.08, 1, p=(0, 0.65, 0.14), color=0xd94a4a)
    m.part('cyl', 0.09, 0.09, 0.05, 8, p=(0, -0.3, 0), color=0xd94a4a)
    out('items', m)
    m = mk('relic_harpa')  # David's harp (1 Sm 16:23)
    m.part('torus', 0.5, 0.06, PI * 1.2, 16, p=(0, 0, 0), r=(0, 0, -0.1 * PI), color=WOOD)
    m.part('box', 0.08, 1.0, 0.08, p=(-0.42, 0.05, 0), r=(0, 0, 0.12), color=DARKWOOD)
    for k in range(6):
        x = -0.3 + k * 0.12
        h = math.sqrt(max(0.05, 0.25 - (x + 0.02) ** 2)) * 1.6
        m.part('box', 0.012, h, 0.012, p=(x, 0.05, 0.02), color=0xf3e6c4)
    m.part('ball', 0.07, 1, p=(0.45, 0.25, 0), color=GOLD)
    out('items', m)
    # Pickups.
    m = mk('pick_pao')  # bread baked on the stones (1 Rs 19:6)
    m.part('ball', 0.4, 2, p=(0, 0, 0), s=(1.2, 0.55, 0.9), color=0xc9862e, smooth=True)
    for k in range(3):
        m.part('box', 0.05, 0.03, 0.4, p=(-0.2 + k * 0.2, 0.2, 0), r=(0, 0.3, 0), color=0xf0d8a0)
    out('items', m)
    m = mk('pick_codornizes')  # quails (Êx 16:13)
    for x, a in ((-0.22, 0.3), (0.22, -0.3)):
        m.part('ball', 0.22, 1, p=(x, 0, 0), s=(1, 0.85, 1.3), color=0x9a7a5a)
        m.part('ball', 0.12, 1, p=(x, 0.18, 0.2), color=0x8a6a4a)
        m.part('cone', 0.03, 0.08, 4, p=(x, 0.18, 0.33), r=(PI / 2, 0, 0), color=0xe8b84a)
        m.part('box', 0.2, 0.05, 0.25, p=(x, 0.05, -0.05), r=(0, a, 0.2), color=0x6a4a32)
    out('items', m)
    m = mk('pick_botija')  # the widow's jar of oil (1 Rs 17:16)
    m.part('lathe', [(0, -0.35), (0.22, -0.3), (0.28, -0.05), (0.2, 0.18), (0.08, 0.28), (0.1, 0.38), (0.07, 0.4)], 12, color=0xb0643a)
    m.part('ball', 0.08, 1, p=(0, 0.47, 0), s=(0.8, 1.2, 0.8), color=0xf2c14e)
    out('items', m)
    # Relics opened by trophies.
    m = mk('relic_tabuas')  # the tablets of the Law (Êx 31:18)
    for x in (-0.28, 0.28):
        m.part('box', 0.5, 0.72, 0.1, p=(x, -0.05, 0), color=0xb8b0a0, bevel=0.03)
        m.part('cyl', 0.25, 0.25, 0.1, 12, p=(x, 0.31, 0), r=(PI / 2, 0, 0), color=0xb8b0a0)
        for k in range(5):
            m.part('box', 0.3, 0.025, 0.02, p=(x, 0.25 - k * 0.12, 0.06), color=0x6a6458)
    out('items', m)
    m = mk('relic_escudo')  # "I am your shield" (Gn 15:1)
    m.part('cyl', 0.5, 0.5, 0.1, 18, r=(PI / 2, 0, 0), color=BRONZE, bevel=0.02)
    m.part('torus', 0.48, 0.04, 2 * PI, 18, p=(0, 0, 0.05), color=GOLD)
    m.part('cone', 0.12, 0.12, 8, p=(0, 0, 0.1), r=(PI / 2, 0, 0), color=GOLD)
    for k in range(8):
        a = k / 8 * 2 * PI
        m.part('ball', 0.035, 1, p=(math.cos(a) * 0.36, math.sin(a) * 0.36, 0.06), color=GOLD)
    shine(m, (0, 0, 0.05), 0.4)
    out('items', m)
    m = mk('relic_candelabro')  # the golden lampstand, seven lamps (Êx 25:31-37)
    m.part('cyl', 0.03, 0.04, 0.8, 8, p=(0, 0, 0), color=GOLD)
    m.part('cyl', 0.2, 0.26, 0.08, 10, p=(0, -0.42, 0), color=GOLD)
    for k, x in enumerate((0.36, 0.24, 0.12)):
        for sd in (-1, 1):
            m.part('torus', x / 2, 0.022, PI, 10, p=(sd * x / 2, 0.02, 0), r=(0, 0, PI), color=GOLD)
            m.part('cyl', 0.022, 0.022, 0.3 + k * 0.05, 6, p=(sd * x, 0.16, 0), color=GOLD)
    for x in (-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36):
        m.part('cone', 0.035, 0.12, 6, p=(x, 0.4 if x else 0.46, 0), color=0xffd25a)
    out('items', m)
    m = mk('relic_paes')  # the bread of the Presence on its table (Êx 25:30)
    m.part('box', 0.9, 0.06, 0.55, p=(0, -0.2, 0), color=GOLD, bevel=0.02)
    for k in range(6):
        m.part('ball', 0.13, 1, p=(-0.3 + (k % 3) * 0.3, -0.1 + (k // 3) * 0.12, -0.08 + (k // 3) * 0.12), s=(1.3, 0.6, 1), color=0xc9862e)
    out('items', m)
    m = mk('relic_arco')  # the rainbow in the cloud (Gn 9:13)
    for k, c in enumerate((0xd94a4a, 0xf08a3a, 0xe8c84a, 0x4ad97a, 0x4a8ad9, 0x9a4ad9)):
        m.part('torus', 0.55 - k * 0.06, 0.035, PI, 18, color=c)
    for x in (-0.45, 0.45):
        m.part('ball', 0.16, 1, p=(x, -0.05, 0.02), s=(1.4, 0.8, 1), color=WHITE)
    out('items', m)
    m = mk('relic_sal')  # salt of the covenant (Lv 2:13)
    m.part('lathe', [(0, -0.3), (0.3, -0.28), (0.36, -0.05), (0.3, 0.12), (0.32, 0.18)], 12, color=0x8a6a4a)
    for k in range(7):
        m.part('box', 0.1, 0.1, 0.1, p=((k % 3 - 1) * 0.12, 0.18 + (k // 3) * 0.06, ((k + 1) % 2 - 0.5) * 0.12), r=(k, k * 2, 0), color=WHITE)
    out('items', m)
    m = mk('pick_tocha')  # Gideon's torch in a broken jar (Jz 7:20)
    m.part('cyl', 0.05, 0.06, 0.8, 6, p=(0, -0.1, 0), color=DARKWOOD)
    m.part('lathe', [(0.12, 0.2), (0.2, 0.25), (0.18, 0.4), (0.1, 0.45)], 8, color=0xb0643a)
    for k, (h, c) in enumerate(((0.5, FIRE), (0.38, FIRE2), (0.24, FIRE3))):
        m.part('cone', 0.15 - k * 0.03, h, 6, p=(0, 0.42 + h / 2, 0), color=c)
    out('items', m)


def locust(m, x, y, z, s):
    m.part('box', 0.14 * s, 0.13 * s, 0.5 * s, p=(x, y, z), color=0x7a9a3e, bevel=0.03 * s)
    m.part('box', 0.13 * s, 0.13 * s, 0.14 * s, p=(x, y + 0.03 * s, z + 0.3 * s), color=0x6a8a36, bevel=0.03 * s)
    for sd in (-1, 1):
        m.part('box', 0.25 * s, 0.015 * s, 0.4 * s, p=(x + sd * 0.12 * s, y + 0.08 * s, z - 0.05 * s), r=(0, sd * 0.25, sd * 0.2), color=0xc9d6a8)
        m.part('box', 0.03 * s, 0.03 * s, 0.35 * s, p=(x + sd * 0.1 * s, y - 0.08 * s, z - 0.1 * s), r=(0.5, 0, 0), color=0x5a7a2e)


# ---------- Scenery ----------
def bricks(m, w, h, d, seed, x=0, y=0, z=0, row=0.38, moss=True, ragged=0.0, alongz=False, pal=None):
    r = random.Random(seed)
    rows = max(1, round(h / row))
    rh = h / rows
    for j in range(rows):
        top = j == rows - 1
        u = -w / 2
        while u < w / 2 - 0.05:
            bw = min(w / 2 - u, 0.5 + r.random() * 0.7)
            if not (top and ragged and r.random() < ragged):
                cx, cz = (x, z + u + bw / 2) if alongz else (x + u + bw / 2, z)
                size = (d - r.random() * 0.06, rh - 0.04, bw - 0.04) if alongz else (bw - 0.04, rh - 0.04, d - r.random() * 0.06)
                m.part('box', *size, p=(cx, y + rh * (j + 0.5), cz), color=r.choice(pal or SLATE), bevel=0.025, jitter=0.1, soft=0.09)  # worn, still bricks
                if top and moss and r.random() < 0.5:
                    ms = (d * 0.8, 0.06, bw * 0.8) if alongz else (bw * 0.8, 0.06, d * 0.8)
                    m.part('box', *ms, p=(cx, y + rh * (j + 1) + 0.02, cz), color=MOSS, bevel=0.02, jitter=0.15)
            u += bw


def props():
    P = lambda name, seed=1: Model(name, seed)
    for kind, pal in LEAVES.items():
        m = P(f'prop_tree_{kind}', 7 + len(kind))
        r = random.Random(len(kind) * 31)
        m.part('cyl', 0.2, 0.36, 2.2, 7, p=(0, 1.1, 0), r=(0, 0, 0.06), color=TRUNK, rough=0.03)
        for a in (0, 2.1, 4.2):
            m.part('cone', 0.16, 0.5, 5, p=(math.sin(a) * 0.3, 0.15, math.cos(a) * 0.3), r=(math.cos(a) * 0.6, 0, -math.sin(a) * 0.6), color=TRUNK)
        m.part('cyl', 0.1, 0.16, 1.3, 6, p=(0.45, 2.3, 0.1), r=(0.2, 0, -0.7), color=TRUNK)
        m.part('cyl', 0.09, 0.14, 1.2, 6, p=(-0.4, 2.4, -0.2), r=(-0.3, 0, 0.6), color=TRUNK)
        for k in range(14):
            a = r.random() * 2 * PI
            rr = 0.4 + r.random() * 1.3
            m.part('ball', 0.55 + r.random() * 0.5, 2, p=(math.cos(a) * rr, 2.7 + r.random() * 1.6 - rr * 0.3, math.sin(a) * rr), s=(1, 0.85, 1),
                   color=r.choice(pal), rough=0.16, freq=2.6, seed=k, jitter=0.14)
        out('props', m)
    m = P('prop_bigTree', 99)
    r = random.Random(99)
    m.part('cyl', 0.3, 0.48, 2.6, 8, p=(0, 1.3, 0), color=TRUNK, rough=0.03)
    for k in range(20):
        a = r.random() * 2 * PI
        y = 2.6 + r.random() * 3.2
        rr = math.sin((y - 2.6) / 3.2 * PI) * 1.9 * (0.6 + r.random() * 0.5)
        m.part('ball', 0.72 + r.random() * 0.45, 2, p=(math.cos(a) * rr, y, math.sin(a) * rr), color=r.choice([0x8fbe3e, 0x7aa83a, 0xa6cc4a, 0x6a9a36]),
               rough=0.16, freq=2.4, seed=k, jitter=0.14)
    out('props', m)
    m = P('prop_olive')
    for k, (x, y, rz, h) in enumerate(((0, 0.6, 0.12, 1.3), (0.15, 1.5, -0.3, 0.9), (-0.1, 1.8, 0.4, 0.8))):
        m.part('cyl', 0.13 - k * 0.02, 0.24 - k * 0.04, h, 6, p=(x, y, 0), r=(0, k, rz), color=0x7a6a58, rough=0.03)
    r = random.Random(5)
    for k in range(9):
        a = r.random() * 2 * PI
        m.part('ball', 0.5 + r.random() * 0.35, 1, p=(math.cos(a) * 0.8, 2.3 + r.random() * 0.6, math.sin(a) * 0.8), s=(1.3, 0.75, 1.2),
               color=r.choice([0x8a9a6a, 0x7d8f5c, 0x96a676]), rough=0.1, seed=k)
    out('props', m)
    m = P('prop_cypress')
    m.part('cyl', 0.12, 0.17, 0.8, 6, p=(0, 0.4, 0), color=0x6a5040)
    for k, (r_, h, y) in enumerate(((0.8, 2.4, 1.6), (0.65, 2.2, 2.8), (0.45, 1.8, 4.0))):
        m.part('cone', r_, h, 8, p=(0, y, 0), color=[0x3f6b3a, 0x4a7a40, 0x568a48][k], rough=0.06, sub=1, seed=k)
    out('props', m)
    m = P('prop_boulder')
    for k, (x, y, z, r_, s) in enumerate(((0, 0.35, 0, 1, (1, 0.75, 0.9)), (0.75, 0.2, 0.3, 0.55, (1, 0.8, 1)), (-0.6, 0.15, -0.4, 0.4, (1, 0.7, 1)))):
        m.add(prim('ball', r_, 2, p=(x, y, z), s=s, rough=0.18, freq=1.6, seed=k), 0, colors=moss_top(0x8c919a if k % 2 == 0 else 0x7a808a, MOSS, 0.55))
    out('props', m)
    m = P('prop_shard')
    m.part('cone', 0.9, 1.7, 5, p=(0, 0.55, 0), r=(0.2, 0.4, 0.15), color=0x9b9a96, bevel=0.03)
    m.part('cone', 0.55, 1.1, 4, p=(0.7, 0.3, 0.3), r=(-0.25, 1.1, -0.2), color=0xb7b5ae, bevel=0.03)
    m.part('ball', 0.4, 1, p=(-0.5, 0.1, -0.3), color=0x8c8b87, rough=0.08)
    out('props', m)
    m = P('prop_plinth')
    bricks(m, 2.4, 1.2, 2.4, 3, moss=False)
    m.part('box', 2.6, 0.3, 2.6, p=(0, 1.35, 0), color=CAP, bevel=0.05)
    m.part('box', 2.0, 0.08, 1.6, p=(0.1, 1.53, -0.2), color=MOSS, bevel=0.03, jitter=0.15)
    for x, z in ((0, 1.21), (0, -1.21), (1.21, 0), (-1.21, 0)):
        m.part('box', 0.04 if x else 1.3, 0.6, 0.04 if z else 1.3, p=(x, 0.62, z), color=0x55606e)
        m.part('box', 0.05 if x else 0.9, 0.3, 0.05 if z else 0.9, p=(x * 1.01, 0.62, z * 1.01), color=0x8a92a0, bevel=0.01)
    out('props', m)
    m = P('prop_tower')
    m.part('box', 1.9, 0.5, 1.9, p=(0, 0.25, 0), color=SLATE[0], bevel=0.05)
    bricks(m, 1.2, 2.6, 1.2, 7, y=0.5, moss=False)
    m.part('box', 1.5, 0.3, 1.5, p=(0, 3.25, 0), color=SLATE[3], bevel=0.04)
    bricks(m, 1.0, 0.9, 1.0, 9, y=3.4, moss=False)
    m.part('box', 1.9, 0.35, 1.9, p=(0, 4.47, 0), color=CAP, bevel=0.05)
    m.part('box', 0.7, 0.35, 1.9, p=(0.6, 4.82, 0), color=CAP, bevel=0.05)
    m.part('box', 1.9, 0.35, 0.6, p=(0, 4.82, -0.65), color=CAP, bevel=0.05)
    m.part('box', 0.9, 0.08, 0.9, p=(-0.3, 4.68, 0.3), color=MOSS, jitter=0.15)
    for k in range(4):
        m.part('box', 0.25, 0.25, 0.04, p=(0, 1.0 + k * 0.6, 0.62), color=0x55606e)
    out('props', m)
    m = P('prop_arch')
    bricks(m, 0.9, 3.0, 0.9, 11, x=-1.4, moss=False)
    bricks(m, 0.9, 2.2, 0.9, 12, x=1.4, ragged=0.4)
    m.part('box', 3.6, 0.55, 1.0, p=(-0.4, 3.2, 0), r=(0, 0, -0.08), color=CAP, bevel=0.05)
    for k in range(5):
        m.part('box', 0.5, 0.45, 0.95, p=(-1.5 + k * 0.6, 2.8 - abs(k - 2) * 0.12, 0), r=(0, 0, (k - 2) * 0.15), color=SLATE[k % 4], bevel=0.03)
    out('props', m)
    m = P('prop_wall')
    bricks(m, 4.2, 1.5, 0.7, 21, ragged=0.5)
    out('props', m)
    m = P('prop_stairs')
    for k in range(5):
        m.part('box', 2.4, 0.25 * (k + 1), 0.55, p=(0, 0.125 * (k + 1), -1.1 + k * 0.55), color=CAP if k % 2 else PALE, bevel=0.03)
        m.part('box', 2.2, 0.03, 0.08, p=(0, 0.25 * (k + 1) + 0.01, -1.1 + k * 0.55 + 0.22), color=MOSS, jitter=0.2)
    for x, s in ((-1.45, 30), (1.45, 31)):
        bricks(m, 2.9, 1.5, 0.5, s, x=x, ragged=0.3, alongz=True)
    out('props', m)
    m = P('prop_cliff', 51)
    r = random.Random(51)
    for k in range(16):
        m.add(prim('ball', 1.3 + r.random() * 1.1, 2, p=((r.random() - 0.5) * 8, r.random() * 5.5, (r.random() - 0.5) * 2.5),
                                     s=(1.2, 0.9, 1), rough=0.25, freq=1.2, seed=k), 0, colors=moss_top(r.choice([0x8a92a0, 0x9aa1ad, 0x7c8492]), MOSS, 0.7))
    out('props', m)
    m = P('prop_column')
    m.part('box', 1.1, 0.25, 1.1, p=(0, 0.12, 0), color=0xd8cfbe, bevel=0.04)
    m.part('cyl', 0.38, 0.42, 3.2, 14, p=(0, 1.85, 0), color=0xe3dbcb)
    for k in range(8):
        a = k / 8 * 2 * PI
        m.part('box', 0.05, 3.1, 0.05, p=(math.cos(a) * 0.4, 1.85, math.sin(a) * 0.4), color=0xc9bfaa)
    m.part('cyl', 0.38, 0.38, 0.5, 14, p=(0.1, 3.6, 0), r=(0.2, 0, 0.15), color=0xd8cfbe, rough=0.04)
    out('props', m)
    for name, c in (('prop_tentI', (0xf1ead8, 0x3e5f99)), ('prop_tentP', (0xe8d9c0, 0xb8463a))):
        m = P(name)
        m.add(prim('cone', 1.6, 2.4, 8, p=(0, 1.2, 0)), 0,
              colors=lambda f, c=c: c[int((math.atan2(f.calc_center_median().x, f.calc_center_median().z) + PI) / (PI / 4)) % 2])
        m.part('cyl', 0.05, 0.05, 3, 5, p=(0, 1.5, 0), color=DARKWOOD)
        m.part('box', 0.6, 0.35, 0.03, p=(0.3, 2.8, 0), color=c[1])
        for a in (0.4, 2.0, 3.6, 5.2):
            m.part('box', 0.02, 0.9, 0.02, p=(math.sin(a) * 1.9, 0.35, math.cos(a) * 1.9), r=(math.cos(a) * 0.9, 0, -math.sin(a) * 0.9), color=CREAM)
        out('props', m)
    m = P('prop_palm')
    for k in range(7):
        m.part('cyl', 0.15 - k * 0.01, 0.19 - k * 0.01, 0.62, 7, p=(k * k * 0.025, 0.31 + k * 0.6, 0), r=(0, 0, -k * 0.05), color=0x9a7a52 if k % 2 else 0x8a6a46, bevel=0.02)
    for k in range(9):
        a = k / 9 * 2 * PI
        for j, (ln, w) in enumerate(((1.1, 0.5), (0.9, 0.4))):
            m.part('box', w, 0.05, ln, p=(1.05 + math.sin(a) * (0.5 + j * 0.9), 4.2 - j * 0.45 - 0.1, math.cos(a) * (0.5 + j * 0.9)),
                   r=(0.35 + j * 0.55, a, 0), yaw_last=True, color=0x5f9a3e if (k + j) % 2 else 0x4f8a34, jitter=0.1)
    for x, z in ((1.0, 0.15), (0.85, -0.12), (1.15, -0.05)):
        m.part('ball', 0.15, 1, p=(x, 4.0, z), color=0x6a4a2a)
    out('props', m)
    m = P('prop_obelisk')
    m.part('box', 1.5, 0.4, 1.5, p=(0, 0.2, 0), color=0xc9a46e, bevel=0.04)
    m.part('cyl', 0.42, 0.62, 6, 4, p=(0, 3.4, 0), r=(0, PI / 4, 0), color=0xdcc08e)
    m.part('cone', 0.44, 0.7, 4, p=(0, 6.75, 0), r=(0, PI / 4, 0), color=GOLD)
    r = random.Random(4)
    for k in range(14):  # hieroglyphs
        y = 1.2 + (k // 2) * 0.55
        m.part('box', 0.12, 0.18, 0.03, p=(-0.08 + (k % 2) * 0.16, y, 0.6 - (y - 0.6) * 0.033), color=r.choice([0x8a6a3e, 0x4a6aa8, 0x6a4a2a]))
    out('props', m)
    m = P('prop_colossus')
    m.part('box', 2.4, 2.4, 2.2, p=(0, 1.1, 0), r=(0, 0, 0.2), color=0xd8b98a, bevel=0.15, rough=0.04)
    m.part('box', 2.8, 1.0, 2.4, p=(0, 2.3, -0.1), r=(0, 0, 0.2), color=0x4a6aa8, bevel=0.1)
    for k in range(3):
        m.part('box', 2.85, 0.12, 2.45, p=(0, 2.0 + k * 0.3, -0.1), r=(0, 0, 0.2), color=GOLD)
    for x, y in ((-0.4, 1.5), (0.5, 1.7)):
        m.part('box', 0.6, 0.3, 0.1, p=(x, y, 1.12), r=(0, 0, 0.2), color=0x8a6a3e)
    m.part('box', 0.5, 1.2, 0.4, p=(0.2, 0.3, 1.2), color=0xd8b98a, bevel=0.06)
    out('props', m)
    m = P('prop_sandstone')
    for k, (x, y, z, r_) in enumerate(((0, 0.35, 0, 1), (0.8, 0.25, 0.3, 0.6))):
        m.part('ball', r_, 2, p=(x, y, z), s=(1.1, 0.7, 0.9), color=0xd0a26c if k == 0 else 0xc49460, rough=0.15, seed=k, jitter=0.08)
    out('props', m)
    m = P('prop_sheep')
    r = random.Random(3)
    for k in range(8):
        m.part('ball', 0.22, 1, p=((r.random() - 0.5) * 0.4, 0.55 + (r.random() - 0.5) * 0.2, (r.random() - 0.5) * 0.6), color=WHITE, rough=0.03)
    m.part('box', 0.2, 0.22, 0.25, p=(0, 0.62, 0.48), color=BLACK, bevel=0.04)
    for x in (-0.12, 0.12):
        m.part('box', 0.12, 0.05, 0.06, p=(x * 1.2, 0.7, 0.42), color=BLACK)
    for x, z in ((-0.15, 0.25), (0.15, 0.25), (-0.15, -0.25), (0.15, -0.25)):
        m.part('box', 0.08, 0.32, 0.08, p=(x, 0.16, z), color=BLACK)
    out('props', m)
    m = P('prop_pyramid')
    for k in range(4):
        w = 1 - k * 0.22
        m.part('cyl', w * 0.62, w * 0.72, 0.24, 4, p=(0, k * 0.24 + 0.12, 0), r=(0, PI / 4, 0), color=0xe2c995 if k % 2 else 0xd8bd86)
    m.part('cone', 0.14, 0.16, 4, p=(0, 1.05, 0), r=(0, PI / 4, 0), color=GOLD)
    out('props', m)
    for k in range(3):
        m = P(f'prop_cloud{k}')
        for j, (x, y, z, r_) in enumerate(((0, 0, 0, 3), (3 + k, 0.4, 0.5, 2.4), (-3, -0.2, 0.8, 2.2), (1, 1.5, -0.5, 1.8), (-1.5, 1.0, 0.3, 1.6))):
            m.part('ball', r_, 2, p=(x, y, z), s=(1.3, 0.7, 1), color=WHITE if j % 2 == 0 else 0xeef3f8, jitter=0.03)
        out('props', m)

    # Bridge (len 9 along Z, deck top at y = 0.15).
    m = P('prop_bridge')
    r = random.Random(40)
    u = -4.5
    while u < 4.2:
        m.part('box', 2.4, 0.3, 0.58, p=(0, 0, u + 0.31), color=r.choice([PALE, CAP, 0x9a998f]), bevel=0.03, jitter=0.1)
        u += 0.62
    for x, s in ((-1.15, 41), (1.15, 42)):
        bricks(m, 9, 0.5, 0.25, s, x=x, y=0.15, ragged=0.2, alongz=True)
    for z, s in ((-3.7, 45), (3.7, 46)):
        bricks(m, 2.4, 2.0, 1.0, s, y=-2.0, z=z, moss=False)
    out('props', m)

    # Landmarks.
    m = P('memorial')
    for k in range(12):  # Js 4: twelve stones from the Jordan
        layer = 0 if k < 6 else 1 if k < 10 else 2
        a = k * 2.4
        rr = [0.9, 0.5, 0.15][layer]
        m.part('ball', 0.46 - layer * 0.07, 2, p=(math.cos(a) * rr, 0.3 + layer * 0.5, math.sin(a) * rr), r=(k, k * 2, 0),
               color=[0xcfc6b4, 0xbdb3a0, 0xd9d1c2][k % 3], rough=0.07, seed=k, jitter=0.06)
    out('props', m)
    m = P('altar')
    bricks(m, 1.6, 0.9, 1.6, 61, moss=False, row=0.3)
    m.part('box', 1.75, 0.14, 1.75, p=(0, 0.97, 0), color=0x9c8f78, bevel=0.04)
    for x, z in ((-1, -1), (1, -1), (-1, 1), (1, 1)):  # horns of the altar
        m.part('cone', 0.13, 0.32, 6, p=(x * 0.75, 1.2, z * 0.75), color=0x9c8f78, bevel=0.01)
    for a in (0.4, -0.5, 1.4):
        m.part('cyl', 0.08, 0.08, 0.9, 6, p=(0, 1.1, 0), r=(0, a, PI / 2), color=DARKWOOD)
    m.part('cyl', 0.4, 0.45, 0.06, 10, p=(0, 1.06, 0), color=0x3a3430)
    out('props', m)
    m = P('flame')
    m.part('cone', 0.35, 0.9, 7, p=(0, 0.45, 0), color=0xff8a3d, jitter=0)
    m.part('cone', 0.22, 0.65, 7, p=(0.05, 0.42, 0.05), color=0xffd25a, jitter=0)
    m.part('cone', 0.12, 0.4, 6, p=(-0.05, 0.3, 0.08), color=0xfff1a0, jitter=0)
    out('props', m)
    for free in (False, True, 'dark'):
        band = GOLD if free else BRONZE
        body = 0x2e2a30 if free == 'dark' else 0x8a2f2f if free else WOOD
        suffix = '_dark' if free == 'dark' else '_free' if free else ''
        m = P(f'chest_base{suffix}')
        m.part('box', 1.2, 0.6, 0.8, p=(0, 0.3, 0), color=body, bevel=0.03)
        for k in range(3):
            m.part('box', 1.21, 0.02, 0.81, p=(0, 0.12 + k * 0.17, 0), color=DARKWOOD)
        m.part('box', 1.24, 0.08, 0.84, p=(0, 0.56, 0), color=band, bevel=0.01)
        for x in (-0.4, 0.4):
            m.part('box', 0.1, 0.62, 0.84, p=(x, 0.31, 0), color=band, bevel=0.01)
        for x, z in ((-0.6, -0.4), (0.6, -0.4), (-0.6, 0.4), (0.6, 0.4)):
            m.part('box', 0.1, 0.1, 0.1, p=(x, 0.05, z), color=band)
        out('props', m)
        m = P(f'chest_lid{suffix}')  # hinge at the origin (back edge)
        m.part('cyl', 0.4, 0.4, 1.2, 10, p=(0, 0, 0.4), r=(0, 0, PI / 2), color=body)
        for x in (-0.4, 0.4):
            m.part('torus', 0.41, 0.04, PI, 10, p=(x, 0, 0.4), r=(0, PI / 2, 0), color=band)
        m.part('box', 0.18, 0.22, 0.08, p=(0, -0.02, 0.82), color=band, bevel=0.02)
        m.part('ball', 0.04, 1, p=(0, -0.05, 0.87), color=DARK)
        if free == 'dark':  # a red seal: opening it is a challenge
            m.part('cyl', 0.14, 0.14, 0.04, 10, p=(0, 0.25, 0.81), r=(PI / 2, 0, 0), color=0xc8243a)
        out('props', m)
    m = P('jar')
    m.part('lathe', [(0, 0), (0.22, 0.02), (0.33, 0.25), (0.31, 0.5), (0.15, 0.66), (0.18, 0.76), (0.12, 0.78)], 12, color=0xb0643a)
    m.part('cyl', 0.325, 0.335, 0.06, 12, p=(0, 0.3, 0), color=0x7a3a1e)
    m.part('cyl', 0.3, 0.31, 0.03, 12, p=(0, 0.42, 0), color=0xe8dcc0)
    for x in (-0.25, 0.25):
        m.part('torus', 0.09, 0.025, PI, 8, p=(x, 0.6, 0), r=(0, 0, PI / 2 if x > 0 else -PI / 2), color=0xb0643a)
    out('props', m)

    # Ground cover.
    m = P('decor_grass')
    for k, x in enumerate((-0.2, -0.1, -0.02, 0.06, 0.14, 0.22)):
        m.part('cone', 0.05, 0.42 + (k % 3) * 0.15, 3, p=(x, 0.24, (k - 3) * 0.05), r=(0.1 * (k % 2), 0, x * 1.5), color=[0x7a9446, 0x8aa04e, 0x6b8a40, 0x9aae58][k % 4], jitter=0.1)
    out('props', m)
    m = P('decor_leaves')
    r = random.Random(5)
    for _ in range(8):
        m.part('box', 0.14, 0.015, 0.1, p=((r.random() - 0.5) * 1.4, 0.02, (r.random() - 0.5) * 1.4), r=(0, r.random() * 3, 0),
               color=r.choice(LEAVES['gold'] + LEAVES['orange'] + LEAVES['red']))
    out('props', m)
    for k, c in enumerate((0xf4f1ea, 0xf2c14e, 0xd94a4a)):
        m = P(f'decor_flower{k}')
        m.part('box', 0.03, 0.35, 0.03, p=(0, 0.17, 0), color=0x5f8a36)
        m.part('box', 0.12, 0.02, 0.05, p=(0.05, 0.15, 0), r=(0, 0, 0.4), color=0x6f9a3e)
        for j in range(5):
            a = j / 5 * 2 * PI
            m.part('ball', 0.05, 0, p=(math.cos(a) * 0.06, 0.38, math.sin(a) * 0.06), color=c)
        m.part('ball', 0.035, 0, p=(0, 0.39, 0), color=0xe8b83a)
        out('props', m)
    m = P('decor_flags')
    for k in range(4):
        m.part('box', 0.7 + (k % 2) * 0.3, 0.08, 0.6 + (k % 3) * 0.2, p=((k % 2) * 1.1 - 0.5, 0.03, (k // 2) * 0.95 - 0.45), r=(0, k * 0.2, 0),
               color=[0xb8b6aa, PALE, 0xc4c1b4][k % 3], bevel=0.02, jitter=0.1)
    out('props', m)
    m = P('decor_pebble')
    m.part('ball', 0.18, 1, p=(0, 0.05, 0), s=(1.2, 0.5, 1), color=0xb8b0a0, rough=0.03)
    out('props', m)
    m = P('decor_shrub')
    m.part('ball', 0.35, 1, p=(0, 0.2, 0), s=(1, 0.7, 1), color=0x9a9a5a, rough=0.06)
    m.part('ball', 0.22, 1, p=(0.25, 0.15, 0.1), color=0x8a8a4a, rough=0.04)
    out('props', m)
    m = P('decor_reed')
    for k, x in enumerate((-0.15, 0, 0.15, 0.07)):
        m.part('cone', 0.05, 1.3 + k * 0.2, 3, p=(x, 0.65, k * 0.05), color=0x6f9a3e)
    m.part('cyl', 0.04, 0.04, 0.22, 6, p=(0, 1.45, 0.05), color=0x6a4a2a)
    out('props', m)
    m = P('decor_shell')
    m.part('cone', 0.12, 0.08, 7, p=(0, 0.03, 0), r=(PI / 2, 0, 0), color=0xf3d8c8)
    out('props', m)
    bone_props(P)
    stage2_props(P)
    jericho_props(P)
    m = P('decor_lily')
    m.part('cyl', 0.35, 0.35, 0.02, 10, color=0x5f8f3a)
    m.part('cyl', 0.2, 0.2, 0.025, 8, p=(0.25, 0.005, 0.1), color=0x7aa84a)
    for j in range(5):
        a = j / 5 * 2 * PI
        m.part('box', 0.08, 0.03, 0.04, p=(0.05 + math.cos(a) * 0.05, 0.05, math.sin(a) * 0.05), r=(0, -a, 0.4), color=0xf3d0e0)
    out('props', m)


def jericho_props(P):
    # A stretch of the city wall (6 m along X, 4.5 m tall) with battlements, mud brick on stone footing.
    m = P('prop_cityWall', 71)
    bricks(m, 6.2, 1.0, 1.9, 71, row=0.5, moss=False, pal=SLATE)
    bricks(m, 6.0, 3.0, 1.6, 72, y=1.0, row=0.42, moss=False, pal=BRICK)
    for k in range(5):
        m.part('box', 0.8, 0.6, 1.6, p=(-2.4 + k * 1.2, 4.3, 0), color=BRICK[k % 4], bevel=0.04, jitter=0.08)
    out('props', m)
    # Fallen wall: a slope of loose bricks you can climb over (Js 6:20).
    m = P('prop_wallRubble', 73)
    r = random.Random(73)
    for k in range(26):
        x, z = (r.random() - 0.5) * 6, (r.random() - 0.5) * 3
        h = max(0.1, 1.1 - abs(z) * 0.5) * r.random()
        m.part('box', 0.6 + r.random() * 0.4, 0.35, 0.45, p=(x, h * 0.8, z), r=(r.random() * 0.6, r.random() * 3, r.random() * 0.6), color=r.choice(BRICK), bevel=0.04)
    bricks(m, 6.0, 0.8, 1.6, 74, row=0.4, moss=False, ragged=0.6, pal=BRICK)
    out('props', m)
    # City gate: two towers and a lintel (the opening is 3 m wide).
    m = P('prop_gate', 75)
    for x in (-2.6, 2.6):
        bricks(m, 2.2, 5.6, 2.4, 75 + int(x), x=x, row=0.45, moss=False, pal=BRICK)
        for k in range(2):
            m.part('box', 0.7, 0.6, 2.4, p=(x - 0.55 + k * 1.1, 5.9, 0), color=BRICK[k], bevel=0.04)
    m.part('box', 3.2, 0.7, 2.4, p=(0, 4.6, 0), color=0x8a6a4a, bevel=0.05)
    for x in (-0.75, 0.75):  # the gates, thrown open
        m.part('box', 0.12, 3.6, 1.5, p=(x * 2.0, 1.8, 0.9), r=(0, x * 0.6, 0), color=WOOD, bevel=0.03)
    out('props', m)
    # A flat-roofed mud-brick house.
    m = P('prop_house', 76)
    bricks(m, 3.2, 2.4, 3.0, 76, row=0.4, moss=False, pal=BRICK)
    m.part('box', 3.5, 0.18, 3.3, p=(0, 2.5, 0), color=0x9a7a52, bevel=0.03)
    m.part('box', 0.8, 1.4, 0.1, p=(0.6, 0.7, 1.52), color=0x5a3a20)
    m.part('box', 0.5, 0.4, 0.1, p=(-0.8, 1.6, 1.52), color=0x3a2a1a)
    out('props', m)
    # Rahab's house on the wall, with the scarlet cord in the window (Js 2:15-21).
    m = P('prop_rahab', 77)
    bricks(m, 3.2, 2.2, 2.6, 77, row=0.4, moss=False, pal=BRICK)
    m.part('box', 3.5, 0.18, 2.9, p=(0, 2.3, 0), color=0x9a7a52, bevel=0.03)
    m.part('box', 0.6, 0.5, 0.1, p=(0.5, 1.4, 1.32), color=0x3a2a1a)
    m.part('box', 0.06, 1.6, 0.06, p=(0.5, 0.55, 1.38), color=0xc8243a)
    for k in range(4):
        m.part('box', 0.08, 0.08, 0.08, p=(0.5, 0.1 + k * 0.4, 1.4), color=0xe03a50)
    out('props', m)


def stage2_props(P):
    # Well: stone ring, wooden frame, rope and bucket (2 Sm 23:15).
    m = P('prop_well', 61)
    m.part('cyl', 1.1, 1.2, 0.9, 14, p=(0, 0.45, 0), color=0xa9a294, rough=0.03, seed=1)
    m.part('torus', 1.05, 0.14, 2 * PI, 16, p=(0, 0.92, 0), r=(PI / 2, 0, 0), color=0x9a9284)
    m.part('cyl', 0.85, 0.85, 0.05, 14, p=(0, 0.75, 0), color=0x3a6a8a)  # water
    for x in (-0.95, 0.95):
        m.part('box', 0.14, 1.9, 0.14, p=(x, 1.6, 0), color=DARKWOOD, bevel=0.02)
    m.part('cyl', 0.06, 0.06, 2.1, 6, p=(0, 2.35, 0), r=(0, 0, PI / 2), color=WOOD)
    m.part('box', 2.5, 0.08, 1.4, p=(0, 2.75, 0.32), r=(0.45, 0, 0), color=0x8a5a2b, bevel=0.02)
    m.part('box', 2.5, 0.08, 1.4, p=(0, 2.75, -0.32), r=(-0.45, 0, 0), color=0x7a4a24, bevel=0.02)
    m.part('box', 0.02, 0.9, 0.02, p=(0.2, 1.85, 0), color=CREAM)
    m.part('cyl', 0.16, 0.12, 0.24, 8, p=(0.2, 1.3, 0), color=WOOD)
    out('props', m)
    # Sphinx (Mar): a lying lion with a pharaoh's head, worn by sand.
    m = P('prop_sphinx', 62)
    SAND = 0xd8b98a
    m.part('box', 2.0, 1.0, 4.4, p=(0, 0.5, -0.4), color=SAND, bevel=0.2, rough=0.04, seed=2)
    for x in (-0.7, 0.7):
        m.part('box', 0.55, 0.45, 2.0, p=(x, 0.22, 2.4), color=SAND, bevel=0.12)
    m.part('box', 1.5, 1.6, 1.2, p=(0, 1.5, 1.2), color=SAND, bevel=0.15)
    m.part('box', 1.1, 1.1, 1.0, p=(0, 2.55, 1.35), color=0xe2c995, bevel=0.12)
    nemes(m, 3.2, 2.85, 0x4a6aa8, 0xd8b98a, z=1.3)
    for x in (-0.22, 0.22):
        m.part('box', 0.2, 0.08, 0.05, p=(x, 2.65, 1.86), color=0x6a4a2e)
    m.part('box', 0.4, 0.2, 2.2, p=(0, 1.0, -2.5), r=(0.3, 0, 0), color=SAND, bevel=0.08)
    out('props', m)
    # Broken cart: tipped bed, one wheel off.
    m = P('prop_cart', 63)
    m.part('box', 1.6, 0.12, 2.4, p=(0, 0.5, 0), r=(0, 0, 0.25), color=0x6b5040, bevel=0.03)
    for x in (-0.8, 0.8):
        m.part('box', 0.08, 0.45, 2.4, p=(x, 0.75 + x * 0.25, 0), r=(0, 0, 0.25), color=0x5a4030)
    wheel(m, 0.9, 0.42, 0.6, 0x4a3a2c, 0x6b5040, r=0.42)
    m.part('torus', 0.42, 0.05, 2 * PI, 14, p=(-1.3, 0.06, -0.5), r=(PI / 2, 0, 0.3), color=0x4a3a2c)
    m.part('box', 0.1, 0.1, 1.8, p=(0, 0.3, 2.0), r=(-0.25, 0.2, 0), color=0x5a4030)
    out('props', m)
    # Grave: a slab and a leaning stone (Ossos).
    m = P('prop_tomb', 64)
    m.part('box', 1.0, 0.25, 2.0, p=(0, 0.12, 0), color=0x8a8478, bevel=0.05, rough=0.03, seed=4)
    m.part('box', 0.9, 1.2, 0.22, p=(0, 0.7, -1.0), r=(-0.15, 0, 0.06), color=0x9a9488, bevel=0.06, rough=0.03, seed=5)
    m.part('box', 0.5, 0.06, 0.04, p=(0, 0.9, -0.88), r=(-0.15, 0, 0.06), color=0x6a6458)
    out('props', m)
    # Fence: posts and rails (Elá, around the sheepfolds).
    m = P('prop_fence', 65)
    for x in (-1.5, 0, 1.5):
        m.part('box', 0.14, 1.0, 0.14, p=(x, 0.5, 0), color=DARKWOOD, bevel=0.02)
    for y in (0.4, 0.8):
        m.part('box', 3.2, 0.1, 0.08, p=(0, y, 0), color=WOOD, bevel=0.015)
    out('props', m)
    # A glint marking one of the five smooth stones in the brook.
    m = P('decor_glint', 66)
    m.part('ball', 0.22, 2, p=(0, 0.1, 0), s=(1.2, 0.6, 1), color=0xdcd6c8, smooth=True)
    m.part('ball', 0.06, 1, p=(-0.08, 0.2, 0.08), color=WHITE)
    out('props', m)


def bone(m, a, b, r, color=BONE2):
    """A long bone: a shaft with knobbed ends."""
    a, b = Vector(a), Vector(b)
    d = b - a
    yaw = math.atan2(d.x, d.z)
    pitch = math.atan2(math.hypot(d.x, d.z), d.y)
    mid = (a + b) / 2
    m.part('cyl', r, r, d.length, 7, p=tuple(mid), r=(pitch, yaw, 0), color=color, yaw_last=True)
    for e in (a, b):
        m.part('ball', r * 1.7, 1, p=tuple(e), color=color)


def bone_props(P):
    # Dead tree: a twisted grey trunk with bare branches.
    m = P('prop_deadTree', 51)
    r = random.Random(51)
    m.part('cyl', 0.16, 0.34, 2.4, 7, p=(0, 1.2, 0), r=(0.05, 0, 0.08), color=0x6e5e50, rough=0.04)
    for k in range(6):
        a = k * 1.1 + r.random()
        y = 1.6 + k * 0.35
        L = 1.3 - k * 0.12
        m.part('cyl', 0.04, 0.1, L, 5, p=(math.sin(a) * L * 0.4, y + L * 0.3, math.cos(a) * L * 0.4), r=(math.cos(a) * 0.9, 0, -math.sin(a) * 0.9), color=0x7a6a5a)
        m.part('cyl', 0.02, 0.05, L * 0.6, 4, p=(math.sin(a) * L * 0.8, y + L * 0.75, math.cos(a) * L * 0.8), r=(math.cos(a) * 0.4, 0, -math.sin(a) * 0.4), color=0x8a7a68)
    out('props', m)
    # Ribcage of a great beast, half buried: a spine and arching ribs (about 7 m long).
    m = P('prop_ribcage', 52)
    for k in range(9):
        z = -3 + k * 0.75
        m.part('ball', 0.28 - abs(k - 4) * 0.015, 1, p=(0, 2.6 - abs(k - 4) * 0.12, z), s=(1, 0.8, 1.1), color=BONE2 if k % 2 else BONE3)
        if 1 <= k <= 7:
            for x in (-1, 1):
                # Each rib arcs from the spine down one side, in the plane across the spine.
                m.part('torus', 1.7 - abs(k - 4) * 0.12, 0.11, PI * 0.62, 12, p=(0, 0.9, z), r=(0, 0, -0.12 * PI if x > 0 else PI / 2),
                       color=BONE2 if (k + x) % 2 else BONE3)
    out('props', m)
    # Giant skull, sunk in the dust.
    m = P('prop_skull', 53)
    m.part('ball', 1.4, 2, p=(0, 1.1, -0.2), s=(1, 0.9, 1.15), color=BONE2, rough=0.05, seed=3)
    m.part('box', 1.6, 0.7, 1.2, p=(0, 0.45, 0.75), color=BONE2, bevel=0.25)
    for x in (-0.5, 0.5):
        m.part('ball', 0.38, 1, p=(x, 1.2, 1.12), s=(1, 1.1, 0.6), color=DARK)
    m.part('cone', 0.2, 0.35, 3, p=(0, 0.8, 1.3), r=(PI, 0, 0), color=DARK)
    for k in range(6):
        m.part('box', 0.18, 0.28, 0.14, p=(-0.55 + k * 0.22, 0.25, 1.32), color=WHITE, bevel=0.03)
    for x in (-1, 1):
        m.part('cone', 0.22, 1.4, 7, p=(x * 1.2, 1.9, -0.3), r=(0, 0, -x * 0.9), color=BONE3)
    out('props', m)
    # A heap of bones with a skull on top.
    m = P('prop_bonepile', 54)
    r = random.Random(54)
    for k in range(9):
        a = r.random() * 2 * PI
        c = (math.cos(a) * r.random() * 0.4, 0.1 + k * 0.03, math.sin(a) * r.random() * 0.4)
        d = (math.cos(a + 1.3) * 0.45, (r.random() - 0.5) * 0.15, math.sin(a + 1.3) * 0.45)
        bone(m, (c[0] - d[0], c[1] - d[1], c[2] - d[2]), (c[0] + d[0], c[1] + d[1], c[2] + d[2]), 0.05, BONE2 if k % 2 else BONE3)
    m.part('ball', 0.22, 2, p=(0, 0.5, 0), s=(1, 0.9, 1.1), color=BONE2)
    for x in (-0.08, 0.08):
        m.part('ball', 0.06, 1, p=(x, 0.52, 0.19), color=DARK)
    out('props', m)
    m = P('decor_drygrass')
    for k, (x, z) in enumerate(((0, 0), (0.12, 0.05), (-0.1, 0.08), (0.04, -0.1), (-0.06, -0.06))):
        m.part('cone', 0.04, 0.32 + (k % 3) * 0.08, 3, p=(x, 0.15, z), r=((k - 2) * 0.15, 0, (k % 2 - 0.5) * 0.4), color=[0xc9b071, 0xb39a5a, 0xd8c287][k % 3])
    out('props', m)
    m = P('decor_bone')
    bone(m, (-0.28, 0.05, 0.05), (0.28, 0.04, -0.05), 0.035)
    bone(m, (0.05, 0.04, -0.25), (0.15, 0.05, 0.2), 0.03, BONE3)
    out('props', m)
    m = P('decor_skull')
    m.part('ball', 0.18, 2, p=(0, 0.14, 0), s=(1, 0.9, 1.15), color=BONE2)
    for x in (-0.06, 0.06):
        m.part('ball', 0.05, 1, p=(x, 0.16, 0.16), color=DARK)
    m.part('box', 0.16, 0.08, 0.12, p=(0, 0.04, 0.1), color=BONE3, bevel=0.02)
    out('props', m)


if __name__ == '__main__':
    reset()
    mobs()
    goliath()
    pharaoh()
    gogue()
    rei()
    isbi()
    janes()
    ogue()
    adonizedeque()
    items()
    props()
    for group, objs in built.items():
        export_glb(os.path.join(ROOT, 'assets/models', f'{group}.glb'), objs)
    for k, ob in enumerate(o for objs in built.values() for o in objs):  # lay everything out in a grid for editing
        ob.location = ((k % 12) * 4.0, (k // 12) * 5.0, 0)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'assets/blender/assets.blend'))
