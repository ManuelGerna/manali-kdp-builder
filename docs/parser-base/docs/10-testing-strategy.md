# 10 — Testing Strategy

## Obiettivo

Garantire che il parser sia stabile, riutilizzabile e non legato a un singolo caso.

## Tipi di test

### Unit test

Testare singole funzioni:

- detectDraftVersion;
- splitTopLevelBlocks;
- parsePageRange;
- normalizeTechnicalSpecs;
- generatePagesFromRange;
- rotateContent;
- validateDuplicatePages;
- buildImportReport.

### Integration test

Testare l’intera pipeline con fixture generiche.

Input:

```text
bozza completa generica
```

Output atteso:

- progetto creato;
- sezioni create;
- pagine create;
- intervalli espansi;
- template raccolti;
- report prodotto.

### Regression test

Ogni bug parser corretto deve diventare fixture.

Esempi:

- indentazione ambigua;
- lista con `*` invece di `-`;
- intervallo con spazi;
- `ripeti` incoerente;
- blocco opzionale mancante;
- template mancante;
- numeri pagina duplicati.

## Fixture consigliate

Creare fixture generiche, non legate a una nicchia:

```text
fixtures/importer/basic-single-pages.txt
fixtures/importer/range-expansion.txt
fixtures/importer/rotation-content.txt
fixtures/importer/missing-template.txt
fixtures/importer/duplicate-pages.txt
fixtures/importer/ambiguous-table-fields.txt
fixtures/importer/full-generic-draft.txt
```

## Test minimi per Parser V0

1. Test bozza vuota → fallisce con errore chiaro.
2. Test versione mancante → importa con warning.
3. Test pagine singole → genera pagine corrette.
4. Test intervallo → espande numeri corretti.
5. Test `ripeti` incoerente → warning.
6. Test pagina duplicata → errore.
7. Test template mancante → pagina `needs_review`.
8. Test blocchi separati → interno, copertina e metadati separati.
9. Test report → conteggi corretti.
10. Test full generic draft → import end-to-end riuscito.

## Principio di test

Non testare solo “happy path”. Le bozze generate da AI saranno spesso quasi corrette, ma non perfette. Il valore del parser sta nella capacità di recuperare e segnalare.

## Snapshot

Per la struttura normalizzata può essere utile usare snapshot test, ma con attenzione:

- snapshot per output stabile;
- assert specifici per conteggi importanti;
- evitare snapshot enormi inutili;
- preferire assert leggibili su pagine, template e report.

## Codici errore stabili

I test devono verificare codici errore/warning, non solo messaggi testuali.

Esempio:

```text
PAGE_RANGE_REPEAT_MISMATCH
```

Meglio di:

```text
"Il numero ripeti non coincide..."
```
