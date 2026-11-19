-- Compact both profile axes by two cells. Occupied plots on the previous border
-- keep their coordinates. Moving the last such building inward frees the strip.
create or replace function oplot.raid_axis(old_axis int) returns int language sql immutable set search_path='' as $$
  select (array[33,36,40,43,46,50,53])[greatest(10,least(16,old_axis))-9]
$$;

create function oplot.raid_coord(value jsonb) returns int language sql immutable set search_path='' as $$
  select case when jsonb_typeof(value)='number' and value::text ~ '^[0-9]{1,2}$' then value::text::int end
$$;

create function oplot.raid_dimensions(s jsonb) returns int[] language sql immutable set search_path='' as $$
  with growth as (select oplot.raid_grid_growth(s) as strips),
  nominal as (select oplot.raid_axis(10+(strips+1)/2) as w,oplot.raid_axis(10+strips/2) as h from growth),
  edges as (
    select max(oplot.raid_coord(b->'x')+oplot.raid_span(b->>'type')) as right_edge,
           max(oplot.raid_coord(b->'y')+oplot.raid_span(b->>'type')) as bottom_edge
    from jsonb_array_elements(oplot.arr(s->'buildings')) b
    where (b->'stowed') is distinct from 'true'::jsonb
  )
  select array[least(w+2,greatest(w,right_edge)),least(h+2,greatest(h,bottom_edge))] from nominal,edges
$$;
revoke all on function oplot.raid_coord(jsonb),oplot.raid_dimensions(jsonb) from public,anon,authenticated;

create or replace function oplot.valid_grid_layout(s jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare
  dims int[]; occupied boolean[]; b jsonb; span int; x int; y int; col int; row_no int; slot int; keeps int:=0;
begin
  if jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(s->'buildings') is distinct from 'array' then return false;end if;
  if s ? 'xp' and (jsonb_typeof(s->'xp') is distinct from 'number' or s->>'xp' !~ '^[0-9]+$') then return false;end if;
  if exists(select from jsonb_array_elements(s->'buildings') entry
    group by entry->>'id' having count(*)>1) then return false;end if;
  dims:=oplot.raid_dimensions(s);occupied:=array_fill(false,array[dims[1]*dims[2]]);
  for b in select value from jsonb_array_elements(s->'buildings') loop
    if jsonb_typeof(b->'id') is distinct from 'string' or b->>'id'='' then return false;end if;
    span:=oplot.raid_span(b->>'type');if span is null then return false;end if;
    if b ? 'stowed' and jsonb_typeof(b->'stowed')<>'boolean' then return false;end if;
    if b->'stowed'='true'::jsonb then
      if b->>'type'='keep' or b->>'x' is not null or b->>'y' is not null then return false;end if;
      continue;
    end if;
    x:=oplot.raid_coord(b->'x');y:=oplot.raid_coord(b->'y');
    if x is null or y is null or x+span>dims[1] or y+span>dims[2] then return false;end if;
    if b->>'type'='keep' then keeps:=keeps+1;end if;
    for row_no in y..y+span-1 loop
      for col in x..x+span-1 loop
        slot:=1+row_no*dims[1]+col;
        if occupied[slot] then return false;end if;
        occupied[slot]:=true;
      end loop;
    end loop;
  end loop;
  return keeps=1;
end $$;

-- The nightly and practice RPCs share a single simulator. Change its dimension
-- initialization and snapshot header in place without copying its combat rules.
-- Match both fragments explicitly so an unanticipated simulator revision fails
-- during migration instead of silently keeping a stale axis.
do $migration$
declare
  simulator text:=pg_get_functiondef('oplot.simulate_grid_raid(jsonb,integer,date,text,jsonb)'::regprocedure);
  old_axes text:='grid_width int:=oplot.raid_axis(10+(growth+1)/2); grid_height int:=oplot.raid_axis(10+growth/2);';
  old_side text:=$src$'gridSize',grid_width,'gridWidth'$src$;
begin
  if strpos(simulator,old_axes)=0 or strpos(simulator,old_side)=0 then
    raise exception 'Unexpected multi-cell simulator definition. Review the dimension and snapshot fields.';
  end if;
  simulator:=replace(simulator,old_axes,'dims int[]:=oplot.raid_dimensions(s); grid_width int:=dims[1]; grid_height int:=dims[2];');
  simulator:=replace(simulator,old_side,$src$'gridSize',greatest(grid_width,grid_height),'gridWidth'$src$);
  execute simulator;
end $migration$;
