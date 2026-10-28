# Pixel-art UI pieces for the menus and HUD: frames (9-slice, used with CSS border-image), buttons,
# slots, bars, the title ribbon, the scroll rod and small icons. Drawn here, one art pixel at a time,
# so they stay original and easy to tweak. The page shows them at 2-3x with image-rendering: pixelated.
#   python3 tools/make_ui.py   ->  assets/ui/*.png
import os

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'ui')

PAL = {
    'k': (26, 15, 11), 'K': (58, 36, 24),  # outline, soft outline (on parchment)
    'y': (255, 241, 184), 'Y': (246, 210, 122), 'g': (217, 164, 65), 'd': (138, 90, 20),  # gold
    'v': (124, 43, 47), 'V': (91, 31, 36), 'u': (61, 20, 24),  # wine: light, base, dark
    'l': (59, 37, 27), 'L': (46, 27, 20), 'i': (33, 19, 14), 'I': (24, 13, 9),  # leather, inset
    'p': (246, 232, 198), 'P': (234, 214, 170), 'q': (212, 184, 134), 'Q': (176, 132, 82),  # parchment
    'r': (214, 69, 61), 'R': (240, 122, 106), 'm': (142, 33, 40),  # red
    'o': (232, 120, 32), 'O': (255, 196, 64),  # flame
    'w': (251, 244, 228), 'W': (201, 191, 168),  # bone / white
    'b': (107, 58, 34), 'B': (154, 90, 50),  # wood
    'n': (176, 192, 255), 'N': (106, 120, 196),  # moon
    's': (210, 220, 228), 'S': (125, 138, 150),  # steel
}


def new(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def put(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), (*PAL[c], 255) if isinstance(c, str) else c)


def ring(img, r, tl, br=None):
    """Ring r pixels in from the edge: tl on the top and left sides, br on the bottom and right."""
    br = br or tl
    w, h = img.size
    for x in range(r, w - r):
        put(img, x, r, tl)
        put(img, x, h - 1 - r, br)
    for y in range(r, h - r):
        put(img, r, y, tl)
        put(img, w - 1 - r, y, br)


def fill(img, r, c):
    w, h = img.size
    for y in range(r, h - r):
        for x in range(r, w - r):
            put(img, x, y, c)


def round_corners(img):
    w, h = img.size
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        img.putpixel((x, y), (0, 0, 0, 0))
    for x, y in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)):
        put(img, x, y, 'k')


def stud(img, x0, y0):
    """Gold rivet, 5x5, lit from the top left."""
    for k in range(5):
        for x, y in ((x0 + k, y0), (x0 + k, y0 + 4), (x0, y0 + k), (x0 + 4, y0 + k)):
            put(img, x, y, 'k')
    for (dx, dy), c in {(1, 1): 'y', (2, 1): 'Y', (1, 2): 'Y', (2, 2): 'g', (3, 1): 'g', (1, 3): 'g', (3, 2): 'd', (2, 3): 'd', (3, 3): 'd'}.items():
        put(img, x0 + dx, y0 + dy, c)


def sprite(rows, name):
    img = new(max(len(r) for r in rows), len(rows))
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c != '.':
                put(img, x, y, c)
    save(img, name)


def save(img, name):
    img.save(os.path.join(OUT, f'{name}.png'))


def frames():
    # Big panel: gold rim (3 px, bevelled), dark leather inside, a rivet in each corner. Slice 7.
    img = new(18, 18)
    fill(img, 0, 'L')
    ring(img, 0, 'k')
    ring(img, 1, 'y', 'g')
    ring(img, 2, 'Y', 'd')
    ring(img, 3, 'g', 'd')
    ring(img, 4, 'k')
    ring(img, 5, 'i', 'l')
    round_corners(img)
    for x, y in ((1, 1), (12, 1), (1, 12), (12, 12)):
        stud(img, x, y)
    save(img, 'panel')

    # Thin frame for the HUD. Slice 4.
    img = new(10, 10)
    fill(img, 0, 'L')
    ring(img, 0, 'k')
    ring(img, 1, 'Y', 'd')
    ring(img, 2, 'k')
    ring(img, 3, 'i', 'L')
    round_corners(img)
    save(img, 'thin')

    # Card: gold rim around parchment. Slice 7.
    img = new(18, 18)
    fill(img, 0, 'P')
    ring(img, 0, 'k')
    ring(img, 1, 'y', 'g')
    ring(img, 2, 'Y', 'd')
    ring(img, 3, 'g', 'd')
    ring(img, 4, 'K')
    ring(img, 5, 'q', 'p')
    round_corners(img)
    for x, y in ((1, 1), (12, 1), (1, 12), (12, 12)):
        stud(img, x, y)
    save(img, 'card')

    # Parchment sheet with a burnt, nibbled edge (repeats every 6 px along the sides). Slice 6.
    img = new(18, 18)
    fill(img, 0, 'P')
    ring(img, 0, 'K')
    ring(img, 1, 'Q')
    ring(img, 2, 'q')
    ring(img, 3, 'q', 'P')
    bites = {0, 1, 4}  # positions (mod 6) where the paper edge is torn one pixel in
    w, h = img.size
    for t in range(w):
        if t % 6 in bites and 2 < t < w - 3:
            for x, y in ((t, 0), (t, h - 1), (0, t), (w - 1, t)):
                img.putpixel((x, y), (0, 0, 0, 0))
            for x, y in ((t, 1), (t, h - 2), (1, t), (w - 2, t)):
                put(img, x, y, 'K')
    round_corners(img)
    for x, y in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)):
        put(img, x, y, 'K')
    save(img, 'parch')

    # Slot (portraits, weapons, maps): inset dark well with a gold rim. Slice 5, like the selected one,
    # so picking a card never shifts the layout.
    img = new(14, 14)
    fill(img, 0, 'i')
    ring(img, 0, 'k')
    ring(img, 1, 'g', 'd')
    ring(img, 2, 'k')
    ring(img, 3, 'I', 'l')
    ring(img, 4, 'I', 'i')
    round_corners(img)
    save(img, 'slot')
    # Selected slot: brighter, double gold rim. Slice 5.
    img = new(14, 14)
    fill(img, 0, 'i')
    ring(img, 0, 'k')
    ring(img, 1, 'y', 'Y')
    ring(img, 2, 'Y', 'g')
    ring(img, 3, 'k')
    ring(img, 4, 'I', 'l')
    round_corners(img)
    save(img, 'slot-on')

    # Bar trough. Slice 3.
    img = new(10, 9)
    fill(img, 0, 'I')
    ring(img, 0, 'k')
    ring(img, 1, 'g', 'd')
    ring(img, 2, 'k')
    round_corners(img)
    save(img, 'bar')


def buttons():
    # 12 x 14, slice 4 4 5 4: rim, lit top, body, shaded bottom, a pixel of depth under it.
    for name, rim, top, body, low in (('btn', ('Y', 'd'), 'v', 'V', 'u'), ('btn-gold', ('y', 'd'), 'y', 'Y', 'g'), ('btn-on', ('y', 'g'), 'Y', 'g', 'd')):
        img = new(12, 14)
        w, h = img.size
        for y in range(h - 1):
            for x in range(w):
                put(img, x, y, 'k')
        for y in range(2, h - 3):
            for x in range(2, w - 2):
                put(img, x, y, top if y < 4 else low if y >= h - 5 else body)
        for x in range(1, w - 1):
            put(img, x, 1, rim[0])
            put(img, x, h - 3, rim[1])
        for y in range(1, h - 2):
            put(img, 1, y, rim[0])
            put(img, w - 2, y, rim[1])
        for x in range(1, w - 1):
            img.putpixel((x, h - 1), (0, 0, 0, 90))  # drop shadow
        for x, y in ((0, 0), (w - 1, 0), (0, h - 2), (w - 1, h - 2), (0, h - 1), (w - 1, h - 1)):
            img.putpixel((x, y), (0, 0, 0, 0))
        save(img, name)

    # Title ribbon, 3-slice (left 11, right 11): wine band with gold edges, tails folded behind.
    w, h = 36, 16
    img = new(w, h)
    for side in (0, 1):
        for y in range(5, 15):
            for x in range(0, 11):
                notch = abs(y - 10) + x < 4  # V cut at the tail's end
                if notch:
                    continue
                edge = y in (5, 14) or abs(y - 10) + x == 4
                X = x if side == 0 else w - 1 - x
                put(img, X, y, 'k' if edge else 'u' if y < 12 else 'I')
        for y in range(12, 16):  # fold: the band turns under into the tail
            for x in range(8, 11):
                X = x if side == 0 else w - 1 - x
                put(img, X, y, 'k' if y == 15 or x == 8 else 'I')
    for x in range(7, w - 7):
        put(img, x, 2, 'k')
        put(img, x, 3, 'Y')
        put(img, x, 4, 'v')
        for y in range(5, 11):
            put(img, x, y, 'V')
        put(img, x, 11, 'u')
        put(img, x, 12, 'd')
        put(img, x, 13, 'k')
    for y in range(2, 14):
        for x in (7, w - 8):
            put(img, x, y, 'k')
    save(img, 'ribbon')
    # Gold ribbon for the victory screen: the same shape, wine turned to gold and gold to wine.
    swap = {PAL['V']: PAL['g'], PAL['v']: PAL['Y'], PAL['u']: PAL['d'], PAL['Y']: PAL['v'], PAL['d']: PAL['u'], PAL['I']: PAL['d']}
    gold = img.copy()
    for y in range(h):
        for x in range(w):
            r, g, b, a = gold.getpixel((x, y))
            if a and (r, g, b) in swap:
                gold.putpixel((x, y), (*swap[(r, g, b)], a))
    save(gold, 'ribbon-gold')

    # Scroll rod (3-slice, left/right 6): turned wood with gold knobs.
    w, h = 24, 7
    img = new(w, h)
    for x in range(4, w - 4):
        for y, c in zip(range(1, 6), 'kBbbk'):
            put(img, x, y, c)
    for x0 in (0, w - 5):
        for dy, row in enumerate(['.kkk.', 'kyYgk', 'kYgdk', 'kgddk', 'kgddk', 'kdddk', '.kkk.']):
            for dx, c in enumerate(row):
                if c != '.':
                    put(img, x0 + dx, dy, c)
    save(img, 'rod')

    # Slider knob and check boxes.
    sprite(['.kkkk.', 'kyYYgk', 'kYggdk', 'kYggdk', 'kYggdk', 'kgdddk', 'kgdddk', '.kkkk.'], 'knob')
    box = ['kkkkkkkkk', 'kgggggggk', 'kgkkkkkdk', 'kgkIIIkdk', 'kgkIiikdk', 'kgkIiikdk', 'kgkkkkkdk', 'kdddddddk', 'kkkkkkkkk']
    sprite(box, 'check-off')
    on = [list(r) for r in box]
    for x, y in ((6, 2), (5, 3), (4, 4), (3, 5), (2, 4), (2, 3), (3, 3)):
        on[y][x] = 'y'
    for x, y in ((7, 1), (6, 1), (7, 2)):
        on[y][x] = 'Y'
    sprite([''.join(r) for r in on], 'check-on')


def icons():
    # Menu cursor: a gold arrow pointing at the chosen line.
    rows = []
    for i in range(11):
        half = 5 - abs(i - 5)
        body = ''.join('yYYgd'[min(4, j)] if i <= 5 else 'Ygddd'[min(4, j)] for j in range(half))
        rows.append(('k' + body + 'k') if half else 'k')
    sprite(rows, 'cursor')
    sprite(['.kk...kk.', 'kRRk.krrk', 'kRwrkrrrk', 'krRrrrrrk', 'krrrrrrmk', '.krrrrmk.', '..krrmk..', '...kmk...', '....k....'], 'heart')
    sprite(['...k....', '...kk...', '..kOk...', '..kOOk..', '.kOyOOk.', '.kOyyOk.', 'kOOyyOok', 'kOyyyOok', 'koOyOook', '.kooook.', '..kkkk..'], 'flame')
    sprite(['..kkkk..', '.kYYYgk.', 'kYyYggdk', 'kYYgggdk', 'kYggggdk', 'kgggggdk', '.kgdddk.', '..kkkk..'], 'coin')
    sprite(['.kkkkkk.', 'kwwwwwWk', 'kwkkwkkk', 'kwkkwkkk', 'kwwwkwWk', '.kwwwWk.', '.kwkwkk.', '..kkkk..'], 'skull')
    # Denário: the silver coin spent in the Market, a laurel wreath stamped on it.
    sprite(['..kkkkk..', '.kwwwssk.', 'kwwSSSssk', 'kwSwwwSsk', 'kwSwSwSsk', 'kwSwwwSSk', 'kssSSSSSk', '.kssSSSk.', '..kkkkk..'], 'denario')
    sprite(['....k....', '...kYk...', '...kYk...', 'kkkkYgkkk', 'kYyYYYggk', '.kYYYggk.', '.kYgkgdk.', 'kYgk.kgdk', 'kkk...kkk'], 'star')
    sprite(['....O....', '.O.kkk.O.', '..kYyYk..', '.kYyYYgk.', 'OkYYYggkO', '.kYYggdk.', '..kggdk..', '.O.kkk.O.', '....O....'], 'sun')
    sprite(['..kkkk...', '.knnNk...', 'kwnNk....', 'knnk.....', 'knnk.....', 'knnNk....', '.knnNkkk.', '..knnnnk.', '...kkkk..'], 'moon')
    sprite(['kkkkkkk', 'kBbbbbk', '.kwwwk.', '..kOk..', '...k...', '..kwk..', '.kwOOk.', 'kBbbbbk', 'kkkkkkk'], 'hourglass')
    sprite(['..kkkk..', '.kRwRrk.', 'kRwRrrmk', 'krRrrrmk', '.krrrmk.', '..krmk..', '...kk...'], 'gem')
    sprite(['.......kk', '......kwk', '.....kwsk', '....kwsk.', '.k.kwsk..', '.kgkskk..', '..kgk....', '.kdkgk...', 'kdk.kk...'], 'sword')
    sprite(['...kkk...', '.k.kSk.k.', '.kkSsSkk.', 'kSsSkSsSk', 'kSskkksSk', 'kSsSkSsSk', '.kkSsSkk.', '.k.kSk.k.', '...kkk...'], 'gear')
    sprite(['.kkkkkkk.', 'kBbppppqk', 'kbkpppqk.', '.kpKKKpk.', '.kpppppk.', '.kpKKpqk.', 'kBpppppbk', 'kbkkkkkbk', '.k.....k.'], 'scroll')
    # Emblems that tell the scrolls apart (drawn over the scroll's paper).
    sprite(['....k....', '.k.kOk.k.', '.kOkOkOk.', '..kOOOk..', 'kOOOyOOOk', '..kOOOk..', '.kOkOkOk.', '.k.kOk.k.', '....k....'], 'burst')
    sprite(['...k...', '..kOk..', '..kyk..', '...k...', '.kwwwk.', '.kwWwk.', '.kwWwk.', '.kwWwk.', 'kkkkkkk'], 'candle')
    sprite(['.......kk', '.....kkwk', '...kkwwWk', '.kkwwwWk.', 'kwwwwWk..', 'kwwWWk...', '.kWkk....', '..k......'], 'wing')
    sprite(['.kkk.kkk.', 'kssk.kssk', 'kSSk.kSSk', 'krrk.krrk', 'krrk.krrk', 'krrkkkrrk', 'krrrrrrmk', '.krrrrmk.', '..kkkkk..'], 'magnet')
    sprite(['.kkkkkk.', 'kwwwwwWk', 'kwkwwkWk', 'kwwwwwWk', 'kwwkwwWk', 'kwkwwkWk', 'kWWWWWWk', '.kkkkkk.'], 'die')
    sprite(['..kkkkk..', '.kwwwwwk.', 'kwwkkkwwk', 'kwwkNkwwk', 'kwwkkkwwk', '.kwwwwwk.', '..kkkkk..'], 'eye')
    sprite(['kkkkkkkkk', 'kpppkpppk', 'kpKpkpKpk', 'kpppkpppk', 'kpKpkpKpk', 'kpppkpppk', 'kbbbkbbbk', 'kkkkkkkkk'], 'book')
    # Trophies: a cup in bronze, silver and gold; grey and dark while not yet won. And a padlock.
    cup = ['.kkkkkkkkk.', 'kk1222223kk', 'k1k122223k3', 'k1k122223k3', '.kk122223kk', '..k122233k.', '...k1223k..', '....k23k...', '....k23k...', '..kk1223kk.', '..k122223k.', '..kkkkkkkk.']
    for name, (c1, c2, c3) in {'trophy-0': ('R', 'o', 'b'), 'trophy-1': ('w', 's', 'S'), 'trophy-2': ('y', 'Y', 'd'), 'trophy-off': ('S', 'S', 'K')}.items():
        sprite([r.replace('1', c1).replace('2', c2).replace('3', c3) for r in cup], name)
    sprite(['..kkkk..', '.kSsSSk.', '.kk..kk.', '.k....k.', 'kkkkkkkk', 'kYYYYYgk', 'kYgkkggk', 'kYggkggk', 'kggggggk', 'kdddddk.'[:8], '.kkkkkk.'], 'lock')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    frames()
    buttons()
    icons()
    print('ui sprites ->', os.path.relpath(OUT))
