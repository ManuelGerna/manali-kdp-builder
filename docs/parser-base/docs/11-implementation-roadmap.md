# 11 — Implementation Roadmap

## Obiettivo

Implementare KDP Builder Importer in modo progressivo, senza partire dal PDF finale.

## Milestone 1 — Parser V0 puro

Deliverable:

- funzione import principale;
- parser blocchi base;
- normalizzazione minima;
- generazione pagine;
- validazione base;
- report import.

Non serve UI completa.

## Milestone 2 — Fixture e test

Deliverable:

- fixture generiche;
- test unitari;
- test pipeline completa;
- test regressione per casi ambigui.

## Milestone 3 — Persistenza progetto

Deliverable:

- salvataggio normalized project;
- schema DB o storage applicativo;
- stato import;
- cronologia import opzionale.

## Milestone 4 — UI import

Deliverable:

- textarea/incolla bozza;
- pulsante analizza;
- riepilogo import;
- warning/errori leggibili;
- pulsante crea progetto.

## Milestone 5 — Preview strutturata

Deliverable:

- elenco sezioni;
- elenco pagine;
- dettaglio pagina;
- stato template;
- dati pagina leggibili;
- separazione copertina/metadati/checklist.

## Milestone 6 — Template Registry V0

Deliverable:

- registry template base;
- controllo template mancanti;
- metadati template;
- componenti preview iniziali.

## Milestone 7 — Renderer V0

Deliverable successivo, non parte del Parser V0:

- rendering PDF interno;
- template principali;
- margini;
- output scaricabile;
- controlli base di overflow.

## Milestone 8 — Quality Gate

Deliverable:

- checklist export;
- avvisi margini/layout;
- controllo numero pagine;
- controllo template mancanti;
- stato pronto/non pronto per export.

## Ordine consigliato per Codex

1. Leggere questa cartella docs.
2. Implementare Parser V0 senza UI complessa.
3. Aggiungere test generici.
4. Solo dopo collegare UI import.
5. Solo dopo implementare preview.
6. Solo dopo passare al renderer.

## Anti-pattern da evitare

- partire dal PDF prima dell’import;
- scrivere parser per un solo esempio;
- mischiare parser e renderer;
- perdere dati non riconosciuti;
- fallire per piccoli problemi di formattazione;
- nascondere warning all’utente;
- creare logiche speciali nel parser base per un tipo di libretto.
