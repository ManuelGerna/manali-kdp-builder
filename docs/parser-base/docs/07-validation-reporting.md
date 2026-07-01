# 07 — Validation and Reporting

## Scopo

Definire come validare una bozza importata e come comunicare il risultato.

## Filosofia

Il parser deve essere tollerante ma trasparente.

Non deve fallire per piccole ambiguità, ma deve sempre dire cosa ha normalizzato, cosa manca e cosa richiede revisione.

## Livelli problema

### Info

Informazione utile, non problematica.

Esempio:

```text
Draft version recognized: 0.1
```

### Warning

Problema non bloccante.

Esempi:

- versione bozza mancante;
- campo opzionale mancante;
- template non trovato;
- `ripeti` non coerente con intervallo ma intervallo valido;
- sezione con conteggio atteso diverso dal conteggio reale;
- campo tabella normalizzato da indentazione ambigua.

### Error

Problema bloccante.

Esempi:

- testo vuoto;
- nessuna pagina generata;
- numeri pagina duplicati non risolvibili;
- intervallo non interpretabile;
- mancano dati minimi progetto;
- target pagine obbligatorio non rispettato in modo grave.

## Import status

```ts
export type ImportStatus =
  | "success"
  | "success_with_warnings"
  | "failed";
```

## ImportIssue

```ts
export type ImportIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  path?: string;
  pageNumber?: number;
  templateId?: string;
  rawSnippet?: string;
};
```

## ImportSummary

```ts
export type ImportSummary = {
  title?: string;
  draftVersion?: string;
  targetPageCount?: number;
  generatedPageCount: number;
  sectionCount: number;
  fixedPageCount: number;
  expandedPageCount: number;
  requestedTemplateCount: number;
  missingTemplateCount?: number;
  warningCount: number;
  errorCount: number;
};
```

## Validazioni minime Parser V0

### Testo input

- non vuoto;
- dimensione ragionevole;
- newline normalizzati.

### Versione

- versione presente e supportata;
- oppure fallback con warning.

### Pagine

- almeno una pagina generata;
- nessun duplicato grave;
- intervalli validi;
- `ripeti` coerente o warning;
- numero pagine target coerente, se presente.

### Template

- ogni pagina dovrebbe avere `templateId`;
- template mancanti generano warning;
- report template usage sempre presente.

### Sezioni

- sezioni con id e titolo;
- conteggi coerenti se dichiarati;
- pagine assegnate quando possibile.

### Separazione blocchi

- copertina separata dall’interno;
- metadati separati dall’interno;
- checklist separata dall’interno.

## Report leggibile per UI

Dopo l’import, la UI dovrebbe mostrare:

```text
Importazione completata con avvisi

Titolo: ...
Pagine generate: ...
Sezioni: ...
Template richiesti: ...
Template mancanti: ...

Avvisi principali:
- ...
- ...
```

## Regola per Codex

Ogni warning/error deve avere un codice stabile, non solo testo libero.

Esempi:

```text
DRAFT_VERSION_MISSING
PAGE_RANGE_REPEAT_MISMATCH
TEMPLATE_NOT_FOUND
PAGE_DUPLICATE
TARGET_PAGE_COUNT_MISMATCH
```
