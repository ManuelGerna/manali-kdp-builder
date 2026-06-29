# 10 — Task 01 Bootstrap Prompt for Codex

Usa questo messaggio in una nuova chat operativa con Codex.

```text
Dobbiamo iniziare un nuovo progetto separato chiamato KDP Builder.

Contesto:
- KDP Builder è un progetto interno Manali Corporate.
- Dominio previsto: kdp.manalicorporate.com.
- Brand interno UI: KDP Builder.
- Freedom & Urus è un altro progetto separato dentro Manali Corporate.
- Artingo è un prodotto separato e non deve essere coinvolto in nessun modo.
- Non usare domini, brand, database, storage, env, copy, logiche business o codice di Artingo.
- Non usare codice o DB di Freedom & Urus salvo pattern tecnici generali e solo se utile.
- App privata con login obbligatorio.

Obiettivo V1:
Creare una web app che prepara libretti Amazon KDP:
1. impostazioni KDP;
2. contenuti strutturati;
3. AI redattore in step successivo;
4. export PDF interno in step successivo;
5. pagina finale con tutti i campi KDP copiabili.

Task 1:
Bootstrap del progetto e prime fondamenta.

Richieste:
- Crea/usa una nuova app Next.js separata.
- Nome progetto/repo: manali-kdp-builder.
- Brand interno UI: KDP Builder.
- Prepara routing iniziale:
  - /
  - /libri
  - /libri/nuovo
  - /libri/[id]
  - /impostazioni
- Login obbligatorio o struttura pronta per auth privata.
- Crea layout base mobile-first semplice.
- Crea schema dati iniziale per:
  - kdp_books
  - kdp_book_settings
  - kdp_sections
  - kdp_crystal_cards
  - kdp_kdp_metadata
  - kdp_exports
  - kdp_ai_revisions
  - kdp_assets
  - kdp_validation_checks
- Aggiungi .env.example senza segreti reali.
- Aggiungi README con setup locale.
- Non creare ancora export PDF.
- Non integrare ancora OpenAI.
- Non collegare KDP/Amazon API.
- Non fare browser automation.
- Non creare ancora cover generator.
- Non toccare nessun altro progetto.

Campi minimi kdp_books:
- id
- title
- subtitle
- author_name
- language
- book_type
- status
- ai_usage_type
- internal_description
- created_by
- created_at
- updated_at

Campi minimi kdp_book_settings:
- id
- book_id
- trim_size
- bleed
- interior_type
- paper_type
- body_font
- heading_font
- body_font_size
- line_height
- margin_top
- margin_bottom
- margin_inner
- margin_outer
- page_numbering
- header_enabled
- footer_enabled
- created_at
- updated_at

Campi minimi kdp_sections:
- id
- book_id
- section_type
- title
- body
- sort_order
- settings
- created_at
- updated_at

Campi minimi kdp_crystal_cards:
- id
- book_id
- section_id
- crystal_name
- subtitle
- short_description
- traditional_meaning
- symbolic_properties
- chakra
- element
- usage_tips
- cleansing_recharge
- affirmation
- journaling_prompt
- image_asset_id
- sort_order
- created_at
- updated_at

Campi minimi kdp_kdp_metadata:
- id
- book_id
- kdp_title
- kdp_subtitle
- kdp_author_name
- description_plain
- description_html
- keyword_1
- keyword_2
- keyword_3
- keyword_4
- keyword_5
- keyword_6
- keyword_7
- category_suggestion_1
- category_suggestion_2
- language
- ai_disclosure_note
- price_suggestion
- marketplace_notes
- upload_notes
- created_at
- updated_at

Campi minimi kdp_exports:
- id
- book_id
- export_type
- file_path
- file_name
- page_count
- validation_status
- validation_report
- created_at

Campi minimi kdp_ai_revisions:
- id
- book_id
- target_type
- target_id
- action_type
- input_text
- output_text
- model
- status
- created_at

Campi minimi kdp_assets:
- id
- book_id
- asset_type
- file_path
- file_name
- mime_type
- size_bytes
- width_px
- height_px
- dpi
- created_at

Campi minimi kdp_validation_checks:
- id
- book_id
- export_id
- check_key
- status
- message
- details
- created_at

Vincoli:
- Mantieni scope piccolo.
- Nessun refactor non richiesto.
- Nessun segreto.
- Non leggere o stampare .env.local.
- Non usare git add .
- Se usi git, staging solo per path espliciti.
- Non fare commit su main senza conferma.
- Prima mostra piano file, poi implementa.
- Alla fine riporta file creati/modificati e comandi di verifica eseguiti.
```
