# 02 — KDP Rules and Assumptions

## Scopo

Questo documento raccoglie le regole KDP da considerare nello sviluppo. Le regole ufficiali possono cambiare: prima di implementare validazioni definitive, verificare sempre la documentazione Amazon KDP aggiornata.

## Fonti ufficiali da consultare

- KDP Help — Set Trim Size, Bleed, and Margins
- KDP Help — Paperback Manuscript Formatting
- KDP Help — Content Guidelines
- KDP Help — Book Description
- KDP Help — Keywords
- KDP Help — Categories
- KDP Help — Cover Calculator and Templates
- KDP Help — Paperback Cover
- KDP Help — Tools and Resources

## Upload KDP

Assunzione V1:

```text
La app non carica automaticamente su Amazon KDP.
La app prepara PDF e campi copiabili.
L'utente carica manualmente su KDP Bookshelf.
```

Motivo:

- il flusso ufficiale KDP documenta upload manuale da Bookshelf;
- l'automazione browser sarebbe fragile;
- eventuali API ufficiali di upload non sono considerate disponibili per la V1.

## Formato V1

Formato iniziale supportato:

```text
Paperback
6 x 9 inches
No bleed
Black & white interior
White paper
PDF interior
```

## Bleed

V1: no bleed.

Motivo:

- riduce complessità;
- evita elementi fino al bordo;
- più facile validare i margini;
- ideale per libretti testuali/journal.

V2 potrà supportare bleed.

## Margini

Il sistema deve calcolare margini sicuri. Non lasciare all'utente libertà totale nella V1.

Per V1 usare margini conservativi:

```text
top: 0.75 in
bottom: 0.75 in
inner: 0.75 in
outer: 0.60 in
```

Questi valori sono volutamente prudenti per un libretto 6x9 senza bleed.

## Numero pagine

Il validatore deve controllare:

- page count minimo;
- page count pari o coerente per stampa;
- pagine vuote intenzionali;
- finale libro coerente.

Per i paperback KDP esistono requisiti minimi di pagine. La validazione deve essere configurabile perché i limiti possono cambiare in base a formato e tipo interno.

## Immagini

Per V1:

- immagini opzionali;
- nessuna immagine a bleed;
- immagini dentro margine sicuro;
- validare dimensione minima se usate;
- preferire immagini 300 DPI quando destinate alla stampa.

## Font

Per V1:

- usare font liberi e incorporabili;
- evitare font di sistema non controllati;
- mantenere poche opzioni.

Font iniziali consigliati:

```text
Heading: Cormorant Garamond / Playfair Display / Libre Baskerville
Body: Lora / EB Garamond / Source Serif 4
```

Prima di usare un font verificare licenza e incorporabilità.

## Contenuti AI

La app deve tracciare l'uso AI:

```text
none
ai_assisted
ai_generated
mixed
```

Linee operative:

- se l'utente scrive e la AI corregge/rifinisce: `ai_assisted`;
- se la AI genera testo da zero: `ai_generated`;
- se alcune parti sono scritte e altre generate: `mixed`.

La app deve mostrare una nota di pubblicazione per ricordare cosa dichiarare su KDP.

## Contenuti su cristalli e salute

Evitare promesse mediche.

Frasi da evitare:

- cura l'ansia;
- guarisce;
- elimina malattie;
- sostituisce trattamenti;
- ha effetti medici garantiti.

Preferire formule:

- secondo la tradizione;
- è spesso associata a;
- può essere usata come supporto simbolico;
- nell'ambito del journaling;
- durante meditazione e routine personali.

## Copertina

Fuori scope V1.

Motivo:

- la cover paperback dipende dal page count finale;
- il dorso cambia in base a numero pagine e carta;
- Amazon fornisce cover calculator e template.

V2 potrà generare:

- front cover;
- back cover;
- spine;
- barcode safe area;
- PDF cover completo.

## Validatore V1

Controlli minimi:

- titolo presente;
- autore presente;
- lingua presente;
- disclaimer presente;
- formato 6x9;
- bleed no;
- margini valorizzati;
- page count valido;
- keyword presenti;
- descrizione KDP presente;
- AI usage type valorizzato;
- nessun testo placeholder;
- nessuna sezione vuota non intenzionale;
- export PDF generato.
