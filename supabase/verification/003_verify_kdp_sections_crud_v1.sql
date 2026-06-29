with expected_table_grants(grantee, table_name, privilege_name) as (
  values
    ('authenticated', 'kdp_sections', 'SELECT'),
    ('authenticated', 'kdp_sections', 'INSERT'),
    ('authenticated', 'kdp_sections', 'UPDATE'),
    ('authenticated', 'kdp_sections', 'DELETE')
),
expected_policies(table_name, policy_name) as (
  values
    ('kdp_sections', 'kdp_sections_select_own_book'),
    ('kdp_sections', 'kdp_sections_insert_own_book'),
    ('kdp_sections', 'kdp_sections_update_own_book'),
    ('kdp_sections', 'kdp_sections_delete_own_book')
),
expected_section_types(section_type) as (
  values
    ('title_page'),
    ('disclaimer'),
    ('introduction'),
    ('chapter'),
    ('crystal_card'),
    ('journal_page'),
    ('affirmation'),
    ('notes'),
    ('conclusion')
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
section_type_checks as (
  select
    'section_type_allowed:' || expected_section_types.section_type as check_name,
    case
      when pg_get_constraintdef(pg_constraint.oid)
        like '%' || quote_literal(expected_section_types.section_type) || '%'
        then 'passed'
      else 'failed'
    end as status,
    'public.kdp_sections -> ' || expected_section_types.section_type as details
  from expected_section_types
  left join pg_constraint
    on pg_constraint.conname = 'kdp_sections_section_type_check'
    and pg_constraint.conrelid = 'public.kdp_sections'::regclass
)
select check_name, status, details
from table_grant_checks
union all
select check_name, status, details
from policy_checks
union all
select check_name, status, details
from section_type_checks
order by check_name;
