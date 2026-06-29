# KDP Builder — Documentazione iniziale

Questa cartella contiene i documenti di partenza per sviluppare **KDP Builder**, una web app privata di Manali Corporate per creare libretti Amazon KDP.

## Obiettivo

Costruire una app semplice che permetta di:

1. creare un libretto strutturato;
2. compilare impostazioni KDP;
3. usare AI come redattore/correttore;
4. esportare un PDF interno pronto per KDP;
5. generare tutti i campi KDP copiabili;
6. caricare manualmente su Amazon KDP.

## Decisione dominio

Dominio previsto:

```text
kdp.manalicorporate.com
```

## Separazione progetti

KDP Builder è un progetto interno Manali Corporate.

Non deve avere collegamenti con Artingo.

```text
Manali Corporate
├── Freedom & Urus
├── KDP Builder
└── altri progetti futuri

Artingo
└── prodotto SaaS separato
```

## Documenti

- `00_PROJECT_BRIEF.md` — visione generale.
- `01_PRODUCT_REQUIREMENTS_V1.md` — requisiti prodotto V1.
- `02_KDP_RULES_AND_ASSUMPTIONS.md` — regole KDP da supportare.
- `03_DATA_MODEL.md` — modello dati iniziale.
- `04_UI_FLOW.md` — flusso schermate.
- `05_AI_EDITOR.md` — redattore AI.
- `06_PDF_EXPORT_ENGINE.md` — generazione PDF.
- `07_KDP_COPY_FIELDS.md` — campi copiabili per Amazon KDP.
- `08_CODEX_OPERATING_RULES.md` — regole operative per Codex.
- `09_TASKS_ROADMAP.md` — roadmap task.
- `10_TASK_01_BOOTSTRAP_PROMPT.md` — primo prompt operativo per Codex.
