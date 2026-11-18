"""Bake normalized hierarchical bones into WebP sheets. Run with Pillow, numpy and scipy."""
from pathlib import Path
import math
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
ROOT = Path(__file__).resolve().parent
OUT = ROOT.parents[1] / 'phagi/island/art'
OUT.mkdir(exist_ok=True, parents=True)
def source(name):
    return Image.open(ROOT / 'sources' / (name + '.png'))
def save(image, name, width, quality=84):
    image.thumbnail((width, width*2), Image.Resampling.LANCZOS)
    image.save(OUT / (name+'.webp'), quality=quality, method=5)
def crop_atlas(name, bounds):
    im = source(name)
    for tag, box in bounds.items():
        part=im.crop(box)
        bbox=part.getchannel('A').point(lambda a: 255 if a>32 else 0).getbbox()
        save(part.crop(bbox), tag, 288)
def landmarks():
    save(source('coast'), 'coast', 780)
    crop_atlas('stores', {'nest':(0,0,680,620),'tower':(680,0,1254,621),'food':(0,622,682,1254),'gold':(682,622,1254,1254)})
    crop_atlas('village', {tag:(i%3*512,i//3*512,(i%3+1)*512,(i//3+1)*512) for i,tag in enumerate(['farm','mine','incubator','home','garrison','ice'])})
    crop_atlas('nursery', {'egg':(0,0,865,887),'baby':(875,0,1774,887)})
# name, parent, pivot x/y, influence centre x/y, influence radius x/y, phase, rotation (degrees).
RIG={
 'earth':[('spine',None,.48,.65,.55,.5,.49,.5,0,1),('shoulder','spine',.58,.62,.7,.4,.28,.32,0,4),
          ('head','shoulder',.71,.40,.89,.40,.21,.32,.3,3),('forepaw','shoulder',.60,.61,.60,.88,.12,.23,0,8),
          ('rear','spine',.25,.63,.24,.85,.13,.25,3.14,9),('far-paw','spine',.81,.66,.83,.88,.09,.2,3.14,7),
          ('tail','spine',.29,.60,.10,.73,.18,.16,1.6,7)],
 'water':[('chest',None,.77,.68,.84,.56,.26,.48,0,2),('neck','chest',.83,.64,.9,.28,.13,.3,.6,3),
          ('mid','chest',.74,.65,.57,.64,.24,.30,-.55,4),('tail','mid',.49,.69,.33,.70,.20,.28,-1.25,6),
          ('tip','tail',.25,.69,.11,.52,.15,.45,-2.1,9)],
 'metal':[('body',None,.70,.7,.72,.67,.32,.38,0,1),('wing','body',.69,.50,.52,.405,.30,.11,0,6),
          ('middle','wing',.63,.369,.40,.28,.32,.09,-.8,5),('outer','middle',.642,.25,.39,.125,.34,.12,-1.6,5),
          ('head','body',.82,.61,.87,.37,.12,.21,.4,2),('tail','body',.59,.71,.22,.85,.31,.12,-1.3,4)]}
POSES=['idle','walk','attack','hit','finish']
W,H,N=224,144,12
def matrix(pivot,theta,dx,dy):
    x,y=pivot
    c,s=math.cos(theta),math.sin(theta)
    return np.array([[c,-s,x-c*x+s*y+dx],[s,c,y-s*x-c*y+dy],[0,0,1]])
def bake(name, rig=None, original=None, compact=False):
    rig=rig or name
    if original is None:original=source(name).convert('RGBA')
    W,H,N=(152,98,8) if compact else (224,144,12)
    save(original.copy(),name+'-portrait',960,90)
    im=original.copy()
    im.thumbnail((W-24,H-22),Image.Resampling.LANCZOS)
    x0,y0=(W-im.width)//2,(H-im.height)//2
    plate=Image.new('RGBA',(W,H));plate.paste(im,(x0,y0))
    pix=np.array(plate.convert('RGBa'))
    y,x=np.mgrid[:H,:W];u=(x-x0)/im.width;v=(y-y0)/im.height
    bones=RIG[rig]
    weights=np.array([np.exp(-2*((u-cx)/rx)**2-2*((v-cy)/ry)**2) for _,_,_,_,cx,cy,rx,ry,_,_ in bones])
    if rig=='metal':
        wing=(u < .67) & (v < .49+.32*(u-.55))
        for i in (1,2,3): weights[i]*=wing*9
        # Rigid blade cores with narrow weighted joints.
        weights[1:4]=weights[1:4]**2
    weights/=np.maximum(weights.sum(axis=0),1e-30)
    xy=np.stack([x,y,np.ones_like(x)]).reshape(3,-1)
    combined=Image.new('RGBA',(W*N,H*len(POSES))) if compact else None
    for row,pose in enumerate(POSES):
        strip=Image.new('RGBA',(W*N,H))
        for frame in range(N):
            phase=frame/N*math.tau; mats={}; coords=np.zeros((2,H*W))
            for i,(bone,parent,px,py,_,__,___,____,delay,angle) in enumerate(bones):
                moving=math.sin(phase+delay);amp={'idle':.37,'walk':1,'attack':.95,'hit':.6,'finish':.42}[pose]
                dx=dy=0
                if parent is None:
                    if pose=='walk':dy=abs(math.sin(phase))*1.8;dx=math.sin(phase)*2
                    if pose=='attack':dx=8*math.sin(phase-.8);dy=-2*math.sin(phase)
                    if pose=='hit':dx=-5*max(0,math.sin(phase));dy=2*math.sin(phase)
                    if pose=='finish':dy=-2*abs(math.sin(phase))
                if rig=='earth' and bone=='shoulder':dy=2.7*moving*amp
                if rig=='metal' and bone in ('wing','middle','outer'):moving=(1+moving)*.65
                m=matrix((x0+px*im.width,y0+py*im.height),math.radians(angle*amp*moving),dx,dy)
                mats[bone]=mats[parent]@m if parent else m
                coords+=(np.linalg.inv(mats[bone])@xy)[:2]*weights[i].reshape(1,-1)
            mx,my=coords.reshape(2,H,W)
            out=np.stack([map_coordinates(pix[:,:,c],[my,mx],order=1,mode='constant') for c in range(4)],axis=2)
            strip.paste(Image.fromarray(out,'RGBa').convert('RGBA'),(frame*W,0))
        if compact:combined.paste(strip,(0,row*H))
        else:strip.save(OUT/(name+'-'+pose+'.webp'),quality=82,method=4)
    if compact:combined.save(OUT/(name+'-motion.webp'),quality=77,method=3)
if __name__=='__main__':
    landmarks()
    for name in RIG:bake(name)
