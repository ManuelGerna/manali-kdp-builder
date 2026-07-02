alter table public.kdp_books
  drop constraint if exists kdp_books_book_type_check;

alter table public.kdp_books
  add constraint kdp_books_book_type_check check (
    book_type in (
      'crystal_guide_journal',
      'generic_kdp_book'
    )
  );

alter table public.kdp_import_runs
  add column if not exists import_kind text not null default 'legacy_structured_draft',
  add column if not exists parser_version text,
  add column if not exists source_draft_version text,
  add column if not exists normalized_project jsonb,
  add column if not exists cover_brief jsonb,
  add column if not exists kdp_metadata jsonb,
  add column if not exists quality_checklist jsonb;

alter table public.kdp_import_runs
  drop constraint if exists kdp_import_runs_import_kind_check;

alter table public.kdp_import_runs
  add constraint kdp_import_runs_import_kind_check check (
    import_kind in (
      'legacy_structured_draft',
      'generic_draft_v0'
    )
  );

create table if not exists public.kdp_imported_pages (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.kdp_books(id) on delete cascade,
  import_run_id uuid references public.kdp_import_runs(id) on delete set null,
  section_id uuid references public.kdp_sections(id) on delete set null,
  page_number integer not null,
  template_id text,
  title text,
  source_type text,
  source_ref text,
  status text not null default 'imported',
  content jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kdp_imported_pages_page_number_check check (page_number > 0),
  constraint kdp_imported_pages_book_page_unique unique (book_id, page_number),
  constraint kdp_imported_pages_status_check check (
    status in (
      'imported',
      'needs_review',
      'invalid'
    )
  ),
  constraint kdp_imported_pages_source_type_check check (
    source_type is null
    or source_type in (
      'fixed_page',
      'repeated_page',
      'generated_interval',
      'imported_draft'
    )
  ),
  constraint kdp_imported_pages_warnings_array_check check (
    jsonb_typeof(warnings) = 'array'
  ),
  constraint kdp_imported_pages_errors_array_check check (
    jsonb_typeof(errors) = 'array'
  )
);

create index if not exists kdp_imported_pages_book_id_idx
  on public.kdp_imported_pages(book_id);

create index if not exists kdp_imported_pages_import_run_id_idx
  on public.kdp_imported_pages(import_run_id);

create index if not exists kdp_imported_pages_section_id_idx
  on public.kdp_imported_pages(section_id);

create index if not exists kdp_imported_pages_template_id_idx
  on public.kdp_imported_pages(template_id);

drop trigger if exists set_kdp_imported_pages_updated_at
on public.kdp_imported_pages;

create trigger set_kdp_imported_pages_updated_at
before update on public.kdp_imported_pages
for each row execute function public.set_updated_at();

alter table public.kdp_imported_pages enable row level security;

grant select, insert, update, delete
on table public.kdp_imported_pages
to authenticated;

drop policy if exists "kdp_imported_pages_select_own_book"
on public.kdp_imported_pages;

create policy "kdp_imported_pages_select_own_book"
on public.kdp_imported_pages
for select
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_imported_pages.book_id
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_imported_pages_insert_own_book"
on public.kdp_imported_pages;

create policy "kdp_imported_pages_insert_own_book"
on public.kdp_imported_pages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_imported_pages.book_id
      and kdp_books.created_by = auth.uid()
  )
  and (
    kdp_imported_pages.import_run_id is null
    or exists (
      select 1
      from public.kdp_import_runs
      where kdp_import_runs.id = kdp_imported_pages.import_run_id
        and kdp_import_runs.book_id = kdp_imported_pages.book_id
    )
  )
  and (
    kdp_imported_pages.section_id is null
    or exists (
      select 1
      from public.kdp_sections
      where kdp_sections.id = kdp_imported_pages.section_id
        and kdp_sections.book_id = kdp_imported_pages.book_id
    )
  )
);

drop policy if exists "kdp_imported_pages_update_own_book"
on public.kdp_imported_pages;

create policy "kdp_imported_pages_update_own_book"
on public.kdp_imported_pages
for update
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_imported_pages.book_id
      and kdp_books.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_imported_pages.book_id
      and kdp_books.created_by = auth.uid()
  )
  and (
    kdp_imported_pages.import_run_id is null
    or exists (
      select 1
      from public.kdp_import_runs
      where kdp_import_runs.id = kdp_imported_pages.import_run_id
        and kdp_import_runs.book_id = kdp_imported_pages.book_id
    )
  )
  and (
    kdp_imported_pages.section_id is null
    or exists (
      select 1
      from public.kdp_sections
      where kdp_sections.id = kdp_imported_pages.section_id
        and kdp_sections.book_id = kdp_imported_pages.book_id
    )
  )
);

drop policy if exists "kdp_imported_pages_delete_own_book"
on public.kdp_imported_pages;

create policy "kdp_imported_pages_delete_own_book"
on public.kdp_imported_pages
for delete
to authenticated
using (
  exists (
    select 1
    from public.kdp_books
    where kdp_books.id = kdp_imported_pages.book_id
      and kdp_books.created_by = auth.uid()
  )
);
