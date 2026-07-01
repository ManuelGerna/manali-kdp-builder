# 00 — Index

Questa documentazione definisce la base generica del parser/importer per KDP Builder.

## Lettura consigliata

1. `01-product-scope.md`  
   Capire cosa stiamo costruendo e cosa è fuori scope.

2. `02-import-draft-contract.md`  
   Capire com’è fatta una bozza importabile.

3. `03-parser-pipeline.md`  
   Capire i passaggi tecnici dell’import.

4. `04-normalized-data-model.md`  
   Capire quale struttura dati deve produrre il parser.

5. `05-page-generation.md`  
   Capire come generare pagine fisse e ripetute.

6. `06-template-registry.md`  
   Capire come collegare pagine e layout.

7. `07-validation-reporting.md`  
   Capire come gestire errori, warning e report.

8. `08-preview-and-editor-boundary.md`  
   Capire cosa vede e modifica l’utente dopo l’import.

9. `09-renderer-boundary.md`  
   Capire dove finisce il parser e dove inizia il renderer.

10. `10-testing-strategy.md`  
    Capire quali test servono per evitare regressioni.

11. `11-implementation-roadmap.md`  
    Capire in quale ordine implementare il sistema.

12. `codex/task-01-parser-v0.md`  
    Primo task operativo per Codex.

## Concetto centrale

Il parser non deve produrre direttamente un PDF. Deve produrre un progetto normalizzato, validato e modificabile.

Output atteso:

```text
raw draft text
↓
parser/importer
↓
normalized project
↓
preview/editor
↓
renderer
↓
PDF export
```

## Regola anti-fragilità

Le bozze importate possono contenere piccole incoerenze di formattazione. Il parser deve provare a normalizzare e segnalare warning. Deve fallire solo quando manca un’informazione davvero indispensabile.
