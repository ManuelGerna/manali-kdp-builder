# 08 — Preview and Editor Boundary

## Scopo

Definire cosa deve succedere dopo l’import e prima del render PDF.

## Dopo l’import

L’utente deve vedere una bozza strutturata, non un PDF finale.

La UI dovrebbe mostrare:

- riepilogo progetto;
- specifiche tecniche;
- sezioni;
- elenco pagine;
- stato pagina;
- template assegnato;
- warning principali;
- blocchi separati per copertina e metadati.

## Preview strutturata

Parser V0 può alimentare una preview semplice:

```text
Pagina 1
Template: template_id
Titolo: Titolo pagina
Campi: ...
Tabelle: ...
Prompt: ...
Stato: ready / needs_review / error
```

Non serve ancora una preview grafica fedele al PDF.

## Editor minimo

L’editor dovrebbe permettere modifiche base a:

- titolo progetto;
- specifiche tecniche;
- sezioni;
- titolo pagina;
- template pagina;
- campi;
- prompt;
- tabelle;
- ripetizioni;
- metadati;
- brief copertina.

## Cosa non deve fare l’editor V0

Non è necessario implementare subito:

- drag and drop avanzato;
- editor grafico pixel-perfect;
- modifica diretta del PDF;
- marketplace template;
- collaborazione multiutente;
- versioning editor complesso.

## Stato pagina nella UI

La pagina deve mostrare uno stato chiaro:

```text
ready
needs_review
error
```

Esempi:

- `ready`: import riuscito;
- `needs_review`: template mancante o campo ambiguo;
- `error`: pagina non renderizzabile.

## Separazione tra preview e renderer

La preview può essere più semplice del PDF finale.

Il renderer finale dovrà rispettare misure, margini, font, griglie e output PDF. La preview serve prima a capire se i dati sono corretti.

## Regola UX

Non mostrare all’utente solo “errore parser”. Mostrare sempre cosa è stato importato e cosa richiede attenzione.
