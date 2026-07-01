# 03 — Parser Pipeline

## Obiettivo

Definire la pipeline tecnica dell’importer.

Il parser deve essere composto da passaggi chiari e testabili. Evitare una funzione unica enorme che fa tutto.

## Pipeline consigliata

```text
1. receiveRawDraft
2. detectDraftVersion
3. splitTopLevelBlocks
4. parseBlocks
5. normalizeDraft
6. generatePages
7. resolveSections
8. resolveTemplates
9. validateProject
10. buildImportReport
11. returnNormalizedProject
```

## 1. receiveRawDraft

Input: testo grezzo incollato dall’utente.

Responsabilità:

- verificare che sia una stringa non vuota;
- preservare il testo originale;
- normalizzare newline;
- rimuovere caratteri invisibili problematici;
- non distruggere indentazione utile.

## 2. detectDraftVersion

Responsabilità:

- cercare `KDP_BUILDER_DRAFT_VERSION`;
- assegnare versione riconosciuta;
- generare warning se manca;
- preparare fallback parser se necessario.

## 3. splitTopLevelBlocks

Responsabilità:

- individuare blocchi principali in maiuscolo o con naming noto;
- separare header globali dai blocchi multilinea;
- conservare contenuto raw per debug.

Esempio blocchi:

```text
IDEA_LIBRO:
SPECIFICHE_TECNICHE:
SEQUENZA_PAGINE:
```

## 4. parseBlocks

Responsabilità:

- convertire campi semplici;
- convertire liste;
- convertire oggetti annidati;
- leggere sequenze di pagine;
- riconoscere pagine singole e intervalli;
- recuperare campi tabella comuni.

Il parser può usare una strategia ibrida:

- parsing line-based per robustezza;
- tentativo YAML-like dove possibile;
- fallback euristico per blocchi complessi.

## 5. normalizeDraft

Responsabilità:

- trasformare sinonimi in chiavi canoniche;
- convertire numeri testuali in numeri;
- convertire valori booleani comuni;
- normalizzare unità di misura;
- normalizzare `pageNumber`, `pageRange`, `repeatCount`, `templateId`;
- salvare dati non riconosciuti in `extras`.

## 6. generatePages

Responsabilità:

- creare pagine singole;
- espandere intervalli;
- applicare rotazioni contenuto;
- assegnare numero pagina;
- associare ogni pagina a sezione e template;
- contare pagine fisse e ripetute.

## 7. resolveSections

Responsabilità:

- leggere piano sezioni;
- assegnare pagine alle sezioni;
- verificare coerenza tra numero pagine sezione e pagine generate;
- segnalare pagine non assegnate.

## 8. resolveTemplates

Responsabilità:

- raccogliere tutti i `template_id` richiesti;
- confrontarli con template disponibili, se il registry esiste;
- segnare pagine con template mancante come `needs_review`;
- non bloccare l’import se il template mancante può essere creato dopo.

## 9. validateProject

Responsabilità:

- controllare pagine duplicate;
- controllare pagine mancanti;
- controllare intervalli incoerenti;
- controllare totale target vs totale generato;
- controllare campi obbligatori minimi;
- classificare problemi in warning o errori.

## 10. buildImportReport

Responsabilità:

- produrre riepilogo leggibile;
- includere conteggi principali;
- includere warning e errori;
- includere stato finale import.

## 11. returnNormalizedProject

Output finale:

```text
{
  rawDraft,
  project,
  technicalSpecs,
  visualSystem,
  sections,
  pages,
  templates,
  coverBrief,
  kdpMetadata,
  qualityChecklist,
  importReport
}
```

## Regola architetturale

Ogni step deve essere testabile in isolamento. I test principali devono però coprire anche la pipeline completa end-to-end.
