# 03 — Data Model

## Obiettivo

Definire il modello dati iniziale di KDP Builder V1.

## Tabelle principali

```text
kdp_books
kdp_book_settings
kdp_sections
kdp_crystal_cards
kdp_kdp_metadata
kdp_exports
kdp_ai_revisions
kdp_assets
kdp_validation_checks
```

## kdp_books

Libro/progetto editoriale.

Campi:

```text
id uuid primary key
title text not null
subtitle text
author_name text
language text not null default 'it'
book_type text not null default 'crystal_guide_journal'
status text not null default 'draft'
ai_usage_type text not null default 'none'
internal_description text
created_by uuid
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Status ammessi:

```text
draft
in_review
ready_for_export
exported
uploaded_to_kdp
published
archived
```

AI usage type:

```text
none
ai_assisted
ai_generated
mixed
```

## kdp_book_settings

Impostazioni di stampa/PDF.

Campi:

```text
id uuid primary key
book_id uuid not null references kdp_books(id) on delete cascade
trim_size text not null default '6x9'
bleed boolean not null default false
interior_type text not null default 'black_and_white'
paper_type text not null default 'white'
body_font text not null default 'Lora'
heading_font text not null default 'Cormorant Garamond'
body_font_size numeric not null default 11
line_height numeric not null default 1.35
margin_top numeric not null default 0.75
margin_bottom numeric not null default 0.75
margin_inner numeric not null default 0.75
margin_outer numeric not null default 0.60
page_numbering boolean not null default true
header_enabled boolean not null default false
footer_enabled boolean not null default true
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## kdp_sections

Blocchi generici del libro.

Campi:

```text
id uuid primary key
book_id uuid not null references kdp_books(id) on delete cascade
section_type text not null
title text
body text
sort_order integer not null default 0
settings jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Tipi sezione:

```text
title_page
disclaimer
introduction
chapter_text
crystal_card
affirmation_page
journaling_page
notes_page
summary_table
conclusion
blank_page
```

## kdp_crystal_cards

Schede strutturate per pietre/cristalli.

Campi:

```text
id uuid primary key
book_id uuid not null references kdp_books(id) on delete cascade
section_id uuid references kdp_sections(id) on delete set null
crystal_name text not null
subtitle text
short_description text
traditional_meaning text
symbolic_properties text
chakra text
element text
usage_tips text
cleansing_recharge text
affirmation text
journaling_prompt text
image_asset_id uuid
sort_order integer not null default 0
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## kdp_kdp_metadata

Campi finali da copiare su Amazon KDP.

Campi:

```text
id uuid primary key
book_id uuid not null references kdp_books(id) on delete cascade
kdp_title text
kdp_subtitle text
kdp_author_name text
description_plain text
description_html text
keyword_1 text
keyword_2 text
keyword_3 text
keyword_4 text
keyword_5 text
keyword_6 text
keyword_7 text
category_suggestion_1 text
category_suggestion_2 text
language text
ai_disclosure_note text
price_suggestion numeric
marketplace_notes text
upload_notes text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## kdp_exports

Export PDF e file generati.

Campi:

```text
id uuid primary key
book_id uuid not null references kdp_books(id) on delete cascade
export_type text not null
file_path text
file_name text
page_count integer
validation_status text not null default 'not_checked'
validation_report jsonb not null default '{}'
created_at timestamptz not null default now()
```

Export type:

```text
interior_pdf
kdp_fields_txt
validation_report_txt
preview_images
```

Validation status:

```text
not_checked
passed
warning
failed
```

## kdp_ai_revisions

Storico revisioni AI.

Campi:

```text
id uuid primary key
book_id uuid not null references kdp_books(id) on delete cascade
target_type text not null
target_id uuid
action_type text not null
input_text text
output_text text
model text
status text not null default 'completed'
created_at timestamptz not null default now()
```

Action type:

```text
correct
professionalize
simplify
premium_tone
shorten
expand
remove_medical_claims
generate_disclaimer
generate_kdp_description
generate_keywords
```

## kdp_assets

File caricati.

Campi:

```text
id uuid primary key
book_id uuid references kdp_books(id) on delete cascade
asset_type text not null
file_path text not null
file_name text
mime_type text
size_bytes integer
width_px integer
height_px integer
dpi integer
created_at timestamptz not null default now()
```

## kdp_validation_checks

Validazioni.

Campi:

```text
id uuid primary key
book_id uuid not null references kdp_books(id) on delete cascade
export_id uuid references kdp_exports(id) on delete set null
check_key text not null
status text not null
message text not null
details jsonb not null default '{}'
created_at timestamptz not null default now()
```

Status:

```text
passed
warning
failed
```

## RLS

Tutte le tabelle devono essere private.

Per V1:

- solo utenti autenticati;
- opzionalmente allowlist email;
- nessun accesso anonimo.
