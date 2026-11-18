"""Author the two SVG compositions from the same island silhouette and landmarks.
No bitmap data, fonts or network resources are needed by the SVG.
"""
from pathlib import Path
from random import Random
import math
OUT = Path(__file__).resolve().parents[2] / 'phagi/island/art'
def render(width,height,desktop):
    rng=Random(4107)
    buf=[]
    def emit(s): buf.append(s)
    def pt(x,y): return f'{width*x:.1f},{height*y:.1f}'
    def poly(coords,color,attrs=''):
        emit('<polygon points="'+' '.join(pt(x,y) for x,y in coords)+f'" fill="{color}" {attrs}/>')
    def path(d,fill,attrs=''):emit(f'<path d="{d}" fill="{fill}" {attrs}/>')
    def use(sym,x,y,scale,attrib=''):
        emit(f'<g transform="translate({pt(x,y)}) scale({scale:.3f})" {attrib}><use href="#{sym}"/></g>')
    def way(points):return 'M'+' L'.join(pt(x,y) for x,y in points)
    emit(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" preserveAspectRatio="none" role="img"><title>Янтарный берег — парящий остров архипелага</title><defs>')
    for id,stops in {
      'sky':[(0,'#274b75'),(.23,'#70a9b3'),(.48,'#fedba4'),(.67,'#d9cdbb'),(1,'#688eaa')],
      'far':[(0,'#598b9c'),(1,'#bdd2c2')],'ridge':[(0,'#477c87'),(1,'#9dbdac')],
      'soil':[(0,'#9cab76'),(.27,'#c0bd72'),(.53,'#d7c682'),(.75,'#9db577'),(1,'#63977b')],
      'edge':[(0,'#f2d797'),(.38,'#d8a267'),(1,'#aa7360')],
      'rock':[(0,'#aa8270'),(.32,'#826d6a'),(.65,'#536575'),(1,'#324c66')],
      'fall':[(0,'#f2f5ce'),(.32,'#7cd2cc'),(.78,'#a7e5df'),(1,'#d5f1e3')],
      'mist':[(0,'#bed8d4'),(1,'#7699aa')],
      'bronze':[(0,'#fff0bb'),(.5,'#d4ac73'),(1,'#8e7654')],
      'beacon':[(0,'#fffbc4'),(.3,'#e6c67a'),(1,'#bd8454')]}.items():
        emit(f'<linearGradient id="{id}" x2="0" y2="1" gradientUnits="objectBoundingBox">'+''.join(f'<stop offset="{off}" stop-color="{col}"/>' for off,col in stops)+'</linearGradient>')
    emit('''<radialGradient id="sun"><stop stop-color="#fff6cd"/><stop offset=".22" stop-color="#fee6ac" stop-opacity=".85"/><stop offset=".62" stop-color="#ffda9f" stop-opacity=".30"/><stop offset="1" stop-color="#ffcd8a" stop-opacity="0"/></radialGradient>
    <linearGradient id="shaft" x2=".8" y2="1"><stop stop-color="#ffe4ab" stop-opacity=".31"/><stop offset="1" stop-color="#f5e9b9" stop-opacity="0"/></linearGradient>
    <pattern id="hatch" width="15" height="14" patternUnits="userSpaceOnUse"><path d="m1 8 4-1m5 5 2-.5" fill="none" stroke="#fff5cc" stroke-opacity=".2" stroke-width="1"/></pattern>
    <g id="pine"><path d="m-3 0 2-41h3L3 0" fill="#645e4c"/><path d="m0-61-10 21 5-1-11 18 7-2-13 20 22-5 18 4-10-14 6 1-10-17 5 1Z" fill="#32675f"/><path d="m0-61-10 21 5-1-11 18 7-2-13 20 12-5 3-4 4-1 3-10-5 2 6-13-4 1 4-14Z" fill="#6b9d79"/></g>
    <g id="spruce"><path d="m0 0 1-39 2 39" fill="#615b50"/><path d="m1-48-8 14 3 1-9 14 5-1-9 16 18-4 13 3-7-12 4 1-7-13 3 1Z" fill="#386d65"/><path d="m1-48-8 14 3 1-9 14 9-4 5-6-3 1 5-11Z" fill="#87aa7d"/></g>
    <g id="boulder"><path d="m-17-3 5-12 14-4 12 8 3 11-22 2Z" fill="#808d79"/><path d="m-17-3 5-12 14-4-3 10Z" fill="#c6c6a1"/><path d="m-1-9 15-2 3 11-19 1Z" fill="#75887a"/></g>
    <g id="amber"><path d="m0 0-8-17 3-18 8 7 7 20Z" fill="#be865b"/><path d="m-5-35 8 7 1 21-8-8Z" fill="#ffcf79"/><path d="m3-28 7 20-6 1Z" fill="#f3ad66"/></g>
    <g id="spire"><path d="m-32 0 6-9 7-2 4-40 7-7 2-41 6-14 5 15 3 40 7 5 4 41 10 4 5 8Z" fill="#667d76"/><path d="m-20-10 6-38 7-7 4-40 3-8-1 93Z" fill="#b4b79a"/><path d="m-8-54 9-12 11 13-9-5Z" fill="#d9bd80"/><path d="m-3-93 5-20 6 17-5-3Z" fill="#efd795"/></g>
    <g id="cloud"><path d="M-90 0q12-8 27-7 10-13 23-8 12-18 31-8 17-8 29 7 22-2 30 10 18 0 33 7-63 3-173-1Z" fill="#e1e6d9"/></g>
    <g id="ruin"><path d="m-20 0 2-7 3-1 2-34 8-3 9 3 2 33 5 2 2 7Z" fill="#77887b"/><path d="m-15-8 2-34 8-3 1 37Z" fill="#c7c4a6"/><path d="m-18-35 2-6 16 1 7-3-1 6-6 3Z" fill="#d7bf8f"/></g></defs>''')
    emit(f'<rect width="{width}" height="{height}" fill="url(#sky)"/>')
    sunx,suny=(.73,.105) if desktop else (.80,.10);radius=width*(.042 if desktop else .065)
    emit(f'<circle cx="{width*sunx}" cy="{height*suny}" r="{radius*4.2}" fill="url(#sun)"/><circle cx="{width*sunx}" cy="{height*suny}" r="{radius*.64}" fill="#ffedb5" opacity=".93"/><circle cx="{width*sunx}" cy="{height*suny}" r="{radius*.78}" fill="none" stroke="#fff0be" opacity=".52" stroke-width="1.6"/>')
    for i in range(39):
        x=rng.random();y=rng.uniform(.018,.185);r=rng.uniform(.5,1.6)*width/1000
        emit(f'<circle cx="{x*width:.1f}" cy="{y*height:.1f}" r="{r:.2f}" fill="#f8eac2" opacity=".72"/>')
    for x in [-.48,.1,.18,.47]:
        poly([(sunx+x*.17,-.06),(sunx+x*.17+.025,-.06),(x+.26,.67),(x,.66)],'url(#shaft)')
    for horizon,shade,step in [(.30,'url(#far)',.035),(.34,'url(#ridge)',.052)]:
        pts=[(-.04,horizon+.05)];x=-.04
        while x<1.08:
            pts.extend([(x,horizon+rng.uniform(-.06,.025)),(x+step*.5,horizon-rng.uniform(.025,.10))]);x+=step
        poly(pts+[(1.1,1.1),(-.1,1.1)],shade)
    # Distant suspended fragments with narrow taper, terraced cap and a beacon.
    for x,y,s in [(.065,.29,.75),(.19,.218,.46),(.61,.235,.44),(.89,.208,1),(.97,.48,.48),(.02,.56,.44)]:
        sc=(width/1000)*s;cx=x*width;cy=y*height
        emit(f'<g transform="translate({cx:.1f} {cy:.1f}) scale({sc:.3f})" opacity=".90">')
        path('M-54 0-37-5-15-8 10-10 46-4 56 0 36 8 22 23 4 26-4 52-11 32-28 23-42 17Z','#638887')
        path('m-54 0 39-8 25-2L56 0 23 4-14 7Z','#aab79a')
        path('m-12 7 24-2-16 47-5-22Z','#527781')
        if x>.85 and y<.3:use('spire',0,0,.61)
        emit('</g>')
    for i in range(32):
        x=rng.uniform(-.05,1.1);y=rng.choice([rng.uniform(.32,.58),rng.uniform(.7,1.03)])
        use('cloud',x,y,rng.uniform(.25,.95)*width/850,f'opacity="{rng.uniform(.26,.66):.2f}"')
    # Ancient ring above the distant ridge, with separated voussoirs.
    cx,cy=width*.85,height*.18
    for i in range(26):
        if i in [4,5,16,20]:continue
        a=i*math.tau/26;d=math.tau/26*.89
        ring=[((cx+math.cos(a+u)*width*r)/width,(cy+math.sin(a+u)*height*r*1.28)/height) for u,r in [(0,.070),(d,.070),(d,.058),(0,.058)]]
        poly(ring,['#7c918c','#b8b29b','#e5cb91'][i%3])
    emit('</svg>')
    (OUT/('archipelago-wide.svg' if desktop else 'archipelago.svg')).write_text(''.join(buf)+'\n')
if __name__=='__main__':
    render(800,940,False)
    render(1440,860,True)
