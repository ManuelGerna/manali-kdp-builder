# KDP Draft Format v1.0

## 1. Scopo

`KDP_DRAFT_V1` e il formato testuale standard per creare libretti KDP strutturati, leggibili da una persona e parsabili dal software.

Il formato nasce per permettere a ChatGPT o a un editor umano di descrivere un libretto completo in modo semantico, senza dipendere dal layout finale pagina per pagina. Il parser deve trasformare la bozza in pagine e blocchi normalizzati, poi il renderer decide come comporli in modo print-safe.

Il formato puo essere usato per:

- importare una bozza strutturata;
- generare contenuti con ChatGPT in modo controllato;
- costruire in futuro libretti sezione per sezione dentro l'app;
- riusare lo stesso contratto su nicchie diverse.

## 2. Principi

`KDP_DRAFT_V1` deve essere:

- riutilizzabile per piu nicchie;
- leggibile e scrivibile da ChatGPT;
- semplice da parsare;
- semantico, non legato a un solo libretto;
- print-safe, con colori neutri e layout adatti alla stampa;
- no-content-loss, quindi nessun campo o prompt dichiarato deve sparire in modo silenzioso;
- compatibile con renderer generico;
- adatto sia a import bozza sia a creazione diretta dentro app in futuro.

Il formato descrive intenzioni editoriali e blocchi compilabili. Non deve codificare coordinate grafiche, regole KDP proprietarie o dettagli del motore PDF.

## 3. Struttura generale

Una bozza inizia con una riga di versione e contiene una sezione `BOOK`, seguita da una o piu sezioni `PAGE`.

```text
KDP_DRAFT_V1

BOOK
title: Diario Allenamento 90 Giorni
subtitle: Monitora progressi, abitudini e risultati
language: it
trim_size: 7x10
interior: black_white
theme: print_safe_gray
target_pages: 110
END_BOOK

PAGE
id: owner
title: Questo diario appartiene a
type: fields
FIELDS
- Nome | short
- Data di inizio | short
- Obiettivo principale | long
- Ricompensa al completamento | long
END_FIELDS
END_PAGE
```

Regole generali:

- `KDP_DRAFT_V1` deve essere la prima riga significativa.
- `BOOK` descrive metadati e vincoli editoriali generali.
- Ogni `PAGE` descrive una pagina o una pagina ripetibile.
- Ogni blocco interno deve avere marker espliciti quando contiene liste strutturate.
- Il parser deve preservare ordine e contenuto dichiarato.

## 4. Tipi PAGE supportati nella v1

### `cover`

Pagina di copertina o brief copertina. In v1 puo descrivere titolo, sottotitolo, stile e note, ma non genera una copertina finale.

Usare quando la bozza deve conservare istruzioni editoriali per la cover.

### `intro`

Pagina introduttiva con testo breve, istruzioni o apertura del libretto.

Usare per spiegare come compilare il diario o impostare il tono.

### `text`

Pagina testuale semplice.

Usare per contenuti descrittivi, disclaimer, istruzioni o testo editoriale non compilabile.

### `callout`

Pagina o blocco breve evidenziato.

Usare per promemoria, frasi guida, avvisi leggeri o note motivazionali senza inventare contenuto extra.

### `fields`

Pagina con campi compilabili.

Usare quando il contenuto principale e una lista di campi con label, per esempio dati personali, obiettivi, punto di partenza o misure.

### `worksheet`

Pagina workbook composta da gruppi di campi, prompt, tabelle o callout.

Usare quando la pagina ha piu blocchi compilabili con gerarchia chiara.

### `table`

Pagina centrata su una tabella compilabile.

Usare per log, tracker, record, checklist, planner o griglie.

### `habit_tracker`

Tracker abitudini con giorni 1-31.

Usare quando una colonna sinistra contiene abitudini e le colonne successive rappresentano giorni del mese.

### `notes`

Pagina note a righe o prompt estesi.

Usare per note libere, riflessioni, recap settimanali o pagine finali.

### `divider`

Pagina divisoria.

Usare per separare sezioni. Non deve contenere campi inventati; puo avere titolo centrato e linea sobria.

## 5. Field intent

I campi compilabili possono dichiarare un intent:

- `short`: campo breve;
- `medium`: campo medio;
- `long`: prompt o area scrivibile ampia.

Esempi:

```text
short:
- Nome
- Data
- Giorno
- Ora
- Durata
- Peso
- Numero
- Mese
- Livello

medium:
- Focus
- Routine
- Punto di partenza
- Risultato desiderato

long:
- Obiettivo
- Perche
- Note
- Piano
- Difficolta
- Ricompensa
- Riflessioni
```

L'intent puo essere dichiarato esplicitamente:

```text
- Nome | short
- Focus allenamento | medium
- Obiettivo principale | long
```

Se manca, parser o renderer possono applicare fallback automatico basato sulla label. Il fallback deve essere conservativo: meglio rendere un campo leggermente piu ampio che tagliarne il contenuto.

## 6. Tabelle

Le tabelle devono dichiarare o permettere di inferire `table_mode`.

### `open_ended`

Tabella log o tracker con righe extra per riempire la pagina.

Usare per:

- tracker misure;
- tracker peso;
- record personali;
- benchmark;
- log progressivi.

Il renderer puo aggiungere righe vuote compilabili quando c'e spazio.

### `fixed_rows`

Tabella con righe dichiarate che non devono aumentare.

Usare per:

- planner settimanale con giorni della settimana;
- checklist con voci fisse;
- griglie con righe gia definite.

Il renderer non deve aggiungere righe. Deve usare lo spazio disponibile aumentando l'altezza delle righe esistenti.

### `fixed_capacity`

Tabella compilabile con capacita gestita dal layout.

Usare per moduli ripetibili, come schede allenamento, dove il numero righe serve a indicare quanta capacita scrivibile offrire.

Esempio:

```text
TABLE
table_mode: fixed_rows
COLUMNS
- Giorno
- Focus allenamento
- Orario
- Note
END_COLUMNS
ROWS
- Lunedì | | |
- Martedì | | |
- Mercoledì | | |
- Giovedì | | |
- Venerdì | | |
- Sabato | | |
- Domenica | | |
END_ROWS
END_TABLE
```

Nota: gli esempi possono usare accenti per leggibilita editoriale, ma il parser deve normalizzare le label dove serve.

## 7. Blocchi supportati

### `FIELDS`

Lista semplice di campi.

```text
FIELDS
- Nome | short
- Obiettivo principale | long
END_FIELDS
```

### `FIELDS_GROUP`

Gruppo nominato di campi.

```text
FIELDS_GROUP
title: Stato iniziale
FIELDS
- Energia 1-5 | short
- Umore | short
- Sonno | short
- Riscaldamento completato | short
END_FIELDS
END_FIELDS_GROUP
```

### `TABLE`

Tabella compilabile.

```text
TABLE
title: Tracker misure
table_mode: open_ended
COLUMNS
- Data
- Peso
- Vita
- Note
END_COLUMNS
rows: 8
END_TABLE
```

### `COLUMNS`

Definisce intestazioni tabella.

### `ROWS`

Definisce righe esplicite. Se `table_mode` e `fixed_rows`, queste righe devono essere preservate e non aumentate.

### `PROMPTS`

Lista di domande o spunti scrivibili.

```text
PROMPTS
- Quali cambiamenti noto?
- Cosa devo ancora migliorare?
END_PROMPTS
```

### `TEXT`

Testo editoriale.

```text
TEXT
Compila questo diario con costanza. Usa le pagine come strumento pratico, non come giudizio.
END_TEXT
```

### `CALLOUT`

Blocco evidenziato breve.

```text
CALLOUT
La costanza conta piu della perfezione.
END_CALLOUT
```

### `repeat`

Numero di ripetizioni della pagina o del blocco.

### `title_pattern`

Pattern titolo per pagine ripetute.

```text
repeat: 80
title_pattern: Scheda allenamento {{n}}
```

## 8. Ripetizioni

Le ripetizioni permettono di creare moduli ricorrenti senza duplicare tutto il testo.

```text
PAGE
id: weekly_plan
type: table
repeat: 13
title_pattern: Piano allenamento settimanale - Settimana {{n}}
TABLE
table_mode: fixed_rows
COLUMNS
- Giorno
- Focus allenamento
- Orario
- Note
END_COLUMNS
ROWS
- Lunedì | | |
- Martedì | | |
- Mercoledì | | |
- Giovedì | | |
- Venerdì | | |
- Sabato | | |
- Domenica | | |
END_ROWS
END_TABLE
END_PAGE
```

Per un diario 90 giorni, un piano settimanale dovrebbe in futuro essere ripetuto circa 13 volte, una per settimana. Il parser deve espandere le ripetizioni in pagine normalizzate mantenendo titoli e contenuti coerenti.

## 9. Regola no-content-loss

Il parser e il renderer non devono mai scartare campi, prompt, righe o blocchi dichiarati.

Se qualcosa non entra in una pagina, il sistema deve degradare in modo esplicito:

1. layout editoriale;
2. layout bilanciato;
3. layout compatto;
4. split su piu pagine;
5. errore esplicito di validazione.

Non e ammesso taglio silenzioso.

Questa regola vale per:

- campi e gruppi campo;
- prompt;
- righe tabella;
- blocchi testo;
- pagine ripetute;
- tracker e planner.

## 10. Esempio completo sintetico

```text
KDP_DRAFT_V1

BOOK
title: Diario Allenamento 90 Giorni
subtitle: Traccia allenamenti, abitudini e progressi
language: it
trim_size: 7x10
interior: black_white
theme: print_safe_gray
target_pages: 110
END_BOOK

PAGE
id: owner
title: Questo diario appartiene a
type: fields
FIELDS
- Nome | short
- Data di inizio | short
- Obiettivo principale | long
- Ricompensa al completamento | long
END_FIELDS
END_PAGE

PAGE
id: fitness_goals
title: Obiettivi fitness
type: worksheet
PROMPTS
- Cosa voglio migliorare?
- Perche e importante per me?
- Come capiro che sto facendo progressi?
END_PROMPTS
END_PAGE

PAGE
id: weekly_training_plan
type: table
repeat: 13
title_pattern: Piano allenamento settimanale - Settimana {{n}}
TABLE
table_mode: fixed_rows
COLUMNS
- Giorno
- Focus allenamento
- Orario
- Note
END_COLUMNS
ROWS
- Lunedì | | |
- Martedì | | |
- Mercoledì | | |
- Giovedì | | |
- Venerdì | | |
- Sabato | | |
- Domenica | | |
END_ROWS
END_TABLE
END_PAGE

PAGE
id: measurements_tracker
title: Tracker misure
type: table
TABLE
table_mode: open_ended
COLUMNS
- Data
- Peso
- Vita
- Fianchi
- Note
END_COLUMNS
rows: 8
END_TABLE
END_PAGE

PAGE
id: monthly_habit_tracker
title: Habit tracker mensile
type: habit_tracker
HABITS
- Allenamento
- Acqua
- Passi
- Sonno
- Stretching
- Alimentazione
END_HABITS
days: 31
END_PAGE

PAGE
id: workout_sheet
type: worksheet
repeat: 80
title_pattern: Scheda allenamento {{n}}
FIELDS_GROUP
title: Dati allenamento
FIELDS
- Data | short
- Giorno | short
- Focus allenamento | medium
- Ora inizio | short
- Durata | short
END_FIELDS
END_FIELDS_GROUP
FIELDS_GROUP
title: Stato iniziale
FIELDS
- Energia 1-5 | short
- Umore | short
- Sonno | short
- Riscaldamento completato | short
END_FIELDS
END_FIELDS_GROUP
TABLE
title: Esercizi
table_mode: fixed_capacity
COLUMNS
- Esercizio
- Serie
- Ripetizioni
- Carico
- Recupero
- Note
END_COLUMNS
rows: 8
END_TABLE
PROMPTS
- Cardio svolto
- Note finali
- Cosa correggere nel prossimo allenamento?
END_PROMPTS
END_PAGE

PAGE
id: final_notes
title: Note finali
type: notes
PROMPTS
- Quali risultati ho ottenuto?
- Cosa voglio mantenere?
- Quale sara il prossimo obiettivo?
END_PROMPTS
END_PAGE
```
