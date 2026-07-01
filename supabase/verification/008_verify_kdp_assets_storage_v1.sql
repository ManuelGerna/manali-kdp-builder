do $$
declare
  bucket record;
  matching_policy_count integer;
begin
  select *
  into bucket
  from storage.buckets
  where id = 'kdp-assets';

  if not found then
    raise exception 'missing kdp-assets storage bucket';
  end if;

  if bucket.public is distinct from false then
    raise exception 'kdp-assets bucket must be private';
  end if;

  if bucket.file_size_limit is distinct from 10485760 then
    raise exception 'kdp-assets bucket file_size_limit mismatch';
  end if;

  if bucket.allowed_mime_types is null
    or not (
      bucket.allowed_mime_types @>
      array['image/png', 'image/jpeg', 'image/webp']::text[]
    )
  then
    raise exception 'kdp-assets bucket allowed_mime_types mismatch';
  end if;

  select count(*)
  into matching_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'kdp_assets_storage_select_own_book',
      'kdp_assets_storage_insert_own_book',
      'kdp_assets_storage_update_own_book',
      'kdp_assets_storage_delete_own_book'
    );

  if matching_policy_count <> 4 then
    raise exception 'missing kdp-assets storage policies';
  end if;
end $$;
