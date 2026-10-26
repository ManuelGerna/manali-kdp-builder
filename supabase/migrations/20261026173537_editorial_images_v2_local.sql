-- LOCAL ONLY: requires the preceding local V2 migration. No backfill or activation.
-- Image operations preserve every text document and semantic marker, in one transaction.
create function public.editorial_image_group_content_v2(g jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('source',(g->'source')-'blocks',
    'blocks',coalesce((select jsonb_agg(b-array['sort_order','updated_at','updated_by_user_id','updated_by_email'] order by n)
      from jsonb_array_elements(g->'source'->'blocks') with ordinality x(b,n) where b->>'block_type'<>'image'),'[]'::jsonb),
    'paragraphs',coalesce((select jsonb_agg(p order by n,pn) from jsonb_array_elements(g->'nodes') with ordinality x(b,n),
      jsonb_array_elements(b->'doc'->'content') with ordinality paragraphs(p,pn)
      where b->>'kind'='text'),'[]'::jsonb));
$$;

-- Keep the original protection, except for image rows and ordering/audit columns.
create or replace function public.protect_editorial_text_v2_source()
returns trigger language plpgsql security invoker set search_path='' as $$
declare store jsonb; protected boolean; g record;
begin
  if tg_table_name='kdp_section_blocks' then
    if tg_op='INSERT' then
      if new.block_type='image' then return new; end if;
    elsif tg_op='DELETE' then
      if old.block_type='image' then return old; end if;
    elsif (old.block_type='image' and new.block_type='image') or
      to_jsonb(old)-array['sort_order','updated_at','updated_by_user_id','updated_by_email'] =
      to_jsonb(new)-array['sort_order','updated_at','updated_by_user_id','updated_by_email'] then return new;
    end if;
    select settings->'editorial_text_v2' into store from public.kdp_sections
      where id=case when tg_op='INSERT' then new.section_id else old.section_id end;
    if store is not null then
      if tg_op in ('INSERT','DELETE') then raise exception 'editorial_v2_structure_locked' using errcode='22023'; end if;
      select exists(select 1 from jsonb_each(store->'groups') item where item.value->'source'->'marker_body'->>'id'=old.id::text
        or exists(select 1 from jsonb_array_elements(item.value->'source'->'blocks') b where b->>'id'=old.id::text)) into protected;
      if protected then raise exception 'editorial_v2_legacy_write_rejected' using errcode='22023'; end if;
    end if;
    if tg_op='DELETE' then return old; end if;
  elsif old.settings ? 'editorial_text_v2' then
    if not new.settings ? 'editorial_text_v2' or
      (old.settings->'editorial_text_v2'->'groups' ? 'opening' and old.body is distinct from new.body) then
      raise exception 'editorial_v2_legacy_write_rejected' using errcode='22023'; end if;
    for g in select * from jsonb_each(old.settings->'editorial_text_v2'->'groups') loop
      if not (new.settings->'editorial_text_v2'->'groups') ? g.key or
        (g.value->'source' is distinct from new.settings->'editorial_text_v2'->'groups'->g.key->'source' and
          public.editorial_image_group_content_v2(g.value) is distinct from
          public.editorial_image_group_content_v2(new.settings->'editorial_text_v2'->'groups'->g.key)) then
        raise exception 'editorial_v2_legacy_write_rejected' using errcode='22023'; end if;
    end loop;
  end if;
  return new;
end;
$$;

alter function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb)
  rename to apply_editorial_section_change_before_images_v2;
create function public.apply_editorial_section_change_v1(
  p_book_id uuid,p_section_id uuid,p_expected_revision integer,p_expected_order uuid[],p_change jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s record; m jsonb; ids uuid[]; desired uuid[]; markers uuid[]; unchanged uuid[]; proposed_unchanged uuid[];
  op text:=p_change->>'image_operation'; target uuid; asset uuid; previous uuid; place jsonb; notes jsonb; old_notes text;
  store jsonb; g record; proposed jsonb; rows jsonb; source jsonb; start_at integer; end_at integer;
begin
  if p_change->>'operation' is distinct from 'image_v2' then
    return public.apply_editorial_section_change_before_images_v2(p_book_id,p_section_id,p_expected_revision,p_expected_order,p_change);
  end if;
  perform public.editorial_book_access_v1(p_book_id);
  select * into s from public.kdp_sections where id=p_section_id and book_id=p_book_id for update;
  if not found then raise exception 'editorial_access_denied' using errcode='42501'; end if;
  perform 1 from public.kdp_section_blocks where section_id=p_section_id and book_id=p_book_id order by id for update;
  m:=public.editorial_section_map_v1(p_book_id,p_section_id);
  select coalesce(array_agg(id order by sort_order,created_at,id),'{}'::uuid[]) into ids
    from public.kdp_section_blocks where section_id=p_section_id and book_id=p_book_id;
  if (m->>'revision')::integer is distinct from p_expected_revision or ids is distinct from p_expected_order then
    raise exception 'editorial_conflict' using errcode='40001'; end if;
  if op is null or op not in ('add_image','replace_image','style_image','move_image','delete_image') then
    raise exception 'editorial_invalid_operation' using errcode='22023'; end if;
  target:=(p_change->>'block_id')::uuid;
  if target is null then raise exception 'editorial_invalid_target' using errcode='22023'; end if;
  if op<>'add_image' then
    select asset_id,editor_notes into previous,old_notes from public.kdp_section_blocks where id=target and section_id=p_section_id and book_id=p_book_id and block_type='image';
    if not found then raise exception 'editorial_invalid_target' using errcode='22023'; end if;
    begin notes:=coalesce(old_notes::jsonb,'{}'::jsonb);
      exception when invalid_text_representation then notes:=jsonb_build_object('legacy_notes',old_notes); end;
    if jsonb_typeof(notes)<>'object' then notes:=jsonb_build_object('legacy_notes',old_notes); end if;
  end if;
  select coalesce(array_agg((value->>'heading_block_id')::uuid),'{}'::uuid[]) into markers from jsonb_array_elements(m->'subsections');
  place:=p_change->'placement';
  if op in ('add_image','move_image') and (jsonb_typeof(place) is distinct from 'object'
    or coalesce(place->>'scope','') not in ('group','chapter') or coalesce(place->>'edge','') not in ('before','after')
    or not place ? 'subsection_id' or jsonb_typeof(place->'subsection_id') not in ('string','null')
    or (place->>'subsection_id' is not null and not (place->>'subsection_id')::uuid=any(markers))
    or (place->>'scope'='chapter' and s.section_type<>'chapter')) then
    raise exception 'editorial_invalid_target' using errcode='22023'; end if;
  select coalesce(array_agg(value::uuid order by n),'{}'::uuid[]) into desired
    from jsonb_array_elements_text(p_change->'order') with ordinality x(value,n);
  if cardinality(desired)<>(select count(distinct id) from unnest(desired) id) or
    cardinality(desired)<>cardinality(ids)+(case when op='add_image' then 1 when op='delete_image' then -1 else 0 end) then
    raise exception 'editorial_invalid_order' using errcode='22023'; end if;
  unchanged:=array_remove(ids,target); proposed_unchanged:=array_remove(desired,target);
  if unchanged is distinct from proposed_unchanged or (op='delete_image' and target=any(desired)) or
    (op<>'delete_image' and not target=any(desired)) then raise exception 'editorial_invalid_order' using errcode='22023'; end if;
  if op in ('add_image','replace_image','style_image') and (coalesce(p_change->>'size','') not in ('small','medium','text') or
    coalesce(p_change->>'align','') not in ('left','center','right')) then raise exception 'editorial_invalid_target' using errcode='22023'; end if;
  if op in ('add_image','replace_image') then
    asset:=(p_change->>'asset_id')::uuid;
    perform 1 from public.kdp_assets where id=asset and book_id=p_book_id and asset_type='image'
      and prompt='editorial-image-v1:pending' and file_path is not null for update;
    if not found then raise exception 'editorial_invalid_target' using errcode='22023'; end if;
  end if;
  if asset is not null then update public.kdp_assets set prompt='editorial-image-v1:active',status='uploaded' where id=asset and book_id=p_book_id; end if;
  if op='add_image' then
    insert into public.kdp_section_blocks(id,book_id,section_id,block_type,asset_id,sort_order,editor_notes,
      created_by_user_id,created_by_email,updated_by_user_id,updated_by_email)
    values(target,p_book_id,p_section_id,'image',asset,cardinality(ids)+1,
      jsonb_build_object('size',p_change->>'size','align',p_change->>'align','placement',place)::text,
      auth.uid(),auth.jwt()->>'email',auth.uid(),auth.jwt()->>'email');
  elsif op='delete_image' then
    delete from public.kdp_section_blocks where id=target and book_id=p_book_id and section_id=p_section_id;
  else
    update public.kdp_section_blocks set asset_id=case when op='replace_image' then asset else asset_id end,
      editor_notes=(notes || case when op='move_image' then jsonb_build_object('placement',place)
        else jsonb_build_object('size',p_change->>'size','align',p_change->>'align') end)::text
      where id=target and book_id=p_book_id and section_id=p_section_id;
  end if;
  if op='replace_image' then
    update public.kdp_assets set prompt='editorial-image-v1:garbage' where id=previous and book_id=p_book_id
      and prompt='editorial-image-v1:active' and not exists(select 1 from public.kdp_section_blocks where asset_id=previous);
  end if;
  update public.kdp_section_blocks b set sort_order=x.n,updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email'
    from unnest(desired) with ordinality x(id,n) where b.id=x.id and b.book_id=p_book_id and b.section_id=p_section_id;
  store:=s.settings->'editorial_text_v2';
  if coalesce(store->'groups','{}'::jsonb) <> coalesce(p_change->'groups','{}'::jsonb) then
    if (select array_agg(key order by key) from jsonb_each(coalesce(store->'groups','{}'::jsonb))) is distinct from
      (select array_agg(key order by key) from jsonb_each(coalesce(p_change->'groups','{}'::jsonb))) then
      raise exception 'editorial_v2_source_mismatch' using errcode='22023'; end if;
  end if;
  for g in select * from jsonb_each(coalesce(store->'groups','{}'::jsonb)) loop
    start_at:=case when g.key='opening' then 0 else array_position(desired,g.key::uuid) end;
    select coalesce(min(array_position(desired,id)),cardinality(desired)+1) into end_at from unnest(markers) id where array_position(desired,id)>start_at;
    select coalesce(jsonb_agg(to_jsonb(b) order by sort_order,created_at,id),'[]'::jsonb) into rows from public.kdp_section_blocks b
      where section_id=p_section_id and book_id=p_book_id and array_position(desired,id)>start_at and array_position(desired,id)<end_at;
    source:=jsonb_set(g.value->'source','{blocks}',rows);
    proposed:=jsonb_set(p_change->'groups'->g.key,'{source}',source);
    if proposed is null or public.editorial_image_group_content_v2(proposed) is distinct from public.editorial_image_group_content_v2(g.value) then
      raise exception 'editorial_v2_image_text_changed' using errcode='22023'; end if;
    store:=jsonb_set(store,array['groups',g.key],proposed);
  end loop;
  m:=jsonb_set(m,'{revision}',to_jsonb(p_expected_revision+1));
  update public.kdp_sections set settings=jsonb_set(settings,'{editorial_builder_v1}',m) ||
    case when store is null then '{}'::jsonb else jsonb_build_object('editorial_text_v2',store) end,
    updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email' where id=p_section_id and book_id=p_book_id;
  -- Reuse the V2 validator: exact rows, segment UUIDs, source IDs and boundaries.
  for g in select * from jsonb_each(coalesce(store->'groups','{}'::jsonb)) loop
    perform public.apply_editorial_section_change_before_images_v2(p_book_id,p_section_id,p_expected_revision+1,desired,
      jsonb_build_object('operation','save_text_v2','subsection_id',g.value->'subsection_id','expected_group',g.value,'group',g.value));
  end loop;
  perform public.editorial_section_map_v1(p_book_id,p_section_id);
  update public.kdp_books set updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email' where id=p_book_id;
  return jsonb_build_object('revision',p_expected_revision+1,'block_id',target);
end;
$$;
revoke all on function public.editorial_image_group_content_v2(jsonb) from public,anon;
grant execute on function public.editorial_image_group_content_v2(jsonb) to authenticated;
revoke all on function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb) from public,anon;
grant execute on function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb) to authenticated;
