-- LOCAL ONLY: Builder identities and atomic edits. No schema/data backfill,
-- parser changes, or automatic bootstrap. All functions preserve existing RLS.
create function public.editorial_book_access_v1(p_book_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'editorial_access_denied' using errcode = '42501'; end if;
  -- Serializes Builder operations, including bootstrap, before locking children.
  perform 1 from public.kdp_books where id = p_book_id for update;
  if not found then raise exception 'editorial_access_denied' using errcode = '42501'; end if;
  if not exists (select 1 from public.kdp_import_runs where book_id = p_book_id and import_kind = 'editorial_draft_v1')
     or exists (select 1 from public.kdp_import_runs where book_id = p_book_id and import_kind <> 'editorial_draft_v1')
     or exists (select 1 from public.kdp_imported_pages where book_id = p_book_id) then
    raise exception 'editorial_book_required' using errcode = '22023';
  end if;
end;
$$;

create function public.editorial_section_map_v1(p_book_id uuid, p_section_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  m jsonb; item jsonb; ids uuid[]; seen uuid[] := '{}'; semantic text[] := '{}';
  previous_position integer := 0; position integer; entry_order integer := 0;
begin
  select settings->'editorial_builder_v1' into m from public.kdp_sections
    where id = p_section_id and book_id = p_book_id;
  if not found or m is null or m->'version' is distinct from '1'::jsonb
     or jsonb_typeof(m->'revision') is distinct from 'number'
     or coalesce(m->>'revision','') !~ '^[0-9]+$'
     or jsonb_typeof(m->'subsections') is distinct from 'array' then
    raise exception 'editorial_map_invalid' using errcode = '22023';
  end if;
  select coalesce(array_agg(id order by sort_order, created_at, id), '{}'::uuid[]) into ids
    from public.kdp_section_blocks where book_id = p_book_id and section_id = p_section_id;
  for item in select value from jsonb_array_elements(m->'subsections') loop
    position := array_position(ids, (item->>'heading_block_id')::uuid);
    if position is null or position <= previous_position
       or item->'order' is distinct from to_jsonb(entry_order)
       or coalesce(item->>'semantic_id','') = ''
       or item->>'semantic_id' = any(semantic)
       or (item->>'heading_block_id')::uuid = any(seen)
       or coalesce(item->>'kind','') not in ('heading','numbered','key') then
      raise exception 'editorial_map_invalid' using errcode = '22023';
    end if;
    seen := array_append(seen,(item->>'heading_block_id')::uuid);
    semantic := array_append(semantic,item->>'semantic_id');
    previous_position := position; entry_order := entry_order + 1;
  end loop;
  return m;
end;
$$;

create function public.bootstrap_editorial_builder_v1(p_book_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  project jsonb; s record; source jsonb; expected jsonb; actual jsonb;
  entries jsonb; m jsonb; initialized integer := 0; source_count integer;
begin
  perform public.editorial_book_access_v1(p_book_id);
  if (select count(*) from public.kdp_import_runs where book_id = p_book_id and import_kind = 'editorial_draft_v1') <> 1 then
    raise exception 'editorial_bootstrap_mismatch' using errcode = '22023';
  end if;
  select normalized_project into project from public.kdp_import_runs
    where book_id = p_book_id and import_kind = 'editorial_draft_v1';
  if jsonb_typeof(project->'sections') is distinct from 'array' then
    raise exception 'editorial_bootstrap_mismatch' using errcode = '22023';
  end if;
  perform 1 from public.kdp_sections where book_id = p_book_id order by id for update;
  perform 1 from public.kdp_section_blocks where book_id = p_book_id order by section_id,id for update;
  -- Before the first bootstrap the entire persisted book must match the import.
  if not exists (select 1 from public.kdp_sections where book_id=p_book_id and settings ? 'editorial_builder_v1') then
    select count(distinct settings->'editorialImporter'->>'sourceSectionId') into source_count
      from public.kdp_sections where book_id=p_book_id;
    if source_count <> jsonb_array_length(project->'sections')
       or (select count(*) from public.kdp_sections where book_id=p_book_id) <> source_count then
      raise exception 'editorial_bootstrap_mismatch' using errcode = '22023';
    end if;
  end if;
  for s in select * from public.kdp_sections where book_id=p_book_id order by sort_order,id loop
    if s.settings ? 'editorial_builder_v1' then
      perform public.editorial_section_map_v1(p_book_id,s.id);
      continue;
    end if;
    select value into source from jsonb_array_elements(project->'sections')
      where value->>'id' = s.settings->'editorialImporter'->>'sourceSectionId';
    if source is null or jsonb_typeof(source->'blocks') is distinct from 'array'
       or jsonb_typeof(source->'subsections') is distinct from 'array' then
      raise exception 'editorial_bootstrap_mismatch' using errcode = '22023';
    end if;
    -- This is the persisted import's serialization order, not a text classifier.
    with flat as (
      select 0::bigint g,b.ordinality n,
        case when b.value->>'type'='editorial' then b.value->>'text' end title,
        case when b.value->>'type'<>'editorial' then b.value->>'text' end body,
        null::jsonb semantic
      from jsonb_array_elements(source->'blocks') with ordinality b
      union all
      select sub.ordinality,0,sub.value->>'title',null,
        jsonb_strip_nulls(jsonb_build_object('semantic_id',sub.value->>'id','kind',sub.value->>'kind',
          'original_number',sub.value->'number'))
      from jsonb_array_elements(source->'subsections') with ordinality sub
      union all
      select sub.ordinality,b.ordinality,
        case when b.value->>'type'='editorial' then b.value->>'text' end,
        case when b.value->>'type'<>'editorial' then b.value->>'text' end,null
      from jsonb_array_elements(source->'subsections') with ordinality sub,
           jsonb_array_elements(sub.value->'blocks') with ordinality b
    ), numbered as (select *, row_number() over (order by g,n) pos from flat)
    select coalesce(jsonb_agg(jsonb_build_object('title',title,'body',body,'sort_order',pos,'block_type','text') order by pos),'[]'::jsonb),
      coalesce(jsonb_agg(semantic || jsonb_build_object('heading_block_id',
        (select id from public.kdp_section_blocks where section_id=s.id and book_id=p_book_id and sort_order=pos),
        'order',g-1) order by pos) filter (where semantic is not null),'[]'::jsonb)
      into expected,entries from numbered;
    select coalesce(jsonb_agg(jsonb_build_object('title',title,'body',body,'sort_order',sort_order,'block_type',block_type)
      order by sort_order,created_at,id),'[]'::jsonb) into actual
      from public.kdp_section_blocks where section_id=s.id and book_id=p_book_id;
    if actual is distinct from expected then
      raise exception 'editorial_bootstrap_mismatch' using errcode = '22023';
    end if;
    m := jsonb_build_object('version',1,'revision',0,'subsections',entries);
    update public.kdp_sections set settings=jsonb_set(settings,'{editorial_builder_v1}',m),
      updated_by_user_id=auth.uid(), updated_by_email=auth.jwt()->>'email' where id=s.id and book_id=p_book_id;
    perform public.editorial_section_map_v1(p_book_id,s.id);
    initialized := initialized + 1;
  end loop;
  return jsonb_build_object('initialized',initialized);
end;
$$;

-- One transaction for content, ordering, semantic identity and revision.
-- The caller supplies the complete observed order plus revision; stale actions
-- fail rather than overwrite another editor's completed operation.
create function public.apply_editorial_section_change_v1(
  p_book_id uuid, p_section_id uuid, p_expected_revision integer,
  p_expected_order uuid[], p_change jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  m jsonb; entries jsonb; current_ids uuid[]; desired uuid[]; target uuid;
  marker_ids uuid[]; deleted_ids uuid[]; new_id uuid; op text := p_change->>'operation';
  start_at integer; end_at integer; affected integer; expected_count integer;
  title_value text := p_change->>'title'; body_value text := p_change->>'body';
begin
  perform public.editorial_book_access_v1(p_book_id);
  perform 1 from public.kdp_sections where id=p_section_id and book_id=p_book_id for update;
  if not found then raise exception 'editorial_access_denied' using errcode='42501'; end if;
  perform 1 from public.kdp_section_blocks where section_id=p_section_id and book_id=p_book_id order by id for update;
  m := public.editorial_section_map_v1(p_book_id,p_section_id);
  select coalesce(array_agg(id order by sort_order,created_at,id),'{}'::uuid[]) into current_ids
    from public.kdp_section_blocks where section_id=p_section_id and book_id=p_book_id;
  if (m->>'revision')::integer is distinct from p_expected_revision or current_ids is distinct from p_expected_order then
    raise exception 'editorial_conflict' using errcode='40001';
  end if;
  select coalesce(array_agg((value->>'heading_block_id')::uuid),'{}'::uuid[]) into marker_ids
    from jsonb_array_elements(m->'subsections');
  desired := current_ids; entries := m->'subsections';
  target := nullif(p_change->>'block_id','')::uuid;
  if op = 'reorder' then
    select coalesce(array_agg(value::uuid order by ordinality),'{}'::uuid[]) into desired
      from jsonb_array_elements_text(p_change->'order') with ordinality;
    if jsonb_typeof(p_change->'order') is distinct from 'array'
       or cardinality(desired) <> cardinality(current_ids)
       or (select count(distinct id) from unnest(desired) id) <> cardinality(desired)
       or not desired @> current_ids or not current_ids @> desired then
      raise exception 'editorial_invalid_order' using errcode='22023';
    end if;
  elsif op in ('delete_subsection','delete_text') then
    start_at := array_position(current_ids,target);
    if start_at is null or (op='delete_subsection' and not target=any(marker_ids))
       or (op='delete_text' and target=any(marker_ids)) then
      raise exception 'editorial_invalid_target' using errcode='22023';
    end if;
    end_at := start_at + 1;
    if op='delete_subsection' then
      select coalesce(min(array_position(current_ids,id)),cardinality(current_ids)+1) into end_at
        from unnest(marker_ids) id where array_position(current_ids,id)>start_at;
    end if;
    deleted_ids := current_ids[start_at:end_at-1];
    delete from public.kdp_section_blocks where book_id=p_book_id and section_id=p_section_id and id=any(deleted_ids);
    get diagnostics affected = row_count;
    if affected <> cardinality(deleted_ids) then raise exception 'editorial_conflict' using errcode='40001'; end if;
    select coalesce(array_agg(id order by ord),'{}'::uuid[]) into desired
      from unnest(current_ids) with ordinality as u(id,ord) where not id=any(deleted_ids);
    select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into entries
      from jsonb_array_elements(entries) with ordinality where not (value->>'heading_block_id')::uuid=any(deleted_ids);
  elsif op in ('add_subsection','add_text') then
    if (op='add_subsection' and coalesce(btrim(title_value),'')='')
       or (op='add_text' and coalesce(btrim(body_value),'')='') then
      raise exception 'editorial_empty_content' using errcode='22023';
    end if;
    new_id := gen_random_uuid(); end_at := cardinality(current_ids)+1;
    if op='add_subsection' then
      entries := entries || jsonb_build_array(jsonb_build_object('semantic_id','builder:'||new_id::text,
        'kind','heading','heading_block_id',new_id,'order',jsonb_array_length(entries)));
    else
      target := nullif(p_change->>'subsection_id','')::uuid;
      if target is not null and not target=any(marker_ids) then raise exception 'editorial_invalid_target' using errcode='22023'; end if;
      start_at := coalesce(array_position(current_ids,target),0);
      select coalesce(min(array_position(current_ids,id)),cardinality(current_ids)+1) into end_at
        from unnest(marker_ids) id where array_position(current_ids,id)>start_at;
    end if;
    insert into public.kdp_section_blocks(id,book_id,section_id,block_type,title,body,sort_order,
      created_by_user_id,created_by_email,updated_by_user_id,updated_by_email)
      values(new_id,p_book_id,p_section_id,'text',case when op='add_subsection' then title_value end,
        case when op='add_text' then body_value end,cardinality(current_ids)+1,
        auth.uid(),auth.jwt()->>'email',auth.uid(),auth.jwt()->>'email');
    desired := current_ids[1:end_at-1] || array[new_id] || current_ids[end_at:cardinality(current_ids)];
  elsif op='update_text' then
    if target is null or not target=any(current_ids)
       or (target=any(marker_ids) and coalesce(btrim(title_value),'')='')
       or (not target=any(marker_ids) and coalesce(btrim(title_value),'')='' and coalesce(btrim(body_value),'')='') then
      raise exception 'editorial_empty_content' using errcode='22023';
    end if;
    update public.kdp_section_blocks set title=title_value,
      body=case when target=any(marker_ids) then body else body_value end,
      updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email'
      where id=target and book_id=p_book_id and section_id=p_section_id;
    get diagnostics affected = row_count;
    if affected<>1 then raise exception 'editorial_conflict' using errcode='40001'; end if;
  else raise exception 'editorial_invalid_operation' using errcode='22023';
  end if;
  -- Set based normalization, including any pre-existing gaps/duplicates.
  update public.kdp_section_blocks b set sort_order=u.ord,
    updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email'
    from unnest(desired) with ordinality u(id,ord)
    where b.id=u.id and b.book_id=p_book_id and b.section_id=p_section_id;
  get diagnostics affected = row_count;
  expected_count := cardinality(desired);
  if affected<>expected_count then raise exception 'editorial_conflict' using errcode='40001'; end if;
  select coalesce(jsonb_agg(value || jsonb_build_object('order',position-1) order by position),'[]'::jsonb) into entries
    from (select value,row_number() over (order by array_position(desired,(value->>'heading_block_id')::uuid)) position
      from jsonb_array_elements(entries)) ordered;
  m := jsonb_set(jsonb_set(m,'{subsections}',entries),'{revision}',to_jsonb(p_expected_revision+1));
  update public.kdp_sections set settings=jsonb_set(settings,'{editorial_builder_v1}',m),
    updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email' where id=p_section_id and book_id=p_book_id;
  if not found then raise exception 'editorial_conflict' using errcode='40001'; end if;
  perform public.editorial_section_map_v1(p_book_id,p_section_id);
  update public.kdp_books set updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email' where id=p_book_id;
  return jsonb_build_object('revision',p_expected_revision+1,'block_id',new_id);
end;
$$;

create function public.create_editorial_section_v1(p_book_id uuid, p_title text, p_section_type text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  perform public.editorial_book_access_v1(p_book_id);
  if coalesce(btrim(p_title),'')='' or p_section_type not in ('chapter','chapter_text','introduction','conclusion') then
    raise exception 'editorial_empty_content' using errcode='22023';
  end if;
  -- Require bootstrap before adding parts to the imported book.
  perform public.editorial_section_map_v1(p_book_id,id) from public.kdp_sections where book_id=p_book_id;
  insert into public.kdp_sections(book_id,title,section_type,sort_order,settings,created_by_user_id,created_by_email,updated_by_user_id,updated_by_email)
    select p_book_id,p_title,p_section_type,coalesce(max(sort_order),0)+1,
      '{"editorial_builder_v1":{"version":1,"revision":0,"subsections":[]}}'::jsonb,
      auth.uid(),auth.jwt()->>'email',auth.uid(),auth.jwt()->>'email'
    from public.kdp_sections where book_id=p_book_id returning id into result;
  return result;
end;
$$;

revoke all on function public.editorial_book_access_v1(uuid) from public, anon;
revoke all on function public.editorial_section_map_v1(uuid,uuid) from public, anon;
revoke all on function public.bootstrap_editorial_builder_v1(uuid) from public, anon;
revoke all on function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb) from public, anon;
revoke all on function public.create_editorial_section_v1(uuid,text,text) from public, anon;
grant execute on function public.editorial_book_access_v1(uuid) to authenticated;
grant execute on function public.editorial_section_map_v1(uuid,uuid) to authenticated;
grant execute on function public.bootstrap_editorial_builder_v1(uuid) to authenticated;
grant execute on function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb) to authenticated;
grant execute on function public.create_editorial_section_v1(uuid,text,text) to authenticated;
