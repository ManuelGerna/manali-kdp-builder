with expected_tables(table_name) as (
  values
    ('kdp_books'),
    ('kdp_book_settings'),
    ('kdp_sections'),
    ('kdp_exports')
),
expected_policies(table_name, policy_name) as (
  values
    ('kdp_books', 'kdp_books_select_own'),
    ('kdp_books', 'kdp_books_insert_own'),
    ('kdp_books', 'kdp_books_update_own'),
    ('kdp_books', 'kdp_books_delete_own'),
    ('kdp_book_settings', 'kdp_book_settings_select_own_book'),
    ('kdp_book_settings', 'kdp_book_settings_insert_own_book'),
    ('kdp_book_settings', 'kdp_book_settings_update_own_book'),
    ('kdp_book_settings', 'kdp_book_settings_delete_own_book'),
    ('kdp_sections', 'kdp_sections_select_own_book'),
    ('kdp_sections', 'kdp_sections_insert_own_book'),
    ('kdp_sections', 'kdp_sections_update_own_book'),
    ('kdp_sections', 'kdp_sections_delete_own_book'),
    ('kdp_exports', 'kdp_exports_select_own_book'),
    ('kdp_exports', 'kdp_exports_insert_own_book'),
    ('kdp_exports', 'kdp_exports_update_own_book'),
    ('kdp_exports', 'kdp_exports_delete_own_book')
),
table_checks as (
  select
    'table_exists:' || table_name as check_name,
    case
      when to_regclass('public.' || table_name) is not null then 'passed'
      else 'failed'
    end as status,
    'public.' || table_name as details
  from expected_tables
),
rls_checks as (
  select
    'rls_enabled:' || expected_tables.table_name as check_name,
    case
      when pg_class.relrowsecurity then 'passed'
      else 'failed'
    end as status,
    'public.' || expected_tables.table_name as details
  from expected_tables
  left join pg_class
    on pg_class.oid = to_regclass('public.' || expected_tables.table_name)
),
policy_checks as (
  select
    'policy_exists:' || expected_policies.policy_name as check_name,
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
from table_checks
union all
select check_name, status, details
from rls_checks
union all
select check_name, status, details
from policy_checks
order by check_name;
