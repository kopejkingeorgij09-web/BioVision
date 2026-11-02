"""Пробные гибриды Драконов 6.0: тело первой стихии, крылья второй, прорастание второй стихии по телу,
контур и аура обеих стихий. Статичный кадр для утверждения вида; в игре то же собирается на скелете.
Запуск: python3 phagi/dragons/dev/hybrid_proto.py <папка вывода>"""
import sys, os, math, random
from PIL import Image, ImageFilter, ImageEnhance, ImageOps, ImageChops, ImageDraw

ART = os.path.join(os.path.dirname(__file__), '..', 'art-src')
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
BG = (18, 26, 36, 255)

def load(e, p):
    return Image.open(os.path.join(ART, e, p + '.webp')).convert('RGBA')

# точка крепления крыла в исходнике и плечо на теле (в пикселях исходников 1536x1024)
WING_ROOT = {'fire': (1366, 700), 'water': (1250, 551), 'earth': (1475, 589), 'air': (1429, 625),
             'flora': (1472, 635), 'light': (1482, 585), 'dark': (1481, 614)}
WING_MIRROR = {'fire'}
SHOULDER = {'fire': (1060, 360), 'water': (1170, 540), 'light': (1150, 455), 'earth': (1080, 330), 'air': (1150, 470),
            'flora': (1180, 470), 'dark': (1080, 330)}
# наклон ближнего и дальнего крыла по стихии крыла
WING_ROT = {'fire': (-22, -10), 'earth': (-22, -10), 'air': (-2, -8), 'water': (2, -8), 'light': (-8, -18), 'dark': (-8, -18), 'flora': (-10, -16)}
WING_K = {'fire': .6, 'water': .62, 'earth': .55, 'air': .62, 'flora': .6, 'light': .6, 'dark': .62}
COL = {'fire': (255, 110, 30), 'water': (40, 170, 240), 'earth': (240, 160, 40), 'air': (200, 230, 255),
       'flora': (120, 210, 70), 'light': (255, 225, 120), 'dark': (160, 80, 255)}

# опорные цвета стихий для общей палитры гибрида: тень, середина, свет
PAL = {'fire': [(60, 10, 5), (215, 60, 20), (255, 205, 100)], 'earth': [(40, 30, 20), (145, 100, 55), (245, 180, 70)],
       'water': [(5, 30, 70), (30, 130, 200), (200, 240, 255)], 'air': [(40, 70, 140), (95, 160, 240), (250, 252, 255)],
       'flora': [(25, 40, 10), (95, 140, 50), (225, 240, 160)], 'light': [(110, 80, 20), (230, 180, 60), (255, 250, 225)],
       'dark': [(15, 5, 30), (105, 45, 185), (215, 170, 255)]}

def unify(im, a, b, k):
    """«усреднённый цвет»: карта градиента из средней палитры двух стихий, смешанная с исходником.
    Светотень и фактура остаются, а тело и крылья окрашиваются в одну общую гамму"""
    if not k: return im
    stops = [tuple((x + y) // 2 for x, y in zip(pa, pb)) for pa, pb in zip(PAL[a], PAL[b])]
    lut = []
    for ch in range(3):
        for v in range(256):
            t = v / 255
            if t < .5: c0, c1, u = stops[0][ch], stops[1][ch], t / .5
            else: c0, c1, u = stops[1][ch], stops[2][ch], (t - .5) / .5
            lut.append(int(c0 + (c1 - c0) * u))
    lum = ImageOps.grayscale(im)
    mapped = Image.merge('RGB', (lum, lum, lum)).point(lut)
    # режим «цвет»: от карты берётся только оттенок, яркость остаётся исходной, поэтому краски не тускнеют
    ml = ImageOps.grayscale(mapped); ratio = ImageChops.divide if False else None
    import numpy as np
    o = np.asarray(im.convert('RGB')).astype('f4'); m = np.asarray(mapped).astype('f4')
    lo = o @ np.array([.299, .587, .114], 'f4'); lm = m @ np.array([.299, .587, .114], 'f4')
    m = np.clip(m * (lo / np.maximum(lm, 1))[..., None], 0, 255)
    rgb = Image.blend(im.convert('RGB'), Image.fromarray(m.astype('uint8')), k)
    rgb = ImageEnhance.Color(rgb).enhance(1 + .5 * k)
    out = rgb.convert('RGBA'); out.putalpha(im.getchannel('A')); return out

def grade(im, sat=1.0, con=1.0, bri=1.0):
    r, g, b, a = im.split(); rgb = Image.merge('RGB', (r, g, b))
    rgb = ImageEnhance.Color(rgb).enhance(sat); rgb = ImageEnhance.Contrast(rgb).enhance(con); rgb = ImageEnhance.Brightness(rgb).enhance(bri)
    return Image.merge('RGBA', (*rgb.split(), a))

def solid(alpha, col, k=1.0):
    im = Image.new('RGBA', alpha.size, col + (0,)); im.putalpha(alpha.point(lambda v: int(v * k))); return im

def glow_outline(alpha, col, grow=9, blur=14, k=1.0):
    a = alpha.point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(grow)).filter(ImageFilter.GaussianBlur(blur))
    return solid(a, col, k)

def tint_mask(im, mask, col, k):
    """прорастание стихии: перекраска по маске с сохранением светотени"""
    gray = ImageOps.grayscale(im).convert('RGB')
    tinted = ImageChops.multiply(gray, Image.new('RGB', im.size, col))
    tinted = ImageChops.screen(tinted, Image.new('RGB', im.size, tuple(int(c * .25) for c in col)))
    m = ImageChops.multiply(mask, im.getchannel('A')).point(lambda v: int(v * k))
    out = im.copy(); out.paste(Image.merge('RGBA', (*tinted.split(), im.getchannel('A'))), (0, 0), m); return out

def top_mask(alpha, depth=70, blur=10):
    """полоса вдоль верхнего края силуэта: гребень, шипы, хребет"""
    a = alpha.point(lambda v: 255 if v > 40 else 0)
    shifted = Image.new('L', a.size, 0); shifted.paste(a, (0, depth))
    return ImageChops.subtract(a, shifted).filter(ImageFilter.GaussianBlur(blur))

def seams(im, col, k=1.0):
    """первая стихия светится в швах и тенях крыла второй: тёмные места крыла загораются её цветом"""
    lum = ImageOps.grayscale(im); m = lum.point(lambda v: 255 if v < 38 else int((70 - v) * 8) if v < 70 else 0).filter(ImageFilter.GaussianBlur(1.2))
    m = ImageChops.multiply(m, im.getchannel('A')).point(lambda v: int(v * k))
    hot = Image.new('RGBA', im.size, col + (255,)); out = im.copy(); out.paste(hot, (0, 0), m)
    g = solid(m.filter(ImageFilter.GaussianBlur(5)), col, .55); out2 = im.copy(); out2.alpha_composite(g); out2.paste(hot, (0, 0), m)
    out2.putalpha(im.getchannel('A')); return out2

def veins(im, col, k=1.0):
    """для тёмных крыльев: светлые кости и жилки загораются цветом первой стихии"""
    lum = ImageOps.grayscale(im); m = lum.point(lambda v: 0 if v < 90 else min(255, (v - 90) * 4)).filter(ImageFilter.GaussianBlur(1))
    out = tint_mask(im, m, col, k); g = solid(m.filter(ImageFilter.GaussianBlur(6)), col, .5); out.alpha_composite(g); out.putalpha(im.getchannel('A')); return out

def wing(e, k, dark=1.0, hot=None):
    w = load(e, 'wing')
    if e in WING_MIRROR: w = ImageOps.mirror(w)
    w = w.resize((int(1536 * k), int(1024 * k)), Image.LANCZOS)
    w = grade(w, 1.1, 1.08, 1)
    if hot: w = (veins if e == 'dark' else seams)(w, hot[0], hot[1])
    return grade(w, 1, 1, dark), (WING_ROOT[e][0] * k, WING_ROOT[e][1] * k)

def place_rot(canvas, im, root, at, rot):
    big = Image.new('RGBA', (im.width * 2, im.height * 2))
    big.alpha_composite(im, (int(im.width - root[0]), int(im.height - root[1])))
    big = big.rotate(rot, resample=Image.BICUBIC, center=(im.width, im.height))
    canvas.alpha_composite(big, (int(at[0] - im.width), int(at[1] - im.height)))

def aura(size, box, cols, kinds, seed, n=90):
    """частицы обеих стихий вокруг дракона: в игре они живые, здесь один кадр"""
    r = random.Random(seed); lay = Image.new('RGBA', size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    sm = Image.new('RGBA', size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sm)
    x0, y0, x1, y1 = box
    for i in range(n):
        kind = kinds[i % len(kinds)]; col = cols[i % len(cols)]
        x = r.uniform(x0, x1); y = r.uniform(y0, y1)
        if kind == 'ember':
            s = r.uniform(3, 8); d.ellipse((x - s, y - s, x + s, y + s), fill=col + (230,))
        elif kind == 'rock':
            s = r.uniform(6, 16); pts = [(x + s * math.cos(a) * r.uniform(.6, 1), y + s * math.sin(a) * r.uniform(.6, 1)) for a in [j * 1.2 for j in range(5)]]
            d.polygon(pts, fill=(95, 70, 45, 235), outline=col + (255,))
        elif kind == 'drop':
            s = r.uniform(4, 9); d.ellipse((x - s * .6, y - s, x + s * .6, y + s), fill=col + (200,))
        elif kind == 'wind':
            if r.random() < .5: continue
            L = r.uniform(60, 140); d.arc((x - L, y - 18, x + L, y + 18), 200, 330, fill=col + (110,), width=2)
        elif kind == 'spark':
            s = r.uniform(5, 13); d.line((x - s, y, x + s, y), fill=col + (255,), width=2); d.line((x, y - s, x, y + s), fill=col + (255,), width=2)
        elif kind == 'leaf':
            s = r.uniform(7, 14); ang = r.uniform(0, 6.28); pts = [(x + math.cos(ang + t) * s * (1 if t in (0, 3.14) else .4), y + math.sin(ang + t) * s * (1 if t in (0, 3.14) else .4)) for t in (0, 1.57, 3.14, 4.71)]
            d.polygon(pts, fill=col + (230,))
        elif kind == 'smoke':
            s = r.uniform(30, 70); sd.ellipse((x - s, y - s * .6, x + s, y + s * .6), fill=col + (60,))
    glow = lay.filter(ImageFilter.GaussianBlur(6))
    out = Image.new('RGBA', size, (0, 0, 0, 0)); out.alpha_composite(sm.filter(ImageFilter.GaussianBlur(22))); out.alpha_composite(glow); out.alpha_composite(glow); out.alpha_composite(lay)
    return out

def crystals_from(e):
    """янтарные кристаллы с тела Земли: вырезаются по цвету"""
    im = load(e, 'body'); px = im.load(); m = Image.new('L', im.size, 0); mp = m.load()
    for x in range(400, 1100):
        for y in range(120, 420):
            r, g, b, a = px[x, y]
            if a > 100 and r > 200 and g > 110 and b < 90 and r - b > 140: mp[x, y] = 255
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5))
    out = im.copy(); out.putalpha(ImageChops.multiply(m, im.getchannel('A'))); return out.crop(out.getbbox())

def hybrid(name, a, b, scale, rot_near, rot_far, details=None, kinds=(), cols=(), body_grade=(1, 1, 1), hot=.8, wing_grade=(1,1,1), uni=0, tag=''):
    W, H = 2000, 1600; c = Image.new('RGBA', (W, H), BG)
    body = grade(load(a, 'body'), *body_grade)
    body = body.resize((int(1536 * scale), int(1024 * scale)), Image.LANCZOS)
    ox, oy = (W - body.width) // 2 - 80, (H - body.height) // 2 + 200
    sh = (ox + SHOULDER[a][0] * scale, oy + SHOULDER[a][1] * scale)
    alpha = body.getchannel('A')
    # 2. прорастание второй стихии по гребню и хребту
    body = tint_mask(body, top_mask(alpha, int(60 * scale)), COL[b], .75)
    if details: body = details(body, scale)
    body = unify(body, a, b, uni)
    full_a = Image.new('L', (W, H), 0); full_a.paste(body.getchannel('A'), (ox, oy))
    # 3. контур: снаружи вторая стихия, ближе к телу первая
    c.alpha_composite(glow_outline(full_a, COL[b], 25, 26, .9)); c.alpha_composite(glow_outline(full_a, COL[a], 9, 8, .8))
    wk = WING_K[b] * scale * 1.12
    wf, rf = wing(b, wk, 1, (COL[a], hot)); wf = grade(unify(wf, a, b, uni), 1, 1, .5); place_rot(c, wf, rf, (sh[0] + 45 * scale, sh[1] - 25 * scale), rot_far)
    c.alpha_composite(body, (ox, oy))
    wn, rn = wing(b, wk, 1, (COL[a], hot)); wn = unify(wn, a, b, uni); wa = Image.new('RGBA', (W, H)); place_rot(wa, wn, rn, sh, rot_near)
    c.alpha_composite(glow_outline(wa.getchannel('A'), COL[b], 9, 10, .7)); c.alpha_composite(wa)
    c.alpha_composite(aura((W, H), (ox - 40, oy - 120, ox + body.width + 40, oy + body.height + 20), cols, kinds, name))
    c = c.crop((80, 60, W - 80, H - 60))
    c.convert('RGB').resize((c.width * 3 // 5, c.height * 3 // 5), Image.LANCZOS).save(os.path.join(OUT, f'hybrid-{name}{tag}.webp'), quality=90)
    return c

def lava_details(body, scale):
    cr = crystals_from('earth'); out = body.copy()
    a = body.getchannel('A').point(lambda v: 255 if v > 120 else 0)
    def top(x):
        x = int(x * scale)
        for y in range(a.height):
            if a.getpixel((x, y)): return y
        return 0
    for (x, k) in [(330, .38), (450, .5), (575, .42)]:
        cc = cr.resize((int(cr.width * k * scale), int(cr.height * k * scale)), Image.LANCZOS)
        out.alpha_composite(cc, (int(x * scale - cc.width / 2), int(top(x) + 45 * scale - cc.height)))
    return out

def storm_details(body, scale):
    return body

def twilight_details(body, scale):
    a = body.getchannel('A'); lay = Image.new('RGBA', body.size); d = ImageDraw.Draw(lay); r = random.Random(3)
    for i in range(7):
        x = (700 + i * 70) * scale; y = 420 * scale
        pts = [(x + math.sin(t * .8 + i) * 14 * scale, y - t * 22 * scale) for t in range(9)]
        d.line(pts, fill=(130, 60, 230, 200), width=int(7 * scale))
    lay = lay.filter(ImageFilter.GaussianBlur(4)); out = body.copy(); out.alpha_composite(lay, (0, 0)); return out

def sheet(rows):
    th = []
    for parents, hyb, title in rows:
        p = [Image.open(os.path.join(OUT, f)).convert('RGB') if f.endswith('.webp') and os.path.exists(os.path.join(OUT, f)) else None for f in []]
    return

EL = ['fire', 'water', 'earth', 'air', 'flora', 'light', 'dark']
RU = {'fire': 'Огонь', 'water': 'Вода', 'earth': 'Земля', 'air': 'Воздух', 'flora': 'Флора', 'light': 'Свет', 'dark': 'Тьма'}
KIND = {'fire': 'ember', 'water': 'drop', 'earth': 'rock', 'air': 'wind', 'flora': 'leaf', 'light': 'spark', 'dark': 'smoke'}
# сила перекраски в общую палитру: близкие по цвету стихии сильно, противоположные слабо (контраст и есть их красота)
UNI = {('fire', 'water'): .15, ('fire', 'earth'): .45, ('fire', 'air'): .25, ('fire', 'flora'): .3, ('fire', 'light'): .45, ('fire', 'dark'): .15,
       ('water', 'earth'): .2, ('water', 'air'): .45, ('water', 'flora'): .35, ('water', 'light'): .2, ('water', 'dark'): .3,
       ('earth', 'air'): .2, ('earth', 'flora'): .45, ('earth', 'light'): .4, ('earth', 'dark'): .2,
       ('air', 'flora'): .25, ('air', 'light'): .3, ('air', 'dark'): .3, ('flora', 'light'): .35, ('flora', 'dark'): .15, ('light', 'dark'): .1}

def any_details(b):
    if b == 'earth': return lava_details
    if b == 'dark': return twilight_details
    return None

def all_pairs():
    from PIL import ImageFont
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 26)
    tiles = []
    for i, a in enumerate(EL):
        for b in EL[i + 1:]:
            nm = f'{a}-{b}'; rn, rf = WING_ROT[b]
            grade_ = (1.3, 1.18, 1) if a == 'water' else (1, 1, 1)
            hybrid(nm, a, b, 1.1, rn, rf, any_details(b), (KIND[a], KIND[b], KIND[a]), (COL[a], COL[b]), grade_, uni=UNI[(a, b)])
            im = Image.open(os.path.join(OUT, f'hybrid-{nm}.webp')).convert('RGB'); im.thumbnail((620, 470))
            t = Image.new('RGB', (640, 520), BG[:3]); t.paste(im, ((640 - im.width) // 2, 40))
            ImageDraw.Draw(t).text((16, 8), f'{RU[a]} + {RU[b]}  (перекраска {int(UNI[(a, b)] * 100)} %)', fill=(235, 235, 235), font=f)
            tiles.append(t); print(nm, flush=True)
    cols = 3; rows = (len(tiles) + cols - 1) // cols; sh = Image.new('RGB', (640 * cols, 520 * rows), BG[:3])
    for k, t in enumerate(tiles): sh.paste(t, ((k % cols) * 640, (k // cols) * 520))
    sh.save(os.path.join(OUT, 'hybrids-all.webp'), quality=82)

if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[2] == 'all':
    os.makedirs(OUT, exist_ok=True); all_pairs(); sys.exit(0)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    hybrid('lava', 'fire', 'earth', 1.1, -22, -10, lava_details, ('ember', 'rock', 'ember'), (COL['fire'], COL['earth'], (255, 200, 80)))
    hybrid('storm', 'water', 'air', 1.1, 2, -8, storm_details, ('drop', 'wind', 'drop', 'wind'), (COL['water'], COL['air']), (1.3, 1.18, 1))
    hybrid('twilight', 'light', 'dark', 1.1, -8, -18, twilight_details, ('spark', 'smoke', 'spark'), (COL['light'], COL['dark'], (255, 240, 200)))
    U = .45
    hybrid('lava', 'fire', 'earth', 1.1, -22, -10, lava_details, ('ember', 'rock', 'ember'), (COL['fire'], COL['earth'], (255, 200, 80)), uni=U, tag='-uni')
    hybrid('storm', 'water', 'air', 1.1, 2, -8, storm_details, ('drop', 'wind', 'drop', 'wind'), (COL['water'], COL['air']), (1.3, 1.18, 1), uni=U, tag='-uni')
    hybrid('twilight', 'light', 'dark', 1.1, -8, -18, twilight_details, ('spark', 'smoke', 'spark'), (COL['light'], COL['dark'], (255, 240, 200)), uni=U, tag='-uni')
    print('ok')
