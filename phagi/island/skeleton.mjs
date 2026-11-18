// Joint space is the portrait's own coordinate system. Pose the hierarchy before skinning.
const TAU=2*Math.PI, RAD=Math.PI/180;
const clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
const mix=(a,b,t)=>a+(b-a)*t;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function rigid(a,p,q){
 const c=Math.cos(a),s=Math.sin(a);
 return [c,s,-s,c,q[0]-c*p[0]+s*p[1],q[1]-s*p[0]-c*p[1]];
}
const transform=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const identity=[1,0,0,1,0,0];

export function prepareRig(data){
 const bones=data.bones.map(([name,parent,a,b])=>({name,parent,a,b,length:length(a,b),angle:angle(a,b)}));
 const indices=Object.fromEntries(bones.map((b,i)=>[b.name,i]));
 const faces=data.triangles.map(([i,j,k])=>{
   const [a,b,c]=[data.points[i],data.points[j],data.points[k]];
   const u=b[0]-a[0],v=b[1]-a[1],w=c[0]-a[0],z=c[1]-a[1],D=u*z-w*v;
   return {i,j,k,x:a[0],y:a[1],ux:z/D,uy:-v/D,vx:-w/D,vy:u/D};
 });
 return {...data,bones,indices,faces,width:Math.max(...data.points.map(p=>p[0]))};
}

function motion(pose,t){
 const speed={idle:.31,walk:.86,attack:1.12,hit:1.6,finish:.52}[pose]||.31;
 const phase=t*speed*TAU;
 return {phase,breath:Math.sin(t*.31*TAU),walk:pose==='walk'?1:0,
  strike:pose==='attack'?Math.sin(phase-.95)*.56+Math.sin(phase*2-.6)*.32:0,
  recoil:pose==='hit'?(1-Math.cos(phase))*.5:0,finish:pose==='finish'?1:0};
}
function blend(old,next,t){
 const result={};
 for(const k of ['breath','walk','strike','recoil','finish'])result[k]=mix(old[k],next[k],t);
 result.phase=old.phase+wrap(next.phase-old.phase)*t;return result;
}
export function poseBones(rig,pose,t,previous=null,transition=1){
 let m=motion(pose,t);
 if(previous&&transition<1){const f=clamp(transition,0,1);m=blend(motion(previous,t),m,f*f*(3-2*f));}
 const {phase,breath,walk,strike,recoil,finish}=m, wave=Math.sin(phase);
 const swim=['swimmer','coil'].includes(rig.kind),flying=rig.kind==='glider';
 const body=rig.bones[0],width=rig.width;
 const dx=width*(.036*strike-.026*recoil),dy=width*(-.006*breath-.008*walk*Math.cos(phase*2)-.015*finish);
 const mats=[],angles=[];
 for(let i=0;i<rig.bones.length;i++){
   const b=rig.bones[i], parent=mats[b.parent]||identity;
   const p=b.parent<0?[body.a[0]+dx,body.a[1]+dy]:transform(parent,b.a);
   let rot=0;
   switch(b.name){
    case 'pelvis':rot=.75*breath+1.4*walk*wave+1.3*strike;break;
    case 'spine':rot=-1.1*breath-1.7*walk*wave-3.4*strike+2*recoil-1.5*finish;break;
    case 'neck':rot=-1.7*breath+2.1*walk*Math.sin(phase-.3)+5*strike-6*recoil-4*finish;break;
    case 'head':rot=1.55*breath-1.9*walk*Math.sin(phase-.45)+3*strike-3*recoil;break;
    case 'jaw':rot=.35*(breath+1)+10*Math.max(0,strike)+1.5*finish;break;
    case 'wingArm':rot=-1.35*breath+walk*(flying?8:3)*wave-5*strike-5*finish;break;
    case 'wingElbow':rot=2.2*Math.sin(phase-.4)+(flying?9:4)*walk*Math.sin(phase-.6)+4*strike;break;
    case 'wingTip':rot=2.5*Math.sin(phase-.8)+(flying?8:3)*walk*Math.sin(phase-.95)+3*strike;break;
    case 'fin':rot=2*breath+walk*9*Math.sin(phase-.6)+4*strike;break;
    default:if(b.name.startsWith('tail')){const n=+b.name.at(-1);rot=(1.8+.55*n+(swim?4:2)*walk)*Math.sin(phase-n*.52)-strike*(1+n*.45);}
   }
   const a=(angles[b.parent]||0)+rot*RAD;angles[i]=a;mats[i]=rigid(a,b.a,p);
 }
 // Analytic two-link IK. During stance the sole is locked to the ground;
 // during swing the ankle follows a raised arc. The mirrored legs keep their rest bend.
 for(const name of ['hind','fore','farHind','farFore']){
   const a=rig.indices[name+'Upper'];if(a===undefined)continue;
   const b=a+1,c=a+2,upper=rig.bones[a],lower=rig.bones[b],foot=rig.bones[c];
   const base=transform(mats[upper.parent],upper.a);
   const phaseOffset=({hind:0,fore:Math.PI,farHind:Math.PI,farFore:0})[name];
   const step=(phase+phaseOffset)/TAU%1;
   const swing=Math.max(0,Math.sin(Math.PI*clamp((step-.56)/.44,0,1)));
   const stride=width*(flying?.034:.041)*walk;
   const travel=step<.56?.5-step/.56:-.5+(step-.56)/.44;
   const ankle=[foot.a[0]+stride*travel,foot.a[1]-width*.035*walk*swing];
   const L=upper.length,K=lower.length;
   const dist=clamp(length(base,ankle),Math.abs(L-K)+.001,L+K-.001);
   const aim=angle(base,ankle);
   const bend=Math.sign(wrap(upper.angle-angle(upper.a,lower.b)))||1;
   const shoulder=aim+bend*Math.acos(clamp((L*L+dist*dist-K*K)/(2*L*dist),-1,1));
   const joint=[base[0]+L*Math.cos(shoulder),base[1]+L*Math.sin(shoulder)];
   const constrained=[base[0]+dist*Math.cos(aim),base[1]+dist*Math.sin(aim)];
   mats[a]=rigid(shoulder-upper.angle,upper.a,base);
   mats[b]=rigid(angle(joint,constrained)-lower.angle,lower.a,joint);
   mats[c]=rigid(-swing*walk*.095,foot.a,constrained);
 }
 return mats;
}

export function skinVertices(rig,mats){
 const points=rig.points.map((p,i)=>{
   let x=0,y=0,sum=0;
   for(const [bone,w] of rig.weights[i]){const m=mats[bone];x+=w*(m[0]*p[0]+m[2]*p[1]+m[4]);y+=w*(m[1]*p[0]+m[3]*p[1]+m[5]);sum+=w;}
   return [x/sum,y/sum];
 });
 // A very thin triangle at a curled tail or knee can invert during extreme poses.
 // Limit this displacement continuously, keeping shared seams and positive orientation.
 let limit=1;
 for(const f of rig.faces){
  const [a,b,c,d]=faceMatrix(f,points);
  const det=a*d-b*c;
  if(det>=.2)continue;
  let lo=0,hi=1;
  for(let j=0;j<12;j++){
   const k=(lo+hi)/2,area=(1+k*(a-1))*(1+k*(d-1))-k*k*b*c;
   if(area>=.2)lo=k;else hi=k;
  }
  limit=Math.min(limit,lo);
 }
 if(limit<1)for(let i=0;i<points.length;i++)for(let k=0;k<2;k++)points[i][k]=mix(rig.points[i][k],points[i][k],limit);
 return points;
}
export function faceMatrix(f,points){
 const [a,b,c]=[points[f.i],points[f.j],points[f.k]];
 const u=b[0]-a[0],v=b[1]-a[1],w=c[0]-a[0],z=c[1]-a[1];
 const A=u*f.ux+w*f.uy,B=v*f.ux+z*f.uy,C=u*f.vx+w*f.vy,D=v*f.vx+z*f.vy;
 return [A,B,C,D,a[0]-A*f.x-C*f.y,a[1]-B*f.x-D*f.y];
}
