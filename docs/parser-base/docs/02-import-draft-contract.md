# 02 — Import Draft Contract

## Scopo

Definire il formato concettuale della bozza importabile.

La bozza non deve essere per forza YAML perfetto. Può essere un testo strutturato con blocchi e campi. Il parser deve essere tollerante verso piccole ambiguità, purché il significato sia recuperabile.

## Versioning

Ogni bozza dovrebbe iniziare con una versione:

```text
KDP_BUILDER_DRAFT_VERSION: 0.1
```

La versione serve per:

- sapere quale parser usare;
- gestire compatibilità futura;
- introdurre nuovi blocchi senza rompere bozze vecchie;
- distinguere warning da errori.

Se la versione manca, il parser può tentare un import legacy, ma deve generare warning.

## Blocchi principali consigliati

```text
TIPO_PROGETTO
MODALITÀ_IMPORTAZIONE
LINGUA_LIBRO
MERCATO_TARGET
TIPO_LIBRO
NOTA_USO_AI

IDEA_LIBRO
SPECIFICHE_TECNICHE
SISTEMA_VISIVO
PIANO_PAGINE
SEQUENZA_PAGINE
TEMPLATE_PAGINA
TESTI_FISSI
BRIEF_COPERTINA
METADATI_KDP_DRAFT
CHECKLIST_QUALITÀ_PRIMA_EXPORT
LOGICA_AUTOMAZIONE_KDP_BUILDER
```

Non tutti i blocchi devono essere obbligatori. Per Parser V0, i blocchi minimi sono:

- specifiche progetto;
- specifiche tecniche;
- sequenza pagine;
- template pagina o template registry esterno;
- dati minimi per generare report.

## Campi strutturali importanti

### `numero_pagina`

Definisce una pagina singola.

```text
numero_pagina: 1
template_id: "template_generico"
titolo: "Titolo pagina"
```

### `intervallo_pagine`

Definisce un intervallo da espandere.

```text
intervallo_pagine: "10-20"
template_id: "template_generico"
ripeti: 11
```

### `template_id`

Identifica il template richiesto per renderizzare la pagina.

Il parser non deve disegnare il template. Deve solo collegare contenuto e `template_id`.

### `ripeti`

Indica quante istanze creare.

Il valore deve essere coerente con l’intervallo, quando presente.

Esempio:

```text
intervallo_pagine: "10-20"
ripeti: 11
```

Intervallo inclusivo: 10, 11, 12, ..., 20.

## Separazione interno, copertina e metadati

La bozza può contenere tutto, ma l’importer deve separare:

- `interior`: pagine del libro;
- `coverBrief`: brief copertina;
- `kdpMetadata`: titolo, sottotitolo, descrizione, keyword seed, note compliance;
- `qualityChecklist`: controlli prima dell’export.

La copertina non deve diventare una pagina interna, salvo esplicita indicazione futura.

## Tolleranza verso bozze non perfette

Il parser deve gestire:

- indentazione non perfetta;
- liste scritte con `-` oppure `*`;
- campi tabella indentati in modo ambiguo;
- blocchi opzionali mancanti;
- valori numerici scritti come testo;
- chiavi con accenti o caratteri speciali;
- spazi vuoti extra;
- campi sconosciuti.

I campi sconosciuti non devono essere eliminati. Se possibile, salvarli in `rawBlocks` o `extras` per non perdere informazioni.

## Errori bloccanti minimi

L’import deve fallire solo se:

- il testo è vuoto;
- non esiste nessuna pagina generabile;
- manca ogni informazione utile per creare un progetto;
- gli intervalli pagina sono impossibili da interpretare;
- i numeri pagina generano conflitti non risolvibili.

Tutto il resto dovrebbe diventare warning.
