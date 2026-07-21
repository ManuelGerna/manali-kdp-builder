# Editorial Parser V1

## Scopo

Il sistema di importazione KDP mantiene due parser distinti perché gestisce due
classi di documento con contratti differenti.

`KDP_DRAFT_V1` è il formato per bozze strutturate. È destinato a:

- planner;
- logbook;
- workbook;
- libretti con pagine ripetitive;
- bozze con marker tecnici espliciti.

`KDP_EDITORIAL_DRAFT_V1` è il formato normalizzato prodotto dal parser
editoriale. È destinato a:

- libri editoriali;
- guide;
- manuali;
- libri spirituali;
- libri zodiacali;
- manoscritti scritti come testo naturale.

I due parser devono rimanere indipendenti. La modalità viene scelta
esplicitamente dal flusso di importazione: `structured` usa il parser storico,
mentre `editorial` usa il parser editoriale. Non viene effettuato un rilevamento
automatico aggressivo tra i due formati.

L'header `KDP_EDITORIAL_DRAFT_V1` è opzionale nel manoscritto. Se è presente
come prima riga significativa viene riconosciuto e rimosso dal contenuto del
libro; se è assente, il parser editoriale procede senza errori o warning. Il
valore resta il nome del formato interno e non è un requisito per l'autore.

## Principio fondamentale

> Il parser può modificare la struttura del documento, ma non il contenuto
> testuale.

Il parser editoriale può classificare una riga come titolo, intestazione,
paragrafo, lista o separatore e può collocarla nella gerarchia del libro. Non
può correggere, riscrivere o normalizzare il testo dell'autore.

In particolare, non può modificare:

- parole;
- punteggiatura;
- grammatica;
- maiuscole o minuscole;
- refusi;
- ripetizioni;
- tono;
- stile.

Ogni titolo, intestazione e blocco salvato deriva letteralmente da una o più
righe della sorgente. Il controllo di integrità confronta in ordine tutte le
righe significative della sorgente con quelle raccolte dal progetto
normalizzato. Dal confronto sono esclusi soltanto:

- l'eventuale header tecnico opzionale;
- le annotazioni pagina riconosciute;
- le differenze tra line ending `CRLF` e `LF`.

Il confronto deve rilevare perdita, duplicazione, modifica e riordinamento del
contenuto.

## Pipeline

```text
Testo naturale
      ↓
Parser editoriale
      ↓
Struttura editoriale
      ↓
Builder
      ↓
Impaginazione
      ↓
PDF KDP
```

Il parser editoriale termina la propria responsabilità con la produzione della
struttura modificabile. Non genera pagine, non inserisce page break, non decide
aperture a destra o a sinistra e non assegna preset di impaginazione. Il
renderer e le future funzioni del Builder sono responsabili della paginazione,
del layout e del PDF.

## Gerarchia

Il modello normalizzato supporta i seguenti livelli concettuali:

```text
Libro
├─ Introduzione
├─ Capitolo principale
│  ├─ Sottosezione
│  └─ Blocchi
├─ Sezione principale non numerata
│  ├─ Sottosezione numerata o non numerata
│  └─ Blocchi
└─ Sezione finale
   └─ Blocchi
```

I contenuti terminali possono essere:

- paragrafi;
- blocchi editoriali;
- liste;
- separatori.

Nel database i livelli principali diventano `kdp_sections`. Le intestazioni
interne e i contenuti diventano `kdp_section_blocks`, mantenendo titolo, corpo,
ordine e metadati normalizzati necessari a ricostruire la gerarchia.

## Regole di riconoscimento

Le regole sono deterministiche e conservative. Quando un segnale non è
abbastanza affidabile, il testo resta contenuto anziché essere trasformato in
una struttura inventata.

### Titolo

La prima riga significativa, dopo l'eventuale header tecnico, viene proposta
come titolo. Il valore viene copiato senza modifiche.

Una seconda occorrenza identica del titolo non apre una nuova sezione: rimane
contenuto nella posizione originale.

### Sottotitolo

La versione 1 non inferisce automaticamente il sottotitolo. Il valore resta
`null`. In particolare, una frase dopo il titolo non diventa un sottotitolo
soltanto perché non è separata da una riga vuota.

### Introduzione

Il contenuto successivo al titolo e precedente alla prima struttura
riconosciuta viene raccolto in una sezione di introduzione senza titolo. Le
intestazioni esplicite e generiche come `INTRODUZIONE`, `PREFAZIONE` o `PROLOGO`
possono aprire una sezione introduttiva titolata.

### Capitoli principali

Sono riconosciuti come capitoli principali:

- i marker espliciti come `CAPITOLO` o `CHAPTER` seguiti da numero o numero
  romano e titolo;
- la prima sequenza numerata coerente di intestazioni maiuscole, quando parte
  da `1` e prosegue con numerazione progressiva.

Lo stato del parser tiene conto della posizione nel documento, della sequenza
già aperta, del numero atteso e dell'eventuale sezione principale attiva.

### Sezioni principali non numerate

Una sezione principale non numerata viene riconosciuta usando segnali
contestuali, tra cui:

- un'intestazione maiuscola distinta;
- la conclusione della sequenza dei capitoli principali;
- l'apertura di un nuovo gruppo editoriale;
- la presenza di una numerazione interna che riparte da `1`;
- la presenza di sottostrutture subordinate;
- intestazioni finali generiche come conclusione, epilogo, appendice,
  ringraziamenti o note finali.

Le intestazioni generiche di blocchi minori, come `OMBRA`, `POTENZIALE`,
`EVOLUZIONE`, `ALLERTA`, `CONSIGLIO`, `RITO` o `UTILIZZO`, aiutano a distinguere
una sottosezione da una sezione principale. Sono segnali strutturali: non
autorizzano mai una modifica del testo.

### Sottosezioni

Dopo l'apertura di un capitolo, una riga maiuscola breve e riconoscibile può
diventare una sottosezione. Prima del primo capitolo il riconoscimento è più
prudente, così le parole maiuscole presenti nell'apertura restano contenuto.

Dentro una sezione principale, le intestazioni subordinate vengono conservate
come sottosezioni o blocchi editoriali in base al contesto. L'ordine sorgente è
sempre mantenuto.

### Numerazioni interne

Quando una sezione principale è attiva e compare una numerazione che riparte da
`1`, la sequenza viene mantenuta all'interno della sezione corrente. Non crea
una seconda serie di capitoli top-level.

Un marker esplicito come `CAPITOLO` o `CHAPTER` conserva invece il significato
di capitolo anche fuori dalla sequenza implicita. Questa distinzione permette a
una sezione principale di contenere sottoparti numerate senza dipendere dal
nome della sezione.

### Chiavi e sequenze ordinali

Intestazioni ordinali come `PRIMA CHIAVE`, `SECONDA PARTE`, `TERZO PASSO` o gli
equivalenti inglesi diventano intestazioni interne modificabili. Restano sotto
la sezione principale corrente e conservano integralmente il testo originale,
compresi trattini, accenti e nome associato.

La stessa regola si applica alle sequenze generiche di chiavi, parti, passi e
fasi supportate dal parser.

### Liste

Una lista viene riconosciuta soltanto in presenza di un marcatore esplicito.
Sono supportati i marcatori puntati, compreso `•`, e i marcatori numerici
espliciti. Righe consecutive senza marcatore non vengono convertite
automaticamente in lista.

Il testo completo di ogni riga, il marcatore e l'ordine restano invariati. Nel
progetto normalizzato il blocco mantiene il tipo `list`; nella persistenza
attuale viene rappresentato come blocco testuale compatibile con il Builder.

### Separatori

Sono riconosciuti come separatori strutturali:

- `⸻`;
- `---`;
- `***`;
- `___`.

Il carattere originale viene conservato nel blocco `separator`. Nella
persistenza attuale il separatore resta un blocco testuale visibile e
modificabile, mentre il progetto normalizzato ne conserva la semantica.

### Annotazioni pagina

Righe isolate come le seguenti sono annotazioni di lavorazione:

```text
PAGINA 1
📖 PAGINA 2
PAGINA 4 (CHIUSURA INTRO + TRANSIZIONE)
PAGINA 5 (destra)
PAGINA 6 (sinistra)
```

Le annotazioni riconosciute:

- non entrano nel contenuto del libro;
- non creano pagine;
- non creano page break;
- non cambiano l'ordine del contenuto;
- vengono conteggiate nel report come annotazioni ignorate.

Una riga viene ignorata soltanto se corrisponde interamente alla forma prevista
per un'annotazione pagina. Una normale frase che contiene la parola "pagina"
non viene rimossa.

## Persistenza

Il flusso editoriale crea e collega:

- `kdp_books`: metadati del libro, titolo, sottotitolo e visibilità;
- `kdp_sections`: introduzione, capitoli e sezioni principali nell'ordine
  rilevato;
- `kdp_section_blocks`: intestazioni interne e contenuti modificabili;
- `kdp_import_runs`: sorgente originale, progetto normalizzato, versione del
  parser e report dell'importazione.

Il valore di `import_kind` è `editorial_draft_v1`; la versione del parser è
`kdp_editorial_draft_v1`.

Il flusso non crea record in `kdp_imported_pages`. Le sezioni usano il preset
neutro `default`, con `page_break_before` impostato a `false`. Non viene
assegnato automaticamente `chapter_opening`.

La persistenza corrente usa più operazioni coordinate. Se una scrittura
successiva alla creazione del libro fallisce, viene tentato il cleanup
compensativo. L'esito del cleanup è controllato; un suo fallimento produce un
errore esplicito che segnala il possibile libro parziale.

## Preview e report

La preview precedente alla creazione espone almeno:

- formato;
- titolo;
- sottotitolo;
- numero di sezioni;
- numero di capitoli;
- numero di sottosezioni;
- numero di blocchi;
- annotazioni pagina ignorate;
- warning;
- errori.

Lo stesso riepilogo viene salvato in `kdp_import_runs.report` ed è letto dal
Builder attraverso un normalizzatore compatibile anche con i report storici.

## Scelte progettuali

Il parser editoriale non include:

- AI o LLM;
- correzione grammaticale;
- correzione automatica dei refusi;
- riscrittura o suggerimenti editoriali;
- generazione di immagini;
- generazione della copertina;
- impaginazione;
- generazione del PDF finale.

Queste responsabilità sono separate perché parsing, editing e rendering hanno
garanzie differenti. L'importazione deve essere deterministica e verificabile;
qualsiasi elaborazione creativa o scelta grafica appartiene a una fase
successiva e deve agire sulla struttura già importata.

## Golden sample

Il primo libro reale usato come golden sample è il manoscritto completo di
*Ariete*. Il testo del libro non fa parte di questa documentazione.

La validazione integrale ha verificato:

- titolo e gerarchia editoriale;
- conservazione dell'apertura e della chiusura;
- rimozione esclusiva delle annotazioni pagina;
- conservazione di liste, separatori, firma e riferimento social;
- assenza di pagine importate e decisioni di layout;
- nessuna perdita, duplicazione, modifica o variazione d'ordine;
- hash identico lungo il percorso sorgente → parser → persistenza.

Il golden sample protegge il caso reale senza introdurre regole hardcoded per
il segno zodiacale o per un singolo manoscritto.

## Qualità e regressioni

Ogni modifica futura al parser deve mantenere:

- il confronto deterministico di integrità;
- test su manoscritti naturali con e senza header opzionale;
- test sulla gerarchia di capitoli, sezioni e numerazioni interne;
- test su annotazioni pagina, liste e separatori;
- test sui piani di persistenza e sul cleanup;
- compatibilità con il Builder e con i report storici;
- regressione esplicita del flusso `KDP_DRAFT_V1`.

La modalità predefinita dell'importazione resta `structured`. Selezionare
`Libro editoriale` inoltra esplicitamente il testo al parser editoriale;
selezionare `Bozza strutturata` continua a usare esclusivamente il parser
storico.

## Stato e roadmap

`KDP_EDITORIAL_DRAFT_V1` è concluso per l'obiettivo di importazione fedele e
strutturazione modificabile del manoscritto.

Le milestone successive sono:

1. Editor editoriale;
2. AI Editor;
3. immagini;
4. copertina;
5. impaginazione;
6. PDF finale.

Queste milestone non fanno parte del parser e non devono estenderne le
responsabilità.
