# 05 — Page Generation

## Scopo

Definire come il parser deve generare la sequenza pagine a partire dalla bozza.

## Tipi di pagina supportati

### Pagina singola

Una pagina singola ha un numero preciso.

```text
numero_pagina: 1
template_id: "template_id"
titolo: "Titolo pagina"
```

Output:

```text
BookPage(pageNumber=1, sourceType="single")
```

### Intervallo pagine

Un intervallo rappresenta più pagine generate dallo stesso template.

```text
intervallo_pagine: "10-20"
template_id: "template_id"
ripeti: 11
```

Output:

```text
BookPage(pageNumber=10, sourceType="expanded_range")
...
BookPage(pageNumber=20, sourceType="expanded_range")
```

## Intervalli inclusivi

Gli intervalli sono inclusivi.

```text
"10-20" = 10, 11, 12, ..., 20
```

Conteggio:

```text
endPage - startPage + 1
```

## Validazione `ripeti`

Se sono presenti sia `intervallo_pagine` sia `ripeti`, il parser deve controllare coerenza.

Esempio valido:

```text
intervallo_pagine: "10-20"
ripeti: 11
```

Esempio warning:

```text
intervallo_pagine: "10-20"
ripeti: 10
```

In caso di incoerenza, priorità consigliata:

1. usare l’intervallo come fonte primaria;
2. generare warning;
3. continuare l’import se non ci sono sovrapposizioni.

## Rotazione contenuti

Alcune pagine ripetute possono avere una lista di contenuti da ruotare.

```text
rotazione_prompt:
- "Prompt A"
- "Prompt B"
- "Prompt C"
```

Regole:

- se il numero di prompt coincide con il numero pagine, assegnare 1:1;
- se i prompt sono meno delle pagine, ricominciare dal primo;
- se i prompt sono più delle pagine, usare solo quelli necessari e generare warning leggero;
- salvare il prompt assegnato nel contenuto della pagina.

## Titoli dinamici

Alcune pagine possono usare un pattern titolo.

```text
titolo_pattern: "Titolo pagina"
```

Parser V0 può usare il titolo così com’è per tutte le pagine.

In futuro si potranno supportare variabili:

```text
titolo_pattern: "Titolo {n}"
```

## Pagine duplicate

Se due definizioni generano lo stesso numero pagina, il parser deve creare errore bloccante o warning grave.

Regola consigliata per Parser V0:

- pagina duplicata da definizioni diverse = errore bloccante;
- pagina duplicata identica = warning e deduplicazione solo se sicura.

## Pagine mancanti

Se il target pagine è noto e mancano numeri, generare warning o errore in base alla gravità.

Esempio:

```text
targetPageCount: 100
pages generated: 1-50, 52-100
missing: 51
```

Se il progetto richiede sequenza completa, pagina mancante = errore.

## Assegnazione sezioni

Se il piano sezioni specifica il numero pagine per sezione, il parser può assegnare sequenzialmente.

Esempio:

```text
Sezione A: 3 pagine
Sezione B: 5 pagine
```

Assegnazione:

```text
pagine 1-3 → Sezione A
pagine 4-8 → Sezione B
```

Se il draft include già `sectionId` per pagina, usare quello come fonte primaria.

## Stati pagina

Ogni pagina deve avere uno stato.

```text
ready
needs_review
error
```

Esempi:

- `ready`: pagina completa e template presente;
- `needs_review`: pagina importata ma template mancante o campi ambigui;
- `error`: pagina non utilizzabile senza correzione.
