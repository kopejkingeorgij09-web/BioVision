"""Export individual portraits and mobile skeletal animation sheets from 3×3 masters."""
from pathlib import Path
import json, os
import numpy as np
from PIL import Image
from scipy.ndimage import label,find_objects
from concurrent.futures import ProcessPoolExecutor
from export import bake
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'phagi/island/art'
def divides(alpha):
    n=alpha.shape[0];activity=alpha.sum(axis=1);points=[0]
    for k in [1,2]:
        mid=round(k*n/3);radius=round(n*.061)
        xs=np.arange(mid-radius,mid+radius+1)
        score=activity[xs]+abs(xs-mid)*.09
        points.append(int(xs[np.argmin(score)]))
    return points+[n]
def extract(n,group):
    im=Image.open(ROOT/'sources'/f'collection-{n:02d}.png').convert('RGBA')
    mask=np.array(im.getchannel('A'))>46
    rows=divides(mask);jobs=[]
    for r in range(3):
        y0,y1=rows[r:r+2];cols=divides(mask[y0:y1].T)
        for c in range(3):
            item=group[3*r+c];key=item['id'];x0,x1=cols[c:c+2]
            part=im.crop((x0,y0,x1,y1));rgba=np.array(part);solid=rgba[:,:,3]>40
            islands,count=label(solid);sizes=np.bincount(islands.ravel());sizes[0]=0
            main=int(sizes.argmax());rects=find_objects(islands);ys,xs=rects[main-1]
            # Discard small fragments of adjacent specimens along the cell edges.
            for j,sl in enumerate(rects,1):
                if j==main or sl is None:continue
                yy,xx=sl;edge=yy.start==0 or xx.start==0 or yy.stop==part.height or xx.stop==part.width
                outside=yy.stop<ys.start+2 or yy.start>ys.stop-2 or xx.stop<xs.start+2 or xx.start>xs.stop-2
                if edge and (outside or sizes[j]<sizes[main]*.07):rgba[islands==j,3]=0
            rgba[:,:,3]=np.where(rgba[:,:,3]<19,0,rgba[:,:,3])
            part=Image.fromarray(rgba,'RGBA');bbox=part.getchannel('A').getbbox()
            if not bbox or sizes[main]<3500:raise ValueError(f'Empty specimen {key}')
            part=part.crop(bbox)
            if key in ('storm','ward'):
                part.thumbnail((288,288));part.save(OUT/(key+'.webp'),quality=87,method=5);continue
            jobs.append((key,item['rig'],part))
    return jobs
def one(job):
    key,rig,im=job;bake(key,rig,im,compact=True)
if __name__=='__main__':
    groups=json.loads((ROOT/'collection.json').read_text())
    jobs=[job for n,g in enumerate(groups,1) for job in extract(n,g)]
    with ProcessPoolExecutor(max_workers=min(os.cpu_count() or 1,5)) as pool:list(pool.map(one,jobs))
    print(f'{len(jobs)} species, portraits and five motion cycles; two defensive buildings')

