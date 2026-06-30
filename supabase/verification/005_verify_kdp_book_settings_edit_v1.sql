with expected_table_grants(grantee, table_name, privilege_name) as (
  values
    ('authenticated', 'kdp_book_settings', 'SELECT'),
    ('authenticated', 'kdp_book_settings', 'INSERT'),
    ('authenticated', 'kdp_book_settings', 'UPDATE')
),
expected_policies(table_name, policy_name) as (
  values
    ('kdp_book_settings', 'kdp_book_settings_select_own_book'),
    ('kdp_book_settings', 'kdp_book_settings_insert_own_book'),
    ('kdp_book_settings', 'kdp_book_settings_update_own_book')
),
expected_constraints(table_name, constraint_name) as (
  values
    ('kdp_book_settings', 'kdp_book_settings_trim_size_check'),
    ('kdp_book_settings', 'kdp_book_settings_bleed_check'),
    ('kdp_book_settings', 'kdp_book_settings_interior_type_check'),
    ('kdp_book_settings', 'kdp_book_settings_paper_type_check'),
    ('kdp_book_settings', 'kdp_book_settings_body_font_check'),
    ('kdp_book_settings', 'kdp_book_settings_heading_font_check'),
    ('kdp_book_settings', 'kdp_book_settings_body_font_size_check'),
    ('kdp_book_settings', 'kdp_book_settings_line_height_check'),
    ('kdp_book_settings', 'kdp_book_settings_margins_check')
),
expected_constraint_fragments(constraint_name, expected_fragment) as (
  values
    ('kdp_book_settings_trim_size_check', '''6x9'''),
    ('kdp_book_settings_trim_size_check', '''5x8'''),
    ('kdp_book_settings_trim_size_check', '''8.5x11'''),
    ('kdp_book_settings_bleed_check', 'false'),
    ('kdp_book_settings_bleed_check', 'true'),
    ('kdp_book_settings_interior_type_check', '''black_and_white'''),
    ('kdp_book_settings_interior_type_check', '''standard_color'''),
    ('kdp_book_settings_interior_type_check', '''premium_color'''),
    ('kdp_book_settings_paper_type_check', '''white'''),
    ('kdp_book_settings_paper_type_check', '''cream'''),
    ('kdp_book_settings_body_font_check', '''Lora'''),
    ('kdp_book_settings_body_font_check', '''Georgia'''),
    ('kdp_book_settings_body_font_check', '''serif'''),
    ('kdp_book_settings_heading_font_check', '''Cormorant Garamond'''),
    ('kdp_book_settings_heading_font_check', '''Georgia'''),
    ('kdp_book_settings_heading_font_check', '''sans'''),
    ('kdp_book_settings_body_font_size_check', '10'),
    ('kdp_book_settings_body_font_size_check', '11'),
    ('kdp_book_settings_body_font_size_check', '12'),
    ('kdp_book_settings_body_font_size_check', '13'),
    ('kdp_book_settings_line_height_check', '1.35'),
    ('kdp_book_settings_line_height_check', '1.5'),
    ('kdp_book_settings_line_height_check', '1.65'),
    ('kdp_book_settings_margins_check', 'margin_top'),
    ('kdp_book_settings_margins_check', 'margin_bottom'),
    ('kdp_book_settings_margins_check', 'margin_inner'),
    ('kdp_book_settings_margins_check', 'margin_outer')
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
constraint_fragment_checks as (
  select
    'constraint_fragment:' || constraint_name || ':' || expected_fragment
      as check_name,
    case
      when pg_get_constraintdef(pg_constraint.oid) like
        '%' || expected_fragment || '%'
        then 'passed'
      else 'failed'
    end as status,
    'public.kdp_book_settings -> ' || constraint_name
      || ' includes ' || expected_fragment as details
  from expected_constraint_fragments
  left join pg_constraint
    on pg_constraint.conname =
      expected_constraint_fragments.constraint_name
    and pg_constraint.conrelid = to_regclass('public.kdp_book_settings')
)
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
from constraint_fragment_checks
order by check_name;
