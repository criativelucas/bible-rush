# Turns the hero turnaround sheets (assets/src/<hero>.jpg: four views on white) into small
# pixel-art strips for the game: assets/heroes/<hero>.png with 4 equal cells in the order
# front, back, facing left, facing right. Run again after replacing a sheet:
#   python3 tools/make_sprites.py
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HEROES = {
    # order: which sheet view goes to front, back, left-facing, right-facing.
    # shadow: the sheet draws a shadow under the feet. holes: white gaps between arm and body.
    'davi': {'order': [0, 1, 2, 3], 'shadow': True, 'holes': True},
    'moises': {'order': [0, 1, 2, 3]},  # no hole pass: his white hair would go too
    'sansao': {'order': [0, 1, 3, 2], 'holes': True},
}
TARGET_H = 100  # figure height in game pixels (about the sheets' own pixel grid)


def background(a):
    """Near-white pixels connected to the border. White hair inside the outline is kept."""
    h, w, _ = a.shape
    mn = a.min(axis=2).astype(int)
    mx = a.max(axis=2).astype(int)
    white = (mn > 200) & (mx - mn < 45)
    bg = np.zeros((h, w), bool)
    q = deque((y, x) for y in range(h) for x in (0, w - 1) if white[y, x])
    q.extend((y, x) for x in range(w) for y in (0, h - 1) if white[y, x])
    for y, x in q:
        bg[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    # JPEG ringing: pale grey pixels hugging the background go too.
    pale = (mn > 150) & (mx - mn < 50)
    for _ in range(3):
        grown = bg.copy()
        grown[1:] |= bg[:-1]
        grown[:-1] |= bg[1:]
        grown[:, 1:] |= bg[:, :-1]
        grown[:, :-1] |= bg[:, 1:]
        bg |= grown & pale
    return bg


def holes(a, bg, min_area=300):
    """Big enclosed patches of pure white (e.g. between arm and body) are background too."""
    h, w, _ = a.shape
    mn = a.min(axis=2).astype(int)
    mx = a.max(axis=2).astype(int)
    white = (mn > 232) & (mx - mn < 25) & ~bg
    seen = np.zeros((h, w), bool)
    for sy, sx in zip(*np.where(white)):
        if seen[sy, sx]:
            continue
        comp, q = [], deque([(sy, sx)])
        seen[sy, sx] = True
        while q:
            y, x = q.popleft()
            comp.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(comp) >= min_area:
            ys, xs = zip(*comp)
            bg[list(ys), list(xs)] = True


def frames(solid):
    """Column runs of figure pixels, small gaps merged: one run per view."""
    occ = solid.sum(axis=0) > 3
    runs, start = [], None
    for x, o in enumerate(list(occ) + [False]):
        if o and start is None:
            start = x
        elif not o and start is not None:
            if runs and start - runs[-1][1] < 12:
                runs[-1] = (runs[-1][0], x)
            else:
                runs.append((start, x))
            start = None
    runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    return sorted(runs[:4])


def drop_drawn_shadow(a, alpha):
    """Remove the dark ellipse drawn under the feet (cool dark greys below/around the feet)."""
    r, g, b = (a[..., k].astype(int) for k in range(3))
    skin = alpha & (r > 150) & (r - b > 50)
    rows = np.where(skin.any(axis=1))[0]
    if not len(rows):
        return
    feet = rows.max()
    alpha[feet + 3:] = False
    mx = np.maximum(np.maximum(r, g), b)
    cool = (mx < 120) & (b >= r - 12) & (mx > 22)
    band = slice(max(0, feet - 45), feet + 3)
    alpha[band] &= ~cool[band]


def build(name, cfg):
    a = np.array(Image.open(ROOT / 'assets/src' / f'{name}.jpg').convert('RGB'))
    bg = background(a)
    if cfg.get('holes'):
        holes(a, bg)
    alpha = ~bg
    views = []
    for x0, x1 in frames(alpha):
        sub = a[:, x0:x1].copy()
        al = alpha[:, x0:x1].copy()
        if cfg.get('shadow'):
            drop_drawn_shadow(sub, al)
        ys, xs = np.where(al)
        sub, al = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1], al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        views.append(np.dstack([sub, al.astype(np.uint8) * 255]))
    views = [views[k] for k in cfg['order']]
    scale = TARGET_H / views[0].shape[0]
    small = []
    for v in views:
        img = Image.fromarray(v)
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.BOX)
        px = np.array(img)
        px[..., 3] = np.where(px[..., 3] >= 128, 255, 0)  # hard pixel edges
        small.append(px)
    cw = max(p.shape[1] for p in small)
    ch = max(p.shape[0] for p in small)
    strip = np.zeros((ch, cw * 4, 4), np.uint8)
    for k, p in enumerate(small):  # bottom-aligned, centred in its cell
        y = ch - p.shape[0]
        x = k * cw + (cw - p.shape[1]) // 2
        strip[y:y + p.shape[0], x:x + p.shape[1]] = p
    out = ROOT / 'assets/heroes' / f'{name}.png'
    Image.fromarray(strip).save(out)
    print(f'{out.relative_to(ROOT)}: 4 x {cw}x{ch}')


if __name__ == '__main__':
    for hero, conf in HEROES.items():
        build(hero, conf)
