-- The single-cell rules remain executable for existing saves and read-only replays.
alter function oplot.simulate_raid(jsonb,int,date,text,jsonb) rename to simulate_classic_raid;

create function oplot.raid_span(kind text) returns int language sql immutable set search_path='' as $$
  select case when kind='keep' then 5 when kind in ('goldstore','foodstore','den','academy') then 4
    when kind in ('archer','cannon','home','farm','mine') then 3 when kind='spire' then 2
    when kind in ('firetrap','icetrap','wall') then 1 end
$$;

create function oplot.raid_axis(old_axis int) returns int language sql immutable set search_path='' as $$
  select (array[35,38,42,45,48,52,55])[greatest(10,least(16,old_axis))-9]
$$;
create function oplot.raid_lane(pos int,old_axis int,new_axis int) returns int language sql immutable set search_path='' as $$
  select greatest(0,least(new_axis-1,floor((pos+.5)*new_axis/greatest(1,old_axis))::int))
$$;

-- A unit can attack the nearest occupied cell on any side of the building.
create function oplot.raid_edge(a oplot.raid_actor,b oplot.raid_actor,span int)
returns oplot.raid_actor language plpgsql immutable set search_path='' as $$
begin
  b.x:=greatest(b.x,least(a.x,b.x+span-1)); b.y:=greatest(b.y,least(a.y,b.y+span-1)); return b;
end $$;
create function oplot.raid_rect_distance(a oplot.raid_actor,b oplot.raid_actor,span int)
returns int language sql immutable set search_path='' as $$
  select greatest(0,b.x-a.x,a.x-b.x-span+1)+greatest(0,b.y-a.y,a.y-b.y-span+1)
$$;

-- Each stride inspects both crossed cells. Stop at a ground trap or the first
-- intact wall even if a dragon could have finished the turn beyond it.
create type oplot.raid_stride as (actor oplot.raid_actor, gate int, trap int);
create function oplot.raid_step2(a oplot.raid_actor,goal oplot.raid_actor,blocked int[],traps int[],width int,guarding boolean)
returns oplot.raid_stride language plpgsql immutable set search_path='' as $$
declare dest oplot.raid_actor; slot int:=1+a.x+width*a.y; steps int;
begin
  -- blocked[slot] is 0 for open ground, -1 for a standing building and the
  -- positive actor index for an intact wall. Traps occupy a separate array.
  if not a.flying and not guarding and blocked[slot]>0 then return row(a,blocked[slot],0)::oplot.raid_stride; end if;
  for steps in 1..2 loop
    exit when (a.x,a.y)=(goal.x,goal.y);
    dest:=oplot.raid_move(a,goal);slot:=1+dest.x+width*dest.y;
    if not a.flying then
      if guarding and blocked[slot]<>0 then
        if dest.x<>a.x then dest.x:=a.x;dest.y:=a.y+sign(goal.y-a.y);
        else dest.y:=a.y;dest.x:=a.x+sign(goal.x-a.x);end if;
        slot:=1+dest.x+width*dest.y;
        exit when (dest.x,dest.y)=(a.x,a.y) or blocked[slot]<>0;
      elsif not guarding and blocked[slot]>0 then return row(a,blocked[slot],0)::oplot.raid_stride;
      end if;
    end if;
    a:=dest;
    if not a.flying and not guarding and traps[slot]>0 then return row(a,0,traps[slot])::oplot.raid_stride;end if;
  end loop;
  return row(a,0,0)::oplot.raid_stride;
end $$;

-- Snapshots keep top-left anchors and footprint sizes. Only event coordinates
-- are converted to centre points for aiming and replaying hits.
create function oplot.raid_grid_event(tick int,kind text,a oplot.raid_actor,b oplot.raid_actor,amount int,narrative text)
returns jsonb language sql immutable set search_path='' as $$
  select oplot.raid_event(tick,kind,a,b,amount,narrative)||jsonb_build_object(
    'from',jsonb_build_array(a.x+(coalesce(oplot.raid_span(a.type),1)-1)*.5,a.y+(coalesce(oplot.raid_span(a.type),1)-1)*.5),
    'to',jsonb_build_array(b.x+(coalesce(oplot.raid_span(b.type),1)-1)*.5,b.y+(coalesce(oplot.raid_span(b.type),1)-1)*.5))
$$;
create function oplot.raid_melee_clear(a oplot.raid_actor,b oplot.raid_actor,blocked int[],width int) returns boolean
language sql immutable set search_path='' as $$
  select a.flying or (blocked[1+a.x+width*a.y]<=0 and case
    when abs(a.x-b.x)+abs(a.y-b.y)<=1 then true
    when a.x=b.x or a.y=b.y then blocked[1+(a.x+b.x)/2+width*((a.y+b.y)/2)]<=0
    else blocked[1+a.x+width*b.y]<=0 or blocked[1+b.x+width*a.y]<=0 end)
$$;

create function oplot.simulate_grid_raid(s jsonb, wave int, raid_day date, who text, formation jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
  growth int:=oplot.raid_grid_growth(s);
  grid_width int:=oplot.raid_axis(10+(growth+1)/2); grid_height int:=oplot.raid_axis(10+growth/2);
  last_x int:=grid_width-1; last_y int:=grid_height-1;
  blocked int[]:=array_fill(0,array[grid_width*grid_height]); traps int[]:=array_fill(0,array[grid_width*grid_height]);
  tower_ids int[]:='{}'; goal_ids int[]:='{}'; spire_ids int[]:='{}'; xx int; yy int; actor_index int;
  -- Allow the extra travel across the larger island at two steps per turn,
  -- leaving the existing time budget for fighting once the invaders arrive.
  max_ticks int:=45+(grid_width+grid_height-2*(20+growth)+1)/2;
  original_width int;original_height int;
  buildings oplot.raid_actor[]:='{}'; guards oplot.raid_actor[]:='{}'; raiders oplot.raid_actor[]:='{}';
  a oplot.raid_actor; b oplot.raid_actor; g oplot.raid_actor; dest oplot.raid_actor;
  snapshot jsonb; events jsonb[]:='{}'; v jsonb; k text; distinct_seed int;
  -- Archived v1 raiders only used their base strike. Preserve that balance for
  -- a fair comparison with their original score; v2 raiders also charge an ultimate.
  raider_spells boolean:=formation is null or coalesce((formation->>'v')::int,1)>=2;
  specialties text[]:='{}'; raider_hits int[]:='{}'; cast_now boolean; bonus int; event jsonb;
  i int; j int; h int; tick int:=0; ticks int:=0; target int; distance int; nearest int;
  base_hp int; amount int; guard_target int; gate int; lvl int; rank int; spell int; keep_x int:=4; keep_y int:=4;
  side int; edge int; span int; route oplot.raid_stride; goal oplot.raid_actor; start_cell record; goals int:=0; destroyed int:=0; keep_down boolean:=false; stars int; reach int;
begin
  distinct_seed:=oplot.raid_seed(who,raid_day);
  for v in select value from jsonb_array_elements(oplot.arr(s->'buildings')) where (value->'stowed') is distinct from 'true'::jsonb limit (grid_width*grid_height) loop
    k:=v->>'type';
    span:=oplot.raid_span(k);
    if span is null then continue; end if;
    lvl:=oplot.raid_int(v->>'level',1,100);
    base_hp:=case k when 'keep' then 112 when 'goldstore' then 70 when 'foodstore' then 62 when 'academy' then 84
      when 'wall' then 35 when 'archer' then 40 when 'cannon' then 45 when 'spire' then 48
      when 'mine' then 31 when 'farm' then 28 when 'home' then 35 when 'den' then 38 else 7 end;
    b:=row(coalesce(v->>'id','b'||cardinality(buildings)),k,null,lvl,
      oplot.raid_int(v->>'x',0,grid_width-span),oplot.raid_int(v->>'y',0,grid_height-span),ceil(base_hp*(0.76+lvl*0.24))::int,
      case k when 'archer' then 6+4*lvl when 'cannon' then 10+6*lvl when 'spire' then 7+5*lvl
        when 'firetrap' then 18+10*lvl else 0 end,null,null,0)::oplot.raid_actor;
    buildings:=array_append(buildings,b);actor_index:=cardinality(buildings);
    if k in ('archer','cannon','spire') then tower_ids:=array_append(tower_ids,actor_index);end if;
    if k='spire' then spire_ids:=array_append(spire_ids,actor_index);end if;
    if k in ('firetrap','icetrap') then traps[1+b.x+grid_width*b.y]:=actor_index;
    else
      for yy in b.y..b.y+span-1 loop
        for xx in b.x..b.x+span-1 loop blocked[1+xx+grid_width*yy]:=case when k='wall' then actor_index else -1 end;end loop;
      end loop;
      if k<>'wall' then goal_ids:=array_append(goal_ids,actor_index);end if;
    end if;

    if k='keep' then keep_x:=b.x+span/2; keep_y:=b.y+span/2; end if;
    if k not in ('wall','icetrap','firetrap') then goals:=goals+1; end if;
  end loop;

  for v in select d from jsonb_array_elements(oplot.arr(s->'dragons')) d
    where jsonb_typeof(d)='object'
    order by oplot.guard_power(d) desc, d->>'id'
    limit 4 loop
    lvl:=oplot.raid_int(v->>'level',1,100); rank:=oplot.raid_rank(oplot.raid_int(v->>'species',0,62));
    spell:=oplot.raid_int(v->>'enchant',0,5);
    j:=cardinality(guards);
    g:=row(coalesce(v->>'id','g'||j),'guard',oplot.raid_int(v->>'species',0,62),lvl,
      greatest(0,least(last_x,keep_x+(array[0,-3,3,0])[j+1])),
      greatest(0,least(last_y,keep_y+(array[-3,0,0,3])[j+1])),
      round((55+7*lvl)*(array[1,1.19,1.42,1.70])[rank])::int,
      round((7+1.45*lvl)*(array[1,1.23,1.49,1.81])[rank])::int,lvl>20,spell,0)::oplot.raid_actor;
    if not g.flying and blocked[1+g.x+grid_width*g.y]<>0 then
      select cx,cy into start_cell from generate_series(0,last_x) as px(cx) cross join generate_series(0,last_y) as py(cy)
        where blocked[1+cx+grid_width*cy]=0
        order by abs(cx-g.x)+abs(cy-g.y),cy,cx limit 1;
      if found then g.x:=start_cell.cx;g.y:=start_cell.cy; end if;
    end if;
    guards:=array_append(guards,g);
    specialties:=array_append(specialties,case when v->>'specialty' in ('focus','area') then v->>'specialty' end);
  end loop;

  side:=coalesce((formation->>'entrySide')::int,distinct_seed%4);
  if formation is null then
    for i in 1..least(7,2+wave/3) loop
      edge:=greatest(0,least((case when side%2=0 then last_y else last_x end),
        (case when side%2=0 then keep_y else keep_x end) + 2*(((i-1)%3) - least(1,i-1)*2)));
      lvl:=least(100,2+wave*2+(i-1)%3);
      a:=row('a'||i,'raider',(distinct_seed+i*3)%63,lvl,
        case side when 0 then 0 when 2 then last_x else edge end,
        case side when 1 then 0 when 3 then last_y else edge end,
        24+lvl*5+wave*4,5+lvl*2+wave,lvl>20,0,0)::oplot.raid_actor;
      raiders:=array_append(raiders,a);
    end loop;
  else
    -- Keep the same lane fraction when an old night is replayed on larger or smaller terrain.
    original_width:=oplot.raid_int(coalesce(formation->>'gridWidth',formation->>'gridSize',
      case when formation->>'layoutVersion'='2' then grid_width::text else '10' end),1,55);
    original_height:=oplot.raid_int(coalesce(formation->>'gridHeight',formation->>'gridSize',
      case when formation->>'layoutVersion'='2' then grid_height::text else '10' end),1,55);
    for v in select value from jsonb_array_elements(formation->'attackers') loop
      a:=jsonb_populate_record(null::oplot.raid_actor,v); a.wait_until:=0;
      a.x:=oplot.raid_lane(a.x,original_width,grid_width); a.y:=oplot.raid_lane(a.y,original_height,grid_height);
      a.x:=case side when 0 then 0 when 2 then last_x else least(last_x,greatest(0,a.x)) end;
      a.y:=case side when 1 then 0 when 3 then last_y else least(last_y,greatest(0,a.y)) end;
      raiders:=array_append(raiders,a);
    end loop;
  end if;
  raider_hits:=array_fill(0,array[cardinality(raiders)]);
  snapshot:=jsonb_build_object('layoutVersion',2,'entrySide',side,'gridSize',grid_width,'gridWidth',grid_width,'gridHeight',grid_height,
    'buildings',coalesce((select jsonb_agg(oplot.raid_actor_json(b0)||jsonb_build_object('span',oplot.raid_span(b0.type))) from unnest(buildings) b0),'[]'),
    'defenders',coalesce((select jsonb_agg(oplot.raid_actor_json(guards[n]) ||
      jsonb_strip_nulls(jsonb_build_object('specialty',specialties[n])) order by n)
      from generate_subscripts(guards,1) n),'[]'),
    'attackers',(select jsonb_agg(oplot.raid_actor_json(a0)) from unnest(raiders) a0));
  for tick in 1..max_ticks loop
    ticks:=tick;
    exit when destroyed>=goals or not exists(select from unnest(raiders) e where e.hp>0);
    -- Tower shots precede movement. Cannons splash ground groups, spires and archers reach airborne units.
    foreach i in array tower_ids loop
      b:=buildings[i];
      if b.hp<=0 then continue; end if;
      if b.type='cannon' and tick%2=0 then continue; end if;
      reach:=2*least(7,(case when b.type='archer' then 4 else 3 end)+b.level/3);
      nearest:=reach+1; target:=0;
      for j in 1..cardinality(raiders) loop
        a:=raiders[j]; distance:=oplot.raid_rect_distance(a,b,oplot.raid_span(b.type));
        if a.hp>0 and distance<nearest and (b.type<>'cannon' or not a.flying) then target:=j; nearest:=distance; end if;
      end loop;
      if target=0 then continue; end if;
      dest:=raiders[target];
      for j in 1..cardinality(raiders) loop
        a:=raiders[j];
        if a.hp<=0 or (j<>target and (b.type<>'cannon' or a.flying or oplot.raid_distance(a,dest)>2)) then continue; end if;
        amount:=case when j=target then b.damage else (b.damage+1)/2 end;
        a.hp:=greatest(0,a.hp-amount); raiders[j]:=a;
        events:=array_append(events,oplot.raid_grid_event(tick,'tower',b,a,amount,'Выстрел башни'));
        if a.hp=0 then events:=array_append(events,oplot.raid_grid_event(tick,'fall',b,a,0,'Налётчик выбыл')); end if;
      end loop;
    end loop;
    for i in 1..cardinality(guards) loop
      g:=guards[i]; if g.hp<=0 then continue; end if;
      target:=0; nearest:=grid_width+grid_height;
      for j in 1..cardinality(raiders) loop
        a:=raiders[j]; distance:=oplot.raid_distance(a,g);
        if a.hp>0 and distance<nearest and (g.flying or not a.flying) then nearest:=distance; target:=j; end if;
      end loop;
      if target=0 then continue; end if;
      a:=raiders[target];
      if nearest>2 or not oplot.raid_melee_clear(g,a,blocked,grid_width) then
        route:=oplot.raid_step2(g,a,blocked,traps,grid_width,true);dest:=route.actor;
        if (dest.x,dest.y)=(g.x,g.y) then continue; end if;
        events:=array_append(events,oplot.raid_grid_event(tick,'move',g,dest,0,'Защитник сближается')); guards[i]:=dest;
      else
        g.wait_until:=g.wait_until+1; guards[i]:=g;
        rank:=oplot.raid_rank(g.species);
        cast_now:=g.wait_until%(case when rank<3 then 4 else 3 end)=0;
        amount:=g.damage;
        if cast_now then
          amount:=amount+round(g.damage*(.52+.035*(rank-1))*(1+.18*g.enchant));
          if specialties[i]='focus' then amount:=amount+round(.40*g.damage*(1+.18*g.enchant)); end if;
          if exists(select from unnest(spire_ids) idx where (buildings[idx]).hp>0 and oplot.raid_rect_distance(g,buildings[idx],2)<=4) then amount:=amount+5; end if;
        end if;
        a.hp:=greatest(0,a.hp-amount); raiders[target]:=a;
        event:=oplot.raid_grid_event(tick,'guard',g,a,amount,
          case when cast_now then 'Защитник применил ульту' else 'Защитник атакует' end);
        events:=array_append(events,event||jsonb_build_object('ultimate',cast_now));
        if a.hp=0 then events:=array_append(events,oplot.raid_grid_event(tick,'fall',g,a,0,'Налётчик выбыл')); end if;
        if cast_now and specialties[i]='area' then
          bonus:=round(.55*g.damage*(1+.18*g.enchant));
          for h in select n from generate_subscripts(raiders,1) n
            where n<>target and (raiders[n]).hp>0 and (g.flying or not (raiders[n]).flying)
            and (((raiders[n]).x-a.x)^2+((raiders[n]).y-a.y)^2)<=4.5^2
            order by (((raiders[n]).x-a.x)^2+((raiders[n]).y-a.y)^2),n limit 2 loop
            dest:=raiders[h]; dest.hp:=greatest(0,dest.hp-bonus); raiders[h]:=dest;
            event:=oplot.raid_grid_event(tick,'guard',g,dest,bonus,'Размах задевает соседнего налётчика');
            events:=array_append(events,event||'{"ultimate":true,"secondary":true}'::jsonb);
            if dest.hp=0 then events:=array_append(events,oplot.raid_grid_event(tick,'fall',g,dest,0,'Налётчик выбыл')); end if;
          end loop;
        end if;
      end if;
    end loop;
    for i in 1..cardinality(raiders) loop
      a:=raiders[i]; if a.hp<=0 or a.wait_until>=tick then continue; end if;
      guard_target:=0;
      for j in 1..cardinality(guards) loop
        g:=guards[j];
        if g.hp>0 and oplot.raid_distance(a,g)<=2 and (a.flying or not g.flying) and oplot.raid_melee_clear(a,g,blocked,grid_width) then guard_target:=j; exit; end if;
      end loop;
      -- One charge per landed strike; a move, a wait or a trap never charges a cast.
      rank:=oplot.raid_rank(a.species);
      cast_now:=raider_spells and (raider_hits[i]+1)%(case when rank<3 then 4 else 3 end)=0;
      amount:=a.damage+case when cast_now then round(a.damage*(.52+.035*(rank-1)))::int else 0 end;
      if guard_target>0 then
        g:=guards[guard_target]; g.hp:=greatest(0,g.hp-amount); guards[guard_target]:=g;
        raider_hits[i]:=raider_hits[i]+1;
        event:=oplot.raid_grid_event(tick,'strike',a,g,amount,case when cast_now then 'Налётчик применил ульту' else 'Налётчик атакует защитника' end);
        events:=array_append(events,event||jsonb_build_object('ultimate',cast_now));
        if g.hp=0 then events:=array_append(events,oplot.raid_grid_event(tick,'fall',a,g,0,'Защитник выбыл')); end if;
        continue;
      end if;
      target:=0; nearest:=grid_width+grid_height;
      foreach j in array goal_ids loop
        b:=buildings[j];if b.hp<=0 then continue;end if;
        distance:=oplot.raid_rect_distance(a,b,oplot.raid_span(b.type));
        if distance<nearest then target:=j; nearest:=distance; end if;
      end loop;
      if target=0 then continue; end if;
      b:=buildings[target];
      goal:=oplot.raid_edge(a,b,oplot.raid_span(b.type));
      if nearest<=2 and oplot.raid_melee_clear(a,goal,blocked,grid_width) then
        b.hp:=greatest(0,b.hp-amount); buildings[target]:=b;
        raider_hits[i]:=raider_hits[i]+1;
        event:=oplot.raid_grid_event(tick,'strike',a,b,amount,case when cast_now then 'Налётчик применил ульту' else 'Удар по постройке' end);
        events:=array_append(events,event||jsonb_build_object('ultimate',cast_now));
        if b.hp=0 then
          destroyed:=destroyed+1; keep_down:=keep_down or b.type='keep';span:=oplot.raid_span(b.type);
          for yy in b.y..b.y+span-1 loop for xx in b.x..b.x+span-1 loop blocked[1+xx+grid_width*yy]:=0;end loop;end loop;
          events:=array_append(events,oplot.raid_grid_event(tick,'destroy',a,b,0,'Постройка разрушена'));
        end if;
        continue;
      end if;
      route:=oplot.raid_step2(a,goal,blocked,traps,grid_width,false);dest:=route.actor;gate:=route.gate;
      if (dest.x,dest.y)<>(a.x,a.y) then
        events:=array_append(events,oplot.raid_grid_event(tick,'move',a,dest,0,case when a.flying then 'Налётчик летит' else 'Налётчик наступает' end));
        a:=dest;raiders[i]:=a;
      end if;
      if gate>0 then
        b:=buildings[gate]; b.hp:=greatest(0,b.hp-amount); buildings[gate]:=b;
        raider_hits[i]:=raider_hits[i]+1;
        event:=oplot.raid_grid_event(tick,'wall',a,b,amount,case when cast_now then 'Налётчик применил ульту' else 'Налётчик пробивает стену' end);
        events:=array_append(events,event||jsonb_build_object('ultimate',cast_now));
        if b.hp=0 then blocked[1+b.x+grid_width*b.y]:=0;events:=array_append(events,oplot.raid_grid_event(tick,'destroy',a,b,0,'В стене открылась брешь')); end if;
        continue;
      end if;
      if route.trap>0 then
        j:=route.trap;b:=buildings[j];traps[1+b.x+grid_width*b.y]:=0;
        b.hp:=0; buildings[j]:=b;
        for h in 1..cardinality(raiders) loop
          a:=raiders[h]; if a.hp<=0 or a.flying or oplot.raid_distance(a,b)>2 then continue; end if;
          a.hp:=greatest(0,a.hp-b.damage);
          if b.type='icetrap' then a.wait_until:=greatest(a.wait_until,tick+least(5,1+b.level)); end if;
          raiders[h]:=a;
          events:=array_append(events,oplot.raid_grid_event(tick,'trap',b,a,b.damage,case when b.type='icetrap' then 'Ловушка замедлила налётчика' else 'Вспыхнула огненная руна' end));
          if a.hp=0 then events:=array_append(events,oplot.raid_grid_event(tick,'fall',b,a,0,'Налётчик выбыл')); end if;
        end loop;
      end if;
    end loop;
  end loop;
  stars:=(goals>0 and 2*destroyed>=goals)::int+keep_down::int+(goals>0 and destroyed=goals)::int;
  events:=array_append(events,jsonb_build_object('t',ticks,'kind','end','id','','target','',
    'from',jsonb_build_array(keep_x,keep_y),'to',jsonb_build_array(keep_x,keep_y),'amount',stars,'text','Ночной рейд завершён'));
  return jsonb_build_object('stars',stars,'replay',snapshot||jsonb_build_object('v',3,'events',to_jsonb(events),'duration',ticks));
end $$;

create function oplot.valid_grid_layout(s jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare growth int:=oplot.raid_grid_growth(s); width int:=oplot.raid_axis(10+(growth+1)/2); height int:=oplot.raid_axis(10+growth/2);
  taken boolean[]:=array_fill(false,array[width*height]); v jsonb; span int; x int;y int; col int; row_no int; keep_count int:=0;
begin
  if jsonb_typeof(s->'buildings') is distinct from 'array' then return false; end if;
  if exists(select from jsonb_array_elements(s->'buildings') b group by b->>'id'
     having count(*)>1 or nullif(b->>'id','') is null) then return false; end if;
  for v in select value from jsonb_array_elements(s->'buildings') loop
    span:=oplot.raid_span(v->>'type'); if span is null then return false; end if;
    if v->'stowed'='true'::jsonb then
      if v->>'type'='keep' or v->>'x' is not null or v->>'y' is not null then return false; end if;
      continue;
    end if;
    if jsonb_typeof(v->'x') is distinct from 'number' or jsonb_typeof(v->'y') is distinct from 'number'
       or v->>'x' !~ '^[0-9]{1,2}$' or v->>'y' !~ '^[0-9]{1,2}$' then return false; end if;
    x:=(v->>'x')::int;y:=(v->>'y')::int;
    if x+span>width or y+span>height then return false; end if;
    if v->>'type'='keep' then keep_count:=keep_count+1; end if;
    for row_no in y..y+span-1 loop
      for col in x..x+span-1 loop
        if taken[1+row_no*width+col] then return false; end if;
        taken[1+row_no*width+col]:=true;
      end loop;
    end loop;
  end loop;
  return keep_count=1;
end $$;

-- Even a generic document write cannot replace the committed base with an
-- overlapping editor draft or downgrade a two-scale island. No rows are backfilled.
create function oplot.check_grid_save() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.data#>>'{state,layoutVersion}'='2' then
    if not oplot.valid_grid_layout(new.data->'state') then
      raise exception 'Расстановка не сохранена: проверь границы, пересечения и цитадель' using errcode='22023'; end if;
  elsif tg_op='UPDATE' and old.data#>>'{state,layoutVersion}'='2' and not old.deleted then
    raise exception 'На острове уже используется новая сетка' using errcode='22023';
  end if;
  return new;
end $$;
create trigger oplot_check_grid_save before insert or update of data on public.ph_docs
  for each row when (not new.deleted and new.path ~ '^data/users/[^/]+/oplot/saves/main$') execute function oplot.check_grid_save();

create function oplot.simulate_raid(s jsonb,wave int,raid_day date,who text,formation jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare ow int;oh int;growth int;
begin
  if s->>'layoutVersion'='2' then return oplot.simulate_grid_raid(s,wave,raid_day,who,formation); end if;
  if formation->>'layoutVersion'='2' then
    growth:=oplot.raid_grid_growth(s);ow:=oplot.raid_int(coalesce(formation->>'gridWidth',formation->>'gridSize','35'),1,55);
    oh:=oplot.raid_int(coalesce(formation->>'gridHeight',formation->>'gridSize','35'),1,55);
    formation:=jsonb_set(formation,'{attackers}',(select jsonb_agg(v||jsonb_build_object('x',oplot.raid_lane((v->>'x')::int,ow,10+(growth+1)/2),'y',oplot.raid_lane((v->>'y')::int,oh,10+growth/2)) order by n)
      from jsonb_array_elements(formation->'attackers') with ordinality e(v,n)));
  end if;
  return oplot.simulate_classic_raid(s,wave,raid_day,who,formation);
end $$;

create or replace function oplot.night_battle(s jsonb,wave int,raid_day date,who text) returns jsonb
language sql immutable set search_path='' as $$select oplot.simulate_raid(s,wave,raid_day,who,null)$$;

create or replace function public.ph_oplot_store(p_code text,p_path text,p_data jsonb,p_rev int,p_op text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare who text:=oplot.island_owner(p_code); current_doc jsonb; settled boolean;
begin
  settled:=oplot.settle_island(who,p_path);
  select data into current_doc from public.ph_docs where path=p_path and not deleted;
  if not settled or (current_doc#>>'{state,layoutVersion}'='2' and (p_data#>>'{state,layoutVersion}') is distinct from '2') then
    return jsonb_build_object('ok',false,'cur',current_doc);
  end if;
  return public.ph_set_if(p_code,p_path,p_data,p_rev,p_op);
end $$;

revoke all on function oplot.raid_axis(int),oplot.raid_lane(int,int,int),oplot.raid_span(text),oplot.raid_edge(oplot.raid_actor,oplot.raid_actor,int),
  oplot.raid_rect_distance(oplot.raid_actor,oplot.raid_actor,int),oplot.raid_step2(oplot.raid_actor,oplot.raid_actor,int[],int[],int,boolean),
  oplot.raid_melee_clear(oplot.raid_actor,oplot.raid_actor,int[],int),
  oplot.raid_grid_event(int,text,oplot.raid_actor,oplot.raid_actor,int,text),oplot.valid_grid_layout(jsonb),oplot.check_grid_save(),
  oplot.simulate_classic_raid(jsonb,int,date,text,jsonb),oplot.simulate_grid_raid(jsonb,int,date,text,jsonb),oplot.simulate_raid(jsonb,int,date,text,jsonb)
from public,anon,authenticated;
create or replace function public.ph_oplot_practice(p_code text,p_day date,p_island jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare who text:=oplot.island_owner(p_code); report oplot.raid_reports%rowtype; fight jsonb;
begin
  select * into report from oplot.raid_reports r where r.uid=who and r.day=p_day;
  if not found or jsonb_array_length(oplot.arr(report.replay->'attackers'))=0 then
    raise exception 'Для этого дня нет записи налёта' using errcode='22023';
  end if;
  if jsonb_typeof(p_island) is distinct from 'object' or octet_length(p_island::text)>400000
     or jsonb_typeof(p_island->'buildings') is distinct from 'array'
     or jsonb_typeof(p_island->'dragons') is distinct from 'array' then
    raise exception 'Не удалось прочитать расстановку острова' using errcode='22023';
  end if;
  if (case when p_island->>'layoutVersion'='2' then not oplot.valid_grid_layout(p_island) else jsonb_array_length(p_island->'buildings') not between 1 and 256 end)
     or jsonb_array_length(p_island->'dragons')>512
     or not exists(select from jsonb_array_elements(p_island->'buildings') b where b->>'type'='keep') then
    raise exception 'Нужна расстановка острова с цитаделью' using errcode='22023';
  end if;
  fight:=oplot.simulate_raid(p_island,(report.summary->>'wave')::int,report.day,who,report.replay);
  return jsonb_build_object('day',report.day,'wave',report.summary->'wave','originalStars',report.summary->'stars')||fight;
end $$;

create or replace function oplot.night_loot(s jsonb, at_time timestamptz, stars int) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
  pct int:=(array[0,25,50,80])[stars+1]; instant numeric:=floor(extract(epoch from at_time)*1000);
  gold numeric:=greatest(0,coalesce(oplot.num(s->>'gold'),0));
  berries numeric:=greatest(0,coalesce(oplot.num(s->>'berries'),0));
  total_gold numeric:=gold; total_berries numeric:=berries; prior numeric;
  buildings jsonb[]:='{}'; v jsonb; k text; lvl int; rate numeric; since_ms numeric;
  raw numeric; ready numeric; lost numeric; gold_lost numeric; berries_lost numeric; paused boolean;
begin
  if pct is null then raise exception 'invalid raid stars'; end if;
  for v in select value from jsonb_array_elements(oplot.arr(s->'buildings')) loop
    paused:=coalesce(s->>'layoutVersion'='2' and v->'stowed'='true'::jsonb,false);
    k:=v->>'type'; lvl:=oplot.raid_int(v->>'level',1,100);
    rate:=lvl*(case k when 'mine' then 0.0008 when 'farm' then 0.0006 when 'home' then 0.00017 else 0 end);
    since_ms:=oplot.num(v->>'since');
    if rate>0 and (paused or since_ms is not null) then
      raw:=least(90*lvl,greatest(0,case when paused then floor(coalesce(oplot.num(v->>'pausedStock'),0)) else (instant-since_ms)*rate end));
      ready:=floor(raw);
      if k='farm' then prior:=total_berries; total_berries:=total_berries+ready;
      else prior:=total_gold; total_gold:=total_gold+ready; end if;
      lost:=floor((prior+ready)*pct/100)-floor(prior*pct/100);
      if lost>0 then
        if paused then v:=jsonb_set(v,'{pausedStock}',to_jsonb(raw-lost));
        else v:=jsonb_set(v,'{since}',to_jsonb(floor(instant-(raw-lost)/rate))); end if;
      end if;
    end if;
    buildings:=array_append(buildings,v);
  end loop;
  gold_lost:=floor(total_gold*pct/100); berries_lost:=floor(total_berries*pct/100);
  if pct>0 then
    s:=s||jsonb_build_object('gold',gold-floor(gold*pct/100),'berries',berries-floor(berries*pct/100),
      'buildings',to_jsonb(buildings));
  end if;
  return jsonb_build_object('state',s,'goldLost',gold_lost,'berriesLost',berries_lost,'percent',pct);
end $$;
