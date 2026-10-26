-- PHASE 1, LOCAL ONLY. No data backfill, activation, table or policy changes.
-- Existing rows and Storage objects are never rewritten by a V2 text save.
create function public.editorial_text_v2_doc_valid(doc jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare p jsonb; n jsonb; a jsonb;
begin
  if jsonb_typeof(doc) is distinct from 'object' or doc->>'type' is distinct from 'doc'
    or jsonb_typeof(doc->'content') is distinct from 'array' or doc-array['type','content']<>'{}'::jsonb then return false; end if;
  for p in select value from jsonb_array_elements(doc->'content') loop
    a:=p->'attrs';
    if jsonb_typeof(p) is distinct from 'object' or p->>'type' is distinct from 'paragraph'
      or p-array['type','attrs','content']<>'{}'::jsonb or jsonb_typeof(a) is distinct from 'object'
      or not a ?& array['sourceId','field','visibility','layout'] or a-array['sourceId','field','visibility','layout']<>'{}'::jsonb
      or jsonb_typeof(a->'sourceId') not in ('string','null') or jsonb_typeof(a->'field') not in ('string','null')
      or (a->>'field' is not null and a->>'field' not in ('title','body'))
      or coalesce(a->>'visibility','') not in ('print','internal_only','hidden') or jsonb_typeof(a->'layout') is distinct from 'string'
      or (p ? 'content' and jsonb_typeof(p->'content') is distinct from 'array') then return false; end if;
    for n in select value from jsonb_array_elements(coalesce(p->'content','[]'::jsonb)) loop
      if jsonb_typeof(n) is distinct from 'object' then return false; end if;
      if n->>'type'='text' then
        if jsonb_typeof(n->'text') is distinct from 'string' or length(n->>'text')=0 or n->>'text' ~ E'[\r\n]'
          or n-array['type','text','marks']<>'{}'::jsonb
          or (n ? 'marks' and n->'marks'<>'[{"type":"bold"}]'::jsonb) then return false; end if;
      elsif n->>'type'='hardBreak' then
        if not n ?& array['type','attrs'] or n-array['type','attrs']<>'{}'::jsonb
          or jsonb_typeof(n->'attrs') is distinct from 'object' or not (n->'attrs') ? 'ending'
          or (n->'attrs')-'ending'<>'{}'::jsonb or coalesce(n->'attrs'->>'ending','') not in (E'\n',E'\r',E'\r\n') then return false; end if;
      else return false; end if;
    end loop;
  end loop;
  return true;
end;
$$;
revoke all on function public.editorial_text_v2_doc_valid(jsonb) from public,anon;
grant execute on function public.editorial_text_v2_doc_valid(jsonb) to authenticated;

alter function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb)
  rename to apply_editorial_section_change_text_v1;

create function public.apply_editorial_section_change_v1(
  p_book_id uuid, p_section_id uuid, p_expected_revision integer, p_expected_order uuid[], p_change jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s record; m jsonb; ids uuid[]; marker_ids uuid[]; target uuid; key text;
  start_at integer; end_at integer; source_rows jsonb; source jsonb; store jsonb; current_group jsonb;
  expected jsonb; proposed jsonb; node jsonb; previous jsonb; item jsonb;
  node_index integer:=0; row_index integer:=0; anchor text:='start'; run_ids jsonb; source_count integer;
begin
  perform public.editorial_book_access_v1(p_book_id);
  select * into s from public.kdp_sections where id=p_section_id and book_id=p_book_id for update;
  if not found then raise exception 'editorial_access_denied' using errcode='42501'; end if;
  store:=s.settings->'editorial_text_v2';
  if p_change->>'operation' is distinct from 'save_text_v2' then
    if store is not null and coalesce(store->'groups','{}'::jsonb)<>'{}'::jsonb then
      -- Non-converted groups retain V1 batch editing; structural operations in
      -- a partially converted section are frozen for this local first phase.
      if p_change->>'operation' is distinct from 'update_text_batch' then
        raise exception 'editorial_v2_structure_locked' using errcode='22023';
      end if;
      for item in select value from jsonb_array_elements(p_change->'changes') loop
        if (item->>'block_id'=p_section_id::text and store->'groups' ? 'opening') or exists (
          select 1 from jsonb_each(store->'groups') g, jsonb_array_elements(g.value->'source'->'blocks') b
          where b->>'id'=item->>'block_id') then
          raise exception 'editorial_v2_legacy_write_rejected' using errcode='22023';
        end if;
      end loop;
    end if;
    return public.apply_editorial_section_change_text_v1(p_book_id,p_section_id,p_expected_revision,p_expected_order,p_change);
  end if;
  perform 1 from public.kdp_section_blocks where book_id=p_book_id and section_id=p_section_id order by id for update;
  m:=public.editorial_section_map_v1(p_book_id,p_section_id);
  select coalesce(array_agg(id order by sort_order,created_at,id),'{}'::uuid[]) into ids
    from public.kdp_section_blocks where book_id=p_book_id and section_id=p_section_id;
  if (m->>'revision')::integer is distinct from p_expected_revision or ids is distinct from p_expected_order then
    raise exception 'editorial_conflict' using errcode='40001'; end if;
  if not p_change ? 'subsection_id' or jsonb_typeof(p_change->'subsection_id') not in ('string','null') then
    raise exception 'editorial_invalid_target' using errcode='22023'; end if;
  target:=nullif(p_change->>'subsection_id','')::uuid;
  key:=coalesce(target::text,'opening');
  select coalesce(array_agg((value->>'heading_block_id')::uuid),'{}'::uuid[]) into marker_ids from jsonb_array_elements(m->'subsections');
  if target is not null and not target=any(marker_ids) then raise exception 'editorial_invalid_target' using errcode='22023'; end if;
  start_at:=coalesce(array_position(ids,target),0);
  select coalesce(min(array_position(ids,id)),cardinality(ids)+1) into end_at from unnest(marker_ids) id where array_position(ids,id)>start_at;
  select coalesce(jsonb_agg(to_jsonb(b) order by sort_order,created_at,id),'[]'::jsonb) into source_rows
    from public.kdp_section_blocks b where book_id=p_book_id and section_id=p_section_id
      and array_position(ids,b.id)>start_at and array_position(ids,b.id)<end_at;
  source:=jsonb_build_object('blocks',source_rows);
  if target is null then source:=source || jsonb_build_object('section_body',jsonb_build_object('id',p_section_id,'value',s.body)); end if;
  if target is not null then
    select source || jsonb_build_object('marker_body',jsonb_build_object('id',id,'value',body,'visibility',print_visibility,'layout',layout_preset)) into source
      from public.kdp_section_blocks where id=target and body is not null;
    if source is null then source:=jsonb_build_object('blocks',source_rows); end if;
  end if;
  expected:=p_change->'expected_group'; proposed:=p_change->'group';
  if jsonb_typeof(expected) is distinct from 'object' or expected->'version' is distinct from '2'::jsonb
    or expected->'subsection_id' is distinct from coalesce(to_jsonb(target),'null'::jsonb)
    or expected->'source' is distinct from source or expected-array['version','subsection_id','source','nodes']<>'{}'::jsonb
    or jsonb_typeof(expected->'nodes') is distinct from 'array' or jsonb_typeof(proposed) is distinct from 'object'
    or proposed-'nodes' is distinct from expected-'nodes' or jsonb_typeof(proposed->'nodes') is distinct from 'array'
    or jsonb_array_length(proposed->'nodes')<>jsonb_array_length(expected->'nodes') then
    raise exception 'editorial_v2_source_mismatch' using errcode='22023'; end if;
  if store is not null and (store->'version' is distinct from '2'::jsonb or jsonb_typeof(store->'groups') is distinct from 'object') then
    raise exception 'editorial_v2_invalid_store' using errcode='22023'; end if;
  current_group:=store->'groups'->key;
  if current_group is not null and current_group is distinct from expected then raise exception 'editorial_conflict' using errcode='40001'; end if;
  source_count:=jsonb_array_length(source_rows);
  -- Validate every run, source UUID, image/structural boundary and their order.
  loop
    run_ids:='[]'::jsonb;
    while row_index<source_count and source_rows->row_index->>'block_type' not in ('image','image_prompt','internal_note','page_break','heading') loop
      run_ids:=run_ids || jsonb_build_array(source_rows->row_index->'id'); row_index:=row_index+1;
    end loop;
    previous:=expected->'nodes'->node_index; node:=proposed->'nodes'->node_index;
    if previous-'doc' is distinct from jsonb_build_object('kind','text','id','segment:'||key||':'||anchor,'source_ids',run_ids)
      or node-'doc' is distinct from previous-'doc'
      or not public.editorial_text_v2_doc_valid(previous->'doc') or not public.editorial_text_v2_doc_valid(node->'doc') then
      raise exception 'editorial_v2_invalid_document' using errcode='22023'; end if;
    node_index:=node_index+1;
    exit when row_index=source_count;
    anchor:=source_rows->row_index->>'id'; previous:=expected->'nodes'->node_index; node:=proposed->'nodes'->node_index;
    if previous is distinct from jsonb_build_object('kind','block','id',anchor) or node is distinct from previous then
      raise exception 'editorial_v2_boundary_mismatch' using errcode='22023'; end if;
    node_index:=node_index+1; row_index:=row_index+1;
  end loop;
  if node_index<>jsonb_array_length(proposed->'nodes') then raise exception 'editorial_v2_boundary_mismatch' using errcode='22023'; end if;
  if proposed=expected then return jsonb_build_object('revision',p_expected_revision,'updated',0,'group',proposed); end if;
  store:=coalesce(store,'{"version":2,"groups":{}}'::jsonb);
  store:=jsonb_set(store,array['groups',key],proposed);
  m:=jsonb_set(m,'{revision}',to_jsonb(p_expected_revision+1));
  update public.kdp_sections set settings=jsonb_set(jsonb_set(settings,'{editorial_text_v2}',store),'{editorial_builder_v1}',m),
    updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email' where id=p_section_id and book_id=p_book_id;
  if not found then raise exception 'editorial_conflict' using errcode='40001'; end if;
  update public.kdp_books set updated_by_user_id=auth.uid(),updated_by_email=auth.jwt()->>'email' where id=p_book_id;
  return jsonb_build_object('revision',p_expected_revision+1,'updated',1,'group',proposed);
end;
$$;
revoke all on function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb) from public,anon;
grant execute on function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb) to authenticated;

create function public.protect_editorial_text_v2_source()
returns trigger language plpgsql security invoker set search_path='' as $$
declare store jsonb; protected boolean;
begin
  if tg_table_name='kdp_section_blocks' then
    select settings->'editorial_text_v2' into store from public.kdp_sections where id=case when tg_op='INSERT' then new.section_id else old.section_id end;
    if store is not null then
      if tg_op in ('INSERT','DELETE') then raise exception 'editorial_v2_structure_locked' using errcode='22023'; end if;
      select exists(select 1 from jsonb_each(store->'groups') g where g.value->'source'->'marker_body'->>'id'=old.id::text
        or exists(select 1 from jsonb_array_elements(g.value->'source'->'blocks') b where b->>'id'=old.id::text)) into protected;
      if protected then raise exception 'editorial_v2_legacy_write_rejected' using errcode='22023'; end if;
    end if;
    if tg_op='DELETE' then return old; end if;
  else
    if old.settings ? 'editorial_text_v2' and (not new.settings ? 'editorial_text_v2'
      or (old.settings->'editorial_text_v2'->'groups' ? 'opening' and old.body is distinct from new.body)
      or exists(select 1 from jsonb_each(old.settings->'editorial_text_v2'->'groups') g
        where not (new.settings->'editorial_text_v2'->'groups') ? g.key
          or (new.settings->'editorial_text_v2'->'groups'->g.key->'source') is distinct from g.value->'source')) then
      raise exception 'editorial_v2_legacy_write_rejected' using errcode='22023'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_editorial_text_v2_source() from public,anon;
grant execute on function public.protect_editorial_text_v2_source() to authenticated;
create trigger protect_editorial_text_v2_blocks before insert or update or delete on public.kdp_section_blocks for each row execute function public.protect_editorial_text_v2_source();
create trigger protect_editorial_text_v2_body before update on public.kdp_sections for each row execute function public.protect_editorial_text_v2_source();
