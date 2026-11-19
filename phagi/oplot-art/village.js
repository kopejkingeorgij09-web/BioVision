// Original vector models for the settlement. Ground axes run toward the two
// front corners of the map tile; z is the height above the stone foundation.
(() => {
  'use strict';
  const ink = '#433d38', gold = '#e8af51', glint = '#ffe39a';
  const stone = ['#f0cf9a','#c59d72','#876e62'];
  const chalk = ['#fff0c6','#eed4a1','#baa080'];
  const slate = ['#b4b8ad','#989f91','#637777'];
  const oak = ['#c99054','#af713d','#78513a'];
  const plaster = ['#fff1bc','#f1cf89','#d09f62'];
  const azure = ['#5a9fa4','#367681','#2b586c','#8bc6bb'];
  const coral = ['#df825b','#b7503e','#823f39','#ffa26d'];
  const violet = ['#9c91c8','#65588f','#49416e','#c2b1df'];
  const straw = ['#ebbf66','#cea04d','#986932','#f8d37d'];
  const point = (u,v,z=0) => [80+u-v, 100+(.75*1.5/1.16)*(u+v)-z];
  const round = n => Math.round(n*10)/10;
  const xy = p => p.map(round).join(',');
  const pts = a => a.map(xy).join(' ');
  function poly(a,fill,stroke=ink,w=1.3) {
    return '<polygon points="'+pts(a)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'" stroke-linejoin="round"/>';
  }
  function line(a,color=ink,w=1.2) {
    return '<polyline points="'+pts(a)+'" fill="none" stroke="'+color+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function path(d,fill,stroke=ink,w=1.2) {
    return '<path d="'+d+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'" stroke-linejoin="round" stroke-linecap="round"/>';
  }
  function ellipse(x,y,rx,ry,fill,stroke='none',w=1) {
    return '<ellipse cx="'+round(x)+'" cy="'+round(y)+'" rx="'+round(rx)+'" ry="'+round(ry)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'"/>';
  }
  const cuboid = (u,v,a,b,lo,hi,paint) => {
    const corners = z => [point(u,v,z),point(u+a,v,z),point(u+a,v+b,z),point(u,v+b,z)];
    const base=corners(lo),cap=corners(hi);
    return poly([cap[3],cap[2],base[2],base[3]],paint[1])+
      poly([cap[2],cap[1],base[1],base[2]],paint[2])+
      poly(cap,paint[0])+line([cap[3],cap[2]],paint[0],1.4);
  };
  const face = (side,edge,t,z) => side==='front'?point(t,edge,z):point(edge,t,z);
  function opening(side,edge,t,bottom,width,height,glass='#43828c',door=false) {
    const q=(d,h)=>face(side,edge,t+d,bottom+h),r=width/2;
    const arch=(w,drop)=>'M'+xy(q(-w,0))+' L'+xy(q(-w,height*.58-drop))+
      ' Q'+xy(q(-w,height*.83-drop))+' '+xy(q(0,height-drop))+
      ' Q'+xy(q(w,height*.83-drop))+' '+xy(q(w,height*.58-drop))+' L'+xy(q(w,0))+' Z';
    let out=path(arch(r+.95,0),'#f9d78e',ink,1.05)+path(arch(r,1.4),glass,'#483f39',.9);
    if(door) {
      out+=line([q(-r+.8,1.4),q(-r+.8,height*.63)],'#bb8650',1)+line([q(0,.2),q(0,height*.73)],'#593f35',.8);
      out+=line([q(-r+1,height*.32),q(r-1,height*.32)],'#dfa855',.85);
    }else{
      out+=line([q(0,.4),q(0,height-2)],'#f1c47a',1.05)+line([q(-r+.4,height*.43),q(r-.4,height*.43)],'#e3bd78',.9);
      out+=line([q(-r+1.3,height*.48),q(-r+1.3,height*.64)],'#bce6d6',1.2);
    }
    return out+line([q(-r-1,0),q(r+1,0)],'#6c5946',1.55);
  }
  function masonry(side,edge,t,span,z,h) {
    const q=(x,y)=>face(side,edge,t+x,z+y);
    let out='';
    for(let y=4,row=0;y<h-1;y+=5,row++){
      for(let x=row%2?3:0;x<span-2;x+=10){
        const len=Math.min(6,span-x);
        out+=line([q(x,y),q(x+len,y),q(x+len,y+2)],'#ab896b',.75);
      }
    }
    return out;
  }
  function dwelling(level){
    let out=foundation(-16,-14,34,30);
    // The chimney and the back roof sit behind the inhabited front gable.
    out+=cuboid(-10,-13,5.5,5,2.6,31+Math.min(level,4),stone);
    out+=cuboid(-10.7,-13.6,6.8,6.2,30+Math.min(level,4),33+Math.min(level,4),oak);
    out+=house(0,-13,16,15,2.6,16,12,plaster,coral,true);
    out+=house(-15,-4,25,17,2.6,16,14,plaster,coral,true);
    // A ginger round window under the projecting roof and a long gallery.
    const [x,y]=point(10,4.5,23);
    out+=ellipse(x,y,2.8,3.6,'#f5cc82','#865a43',1.1)+ellipse(x,y,1.6,2.4,'#4a7278');
    out+=line([[x,y-2],[x,y+2]],'#e4b97b',.8);
    out+=balcony(-13,13,11.5,6.5);
    out+=stairs(0,13,6,2.8,3)+lantern(5,13,10);
    if(level>=3)out+=house(9,3,8,8.5,2.6,7,5,oak,azure);
    if(level>=6)out+=turret(-13,1,15.5,3.5,5,5.5,coral);
    return out;
  }
  function barrel(u,v,z=0,r=3,h=6.5){
    const [x,y]=point(u,v,z);
    return path('M'+xy([x-r,y-h])+' q-1,3 0,'+h+' q'+r+','+round(r*.8)+' '+round(r*2)+',0 q1,-3 0,-'+h+' Z','#ab7746','#604f3c',.9)+
      ellipse(x,y-h,r,1.65,'#dab17a','#6d553e',.8)+
      path('M'+xy([x-r-.1,y-1.7])+' q'+r+',2 '+round(r*2)+',0','none','#596960',1.35);
  }
  function berryPlant(u,v,seed) {
    const [x,y]=point(u,v,2.3);
    return ellipse(x,y+.2,4.3,1.9,'#4b6339')+
      path('M'+xy([x-3.7,y])+' q-2,-3.7 .2,-3.9 q-.8,-2.7 1.8,-2.5 q1.8,-3.1 3.7,.1 q3.2,-.2 2.5,2.5 q2.8,2.5 -.8,3.5 Z','#6e9c43','#3a6539',.75)+
      line([[x-2,y-3.2],[x-.4,y-4.6],[x+1,y-4]],'#b2c865',.95)+
      ellipse(x-1.5,y-1.7,1.25,1.25,'#ba4260','#853c4d',.45)+
      ellipse(x+.7,y-2.1,1.2,1.2,'#ed7882','#a54356',.45)+
      (seed%2?ellipse(x+2.5,y-.4,.95,1,'#b73e5a'):'');
  }
  function farm(level){
    const soil=['#ad8050','#806345','#695740'];
    let out=foundation(-19,-16,38,33);
    out+=house(-18,-15,18,13,2.6,10,8,plaster,straw,true);
    const [wx,wy]=point(9,-12,2.6);
    out+=cuboid(5,-14,7.5,6,2.6,6,stone)+line([[wx,wy-5],[wx,wy-15],[wx+6,wy-18]],'#79573d',2);
    out+=line([[wx+5,wy-17],[wx+5,wy-7]],'#8b7652',.85)+ellipse(wx+4,wy-7,1.4,1.4,'#89948b','#637165',.65);
    out+=cuboid(-17,1,33,13.8,2.6,3.2,soil);
    for(let row=0;row<3;row++){
      const v=2.5+row*4.75;
      out+=line([point(-16,v,3),point(15,v,3)],'#76593a',1.7);
      for(let k=0;k<5;k++)out+=berryPlant(-13+k*6.5,v,row+k);
    }
    out+=barrel(15,-7,2.6)+barrel(15,-2,2.6,2.5,4.8);
    if(level>=3)out+=cuboid(-13,-6,7,2.2,11,11.8,oak);
    if(level>=5)out+=barrel(-16,16,2.5,3,5);
    return out;
  }
  function rock(x,y,w,h,color,lit,shade){
    const a=[x-w*.48,y-h*.47],b=[x-w*.11,y-h],c=[x+w*.28,y-h*.81],d=[x+w*.53,y-h*.2],e=[x+w*.28,y],f=[x-w*.27,y+.8],m=[x+w*.03,y-h*.39];
    return poly([a,b,c,d,e,f],color,ink,1.1)+poly([a,b,c,m],lit,'none')+
      poly([m,c,d,e],shade,'none')+line([a,b,c],lit,1.4)+line([a,m,d],'#706b64',.85);
  }
  function crystal(x,y,size,palette) {
    return poly([[x,y-size],[x+size*.36,y-size*.46],[x+size*.2,y],[x-size*.29,y-size*.08],[x-size*.41,y-size*.51]],palette[0],'#675c5a',.8)+
      poly([[x,y-size],[x+size*.36,y-size*.46],[x+size*.2,y],[x-size*.02,y-size*.38]],palette[1],'none')+
      line([[x-size*.28,y-size*.53],[x,y-size*.87]],palette[2],.9);
  }
  function mine(level){
    const p=point;
    let out=foundation(-18,-13,34,28);
    out+=rock(79,100,61,32,'#9b9482','#bcb49e','#736e69');
    out+=rock(101,102,26,21,'#8c8c80','#b0ada0','#6f7472');
    out+=rock(64,108,30,20,'#a29c88','#c8b99b','#77796e');
    out+=line([[66,85],[70,81],[70,77],[78,72],[80,74],[86,70]],'#857448',3.5);
    out+=line([[66,85],[70.8,81],[70,78],[78,73],[80,75],[85.6,71]],'#ecc665',1.8);
    // A dark adit, its braced wooden portal, and a short track that crosses the apron.
    const edge=6,q=(u,z)=>p(u,edge,z);
    out+=poly([q(-7,2.7),q(-7,17),q(-4,21),q(5,21),q(9,17),q(9,2.7)],'#353c37');
    for(const t of [-8,8])out+=cuboid(t,5,2.6,4,2.5,20,oak);
    out+=cuboid(-9,5,20,4.2,19,22,oak);
    out+=line([p(-8,9,14),p(-4.8,9,19)],'#d3a25e',2)+line([p(9.3,9,13.5),p(5.8,9,19)],'#d3a25e',2);
    for(let v=9;v<22;v+=3.1)out+=line([p(-3.4,v,2.9),p(6,v,2.9)],'#765b42',2.1);
    for(const u of [-1.7,4.2])out+=line([p(u,7,3.2),p(u,22,3.2)],'#9fa6a0',1.1);
    const [cx,cy]=p(2,15.3,3);
    out+=ellipse(cx-3.2,cy+.4,2,2.1,'#505b56',ink,.85)+ellipse(cx+3.3,cy+2,2,2.1,'#505b56',ink,.85);
    out+=poly([[cx-5.8,cy-4.4],[cx+.5,cy-1.8],[cx+5.4,cy-4.4],[cx+3.7,cy+.3],[cx+.4,cy+2.1],[cx-4.3,cy]],'#a48861');
    out+=poly([[cx-5.8,cy-4.4],[cx,cy-7],[cx+5.4,cy-4.4],[cx+.5,cy-1.8]],'#6d7366');
    out+=crystal(cx-.8,cy-3.1,4.4,['#e8ad4d','#c58936','#ffe78b'])+crystal(cx+2.1,cy-3.6,3,['#daa547','#b67c35','#ffe78b']);
    out+=lantern(-7,9.4,14)+barrel(12,7,2.5,2.8,6.5);
    if(level>=4)out+=crystal(95,88,6.4,['#edc259','#b88438','#ffe996']);
    return out;
  }
  function gable(u,v,a,b,z,rise,tiles=coral) {
    const p=(x,y,h)=>point(u+x,v+y,z+h),u0=-1.25,u1=a+1.25,v0=-1.5,v1=b+1.5,r=b*.5;
    const ridge0=p(u0,r,rise),ridge1=p(u1,r,rise);
    let out=poly([p(u0,v0,0),p(u1,v0,0),ridge1,ridge0],tiles[0])+
      poly([p(u1,v0,0),ridge1,p(u1,v1,0)],tiles[2])+
      poly([ridge0,ridge1,p(u1,v1,0),p(u0,v1,0)],tiles[1]);
    for(let row=1;row<=3;row++){
      const f=row/4,vv=r+(v1-r)*f,h=rise*(1-f);
      out+=line([p(u0+.4,vv,h),p(u1-.4,vv,h)],tiles[2],1);
      for(let x=u0+2+(row%2)*2.6;x<u1-1;x+=6)
        out+=line([p(x,vv,h),p(x,vv-(v1-r)*.17,h+rise*.17)],tiles[2],.65);
    }
    return out+line([ridge0,ridge1],tiles[3],2.5)+line([p(u0,v1,0),p(u1,v1,0)],'#6b4f40',2)+
      line([p(u1,v0,0),ridge1,p(u1,v1,0)],tiles[3],1.3);
  }
  function house(u,v,a,b,base,height,rise,wall,roof,timber=false) {
    let out=cuboid(u,v,a,b,base,base+height,wall);
    if(timber) {
      for(const t of [u+1,u+a*.48,u+a-1])out+=line([point(t,v+b,base),point(t,v+b,base+height)],'#7a5140',2.15);
      for(const t of [v+1,v+b-1])out+=line([point(u+a,t,base),point(u+a,t,base+height)],'#654b39',1.8);
      out+=line([point(u+1,v+b,base+height*.42),point(u+a*.48,v+b,base+height-1),point(u+a-1,v+b,base+height*.42)],'#916344',1.4);
    }else out+=masonry('front',v+b,u,a,base,height)+masonry('right',u+a,v,b,base,height);
    out+=opening('front',v+b,u+a*.72,base+1,Math.min(5.2,a*.23),Math.min(10,height*.8),'#744933',true);
    out+=opening('right',u+a,v+b*.5,base+height*.3,Math.min(4.8,b*.35),Math.min(9,height*.55));
    if(a>17)out+=opening('front',v+b,u+a*.23,base+height*.27,4.4,Math.min(8,height*.55));
    return out+gable(u,v,a,b,base+height,rise,roof);
  }
  function banner(x,y,h,cloth='#b83e48'){
    return line([[x,y],[x,y-h]],'#694f37',1.8)+ellipse(x,y-h,.95,.95,glint)+
      path('M'+xy([x+.8,y-h+1])+' q4,-2 8,1 l-2.5,2.1 2.4,2.4 q-4,-2 -7.9,-.8 Z',cloth,'#784947',.65);
  }
  function turret(u,v,z,r,h,cap,palette=azure,royal=false){
    const [x,y]=point(u,v,z),cy=y-h,ry=r*.47;
    const ring=(k,yy)=>[x+r*Math.cos(k*Math.PI/4), yy+ry*Math.sin(k*Math.PI/4)];
    let out=poly(Array.from({length:8},(_,i)=>ring(i,cy)),'#c7af86');
    const faces=['#9c897a','#c8b296','#ecd3a5','#ebce98'];
    for(let i=0;i<4;i++)out+=poly([ring(i,cy),ring(i+1,cy),ring(i+1,y),ring(i,y)],faces[i],ink,.9);
    for(const lift of [2,h*.7])out+=line(Array.from({length:5},(_,i)=>ring(i,y-lift)),'#ad865f',1.5);
    out+=path('M'+xy([x-2,cy+h*.49])+' v-4 q1.5,-4 3,0 v4 Z','#385c65',ink,1);
    if(royal)out+=path('M'+xy([x+r*.48,cy+h*.5])+' v-3 q1,-3 2,0 v3 Z','#416a73',ink,.8);
    const apex=[x,cy-cap],eave=(i)=>[x+(r+1.7)*Math.cos(i*Math.PI/4),cy+(ry+.8)*Math.sin(i*Math.PI/4)];
    for(let i=0;i<4;i++)out+=poly([apex,eave(i),eave(i+1)],[palette[2],palette[1],palette[0],palette[0]][i],ink,.9);
    return out+line([apex,eave(3)],palette[3],1.1)+ellipse(x,cy-cap-1,1.45,1.45,gold,ink,.55);
  }
  function stairs(u,v,a,z,n){
    let out='';
    for(let i=n;i>0;i--)out+=cuboid(u,v+(n-i)*1.7,a,2.2,0,z*i/n,stone);
    return out;
  }
  function buttress(u,v,z,h){
    return cuboid(u-1.6,v-1,3.2,4,0,3.2,slate)+
      poly([point(u-1.5,v+2,3),point(u-1.5,v,z+h),point(u+1.5,v,z+h),point(u+1.5,v+2,3)],chalk[1])+
      poly([point(u+1.5,v+2,3),point(u+1.5,v,z+h),point(u+1.5,v+3.8,3)],stone[2]);
  }
  function balcony(u,v,a,z){
    let out=cuboid(u,v,a,3.5,z-1.7,z,oak);
    for(let x=0;x<=a;x+=a/4)out+=line([point(u+x,v+3.5,z),point(u+x,v+3.5,z+3.8)],'#624d3c',1.25);
    return out+line([point(u,v+3.5,z+3.8),point(u+a,v+3.5,z+3.8),point(u+a,v,z+3.8)],'#e4b26f',1.7);
  }
  function foundation(u,v,a,b){return cuboid(u,v,a,b,0,2.6,slate)}
  function lantern(u,v,z){
    const [x,y]=point(u,v,z);
    return line([[x-1,y-5],[x+2,y-6],[x+2,y-2]],'#5e5244',1.1)+poly([[x+2,y-2],[x+4.1,y],[x+3.3,y+3],[x+.7,y+3],[x,y]],'#ffcf70','#715739',.8);
  }
  function watchtower(u,v,z,level){
    const a=10,b=9,h=level>=7?49:43;
    let out=cuboid(u,v,a,b,z,h,chalk)+masonry('front',v+b,u,a,z,h-z)+
      opening('front',v+b,u+a*.51,h-10,3.1,7,'#4d7982')+opening('right',u+a,v+4,h-10,2.8,6,'#586883');
    out+=cuboid(u-1.2,v-1.2,a+2.4,b+2.4,h,h+3.2,stone);
    for(const [x,y] of [[u-1,v-1],[u+a-1,v-1],[u-1,v+b-1],[u+a-1,v+b-1]]){
      out+=cuboid(x,y,2.7,2.7,h+3.1,h+6,stone);
    }
    return out+banner(...point(u+4,v+3,h+4),11,level>=7?'#3b7985':'#c66544');
  }
  function royalGallery(){
    const u=6,v=10,b=6,a=13,z=3,top=16;
    let out=cuboid(u,v,a,b,z,top,chalk);
    for(const t of [u+2.4,u+6.7,u+11])out+=opening('front',v+b,t,z+2,3.1,7,'#716aa6');
    out+=opening('right',u+a,v+3,z+2,3.5,7,'#568e95');
    out+=cuboid(u-.9,v-.7,a+1.8,b+1.4,top-2,top+1,stone);
    for(let x=0;x<4;x++)out+=cuboid(u-.6+x*3.8,v+b-1,2.0,2.2,top+1,top+3.7,stone);
    return out;
  }
  function roofBell(u,v,z){
    let out=cuboid(u,v,3.2,3.4,z-1,z+.6,oak);
    for(const [du,dv] of [[0,0],[3,0],[0,3],[3,3]])out+=line([point(u+du,v+dv,z),point(u+du,v+dv,z+4.4)],'#6d4f3b',1.15);
    const [x,y]=point(u+1.8,v+1.8,z+1.8);
    out+=path('M'+xy([x-1.1,y])+' q-.3,-2.5 1.05,-2.8 q1.3,.2 1.05,2.8 l.6,.65 h-3.3 Z',gold,'#765837',.5);
    return out+gable(u-.2,v-.2,3.8,3.8,z+4.4,2.7,azure);
  }
  function keep(level){
    const p=point;
    const west=level>=4?-16:-12,main=level>=5?23:level>=3?21:18;
    const lower=level>=7?21:level>=5?18:level>=3?16:13;
    const herald=level>=8?azure:level>=5?coral:level>=3?azure:coral;
    let out=level===1?foundation(west-1.5,-3,main+4.5,20):foundation(west-1,-15,main+9,31);
    if(level>=4)out+=watchtower(-18,8,2,level);
    if(level>=3)out+=turret(6,-13,2,level>=6?7.2:5.9,level>=6?30:24,level>=6?15:10,herald);
    if(level>=2)out+=house(0,-14,16,12,2.6,level>=5?19:13,8,level>=3?stone:plaster,level>=5?azure:coral,level<3);
    if(level>=5){
      out+=cuboid(-12,-11,22,18,2.6,21,chalk);
      out+=masonry('front',7,-12,22,3,16)+masonry('right',10,-11,18,3,16);
      if(level>=7){
        out+=house(-12,-11,20,16,21,level===8?19:15,11,chalk,herald);
        const [x,y]=p(-6,-5,level===8?50:45);out+=banner(x,y,5,'#bd4852');
      }else out+=house(-11,-10,19,15,21,13,10,plaster,coral,true);
      if(level>=6){
        const [x,y]=p(-5,-6,44);
        out+=turret(-5,-6,41,level===8?7.3:4.9,level===8?10:6,level===8?15:9,level===8?azure:violet);
        if(level===8)out+=banner(x,y-23,4.6,'#cd4e55');
      }
    }
    out+=house(west,-1,main,15,2.6,lower,level>=6?12:9,level>=3?chalk:plaster,herald,level<3);
    if(level<=3)out+=roofBell(west+main*.52,5.2,lower+9.6);
    if(level>=2&&level<5)out+=cuboid(west+2,0,3.5,3.3,lower+6,lower+14,stone)+cuboid(west+1.5,-.5,4.5,4.3,lower+13,lower+15,oak);
    if(level>=3)out+=buttress(west+2,14,0,lower*.75);
    if(level>=5)out+=balcony(west+3,14,8,lower*.63);
    if(level>=7)out+=opening('front',14,west+main*.47,lower*.37,4.8,9,'#696cb0');
    if(level>=2){
      const size=level>=6?12:9;
      out+=house(6,3,size,11,2.6,level>=6?14:10,7,level>=3?stone:plaster,level>=5?azure:coral,level<3);
    }
    const gateU=west+main*.72;
    out+=stairs(gateU-3.3,14.2,6.6,2.8,3)+lantern(gateU+3.6,14.3,9);
    if(level>=6)out+=turret(17,12,2.5,5.3,15,8,herald);
    if(level>=7)out+=royalGallery();
    if(level>=7)out+=turret(-10,16.5,2,4.9,14,8,herald);
    if(level===8){
      out+=buttress(1,15.2,0,13)+buttress(5,15.2,0,13);
      out+=turret(19,15.8,2.2,3.9,17,8,azure);
      const [x,y]=p(1,5.5,24);out+=banner(x,y,7.5,'#b4474e');
    }
    return out;
  }
  function den(level){
    const goldStone=['#e4c68b','#bf9766','#866c5d'];
    let out=cuboid(-16,-14,34,27,0,2.5,slate);
    out+=rock(67,101,37,29,'#978b87','#bca59c','#716c77');
    out+=rock(91,101,40,26,'#968e98','#bba9ae','#686878');
    // The two horned gateposts curl up and in like a pair of carved dragon wings.
    out+=path('M51,103 Q48,84 58,72 Q61,65 72,62 Q69,71 62,78 Q61,87 67,94 L64,103 Z','#ac8f71','#5a514b',1.5);
    out+=path('M53,99 Q54,80 65,70 Q62,78 57,85 L59,98 Z','#e2c496','#836a54',.9);
    out+=path('M96,98 Q97,85 91,77 Q91,70 88,65 Q101,68 106,83 L108,100 Z','#957d74','#554e52',1.4);
    out+=path('M98,92 Q100,81 94,73 Q103,80 104,94 Z','#c4a492','#8b7769',.8);
    out+=path('M62,101 Q64,84 75,81 Q84,78 95,88 L101,101 L89,112 Z','#49445c',ink,1.2);
    out+=path('M65,101 Q68,89 77,87 Q87,83 95,95 Q85,91 78,96 L71,107 Z','#6e6179','none');
    out+=ellipse(79,107,20.5,10.5,'#856349','#665047',1.8);
    out+=ellipse(79,105.7,17.7,7.9,'#cd9f64','#705745',1.5);
    out+=ellipse(79,105.2,13,5.2,'#826954','#927452',.8);
    out+=path('M72,102 Q72,96 78,89 Q82,87 86,95 Q91,106 83,108 Q73,111 72,102 Z','#9dc6af','#546f68',1.2);
    out+=path('M78,91 Q73,100 77,103 Q80,104 83,101 Q81,106 76,106 Q71,102 75,95 Z','#d9e4b9','none');
    out+=path('M82,94 l1.7,2.2 -1.4,1.5 -1.9,-2 Z M86,100 l1,1.4 -1.4,1.6 -1.1,-1.5 Z','#5d9c95','#668c83',.55);
    out+=path('M58,104 Q68,111 76,109 Q86,116 98,104 M61,109 Q75,116 85,111 Q91,112 96,108','none','#d8af77',2.1);
    out+=path('M62,108 L67,110 L74,107 M74,112 L81,110 L87,112 M86,111 L91,106','none','#9a7655',1.2);
    out+=poly([[55,106],[60,102],[65,105],[63,111],[58,112]],goldStone[1]);
    out+=crystal(54,103,6,['#8dc4b8','#508e93','#d6e8c9'])+crystal(103,101,5,['#b39bc5','#837494','#e3cbea']);
    if(level>=4)out+=crystal(98,107,7,['#89bfb4','#598a90','#e1ead0']);
    if(level>=7)out+=path('M67,79 Q73,76 76,78 L78,83 Q75,81 71,83 Z','#bda078','#786359',.9);
    return out;
  }
  function cupola(x,y,r,h){
    const ry=r*.48;
    let out=path('M'+xy([x-r,y])+' C'+xy([x-r*.97,y-h*.65])+' '+xy([x-r*.32,y-h*.93])+' '+xy([x,y-h])+
      ' C'+xy([x+r*.43,y-h*.84])+' '+xy([x+r*.94,y-h*.5])+' '+xy([x+r,y])+
      ' Q'+xy([x,y+ry*1.9])+' '+xy([x-r,y])+' Z','#7875a6',ink,1.5);
    out+=path('M'+xy([x-r+.5,y-1])+' Q'+xy([x-r*.85,y-h*.82])+' '+xy([x,y-h])+
      ' Q'+xy([x-r*.48,y-h*.3])+' '+xy([x-r*.4,y+ry*.65])+' Z','#aa9cc1','none');
    out+=path('M'+xy([x,y-h])+' Q'+xy([x+r*.94,y-h*.56])+' '+xy([x+r,y])+' L'+xy([x+r*.5,y+ry*.65])+
      ' Q'+xy([x+r*.47,y-h*.48])+' '+xy([x,y-h])+' Z','#575985','none');
    for(const k of [-.65,-.15,.51,.88])out+=path('M'+xy([x,y-h])+' Q'+xy([x+k*r*1.2,y-h*.52])+' '+xy([x+k*r,y+ry*(1-k*k)]),'none','#d1b171',1.2);
    out+=path('M'+xy([x-r,y])+' Q'+xy([x,y+ry*1.85])+' '+xy([x+r,y]),'none','#e4bd70',2.4);
    out+=line([[x,y-h-3.8],[x,y-h+.6]],'#7c673f',1.5)+ellipse(x,y-h-4.2,1.9,1.9,glint,'#856943',.8);
    return out;
  }
  function academy(level){
    let out=foundation(-18,-15,36,31);
    out+=turret(9,-11,2.6,5.6,23,10,azure);
    out+=cuboid(-13,-10,22,19,2.6,22,slate);
    out+=masonry('front',9,-13,22,3,15)+masonry('right',9,-10,19,3,15);
    out+=cuboid(-13.7,-10.7,23.4,20.4,20.8,23.5,stone);
    out+=opening('front',9,-6,6,6,13,'#776da8')+opening('front',9,1.5,6,5.5,13,'#507e99');
    out+=opening('right',9,0,6.5,6.2,12,'#507b8f');
    const [x,y]=point(-1.5,-1,24.8);
    out+=cupola(x,y,16,18);
    // An armillary, mounted behind the parapet, cuts a silhouette above the roofline.
    const cx=x+.2,cy=y-27;
    out+=ellipse(cx,cy,5.6,5.6,'none','#735b43',1.5)+ellipse(cx,cy,2.4,5.6,'none','#d2a55e',1.2);
    out+=line([[cx-5.4,cy+3.4],[cx+5.5,cy-3.5]],'#dcb568',1.3)+ellipse(cx,cy,1.8,1.8,'#73b9b3','#5e7d7a',.65);
    out+=house(4,1,14,14,2.6,12,8,stone,violet);
    out+=stairs(11,15,5.8,2.6,3)+lantern(15,15,9);
    // A brass telescope on a pegged tripod beside the teaching hall.
    const [tx,ty]=point(-10,12,2.8);
    out+=line([[tx-3.8,ty+1],[tx,ty-7],[tx+4.2,ty+2]],'#75593c',1.85)+line([[tx,ty-7],[tx-.3,ty+3]],'#ab784a',1.3);
    out+=poly([[tx-5,ty-5],[tx+4.5,ty-13],[tx+6.6,ty-10.5],[tx-3.4,ty-3.9]],'#c49253','#73563c',1.1);
    out+=ellipse(tx+5.5,ty-12,1.8,2.5,'#83bbc0','#e0b16c',1.15);
    if(level>=4)out+=banner(...point(8,-11,39),5,'#8c608e');
    if(level>=7)out+=crystal(...point(15,3,4),5,['#a194c0','#776da0','#d6d1e7']);
    return out;
  }
  const plans={keep,home:dwelling,den,farm,mine,academy};
  const painted=new Set([...stone,...chalk,...slate,...oak,...plaster,...azure,...coral,...violet,...straw,
    '#978b87','#968e98','#6e9c43','#9dc6af','#9b9482','#a29c88','#7875a6']);
  function shaded(color,amount){
    const blend=amount>0?255:0,w=Math.abs(amount);
    const rgb=color.slice(1).match(/../g).map(n=>Math.round(parseInt(n,16)*(1-w)+blend*w));
    return '#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  window.OplotVillageSVG=(type,level=1)=>{
    if(!Object.hasOwn(plans,type))return '';
    const stage=Math.max(1,Math.min(type==='keep'?8:9,Math.floor(Number(level)||1)));
    const used=new Map();
    const model=plans[type](stage).replace(/fill="(#[0-9a-f]{6})"/g,(attr,color)=>{
      if(!painted.has(color))return attr;
      if(!used.has(color))used.set(color,'vlg-'+type+stage+'-'+color.slice(1));
      return 'fill="url(#'+used.get(color)+')"';
    });
    const gradients=Array.from(used,([color,id])=>'<linearGradient id="'+id+'" x1="0%" y1="0%" x2="75%" y2="100%">'+
      '<stop stop-color="'+shaded(color,.19)+'"/><stop offset=".48" stop-color="'+color+'"/><stop offset="1" stop-color="'+shaded(color,-.16)+'"/></linearGradient>').join('');
    const tile=type==='keep'&&stage===1?'translate(95 100) scale(1.65 1.276)':'translate(80 100) scale(1.5 1.16)';
    return '<defs>'+gradients+'</defs><g transform="'+tile+' translate(-80 -100)">'+model+'</g>';
  };
})();
