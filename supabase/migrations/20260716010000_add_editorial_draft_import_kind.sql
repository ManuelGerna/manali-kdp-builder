alter table public.kdp_import_runs
  drop constraint if exists kdp_import_runs_import_kind_check;

alter table public.kdp_import_runs
  add constraint kdp_import_runs_import_kind_check check (
    import_kind in (
      'legacy_structured_draft',
      'generic_draft_v0',
      'editorial_draft_v1'
    )
  );
