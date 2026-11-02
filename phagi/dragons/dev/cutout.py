"""Вырезает белый фон у картинки из генератора (Canva отдаёт JPG на белом): заливка от краёв, замкнутые белые
просветы (между лапами) тоже фон, мягкий край и снятие белой каймы. python3 cutout.py вход.jpg выход.webp"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

def cut(src, dst, tol=38, hole=150):
    im = Image.open(src).convert('RGB'); a = np.asarray(im).astype('f4')
    d = np.sqrt(((255 - a) ** 2).sum(-1)); white = d < tol
    lab, n = ndimage.label(white)
    H, W = white.shape; border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = ndimage.sum(np.ones_like(d), lab, range(1, n + 1)); mean_d = ndimage.mean(d, lab, range(1, n + 1))
    bg = np.zeros_like(white)
    for i in range(1, n + 1):
        if i in border or (sizes[i - 1] >= hole and mean_d[i - 1] < 14): bg |= lab == i
    alpha = np.where(bg, 0, 255).astype('f4')
    edge = ndimage.binary_dilation(bg, iterations=2) & ~bg
    alpha = np.where(edge, np.minimum(alpha, np.clip((d - 10) / 40 * 255, 0, 255)), alpha)
    A = Image.fromarray(alpha.astype('uint8')).filter(ImageFilter.GaussianBlur(.6)); al = np.asarray(A).astype('f4') / 255
    k = np.clip(al, .05, 1)[..., None]; rgb = np.clip((a - 255 * (1 - k)) / k, 0, 255)
    out = Image.fromarray(rgb.astype('uint8')).convert('RGBA'); out.putalpha(A); out.save(dst, quality=92); return out

if __name__ == '__main__':
    cut(sys.argv[1], sys.argv[2])
