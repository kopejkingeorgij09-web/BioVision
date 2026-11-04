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
# ручные поправки опорных точек, доли кадра после обрезки: {код: {точка: [u, v]}}
FIX = {}


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
    # передние лапы: самые правые, задние: самые левые из правой половины тела и левее
    front = max(feet_c) if feet_c else .66
    rear = min([f for f in feet_c if f > .22] or [.36])
    if front - rear < .12: rear = front - .25
    # хвост: самая левая точка
    ys2, xs2 = np.nonzero(a[:, : int(W * .3)])
    j = xs2.argmin() if len(xs2) else 0
    tail = (xs2[j] / W, ys2[j] / H) if len(xs2) else (0, .5)

    def topv(u):
        x0, x1 = int(max(0, (u - .03) * W)), int(min(W - 1, (u + .03) * W))
        return float(np.percentile(top[x0:x1 + 1], 80)) / H

    def botv(u):
        # низ туловища над лапами: ищем верх просвета между лапами
        x0, x1 = int(max(0, (u - .06) * W)), int(min(W - 1, (u + .06) * W))
        return float(np.percentile(bot[x0:x1 + 1], 15)) / H

    # плечо (крепление крыла) и основание шеи считаются от морды: у всех рисунков одна раскладка
    # (голова справа, хвост слева), а лапы по силуэту находятся ненадёжно из-за хвостов до земли
    sh_u = snout[0] - .3
    shoulder = (sh_u, topv(sh_u) + .07)
    hip = (snout[0] - .62, topv(snout[0] - .62) + .08)
    # шея: середина между плечом и мордой, по верхнему краю
    neck_u = snout[0] - .22
    neck = (neck_u, topv(neck_u) + .08)
    eye = (snout[0] - .075, snout[1] - .035)
    # линия живота: низ силуэта в просветах между лапами
    x0, x1 = int((rear + .03) * W), int((front - .03) * W)
    gap = [bot[x] for x in range(x0, max(x0 + 1, x1)) if has[x] and bot[x] < ground - H * .08]
    belly = min(.85, max(.45, float(np.median(gap)) / H)) if gap else .7
    return {
        'snout': snout, 'eye': eye, 'neck': neck, 'shoulder': shoulder, 'hip': hip, 'tail': tail,
        'front': front, 'rear': rear, 'belly': belly, 'feet': feet_c, 'ground': ground / H,
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
        an.update(FIX.get(code, {}))
        man['body'][code] = dict(w=im.width, h=im.height, **{k: r3(v) for k, v in an.items()})
    for n in NAMES:
        src = Image.open(os.path.join(SRC, n, 'wing.webp')).convert('RGBA')
        root = WING_ROOT[n]
        if n in WING_MIRROR:
            from PIL import ImageOps
            src = ImageOps.mirror(src)
        im, (ox, oy) = crop(src)
        im, k = fit(im, WING_W)
        save(im, os.path.join(OUT, 'w', CODE[n] + '.webp'))
        man['wing'][CODE[n]] = dict(w=im.width, h=im.height, root=r3(((root[0] - ox) * k / im.width, (root[1] - oy) * k / im.height)))
        b, _ = crop(Image.open(os.path.join(SRC, n, 'baby.webp')).convert('RGBA'))
        b, _ = fit(b, 480)
        save(b, os.path.join(OUT, 'k', CODE[n] + '.webp'))
        man['baby'][CODE[n]] = dict(w=b.width, h=b.height, **{k2: r3(v) for k2, v in anchors(b).items()})
    js = 'window.DR6ART_MANIFEST=' + json.dumps(man, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(os.path.join(OUT, 'manifest.js'), 'w') as f:
        f.write('/* Создано dev/build_art6.py, руками не править */\n' + js)
    tot = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
    print(len(man['body']), 'тел,', len(man['wing']), 'крыльев,', round(tot / 1e6, 1), 'МБ')


if __name__ == '__main__':
    main()
