# 04 — UI Flow

## Principio UX

La app deve essere semplice, operativa e mobile-first.

Non deve sembrare Canva.

Deve sembrare una dashboard produttiva:

```text
compilo → revisiono → valido → esporto → copio su KDP
```

## Navigazione V1

Route:

```text
/
 /libri
 /libri/nuovo
 /libri/[id]
 /libri/[id]/impostazioni
 /libri/[id]/contenuti
 /libri/[id]/cristalli
 /libri/[id]/ai
 /libri/[id]/kdp
 /libri/[id]/export
 /impostazioni
```

## Home

Se non loggato:

- redirect login.

Se loggato:

- redirect `/libri`.

## /libri

Dashboard libri.

Elementi:

- bottone "Nuovo libretto";
- lista libri;
- filtri per stato;
- card libro;
- ultimo export;
- stato validazione.

Card libro:

```text
Titolo
Sottotitolo
Autore
Stato
Formato
Ultima modifica
Azioni: Apri / Esporta / Dati KDP
```

## /libri/nuovo

Form rapido:

- titolo;
- sottotitolo;
- autore;
- lingua;
- tipo libretto;
- uso AI;
- crea.

Dopo creazione:

- crea automaticamente impostazioni default V1;
- crea sezione disclaimer vuota/precompilata;
- redirect dettaglio libro.

## /libri/[id]

Overview libro.

Sezioni:

- stato libro;
- progress checklist;
- dati principali;
- numero sezioni;
- numero schede cristallo;
- ultimo export;
- alert validazione.

CTA principali:

- Modifica contenuti;
- Apri redattore AI;
- Prepara dati KDP;
- Genera PDF.

## /libri/[id]/impostazioni

Form impostazioni PDF/KDP.

Per V1 molte impostazioni bloccate.

Campi modificabili:

- font titolo;
- font corpo;
- dimensione testo;
- interlinea;
- header on/off;
- footer on/off;
- numerazione pagine.

Campi bloccati V1:

- trim size 6x9;
- no bleed;
- black & white;
- white paper.

Mostrare nota:

```text
Nella V1 il formato è bloccato per garantire PDF stabile e rapido da validare.
```

## /libri/[id]/contenuti

Editor sezioni a blocchi.

Funzioni:

- aggiungi sezione;
- modifica sezione;
- duplica;
- riordina;
- elimina;
- salva;
- manda ad AI redattore.

Tipi sezione:

- title_page;
- disclaimer;
- introduction;
- chapter_text;
- affirmation_page;
- journaling_page;
- notes_page;
- summary_table;
- conclusion.

## /libri/[id]/cristalli

Editor schede cristallo.

Funzioni:

- aggiungi pietra;
- modifica;
- duplica;
- riordina;
- genera testo AI;
- correggi testo AI.

Campi scheda:

- nome pietra;
- descrizione breve;
- significato tradizionale;
- proprietà simboliche;
- chakra;
- elemento;
- come usarla;
- pulizia/ricarica;
- affermazione;
- journaling prompt;
- immagine opzionale.

## /libri/[id]/ai

Pannello redattore AI.

Azioni:

- revisiona sezione selezionata;
- revisiona scheda cristallo;
- genera descrizione KDP;
- genera keyword;
- controlla promesse mediche;
- uniforma tono;
- crea disclaimer.

Mostrare sempre confronto:

```text
Testo originale
Testo proposto
Azioni: Applica / Copia / Scarta
```

## /libri/[id]/kdp

Pagina finale con dati KDP copiabili.

Struttura:

1. Dettagli libro;
2. Descrizione;
3. Keyword;
4. Categorie suggerite;
5. Impostazioni stampa;
6. Nota AI;
7. Checklist upload.

Ogni campo deve avere bottone "Copia".

## /libri/[id]/export

Pagina export PDF.

Mostrare:

- stato validazione;
- errori;
- warning;
- bottone "Genera PDF";
- ultimo PDF scaricabile;
- page count;
- file name;
- report validazione.

Flusso:

```text
Valida → Genera PDF → Scarica PDF → Vai a Dati KDP
```

## /impostazioni

Impostazioni app.

V1:

- pen name default;
- lingua default;
- preferenze font;
- OpenAI API status se configurata;
- dominio app;
- note operative.
