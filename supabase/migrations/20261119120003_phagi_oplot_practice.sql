-- Both scouting and combat use the same seed as the original deployed raids.
create function oplot.raid_seed(who text, raid_day date) returns int language sql immutable set search_path='' set datestyle='ISO, YMD' as $$
  select mod(abs(hashtext(who||'/'||raid_day::text)::bigint),997)::int
$$;

-- A normal raid generates its roster; a rematch passes the archived roster.
create function oplot.simulate_raid(s jsonb, wave int, raid_day date, who text, formation jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
  growth int:=oplot.raid_grid_growth(s);
  grid_width int:=10+(growth+1)/2; grid_height int:=10+growth/2;
  last_x int:=grid_width-1; last_y int:=grid_height-1;
  buildings oplot.raid_actor[]:='{}'; guards oplot.raid_actor[]:='{}'; raiders oplot.raid_actor[]:='{}';
  a oplot.raid_actor; b oplot.raid_actor; g oplot.raid_actor; dest oplot.raid_actor;
  snapshot jsonb; events jsonb[]:='{}'; v jsonb; k text; distinct_seed int;
  -- Archived v1 raiders only used their base strike. Preserve that balance for
  -- a fair comparison with their original score; v2 raiders also charge an ultimate.
  raider_spells boolean:=formation is null or coalesce((formation->>'v')::int,1)>=2;
  specialties text[]:='{}'; raider_hits int[]:='{}'; cast_now boolean; bonus int; event jsonb;
  i int; j int; h int; tick int:=0; ticks int:=0; target int; distance int; nearest int;
  base_hp int; amount int; guard_target int; gate int; lvl int; rank int; spell int; keep_x int:=4; keep_y int:=4;
  side int; edge int; goals int:=0; destroyed int:=0; keep_down boolean:=false; stars int; reach int;
begin
  distinct_seed:=oplot.raid_seed(who,raid_day);
  for v in select value from jsonb_array_elements(oplot.arr(s->'buildings')) limit (grid_width*grid_height) loop
    k:=v->>'type';
    if k is null or k not in ('keep','farm','mine','home','den','archer','cannon','spire','wall','firetrap','icetrap','goldstore','foodstore','academy') then continue; end if;
    lvl:=oplot.raid_int(v->>'level',1,100);
    base_hp:=case k when 'keep' then 112 when 'goldstore' then 70 when 'foodstore' then 62 when 'academy' then 84
      when 'wall' then 35 when 'archer' then 40 when 'cannon' then 45 when 'spire' then 48
      when 'mine' then 31 when 'farm' then 28 when 'home' then 35 when 'den' then 38 else 7 end;
    b:=row(coalesce(v->>'id','b'||cardinality(buildings)),k,null,lvl,
      oplot.raid_int(v->>'x',0,last_x),oplot.raid_int(v->>'y',0,last_y),ceil(base_hp*(0.76+lvl*0.24))::int,
      case k when 'archer' then 6+4*lvl when 'cannon' then 10+6*lvl when 'spire' then 7+5*lvl
        when 'firetrap' then 18+10*lvl else 0 end,null,null,0)::oplot.raid_actor;
    buildings:=array_append(buildings,b);
    if k='keep' then keep_x:=b.x; keep_y:=b.y; end if;
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
      greatest(0,least(last_x,keep_x+(array[0,-1,1,0])[j+1])),
      greatest(0,least(last_y,keep_y+(array[0,0,0,1])[j+1])),
      round((55+7*lvl)*(array[1,1.19,1.42,1.70])[rank])::int,
      round((7+1.45*lvl)*(array[1,1.23,1.49,1.81])[rank])::int,lvl>20,spell,0)::oplot.raid_actor;
    guards:=array_append(guards,g);
    specialties:=array_append(specialties,case when v->>'specialty' in ('focus','area') then v->>'specialty' end);
  end loop;

  side:=coalesce((formation->>'entrySide')::int,distinct_seed%4);
  if formation is null then
    for i in 1..least(7,2+wave/3) loop
      edge:=greatest(0,least((case when side%2=0 then last_y else last_x end),
        (case when side%2=0 then keep_y else keep_x end) + ((i-1)%3) - least(1,i-1)*2));
      lvl:=least(100,2+wave*2+(i-1)%3);
      a:=row('a'||i,'raider',(distinct_seed+i*3)%63,lvl,
        case side when 0 then 0 when 2 then last_x else edge end,
        case side when 1 then 0 when 3 then last_y else edge end,
        24+lvl*5+wave*4,5+lvl*2+wave,lvl>20,0,0)::oplot.raid_actor;
      raiders:=array_append(raiders,a);
    end loop;
  else
    -- Reuse the actual starting roster, including historical stats. If the island
    -- has grown, move only the entry edge out to the new shoreline.
    for v in select value from jsonb_array_elements(formation->'attackers') loop
      a:=jsonb_populate_record(null::oplot.raid_actor,v); a.wait_until:=0;
      a.x:=case side when 0 then 0 when 2 then last_x else least(last_x,greatest(0,a.x)) end;
      a.y:=case side when 1 then 0 when 3 then last_y else least(last_y,greatest(0,a.y)) end;
      raiders:=array_append(raiders,a);
    end loop;
  end if;
  raider_hits:=array_fill(0,array[cardinality(raiders)]);
  snapshot:=jsonb_build_object('entrySide',side,'gridSize',grid_width,'gridWidth',grid_width,'gridHeight',grid_height,
    'buildings',coalesce((select jsonb_agg(oplot.raid_actor_json(b0)) from unnest(buildings) b0),'[]'),
    'defenders',coalesce((select jsonb_agg(oplot.raid_actor_json(guards[n]) ||
      jsonb_strip_nulls(jsonb_build_object('specialty',specialties[n])) order by n)
      from generate_subscripts(guards,1) n),'[]'),
    'attackers',(select jsonb_agg(oplot.raid_actor_json(a0)) from unnest(raiders) a0));
  for tick in 1..45 loop
    ticks:=tick;
    exit when destroyed>=goals or not exists(select from unnest(raiders) e where e.hp>0);
    -- Tower shots precede movement. Cannons splash ground groups, spires and archers reach airborne units.
    for i in 1..cardinality(buildings) loop
      b:=buildings[i];
      if b.hp<=0 or b.type not in ('archer','cannon','spire') then continue; end if;
      if b.type='cannon' and tick%2=0 then continue; end if;
      reach:=least(7,(case when b.type='archer' then 4 else 3 end)+b.level/3);
      nearest:=reach+1; target:=0;
      for j in 1..cardinality(raiders) loop
        a:=raiders[j]; distance:=oplot.raid_distance(a,b);
        if a.hp>0 and distance<nearest and (b.type<>'cannon' or not a.flying) then target:=j; nearest:=distance; end if;
      end loop;
      if target=0 then continue; end if;
      dest:=raiders[target];
      for j in 1..cardinality(raiders) loop
        a:=raiders[j];
        if a.hp<=0 or (j<>target and (b.type<>'cannon' or a.flying or oplot.raid_distance(a,dest)>1)) then continue; end if;
        amount:=case when j=target then b.damage else (b.damage+1)/2 end;
        a.hp:=greatest(0,a.hp-amount); raiders[j]:=a;
        events:=array_append(events,oplot.raid_event(tick,'tower',b,a,amount,'Выстрел башни'));
        if a.hp=0 then events:=array_append(events,oplot.raid_event(tick,'fall',b,a,0,'Налётчик выбыл')); end if;
      end loop;
    end loop;
    for i in 1..cardinality(guards) loop
      g:=guards[i]; if g.hp<=0 then continue; end if;
      target:=0; nearest:=100;
      for j in 1..cardinality(raiders) loop
        a:=raiders[j]; distance:=oplot.raid_distance(a,g);
        if a.hp>0 and distance<nearest and (g.flying or not a.flying) then nearest:=distance; target:=j; end if;
      end loop;
      if target=0 then continue; end if;
      a:=raiders[target];
      if nearest>1 then
        dest:=oplot.raid_move(g,a);
        if not g.flying and exists(select from unnest(buildings) z where z.type='wall' and z.hp>0 and (z.x,z.y)=(dest.x,dest.y)) then continue; end if;
        events:=array_append(events,oplot.raid_event(tick,'move',g,dest,0,'Защитник сближается')); guards[i]:=dest;
      else
        g.wait_until:=g.wait_until+1; guards[i]:=g;
        rank:=oplot.raid_rank(g.species);
        cast_now:=g.wait_until%(case when rank<3 then 4 else 3 end)=0;
        amount:=g.damage;
        if cast_now then
          amount:=amount+round(g.damage*(.52+.035*(rank-1))*(1+.18*g.enchant));
          if specialties[i]='focus' then amount:=amount+round(.40*g.damage*(1+.18*g.enchant)); end if;
          if exists(select from unnest(buildings) z where z.type='spire' and z.hp>0 and oplot.raid_distance(z,g)<=2) then amount:=amount+5; end if;
        end if;
        a.hp:=greatest(0,a.hp-amount); raiders[target]:=a;
        event:=oplot.raid_event(tick,'guard',g,a,amount,
          case when cast_now then 'Защитник применил ульту' else 'Защитник атакует' end);
        events:=array_append(events,event||jsonb_build_object('ultimate',cast_now));
        if a.hp=0 then events:=array_append(events,oplot.raid_event(tick,'fall',g,a,0,'Налётчик выбыл')); end if;
        if cast_now and specialties[i]='area' then
          bonus:=round(.55*g.damage*(1+.18*g.enchant));
          for h in select n from generate_subscripts(raiders,1) n
            where n<>target and (raiders[n]).hp>0 and (g.flying or not (raiders[n]).flying)
            and (((raiders[n]).x-a.x)^2+((raiders[n]).y-a.y)^2)<=2.25^2
            order by (((raiders[n]).x-a.x)^2+((raiders[n]).y-a.y)^2),n limit 2 loop
            dest:=raiders[h]; dest.hp:=greatest(0,dest.hp-bonus); raiders[h]:=dest;
            event:=oplot.raid_event(tick,'guard',g,dest,bonus,'Размах задевает соседнего налётчика');
            events:=array_append(events,event||'{"ultimate":true,"secondary":true}'::jsonb);
            if dest.hp=0 then events:=array_append(events,oplot.raid_event(tick,'fall',g,dest,0,'Налётчик выбыл')); end if;
          end loop;
        end if;
      end if;
    end loop;
    for i in 1..cardinality(raiders) loop
      a:=raiders[i]; if a.hp<=0 or a.wait_until>=tick then continue; end if;
      guard_target:=0;
      for j in 1..cardinality(guards) loop
        g:=guards[j];
        if g.hp>0 and oplot.raid_distance(a,g)<=1 and (a.flying or not g.flying) then guard_target:=j; exit; end if;
      end loop;
      -- One charge per landed strike; a move, a wait or a trap never charges a cast.
      rank:=oplot.raid_rank(a.species);
      cast_now:=raider_spells and (raider_hits[i]+1)%(case when rank<3 then 4 else 3 end)=0;
      amount:=a.damage+case when cast_now then round(a.damage*(.52+.035*(rank-1)))::int else 0 end;
      if guard_target>0 then
        g:=guards[guard_target]; g.hp:=greatest(0,g.hp-amount); guards[guard_target]:=g;
        raider_hits[i]:=raider_hits[i]+1;
        event:=oplot.raid_event(tick,'strike',a,g,amount,case when cast_now then 'Налётчик применил ульту' else 'Налётчик атакует защитника' end);
        events:=array_append(events,event||jsonb_build_object('ultimate',cast_now));
        if g.hp=0 then events:=array_append(events,oplot.raid_event(tick,'fall',a,g,0,'Защитник выбыл')); end if;
        continue;
      end if;
      target:=0; nearest:=100;
      for j in 1..cardinality(buildings) loop
        b:=buildings[j]; distance:=oplot.raid_distance(a,b);
        if b.hp>0 and b.type not in ('wall','icetrap','firetrap') and distance<nearest then target:=j; nearest:=distance; end if;
      end loop;
      if target=0 then continue; end if;
      b:=buildings[target];
      if nearest<=1 then
        b.hp:=greatest(0,b.hp-amount); buildings[target]:=b;
        raider_hits[i]:=raider_hits[i]+1;
        event:=oplot.raid_event(tick,'strike',a,b,amount,case when cast_now then 'Налётчик применил ульту' else 'Удар по постройке' end);
        events:=array_append(events,event||jsonb_build_object('ultimate',cast_now));
        if b.hp=0 then
          destroyed:=destroyed+1; keep_down:=keep_down or b.type='keep';
          events:=array_append(events,oplot.raid_event(tick,'destroy',a,b,0,'Постройка разрушена'));
        end if;
        continue;
      end if;
      dest:=oplot.raid_move(a,b); gate:=0;
      if not a.flying then
        for j in 1..cardinality(buildings) loop
          b:=buildings[j]; if b.type='wall' and b.hp>0 and (b.x,b.y)=(dest.x,dest.y) then gate:=j; exit; end if;
        end loop;
      end if;
      if gate>0 then
        b:=buildings[gate]; b.hp:=greatest(0,b.hp-amount); buildings[gate]:=b;
        raider_hits[i]:=raider_hits[i]+1;
        event:=oplot.raid_event(tick,'wall',a,b,amount,case when cast_now then 'Налётчик применил ульту' else 'Налётчик пробивает стену' end);
        events:=array_append(events,event||jsonb_build_object('ultimate',cast_now));
        if b.hp=0 then events:=array_append(events,oplot.raid_event(tick,'destroy',a,b,0,'В стене открылась брешь')); end if;
        continue;
      end if;
      events:=array_append(events,oplot.raid_event(tick,'move',a,dest,0,case when a.flying then 'Налётчик летит' else 'Налётчик наступает' end));
      raiders[i]:=dest;
      if dest.flying then continue; end if;
      for j in 1..cardinality(buildings) loop
        b:=buildings[j];
        if b.hp<=0 or b.type not in ('firetrap','icetrap') or (b.x,b.y)<>(dest.x,dest.y) then continue; end if;
        b.hp:=0; buildings[j]:=b;
        for h in 1..cardinality(raiders) loop
          a:=raiders[h]; if a.hp<=0 or a.flying or oplot.raid_distance(a,b)>1 then continue; end if;
          a.hp:=greatest(0,a.hp-b.damage);
          if b.type='icetrap' then a.wait_until:=greatest(a.wait_until,tick+least(5,1+b.level)); end if;
          raiders[h]:=a;
          events:=array_append(events,oplot.raid_event(tick,'trap',b,a,b.damage,case when b.type='icetrap' then 'Ловушка замедлила налётчика' else 'Вспыхнула огненная руна' end));
          if a.hp=0 then events:=array_append(events,oplot.raid_event(tick,'fall',b,a,0,'Налётчик выбыл')); end if;
        end loop;
      end loop;
    end loop;
  end loop;
  stars:=(goals>0 and 2*destroyed>=goals)::int+keep_down::int+(goals>0 and destroyed=goals)::int;
  events:=array_append(events,jsonb_build_object('t',ticks,'kind','end','id','','target','',
    'from',jsonb_build_array(keep_x,keep_y),'to',jsonb_build_array(keep_x,keep_y),'amount',stars,'text','Ночной рейд завершён'));
  return jsonb_build_object('stars',stars,'replay',snapshot||jsonb_build_object('v',2,'events',to_jsonb(events),'duration',ticks));
end $$;

create or replace function oplot.night_battle(s jsonb, wave int, raid_day date, who text) returns jsonb
language sql immutable set search_path='' as $$
  select oplot.simulate_raid(s,wave,raid_day,who,null)
$$;

-- Only the signed-in island owner's real report selects the wave and formation.
-- The proposed layout comes from their currently open island, including moves
-- awaiting an ordinary cloud save. Practice is a read-only calculation.
create function public.ph_oplot_practice(p_code text,p_day date,p_island jsonb) returns jsonb
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
  if jsonb_array_length(p_island->'buildings') not between 1 and 256
     or jsonb_array_length(p_island->'dragons')>512
     or not exists(select from jsonb_array_elements(p_island->'buildings') b where b->>'type'='keep') then
    raise exception 'Нужна расстановка острова с цитаделью' using errcode='22023';
  end if;
  fight:=oplot.simulate_raid(p_island,(report.summary->>'wave')::int,report.day,who,report.replay);
  return jsonb_build_object('day',report.day,'wave',report.summary->'wave','originalStars',report.summary->'stars')||fight;
end $$;

revoke all on function oplot.raid_seed(text,date),oplot.simulate_raid(jsonb,int,date,text,jsonb) from public,anon,authenticated;
revoke all on function public.ph_oplot_practice(text,date,jsonb) from public;
grant execute on function public.ph_oplot_practice(text,date,jsonb) to anon,authenticated,service_role;
