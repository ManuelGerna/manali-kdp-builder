-- LOCAL ONLY: no remote migration is applied by this change.
-- Asset rows remain a durable cleanup ledger until Storage removal succeeds.
create function public.collect_editorial_image_uploads_v1(p_book_id uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
  perform public.editorial_book_access_v1(p_book_id);
  update public.kdp_assets a set prompt='editorial-image-v1:garbage'
    where a.book_id=p_book_id and a.prompt='editorial-image-v1:pending'
      and a.created_at < now()-interval '1 hour'
      and not exists (select 1 from public.kdp_section_blocks where asset_id=a.id);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- A collector may remove Storage after releasing its SQL transaction. Prevent
-- a new reference from reviving a retired asset during that interval.
create function public.editorial_image_reference_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare state text;
begin
  if new.asset_id is not null then
    select prompt into state from public.kdp_assets where id=new.asset_id for update;
    if state in ('editorial-image-v1:pending','editorial-image-v1:garbage') then
      raise exception 'editorial_invalid_target' using errcode='22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger editorial_image_reference_v1 before insert or update of asset_id on public.kdp_section_blocks
for each row execute function public.editorial_image_reference_v1();

create function public.editorial_image_detach_v1() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  update public.kdp_assets set prompt='editorial-image-v1:garbage'
    where id=old.asset_id and prompt='editorial-image-v1:active'
      and not exists (select 1 from public.kdp_section_blocks where asset_id=old.asset_id and id<>old.id);
  return old;
end;
$$;
create trigger editorial_image_detach_v1 after delete on public.kdp_section_blocks
for each row execute function public.editorial_image_detach_v1();

alter function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb)
rename to apply_editorial_section_change_core_v1;

create function public.apply_editorial_section_change_v1(
  p_book_id uuid,p_section_id uuid,p_expected_revision integer,p_expected_order uuid[],p_change jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  op text := p_change->>'operation'; result jsonb; target uuid; asset uuid; previous uuid;
begin
  if op not in ('add_image','replace_image','style_image','discard_image_upload') then
    return public.apply_editorial_section_change_core_v1(p_book_id,p_section_id,p_expected_revision,p_expected_order,p_change);
  end if;
  perform public.editorial_book_access_v1(p_book_id);
  if op='discard_image_upload' then
    result := public.apply_editorial_section_change_core_v1(p_book_id,p_section_id,p_expected_revision,p_expected_order,
      jsonb_build_object('operation','reorder','order',to_jsonb(p_expected_order)));
    update public.kdp_assets a set prompt='editorial-image-v1:garbage'
      where a.id=(p_change->>'asset_id')::uuid and a.book_id=p_book_id and a.prompt='editorial-image-v1:pending'
        and not exists (select 1 from public.kdp_section_blocks where asset_id=a.id);
    if not found then raise exception 'editorial_invalid_target' using errcode='22023'; end if;
    return result;
  end if;
  if coalesce(p_change->>'size','') not in ('small','medium','text') or coalesce(p_change->>'align','') not in ('left','center','right') then
    raise exception 'editorial_invalid_target' using errcode='22023';
  end if;
  target := nullif(p_change->>'block_id','')::uuid;
  if op <> 'add_image' then
    select asset_id into previous from public.kdp_section_blocks
      where id=target and book_id=p_book_id and section_id=p_section_id and block_type='image' for update;
    if not found then raise exception 'editorial_invalid_target' using errcode='22023'; end if;
  end if;
  if op <> 'style_image' then
    asset := (p_change->>'asset_id')::uuid;
    perform 1 from public.kdp_assets where id=asset and book_id=p_book_id
      and asset_type='image' and prompt='editorial-image-v1:pending' and file_path is not null for update;
    if not found then raise exception 'editorial_invalid_target' using errcode='22023'; end if;
  end if;
  result := public.apply_editorial_section_change_core_v1(p_book_id,p_section_id,p_expected_revision,p_expected_order,
    case when op='add_image' then jsonb_build_object('operation','add_text','body','image','subsection_id',p_change->'subsection_id')
    else jsonb_build_object('operation','reorder','order',to_jsonb(p_expected_order)) end);
  if op='add_image' then target := (result->>'block_id')::uuid; end if;
  if op <> 'style_image' then
    update public.kdp_assets set prompt='editorial-image-v1:active',status='uploaded' where id=asset;
  end if;
  update public.kdp_section_blocks set block_type='image',title=null,body=null,
    asset_id=case when op='style_image' then previous else asset end,
    editor_notes=jsonb_build_object('size',p_change->>'size','align',p_change->>'align')::text
    where id=target and book_id=p_book_id and section_id=p_section_id;
  if op <> 'style_image' then
    update public.kdp_assets set prompt='editorial-image-v1:garbage' where id=previous and prompt='editorial-image-v1:active'
      and not exists (select 1 from public.kdp_section_blocks where asset_id=previous);
  end if;
  return result;
end;
$$;
revoke all on function public.editorial_image_detach_v1() from public,anon;
revoke all on function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb) from public,anon;
grant execute on function public.editorial_image_detach_v1() to authenticated;
grant execute on function public.apply_editorial_section_change_v1(uuid,uuid,integer,uuid[],jsonb) to authenticated;
revoke all on function public.collect_editorial_image_uploads_v1(uuid) from public,anon;
revoke all on function public.editorial_image_reference_v1() from public,anon;
grant execute on function public.collect_editorial_image_uploads_v1(uuid) to authenticated;
grant execute on function public.editorial_image_reference_v1() to authenticated;
