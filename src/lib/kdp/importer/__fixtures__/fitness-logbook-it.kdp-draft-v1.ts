export const FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT = 11;

export const FITNESS_LOGBOOK_IT_EXPECTED_TITLES = [
  "Come usare questo diario",
  "Dati iniziali",
  "Misure iniziali",
  "Planner settimanale",
  "Scheda allenamento 1",
  "Scheda allenamento 2",
  "Scheda allenamento 3",
  "Scheda allenamento 4",
  "Habit tracker mensile",
  "Review settimanale",
  "Note finali",
] as const;

export const FITNESS_LOGBOOK_IT_DRAFT_V1 = `KDP_DRAFT_V1

BOOK
title: Diario Allenamento 90 Giorni
subtitle: Traccia progressi, esercizi, abitudini e risultati
language: it
trim_size: 7x10
interior: black_white
theme: minimal_premium
target_pages: ${FITNESS_LOGBOOK_IT_EXPECTED_PAGE_COUNT}
END_BOOK

PAGE
id: intro
title: Come usare questo diario
type: intro
TEXT
Questo diario ti aiuta a registrare allenamenti, misure, abitudini e riflessioni in modo semplice.
Compila le pagine con costanza e usa le review per capire cosa correggere nel tuo piano.
END_TEXT
END_PAGE

PAGE
id: dati_iniziali
title: Dati iniziali
type: fields
FIELDS
- Nome | short
- Data inizio | short
- Obiettivo principale | long
- Ricompensa finale | medium
END_FIELDS
END_PAGE

PAGE
id: misure_iniziali
title: Misure iniziali
type: fields
FIELDS
- Peso iniziale | short
- Girovita | short
- Petto | short
- Fianchi | short
- Note iniziali | long
END_FIELDS
END_PAGE

PAGE
id: planner_settimanale
title: Planner settimanale
type: table
TABLE
title: Piano allenamento settimanale
table_mode: fixed_rows
COLUMNS
- Giorno
- Allenamento
- Focus
- Note
END_COLUMNS
ROWS
- Lunedi | | |
- Martedi | | |
- Mercoledi | | |
- Giovedi | | |
- Venerdi | | |
- Sabato | | |
- Domenica | | |
END_ROWS
END_TABLE
END_PAGE

PAGE
id: scheda_allenamento
type: worksheet
repeat: 4
title_pattern: Scheda allenamento {{n}}
FIELDS_GROUP
title: Dati allenamento
FIELDS
- Data | short
- Gruppo muscolare | medium
- Energia prima | short
END_FIELDS
END_FIELDS_GROUP
TABLE
title: Esercizi
table_mode: open_ended
COLUMNS
- Esercizio
- Serie
- Ripetizioni
- Peso
- Recupero
- Note
END_COLUMNS
rows: 8
END_TABLE
FIELDS_GROUP
title: Chiusura allenamento
FIELDS
- Energia dopo | short
- Cosa migliorare | long
END_FIELDS
END_FIELDS_GROUP
END_PAGE

PAGE
id: habit_tracker
title: Habit tracker mensile
type: habit_tracker
days: 31
ROWS
- Allenamento
- Acqua
- Sonno regolare
- Stretching
- Proteine
END_ROWS
END_PAGE

PAGE
id: review_settimanale
title: Review settimanale
type: notes
PROMPTS
- Cosa ha funzionato meglio?
- Dove ho mollato?
- Cosa cambio dalla prossima settimana?
END_PROMPTS
END_PAGE

PAGE
id: note_finali
title: Note finali
type: notes
PROMPTS
- Risultati raggiunti
- Progressi piu importanti
- Prossimo obiettivo
END_PROMPTS
END_PAGE`;
