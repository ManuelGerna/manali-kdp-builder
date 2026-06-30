with expected_columns(table_name, column_name) as (
  values
    ('kdp_books', 'archived_at'),
    ('kdp_books', 'archived_by_user_id'),
    ('kdp_books', 'archived_by_email'),
    ('kdp_import_runs', 'id'),
    ('kdp_import_runs', 'book_id'),
    ('kdp_import_runs', 'import_token'),
    ('kdp_import_runs', 'draft_hash'),
    ('kdp_import_runs', 'report'),
    ('kdp_import_runs', 'created_by_user_id'),
    ('kdp_import_runs', 'created_by_email'),
    ('kdp_import_runs', 'created_at')
),
expected_table_grants(grantee, table_name, privilege_name) as (
  values
    ('authenticated', 'kdp_books', 'UPDATE'),
    ('authenticated', 'kdp_import_runs', 'SELECT'),
    ('authenticated', 'kdp_import_runs', 'INSERT'),
    ('authenticated', 'kdp_import_runs', 'UPDATE')
),
expected_policies(table_name, policy_name) as (
  values
    ('kdp_import_runs', 'kdp_import_runs_select_own_book'),
    ('kdp_import_runs', 'kdp_import_runs_insert_own_book'),
    ('kdp_import_runs', 'kdp_import_runs_update_own_book')
),
column_checks as (
  select
    'column_exists:' || expected_columns.table_name || ':'
      || expected_columns.column_name as check_name,
    case
      when information_schema.columns.column_name is not null
        then 'passed'
      else 'failed'
    end as status,
    'public.' || expected_columns.table_name || ' -> '
      || expected_columns.column_name as details
  from expected_columns
  left join information_schema.columns
    on information_schema.columns.table_schema = 'public'
    and information_schema.columns.table_name = expected_columns.table_name
    and information_schema.columns.column_name = expected_columns.column_name
),
rls_checks as (
  select
    'rls_enabled:kdp_import_runs' as check_name,
    case
      when pg_class.relrowsecurity then 'passed'
      else 'failed'
    end as status,
    'public.kdp_import_runs' as details
  from pg_class
  where pg_class.oid = to_regclass('public.kdp_import_runs')
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
function_checks as (
  select
    'function_exists:import_kdp_structured_draft_v2' as check_name,
    case
      when to_regprocedure(
        'public.import_kdp_structured_draft_v2(uuid,uuid,text,text,jsonb)'
      ) is not null
        then 'passed'
      else 'failed'
    end as status,
    'public.import_kdp_structured_draft_v2(uuid, uuid, text, text, jsonb)'
      as details
  union all
  select
    'function_grant:import_kdp_structured_draft_v2:EXECUTE' as check_name,
    case
      when has_function_privilege(
        'authenticated',
        'public.import_kdp_structured_draft_v2(uuid,uuid,text,text,jsonb)',
        'EXECUTE'
      )
        then 'passed'
      else 'failed'
    end as status,
    'authenticated -> public.import_kdp_structured_draft_v2 -> EXECUTE'
      as details
)
select check_name, status, details
from column_checks
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
from function_checks
order by check_name;
