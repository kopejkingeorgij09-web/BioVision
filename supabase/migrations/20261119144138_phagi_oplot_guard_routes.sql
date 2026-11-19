-- A home guard on the far side of its own keep can go around the foundation.
-- The recorded formation, attack cadence, flight, traps and raider strides keep their rules.
create or replace function oplot.raid_step2(a oplot.raid_actor,goal oplot.raid_actor,blocked int[],traps int[],width int,guarding boolean)
returns oplot.raid_stride language plpgsql immutable set search_path='' as $$
declare
  dest oplot.raid_actor; slot int:=1+a.x+width*a.y; steps int;
  start_slot int:=slot; cells int:=cardinality(blocked); detour boolean:=false;
  parents int[]; queue int[]; head int:=1; tail int:=1; neighbor int; direction int;
begin
  if guarding and not a.flying then
    -- Keep the normal two-cell stride when there is a clear approach. Checking the full
    -- approach also prevents a guard from undoing its previous detour on the next turn.
    dest:=a;
    while (dest.x,dest.y)<>(goal.x,goal.y) loop
      exit when oplot.raid_distance(dest,goal)<=2 and oplot.raid_melee_clear(dest,goal,blocked,width);
      dest:=oplot.raid_move(dest,goal);
      if blocked[1+dest.x+width*dest.y]<>0 then detour:=true;exit;end if;
    end loop;
    if detour then
      -- Each open cell enters the queue at most once. Stop at a tile from which
      -- the defender can attack, including the shore of an occupied enemy tile.
      parents:=array_fill(0,array[cells]);parents[start_slot]:=start_slot;
      queue:=array_fill(0,array[cells]);queue[1]:=start_slot;
      while head<=tail loop
        slot:=queue[head];head:=head+1;dest.x:=(slot-1)%width;dest.y:=(slot-1)/width;
        if abs(dest.x-goal.x)+abs(dest.y-goal.y)<=2 and oplot.raid_melee_clear(dest,goal,blocked,width) then
          while parents[parents[slot]]<>start_slot loop slot:=parents[slot];end loop;
          a.x:=(slot-1)%width;a.y:=(slot-1)/width;
          return row(a,0,0)::oplot.raid_stride;
        end if;
        for direction in 1..4 loop
          case direction
            when 1 then if dest.x=0 then continue;end if;neighbor:=slot-1;
            when 2 then if dest.x=width-1 then continue;end if;neighbor:=slot+1;
            when 3 then neighbor:=slot-width;
            else neighbor:=slot+width;
          end case;
          if neighbor between 1 and cells and parents[neighbor]=0 and blocked[neighbor]=0 then
            parents[neighbor]:=slot;tail:=tail+1;queue[tail]:=neighbor;
          end if;
        end loop;
      end loop;
      return row(a,0,0)::oplot.raid_stride;
    end if;
  end if;
  slot:=start_slot;
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
