grant usage on schema public to authenticated;

grant select, insert, delete
on table public.kdp_books
to authenticated;

grant select, insert
on table public.kdp_book_settings
to authenticated;

grant select
on table public.kdp_sections
to authenticated;
