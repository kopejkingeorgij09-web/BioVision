/* Original vector miniatures. Each drawing uses a 160 × 160 viewBox;
   the grass plane crosses (80, 100). Movable weapon heads point right. */
(() => {
  'use strict';
  const gradient=(id,colors,x1='0%',y1='0%',x2='100%',y2='100%')=>
    '<linearGradient id="'+id+'" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'">'+
      colors.map(([offset,color])=>'<stop offset="'+offset+'" stop-color="'+color+'"/>').join('')+'</linearGradient>';
  const defs='<defs>'+
    gradient('stone',[[0,'#f1dbad'],[.35,'#d4bd97'],[.73,'#b29878'],[1,'#938574']])+
    gradient('left',[[0,'#ceb48e'],[.33,'#bca382'],[1,'#93836d']],'0%','0%','40%','100%')+
    gradient('right',[[0,'#9d947f'],[.62,'#78796d'],[1,'#5a645b']])+
    gradient('slate',[[0,'#bac0af'],[.36,'#889897'],[.7,'#667e82'],[1,'#536970']])+
    gradient('iron',[[0,'#304b56'],[.15,'#70888a'],[.28,'#c4c9ae'],[.4,'#8fa7a3'],[.58,'#586f77'],[.83,'#38505d'],[1,'#263e48']],'0%','0%','12%','100%')+
    gradient('brass',[[0,'#fff0b1'],[.22,'#e8c17a'],[.49,'#c09355'],[.72,'#9b7445'],[1,'#684f3a']])+
    gradient('wood',[[0,'#d5ab73'],[.28,'#c28b55'],[.64,'#a16e44'],[1,'#714d36']],'0%','0%','45%','100%')+
    gradient('beam',[[0,'#94704b'],[.25,'#ac7d50'],[.68,'#765239'],[1,'#564736']])+
    gradient('ruby',[[0,'#db7958'],[.44,'#b74c43'],[1,'#7b3940']])+
    gradient('violet',[[0,'#bdabc7'],[.34,'#99869e'],[.82,'#655b78'],[1,'#46495e']])+
    gradient('aqua',[[0,'#e5fff0'],[.31,'#a1e6d3'],[.58,'#5cbbbc'],[.8,'#368892'],[1,'#315e77']])+
    gradient('ice',[[0,'#edfbf0'],[.35,'#b5edea'],[.65,'#69abca'],[1,'#487891']])+
    '<radialGradient id="shade"><stop stop-color="#404c3e" stop-opacity=".44"/><stop offset="1" stop-color="#526246" stop-opacity="0"/></radialGradient>'+
    '<radialGradient id="runeFire"><stop stop-color="#ffe0a0"/><stop offset=".52" stop-color="#eb9553"/><stop offset="1" stop-color="#a74b32"/></radialGradient>'+
    '<radialGradient id="runeIce"><stop stop-color="#e3fff1"/><stop offset=".53" stop-color="#8adce4"/><stop offset="1" stop-color="#3c8399"/></radialGradient>'+
    '<radialGradient id="crystalGlow"><stop stop-color="#c6ffdb" stop-opacity=".86"/><stop offset="1" stop-color="#91f6dd" stop-opacity="0"/></radialGradient></defs>';
  const paint=color=>color[0]==='@'?'url(#'+color.slice(1)+')':color;
  function path(d,fill,stroke='none',width=1){
    return '<path d="'+d+'" fill="'+paint(fill)+'" stroke="'+paint(stroke)+'" stroke-width="'+width+'" stroke-linejoin="round" stroke-linecap="round"/>';
  }
  function line(d,stroke,width){return path(d,'none',stroke,width);}
  function ellipse(x,y,rx,ry,fill,stroke='none',width=1){
    return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+rx+'" ry="'+ry+'" fill="'+paint(fill)+'" stroke="'+paint(stroke)+'" stroke-width="'+width+'"/>';
  }
  function rivet(x,y,r=1.6){
    return ellipse(x,y,r,r*.82,'#735e46')+ellipse(x-.15,y-.38,r*.77,r*.60,'#e0bc7d')+
      ellipse(x-r*.24,y-r*.34,r*.30,r*.17,'#fff0ab');
  }
  function plinth(x,y,rx,ry,h,top='@stone',light='@left',dark='@right'){
    const a=x-rx,b=x+rx,t=y-ry,f=y+ry,join='#675f53';
    return path('M'+a+' '+y+' L'+x+' '+f+' V'+(f+h)+' L'+a+' '+(y+h)+'Z',light,join,.9)+
      path('M'+x+' '+f+' L'+b+' '+y+' V'+(y+h)+' L'+x+' '+(f+h)+'Z',dark,join,.9)+
      path('M'+a+' '+y+' L'+x+' '+t+' L'+b+' '+y+' L'+x+' '+f+'Z',top,join,.85)+
      line('M'+(a+1)+' '+(y-.4)+' L'+x+' '+(t+.4)+' L'+(b-1)+' '+(y-.4),'#f1dcac',.9);
  }
  function strap(x,y,flip=false){
    return '<g transform="translate('+x+' '+y+') scale('+(flip?-1:1)+' 1)">'+
      path('M-3 -1 L3 1 V11 L-3 9Z','@brass','#826748',.68)+rivet(.1,3.7,1.05)+'</g>';
  }
  function badge(x,y,l,fill='@ruby'){
    const tips=['','','#c2a975','#d7b46f','#e2bd75','#f3d989'];
    const chevrons=Array.from({length:Math.max(0,l-2)},(_,i)=>line('M-3 '+(i*2.8+2)+' l3 1.6 3-2.1',tips[l],.88)).join('');
    return '<g transform="translate('+x+' '+y+')">'+path('M-6 -2 L6 -3 V10 L.4 15 L-6 11Z',fill,'#6b5147',.7)+
      line('M-4.9 -.3 V10.3 L.4 13.6 L5 9.7 V-1.4','#cfb27a',.72)+chevrons+line('M-7 -2.3 L7 -3.3','@brass',1.95)+'</g>';
  }
  function archer(l){
    let s=plinth(80,103,49,25,5,'@stone');
    s+=path('M50 87 L76 75 L111 88 L108 107 L78 122 L50 108Z','@beam','#645641',1.1);
    s+=path('M56 82 L80 94 V112 L58 103Z','@left','#796f58',.9)+path('M80 94 L104 82 L102 102 L80 113Z','@right','#636b5c',.9);
    s+=line('M57 91 l22 10 M61 98 l7 3 m3-7 0 5 M83 100 l18-8 m-10 0 v4','#958970',1.2);
    // Splayed structural oak feet taper into the platform. Both faces carry diagonal braces.
    for(const [x,y] of [[49,90],[110,89],[79,104]]){
      s+=path('M'+(x-3)+' '+(y-20)+' l7 2 -2 31 -8 3Z','@beam','#63503b',1.0);
      s+=line('M'+(x-1)+' '+(y-16)+' l-2 27','#c39b65',1.25);
    }
    s+=line('M49 102 L77 85 M52 79 L77 112 M82 110 L107 78 M84 83 L106 96','#654c36',5.3);
    s+=line('M49 101 L77 84 M52 78 L77 110 M82 109 L107 77 M84 82 L106 95','#bb8e5b',2.5);
    if(l>=2)s+=badge(91,92,l,l>3?'#3e6e77':'@ruby');
    s+=plinth(80,63,49,28.8,8,'@wood','@wood','@beam');
    for(let k=-3;k<=3;k++){
      const yy=k*6.4,x1=55+Math.abs(k)*4.2,x2=105-Math.abs(k)*4.2;
      s+=line('M'+(x1+yy*.74)+' '+(55+yy*.37)+' l'+(x2-x1)+' '+((x2-x1)*.54),'#825c40',.9);
    }
    s+=line('M32 64 L79 89 L128 63','#e6c489',1.75);
    for(const [x,y] of [[42,61],[79,83],[116,61]])s+=plinth(x,y,7.5,4.2,4.1,'@stone');
    for(const [x,y] of [[52,74],[66,81],[93,82],[109,73]])s+=strap(x,y,x>80);
    s+=ellipse(80,61.4,11,7.1,'@iron','#60594d',1.05)+ellipse(80,60.5,6.4,3.6,'@brass','#8c7755',.85);
    // A leather tube and steel-flecked bolts sit beside the swivel ring.
    s+=path('M43 57 Q46 54 49 56 L52 64 Q48 67 45 63Z','@ruby','#6d5341',.7);
    for(let i=0;i<3;i++)s+=line('M'+(45+i*1.5)+' 58 l-1.6 -7.2','#e0c491',.7)+path('M'+(43+i*1.5)+' 52 l-.6 -3 2.2 2Z','#8ba6a4');
    return s;
  }
  function cannon(l){
    let s=plinth(80,104,49,25,4.5,'@slate');
    s+=path('M33 86 L48 74 L78 63 L108 72 L129 84 L128 99 L96 116 L77 123 L48 109 L34 101Z','@right','#515d5a',1.2);
    s+=path('M34 87 L53 91 L80 104 V120 L51 107 L35 100Z','@slate','#606b66',.9);
    s+=path('M33 86 L49 73 L76 63 L106 71 L129 84 L108 99 L80 109 L51 97Z','@slate','#5d6762',1.1);
    s+=line('M36 87 L52 97 L80 108 L109 98 L126 86','#cfceb2',1.75);
    s+=line('M38 97 L55 106 L78 115 M52 100v5 m13 0v6 M83 115 l24-10 16-9 m-16 3v6','#6d756a',.92);
    for(const [x,y] of [[45,87],[65,100],[97,100],[116,88],[80,72]])s+=ellipse(x,y,3.4,1.9,'@brass','#797254',.65)+rivet(x,y-.3,.95);
    s+=ellipse(80,85,32,18,'@iron','#475857',1.6)+ellipse(80,82,30,17,'@brass','#6f654e',1.1);
    s+=ellipse(80,81.4,25.2,14.1,'@iron','#526466',1.0)+ellipse(80,78.3,17.7,10,'@slate','#55636a',.95);
    s+=path('M62 78.3 Q82 88 99 77.2 L98 83 Q80 94 62 85Z','@beam','#685440',.68);
    s+=ellipse(80,75.7,12.3,7.8,'@iron','#655d4e',1.0)+ellipse(80,74.6,6.4,4.05,'@brass','#857453',.70);
    if(l>=2)s+=badge(66,98,l,l>=4?'#526f75':'@ruby');
    for(const [x,y,r] of [[43,96,3.7],[48,99,3.9],[46,93,3.5],[50,94,3.4]])s+=ellipse(x,y,r,r*.86,'@iron','#475858',.63)+ellipse(x-.8,y-1.1,1,.61,'#b9c3ac');
    return s;
  }
  function crystal(x,y,s,ice=false){
    return '<g transform="translate('+x+' '+y+') scale('+s+')">'+
      path('M-1 -22 L10 -10 L13 0 L5 16 L-4 21 L-13 7 L-12 -7Z',ice?'@ice':'@aqua',ice?'#527c95':'#427f84',1.0)+
      path('M-1 -22 L1 -6 L-3 10 L-4 20 L-12 6 L-10 -6Z',ice?'#b9e6ee':'#9adfcf')+
      path('M-1 -22 L1 -6 L10 -10 L11 -5 L4 10 L-3 18 L-1 7Z',ice?'#78b7cb':'#65bdb8')+
      path('M-1 -22 L-10 -6 L-5 -9 L.1 -17Z','#ebffdb')+
      line('M1 -6 L4 6 L-3 18 M1 -6 L9.5 -10','#d1f8de',.73)+'</g>';
  }
  function spire(l){
    let s=plinth(80,102,44.5,25.1,5,'@violet','@left','@right');
    s+=path('M45 97 L51 86 L74 74 L98 77 L116 88 L115 101 L88 117 L73 117 L49 105Z','@violet','#625d70',1.0);
    s+=path('M45 97 L53 85 L76 75 L99 79 L117 89 L108 101 L83 113 L71 111Z','@violet','#625d70',.92);
    s+=line('M47 98 l23 13 13 2 25-12 8-10','@brass',3.1);
    s+=path('M61 93 Q70 84 73 63 L85 58 L92 69 Q92 82 102 91 L86 102 L76 104Z','@slate','#5a6672',1.15);
    s+=path('M66 92 Q75 79 76 66 L80 65 Q78 84 75 96Z','#b5ab98');
    s+=path('M81 97 L84 71 L88 68 L89 76 L86 95Z','#647381');
    s+=line('M60 93 Q69 98 77 100 M91 96 L101 90','@brass',1.95);
    for(const [x,y] of [[70,99],[79,102],[87,100]])s+=line('M'+x+' '+y+' l2 -2 -1 -2','#8ac9c7',.91);
    if(l>=2)s+=badge(66,98,l,l>=4?'#635877':'#477980');
    s+=ellipse(80,66,17.8,9,'@brass','#817153',1.1)+ellipse(80,64.1,15.6,7.8,'@iron','#536a69',.88);
    s+=ellipse(80,52,20,20,'@crystalGlow');
    s+=path('M66 66 Q59 56 64 49 Q64 57 70 60 L74 64Z','@brass','#8a7959',.8)+path('M91 63 Q98 56 96 47 Q103 59 95 67Z','@brass','#8a7959',.8);
    s+=crystal(80,49.8,.88);
    s+=path('M65 64 L73 65 Q80 69 82 58 Q85 67 88 67 L96 63 Q94 72 81 75 Q68 71 65 64Z','@brass','#786c50',.85);
    s+=ellipse(80.7,69,2.1,2.5,'@aqua','#678e81',.58);
    if(l>=3)s+=line('M65 40 l2.4-3 .7-3 m23 14 2.5-1.8','#d5e8b3',.9);
    return s;
  }
  function trap(ice,l){
    const bronze=ice?'@slate':'@brass',accent=ice?'#9fddda':'#edbc70';
    let s=ellipse(80,102,32.7,18.7,'#515949','#6f6b56',.9)+
      path('M48 95 L59 82 L84 76 L106 81 L114 93 L110 107 L85 119 L59 112 L47 103Z',ice?'@slate':'@left','#666957',1.25)+
      path('M47 96 L59 82 L83 76 L106 81 L114 93 L103 104 L81 112 L58 106Z',bronze,'#706e5c',1.05)+
      ellipse(80.5,95.7,26.4,14.7,'@iron','#475b59',1.0)+
      ellipse(80.5,95.7,23.5,12.6,'none',accent,1.08)+
      ellipse(80,95.6,17.8,9.6,ice?'#547b87':'#855a40','#adb29a',.65);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;const x=80.5+Math.cos(a)*27,y=95.7+Math.sin(a)*15;
      s+=rivet(x.toFixed(2),y.toFixed(2),l>=3?1.6:1.24);
    }
    if(ice){
      for(let i=0;i<6;i++)s+='<g transform="translate(80 95.5) scale(1 .62) rotate('+(i*60)+')">'+line('M0 -1 V-14 M0 -9 L-3 -12 M0 -9 L3 -12','#bcecef',1.30)+'</g>';
      s+=crystal(76.7,91,.37,true)+crystal(84.5,91.8,.26,true);
    }else{
      s+=path('M68 100 Q64 95 73 89 Q72 94 76 94 Q80 92 82 83 Q85 87 84 92 Q89 91 90 87 Q96 94 89 99 Q84 105 73 103Z','@runeFire','#aa693d',.8);
      s+=path('M75 101 Q74 98 80 95 Q79 99 82 97 Q85 96 85 93 Q90 99 83 101.5 Q79 104 75 101Z','#ffe4a5');
    }
    if(l>=2)for(let i=0;i<Math.min(4,l-1);i++)s+=ellipse(68+i*3,108.4+i*.6,1,.76,accent);
    return s;
  }
  function crossbow(l){
    let s=ellipse(80,100.9,10.5,7,'#6e5c46','#554f3e',1.1)+ellipse(80,99.3,9.8,6.5,'@brass','#6a6044',1.05);
    // Bow limbs point across the rail. The string is drawn live to express the draw and release.
    s+=path('M58 93 Q57 90 61 87 L78 92 L100 94 Q107 96 111 100 Q108 104 101 106 L75 108 L59 113 L54 110 L66 101Z','@beam','#5c4a34',1.05);
    s+=path('M59 94 L68 92 L79 95 L103 96 L109 99 L104 102 L77 101 L65 103Z','@wood','#865f3b',.9);
    s+=line('M70 97 L103 98.4','#ebca89',1.50);
    s+=path('M95 98 C89 85 80 78 73 75 L66 72 L69 67 Q85 74 94 84 Q100 91 102 97 L102 102 Q96 116 71 128 L68 125 Q87 114 95 102Z','@wood','#644c37',1.2);
    s+=line('M68.5 68.5 Q89 77 99.5 96.5 M98 105 Q90 116 72 124.5','#e1bc78',1.73);
    s+=path('M66 68 L70 66.7 L74.5 69.5 L71 74 L65 72Z','@brass','#745d40',.75)+path('M67 124.7 L72 121.7 L75 125 L70.2 128.8 L66 128.6Z','@brass','#745d40',.77);
    s+=path('M88 93 L94 94 L96 105 L89 106Z','@brass','#826a40',.68);
    for(const [x,y] of [[80,97],[91.5,99.7],[85.3,77.9],[84.3,115.2]])s+=rivet(x,y,l>=4?1.78:1.25);
    return s;
  }
  function barrel(l){
    let s='';
    for(const y of [89.2,111.2]){
      s+=ellipse(76,y,12.5,5.8,'@beam','#574d3c',1.15)+ellipse(76.5,y-.65,9.9,4.1,'@brass','#7b6545',.75)+ellipse(76.6,y-.7,3.25,2.3,'@iron','#5c6054',.75);
    }
    s+=path('M56 90 Q50 91 51 99 Q51 109 57 110 L74 111 L107 114 L114 112 L116 88 L110 84 L76 88Z','@iron','#374951',1.55);
    s+=path('M56 91 Q59 87 66 89 L72 89 L71 110 L62 111 Q55 110 55 107Z','@iron','#40545a',.93);
    s+=line('M57 91.7 Q61 89.4 67 90.5 M78 90.3 Q92 89.4 105 88.7','#c3c6a9',1.6);
    for(const [x,y,w,h] of [[64,89.7,4,20],[82,87.7,4.1,23],[103,85.5,4.7,27]]){
      s+=path('M'+x+' '+y+' q2.7 -1.4 '+w+' -.6 q3 9.5 .2 '+h+' l-'+w+' .3 q2.1 -13 -.2 -'+h+'Z','@brass','#7b7157',.67);
    }
    s+=ellipse(112.6,99,6.7,14.3,'@brass','#6a6a56',1.15)+ellipse(113.3,98.9,4.55,10.65,'#263e48','#84958a',.95)+
      path('M112.8 89.2 Q109.1 94.5 110.4 103.2','none','#496570',1.07);
    if(l>=4)s+=path('M91 93 l2 1 2-1.5 -.3 2.4 1.8 1.2 -2.7 .6 -.9 2.3 -1.6-2.1 -2.2 .1 1.3-1.9Z','#dbc48a');
    return s;
  }
  function wall(l,mask,part){
    const preview=part==='preview-ok'||part==='preview-bad',bend=mask!==5&&mask!==10;
    const levels=[
      ['#c1a784','#9d8b71','#816f5e','#dac39b','#ad9876'],
      ['#b2b39d','#909b8c','#6b7b72','#b8bda1','#a5af96'],
      ['#a3b0a7','#85988f','#59716f','#95b6af','#7e9e98'],
      ['#9cabae','#7d9296','#536c77','#7ca4aa','#6f9399'],
      ['#9db1a9','#74938e','#516d70','#80b5ab','#62968c']
    ];
    const [sun,side,dark,cap,bevel]=preview?(part==='preview-ok'?['#9be3b5','#65c99c','#34866e','#bcf9c6','#8bddb4']:
      ['#f4b3a0','#d7907d','#9d635c','#ffd0a5','#ebaa90']):levels[l-1];
    const edge=preview?dark:'#526965',trim=preview?cap:l<3?'#d4bf92':'#d4b780';
    const projection=(a,b,z)=>[(80+(a-b)*69.12).toFixed(2),(100+(a+b)*51.84-z*128).toFixed(2)];
    const poly=(pts,fill,stroke=edge,width=.79)=>path('M'+pts.map(p=>projection(...p).join(' ')).join(' L')+'Z',fill,stroke,width);
    const seam=(pts,color,width)=>line('M'+pts.map(p=>projection(...p).join(' ')).join(' L'),color,width);
    function box(r,b,t,paint){
      const [x0,y0,x1,y1]=r;
      return poly([[x0,y1,t],[x1,y1,t],[x1,y1,b],[x0,y1,b]],sun)+
        poly([[x1,y1,t],[x1,y0,t],[x1,y0,b],[x1,y1,b]],side)+
        poly([[x0,y0,t],[x1,y0,t],[x1,y1,t],[x0,y1,t]],paint)+
        seam([[x0,y1,t],[x0,y0,t],[x1,y0,t]],preview?cap:'#d5d7bb',.84);
    }
    const directions=[[-1,0],[0,-1],[1,0],[0,1]];
    const runs=directions.filter(([a,b],i)=>mask?(mask&(1<<i)):b===0);
    function arm([dx,dy]){
      const end=mask?.505:.36,range=(start,stop,half)=>dx?
        [Math.min(dx*start,dx*stop),-half,Math.max(dx*start,dx*stop),half]:
        [-half,Math.min(dy*start,dy*stop),half,Math.max(dy*start,dy*stop)];
      const r=range(.09,end,.096),[x0,y0,x1,y1]=r;
      let s=box(range(.08,end,.112),0,.038,side)+box(r,.033,.174,sun);
      s+=seam([[x0,y1,.103],[x1,y1,.103],[x1,y0,.103]],dark,1.05);
      s+=seam([[(x0+x1)*.5,y1,.103],[(x0+x1)*.5,y1,.172]],dark,.9);
      s+=seam([[x1,(y0+y1)*.5,.037],[x1,(y0+y1)*.5,.103]],dark,.83);
      s+=box(range(.08,end,.11),.17,.210,cap)+box(range(end*.44,end*.72,.085),.208,.242,bevel);
      if(l>2&&!preview)s+=seam([[x0,y1,.157],[x1,y1,.157],[x1,y0,.157]],'#c6bb95',.84);
      return s;
    }
    let s=runs.filter(([x,y])=>x+y<0).map(arm).join('');
    const r=bend?.145:.118,inner=r-.021,h=bend?.249:.199;
    s+=box([-r,-r,r,r],0,.045,bevel)+box([-inner,-inner,inner,inner],.039,h,sun);
    for(const z of [.108,.177])s+=seam([[-inner,inner,z],[inner,inner,z],[inner,-inner,z]],dark,.86);
    s+=box([-r,-r,r,r],h-.006,h+.039,cap);
    const rr=r*.79;
    s+=box([-rr,-rr,rr,rr],h+.037,h+.068,bend?trim:bevel);
    if(bend&&l>=3){
      const g=.042;s+=poly([[-g,-g,h+.068],[g,-g,h+.068],[g,g,h+.068],[-g,g,h+.068]],bevel,dark,.65);
      s+=seam([[-g,g,h+.071],[-g,-g,h+.071],[g,-g,h+.071]],cap,.77);
    }
    return s+runs.filter(([x,y])=>x+y>0).map(arm).join('');
  }
  function reinforcement(type,stage,part){
    if(stage<6||part!=='base')return '';
    let s='';
    if(type==='archer'){
      s+=path('M49 72 L53 74 L50 107 L45 109Z','@iron','#615c50',.8)+rivet(50,78,1.2)+rivet(47.8,103,1.2);
      if(stage>=7)s+=path('M108 73 L112 70 L114 97 L109 100Z','@iron','#59625b',.8)+rivet(111,77,1.3);
      if(stage>=8)s+=line('M53 98 L76 85 M82 85 L108 94','#ebc37b',1.6);
      if(stage>=9)s+=badge(68,87,5,'#526e83');
    }else if(type==='cannon'){
      s+=strap(52,93)+strap(107,94,true);
      if(stage>=7)s+=line('M44 93 Q49 98 57 101 M102 103 Q112 100 120 92','#edcb88',1.6);
      if(stage>=8)s+=rivet(51,87,2.0)+rivet(108,88,2.0)+rivet(92,104,1.7);
      if(stage>=9)s+=path('M72 111 L79 108 L86 110 L79 118Z','@brass','#7d7051',.72);
    }else if(type==='spire'){
      s+=crystal(66,89,.26);if(stage>=7)s+=crystal(96,87,.30);
      if(stage>=8)s+=ellipse(81,66,17.5,7.2,'none','#b1e4cb',1.28);
      if(stage>=9)s+=line('M61 96 L78 104 L99 94','@brass',1.6);
    }else if(type==='firetrap'||type==='icetrap'){
      for(let i=0;i<stage-4;i++){
        const a=Math.PI*(.16+i*.13),x=(80+Math.cos(a)*23.5).toFixed(1),y=(97+Math.sin(a)*14.6).toFixed(1);
        s+=ellipse(x,y,1.45,.92,type==='icetrap'?'#b9f2ec':'#ffe29b','#81785e',.42);
      }
    }
    return s;
  }
  window.OplotDefenseSVG=(type,level=1,part='base',mask=0)=>{
    const stage=Math.max(1,Math.min(10,Math.trunc(level)||1)),l=Math.min(5,stage);
    let body='';
    if(type==='wall'){
      body=wall(l,mask&15,part);
      if(stage>5&&part==='base'){
        const z=(mask===5||mask===10)?68.8:61.8;
        for(let i=0;i<stage-5;i++)body+=ellipse(76+i*2,z+i*.47,1.26,.8,'#e4ce94','#736b53',.42);
      }
    }
    else if(part==='weapon'){body=type==='cannon'?barrel(l):type==='archer'?crossbow(l):'';}
    else if(part==='base'){
      if(type==='archer')body=archer(l);else if(type==='cannon')body=cannon(l);
      else if(type==='spire')body=spire(l);else if(type==='firetrap'||type==='icetrap')body=trap(type==='icetrap',l);
    }
    return body?defs+body+reinforcement(type,stage,part):'';
  };
})();
