-- LOCAL ONLY. No data backfill, block merge/split, parser or Storage change.
-- Preserve the complete image/legacy dispatch chain and public RPC signature.
alter function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb)
rename to apply_editorial_section_change_images_v1;

create function public.apply_editorial_section_change_v1(
  p_book_id uuid, p_section_id uuid, p_expected_revision integer,
  p_expected_order uuid[], p_change jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  m jsonb; ids uuid[]; marker_ids uuid[]; seen uuid[] := '{}';
  subsection uuid; target uuid; start_at integer; end_at integer; position integer;
  item jsonb; b record; updated integer := 0; affected integer;
begin
  if p_change->>'operation' is distinct from 'update_text_batch' then
    return public.apply_editorial_section_change_images_v1(
      p_book_id,p_section_id,p_expected_revision,p_expected_order,p_change);
  end if;
  perform public.editorial_book_access_v1(p_book_id);
  perform 1 from public.kdp_sections where id=p_section_id and book_id=p_book_id for update;
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
  subsection := nullif(p_change->>'subsection_id','')::uuid;
  if subsection is null or not subsection=any(marker_ids) then
    raise exception 'editorial_invalid_target' using errcode='22023';
  end if;
  start_at := array_position(ids,subsection);
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
    position := array_position(ids,target);
    if target is null or target=any(seen) or position is null or position<=start_at or position>=end_at then
      raise exception 'editorial_invalid_target' using errcode='22023';
    end if;
    seen := array_append(seen,target);
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
