-- LOCAL ONLY. Extend the existing atomic batch to introductory groups.
-- No backfill, new rows, parser, Storage or export changes.
create or replace function public.apply_editorial_section_change_v1(
  p_book_id uuid, p_section_id uuid, p_expected_revision integer,
  p_expected_order uuid[], p_change jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  m jsonb; ids uuid[]; marker_ids uuid[]; seen uuid[] := '{}';
  subsection uuid; target uuid; start_at integer; end_at integer; position integer;
  item jsonb; b record; updated integer := 0; affected integer;
  opening_body text; body_changed boolean := false;
begin
  if p_change->>'operation' is distinct from 'update_text_batch' then
    return public.apply_editorial_section_change_images_v1(
      p_book_id,p_section_id,p_expected_revision,p_expected_order,p_change);
  end if;
  perform public.editorial_book_access_v1(p_book_id);
  select body into opening_body from public.kdp_sections where id=p_section_id and book_id=p_book_id for update;
  if not found then raise exception 'editorial_access_denied' using errcode='42501'; end if;
  perform 1 from public.kdp_section_blocks where book_id=p_book_id and section_id=p_section_id order by id for update;
  m := public.editorial_section_map_v1(p_book_id,p_section_id);
  select coalesce(array_agg(id order by sort_order,created_at,id),'{}'::uuid[]) into ids
    from public.kdp_section_blocks where book_id=p_book_id and section_id=p_section_id;
  if (m->>'revision')::integer is distinct from p_expected_revision or ids is distinct from p_expected_order then
    raise exception 'editorial_conflict' using errcode='40001';
  end if;
  select coalesce(array_agg((value->>'heading_block_id')::uuid),'{}'::uuid[]) into marker_ids
    from jsonb_array_elements(m->'subsections');
  -- Null subsection selects only the prefix before the first semantic marker.
  if not p_change ? 'subsection_id'
    or jsonb_typeof(p_change->'subsection_id') not in ('string','null') then
    raise exception 'editorial_invalid_target' using errcode='22023';
  end if;
  subsection := nullif(p_change->>'subsection_id','')::uuid;
  if subsection is null then
    start_at := 0;
  else
    if not subsection=any(marker_ids) then
      raise exception 'editorial_invalid_target' using errcode='22023';
    end if;
    start_at := array_position(ids,subsection);
  end if;
  select coalesce(min(array_position(ids,id)),cardinality(ids)+1) into end_at
    from unnest(marker_ids) id where array_position(ids,id)>start_at;
  if jsonb_typeof(p_change->'changes') is distinct from 'array' then
    raise exception 'editorial_invalid_batch' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_change->'changes') loop
    if jsonb_typeof(item) is distinct from 'object'
      or not item ?& array['block_id','title','body','expected_title','expected_body']
      or jsonb_typeof(item->'block_id') is distinct from 'string'
      or jsonb_typeof(item->'title') not in ('string','null')
      or jsonb_typeof(item->'body') not in ('string','null')
      or jsonb_typeof(item->'expected_title') not in ('string','null')
      or jsonb_typeof(item->'expected_body') not in ('string','null') then
      raise exception 'editorial_invalid_batch' using errcode='22023';
    end if;
    target := nullif(item->>'block_id','')::uuid;
    if target is null or target=any(seen) then
      raise exception 'editorial_invalid_target' using errcode='22023';
    end if;
    seen := array_append(seen,target);
    -- The existing section body is never inserted as a DB block. Its UUID is
    -- accepted only in the opening batch and cannot modify the section title.
    if target=p_section_id then
      if subsection is not null or item->>'title' is not null or item->>'expected_title' is not null then
        raise exception 'editorial_invalid_target' using errcode='22023';
      end if;
      if opening_body is distinct from item->>'expected_body' then
        raise exception 'editorial_conflict' using errcode='40001';
      end if;
      body_changed := opening_body is distinct from item->>'body';
      if body_changed then opening_body := item->>'body'; updated := updated+1; end if;
      continue;
    end if;
    position := array_position(ids,target);
    if position is null or position<=start_at or position>=end_at then
      raise exception 'editorial_invalid_target' using errcode='22023';
    end if;
    select * into b from public.kdp_section_blocks where id=target and book_id=p_book_id and section_id=p_section_id;
    if not found or b.block_type in ('image','image_prompt','page_break','internal_note') then
      raise exception 'editorial_invalid_target' using errcode='22023';
    end if;
    if b.title is distinct from item->>'expected_title' or b.body is distinct from item->>'expected_body' then
      raise exception 'editorial_conflict' using errcode='40001';
    end if;
    if b.title is distinct from item->>'title' or b.body is distinct from item->>'body' then
      update public.kdp_section_blocks set title=item->>'title',body=item->>'body',
        updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email'
        where id=target and book_id=p_book_id and section_id=p_section_id;
      get diagnostics affected = row_count;
      if affected<>1 then raise exception 'editorial_conflict' using errcode='40001'; end if;
      updated := updated+1;
    end if;
  end loop;
  if updated=0 then return jsonb_build_object('revision',p_expected_revision,'updated',0); end if;
  m := jsonb_set(m,'{revision}',to_jsonb(p_expected_revision+1));
  update public.kdp_sections set settings=jsonb_set(settings,'{editorial_builder_v1}',m),
    body=case when body_changed then opening_body else body end,
    updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email'
    where id=p_section_id and book_id=p_book_id;
  if not found then raise exception 'editorial_conflict' using errcode='40001'; end if;
  update public.kdp_books set updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email' where id=p_book_id;
  perform public.editorial_section_map_v1(p_book_id,p_section_id);
  return jsonb_build_object('revision',p_expected_revision+1,'updated',updated);
end;
$$;
revoke all on function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb) from public,anon;
grant execute on function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb) to authenticated;
