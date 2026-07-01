# Generic Draft Skeleton

Questo file è uno scheletro generico di bozza importabile. Non descrive un libretto reale specifico. Serve solo per mostrare la forma del contratto di import.

```text
KDP_BUILDER_DRAFT_VERSION: 0.1

TIPO_PROGETTO: KDP_INTERIOR_BOOK
MODALITÀ_IMPORTAZIONE: RIPETIZIONE_TEMPLATE
LINGUA_LIBRO: it-IT
MERCATO_TARGET: Amazon.it
TIPO_LIBRO: tipo_generico
NOTA_USO_AI: Testi e struttura devono essere revisionati prima della pubblicazione.

IDEA_LIBRO:
titolo_provvisorio: "Titolo provvisorio"
sottotitolo: "Sottotitolo provvisorio"
pubblico_target: "Descrizione generica del pubblico target"
promessa_principale: "Descrizione generica del valore del libretto"
posizionamento: "Posizionamento generico"
tono: "Chiaro, pratico, ordinato"

SPECIFICHE_TECNICHE:
formato: "7 x 10 pollici"
interno: "Bianco e nero"
carta: "Bianca"
bleed: "No bleed"
numero_pagine_target: 20
rilegatura: "Paperback"
orientamento: "Verticale"
margini_consigliati:
  interno: "0.65 in"
  esterno: "0.45 in"
  alto: "0.45 in"
  basso: "0.50 in"

SISTEMA_VISIVO:
nome_stile: "Minimal Premium"
atmosfera: "Pulita, ordinata, leggibile"
modalità_colore: "Bianco, nero e scala di grigi"
elementi_ricorrenti:
- "Linee sottili"
- "Box per scrittura"
- "Tabelle leggere"
evitare:
- "Pagine troppo piene"
- "Elementi troppo vicini ai margini"

PIANO_PAGINE:
totale_pagine: 20
sezioni:
- id_sezione: "inizio"
  titolo_sezione: "Inizio"
  pagine: 3
- id_sezione: "contenuto_principale"
  titolo_sezione: "Contenuto principale"
  pagine: 14
- id_sezione: "finale"
  titolo_sezione: "Finale"
  pagine: 3

SEQUENZA_PAGINE:

* numero_pagina: 1
  template_id: "pagina_titolo"
  titolo: "Titolo provvisorio"
  sottotitolo: "Sottotitolo provvisorio"

* numero_pagina: 2
  template_id: "pagina_appartiene_a"
  titolo: "Questo libretto appartiene a"
  campi:
  - "Nome"
  - "Data di inizio"

* numero_pagina: 3
  template_id: "pagina_istruzioni"
  titolo: "Come usare questo libretto"
  testo: "Breve testo introduttivo generico."
  passaggi:
  - "Leggi le istruzioni."
  - "Compila le pagine."
  - "Rivedi i progressi."

* intervallo_pagine: "4-17"
  template_id: "pagina_template_ripetibile"
  ripeti: 14
  titolo_pattern: "Pagina compilabile"
  campi:
  - "Campo 1"
  - "Campo 2"
  tabella:
    colonne:
    - "Colonna A"
    - "Colonna B"
    - "Note"
    numero_righe: 8

* intervallo_pagine: "18-20"
  template_id: "pagina_note"
  ripeti: 3
  titolo_pattern: "Note"
  rotazione_prompt:
  - "Prompt finale 1"
  - "Prompt finale 2"
  - "Prompt finale 3"

TEMPLATE_PAGINA:
pagina_titolo:
  tipo_layout: "Titolo centrato"
  priorità: "Presentazione"

pagina_appartiene_a:
  tipo_layout: "Box dati"
  priorità: "Personalizzazione"

pagina_istruzioni:
  tipo_layout: "Testo più lista"
  priorità: "Usabilità"

pagina_template_ripetibile:
  tipo_layout: "Pagina compilabile generica"
  priorità: "Contenuto principale"

pagina_note:
  tipo_layout: "Pagina note con prompt"
  priorità: "Riflessione"

BRIEF_COPERTINA:
titolo_copertina: "Titolo provvisorio"
sottotitolo_copertina: "Sottotitolo provvisorio"
stile_copertina: "Minimal premium"
direzione_visiva:
- "Tipografia leggibile"
- "Composizione pulita"
evitare:
- "Loghi o marchi"
- "Immagini protette"

METADATI_KDP_DRAFT:
titolo: "Titolo provvisorio"
sottotitolo: "Sottotitolo provvisorio"
descrizione: "Descrizione generica da revisionare."
punti_elenco:
- "Punto elenco 1"
- "Punto elenco 2"
keyword_seed:
- "keyword generica 1"
- "keyword generica 2"
note_compliance:
- "Revisionare prima della pubblicazione."

CHECKLIST_QUALITÀ_PRIMA_EXPORT:
interno:
- "Controllare margini."
- "Controllare leggibilità."
copertina:
- "Controllare titolo in miniatura."
kdp:
- "Controllare metadati finali."
```
