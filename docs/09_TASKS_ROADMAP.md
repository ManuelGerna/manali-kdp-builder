# 09 — Tasks Roadmap

## Fase 0 — Documentazione

Stato: da completare prima dello sviluppo.

Output:

- documenti `.md`;
- scope V1;
- regole Codex;
- data model iniziale;
- prompt Task 1.

## Task 1 — Bootstrap progetto

Obiettivo:

Creare app separata KDP Builder con routing base, auth privata pronta, layout e schema dati iniziale.

Include:

- Next.js app;
- brand KDP Builder;
- route iniziali;
- `.env.example`;
- README;
- Supabase config placeholder;
- migration SQL iniziale;
- dashboard placeholder;
- pagina nuovo libro placeholder;
- pagina dettaglio libro placeholder.

Non include:

- AI;
- PDF;
- KDP API;
- upload automatico;
- cover.

## Task 2 — Database e CRUD libri

Obiettivo:

Creare CRUD reale per libri.

Include:

- kdp_books;
- kdp_book_settings;
- creazione libro;
- lista libri;
- dettaglio libro;
- update base;
- status.

## Task 3 — Impostazioni KDP V1

Obiettivo:

Form impostazioni 6x9 no-bleed.

Include:

- visualizzazione impostazioni;
- modifica font/dimensione/interlinea;
- valori bloccati V1;
- salvataggio;
- default automatici.

## Task 4 — Editor sezioni

Obiettivo:

Blocchi contenuto generici.

Include:

- aggiungi sezione;
- modifica;
- riordina;
- elimina;
- tipi sezione;
- salvataggio.

## Task 5 — Schede cristallo

Obiettivo:

Editor dedicato per pietre/cristalli.

Include:

- CRUD crystal cards;
- sort order;
- campi strutturati;
- integrazione come sezioni renderizzabili.

## Task 6 — Dati KDP copiabili

Obiettivo:

Pagina `/libri/[id]/kdp`.

Include:

- metadata KDP;
- descrizione;
- keyword 1-7;
- categorie suggerite;
- impostazioni stampa;
- nota AI;
- bottoni copia;
- export txt.

## Task 7 — AI Redattore

Obiettivo:

Integrare AI per revisione testi.

Include:

- azioni AI per singolo campo;
- confronto input/output;
- applica/scarta;
- log revisioni;
- genera descrizione;
- genera keyword;
- rimuovi claim medici.

## Task 8 — Template HTML 6x9

Obiettivo:

Rendering HTML del libro.

Include:

- template Crystal Minimal 6x9;
- rendering sezioni;
- rendering crystal cards;
- pagine journaling;
- numerazione;
- anteprima HTML.

## Task 9 — Export PDF

### Requisito Layout Engine V1 — registrato il 15 settembre 2026, da implementare

Milestone successiva alla chiusura verificata di Editorial Builder V1:

- generare automaticamente le pagine fisiche dal layout;
- numerare automaticamente le pagine risultanti;
- costruire l'indice usando le pagine reali assegnate ai titoli;
- ricalcolare numerazione e indice quando il contenuto cambia e le pagine slittano;
- consentire in futuro di scegliere quali livelli editoriali includere nell'indice.

Esempio: se una modifica ad Amore aggiunge due pagine, le voci successive
dell'indice e la numerazione devono aggiornarsi automaticamente. I numeri di
pagina sono risultati del layout e non devono essere salvati manualmente nei
contenuti. Questo requisito è solo documentato: nessuna paginazione, indice
definitivo o generazione PDF viene implementata nella diagnosi del Builder.

### Export

Obiettivo:

Generare PDF interno.

Include:

- Playwright/Chromium;
- endpoint export;
- salvataggio file;
- record kdp_exports;
- download PDF;
- page count.

## Task 10 — Validatore KDP V1

Obiettivo:

Validare prima e dopo export.

Include:

- controlli contenuti;
- controlli impostazioni;
- controlli metadata;
- report;
- stato passed/warning/failed.

## Task 11 — Primo test KDP manuale

Obiettivo:

Caricare manualmente un PDF su KDP Previewer e correggere eventuali problemi.

Include:

- esportare PDF demo;
- upload manuale su KDP;
- annotare errori;
- creare fix mirati.

## Task 12 — Hardening V1

Obiettivo:

Rendere la V1 usabile stabilmente.

Include:

- empty states;
- error handling;
- logging;
- UX mobile;
- backup/export dati;
- rifinitura copy.
