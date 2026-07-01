# KDP Builder — Parser Base Docs

Questa cartella contiene la documentazione base per implementare il parser/importer di KDP Builder.

Lo scopo è fornire a Codex una guida stabile, riutilizzabile e non legata a un singolo tipo di libretto. Il parser deve poter importare bozze testuali strutturate, normalizzarle e trasformarle in un progetto interno pronto per preview, modifica e successivo rendering PDF.

## Obiettivo della documentazione

Il parser deve trasformare un testo grezzo incollato dall’utente in una struttura dati stabile composta da:

- progetto;
- specifiche tecniche;
- sistema visivo;
- sezioni;
- pagine;
- template richiesti;
- brief copertina;
- metadati KDP;
- checklist qualità;
- report importazione.

Il parser non deve essere scritto per una nicchia specifica. Deve leggere una bozza generica e creare una struttura normalizzata valida per libretti diversi.

## Principio guida

La bozza è una ricetta. Il parser organizza gli ingredienti. Il template registry associa ogni pagina a un layout. Il renderer genera il PDF solo in una fase successiva.

Per questo primo blocco di sviluppo, la priorità è:

1. importare la bozza;
2. normalizzare i dati;
3. generare la sequenza pagine;
4. validare coerenza e completezza;
5. produrre un report leggibile;
6. salvare una struttura usabile da preview ed editor.

Non è obiettivo di questa fase generare un PDF finale perfetto.

## File da leggere per primi

1. `docs/00-index.md`
2. `docs/01-product-scope.md`
3. `docs/02-import-draft-contract.md`
4. `docs/03-parser-pipeline.md`
5. `docs/codex/task-01-parser-v0.md`

## Regole importanti

- Non inserire logiche specifiche di una nicchia nel parser.
- Non legare il parser a un singolo template o a un singolo libretto.
- Non bloccare tutto l’import se una pagina ha un problema non critico.
- Separare sempre interno, copertina e metadati.
- Rendere il parser tollerante verso bozze generate o riformattate da AI.
- Usare warning e report chiari invece di fallimenti silenziosi.
- Non implementare il renderer PDF dentro il parser.
- Non implementare generazione copertina dentro il parser.

## Posizione consigliata nel repository

Caricare questa cartella in:

```text
docs/kdp-builder/parser-base/
```

In questo modo resta separata dal README generale dell’app e può essere letta da Codex come documentazione tecnica dedicata.
