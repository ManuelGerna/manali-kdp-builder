alter table public.kdp_books
  add column if not exists created_by_user_id uuid,
  add column if not exists created_by_email text,
  add column if not exists updated_by_user_id uuid,
  add column if not exists updated_by_email text;

alter table public.kdp_sections
  add column if not exists created_by_user_id uuid,
  add column if not exists created_by_email text,
  add column if not exists updated_by_user_id uuid,
  add column if not exists updated_by_email text;

alter table public.kdp_section_blocks
  add column if not exists created_by_user_id uuid,
  add column if not exists created_by_email text,
  add column if not exists updated_by_user_id uuid,
  add column if not exists updated_by_email text;

alter table public.kdp_assets
  add column if not exists created_by_user_id uuid,
  add column if not exists created_by_email text,
  add column if not exists updated_by_user_id uuid,
  add column if not exists updated_by_email text;

update public.kdp_books
set
  created_by_user_id = coalesce(created_by_user_id, created_by),
  updated_by_user_id = coalesce(updated_by_user_id, created_by)
where created_by is not null
  and (
    created_by_user_id is null
    or updated_by_user_id is null
  );

create index if not exists kdp_books_created_by_user_id_idx
  on public.kdp_books(created_by_user_id);

create index if not exists kdp_sections_created_by_user_id_idx
  on public.kdp_sections(created_by_user_id);

create index if not exists kdp_section_blocks_created_by_user_id_idx
  on public.kdp_section_blocks(created_by_user_id);

create index if not exists kdp_assets_created_by_user_id_idx
  on public.kdp_assets(created_by_user_id);
