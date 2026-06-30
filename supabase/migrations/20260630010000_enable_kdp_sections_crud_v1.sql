grant select, insert, update, delete
on table public.kdp_sections
to authenticated;

alter table public.kdp_sections
  drop constraint if exists kdp_sections_section_type_check;

alter table public.kdp_sections
  add constraint kdp_sections_section_type_check check (
    section_type in (
      'title_page',
      'disclaimer',
      'introduction',
      'chapter',
      'chapter_text',
      'crystal_card',
      'journal_page',
      'journaling_page',
      'affirmation',
      'affirmation_page',
      'notes',
      'notes_page',
      'conclusion',
      'summary_table',
      'blank_page'
    )
  );
