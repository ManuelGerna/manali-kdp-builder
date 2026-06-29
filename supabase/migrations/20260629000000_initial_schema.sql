create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.kdp_books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  subtitle text,
  author_name text not null check (char_length(trim(author_name)) > 0),
  language text not null default 'it',
  book_type text not null default 'crystal_guide_journal',
  status text not null default 'draft',
  ai_usage_type text not null default 'none',
  internal_description text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kdp_books_book_type_check check (
    book_type in ('crystal_guide_journal')
  ),
  constraint kdp_books_status_check check (
    status in (
      'draft',
      'in_review',
      'ready_for_export',
      'exported',
      'uploaded_to_kdp',
      'published',
      'archived'
    )
  ),
  constraint kdp_books_ai_usage_type_check check (
    ai_usage_type in ('none', 'ai_assisted', 'ai_generated', 'mixed')
  )
);

create table public.kdp_book_settings (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.kdp_books(id) on delete cascade,
  trim_size text not null default '6x9',
  bleed boolean not null default false,
  interior_type text not null default 'black_and_white',
  paper_type text not null default 'white',
  body_font text not null default 'Lora',
  heading_font text not null default 'Cormorant Garamond',
  body_font_size numeric not null default 11,
  line_height numeric not null default 1.35,
  margin_top numeric not null default 0.75,
  margin_bottom numeric not null default 0.75,
  margin_inner numeric not null default 0.75,
  margin_outer numeric not null default 0.60,
  page_numbering boolean not null default true,
  header_enabled boolean not null default false,
  footer_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kdp_book_settings_book_unique unique (book_id),
  constraint kdp_book_settings_trim_size_check check (trim_size = '6x9'),
  constraint kdp_book_settings_bleed_check check (bleed = false),
  constraint kdp_book_settings_interior_type_check check (
    interior_type = 'black_and_white'
  ),
  constraint kdp_book_settings_paper_type_check check (paper_type = 'white'),
  constraint kdp_book_settings_body_font_size_check check (
    body_font_size >= 8 and body_font_size <= 18
  ),
  constraint kdp_book_settings_line_height_check check (
    line_height >= 1 and line_height <= 2
  ),
  constraint kdp_book_settings_margins_check check (
    margin_top >= 0.5
    and margin_bottom >= 0.5
    and margin_inner >= 0.5
    and margin_outer >= 0.5
  )
);

create table public.kdp_sections (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.kdp_books(id) on delete cascade,
  section_type text not null,
  title text,
  body text,
  sort_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kdp_sections_section_type_check check (
    section_type in (
      'title_page',
      'disclaimer',
      'introduction',
      'chapter_text',
      'crystal_card',
      'affirmation_page',
      'journaling_page',
      'notes_page',
      'summary_table',
      'conclusion',
      'blank_page'
    )
  )
);

create table public.kdp_exports (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.kdp_books(id) on delete cascade,
  export_type text not null,
  file_path text,
  file_name text,
  page_count integer,
  validation_status text not null default 'not_checked',
  validation_report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint kdp_exports_export_type_check check (
    export_type in (
      'interior_pdf',
      'kdp_fields_txt',
      'validation_report_txt',
      'preview_images'
    )
  ),
  constraint kdp_exports_validation_status_check check (
    validation_status in ('not_checked', 'passed', 'warning', 'failed')
  ),
  constraint kdp_exports_page_count_check check (
    page_count is null or page_count > 0
  )
);

create index kdp_books_created_by_idx on public.kdp_books(created_by);
create index kdp_books_status_idx on public.kdp_books(status);
create index kdp_book_settings_book_id_idx on public.kdp_book_settings(book_id);
create index kdp_sections_book_id_sort_order_idx
  on public.kdp_sections(book_id, sort_order);
create index kdp_exports_book_id_created_at_idx
  on public.kdp_exports(book_id, created_at desc);

create trigger set_kdp_books_updated_at
before update on public.kdp_books
for each row execute function public.set_updated_at();

create trigger set_kdp_book_settings_updated_at
before update on public.kdp_book_settings
for each row execute function public.set_updated_at();

create trigger set_kdp_sections_updated_at
before update on public.kdp_sections
for each row execute function public.set_updated_at();

alter table public.kdp_books enable row level security;
alter table public.kdp_book_settings enable row level security;
alter table public.kdp_sections enable row level security;
alter table public.kdp_exports enable row level security;

create policy "kdp_books_select_own"
on public.kdp_books
for select
to authenticated
using (created_by = auth.uid());

create policy "kdp_books_insert_own"
on public.kdp_books
for insert
to authenticated
with check (created_by = auth.uid());

create policy "kdp_books_update_own"
on public.kdp_books
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "kdp_books_delete_own"
on public.kdp_books
for delete
to authenticated
using (created_by = auth.uid());

create policy "kdp_book_settings_select_own_book"
on public.kdp_book_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_book_settings.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_book_settings_insert_own_book"
on public.kdp_book_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_book_settings.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_book_settings_update_own_book"
on public.kdp_book_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_book_settings.book_id
      and kdp_books.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_book_settings.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_book_settings_delete_own_book"
on public.kdp_book_settings
for delete
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_book_settings.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_sections_select_own_book"
on public.kdp_sections
for select
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_sections.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_sections_insert_own_book"
on public.kdp_sections
for insert
to authenticated
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_sections.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_sections_update_own_book"
on public.kdp_sections
for update
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_sections.book_id
      and kdp_books.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_sections.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_sections_delete_own_book"
on public.kdp_sections
for delete
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_sections.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_exports_select_own_book"
on public.kdp_exports
for select
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_exports.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_exports_insert_own_book"
on public.kdp_exports
for insert
to authenticated
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_exports.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_exports_update_own_book"
on public.kdp_exports
for update
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_exports.book_id
      and kdp_books.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_exports.book_id
      and kdp_books.created_by = auth.uid()
  )
);

create policy "kdp_exports_delete_own_book"
on public.kdp_exports
for delete
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_exports.book_id
      and kdp_books.created_by = auth.uid()
  )
);
