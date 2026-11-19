// Painted storage cutaways. Coordinates share the map's 160 × 160 isometric tile.
(() => {
  'use strict';
  const path=(d,fill,edge='none',width=1)=>`<path d="${d}" fill="${fill}" stroke="${edge}" stroke-width="${width}"/>`;
  const line=(d,color,width=1)=>path(d,'none',color,width);
  const oval=(x,y,rx,ry,fill)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  const use=(id,x,y,scale=1)=>`<use href="#${id}" transform="translate(${x} ${y}) scale(${scale})"/>`;
  function gradient(id,stops,horizontal=false){
    return `<linearGradient id="${id}" x2="${horizontal?'100%':'24%'}" y2="${horizontal?'12%':'100%'}">`+
      stops.map(([offset,color])=>`<stop offset="${offset}" stop-color="${color}"/>`).join('')+'</linearGradient>';
  }
  const metalOutline='#413a37',woodOutline='#523b32';
  const goldDefs='<defs>'+
    gradient('opStoreSteel',[[0,'#d2d3af'],[.23,'#97a291'],[.50,'#707d78'],[.74,'#4d6667'],[1,'#394f54']],true)+
    gradient('opStoreBrass',[[0,'#f9dc8a'],[.34,'#d3a45a'],[.69,'#a57545'],[1,'#785437']],true)+
    gradient('opStoreGold',[[0,'#fff1a4'],[.42,'#f8cc54'],[1,'#d79930']])+
    gradient('opStoreGloom',[[0,'#3c4242'],[.56,'#4d5246'],[1,'#766b4f']])+
    '<g id="opStoreCoin">'+oval(.5,1.7,6.7,3.4,'#a36b28')+
      path('M-6.6 0v1.6c1.7 3.9 11.7 4.2 13.2 0V0Z','#d39a30','#846132',.6)+
      oval(0,0,6.6,3.35,'url(#opStoreGold)')+line('M-5.1-.65Q-.3-3.45 4.7-.85','#ffedab',.8)+
      line('M-.45-1.4l2.1.64-1.37 1.4-2.15-.69Z','#cc8e2d',.65)+'</g>'+
    '<g id="opStoreIngot">'+path('M-9-1l10-5 7 2.3 1.7 4.5-10.8 6-8.4-3.9Z','#b87e2c','#82582c',.75)+
      path('M-9-1l10-5 7 2.3L-2.1 1.8Z','url(#opStoreGold)')+
      path('M-9-1l6.9 2.8 1 5.1-8.4-3.9Z','#eaa93b')+
      line('M-8.2-1.1l6.1 2.5 9.5-4.7','#fff0a0',.9)+'</g></defs>';
  const foodDefs='<defs>'+
    gradient('opStoreWood',[[0,'#c89157'],[.35,'#aa744b'],[.64,'#87573a'],[1,'#684835']],true)+
    gradient('opStoreWeave',[[0,'#e1b679'],[.43,'#be8c50'],[1,'#946836']],true)+
    gradient('opStoreBerry',[[0,'#ff9a82'],[.27,'#df5264'],[.76,'#b63854'],[1,'#722d44']])+
    gradient('opStorePlum',[[0,'#f79a9a'],[.37,'#c74b75'],[1,'#7b355d']])+
    gradient('opStoreLeaves',[[0,'#b2ca72'],[.5,'#73a367'],[1,'#407c62']])+
    '<g id="opStoreFruit">'+path('M-.4-3.9C2.6-5.2 5.3-3.2 5.4-.3c.1 3.3-2 5.8-5.1 6.1-3.4.1-5.7-2.2-5.5-5.5.1-2.8 2.2-5.1 4.8-4.2Z','url(#opStoreBerry)','#84364a',.53)+
      path('M-3-1.1q.3-2.1 2.2-2.1.9.1.15 1.05L-2.1-.4Z','#ffd0aa')+'</g>'+
    '<g id="opStorePlumFruit">'+oval(0,.6,5.1,5.4,'url(#opStorePlum)')+oval(-1.8,-1.3,1.3,.8,'#ffc5ac')+'</g>'+
    '<g id="opStoreSprig">'+path('M-.7 1.2q-6-1.1-6.1-6.6 5.8.5 6.9 5.1 2.5-4.6 7.4-4.3-.8 4.6-6.8 6.4Z','url(#opStoreLeaves)','#477651',.6)+
      line('M0 1.4L-4.8-3.3M.4 1.2 5.1-2.2','#bdd48b',.58)+'</g></defs>';

  function foot(food){
    const light=food?'#d5bc87':'#c6baa0',shade=food?'#907957':'#858480';
    return oval(83,112,53,16,'#344a4225')+
      path('M19 99l50-32 16-2 55 35-1 7-55 32-10-.6-55-32Z',light,'#574f40',1.15)+
      path('M19 99l55 32 9 .6 57-31.6-1 7-55 32-10-.6-55-32Z',shade)+
      path('M19 99l55 32v7.4l-55-32Z',food?'#aa9269':'#a49a85')+
      line('M20 99l55 31.4 8.8.4 54-30.5','#f0ddaa',1.5)+
      line('M34 109.3v4.5m17 6v4.6m13 3v4.5m30-8.4v4.6m18-15.1v4.7m14-12.7v3.8','#716e60',1.2);
  }
  const coinColumns=[
    [56,88],[88,78],[72,84],[100,85],[45,84],[90,94],[70,96],[109,78],[62,76],
    [78,73],[85,86],[55,94],[101,93],[77,91],[47,77],[95,72],[67,91],[106,84]
  ];
  function treasure(fill){
    if(!fill)return '';
    const capacity=coinColumns.length*4,total=fill===1?capacity:Math.ceil(fill*(capacity-1));
    let out='';
    for(let layer=0;layer<4;layer++){
      const count=Math.min(coinColumns.length,Math.max(0,total-layer*coinColumns.length));
      const row=coinColumns.slice(0,count).map(([x,y],j)=>({x:x+((layer+j)%2?1:-1)*layer*.45,y:y-layer*5.5,j}));
      row.sort((a,b)=>a.y-b.y);
      for(const {x,y,j} of row)out+=use((j+layer)%4===0?'opStoreIngot':'opStoreCoin',x,y,(j%3===0?.95:1.03));
    }
    return out;
  }
  function treasury(level,fill){
    let out=goldDefs+foot(false);
    // Two square stone piers protect the rear lock and anchor the bronze ring.
    for(const [x,y] of [[39,49],[117,49]]){
      out+=`<g transform="translate(${x} ${y})">`+
        path('M-8 3l7-4 9 4v30l-8 5-8-5Z','#6c7772',metalOutline,1.2)+
        path('M-8 3l8 4 8-4-8-4Z','#d0c3a1')+path('M-8 4l8 4v29l-8-4Z','#a7a28c')+
        path('M-9 0l9-5 9 5v4L0 9l-9-5Z','url(#opStoreBrass)',metalOutline,.9)+
        line('M-8 .2l8 4.6 8.2-4.3','#fae1a1',1.2)+'</g>';
    }
    if(level>=3)out+=path('M62 50l-.4-12.5 16.7-11.8 8.5 1.5 10.3 10.4 1.3 16.6-17.7 9.8Z','#897b62',metalOutline,1.15)+
      path('M62 37.5l16.5-11.7 8.1 1.4-15.9 12.2.3 10.1-9.2-2.2Z','#d3bc89')+
      path('M70.5 38.8l15.8-11.5 10.4 10.1.8 10.1-15.3 5.9-11.8-6.8Z','#7a9188',metalOutline,.85)+
      path('M74.1 38l11.7-7.7 7.4 7.4-9.4 7.3Z','#c69d62',metalOutline,.75)+
      path('M78.3 37.9l7.7-5.5 4.1 4.6-6.7 5Z',level>=7?'#479d9b':'#dfbd75');
    out+=path('M28 67l12-13.5 27-11 33 1.2 23 11L133 70l-5 30-22 15-32 8-28-11-17-15Z','url(#opStoreSteel)',metalOutline,1.65)+
      path('M32 65l16-12 22-8 27 .6 24 10.7 8.4 12.2-9.3 14.4-21 13-23 5-26-9-15.8-12Z','#716d52',metalOutline,1)+
      path('M35 65l15-10 21-7.8 24.6 1 23 9.6 7.4 11.6-10.3 16.4-42.3 20L45 91Z','url(#opStoreGloom)')+
      path('M39 77q18-10 39-13 24 .3 43 10l-3 17-22 11-22 4-30-11Z','#76694b')+
      line('M43 79q33-15 66-7M50 84q27-12 56-9M61 92l18-7 23 1','#948357',1.15)+
      path('M27 65l12-13 29-12 32 1.5 25 12 9 13.8-4.5 3.4-9-13.2-22.4-10.2-29-1.5-26.2 10.7L31.1 69Z','url(#opStoreBrass)',metalOutline,1.05)+
      line('M29 65.3l12.1-12L68.4 42l31.1 1.2 23.4 11.3','#ffe8a0',1.35)+treasure(fill);
    // The open grille shows the lowest coins even when there is only a handful.
    out+=path('M28.1 66l5.9 1 5.1 18.9 12 9.6L76 105l24.4-5.5 21.1-11.8 6.5-19.3 5.8-2-5.3 25.5-25.6 14.9-27.1 6.4-27.8-11.3-15.9-12.4Z','url(#opStoreBrass)',metalOutline,1.1)+
      line('M34 69l5.5 16.3 12.8 10.3 23.7 9.2 24.2-5.9 20.7-11.4 6.7-17.2','#f4d591',1.3)+
      path('M31.3 92.2l18.4 13.5L76 116l26.7-6 25.8-15.1-.7 6.6-24.2 15L76 124l-27.8-11.5-16.4-12.6Z','url(#opStoreSteel)',metalOutline,1.15);
    for(const [x,y] of [[36,87],[50,99],[75,108],[102,102],[124,90]]){
      out+=path(`M${x-2} ${y-2}l3.2-.3 1.1 12.5-3.6 1.1Z`,'#a7a68d',metalOutline,.65)+oval(x,y,.98,.97,'#ffe4a0');
    }
    out+=path('M68 105l10-4.4 9 4.6v13.3l-9.8 6.1-9.6-6Z','#b2874c',metalOutline,1.05)+
      path('M70.6 106.7l7.3-3.4 6.4 3.4-.1 10.7-7.2 4.4-6.2-4Z','#f6cf70')+
      path('M76.2 112a2 2 0 1 1 2.8 1.5l.9 3-3.5.4 1-3.4Z','#785430');
    if(level>=2)out+=path('M37.7 92l4 1.6 2.9 13.7 6.4 3.2-.3 4.2-10.3-4.9Z','url(#opStoreBrass)',metalOutline,.9)+
      path('M113.4 105.3l6.5-4.5 4.9-12.3 2.9-1.8-2.9 17.2-11.3 7Z','url(#opStoreBrass)',metalOutline,.9)+
      line('M32 96l6.8 5.3M105 112l6.4-3.8','#f0ca7d',1.7);
    if(level>=4)out+=path('M31 80l4-1 7 14-4 1.7Zm91 9 4 1.2-4.3 11-4.7 3Z','#c7ad74',metalOutline,.8);
    if(level>=5)for(const x of [39,117])out+=path(`M${x-8} 47.4l1.1-4.6 6.9-7.1 7.1 6.8 1.1 4.9-8.4 4.7Z`,'#a48148',metalOutline,.88)+
      path(`M${x-7} 42.8l7-7.1 6.9 6.6-7 4.4Z`,'#f0d383')+
      line(`M${x} 46.6v3.5`,'#dfbe70',1);
    if(level>=6)out+=path('M48 106l14.8 5.9-.2 4.7-13.7-5.4ZM91 113.1l12-3.7-.6 4.8-11.7 3.5Z','#659d97',metalOutline,.7)+
      line('M50 107.7l11.4 4.4m31.7 2.6 8.4-2.6','#a3d1ba',1.1);
    if(level>=8)out+=path('M77 28.1l4.2-3.7.9-10.6 4.4 6.3 5.8 3.6-5 5.2Z','#c7a05c',metalOutline,.85)+
      path('M82.1 13.8l4.4 6.3-3.6 5.2Z','#ffdc83');
    if(level>=9)out+=path('M50 110.1l12.3 5.1-1.3 3.6-12-4.6ZM93.4 116.1l10.4-3.5-.3 3.5-10.4 3.6Z','#e0bd72',metalOutline,.75)+
      path('M74.1 108.7l3.5-2.6 3.4 2.5-3.3 4.3Z','#4caba6',metalOutline,.75);
    if(level>=10)for(const x of [39,117])out+=path(`M${x-4.6} 40.3l4.5-8.4 4.3 8.2-4.5 3.3Z`,'#56a3a0',metalOutline,.8)+
      path(`M${x-4} 40.1l3.9-7.4.5 8.2Z`,'#aad6b7');
    return out;
  }

  const berrySpots=[
    [67,92],[85,87],[53,88],[95,92],[75,97],[101,83],[60,81],[80,79],[91,99],
    [45,84],[68,76],[106,91],[54,97],[85,96],[96,77],[72,85],[103,84],[62,91]
  ];
  function harvest(fill){
    if(!fill)return '';
    const capacity=berrySpots.length*4,total=fill===1?capacity:Math.ceil(fill*(capacity-1));
    let out='';
    for(let layer=0;layer<4;layer++){
      const count=Math.min(berrySpots.length,Math.max(0,total-layer*berrySpots.length));
      const fruit=berrySpots.slice(0,count).map(([x,y],j)=>({x:x+(layer%2?1.7:0),y:y-layer*5.3,j})).sort((a,b)=>a.y-b.y);
      for(const {x,y,j} of fruit){
        out+=use((j+layer)%5?'opStoreFruit':'opStorePlumFruit',x,y,1.02+(j%3)*.10);
        if((j+layer)%7===0)out+=use('opStoreSprig',x+.5,y-4.6,.71);
      }
    }
    return out;
  }
  function granary(level,fill){
    let out=foodDefs+foot(true);
    // Shingled rain cover shelters the rear of the store, keeping the fruit visible at the front.
    out+=path('M39 49l5-2 3 56-5 2ZM98 30l5 .7v58l-5-.4Z','url(#opStoreWood)',woodOutline,1.1)+
      '<g transform="translate(-1 -10)">'+path('M32 58Q48 49 75 34l16.4 1.5 14.6 10-28.2 6.2-32 19-12.9-4Z','#47785d','#42523b',1.4)+
      path('M31.3 58.1Q54.1 44.5 75 32.7l15.2 1.7-28.4 16.4-16.5 13.4Z','#91ae6a','#526b48',1)+
      path('M45.2 64.1l16.4-13.8 28.6-16.1 16 10.5-26.9 8.8-32.9 18.1Z','url(#opStoreLeaves)','#466f54',1)+
      line('M48 63.2l16-12.6 25-14.5M51.1 66.4l29.2-16.3 18.9-7.2','#bad18b',1.05)+
      line('M45 51.2l9.1 3.7 4 6.5m3.3-20.5 10.2 3.7 4.8 6.6m-.8-17.2 9.6 3.8 6.4 7.5','#638660',1.15)+
      path('M31.6 57.9l13.6 5.9 1.5 7.3-14.2-6.4Z','#63875d','#536648',.8)+
      path('M46.3 69.3l32.7-17.5 26.8-8.7-.1 3.3-25.2 9.1L46.7 74Z','#6a6242','#536244',.85)+
      line('M49.1 67.6l.5 2.8m8.2-7.4.8 2.1m7.5-6.5.7 2.4m8.1-7.4.7 2.3m9.1-6.1.3 2.1m9.4-5.4.7 2.0','#d3ca82',1.3)+'</g>';
    if(level>=4)out+=path('M72.5 22.4l2.1-3.8 16.4 1.5 3.5 4-6.3 1.8Z','#c6894c',woodOutline,.95);
    if(level>=8)out+=path('M78 21l1.2-10.3 2.5-.2-.9 10.6Z','#a57a49',woodOutline,.8)+
      path('M81.2 11q5-3 10.4-1l-2.9 2.1 3.1 2.2q-5.5-1.7-11 .8Z','#c75d58','#804b48',.68);
    out+=path('M28 75l31-20.9 21-5.1 24.7 4.9 22.8 14.3 5.6 8.6-6.5 26.5L84 124l-39.6-12-13.9-15.8Z','url(#opStoreWood)',woodOutline,1.4)+
      path('M32 76l27-17.8 21-5.4 22.3 4.8 22.4 13-1.6 19.3L85 112.5 45.2 98Z','#65523c',woodOutline,.9)+
      path('M33.2 80.4l28.5-15.6 17.6-3.7L104 67l18.1 11.4-2.1 14.7-36.4 18.2L47.4 99Z','#85704a')+
      line('M45 80l24-10 28 5m-45 11 20-9 37 9m-46 8 22-7.5 17.2 4.8','#a38b5b',1.15)+
      path('M27 73l30.1-20 21.2-5 26.4 4.7 25 15.7 3.4 6.2-4 2.8-3.4-6.1L102.8 57l-23.5-4.1-20.2 5.4-28.9 18.8Z','url(#opStoreWeave)',woodOutline,1)+
      line('M28.9 73.1l29.3-19.2 20.4-4.7 25.2 4.5L127.1 68','#f0cf83',1.3)+harvest(fill);
    out+=path('M26.9 73l4-1.3 12.8 19.4 24.2 10.4 17.6 3.7 18.6-7.2 23.2-16.2 2.8-10.1 3 2.4-2.6 12.5-24.4 17.6-20.3 7.8-19.2-4-25.3-12.6Z','url(#opStoreWeave)',woodOutline,1.15)+
      path('M32.8 91.7l9.7 9.8 23.5 10.4 20 4 18-6.5 23.6-15.6-.9 6.2-22.2 15.8-18.5 7.4-22.3-5.1-23-11.6-7.8-9Z','url(#opStoreWood)',woodOutline,.95)+
      line('M36 96.3l6.3 7 23 10.7 20 4.7 18.8-7 21.3-14.3','#dfb574',1.3);
    for(const [x,y,h] of [[35,86,12],[48,97,13],[61,102,14],[73,106,13],[88,109,12],[101,103,12],[114,95,12],[125,87,11]]){
      out+=path(`M${x-1.4} ${y}l3-.8-.2 ${h} -3.15 1.2Z`,'#bd945a','#775739',.6);
    }
    out+=path('M66.8 100.5l14.4 4.3 1.1 7.6-15-3.5Z','#dcc89c','#866847',.8)+
      line('M70.1 104l7.5 2.0','#957649',.9);
    if(level>=2)out+=line('M43 98.4l21.3 9.8m41.7-4.6 20-14.1','#62816d',2.1);
    if(level>=3)out+=path('M39 62l4.5-3.2 2.4 3.9-4.4 2.8Zm52-25.6l4-1.9 3.9 3-4.2 1.8Z','#e7c476',woodOutline,.6);
    if(level>=5)out+=path('M26 87q5.3-3.5 12.3 1.6l.6 9.7-3.9 4.6-8.6-3.1Z','url(#opStoreWeave)',woodOutline,1)+
      oval(32.1,87.6,6.3,2.4,'#725239')+line('M27.1 92.2l9.7 2m-9.6 1 9 2.3','#ecbd71',1)+
      (fill>.72?use('opStoreFruit',31.3,85.9,.68)+use('opStoreSprig',32.4,84.3,.48):'')+
      line('M45 107l17 8m46-3.2 16-10.6','#e2c680',1.8);
    if(level>=6)out+=path('M122 66l3.1-2 3.7 2.3-.3 12.4-4 2.6-2.4-2.2Z','#78a38a',woodOutline,.8);
    if(level>=7)out+=line('M32 59l11.4 4.8M61 41.9l9.7 3.7','#f1d990',1.8);
    if(level>=9)out+=path('M45 58.4l14-11 2.9 2.6-16 13.1Z','#cb995c',woodOutline,.65)+
      path('M82.4 37.8l11.3-5.2 7 3.3-12 4.8Z','#cfaa64',woodOutline,.65);
    if(level>=10)out+=path('M104.9 52.1l4.9-5.3 4.8 4.4-.6 6.7-4.8 3.7-4.1-3.8Z','#80a982',woodOutline,.85)+
      path('M106.8 51.4l3-3.1 2.9 2.9-3.1 2.7Z','#d5dc9a')+
      line('M46.2 111.3l12.4 5.7m51.2-3.3 11.8-8.4','#78a18a',1.9);
    return out;
  }
  window.OplotStoreSVG=(type,level=1,fill=0)=>{
    const amount=Math.max(0,Math.min(1,Number(fill)||0)),tier=Math.max(1,Math.floor(Number(level)||1));
    const art=type==='goldstore'?treasury(tier,amount):type==='foodstore'?granary(tier,amount):'';
    return art?`<g stroke-linecap="round" stroke-linejoin="round">${art}</g>`:'';
  };
})();
