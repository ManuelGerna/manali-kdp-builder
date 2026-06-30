with target_tables(table_name) as (
  values
    ('kdp_books'),
    ('kdp_sections'),
    ('kdp_section_blocks'),
    ('kdp_assets')
),
expected_columns(table_name, column_name) as (
  select target_tables.table_name, ownership_columns.column_name
  from target_tables
  cross join (
    values
      ('created_by_user_id'),
      ('created_by_email'),
      ('updated_by_user_id'),
      ('updated_by_email')
  ) as ownership_columns(column_name)
),
expected_table_grants(grantee, table_name, privilege_name) as (
  values
    ('authenticated', 'kdp_books', 'SELECT'),
    ('authenticated', 'kdp_books', 'INSERT'),
    ('authenticated', 'kdp_books', 'UPDATE'),
    ('authenticated', 'kdp_sections', 'SELECT'),
    ('authenticated', 'kdp_sections', 'INSERT'),
    ('authenticated', 'kdp_sections', 'UPDATE'),
    ('authenticated', 'kdp_section_blocks', 'SELECT'),
    ('authenticated', 'kdp_section_blocks', 'INSERT'),
    ('authenticated', 'kdp_section_blocks', 'UPDATE'),
    ('authenticated', 'kdp_assets', 'SELECT'),
    ('authenticated', 'kdp_assets', 'INSERT'),
    ('authenticated', 'kdp_assets', 'UPDATE')
),
expected_policies(table_name, policy_name) as (
  values
    ('kdp_books', 'kdp_books_select_own'),
    ('kdp_books', 'kdp_books_insert_own'),
    ('kdp_books', 'kdp_books_update_own'),
    ('kdp_sections', 'kdp_sections_select_own_book'),
    ('kdp_sections', 'kdp_sections_insert_own_book'),
    ('kdp_sections', 'kdp_sections_update_own_book'),
    ('kdp_section_blocks', 'kdp_section_blocks_select_own_book'),
    ('kdp_section_blocks', 'kdp_section_blocks_insert_own_book'),
    ('kdp_section_blocks', 'kdp_section_blocks_update_own_book'),
    ('kdp_assets', 'kdp_assets_select_own_book'),
    ('kdp_assets', 'kdp_assets_insert_own_book'),
    ('kdp_assets', 'kdp_assets_update_own_book')
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
    'rls_enabled:' || target_tables.table_name as check_name,
    case
      when pg_class.relrowsecurity then 'passed'
      else 'failed'
    end as status,
    'public.' || target_tables.table_name as details
  from target_tables
  left join pg_class
    on pg_class.oid = to_regclass('public.' || target_tables.table_name)
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
order by check_name;
