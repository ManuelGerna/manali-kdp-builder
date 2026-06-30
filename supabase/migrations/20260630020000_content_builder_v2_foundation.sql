alter table public.kdp_sections
  add column if not exists subtitle text,
  add column if not exists include_in_toc boolean not null default true,
  add column if not exists section_status text not null default 'draft',
  add column if not exists page_break_before boolean not null default false,
  add column if not exists layout_preset text not null default 'default',
  add column if not exists editor_notes text;

update public.kdp_sections
set
  include_in_toc = coalesce(include_in_toc, true),
  section_status = case
    when section_status in ('draft', 'needs_review', 'ready', 'archived')
      then section_status
    else 'draft'
  end,
  page_break_before = coalesce(page_break_before, false),
  layout_preset = case
    when layout_preset in (
      'default',
      'title_page',
      'chapter_opening',
      'image_text',
      'crystal_profile',
      'journal',
      'ritual',
      'list'
    )
      then layout_preset
    else 'default'
  end;

alter table public.kdp_sections
  alter column include_in_toc set default true,
  alter column include_in_toc set not null,
  alter column section_status set default 'draft',
  alter column section_status set not null,
  alter column page_break_before set default false,
  alter column page_break_before set not null,
  alter column layout_preset set default 'default',
  alter column layout_preset set not null;

alter table public.kdp_sections
  drop constraint if exists kdp_sections_section_status_check;

alter table public.kdp_sections
  add constraint kdp_sections_section_status_check check (
    section_status in ('draft', 'needs_review', 'ready', 'archived')
  );

alter table public.kdp_sections
  drop constraint if exists kdp_sections_layout_preset_check;

alter table public.kdp_sections
  add constraint kdp_sections_layout_preset_check check (
    layout_preset in (
      'default',
      'title_page',
      'chapter_opening',
      'image_text',
      'crystal_profile',
      'journal',
      'ritual',
      'list'
    )
  );

create table if not exists public.kdp_assets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.kdp_books(id) on delete cascade,
  asset_type text not null default 'image',
  title text,
  file_path text,
  alt_text text,
  prompt text,
  status text not null default 'placeholder',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

update public.kdp_assets
set
  asset_type = case
    when asset_type in ('image', 'cover_image', 'icon', 'background')
      then asset_type
    else 'image'
  end,
  status = case
    when status in (
      'placeholder',
      'uploaded',
      'generated_future',
      'approved',
      'rejected'
    )
      then status
    else 'placeholder'
  end;

alter table public.kdp_assets
  alter column asset_type set default 'image',
  alter column asset_type set not null,
  alter column status set default 'placeholder',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.kdp_assets
  drop constraint if exists kdp_assets_asset_type_check;

alter table public.kdp_assets
  add constraint kdp_assets_asset_type_check check (
    asset_type in ('image', 'cover_image', 'icon', 'background')
  );

alter table public.kdp_assets
  drop constraint if exists kdp_assets_status_check;

alter table public.kdp_assets
  add constraint kdp_assets_status_check check (
    status in (
      'placeholder',
      'uploaded',
      'generated_future',
      'approved',
      'rejected'
    )
  );

create table if not exists public.kdp_section_blocks (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.kdp_books(id) on delete cascade,
  section_id uuid not null references public.kdp_sections(id) on delete cascade,
  asset_id uuid references public.kdp_assets(id) on delete set null,
  block_type text not null default 'text',
  title text,
  body text,
  sort_order integer not null default 0,
  layout_preset text not null default 'default',
  print_visibility text not null default 'print',
  editor_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

update public.kdp_section_blocks
set
  block_type = case
    when block_type in (
      'text',
      'heading',
      'image',
      'image_prompt',
      'page_break',
      'quote',
      'affirmation',
      'benefits',
      'chakra',
      'ritual',
      'number_list',
      'color_meaning',
      'cta',
      'internal_note'
    )
      then block_type
    else 'text'
  end,
  sort_order = coalesce(sort_order, 0),
  layout_preset = case
    when layout_preset in (
      'default',
      'title_page',
      'chapter_opening',
      'image_text',
      'crystal_profile',
      'journal',
      'ritual',
      'list'
    )
      then layout_preset
    else 'default'
  end,
  print_visibility = case
    when print_visibility in ('print', 'internal_only', 'hidden')
      then print_visibility
    else 'print'
  end;

alter table public.kdp_section_blocks
  alter column block_type set default 'text',
  alter column block_type set not null,
  alter column sort_order set default 0,
  alter column sort_order set not null,
  alter column layout_preset set default 'default',
  alter column layout_preset set not null,
  alter column print_visibility set default 'print',
  alter column print_visibility set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.kdp_section_blocks
  drop constraint if exists kdp_section_blocks_block_type_check;

alter table public.kdp_section_blocks
  add constraint kdp_section_blocks_block_type_check check (
    block_type in (
      'text',
      'heading',
      'image',
      'image_prompt',
      'page_break',
      'quote',
      'affirmation',
      'benefits',
      'chakra',
      'ritual',
      'number_list',
      'color_meaning',
      'cta',
      'internal_note'
    )
  );

alter table public.kdp_section_blocks
  drop constraint if exists kdp_section_blocks_layout_preset_check;

alter table public.kdp_section_blocks
  add constraint kdp_section_blocks_layout_preset_check check (
    layout_preset in (
      'default',
      'title_page',
      'chapter_opening',
      'image_text',
      'crystal_profile',
      'journal',
      'ritual',
      'list'
    )
  );

alter table public.kdp_section_blocks
  drop constraint if exists kdp_section_blocks_print_visibility_check;

alter table public.kdp_section_blocks
  add constraint kdp_section_blocks_print_visibility_check check (
    print_visibility in ('print', 'internal_only', 'hidden')
  );

create index if not exists kdp_section_blocks_book_section_sort_order_idx
  on public.kdp_section_blocks(book_id, section_id, sort_order);

create index if not exists kdp_assets_book_created_at_idx
  on public.kdp_assets(book_id, created_at);

drop trigger if exists set_kdp_assets_updated_at on public.kdp_assets;

create trigger set_kdp_assets_updated_at
before update on public.kdp_assets
for each row execute function public.set_updated_at();

drop trigger if exists set_kdp_section_blocks_updated_at
on public.kdp_section_blocks;

create trigger set_kdp_section_blocks_updated_at
before update on public.kdp_section_blocks
for each row execute function public.set_updated_at();

alter table public.kdp_assets enable row level security;
alter table public.kdp_section_blocks enable row level security;

grant select, insert, update, delete
on table public.kdp_assets
to authenticated;

grant select, insert, update, delete
on table public.kdp_section_blocks
to authenticated;

drop policy if exists "kdp_assets_select_own_book"
on public.kdp_assets;

create policy "kdp_assets_select_own_book"
on public.kdp_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_assets.book_id
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_assets_insert_own_book"
on public.kdp_assets;

create policy "kdp_assets_insert_own_book"
on public.kdp_assets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_assets.book_id
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_assets_update_own_book"
on public.kdp_assets;

create policy "kdp_assets_update_own_book"
on public.kdp_assets
for update
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_assets.book_id
      and kdp_books.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_assets.book_id
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_assets_delete_own_book"
on public.kdp_assets;

create policy "kdp_assets_delete_own_book"
on public.kdp_assets
for delete
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_assets.book_id
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_section_blocks_select_own_book"
on public.kdp_section_blocks;

create policy "kdp_section_blocks_select_own_book"
on public.kdp_section_blocks
for select
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_section_blocks.book_id
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_section_blocks_insert_own_book"
on public.kdp_section_blocks;

create policy "kdp_section_blocks_insert_own_book"
on public.kdp_section_blocks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_section_blocks.book_id
      and kdp_books.created_by = auth.uid()
  )
  and exists (
    select 1
    from public.kdp_sections
    where kdp_sections.id = kdp_section_blocks.section_id
      and kdp_sections.book_id = kdp_section_blocks.book_id
  )
  and (
    kdp_section_blocks.asset_id is null
    or exists (
      select 1
      from public.kdp_assets
      where kdp_assets.id = kdp_section_blocks.asset_id
        and kdp_assets.book_id = kdp_section_blocks.book_id
    )
  )
);

drop policy if exists "kdp_section_blocks_update_own_book"
on public.kdp_section_blocks;

create policy "kdp_section_blocks_update_own_book"
on public.kdp_section_blocks
for update
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_section_blocks.book_id
      and kdp_books.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_section_blocks.book_id
      and kdp_books.created_by = auth.uid()
  )
  and exists (
    select 1
    from public.kdp_sections
    where kdp_sections.id = kdp_section_blocks.section_id
      and kdp_sections.book_id = kdp_section_blocks.book_id
  )
  and (
    kdp_section_blocks.asset_id is null
    or exists (
      select 1
      from public.kdp_assets
      where kdp_assets.id = kdp_section_blocks.asset_id
        and kdp_assets.book_id = kdp_section_blocks.book_id
    )
  )
);

drop policy if exists "kdp_section_blocks_delete_own_book"
on public.kdp_section_blocks;

create policy "kdp_section_blocks_delete_own_book"
on public.kdp_section_blocks
for delete
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_section_blocks.book_id
      and kdp_books.created_by = auth.uid()
  )
);
