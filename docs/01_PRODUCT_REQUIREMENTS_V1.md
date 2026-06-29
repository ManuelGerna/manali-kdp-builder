# 01 — Product Requirements V1

## Obiettivo V1

Costruire una web app privata che genera un **PDF interno KDP 6x9 no-bleed** per libretti su pietre/cristalli/journal e prepara tutti i campi KDP copiabili.

## Primo formato supportato

```text
Trim size: 6 x 9 inches
Bleed: no
Interior: black & white
Paper type: white
Book type: paperback
Upload KDP: manuale
```

## Moduli V1

### 1. Auth privata

- login obbligatorio;
- nessuna area pubblica;
- protezione route;
- logout.

### 2. Dashboard libri

Lista libretti creati.

Campi visibili:

- titolo;
- sottotitolo;
- autore;
- stato;
- lingua;
- formato;
- numero sezioni;
- ultimo export;
- stato validazione.

Stati:

```text
draft
in_review
ready_for_export
exported
uploaded_to_kdp
published
archived
```

### 3. Nuovo libretto

Campi minimi:

- titolo;
- sottotitolo;
- autore / pen name;
- lingua;
- tipo libretto;
- uso AI;
- descrizione interna.

Tipi libretto V1:

```text
crystal_guide_journal
```

Tipi previsti dopo V1:

```text
crystal_guide
crystal_journal
affirmation_book
spiritual_workbook
tarot_journal
numerology_journal
```

### 4. Impostazioni KDP

Campi V1:

- trim size;
- bleed;
- interior type;
- paper type;
- body font;
- heading font;
- body font size;
- line height;
- margins;
- page numbering;
- header/footer;
- section title style.

Per V1, molte opzioni possono essere bloccate per ridurre errori.

### 5. Editor contenuti

La app deve usare blocchi strutturati, non editor libero.

Blocchi V1:

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
```

### 6. Schede cristallo

Campi scheda:

- crystal_name;
- subtitle;
- short_description;
- traditional_meaning;
- symbolic_properties;
- chakra;
- element;
- usage_tips;
- cleansing_recharge;
- affirmation;
- journaling_prompt;
- image_asset_id opzionale;
- sort_order.

### 7. AI redattore

Azioni V1:

- correggi testo;
- rendi più professionale;
- rendi più semplice;
- rendi più premium;
- accorcia;
- espandi;
- rimuovi promesse mediche;
- genera disclaimer;
- genera descrizione KDP;
- genera keyword KDP.

### 8. PDF export

Generare un PDF interno con:

- dimensioni corrette;
- margini coerenti;
- numerazione pagine;
- template grafico fisso;
- font incorporati o compatibili;
- nessun elemento fuori area sicura;
- report di validazione.

### 9. Campi KDP copiabili

La app deve generare una schermata finale con campi copiabili singolarmente.

Campi:

- titolo;
- sottotitolo;
- autore;
- descrizione;
- keyword 1-7;
- categorie suggerite;
- lingua;
- tipo AI;
- trim size;
- interior;
- paper;
- bleed;
- note upload;
- prezzo suggerito;
- mercati suggeriti.

## Criterio di successo V1

La V1 è riuscita quando:

1. si crea un libretto;
2. si compilano sezioni e schede cristallo;
3. si correggono testi con AI;
4. si genera un PDF interno 6x9;
5. il PDF è scaricabile;
6. i dati KDP sono copiabili;
7. il flusso non richiede impaginazione manuale.
