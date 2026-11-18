"""Species illustration masters and pigment treatments for elemental hybrids."""
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects, binary_dilation, distance_transform_edt

SOURCES=Path(__file__).resolve().parent/"sources"
# Shadow, reflected color, half-tone, lit scale, highlight.
RAMPS=[
    ("281d2a","56313c","ab4335","f67e3d","ffdc83"),
    ("10263d","174763","207da0","6cd3db","dcfeef"),
    ("293b56","496c87","7caeb0","c2e1de","f7f8e3"),
    ("30282c","664535","9d6947","cc9b69","fae1b0"),
    ("1e3635","305746","5c8743","9ab85d","d4e6a0"),
    ("212144","394187","4869be","c2aa32","fff693"),
    ("272d3a","49545b","7f9199","c1cdd0","fbf6dd"),
    ("191b3c","35305b","64518f","9682c8","9ae2ed"),
    ("201d2c","362938","584051","7d5266","c69b9c"),
    ("523b36","8f643e","c79b56","f0d795","fffae0"),
]
RAMPS=np.array([[[int(s[k:k+2],16) for k in (0,2,4)] for s in row] for row in RAMPS],dtype=float)
SHEETS=[("four",2,2,[0,1,3,6]),("six",3,2,[2,4,5,7,8,9])]

@lru_cache(maxsize=2)
def original_sheet(name):
    return np.asarray(Image.open(SOURCES/("elemental-"+name+".png")).convert("RGBA"))

def pure_portrait(element):
    name,cols,rows,ids=next(s for s in SHEETS if element in s[3])
    rgba=original_sheet(name)
    cc,n=label(rgba[:,:,3]>45)
    areas=np.bincount(cc.ravel());areas[0]=0
    regions=find_objects(cc)
    grid={}
    for i in areas.argsort()[-len(ids):]:
        y,x=regions[i-1]
        col=min(cols-1,int((x.start+x.stop)*cols/(2*rgba.shape[1])))
        row=min(rows-1,int((y.start+y.stop)*rows/(2*rgba.shape[0])))
        grid[row*cols+col]=i
    assert len(grid)==len(ids)
    i=grid[ids.index(element)];y,x=regions[i-1]
    y=slice(max(0,y.start-3),min(rgba.shape[0],y.stop+3));x=slice(max(0,x.start-3),min(rgba.shape[1],x.stop+3))
    part=rgba[y,x].copy()
    part[:,:,3]*=binary_dilation(cc[y,x]==i,iterations=3)
    return Image.fromarray(part)

def material_centers(tokens):
    # Upper back/wing, throat, tail and flank occupy separate visible areas.
    def xy(token):return np.array([int(token[:2]),int(token[2:])],dtype=float)/99
    skull,chest,hip=map(xy,tokens[2:5]);tail=list(map(xy,tokens[-1].split("=")[1].split(",")))
    wing=xy(tokens[7]) if tokens[7]!="-" else hip*.65+chest*.35+[-.015,-.08]
    return [wing*.66+chest*.34,skull*.52+chest*.48,tail[len(tail)//2],hip*.8+chest*.2+[0,.055]]

def graded_portrait(im,tokens):
    im=im.crop(im.getchannel("A").point(lambda v:255 if v>80 else 0).getbbox())
    rgba=np.array(im);rgb=rgba[:,:,:3].astype(float)
    mask=rgba[:,:,3]>85;h,w=mask.shape
    ids=[int(x) for x in tokens[0][1:]]
    # Every color occupies a connected anatomical region without flattening the
    # shadows, thin line work, or highlights from the original illustration.
    yy,xx=np.mgrid[0:h,0:w];xx=xx/w;yy=yy/h
    centers=material_centers(tokens)[:len(ids)]
    if len(ids)==2:
        centers[1]=centers[1]*.85+np.array([.72,.62])*.15
    weights=np.stack([np.exp(-((xx-x)**2/.062+(yy-y)**2/.16)*2.6) for x,y in centers])
    # Keep semantic pigments already present in the painting. For example, a green
    # tree on a rock dragon belongs to Flora regardless of where its trunk starts.
    source_chroma=rgb-rgb.mean(axis=2,keepdims=True)
    chroma=np.linalg.norm(source_chroma,axis=2)
    source_unit=source_chroma/np.maximum(chroma[:,:,None],1)
    affinity=[]
    for i,element in enumerate(ids):
        sample=RAMPS[element,1:4]
        hues=sample-sample.mean(axis=1,keepdims=True)
        hues/=np.maximum(np.linalg.norm(hues,axis=1,keepdims=True),1)
        match=np.maximum(0,np.max(source_unit@hues.T,axis=2))*np.clip(chroma/62,0,1)
        # A cool metallic surface can also carry a warm reflected highlight.
        if element==6:match=np.maximum(match,.6*np.clip(1-chroma/65,0,1))
        affinity.append(match)
        weights[i]*=np.exp(3.8*match)
    weights/=weights.sum(axis=0)
    lum=rgb@np.array([.23,.65,.12])
    # Equalize only part of the luminance range, keeping pale and dark dragons distinct.
    black,white=np.percentile(lum[mask],[2,98])
    value=np.clip(.77*lum+.23*(lum-black)*255/max(white-black,1),0,255)
    preserve=.38+.32*np.max(affinity,axis=0)
    out=rgb*preserve[:,:,None]
    for i,element in enumerate(ids):
        pigment=np.stack([np.interp(value,[0,57,118,186,255],RAMPS[element,:,c]) for c in range(3)],axis=-1)
        out+=(1-preserve[:,:,None])*weights[i,:,:,None]*pigment
    rgba[:,:,:3]=np.clip(out,0,255).astype("uint8")
    return Image.fromarray(rgba)

# Engraved material details are small, attached skin markings. They are clipped
# to the original outline, then deformed by the same skin as the painted scales.
def markings(im,tokens,size):
    ids=[int(x) for x in tokens[0][1:]]
    if len(ids)<2:return ""
    im=im.crop(im.getchannel("A").point(lambda v:255 if v>80 else 0).getbbox()).resize(tuple(size),Image.Resampling.LANCZOS)
    mask=np.asarray(im.getchannel("A"))>100;h,w=mask.shape
    inside=distance_transform_edt(mask)
    yy,xx=np.mgrid[0:h,0:w];pieces=[]
    for j,(e,center) in enumerate(zip(ids,material_centers(tokens))):
        dx=(xx/w-center[0]);dy=(yy/h-center[1])
        score=np.minimum(inside,w*.05)/w-4*(dx*dx+dy*dy)
        score[inside<min(.032*w,4)]=-np.inf
        cy,cx=np.unravel_index(score.argmax(),score.shape)
        scale=min(.011*w,.18*inside[cy,cx])
        assert scale>0
        angle=(-15,-28,12,-22)[j]+(sum(map(int,tokens[0][1:]))%11-5)
        pieces.append(f'<g data-material="{e}" transform="translate({cx} {cy}) rotate({angle}) scale({scale:.3f})" opacity=".77">{MOTIFS[e]}</g>')
    contours,_=cv2.findContours(mask.astype("uint8"),cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    outline=[]
    for c in contours:
        q=cv2.approxPolyDP(c,1.1,True)[:,0,:]
        if len(q)>2:outline.append("M"+" ".join(f"{x} {y}" for x,y in q)+"z")
    return '<defs><clipPath id="hide"><path clip-rule="evenodd" d="'+"".join(outline)+'"/></clipPath></defs><g clip-path="url(#hide)">'+"".join(pieces)+'</g>'

MOTIFS=[
    '<path fill="none" stroke="#aa4a29" stroke-width="1.35" d="m-7 2 3-1 1-2 3 1 3-3 4-1m-7 4 2 2 3-1"/>'
    '<path fill="none" stroke="#ffd184" stroke-width=".35" d="m-7 2 3-1 1-2 3 1 3-3 4-1m-7 4 2 2 3-1"/>',
    '<g fill="none" stroke="#c4f7ee" stroke-width=".42"><path d="M-7 1Q-5 4-2 0q2 3 5-1 2 2 4-2M-5 3q2 3 5-1 2 2 5-2"/></g>',
    '<path fill="#c9e6dd" fill-opacity=".57" d="M-8 3Q-4-3 6-3Q1 2-8 3Z"/><path fill="none" stroke="#658a91" stroke-width=".34" d="M-8 3 6-3m-10 5 1-3m2 2 1-3m1 2 3-1"/>',
    '<path fill="#ab7854" d="m-6 1 3-3 4 1-2 4zm5 1 3-4 4-1-1 4z"/><path fill="none" stroke="#edd1a4" stroke-width=".46" d="m-6 1 3-3 4 1m-2 4 3-5 4-1"/>',
    '<g fill="#89ad59" stroke="#3e6044" stroke-width=".28"><path d="M-7 2q2-5 6-4-1 4-6 4m5-1q3-4 6-3-1 4-6 3m3-1q2-4 6-4-1 3-6 4Z"/></g><path fill="none" stroke="#e0dea3" stroke-width=".28" d="m-7 2 6-4m-1 3 6-3m-3 2 6-4"/>',
    '<path fill="none" stroke="#ba851e" stroke-width="1" d="m-7 2 4-3 1 2 3-4 2 2 4-3m-6 1 1-3m0 5 3 1"/>'
    '<path fill="none" stroke="#fff29a" stroke-width=".42" d="m-7 2 4-3 1 2 3-4 2 2 4-3m-6 1 1-3m0 5 3 1"/>',
    '<g fill="#71858b" stroke="#405764" stroke-width=".32"><path d="m-7 1 4-3 4 1-3 4zm5 0 4-3 4 1-3 4z"/></g><path fill="none" stroke="#e5f0e9" stroke-width=".52" d="m-7 1 4-3 4 1m-3 2 4-3 4 1"/>',
    '<g fill="#b8ebf0"><circle cx="-5.8" cy="2" r=".4"/><circle cx="2" cy="-2.2" r=".46"/><circle cx="5.6" cy=".6" r=".32"/><path d="m-1 1 .3-1.2.3 1.2 1.2.3-1.2.3-.3 1.2-.3-1.2-1.2-.3Z"/></g><path fill="none" stroke="#cfacff" stroke-width=".36" d="M-6 1Q-2-2 4-3"/>',
    '<g fill="#392c41" stroke="#875465" stroke-width=".32"><path d="M-7 3q0-4 5-6-1 3-5 6m4-1q1-5 6-6-2 5-6 6m4-1q2-4 7-4-3 3-7 4Z"/></g>',
    '<g fill="none" stroke="#f4d889" stroke-width=".46"><path d="m-7 2 4-3 3-2m-5 6 5-3 4-3m-4 5 5-3"/></g><path fill="#fff5c9" d="m2-1 .4-1.6L3-1l1.4.4L3 0l-.6 1.4L2 0 .6-.6Z"/>',
]
