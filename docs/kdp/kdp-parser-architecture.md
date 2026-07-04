# KDP Parser Architecture

## 1. Visione architetturale

L'architettura parser per `KDP_DRAFT_V1` deve separare due responsabilita:

1. base parser;
2. domain packs o profili di settore.

Il base parser capisce il formato standard e produce blocchi normalizzati generici. I domain packs aggiungono conoscenza specifica di una nicchia senza sostituire il parser base.

Obiettivo: una bozza fitness, meal planner, budget planner o productivity planner deve attraversare la stessa pipeline di base e arrivare al renderer come struttura normalizzata.

## 2. Base parser

Il base parser deve capire gli elementi comuni del formato:

- `KDP_DRAFT_V1`;
- `BOOK`;
- `PAGE`;
- `type`;
- fields;
- field intent;
- tables;
- `table_mode`;
- rows e columns;
- prompts;
- repeat;
- `title_pattern`;
- notes;
- divider;
- callout.

Responsabilita principali:

- validare la struttura del documento;
- preservare ordine e contenuto;
- normalizzare blocchi in tipi generici;
- espandere ripetizioni;
- segnalare errori espliciti quando una bozza e incompleta o ambigua;
- evitare assunzioni legate a una singola nicchia.

Il parser base non deve sapere cosa e una "scheda allenamento" in senso business. Deve sapere che esiste una pagina `worksheet` con gruppi di campi, tabella e prompt.

## 3. Normalizzazione

Il parser non deve ragionare in termini di `fitness`, `budget`, `meal planner` o altre nicchie.

Deve produrre blocchi normalizzati come:

- page;
- text;
- callout;
- fields;
- fields_group;
- prompts;
- table;
- habit_tracker;
- divider;
- notes;
- repeat expansion metadata;
- validation report.

Esempio:

```text
FIELDS
- Data | short
- Focus allenamento | medium
- Note finali | long
END_FIELDS
```

diventa un blocco generico:

```text
type: fields
fields:
  - label: Data
    intent: short
  - label: Focus allenamento
    intent: medium
  - label: Note finali
    intent: long
```

La parola "allenamento" resta una label, non una dipendenza del parser.

## 4. Domain packs futuri

I domain packs sono profili opzionali che estendono il base parser con conoscenza specifica.

Possono aggiungere:

- alias di label;
- macro;
- template;
- validazioni;
- suggerimenti di struttura;
- espansioni automatiche.

### Fitness pack

Esempi:

- scheda allenamento;
- habit tracker;
- misure corporee;
- record personali;
- piano settimanale;
- recap progressi.

Un fitness pack puo sapere che una "scheda allenamento" di solito contiene:

- campi iniziali;
- stato iniziale;
- tabella esercizi;
- cardio;
- note finali.

Ma dopo l'espansione deve comunque produrre blocchi standard.

### Meal planner pack

Esempi:

- colazione;
- pranzo;
- cena;
- spuntini;
- lista spesa;
- meal prep;
- acqua;
- macros.

Il pack puo proporre macro come `weekly_meal_plan`, ma il risultato deve essere una combinazione di fields, tables, prompts e notes.

### Budget planner pack

Esempi:

- entrate;
- uscite;
- debiti;
- risparmi;
- obiettivi mensili;
- tracker spese;
- riepilogo mese.

Il pack puo validare che una tabella spese abbia colonne essenziali, ma non deve introdurre un tipo runtime incompatibile con il renderer generico.

## 5. Regola importante

I domain packs non devono sostituire il parser base.

Devono estenderlo senza rompere i blocchi standard.

Regole:

- un draft valido senza domain pack deve comunque essere parsabile;
- un domain pack puo espandere macro, ma deve produrre blocchi standard;
- il renderer non deve dipendere dal domain pack;
- gli errori devono essere riportati come validazioni, non come fallimenti opachi.

## 6. Strategia evolutiva

### v1

Formato documentato + parser base.

Obiettivi:

- stabilire contratto testuale;
- normalizzare pagine e blocchi;
- supportare import bozza;
- preservare contenuto.

### v1.1

Validatore bozza.

Obiettivi:

- errori leggibili;
- warning su pagine troppo dense;
- controllo `table_mode`;
- controllo repeat;
- controllo no-content-loss a livello modello.

### v1.2

Domain packs.

Obiettivi:

- profili fitness, meal planner, budget planner;
- macro riutilizzabili;
- validazioni specifiche;
- suggerimenti struttura.

### v1.3

Creazione diretta dentro app.

Obiettivi:

- usare lo stesso modello normalizzato per form e wizard;
- creare sezioni manualmente;
- importare o modificare pagine senza perdere semantica.

### v2

Generatore guidato sezione per sezione.

Obiettivi:

- generazione assistita;
- revisione per sezioni;
- libreria template;
- controllo qualita prima del rendering finale.

## 7. Relazione con creazione diretta dentro app

Lo stesso modello deve supportare tre flussi:

1. import da bozza strutturata;
2. creazione manuale sezione per sezione dentro app;
3. generazione futura da prompt.

Per questo motivo la normalizzazione deve essere stabile.

Un campo creato da bozza:

```text
- Obiettivo principale | long
```

e un campo creato da UI devono arrivare allo stesso modello:

```text
label: Obiettivo principale
intent: long
```

Questo permette di riusare:

- validatore;
- preview;
- renderer PDF tecnico;
- futuro export KDP;
- editor manuale.

## 8. Guardrail

Il parser e la pipeline devono rispettare questi guardrail:

- niente contenuto perso;
- niente layout hardcoded per un solo libro;
- niente dipendenza da pagina, titolo o template specifico;
- renderer generico;
- tema print-safe;
- test su casi reali;
- errori espliciti quando una struttura non e supportata;
- nessuna conversione silenziosa che cambi significato ai contenuti.

## 9. Boundary tra parser e renderer

Il parser decide cosa significa un blocco.

Il renderer decide come impaginarlo.

Esempio:

- parser: questa e una tabella `fixed_rows` con sette giorni;
- renderer: non aggiungo righe extra, aumento altezza righe.

Esempio:

- parser: questo campo ha intent `long`;
- renderer: lo rende come box ampio, o passa a layout compatto se la pagina e troppo densa.

Il parser non deve assegnare coordinate grafiche. Il renderer non deve inventare o scartare contenuto.

## 10. Testing strategy

Ogni evoluzione del parser deve avere test su:

- draft minimo valido;
- draft con ripetizioni;
- field intent esplicito e fallback;
- tabelle `open_ended`;
- tabelle `fixed_rows`;
- tabelle `fixed_capacity`;
- habit tracker 1-31;
- pagine sparse;
- pagine dense;
- note lunghe;
- errore per blocchi non validi.

Ogni nuovo domain pack deve aggiungere casi reali, ma non deve rompere i test base.
