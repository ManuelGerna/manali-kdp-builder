# 07 — KDP Copy Fields

## Obiettivo

La app deve generare una pagina finale con tutti i campi da copiare manualmente su Amazon KDP.

Ogni campo deve avere:

```text
label
value
copy button
last_generated_at
source
```

## Route

```text
/libri/[id]/kdp
```

## Sezione 1 — File da caricare

Campi:

```text
Interior PDF
File name
Page count
Export date
Validation status
```

Azioni:

- Scarica PDF;
- Scarica report validazione;
- Apri checklist.

## Sezione 2 — Dettagli libro

Campi copiabili:

```text
Titolo
Sottotitolo
Autore / Pen name
Lingua
Collana / Series opzionale
Edition number opzionale
```

## Sezione 3 — Descrizione KDP

Campi:

```text
Descrizione plain text
Descrizione HTML semplice
```

Azioni:

- Copia plain text;
- Copia HTML;
- Rigenera con AI;
- Modifica manualmente.

## Sezione 4 — Keyword KDP

Amazon KDP permette 7 campi keyword.

Campi:

```text
Keyword 1
Keyword 2
Keyword 3
Keyword 4
Keyword 5
Keyword 6
Keyword 7
```

Regole:

- evitare brand;
- evitare autori famosi;
- evitare keyword ingannevoli;
- evitare claim medici;
- keyword coerenti con contenuto reale.

## Sezione 5 — Categorie suggerite

Campi:

```text
Categoria suggerita 1
Categoria suggerita 2
Note categoria
```

Nota:

Le categorie effettive possono dipendere dal marketplace e dall'interfaccia KDP disponibile al momento della pubblicazione. La app suggerisce, l'utente verifica manualmente.

## Sezione 6 — Paperback content

Campi copiabili/consultabili:

```text
Print ISBN: Free KDP ISBN / Own ISBN
Publication date: lasciare vuoto o impostare manualmente
Print options: Black & white interior
Paper type: White paper
Trim size: 6 x 9 inches
Bleed settings: No bleed
Paperback cover finish: Matte suggested
Manuscript: upload Interior PDF
Book cover: Cover Creator/manuale nella V1
```

## Sezione 7 — AI disclosure note

Campi:

```text
Uso AI: none / ai_assisted / ai_generated / mixed
Nota interna
Nota da ricordare durante pubblicazione
```

Esempi:

### AI-assisted

```text
Testi scritti dall'autore e revisionati con AI per correzione, chiarezza e tono editoriale.
```

### AI-generated

```text
Alcuni contenuti testuali sono stati generati con AI e revisionati manualmente.
```

### Mixed

```text
Il libro contiene sezioni scritte dall'autore e sezioni generate o rielaborate con AI, tutte revisionate manualmente.
```

## Sezione 8 — Prezzo suggerito

Campi:

```text
Marketplace principale
Prezzo suggerito
Royalty stimata manuale
Note prezzo
```

V1 può lasciare il prezzo come campo manuale.

## Sezione 9 — Checklist upload KDP

Checklist:

```text
[ ] Titolo copiato
[ ] Sottotitolo copiato
[ ] Autore copiato
[ ] Descrizione copiata
[ ] 7 keyword copiate
[ ] Categorie selezionate
[ ] AI disclosure controllata
[ ] Trim size impostato 6x9
[ ] No bleed selezionato
[ ] Black & white interior selezionato
[ ] White paper selezionata
[ ] Interior PDF caricato
[ ] Previewer KDP controllato
[ ] Cover creata manualmente o con Cover Creator
[ ] Prezzo impostato
[ ] Marketplace controllati
```

## Export TXT

La app deve poter generare anche un file:

```text
kdp-fields.txt
```

Contenuto esempio:

```text
TITLE
...

SUBTITLE
...

AUTHOR
...

DESCRIPTION PLAIN
...

KEYWORDS
1. ...
2. ...
...

PRINT SETTINGS
Trim size: 6 x 9 inches
Bleed: No bleed
Interior: Black & white
Paper: White
```
