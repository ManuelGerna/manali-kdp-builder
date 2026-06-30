alter table public.kdp_books
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid,
  add column if not exists archived_by_email text;

update public.kdp_books
set
  archived_at = coalesce(archived_at, updated_at, created_at, now()),
  archived_by_user_id = coalesce(
    archived_by_user_id,
    updated_by_user_id,
    created_by_user_id,
    created_by
  ),
  archived_by_email = coalesce(
    archived_by_email,
    updated_by_email,
    created_by_email
  )
where status = 'archived'
  and archived_at is null;

create index if not exists kdp_books_archived_at_idx
  on public.kdp_books(archived_at);

grant update
on table public.kdp_books
to authenticated;

create table if not exists public.kdp_import_runs (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.kdp_books(id) on delete cascade,
  import_token uuid not null,
  draft_hash text not null check (char_length(trim(draft_hash)) > 0),
  report jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  constraint kdp_import_runs_book_token_unique unique (book_id, import_token)
);

create index if not exists kdp_import_runs_book_created_at_idx
  on public.kdp_import_runs(book_id, created_at desc);

alter table public.kdp_import_runs enable row level security;

grant select, insert, update
on table public.kdp_import_runs
to authenticated;

drop policy if exists "kdp_import_runs_select_own_book"
on public.kdp_import_runs;

create policy "kdp_import_runs_select_own_book"
on public.kdp_import_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_import_runs.book_id
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_import_runs_insert_own_book"
on public.kdp_import_runs;

create policy "kdp_import_runs_insert_own_book"
on public.kdp_import_runs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_import_runs.book_id
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_import_runs_update_own_book"
on public.kdp_import_runs;

create policy "kdp_import_runs_update_own_book"
on public.kdp_import_runs
for update
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_import_runs.book_id
      and kdp_books.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_import_runs.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create or replace function public.import_kdp_structured_draft_v2(
  p_book_id uuid,
  p_import_token uuid,
  p_draft_hash text,
  p_actor_email text,
  p_sections jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  duplicate_report jsonb;
  import_run_id uuid;
  import_report jsonb;
  next_section_sort_order integer;
  section_created_count integer := 0;
  block_created_count integer := 0;
  image_placeholder_count integer := 0;
  warnings text[] := array[]::text[];
  section_item jsonb;
  section_id uuid;
  section_title text;
  section_notes text;
  block_item jsonb;
  block_sort_order integer;
  block_type text;
  block_title text;
  block_body text;
  block_prompt text;
  block_notes text;
  asset_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_book_id is null or p_import_token is null then
    raise exception 'invalid_import_request' using errcode = '22023';
  end if;

  if p_draft_hash is null or char_length(trim(p_draft_hash)) = 0 then
    raise exception 'invalid_import_hash' using errcode = '22023';
  end if;

  if p_sections is null
    or jsonb_typeof(p_sections) <> 'array'
    or jsonb_array_length(p_sections) = 0
  then
    raise exception 'empty_import_payload' using errcode = '22023';
  end if;

  perform 1
  from public.kdp_books
  where id = p_book_id
    and created_by = current_user_id
    and archived_at is null
    and status <> 'archived';

  if not found then
    raise exception 'book_not_found_or_archived' using errcode = 'P0002';
  end if;

  insert into public.kdp_import_runs (
    book_id,
    import_token,
    draft_hash,
    created_by_user_id,
    created_by_email
  )
  values (
    p_book_id,
    p_import_token,
    trim(p_draft_hash),
    current_user_id,
    nullif(trim(coalesce(p_actor_email, '')), '')
  )
  on conflict (book_id, import_token) do nothing
  returning id into import_run_id;

  if import_run_id is null then
    select report
    into duplicate_report
    from public.kdp_import_runs
    where book_id = p_book_id
      and import_token = p_import_token;

    duplicate_report := coalesce(
      duplicate_report,
      jsonb_build_object(
        'sectionCount', 0,
        'blockCount', 0,
        'imagePlaceholderCount', 0,
        'warnings', '[]'::jsonb,
        'warningCount', 0
      )
    );

    duplicate_report := duplicate_report
      || jsonb_build_object(
        'duplicate', true,
        'warnings',
          coalesce(duplicate_report->'warnings', '[]'::jsonb)
          || to_jsonb(array[
            'Import gia registrato: nessun contenuto duplicato.'
          ]),
        'warningCount',
          jsonb_array_length(coalesce(duplicate_report->'warnings', '[]'::jsonb))
          + 1
      );

    return duplicate_report;
  end if;

  select coalesce(max(sort_order), 0) + 1
  into next_section_sort_order
  from public.kdp_sections
  where book_id = p_book_id;

  for section_item in
    select value
    from jsonb_array_elements(p_sections) as section_values(value)
  loop
    if jsonb_typeof(coalesce(section_item->'blocks', '[]'::jsonb)) <> 'array' then
      raise exception 'invalid_section_blocks' using errcode = '22023';
    end if;

    if jsonb_typeof(coalesce(section_item->'editorNotes', '[]'::jsonb)) <> 'array' then
      raise exception 'invalid_section_notes' using errcode = '22023';
    end if;

    section_title := nullif(trim(coalesce(section_item->>'title', '')), '');

    if section_title is null then
      section_title := 'Sezione importata';
      warnings := array_append(
        warnings,
        'Una sezione senza titolo e'' stata salvata come "Sezione importata".'
      );
    end if;

    select nullif(string_agg(note_values.value, E'\n'), '')
    into section_notes
    from jsonb_array_elements_text(
      coalesce(section_item->'editorNotes', '[]'::jsonb)
    ) as note_values(value);

    insert into public.kdp_sections (
      book_id,
      section_type,
      title,
      subtitle,
      body,
      sort_order,
      include_in_toc,
      section_status,
      page_break_before,
      layout_preset,
      editor_notes,
      created_by_user_id,
      created_by_email,
      updated_by_user_id,
      updated_by_email
    )
    values (
      p_book_id,
      'chapter',
      section_title,
      null,
      null,
      next_section_sort_order + section_created_count,
      true,
      'draft',
      false,
      'default',
      section_notes,
      current_user_id,
      nullif(trim(coalesce(p_actor_email, '')), ''),
      current_user_id,
      nullif(trim(coalesce(p_actor_email, '')), '')
    )
    returning id into section_id;

    section_created_count := section_created_count + 1;
    block_sort_order := 1;

    for block_item in
      select value
      from jsonb_array_elements(
        coalesce(section_item->'blocks', '[]'::jsonb)
      ) as block_values(value)
    loop
      block_type := coalesce(block_item->>'blockType', 'text');

      if block_type not in ('text', 'image_prompt', 'page_break') then
        raise exception 'invalid_block_type' using errcode = '22023';
      end if;

      block_title := nullif(trim(coalesce(block_item->>'title', '')), '');
      block_body := nullif(trim(coalesce(block_item->>'body', '')), '');
      block_prompt := nullif(trim(coalesce(block_item->>'prompt', '')), '');
      block_notes := nullif(trim(coalesce(block_item->>'editorNotes', '')), '');
      asset_id := null;

      if block_type = 'image_prompt' then
        insert into public.kdp_assets (
          book_id,
          asset_type,
          title,
          file_path,
          alt_text,
          prompt,
          status,
          created_by_user_id,
          created_by_email,
          updated_by_user_id,
          updated_by_email
        )
        values (
          p_book_id,
          'image',
          coalesce(block_title, 'Immagine da inserire'),
          null,
          null,
          block_prompt,
          'placeholder',
          current_user_id,
          nullif(trim(coalesce(p_actor_email, '')), ''),
          current_user_id,
          nullif(trim(coalesce(p_actor_email, '')), '')
        )
        returning id into asset_id;

        image_placeholder_count := image_placeholder_count + 1;
      end if;

      insert into public.kdp_section_blocks (
        book_id,
        section_id,
        asset_id,
        block_type,
        title,
        body,
        sort_order,
        layout_preset,
        print_visibility,
        editor_notes,
        created_by_user_id,
        created_by_email,
        updated_by_user_id,
        updated_by_email
      )
      values (
        p_book_id,
        section_id,
        asset_id,
        block_type,
        block_title,
        case
          when block_type = 'image_prompt' then coalesce(block_body, block_prompt)
          else block_body
        end,
        block_sort_order,
        case
          when block_type = 'image_prompt' then 'image_text'
          else 'default'
        end,
        'print',
        block_notes,
        current_user_id,
        nullif(trim(coalesce(p_actor_email, '')), ''),
        current_user_id,
        nullif(trim(coalesce(p_actor_email, '')), '')
      );

      block_created_count := block_created_count + 1;
      block_sort_order := block_sort_order + 1;
    end loop;
  end loop;

  import_report := jsonb_build_object(
    'sectionCount', section_created_count,
    'blockCount', block_created_count,
    'imagePlaceholderCount', image_placeholder_count,
    'warnings', to_jsonb(warnings),
    'warningCount', coalesce(array_length(warnings, 1), 0),
    'duplicate', false
  );

  update public.kdp_import_runs
  set report = import_report
  where id = import_run_id;

  update public.kdp_books
  set
    updated_by_user_id = current_user_id,
    updated_by_email = nullif(trim(coalesce(p_actor_email, '')), '')
  where id = p_book_id;

  return import_report;
end;
$$;

revoke execute on function public.import_kdp_structured_draft_v2(
  uuid,
  uuid,
  text,
  text,
  jsonb
) from public;

grant execute on function public.import_kdp_structured_draft_v2(
  uuid,
  uuid,
  text,
  text,
  jsonb
) to authenticated;
