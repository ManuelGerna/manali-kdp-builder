# ARIETE — diagnosi duplicazioni Editorial Builder, 15 settembre 2026

## Esito e chiusura

**SEGNALAZIONE CHIUSA. Nessun fix applicativo necessario o eseguito.**

Il caricamento autenticato della production, l'apertura di tutte le parti e
sottosezioni, la chiusura e il ritorno dall'anteprima mostrano 15 parti univoche.
L'utente ha successivamente confermato dal proprio telefono che, riaprendo
ARIETE → Contenuti da zero, tutte le 15 parti canoniche compaiono una sola volta.
Su sua conferma la segnalazione è chiusa: nessuna modifica UI/Builder giustificata.
Lo screenshot lungo/composito è una possibile spiegazione indicata dall'utente,
non una causa tecnica dimostrata. Restano i tre test e il requisito futuro di roadmap.

Progetto Supabase: manali-kdp-builder (`sppsgnhnloumfdldosbe`).
Libro: ARIETE (`ca3de2df-6dfc-422a-bf4f-8d54fef09cdf`).
Sito verificato: https://kdp.manalicorporate.com.
Codice locale ispezionato durante la diagnosi: HEAD `5f4360b`.
Il controllo production riguarda il comportamento osservato; non è un nuovo deploy.

## 1. Causa precisa / classificazione A–F

| Punto | Evidenza |
|---|---|
| A. Dati DB | Nessun duplicato: 15 sezioni, 15 UUID, sort_order 1–15 univoci. |
| B. Query/repository | Le letture delle sezioni non eseguono join o concatenazioni. Il DOM production corrisponde alle 15 righe SELECT. |
| C. Gerarchia | Le mappe producono 53 sottosezioni interne; nessun marker è promosso a parte. |
| D. Rendering React | 15 nodi top-level anche con tutte le parti e i loro contenuti aperti. Nessuna duplicazione riprodotta. |
| E. Concatenazione collezioni | Assente nei percorsi ispezionati. Un solo sections.map produce le parti del Builder. |
| F. Altro | Non determinato. Nessuna attribuzione dimostrata a cache, browser, screenshot o navigazione. |

`8. SFIDE KARMICHE` esiste legittimamente sia come capitolo sia come ottava
sottosezione **interna** di MANIFESTAZIONE. Questa omonimia non spiega da sola
la sequenza di quattro parti duplicate riportata dall'utente.

## 2. Le 15 righe reali kdp_sections

SELECT in sola lettura, ordinamento `sort_order, created_at, id`:

```sql
select id, title, section_type, sort_order
from public.kdp_sections
where book_id = 'ca3de2df-6dfc-422a-bf4f-8d54fef09cdf'
order by sort_order, created_at, id;
```

I titoli qui sotto conservano gli spazi del DB. NULL nell'introduzione è corretto:
«Introduzione» è soltanto la label della UI.

| sort_order | UUID | title DB | section_type | Sottosezioni | Blocchi |
|---:|---|---|---|---:|---:|
| 1 | `80de920c-5a85-4831-8e4c-84a582d7fe06` | NULL | `introduction` | 0 | 79 |
| 2 | `65bda051-5149-4907-85e5-f6a1ee2c60cf` | `1. AMORE` | `chapter` | 7 | 117 |
| 3 | `536c3a5e-b6f6-4139-89c9-187987559e60` | `2. RELAZIONI` | `chapter` | 7 | 131 |
| 4 | `a0cb3cc5-a2ad-4d4a-b839-33f9eba858d0` | `        3.      LAVORO & CARRIERA` | `chapter` | 3 | 115 |
| 5 | `751ce9d3-b32e-442a-a236-e51efab1022c` | `        4.      DENARO & SICUREZZA MATERIALE` | `chapter` | 5 | 59 |
| 6 | `6a2d35d3-0422-4983-8b98-99fa002ff165` | `      5.      CRESCITA PERSONALE` | `chapter` | 5 | 69 |
| 7 | `21f8d0ab-33eb-46a5-8a3b-2747c3df4092` | `        6.      SALUTE & BENESSERE` | `chapter` | 6 | 57 |
| 8 | `719e7bb3-c728-4fd8-b875-1a9dddf56128` | `        7.      COMUNICAZIONE & MENTE` | `chapter` | 6 | 53 |
| 9 | `76d018df-0145-4446-8044-d849fe5a3193` | `        8.      SFIDE KARMICHE` | `chapter` | 1 | 55 |
| 10 | `827645fa-49fc-45e9-a613-15fe97fcaa96` | `MANIFESTAZIONE` | `chapter_text` | 8 | 89 |
| 11 | `ba39358e-b863-46a1-9a2c-f29114730c1d` | `PIETRE NATURALI` | `chapter_text` | 3 | 126 |
| 12 | `06876d79-0fad-43f6-a8d3-75a0399ed1fe` | `I CODICI ENERGETICI DELL’ARIETE` | `chapter_text` | 2 | 67 |
| 13 | `b03da63c-c48f-4669-a957-230065b91fea` | `LA TUA MAGIA CONTINUA` | `chapter_text` | 0 | 36 |
| 14 | `03be8fc4-a3b9-4b65-a627-5d896c0f0b14` | `UN DONO CHE CONTINUA IL VIAGGIO` | `chapter_text` | 0 | 50 |
| 15 | `bf7ee9c1-de83-4159-a676-c622fe612b88` | ` PRIMA DI SALUTARCI…` | `chapter_text` | 0 | 64 |

## 3 e 6. Parti costruite prima di qualsiasi fix e struttura osservata finale

I due elenchi coincidono, perché non è stato applicato alcun fix.
Spazi visuali collassati come nel browser; ordine e identità preservati:

1. Introduzione
2. 1. AMORE
3. 2. RELAZIONI
4. 3. LAVORO & CARRIERA
5. 4. DENARO & SICUREZZA MATERIALE
6. 5. CRESCITA PERSONALE
7. 6. SALUTE & BENESSERE
8. 7. COMUNICAZIONE & MENTE
9. 8. SFIDE KARMICHE
10. MANIFESTAZIONE
11. PIETRE NATURALI
12. I CODICI ENERGETICI DELL’ARIETE
13. LA TUA MAGIA CONTINUA
14. UN DONO CHE CONTINUA IL VIAGGIO
15. PRIMA DI SALUTARCI…

Ogni parte compare una sola volta come nodo top-level, inclusi i tre titoli finali.

## 4. Punti esatti del codice ispezionato

- `src/lib/kdp/sections.ts:101`: listSections, SELECT diretto per book_id.
- `src/lib/kdp/books.ts:277`: SELECT sezioni usato da getBookDetail/anteprima.
- `src/app/libri/[id]/contenuti/page.tsx:252`: badge sections.length.
- `src/app/libri/[id]/contenuti/page.tsx:269`: unica istanza EditorialBuilder.
- `src/app/libri/[id]/contenuti/editorial-builder.tsx:334`: sections.map,
  una EditorialSectionNode con key=section.id per riga.
- `src/app/libri/[id]/contenuti/editorial-builder.tsx:132`: readEditorialMap
  e buildEditorialBlockHierarchy applicati ai blocchi della singola sezione.
- `src/lib/kdp/editorial-hierarchy.ts:28`: validazione dei marker rispetto
  ai soli blocchi ricevuti per quella sezione.
- `src/lib/kdp/editorial-hierarchy.ts:55`: risultato composto esclusivamente
  da openingBlocks e subsections, senza creazione di parti top-level.
- `src/app/libri/[id]/anteprima/editorial-preview.tsx:34`: sections.map;
  la collezione editorialSections alimenta indice e manoscritto (righe 60 e 80).

**Nessuna di queste righe è identificata come responsabile di una duplicazione
riproducibile.** I due componenti condividono le funzioni di titolo e gerarchia,
ma costruiscono la lista delle parti in due cicli distinti sullo stesso insieme DB.
I test verificano la coincidenza di UUID, ordine e titoli dei risultati.

Osservazione secondaria: listSections ordina per sort_order e created_at;
getBookDetail ordina solo per sort_order. Non è la causa in ARIETE, che ha
sort_order tutti distinti, e non può creare righe aggiuntive. Nessuna modifica
al repository è stata introdotta come presunto fix.

## 5. Modifiche eseguite

Solo tre nuovi test di regressione, questa diagnosi e la documentazione della
milestone futura. Nessuna modifica a UI, Builder, gerarchia, query o persistenza.

## 7. Confronto completo normalized_project / mappe

Nuovo snapshot production letto con SELECT il 15 settembre, non riutilizzo
non verificato dello snapshot storico:

- 15 sourceSectionId corrispondono alle 15 sezioni normalizzate nello stesso ordine.
- Titoli e tipi corrispondono, con main normalizzato rappresentato da chapter_text.
- 53 semantic_id, kind, order e original_number corrispondono al progetto.
- Tutti i heading_block_id indicano il blocco atteso nella sezione corretta.
- Nessun UUID marker ripetuto o appartenente a un'altra sezione.
- Confronto integrale di titolo, corpo, tipo e ordine: **1.167/1.167**, zero mismatch.
- Gerarchia ricomposta: tutti i 1.167 UUID una volta, senza blocchi persi.

Conferma: **53 / 8 / 3 / 2**.

Lo snapshot integrale e il report macchina restano in
`node_modules/.cache/editorial-builder-review/diagnosis-2026-09-15-*.json`,
ignorati da Git e contenenti il testo originale. SHA256 dello snapshot JSON
canonico restituito dalla SELECT:
`2a85d88b1916d2400adb7ff7b498ba585ed9a9a023f3f326e4e76ef981e4fcd0`.
La diagnosi sulla copia usa le mappe esistenti senza ricrearle e non chiama RPC.

## 8. Pietre Naturali

Verifica production aprendo la parte e tutte le chiavi:

- Testo introduttivo: 33 blocchi.
- PRIMA CHIAVE — CORNIOLA: marker + 24 blocchi interni.
- SECONDA CHIAVE — LABRADORITE: marker + 24 blocchi interni.
- TERZA CHIAVE — QUARZO FUMÉ: marker + 42 blocchi interni.

Totale: 126. Potere sul corpo, Potere sulla mente e sullo spirito, Energia del
chakra, Utilizzo, Se la scegli grezza e Se la indossi sono contenuti delle chiavi.
Non compaiono come sottosezioni sorelle.

## 9. Manifestazione

Apertura di 34 blocchi, poi le sole otto sottosezioni:

1. AMORE
2. RELAZIONI
3. LAVORO E CARRIERA
4. DENARO E SICUREZZA MATERIALE
5. CRESCITA PERSONALE & SPIRITUALE
6. SALUTE E BENESSERE
7. COMUNICAZIONE E MENTE
8. SFIDE KARMICHE

Totale 89 blocchi. Rito e Frasi di manifestazione restano contenuti interni.

## 10. Codici Energetici

Apertura di 11 blocchi, poi:

- I NUMERI CHE RISUONANO CON LA TUA ENERGIA: marker + 23 blocchi.
- I COLORI CHE ACCENDONO LA TUA ENERGIA: marker + 31 blocchi.

Totale 67 blocchi. Le etichette minori, compresa Energia da ricordare, non
aggiungono sottosezioni o voci d'indice.

## 11. Anteprima e lazy rendering — sessione autenticata production

- Builder inizialmente chiuso: 15 parti univoche.
- Tutte le parti aperte: 15 parti, 53 sottosezioni.
- Tutti i contenuti aperti: 1.167 ID blocco, 1.167 ID distinti.
- Dopo chiusura: 15 parti, zero blocchi e zero sottosezioni montati; 1 form
  di logout e 156 elementi DOM nell'intero documento. Lazy rendering attivo.
- Anteprima: 15 article con gli stessi UUID e titoli del Builder, stesso ordine.
- 53 sottosezioni e 1.114 blocchi testo = 1.167 blocchi disponibili.
- Indice: 15 voci principali + 53 sottosezioni = 68 link, zero destinazioni mancanti.
- Nessun UUID tecnico visibile e nessuna voce d'indice per microtitoli.
- Ritorno dall'anteprima: ancora 15 parti e 15 UUID distinti.
- Nessuna numerazione delle pagine o nuova paginazione.

Il numero totale di volte in cui una parola compare nella pagina non misura
le duplicazioni top-level: l'anteprima include sia indice sia manoscritto,
e alcuni titoli di Manifestazione coincidono con quelli dei capitoli.

## 12. Diario Allenamento 90 Giorni

Libro `b454e72f-a17a-4c36-ad71-d1fee295d885`:

- DB: 7 sezioni, 110 pagine importate, zero mappe editorial_builder_v1.
- Import kind: generic_draft_v0.
- Apertura production di /contenuti reindirizza a /pagine-importate.
- La pagina autenticata mostra tutte le 110 pagine in 7 sezioni.
- Nessun Editorial Builder.
- Test delle route Builder e anteprima: redirect al flusso delle pagine prima
  di caricare i blocchi editoriali.

## 13–14. Test e verifiche finali

Tre test aggiunti:

1. Builder, article e indice dell'anteprima hanno gli stessi 15 UUID univoci,
   ordine canonico e titoli; i marker non sono parti top-level.
2. Anteprima conserva i 1.167 blocchi e i titoli esatti dei gruppi 8/3/2,
   senza UUID o numerazione tecnica visibile.
3. Ogni marker appartiene alla sua sezione e la gerarchia conserva ogni blocco
   esattamente una volta; un heading UUID esterno viene rifiutato.

I test preesistenti continuano a coprire 53 sottosezioni, contenuti minori,
lazy rendering, import strutturato e 110 pagine del Diario.

| Verifica | Esito |
|---|---|
| git diff --check | PASS |
| npm.cmd run typecheck | PASS |
| npm.cmd run lint | PASS, nessun warning ESLint |
| npm.cmd test | PASS: 182/182, zero skip |
| npm.cmd run build | PASS |

La suite preesistente usa PGlite isolato per i test RPC e fixture sintetiche.
Queste prove locali non eseguono migration o bootstrap in production.

## 15. Layout Engine V1

Requisito registrato in `docs/09_TASKS_ROADMAP.md`: pagine fisiche automatiche,
numerazione e indice basati sulle pagine reali, aggiornamento al variare dei
contenuti e futura scelta dei livelli da includere. Numeri mai memorizzati
manualmente nei contenuti. Nessuna implementazione in questo task.

## 16–19. Confini rispettati durante la diagnosi

- Parser e testo del libro non modificati.
- Importazione, normalized_project, schema DB e migration non modificati.
- Nessuna operazione migration, repair o bootstrap ripetuta in production.
- Nessun INSERT, UPDATE, DELETE o RPC di modifica su production.
- Rilettura integrale finale: sezioni, blocchi (compresi timestamp/settings) e
  normalized_project identici al primo snapshot della diagnosi.
- Nessun nuovo motore layout, indice definitivo, pagina, numero pagina o PDF.
- Nessun commit, push o deploy.
- `tmp/ARIETE_manoscritto_completo_per_parser.txt` era preesistente e resta intatto.

## Chiusura manuale e consegna autorizzata

L'utente conferma la correttezza della production dal telefono e chiude la
segnalazione senza richiedere fix. Autorizza un commit dedicato ai tre test di
regressione e alla documentazione, seguito da push su origin/main dopo tutti i
controlli locali. tmp/ e il manoscritto Ariete sono esclusi dallo stage.
Nessun ulteriore codice applicativo o dato production viene modificato.
