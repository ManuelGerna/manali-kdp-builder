# 06 — PDF Export Engine

## Obiettivo

Generare un PDF interno pronto per upload manuale su Amazon KDP.

## Strategia V1

Usare:

```text
HTML/CSS → PDF
```

Motore consigliato:

```text
Playwright / Chromium server-side
```

Motivo:

- più rapido da sviluppare;
- template HTML controllabili;
- anteprima più semplice;
- layout CSS stampabile;
- sufficiente per V1 no-bleed.

## Fuori scope V1

Non creare:

- editor drag & drop;
- posizionamento libero;
- cover PDF;
- bleed;
- CMYK avanzato;
- imposizione tipografica complessa;
- upload diretto KDP.

## Formato V1

```text
Trim size: 6 x 9 inches
Bleed: no
PDF size: 6 x 9 inches
Orientation: portrait
Interior: black & white
```

## CSS pagina V1

Il template deve definire pagine fisiche precise:

```css
@page {
  size: 6in 9in;
  margin-top: 0.75in;
  margin-bottom: 0.75in;
  margin-left: 0.60in;
  margin-right: 0.60in;
}
```

Nota: per libri stampati serve gestire margine interno/esterno. In V1, se Chromium non gestisce perfettamente pagine pari/dispari, usare margini conservativi simmetrici o una generazione pagina-per-pagina.

## Approccio consigliato per controllo maggiore

Per evitare problemi con margini inner/outer:

1. generare ogni pagina come container HTML di 6x9;
2. applicare classi `page odd` e `page even`;
3. gestire margini interni via padding;
4. esportare tutto in PDF.

Esempio:

```html
<div class="page odd">
  <div class="page-content">
    ...
  </div>
</div>
```

```css
.page {
  width: 6in;
  height: 9in;
  page-break-after: always;
}

.page.odd .page-content {
  padding: 0.75in 0.60in 0.75in 0.75in;
}

.page.even .page-content {
  padding: 0.75in 0.75in 0.75in 0.60in;
}
```

## Template V1

Nome:

```text
Crystal Minimal 6x9
```

Caratteristiche:

- bianco/nero;
- molto spazio bianco;
- titoli eleganti;
- corpo leggibile;
- box affermazione;
- pagine journaling semplici;
- numerazione pagina;
- nessun elemento a bleed.

## Tipi pagina

V1 deve supportare:

```text
title_page
disclaimer
introduction
chapter_text
crystal_card
affirmation_page
journaling_page
notes_page
summary_table
conclusion
blank_page
```

## Numerazione

Regola V1 semplice:

- no numero su title page;
- no numero su pagine blank;
- numero pagina da introduction in poi;
- footer centrato o esterno.

## File export

Generare:

```text
{slug}-interior-6x9-v{n}.pdf
{slug}-kdp-fields-v{n}.txt
{slug}-validation-report-v{n}.txt
```

## Storage

Salvare in storage path:

```text
books/{book_id}/exports/{export_id}/interior.pdf
books/{book_id}/exports/{export_id}/kdp-fields.txt
books/{book_id}/exports/{export_id}/validation-report.txt
```

## Validazione pre-export

Prima del PDF:

- titolo presente;
- autore presente;
- lingua presente;
- impostazioni presenti;
- almeno una sezione contenuto;
- disclaimer presente;
- AI usage valorizzato;
- metadata KDP presenti o generabili.

## Validazione post-export

Dopo il PDF:

- file generato;
- page count calcolato;
- dimensione pagina attesa;
- validation report salvato;
- export record creato.

## Page count

Il page count deve essere salvato in `kdp_exports.page_count`.

Servirà in V2 per:

- cover;
- spine;
- costo stampa;
- checklist KDP.
