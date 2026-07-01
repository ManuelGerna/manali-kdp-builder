# Codex Task 01 — Implementare Parser V0 generico

## Obiettivo

Implementare la prima versione del parser/importer generico per KDP Builder.

Il parser deve ricevere una bozza testuale strutturata e restituire un progetto normalizzato, validato e pronto per preview/editor. Non deve generare PDF e non deve essere legato a un tipo specifico di libretto.

## Documentazione da leggere prima

Leggere tutta la cartella:

```text
docs/kdp-builder/parser-base/
```

Partire da:

```text
README.md
docs/00-index.md
docs/01-product-scope.md
docs/02-import-draft-contract.md
docs/03-parser-pipeline.md
docs/04-normalized-data-model.md
docs/05-page-generation.md
docs/07-validation-reporting.md
```

## Scope implementazione

Creare un modulo importer con una funzione principale simile a:

```ts
importKdpBuilderDraft(rawText: string, options?: ImportOptions): NormalizedKdpProject
```

I nomi esatti possono seguire le convenzioni del repository.

## La funzione deve fare

1. Validare input non vuoto.
2. Rilevare `KDP_BUILDER_DRAFT_VERSION` se presente.
3. Separare blocchi principali.
4. Parsare campi semplici, liste e oggetti annidati per quanto necessario.
5. Normalizzare i dati in un modello interno stabile.
6. Generare pagine singole da `numero_pagina`.
7. Espandere intervalli da `intervallo_pagine`.
8. Gestire `ripeti` e segnalare incoerenze.
9. Gestire rotazione contenuti quando presente.
10. Raccogliere template richiesti.
11. Segnalare template mancanti se viene fornito un registry.
12. Separare pagine interne, brief copertina, metadati e checklist.
13. Validare pagine duplicate, pagine mancanti e totale pagine target se presente.
14. Restituire `importReport` con summary, warning e errori.

## Non fare in questo task

- Non generare PDF.
- Non creare copertina.
- Non fare keyword research.
- Non implementare editor grafico.
- Non inserire logiche specifiche di una nicchia.
- Non fare refactor ampi non necessari fuori dallo scope.

## Output minimo

Il parser deve restituire una struttura con questi blocchi:

```text
source
project
technicalSpecs
visualSystem
sections
pages
templates
coverBrief
kdpMetadata
qualityChecklist
importReport
extras
```

## Test richiesti

Aggiungere test automatici per:

1. input vuoto;
2. versione presente;
3. versione mancante con warning;
4. pagine singole;
5. intervallo pagine inclusivo;
6. incoerenza intervallo/ripeti;
7. rotazione contenuti;
8. pagina duplicata;
9. template mancante;
10. separazione interno/copertina/metadati;
11. full generic draft usando `docs/examples/generic-draft-skeleton.md` o fixture derivata.

## Criteri di accettazione

Il task è completato quando:

- il parser importa una bozza generica completa;
- genera una lista pagine ordinata;
- espande correttamente gli intervalli;
- produce un report leggibile;
- non perde blocchi copertina/metadati/checklist;
- i test passano;
- il codice è generico e non contiene riferimenti a un singolo tipo di libretto.

## Note implementative

Preferire una pipeline composta da funzioni piccole:

```text
normalizeRawText
extractDraftVersion
splitTopLevelBlocks
parseDraftBlocks
normalizeParsedDraft
generatePages
resolveTemplates
validateImportedProject
buildImportReport
```

Se il repository ha già convenzioni per moduli, test e naming, seguirle.

## Guardrail

Il parser deve essere tollerante ma non silenzioso. Ogni correzione o fallback deve diventare warning nel report.
