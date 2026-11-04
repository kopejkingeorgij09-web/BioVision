"""Сборка рисунка Драконов 6.0 для игры: обрезка, уменьшение и опорные точки скелета.
Берёт art-src/<стихия>/{body,wing,baby}.webp и art-src/hybrids/<id>/body.webp,
пишет art6/b/<код>.webp, art6/w/<код>.webp, art6/k/<код>.webp и art6/manifest.js.
Запуск: python3 phagi/dragons/dev/build_art6.py"""
import os, json, itertools
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'art-src')
OUT = os.path.join(HERE, '..', 'art6')
NAMES = ['fire', 'water', 'earth', 'air', 'flora', 'light', 'dark']
CODE = dict(zip(NAMES, 'FWTAPLD'))
BODY_W = 720   # ширина тела в игре; на острове дракон 70-100 px, в осмотре до 360 px css (x2 на ретине)
WING_W = 560
Q = 84

# крылья: точка крепления в исходнике 1536x1024 (из hybrid_proto.py) и зеркало
WING_ROOT = {'fire': (1366, 700), 'water': (1250, 551), 'earth': (1475, 589), 'air': (1429, 625),
             'flora': (1472, 635), 'light': (1482, 585), 'dark': (1481, 614)}
WING_MIRROR = {'fire'}
# ручная разметка скелета: dev/art6-rig.txt
def load_rig():
    rig = {}
    for line in open(os.path.join(HERE, 'art6-rig.txt')):
        if not line.strip() or line.startswith('#'): continue
        c, *n = line.split(); n = list(map(float, n))
        rig[c] = dict(shoulder=(n[0], n[1]), hip=(n[2], n[3]), belly=n[4], rear=(n[5], n[6]), front=(n[7], n[8]))
    return rig


def split_legs(a, ground, rng, belly):
    """в группе лап (задних или передних) ищем ближнюю и дальнюю лапу по срезу на высоте голени"""
    H, W = a.shape
    best = []
    for k in (.25, .4, .55):
        y = int(ground - (ground - belly * H) * k)
        row = a[min(H - 1, y), int(rng[0] * W):int(rng[1] * W)]
        rs = [((s0 + e0) / 2 / W + rng[0]) for s0, e0 in runs(row, W * .006) if e0 - s0 > W * .008]
        if len(rs) >= 2: best = rs; break
        if len(rs) > len(best): best = rs
    if len(best) >= 2:
        mid = (best[0] + best[-1]) / 2
        return [[rng[0], mid, best[0]], [mid, rng[1], best[-1]]]
    c = best[0] if best else (rng[0] + rng[1]) / 2
    return [[rng[0], rng[1], c]]


def crop(im, pad=6):
    a = np.asarray(im.getchannel('A'))
    ys, xs = np.nonzero(a > 24)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width, x1 + pad), min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1)), (x0, y0)


def runs(mask_cols, gap):
    xs = np.nonzero(mask_cols)[0]
    if not len(xs): return []
    out, s, p = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - p > gap: out.append((s, p)); s = x
        p = x
    out.append((s, p))
    return out


def anchors(im):
    """опорные точки тела в долях кадра: морда, глаз, плечо (крепление крыла), таз, лапы, кончик хвоста"""
    a = np.asarray(im.getchannel('A')) > 60
    H, W = a.shape
    has = a.any(axis=0)
    top = np.where(has, a.argmax(axis=0), H)
    bot = np.where(has, H - 1 - a[::-1].argmax(axis=0), 0)
    # лапы: столбцы, где силуэт доходит до земли
    # земля: самая низкая точка без хвоста (хвост бывает ниже лап)
    ground = bot[int(W * .3):].max()
    near = (bot >= ground - H * .06) & (np.arange(W) > W * .2)
    feet = [(s, e) for s, e in runs(near, W * .02) if e - s > W * .012]
    feet_c = [((s + e) / 2) / W for s, e in feet]
    # морда: самая правая точка верхних 60 % кадра
    ys, xs = np.nonzero(a[: int(H * .6)])
    i = xs.argmax(); snout = (xs[i] / W, ys[i] / H)
    # хвост: самая левая точка
    ys2, xs2 = np.nonzero(a[:, : int(W * .3)])
    j = xs2.argmin() if len(xs2) else 0
    tail = (xs2[j] / W, ys2[j] / H) if len(xs2) else (0, .5)

    def topv(u0, u1=None, q=80):
        if u1 is None: u0, u1 = u0 - .03, u0 + .03
        x0, x1 = int(max(0, u0 * W)), int(min(W - 1, u1 * W))
        return float(np.percentile(top[x0:x1 + 1], q)) / H

    # лапы: узкие полосы силуэта на высоте голени (несколько срезов, берём самый чистый)
    legs = []
    for k in (.08, .11, .14, .05):
        y = int(ground - H * k)
        row = a[y].copy(); row[: int(W * .22)] = False; row[int((snout[0] - .02) * W):] = False
        rs = [(s0 / W, e0 / W) for s0, e0 in runs(row, W * .006) if W * .008 < e0 - s0 < W * .11]
        if 3 <= len(rs) <= 6: legs = rs; break
        if len(rs) > len(legs): legs = rs
    if len(legs) < 2: legs = [(.3, .36), (.4, .46), (.68, .74), (.78, .84)]
    cs = [(l0 + l1) / 2 for l0, l1 in legs]
    # задние и передние: делим по самому большому просвету
    gi = max(range(len(cs) - 1), key=lambda i: cs[i + 1] - cs[i])
    rear_g, front_g = legs[: gi + 1], legs[gi + 1:]
    rear = float(np.mean([(l0 + l1) / 2 for l0, l1 in rear_g]))
    front = float(np.mean([(l0 + l1) / 2 for l0, l1 in front_g]))
    feet_c = cs
    # живот: низ силуэта в просвете между задними и передними лапами
    x0, x1 = int(rear_g[-1][1] * W) + 2, int(front_g[0][0] * W) - 2
    gap = [bot[x] for x in range(x0, max(x0 + 1, x1)) if has[x] and bot[x] < ground - H * .06]
    belly = min(.88, max(.4, float(np.median(gap)) / H)) if gap else .68
    # спина: верх силуэта посередине между тазом и плечом (там нет ни шеи, ни хвоста)
    back = topv(rear + (front - rear) * .25, rear + (front - rear) * .7, 75)
    sh_u = front - .03
    shoulder = (sh_u, back + (belly - back) * .18)
    hip = (rear, back + (belly - back) * .25)
    neck = (min(snout[0] - .08, sh_u + .06), back + (belly - back) * .1)
    eye = (snout[0] - .075, snout[1] - .035)
    return {
        'snout': snout, 'eye': eye, 'neck': neck, 'shoulder': shoulder, 'hip': hip, 'tail': tail,
        'front': front, 'rear': rear, 'belly': belly, 'feet': feet_c, 'ground': ground / H, 'back': back,
        'legs': [[l0, l1, (l0 + l1) / 2, 1 if g is front_g else 0] for g in (rear_g, front_g) for l0, l1 in g],
    }


def r3(v):
    if isinstance(v, (list, tuple)): return [r3(x) for x in v]
    return round(float(v), 3)


def fresh(path, src):
    return os.path.exists(path) and os.path.getmtime(path) >= os.path.getmtime(src)


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=Q, method=5)


def fit(im, w):
    k = w / im.width
    return im.resize((w, max(1, round(im.height * k))), Image.LANCZOS), k


def main():
    global RIG
    RIG = load_rig()
    man = {'body': {}, 'wing': {}, 'baby': {}}
    bodies = {}
    for n in NAMES:
        bodies[CODE[n]] = os.path.join(SRC, n, 'body.webp')
    for r in (2, 3):
        for combo in itertools.combinations(NAMES, r):
            hid = '-'.join(combo)
            p = os.path.join(SRC, 'hybrids', hid, 'body.webp')
            if not os.path.exists(p): raise SystemExit('нет ' + p)
            bodies[''.join(CODE[c] for c in combo)] = p
    for code, p in bodies.items():
        dst = os.path.join(OUT, 'b', code + '.webp')
        if fresh(dst, p): im = Image.open(dst).convert('RGBA')
        else:
            im, _ = crop(Image.open(p).convert('RGBA'))
            im, _ = fit(im, BODY_W)
            save(im, dst)
        an = anchors(im)
        R = RIG.get(code)
        if R:
            an.update(shoulder=R['shoulder'], hip=R['hip'], belly=R['belly'], rear=sum(R['rear']) / 2, front=sum(R['front']) / 2)
            sh = R['shoulder']
            an['neck'] = (min(an['snout'][0] - .1, sh[0] + .05), sh[1] - .02)
            al = np.asarray(im.getchannel('A')) > 60
            g = an['ground'] * im.height
            an['legs'] = [l + [0] for l in split_legs(al, g, R['rear'], R['belly'])] + [l + [1] for l in split_legs(al, g, R['front'], R['belly'])]
        else: print('нет разметки', code)
        man['body'][code] = dict(w=im.width, h=im.height, **{k: r3(v) for k, v in an.items()})
    for n in NAMES:
        src = Image.open(os.path.join(SRC, n, 'wing.webp')).convert('RGBA')
        root = WING_ROOT[n]
        if n in WING_MIRROR:
            from PIL import ImageOps
            src = ImageOps.mirror(src)
        im, (ox, oy) = crop(src)
        im, k = fit(im, WING_W)
        if not os.path.exists(os.path.join(OUT, 'w', CODE[n] + '.webp')): save(im, os.path.join(OUT, 'w', CODE[n] + '.webp'))
        man['wing'][CODE[n]] = dict(w=im.width, h=im.height, root=r3(((root[0] - ox) * k / im.width, (root[1] - oy) * k / im.height)))
        b, _ = crop(Image.open(os.path.join(SRC, n, 'baby.webp')).convert('RGBA'))
        b, _ = fit(b, 480)
        if not os.path.exists(os.path.join(OUT, 'k', CODE[n] + '.webp')): save(b, os.path.join(OUT, 'k', CODE[n] + '.webp'))
        man['baby'][CODE[n]] = dict(w=b.width, h=b.height, **{k2: r3(v) for k2, v in anchors(b).items()})
    js = 'window.DR6ART_MANIFEST=' + json.dumps(man, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(os.path.join(OUT, 'manifest.js'), 'w') as f:
        f.write('/* Создано dev/build_art6.py, руками не править */\n' + js)
    tot = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
    print(len(man['body']), 'тел,', len(man['wing']), 'крыльев,', round(tot / 1e6, 1), 'МБ')


if __name__ == '__main__':
    main()
