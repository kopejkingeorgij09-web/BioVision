/* Continuous skin mesh: the painted silhouette follows the same animator as the vector rig.
   Shared vertices avoid disconnected cutout limbs; only visible triangles are drawn. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
function point(u,v,m){if(!m||m.reduce)return [u,v];
 const t=m.time,walk=m.walk||0,phase=m.phase*Math.PI*2;
 const tail=(1-smooth(.15,.48,u))*smooth(.42,.65,v);
 const wing=(1-smooth(.57,.72,u))*(1-smooth(.42,.66,v));
 const head=smooth(.65,.83,u)*(1-smooth(.4,.65,v));
 const chest=Math.exp(-((u-.64)**2/.035+(v-.57)**2/.055));
 const foot=smooth(.7,.94,v)*smooth(.27,.44,u);
 const gait=Math.sin(phase+(u<.56?0:Math.PI));
 let x=u+foot*walk*.035*gait;
 let y=v+tail*.035*Math.sin(t*2.1+u*5)*(1+walk*.5)-wing*(.012*Math.sin(t*2.3)+(1-m.wing)*.12);
 y-=chest*.012*Math.sin(t*2.2);y-=foot*walk*.045*Math.max(0,Math.cos(phase+(u<.56?0:Math.PI)));
 const a=clamp(m.head||0,-.3,.3)*head,dx=u-.73,dy=v-.42;
 x+=(Math.cos(a)-1)*dx-Math.sin(a)*dy;y+=Math.sin(a)*dx+(Math.cos(a)-1)*dy;
 // Eyelids close locally instead of scaling the entire face.
 const eye=m.eye||[.87,.22],blink=(m.blink||0)*Math.exp(-((u-eye[0])**2/.0015+(v-eye[1])**2/.0008));
 y+=(eye[1]-v)*blink*.92;
 return [x,y];}
function mesh(im,n){const w=im.width,h=im.height,out=[],verts=[];
 const xs=n===4?Array.from({length:5},(_,i)=>i/4):[0,.12,.24,.36,.48,.6,.7,.77,.82,.85,.88,.91,.94,1];
 const ys=n===4?Array.from({length:5},(_,i)=>i/4):[0,.1,.17,.2,.23,.26,.3,.4,.52,.64,.75,.86,1];
 for(const v of ys)for(const u of xs)verts.push([u,v]);const cols=xs.length;
 const cx=im.getContext('2d',{willReadFrequently:true}),data=cx.getImageData(0,0,w,h).data;
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
  // Avoid spending draw calls on empty corners of the transparent source.
  let visible=false;for(let y=Math.floor(ys[j]*h);y<Math.ceil(ys[j+1]*h)&&!visible;y+=Math.max(1,Math.floor(h/160)))for(let x=Math.floor(xs[i]*w);x<Math.ceil(xs[i+1]*w);x+=Math.max(1,Math.floor(w/160)))if(data[(y*w+x)*4+3]>10){visible=true;break}
  if(visible){const a=j*cols+i,b=a+1,c=a+cols,d=c+1;out.push({i:[a,b,d],src:[verts[a],verts[b],verts[d]]},{i:[a,d,c],src:[verts[a],verts[d],verts[c]]})}}
 return {verts,tri:out};}
function tri(ctx,im,s,d){const [p,q,r]=s,[a,b,c]=d,det=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);if(Math.abs(det)<1e-9)return;
 const A=((b[0]-a[0])*(r[1]-p[1])-(c[0]-a[0])*(q[1]-p[1]))/det,B=((b[1]-a[1])*(r[1]-p[1])-(c[1]-a[1])*(q[1]-p[1]))/det;
 const C=((c[0]-a[0])*(q[0]-p[0])-(b[0]-a[0])*(r[0]-p[0]))/det,D=((c[1]-a[1])*(q[0]-p[0])-(b[1]-a[1])*(r[0]-p[0]))/det;
 ctx.save();ctx.beginPath();const mx=(a[0]+b[0]+c[0])/3,my=(a[1]+b[1]+c[1])/3;
 for(let i=0;i<3;i++){const v=d[i],dx=v[0]-mx,dy=v[1]-my,l=Math.hypot(dx,dy)||1,x=v[0]+dx/l*.0005,y=v[1]+dy/l*.0005;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,a[0]-A*p[0]-C*p[1],a[1]-B*p[0]-D*p[1]);ctx.drawImage(im,0,0,1,1);ctx.restore();}
const meshes=new WeakMap();
function draw(ctx,im,box,pose,pixels){const m=pose.sprite;if(!m||m.reduce){ctx.drawImage(im,box.x,box.y,box.w,box.h);return}
 let levels=meshes.get(im);if(!levels){levels={};meshes.set(im,levels)}const n=pixels>220&&!(root.DRPERF&&(root.DRPERF.low||root.DRPERF.mode!=='high'&&root.DRPERF.busy))?14:4,skin=levels[n]||(levels[n]=mesh(im,n)),dst=skin.verts.map(v=>point(v[0],v[1],m));
 ctx.save();ctx.translate(box.x,box.y);ctx.scale(box.w,box.h);
 for(const t of skin.tri)tri(ctx,im,t.src,[dst[t.i[0]],dst[t.i[1]],dst[t.i[2]]]);ctx.restore();}
const api={point,draw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DRARTMOTION=api;
})(typeof window!=='undefined'?window:globalThis);
