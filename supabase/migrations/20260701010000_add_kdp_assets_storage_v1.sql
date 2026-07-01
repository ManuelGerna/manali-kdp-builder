insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'kdp-assets',
  'kdp-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kdp_assets_storage_select_own_book"
on storage.objects;

create policy "kdp_assets_storage_select_own_book"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'kdp-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.kdp_books
    where kdp_books.id::text = (storage.foldername(name))[2]
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_assets_storage_insert_own_book"
on storage.objects;

create policy "kdp_assets_storage_insert_own_book"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'kdp-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.kdp_books
    where kdp_books.id::text = (storage.foldername(name))[2]
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_assets_storage_update_own_book"
on storage.objects;

create policy "kdp_assets_storage_update_own_book"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'kdp-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.kdp_books
    where kdp_books.id::text = (storage.foldername(name))[2]
      and kdp_books.created_by = auth.uid()
  )
)
with check (
  bucket_id = 'kdp-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.kdp_books
    where kdp_books.id::text = (storage.foldername(name))[2]
      and kdp_books.created_by = auth.uid()
  )
);

drop policy if exists "kdp_assets_storage_delete_own_book"
on storage.objects;

create policy "kdp_assets_storage_delete_own_book"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'kdp-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.kdp_books
    where kdp_books.id::text = (storage.foldername(name))[2]
      and kdp_books.created_by = auth.uid()
  )
);
