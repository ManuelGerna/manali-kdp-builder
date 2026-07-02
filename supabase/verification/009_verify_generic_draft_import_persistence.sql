with expected_import_run_columns(column_name) as (
  values
    ('import_kind'),
    ('parser_version'),
    ('source_draft_version'),
    ('normalized_project'),
    ('cover_brief'),
    ('kdp_metadata'),
    ('quality_checklist')
),
expected_imported_page_columns(column_name) as (
  values
    ('id'),
    ('book_id'),
    ('import_run_id'),
    ('section_id'),
    ('page_number'),
    ('template_id'),
    ('title'),
    ('source_type'),
    ('source_ref'),
    ('status'),
    ('content'),
    ('warnings'),
    ('errors'),
    ('created_at'),
    ('updated_at')
),
expected_table_grants(grantee, table_name, privilege_name) as (
  values
    ('authenticated', 'kdp_imported_pages', 'SELECT'),
    ('authenticated', 'kdp_imported_pages', 'INSERT'),
    ('authenticated', 'kdp_imported_pages', 'UPDATE'),
    ('authenticated', 'kdp_imported_pages', 'DELETE')
),
expected_policies(table_name, policy_name) as (
  values
    ('kdp_imported_pages', 'kdp_imported_pages_select_own_book'),
    ('kdp_imported_pages', 'kdp_imported_pages_insert_own_book'),
    ('kdp_imported_pages', 'kdp_imported_pages_update_own_book'),
    ('kdp_imported_pages', 'kdp_imported_pages_delete_own_book')
),
expected_constraints(table_name, constraint_name) as (
  values
    ('kdp_books', 'kdp_books_book_type_check'),
    ('kdp_import_runs', 'kdp_import_runs_import_kind_check'),
    ('kdp_imported_pages', 'kdp_imported_pages_book_page_unique'),
    ('kdp_imported_pages', 'kdp_imported_pages_page_number_check'),
    ('kdp_imported_pages', 'kdp_imported_pages_status_check'),
    ('kdp_imported_pages', 'kdp_imported_pages_source_type_check'),
    ('kdp_imported_pages', 'kdp_imported_pages_warnings_array_check'),
    ('kdp_imported_pages', 'kdp_imported_pages_errors_array_check')
),
expected_constraint_values(table_name, constraint_name, allowed_value) as (
  values
    ('kdp_books', 'kdp_books_book_type_check', 'generic_kdp_book'),
    ('kdp_import_runs', 'kdp_import_runs_import_kind_check', 'legacy_structured_draft'),
    ('kdp_import_runs', 'kdp_import_runs_import_kind_check', 'generic_draft_v0'),
    ('kdp_imported_pages', 'kdp_imported_pages_status_check', 'imported'),
    ('kdp_imported_pages', 'kdp_imported_pages_status_check', 'needs_review'),
    ('kdp_imported_pages', 'kdp_imported_pages_status_check', 'invalid'),
    ('kdp_imported_pages', 'kdp_imported_pages_source_type_check', 'fixed_page'),
    ('kdp_imported_pages', 'kdp_imported_pages_source_type_check', 'repeated_page'),
    ('kdp_imported_pages', 'kdp_imported_pages_source_type_check', 'generated_interval'),
    ('kdp_imported_pages', 'kdp_imported_pages_source_type_check', 'imported_draft')
),
expected_indexes(index_name) as (
  values
    ('kdp_imported_pages_book_page_unique'),
    ('kdp_imported_pages_book_id_idx'),
    ('kdp_imported_pages_import_run_id_idx'),
    ('kdp_imported_pages_section_id_idx'),
    ('kdp_imported_pages_template_id_idx')
),
import_run_column_checks as (
  select
    'column_exists:kdp_import_runs:' || expected_import_run_columns.column_name
      as check_name,
    case
      when information_schema.columns.column_name is not null then 'passed'
      else 'failed'
    end as status,
    'public.kdp_import_runs.' || expected_import_run_columns.column_name
      as details
  from expected_import_run_columns
  left join information_schema.columns
    on information_schema.columns.table_schema = 'public'
    and information_schema.columns.table_name = 'kdp_import_runs'
    and information_schema.columns.column_name =
      expected_import_run_columns.column_name
),
table_checks as (
  select
    'table_exists:kdp_imported_pages' as check_name,
    case
      when to_regclass('public.kdp_imported_pages') is not null then 'passed'
      else 'failed'
    end as status,
    'public.kdp_imported_pages' as details
),
imported_page_column_checks as (
  select
    'column_exists:kdp_imported_pages:'
      || expected_imported_page_columns.column_name as check_name,
    case
      when information_schema.columns.column_name is not null then 'passed'
      else 'failed'
    end as status,
    'public.kdp_imported_pages.'
      || expected_imported_page_columns.column_name as details
  from expected_imported_page_columns
  left join information_schema.columns
    on information_schema.columns.table_schema = 'public'
    and information_schema.columns.table_name = 'kdp_imported_pages'
    and information_schema.columns.column_name =
      expected_imported_page_columns.column_name
),
rls_checks as (
  select
    'rls_enabled:kdp_imported_pages' as check_name,
    case
      when pg_class.relrowsecurity then 'passed'
      else 'failed'
    end as status,
    'public.kdp_imported_pages' as details
  from pg_class
  where pg_class.oid = to_regclass('public.kdp_imported_pages')
),
table_grant_checks as (
  select
    'table_grant:' || table_name || ':' || privilege_name as check_name,
    case
      when has_table_privilege(
        grantee,
        'public.' || table_name,
        privilege_name
      )
        then 'passed'
      else 'failed'
    end as status,
    grantee || ' -> public.' || table_name || ' -> ' || privilege_name
      as details
  from expected_table_grants
),
policy_checks as (
  select
    'policy_exists:' || policy_name as check_name,
    case
      when pg_policies.policyname is not null then 'passed'
      else 'failed'
    end as status,
    expected_policies.table_name || ' -> ' || expected_policies.policy_name
      as details
  from expected_policies
  left join pg_policies
    on pg_policies.schemaname = 'public'
    and pg_policies.tablename = expected_policies.table_name
    and pg_policies.policyname = expected_policies.policy_name
    and 'authenticated' = any(pg_policies.roles)
),
constraint_checks as (
  select
    'constraint_exists:' || constraint_name as check_name,
    case
      when pg_constraint.conname is not null then 'passed'
      else 'failed'
    end as status,
    'public.' || expected_constraints.table_name
      || ' -> ' || expected_constraints.constraint_name as details
  from expected_constraints
  left join pg_constraint
    on pg_constraint.conname = expected_constraints.constraint_name
    and pg_constraint.conrelid =
      to_regclass('public.' || expected_constraints.table_name)
),
constraint_value_checks as (
  select
    'constraint_value:' || constraint_name || ':' || allowed_value
      as check_name,
    case
      when pg_get_constraintdef(pg_constraint.oid)
        like '%' || quote_literal(allowed_value) || '%'
        then 'passed'
      else 'failed'
    end as status,
    'public.' || expected_constraint_values.table_name
      || ' -> ' || expected_constraint_values.allowed_value as details
  from expected_constraint_values
  left join pg_constraint
    on pg_constraint.conname = expected_constraint_values.constraint_name
    and pg_constraint.conrelid =
      to_regclass('public.' || expected_constraint_values.table_name)
),
index_checks as (
  select
    'index_exists:' || index_name as check_name,
    case
      when to_regclass('public.' || index_name) is not null then 'passed'
      else 'failed'
    end as status,
    'public.' || index_name as details
  from expected_indexes
)
select check_name, status, details
from import_run_column_checks
union all
select check_name, status, details
from table_checks
union all
select check_name, status, details
from imported_page_column_checks
union all
select check_name, status, details
from rls_checks
union all
select check_name, status, details
from table_grant_checks
union all
select check_name, status, details
from policy_checks
union all
select check_name, status, details
from constraint_checks
union all
select check_name, status, details
from constraint_value_checks
union all
select check_name, status, details
from index_checks
order by check_name;
