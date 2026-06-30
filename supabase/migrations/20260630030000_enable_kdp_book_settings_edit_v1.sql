grant update
on table public.kdp_book_settings
to authenticated;

update public.kdp_book_settings
set
  trim_size = case
    when trim_size in ('6x9', '5x8', '8.5x11') then trim_size
    else '6x9'
  end,
  interior_type = case
    when interior_type in (
      'black_and_white',
      'standard_color',
      'premium_color'
    ) then interior_type
    else 'black_and_white'
  end,
  paper_type = case
    when paper_type in ('white', 'cream') then paper_type
    else 'white'
  end,
  body_font = case
    when body_font in ('Lora', 'Georgia', 'serif') then body_font
    else 'Lora'
  end,
  heading_font = case
    when heading_font in ('Cormorant Garamond', 'Georgia', 'sans')
      then heading_font
    else 'Cormorant Garamond'
  end,
  body_font_size = case
    when body_font_size in (10, 11, 12, 13) then body_font_size
    else 11
  end,
  line_height = case
    when line_height in (1.35, 1.5, 1.65) then line_height
    else 1.5
  end,
  margin_top = case
    when margin_top between 0.5 and 2 then margin_top
    else 0.75
  end,
  margin_bottom = case
    when margin_bottom between 0.5 and 2 then margin_bottom
    else 0.75
  end,
  margin_inner = case
    when margin_inner between 0.5 and 2 then margin_inner
    else 0.75
  end,
  margin_outer = case
    when margin_outer between 0.5 and 2 then margin_outer
    else 0.6
  end;

alter table public.kdp_book_settings
  drop constraint if exists kdp_book_settings_trim_size_check;

alter table public.kdp_book_settings
  add constraint kdp_book_settings_trim_size_check check (
    trim_size in ('6x9', '5x8', '8.5x11')
  );

alter table public.kdp_book_settings
  drop constraint if exists kdp_book_settings_bleed_check;

alter table public.kdp_book_settings
  add constraint kdp_book_settings_bleed_check check (
    bleed in (false, true)
  );

alter table public.kdp_book_settings
  drop constraint if exists kdp_book_settings_interior_type_check;

alter table public.kdp_book_settings
  add constraint kdp_book_settings_interior_type_check check (
    interior_type in ('black_and_white', 'standard_color', 'premium_color')
  );

alter table public.kdp_book_settings
  drop constraint if exists kdp_book_settings_paper_type_check;

alter table public.kdp_book_settings
  add constraint kdp_book_settings_paper_type_check check (
    paper_type in ('white', 'cream')
  );

alter table public.kdp_book_settings
  drop constraint if exists kdp_book_settings_body_font_check;

alter table public.kdp_book_settings
  add constraint kdp_book_settings_body_font_check check (
    body_font in ('Lora', 'Georgia', 'serif')
  );

alter table public.kdp_book_settings
  drop constraint if exists kdp_book_settings_heading_font_check;

alter table public.kdp_book_settings
  add constraint kdp_book_settings_heading_font_check check (
    heading_font in ('Cormorant Garamond', 'Georgia', 'sans')
  );

alter table public.kdp_book_settings
  drop constraint if exists kdp_book_settings_body_font_size_check;

alter table public.kdp_book_settings
  add constraint kdp_book_settings_body_font_size_check check (
    body_font_size in (10, 11, 12, 13)
  );

alter table public.kdp_book_settings
  drop constraint if exists kdp_book_settings_line_height_check;

alter table public.kdp_book_settings
  add constraint kdp_book_settings_line_height_check check (
    line_height in (1.35, 1.5, 1.65)
  );

alter table public.kdp_book_settings
  drop constraint if exists kdp_book_settings_margins_check;

alter table public.kdp_book_settings
  add constraint kdp_book_settings_margins_check check (
    margin_top between 0.5 and 2
    and margin_bottom between 0.5 and 2
    and margin_inner between 0.5 and 2
    and margin_outer between 0.5 and 2
  );
