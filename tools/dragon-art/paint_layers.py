"""Separate the original painting into overlapping vector pigments with Bézier edges."""
import cv2
import numpy as np
from PIL import Image

def draw_mask(mask):
    up=cv2.resize(mask.astype("uint8"),None,fx=3,fy=3,interpolation=cv2.INTER_NEAREST)
    up=cv2.dilate(up,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
    contours,_=cv2.findContours(up,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    commands=[]
    # Quadratic smooth commands reflect the previous control point at the midpoint.
    # Integer coordinates in half-pixel units keep neighboring pigments on the same lattice.
    def pair(p):return str(int(p[0]))+" "+str(int(p[1]))
    for c in contours:
        if abs(cv2.contourArea(c))<6:continue
        pts=cv2.approxPolyDP(c,1.7,True)[:,0,:].astype(float)*2/3
        if len(pts)<3:continue
        mid=np.rint((pts+np.roll(pts,1,axis=0))/2).astype(int)
        first=np.rint(pts[0]).astype(int)
        commands.extend(["M",pair(mid[0]),"q",pair(first-mid[0])," ",pair(mid[1]-mid[0]),"t"])
        # Explicit control points periodically reset reflected rounding error on thin contours.
        for j in range(1,len(mid)):
            end=mid[(j+1)%len(mid)]-mid[j]
            if j%4==0:
                commands.extend(["q",pair(np.rint(pts[j]).astype(int)-mid[j])," ",pair(end)])
                if j+1<len(mid):commands.append("t")
            else:commands.extend([pair(end)," "])
        commands.append("Z")
    return "".join(commands).replace(" -","-")

def painted_svg(src,hero=False,thumb=False):
    im=src
    im=im.crop(im.getchannel("A").point(lambda v:255 if v>80 else 0).getbbox())
    im.thumbnail((120,110) if thumb else (464,432) if hero else (360,330),Image.Resampling.LANCZOS)
    w,h=im.size;alpha=np.array(im)[:,:,3]>85;rgb=np.array(im)[:,:,:3].copy()
    rgb[~alpha]=np.median(rgb[alpha],axis=0);rgb=cv2.bilateralFilter(rgb,5,13,2.5)
    quant=Image.fromarray(rgb).quantize(40 if thumb else 118 if hero else 86,dither=Image.Dither.NONE)
    idx=np.asarray(quant);palette=np.array(quant.getpalette(),dtype=float).reshape(-1,3)
    counts=np.bincount(idx[alpha].flatten(),minlength=len(palette));available=list(np.unique(idx[alpha]))
    first=max(available,key=lambda i:counts[i]);order=[first];available.remove(first)
    # Incremental nearest-color distances preserve the original greedy order.
    distance=np.full(len(palette),np.inf)
    while available:
        delta=palette-palette[order[-1]]
        distance=np.minimum(distance,(delta*delta).sum(axis=1))
        i=max(available,key=lambda j:distance[j]*np.sqrt(counts[j]))
        order.append(i);available.remove(i)
    pixels=rgb.astype(np.float32);best=np.full((h,w),np.inf);layers=[];final=np.zeros((h,w),"uint8")
    for i in order:
        error=np.sum((pixels-palette[i])**2,axis=2)
        select=(error+14<best)&alpha;best[select]=error[select];final[select]=i
        layers.append((i,select))
    paths=[]
    for rank,(i,mask) in enumerate(layers):
        # Keep a small painted underlap at boundaries, elide hidden interior pigments.
        if rank:mask=mask & (cv2.dilate((final==i).astype("uint8"),np.ones((5,5),"uint8"))>0)
        d=draw_mask(mask);color="#%02x%02x%02x"%tuple(map(int,palette[i]))
        if d:paths.append(f'<path fill="{color}" d="{d}"/>')
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><g fill-rule="evenodd" transform="scale(.5)">'+''.join(paths)+'</g></svg>'
    return im.size,svg
