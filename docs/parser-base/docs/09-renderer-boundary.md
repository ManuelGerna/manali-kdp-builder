# 09 — Renderer Boundary

## Scopo

Definire dove finisce il parser e dove inizia il renderer.

## Parser

Il parser produce dati.

Responsabilità:

- import;
- normalizzazione;
- generazione pagine;
- validazione;
- report;
- salvataggio struttura.

## Renderer

Il renderer produce output visivo.

Responsabilità:

- applicare formato pagina;
- applicare margini;
- disegnare template;
- calcolare spazi;
- evitare overflow;
- generare PDF;
- verificare area sicura;
- produrre output conforme alle specifiche tecniche.

## Input del renderer

Il renderer dovrebbe ricevere:

```ts
{
  technicalSpecs,
  visualSystem,
  pages,
  templateRegistry,
  renderOptions
}
```

## Cosa il renderer non deve fare

Il renderer non deve:

- riparsare il testo originale;
- inventare pagine mancanti;
- correggere metadati KDP;
- mescolare copertina e interno;
- modificare il modello dati senza passare dall’editor/importer.

## Cosa il parser non deve fare

Il parser non deve:

- calcolare layout finale in punti PDF;
- decidere font definitivi;
- risolvere overflow grafici;
- generare immagini;
- creare copertine;
- esportare file finale.

## Output futuro

La pipeline completa sarà:

```text
raw draft
↓
normalized project
↓
structured preview
↓
manual review
↓
template rendering
↓
PDF export
↓
quality checklist
```

## Validazioni renderer future

Quando il renderer sarà implementato, dovrà validare:

- numero pagine finale;
- dimensione pagina;
- bleed/no bleed;
- margini;
- area sicura;
- overflow testo;
- tabelle troppo dense;
- elementi fuori pagina;
- coerenza bianco/nero o colore;
- qualità anteprima.

Queste validazioni sono successive al Parser V0.
