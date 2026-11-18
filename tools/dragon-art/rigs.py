"""Build animated vector skins from the approved portraits and anatomical landmarks.
Requires Pillow, numpy, scipy and opencv-python-headless. No runtime raster data.
"""
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import Delaunay
from paint_layers import painted_svg
from elements import graded_portrait, markings, pure_portrait

ROOT = Path(__file__).resolve().parent
ART = ROOT.parents[1] / "phagi/island/art"
OUT = ART / "dragons"
OUT.mkdir(exist_ok=True)
HERO = {"s1": "water", "s3": "earth", "s26": "metal"}

class Silhouette:
    """Fit long chains inside the painted silhouette, including thin curled tails."""
    def __init__(self, src, size):
        image=src.getchannel("A")
        image=image.crop(image.point(lambda v:255 if v>80 else 0).getbbox())
        w,h=size
        self.scale=max(w,h)/145
        image=image.resize((round(w/self.scale),round(h/self.scale)),Image.Resampling.LANCZOS)
        alpha=np.asarray(image)>90
        self.shape=alpha.shape
        self.nearest=distance_transform_edt(~alpha,return_distances=False,return_indices=True)
        thickness=distance_transform_edt(np.pad(alpha,1))[1:-1,1:-1]
        cost=np.where(alpha,1+2/(1+thickness),26)
        idx=np.arange(alpha.size).reshape(alpha.shape)
        starts=[];ends=[];weights=[]
        for dy,dx in [(0,1),(1,0),(1,1),(1,-1)]:
            a=(slice(0,alpha.shape[0]-dy),slice(max(0,-dx),alpha.shape[1]-max(0,dx)))
            b=(slice(dy,None),slice(max(0,dx),alpha.shape[1]-max(0,-dx)))
            starts.append(idx[a].ravel());ends.append(idx[b].ravel())
            weights.append(((cost[a]+cost[b])*.5*np.hypot(dx,dy)).ravel())
        a,b,v=map(np.concatenate,(starts,ends,weights))
        self.graph=csr_matrix((np.r_[v,v],(np.r_[a,b],np.r_[b,a])),shape=(alpha.size,alpha.size))

    def snap(self,p):
        y,x=np.clip(np.rint(np.flip(p)/self.scale).astype(int),(0,0),np.array(self.shape)-1)
        return self.nearest[:,y,x][::-1]*self.scale

    def chain(self,anchors):
        anchors=[self.snap(p) for p in anchors]
        nodes=[np.ravel_multi_index(tuple(np.rint(p[::-1]/self.scale).astype(int)),self.shape) for p in anchors]
        line=[nodes[0]]
        for a,b in zip(nodes,nodes[1:]):
            if a==b:continue
            _,prev=dijkstra(self.graph,indices=a,return_predecessors=True)
            segment=[b]
            while segment[-1]!=a:segment.append(prev[segment[-1]])
            line.extend(reversed(segment[:-1]))
        return np.array(np.unravel_index(line,self.shape))[::-1].T*self.scale

    def tail(self,anchors,width):
        path=self.chain(anchors).astype(np.float32)
        epsilon=.012*width
        while True:
            pts=list(cv2.approxPolyDP(path,epsilon,False)[:,0,:])
            if len(pts)<=10:break
            epsilon*=1.25
        while len(pts)<5:
            i=np.argmax([np.linalg.norm(a-b) for a,b in zip(pts,pts[1:])])
            pts.insert(i+1,(pts[i]+pts[i+1])/2)
        return pts

def make_skeleton(tokens, size, shape):
    kind = tokens[1]
    w, h = size
    def pt(s):
        if s == "-": return None
        return shape.snap(np.array([int(s[:2])*w/99, int(s[2:])*h/99]))
    skull, chest, hip, bend, tip, wrist, wingtip, hind, fore = map(pt, tokens[2:11])
    head_path=shape.chain([chest,skull])
    neck=head_path[round((len(head_path)-1)*.44)]
    bones = []
    def bone(name, parent, a, b):
        bones.append([name, parent, np.round(a,2).tolist(), np.round(b,2).tolist()])
        return len(bones)-1
    root = bone("pelvis", -1, hip, hip+(chest-hip)*.35)
    spine = bone("spine", root, hip+(chest-hip)*.35, chest)
    stem = bone("neck", spine, chest, neck)
    head = bone("head", stem, neck, skull)
    jaw = shape.snap(skull+np.array([.012*w,.025*h]))
    bone("jaw", head, jaw, shape.snap(np.array([min(w*.986,skull[0]+w*.075),jaw[1]+.015*h])))
    markers=tokens[-1].split("=",1)[1].split(",")
    tail=shape.tail([hip,*(pt(s) for s in markers)],w)
    parent = root
    for n in range(len(tail)-1):
        parent = bone("tail"+str(n), parent, tail[n], tail[n+1])
    if wrist is not None:
        wing_path=shape.chain([chest,wrist])
        elbow=wing_path[round((len(wing_path)-1)*.48)]
        arm = bone("wingArm",spine,chest,elbow)
        hand = bone("wingElbow",arm,elbow,wrist)
        bone("wingTip",hand,wrist,wingtip)
    if hind is None:
        # Paired fins paddle independently of the tail chain.
        p = chest+[-.008*w,.02*h]
        bone("fin",spine,p,p+[-.095*w,.20*h])
    else:
        legs=[("hind",hip,hind,root),("fore",chest,fore,spine)]
        if kind in ("quadruped","runner","winged"):
            far_hind,far_fore=[pt(s) for s in tokens[11:13]] if len(tokens)>=14 else (hind+[.14*w,-.048*h],fore+[-.135*w,-.055*h])
            legs.extend([("farHind",hip+[.045*w,-.014*h],far_hind,root),("farFore",chest+[-.044*w,-.014*h],far_fore,spine)])
        for name, start, foot, parent in legs:
            if kind=="bird" and name=="fore": start=hip+(chest-hip)*.40
            foot=shape.snap(foot)
            delta=foot-start
            sign=1 if "hind" in name.lower() else -1
            # With the dragon facing right the knee and elbow flex in opposite directions.
            joint=start+delta*.53 + np.array([sign*max(.037*w,abs(delta[1])*.20),0])
            joint=shape.snap(joint)
            ankle=shape.snap(foot+np.array([-.035*w,-.034*h]))
            if np.linalg.norm(ankle-foot)<w*.013:ankle=foot+.14*(joint-foot)
            a=bone(name+"Upper",parent,start,joint)
            b=bone(name+"Lower",a,joint,ankle)
            bone(name+"Foot",b,ankle,foot)
    return bones

def skin_mesh(bones, size):
    w,h=size
    vertices=[]
    def put(p, clearance):
        if all(np.linalg.norm(np.array(p)-q)>clearance for q in vertices):
            vertices.append(np.asarray(p))
    for x in (0,w):
        for y in (0,h):put([x,y],0)
    for _,_,a,b in bones:put(a,w*.024);put(b,w*.024)
    for y in np.linspace(0,h,6):
        for x in np.linspace(0,w,8):put([x,y],w*.057)
    pts=np.array(vertices)
    triangles=Delaunay(pts).simplices
    weights=[]
    for p in pts:
        influences=[]
        for i,(name,parent,a,b) in enumerate(bones):
            a,b=np.array(a),np.array(b)
            v=b-a
            t=np.clip(np.dot(p-a,v)/max(np.dot(v,v),.1),0,1)
            distance=np.linalg.norm(p-(a+v*t))
            # Smooth joint neighborhoods, with narrow influence for jaw and toes.
            radius=(.055 if name=="jaw" or name.endswith("Foot") else .13 if name in ("spine","pelvis","head") else .087)*w
            influence=(1+(distance/radius)**2)**-3 / max(1,distance+.012*w)
            influences.append(influence)
        ids=np.argsort(influences)[-4:];v=np.array(influences)[ids];v/=v.sum()
        weights.append([[int(i),round(float(a),5)] for i,a in zip(ids,v)])
    return pts,triangles,weights

def build(tokens):
    sid=tokens[0];pure=sid!="baby" and len(sid)==2
    if pure:src=pure_portrait(int(sid[1]))
    elif sid=="baby":src=Image.open(ROOT/"sources"/"elemental-hatchling.png").convert("RGBA")
    else:
        name=HERO.get(sid,sid)+"-portrait.webp"
        src=Image.open(ART/name).convert("RGBA")
        src=graded_portrait(src,tokens)
    thumbs=OUT/"thumbs";thumbs.mkdir(exist_ok=True)
    rig_only="--rig-only" in sys.argv
    elements="3" if sid=="baby" else sid[1:]
    def tag(svg):
        return svg.replace("<svg ",f'<svg data-elements="{elements}" ',1)
    if not rig_only:
        size,thumbnail=painted_svg(src,thumb=True)
        if not pure and sid!="baby":thumbnail=thumbnail.replace("</svg>",markings(src,tokens,size)+"</svg>")
        (thumbs/(sid+".svg")).write_text(tag(thumbnail))
    if "--thumbs" in sys.argv:return sid
    if rig_only:
        size=json.loads((OUT/"rigs"/(sid+".json")).read_text())["size"]
    else:
        size,svg=painted_svg(src,hero=pure or sid=="baby" or sid in HERO)
        if not pure and sid!="baby":svg=svg.replace("</svg>",markings(src,tokens,size)+"</svg>")
    bones=make_skeleton(tokens,size,Silhouette(src,size));pts,tris,weights=skin_mesh(bones,size)
    meta=dict(id=sid,kind=tokens[1],size=size,bones=bones,points=np.round(pts,2).tolist(),weights=weights,triangles=tris.tolist())
    rig_dir=OUT/"rigs";rig_dir.mkdir(exist_ok=True)
    rig_file=rig_dir/(sid+".json");tmp=rig_file.with_suffix(".part")
    tmp.write_text(json.dumps(meta,separators=(",",":")));tmp.replace(rig_file)
    if rig_only:return sid
    dest=OUT/(sid+".svg");temp=dest.with_suffix(".part");temp.write_text(tag(svg));temp.replace(dest)
    return sid

if __name__=="__main__":
    rows=[s.split() for s in (ROOT/"landmarks.txt").read_text().splitlines() if s and not s.startswith("#")]
    subset=[key for key in sys.argv[1:] if not key.startswith("--")]
    if subset:rows=[r for r in rows if r[0] in subset]
    with ProcessPoolExecutor(max_workers=min(6,os.cpu_count() or 1)) as pool:
        for sid in pool.map(build,rows):print(sid,flush=True)
