"""Export the four full-resolution painting masters for the playable scene."""
from pathlib import Path
from PIL import Image
from tempfile import TemporaryDirectory
import re
import xml.etree.ElementTree as ET
import vtracer
import numpy as np
import cv2
from scipy.ndimage import distance_transform_edt

source=Path(__file__).resolve().parent/"sources"
out=source.parents[2]/"phagi/island/art/settlement"
out.mkdir(exist_ok=True)
Image.open(source/"sunset.png").save(out/"sunset.webp",lossless=True,method=6)

def compact_curve(path):
    # The tracer emits absolute integer cubic curves. Relative deltas are smaller.
    pieces=[];last=None
    for cmd,args in re.findall(r"([MCZ])([^MCZ]*)",path):
        coords=[round(float(value)) for value in args.split()]
        if cmd=="M":
            x,y=coords;pieces.append(f"M{x} {y}");last=None
        elif cmd=="C":
            data=" ".join(str(value-(x if i%2==0 else y)) for i,value in enumerate(coords))
            pieces.append((" " if last=="c" else "c")+data)
            x,y=coords[-2:];last="c"
        else:pieces.append("z");last=None
    return "".join(pieces).replace(" -","-")

def export_terrain():
    with TemporaryDirectory() as tmp:
        png,svg=Path(tmp)/"master.png",Path(tmp)/"traced.svg"
        im=Image.open(source/"plateau.png").convert("RGBA");im.thumbnail((1152,1152),Image.Resampling.LANCZOS)
        rgba=np.asarray(im);mask=rgba[:,:,3]>130
        distance,nearest=distance_transform_edt(~mask,return_indices=True)
        # Trace opaque pigments up to the actual silhouette. Partially transparent
        # source pixels carry arbitrary RGB values and would leave colored fringes.
        rgb=rgba[nearest[0],nearest[1],:3].copy()
        rgb[distance>7]=(82,89,74)
        Image.fromarray(rgb).save(png)
        contours,_=cv2.findContours(mask.astype("uint8"),cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
        outline=[]
        for c in contours:
            xy=cv2.approxPolyDP(c,.7,True)[:,0,:]
            if len(xy)>2:outline.append("M"+" ".join(f"{x} {y}" for x,y in xy)+"z")
        border="".join(outline)
        vtracer.convert_image_to_svg_py(str(png),str(svg),colormode="color",hierarchical="stacked",
            mode="spline",filter_speckle=2,color_precision=7,layer_difference=9,corner_threshold=55,
            length_threshold=3.5,max_iterations=12,splice_threshold=36,path_precision=0)
        lines=[f'<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 {im.width} {im.height}"><defs><clipPath id="cliff"><path clip-rule="evenodd" d="{border}"/></clipPath></defs><g clip-path="url(#cliff)">']
        for el in ET.parse(svg).getroot():
            if not el.get("d"):continue
            d=compact_curve(el.get("d"))
            lines.append(f'<path fill="{el.get("fill")}" transform="{el.get("transform")}" d="{d}"/>')
        (out/"plateau.svg").write_text("\n".join(lines+["</g></svg>"]))
export_terrain()
for master,names in [("habitats",["home","nest","incubator","food","gold","farm"]),
                     ("forts",["tower","ice","storm","ward","garrison","mine"])]:
    atlas=Image.open(source/(master+".png")).convert("RGBA")
    w,h=atlas.width//3,atlas.height//2
    for i,name in enumerate(names):
        x,y=i%3*w,i//3*h; im=atlas.crop((x,y,x+w,y+h))
        mask=im.getchannel("A").point(lambda a:255 if a>40 else 0)
        im=im.crop(mask.getbbox())
        im.save(out/(name+".webp"),lossless=True,method=6)
