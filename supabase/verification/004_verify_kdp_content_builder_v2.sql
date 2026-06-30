with expected_section_columns(column_name, data_type, is_nullable) as (
  values
    ('subtitle', 'text', 'YES'),
    ('include_in_toc', 'boolean', 'NO'),
    ('section_status', 'text', 'NO'),
    ('page_break_before', 'boolean', 'NO'),
    ('layout_preset', 'text', 'NO'),
    ('editor_notes', 'text', 'YES')
),
expected_tables(table_name) as (
  values
    ('kdp_assets'),
    ('kdp_section_blocks')
),
expected_table_grants(grantee, table_name, privilege_name) as (
  values
    ('authenticated', 'kdp_assets', 'SELECT'),
    ('authenticated', 'kdp_assets', 'INSERT'),
    ('authenticated', 'kdp_assets', 'UPDATE'),
    ('authenticated', 'kdp_assets', 'DELETE'),
    ('authenticated', 'kdp_section_blocks', 'SELECT'),
    ('authenticated', 'kdp_section_blocks', 'INSERT'),
    ('authenticated', 'kdp_section_blocks', 'UPDATE'),
    ('authenticated', 'kdp_section_blocks', 'DELETE')
),
expected_policies(table_name, policy_name) as (
  values
    ('kdp_assets', 'kdp_assets_select_own_book'),
    ('kdp_assets', 'kdp_assets_insert_own_book'),
    ('kdp_assets', 'kdp_assets_update_own_book'),
    ('kdp_assets', 'kdp_assets_delete_own_book'),
    ('kdp_section_blocks', 'kdp_section_blocks_select_own_book'),
    ('kdp_section_blocks', 'kdp_section_blocks_insert_own_book'),
    ('kdp_section_blocks', 'kdp_section_blocks_update_own_book'),
    ('kdp_section_blocks', 'kdp_section_blocks_delete_own_book')
),
expected_constraints(table_name, constraint_name) as (
  values
    ('kdp_sections', 'kdp_sections_section_status_check'),
    ('kdp_sections', 'kdp_sections_layout_preset_check'),
    ('kdp_assets', 'kdp_assets_asset_type_check'),
    ('kdp_assets', 'kdp_assets_status_check'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check'),
    ('kdp_section_blocks', 'kdp_section_blocks_layout_preset_check'),
    ('kdp_section_blocks', 'kdp_section_blocks_print_visibility_check')
),
expected_constraint_values(table_name, constraint_name, allowed_value) as (
  values
    ('kdp_sections', 'kdp_sections_section_status_check', 'draft'),
    ('kdp_sections', 'kdp_sections_section_status_check', 'needs_review'),
    ('kdp_sections', 'kdp_sections_section_status_check', 'ready'),
    ('kdp_sections', 'kdp_sections_section_status_check', 'archived'),
    ('kdp_sections', 'kdp_sections_layout_preset_check', 'default'),
    ('kdp_sections', 'kdp_sections_layout_preset_check', 'title_page'),
    ('kdp_sections', 'kdp_sections_layout_preset_check', 'chapter_opening'),
    ('kdp_sections', 'kdp_sections_layout_preset_check', 'image_text'),
    ('kdp_sections', 'kdp_sections_layout_preset_check', 'crystal_profile'),
    ('kdp_sections', 'kdp_sections_layout_preset_check', 'journal'),
    ('kdp_sections', 'kdp_sections_layout_preset_check', 'ritual'),
    ('kdp_sections', 'kdp_sections_layout_preset_check', 'list'),
    ('kdp_assets', 'kdp_assets_asset_type_check', 'image'),
    ('kdp_assets', 'kdp_assets_asset_type_check', 'cover_image'),
    ('kdp_assets', 'kdp_assets_asset_type_check', 'icon'),
    ('kdp_assets', 'kdp_assets_asset_type_check', 'background'),
    ('kdp_assets', 'kdp_assets_status_check', 'placeholder'),
    ('kdp_assets', 'kdp_assets_status_check', 'uploaded'),
    ('kdp_assets', 'kdp_assets_status_check', 'generated_future'),
    ('kdp_assets', 'kdp_assets_status_check', 'approved'),
    ('kdp_assets', 'kdp_assets_status_check', 'rejected'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'text'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'heading'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'image'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'image_prompt'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'page_break'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'quote'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'affirmation'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'benefits'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'chakra'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'ritual'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'number_list'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'color_meaning'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'cta'),
    ('kdp_section_blocks', 'kdp_section_blocks_block_type_check', 'internal_note'),
    ('kdp_section_blocks', 'kdp_section_blocks_layout_preset_check', 'default'),
    ('kdp_section_blocks', 'kdp_section_blocks_layout_preset_check', 'title_page'),
    ('kdp_section_blocks', 'kdp_section_blocks_layout_preset_check', 'chapter_opening'),
    ('kdp_section_blocks', 'kdp_section_blocks_layout_preset_check', 'image_text'),
    ('kdp_section_blocks', 'kdp_section_blocks_layout_preset_check', 'crystal_profile'),
    ('kdp_section_blocks', 'kdp_section_blocks_layout_preset_check', 'journal'),
    ('kdp_section_blocks', 'kdp_section_blocks_layout_preset_check', 'ritual'),
    ('kdp_section_blocks', 'kdp_section_blocks_layout_preset_check', 'list'),
    ('kdp_section_blocks', 'kdp_section_blocks_print_visibility_check', 'print'),
    ('kdp_section_blocks', 'kdp_section_blocks_print_visibility_check', 'internal_only'),
    ('kdp_section_blocks', 'kdp_section_blocks_print_visibility_check', 'hidden')
),
section_column_checks as (
  select
    'column_exists:kdp_sections:' || expected_section_columns.column_name
      as check_name,
    case
      when information_schema.columns.column_name is not null
        and information_schema.columns.data_type =
          expected_section_columns.data_type
        and information_schema.columns.is_nullable =
          expected_section_columns.is_nullable
        then 'passed'
      else 'failed'
    end as status,
    'public.kdp_sections.' || expected_section_columns.column_name
      || ' -> ' || expected_section_columns.data_type
      || ', nullable=' || expected_section_columns.is_nullable as details
  from expected_section_columns
  left join information_schema.columns
    on information_schema.columns.table_schema = 'public'
    and information_schema.columns.table_name = 'kdp_sections'
    and information_schema.columns.column_name =
      expected_section_columns.column_name
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
)
select check_name, status, details
from section_column_checks
union all
select check_name, status, details
from table_checks
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
order by check_name;
