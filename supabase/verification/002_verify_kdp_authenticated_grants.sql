with expected_schema_grants(grantee, schema_name, privilege_name) as (
  values
    ('authenticated', 'public', 'USAGE')
),
expected_table_grants(grantee, table_name, privilege_name) as (
  values
    ('authenticated', 'kdp_books', 'SELECT'),
    ('authenticated', 'kdp_books', 'INSERT'),
    ('authenticated', 'kdp_books', 'DELETE'),
    ('authenticated', 'kdp_book_settings', 'SELECT'),
    ('authenticated', 'kdp_book_settings', 'INSERT'),
    ('authenticated', 'kdp_sections', 'SELECT')
),
expected_policies(table_name, policy_name) as (
  values
    ('kdp_books', 'kdp_books_insert_own'),
    ('kdp_books', 'kdp_books_delete_own'),
    ('kdp_book_settings', 'kdp_book_settings_select_own_book'),
    ('kdp_book_settings', 'kdp_book_settings_insert_own_book'),
    ('kdp_sections', 'kdp_sections_select_own_book')
),
schema_grant_checks as (
  select
    'schema_grant:' || schema_name || ':' || privilege_name as check_name,
    case
      when has_schema_privilege(grantee, schema_name, privilege_name)
        then 'passed'
      else 'failed'
    end as status,
    grantee || ' -> ' || schema_name || ' -> ' || privilege_name as details
  from expected_schema_grants
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
from schema_grant_checks
union all
select check_name, status, details
from table_grant_checks
union all
select check_name, status, details
from policy_checks
order by check_name;
