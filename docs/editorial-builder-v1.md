# Editorial Builder V1 — fix blocker

Implementazione e verifica locale del 14 settembre 2026. Successivamente, su autorizzazione esplicita, eseguiti riconciliazione history, migration remota e bootstrap del solo Ariete: vedere `supabase-migration-history-audit-2026-09-14.md`. Database approvato; il rilascio applicativo tramite main è autorizzato separatamente e non deve ripetere operazioni sul database.

## Fonte canonica e mappa

Il database reale conserva editorialImporter.sourceSectionId nelle impostazioni delle sezioni. I 1.167 blocchi Ariete sono righe text senza metadati semantici propri. La gerarchia completa è già in kdp_import_runs.normalized_project: 15 sezioni e 53 sottosezioni con kind heading, numbered, key.

La nuova mappa autorizzata occupa solo la chiave editorial_builder_v1 del campo esistente kdp_sections.settings, preservando le altre chiavi:

```json
{
  "editorial_builder_v1": {
    "version": 1,
    "revision": 0,
    "subsections": [{
      "semantic_id": "ID originale della sottosezione",
      "kind": "heading",
      "heading_block_id": "UUID reale del blocco titolo",
      "order": 0
    }]
  }
}
```

original_number è opzionale e viene copiato solo quando esiste un campo numero esplicito nel progetto normalizzato. La mappa non contiene titolo o corpo. revision protegge dalle operazioni concorrenti. Le nuove identità Builder hanno prefisso builder: e UUID stabile.

## Bootstrap

Il caricamento delle pagine non scrive dati. Senza mappa il libro editoriale mostra il comando esplicito **Prepara struttura editoriale**. Una mappa invalida blocca l'editor senza classificazioni sostitutive.

La RPC serializza la struttura normalizzata nell'ordine persistito dall'import, senza richiamare il parser. Verifica integralmente numero, ordine, tipo, titolo e corpo dei blocchi. Il primo bootstrap verifica anche numero delle sezioni e associazioni sourceSectionId. Solo il confronto completo consente di associare i marker agli UUID.

Tutte le mappe vengono salvate in una transazione sotto lock. Un mismatch anche nell'ultima sezione annulla ogni scrittura. Le mappe esistenti valide vengono riutilizzate anche dopo rinomina e riordino: nessun confronto successivo del testo modificato con l'import originale. Il bootstrap ripetuto è idempotente. bootstrapEditorialMaps è il supporto in sola lettura per review e test; la RPC esegue autonomamente il confronto e non accetta mappe dal client.

## Gerarchia e manutenzione

Builder e anteprima condividono: sezione DB → marker UUID nella mappa → contenuti fino al marker successivo. I contenuti precedenti al primo marker costituiscono l'apertura. Ordine deterministico: sort_order, created_at, id.

La regola «titolo senza corpo = sottosezione» è rimossa. La funzione generica ammette come fallback solo un esplicito block_type=heading; i libri editoriali importati richiedono sempre la mappa e non usano questo fallback.

- Rinomina: cambia il titolo nel blocco, mantiene semantic_id e heading_block_id.
- Riordino/spostamento sottosezione: muove marker e contenuti nella stessa parte, aggiornando blocchi e ordine mappa atomicamente.
- Spostamento testo tra sottosezioni della stessa parte: applica direttamente il nuovo ordine completo.
- Eliminazione: SQL determina i confini, elimina tutto il gruppo e la sua entry e normalizza l'ordine nella stessa transazione.
- Aggiunta sottosezione: crea blocco e identità builder:<uuid> nella mappa insieme.
- Aggiunta parte: crea una sezione con mappa vuota valida.
- Introduzione: titolo NULL resta NULL; **Introduzione** è soltanto la label UI.

## RPC e migration locale

File: supabase/migrations/20260914122408_editorial_builder_atomic_v1.sql.

1. bootstrap_editorial_builder_v1(book_id).
2. apply_editorial_section_change_v1(book_id, section_id, expected_revision, expected_order, change): reorder, delete gruppo/testo, add sottosezione/testo e modifica titolo/corpo.
3. create_editorial_section_v1(book_id, title, section_type).

Helper: editorial_book_access_v1 ed editorial_section_map_v1. Tutte le funzioni sono SECURITY INVOKER, search path vuoto, auth esplicita e RLS esistente. Esecuzione negata a PUBLIC/anon e concessa ad authenticated. Lock in ordine libro → sezione → blocchi. Nessuna tabella, colonna, policy o backfill nuovo.

Il reorder richiede una permutazione completa degli UUID della sezione: ID esterni, mancanti o duplicati sono rifiutati. Ordine osservato e revisione devono coincidere con lo stato corrente. Un aggiornamento set based produce sort_order consecutivi/univoci. Mappa e blocchi condividono la transazione.

Errore SQL confermato: rollback completo. Revisione obsoleta: operazione rifiutata, refresh richiesto. Errore di rete dall'esito incerto: **Operazione non confermata**, con invito a ricaricare prima di riprovare. Non viene promesso erroneamente un rollback. Un retry con vecchia revisione non ripete un'operazione già riuscita. RPC assente: messaggio esplicito, nessun fallback con scritture sequenziali.

## Compatibilità e caricamento

Solo editorial_draft_v1, senza import strutturati o pagine importate, usa Editorial Builder. kdp_imported_pages ha precedenza: Builder → /pagine-importate e anteprima → /pagine-importate/anteprima. I legacy senza pagine conservano la UI precedente nei componenti legacy-builder e legacy-preview. Diario Allenamento 90 Giorni conserva 110 pagine e non riceve mappe.

listSectionBlocks usa range da 500 record, ordine deterministico e conteggio esatto. Continua dal numero effettivamente ricevuto anche con un limite API inferiore. Duplicati, conteggi variati e risposte incomplete producono errore invece di un libro troncato.

## Lazy rendering e accessibilità

EditorialDisclosure monta solo il contenuto aperto: parte chiusa → intestazione; parte aperta → sottosezioni; sottosezione aperta → testo; modifica aperta → modulo. Chiudere smonta i discendenti. Una cache in memoria conserva i campi non salvati durante chiusura/riapertura, senza DB. Un refresh completo perde le bozze non salvate.

Disclosure nativi utilizzabili con Invio e stato expanded/collapsed esposto all'accessibilità; focus visibile verificato. Controlli editoriali e link indice alti almeno 48 px. Titoli, testi e moduli vanno a capo; nessun overflow rilevato negli scenari a 320/390 px. Anteprima senza UUID visibili, numeri tecnici, paginazione o controlli PDF.

## Snapshot reale Ariete

Confronto in sola lettura: **1.167/1.167 blocchi, zero mismatch**. Mappa applicata solo alla copia in memoria per la review.

| Misura | Prima | Dopo |
|---|---:|---:|
| Sezioni | 15 | 15 |
| Capitoli / parti non numerate / introduzione | 8 / 6 / 1 | 8 / 6 / 1 |
| Sottosezioni | 89 | 53 |
| Manifestazione | 23 | 8 |
| Pietre Naturali | 21 | 3 |
| Codici Energetici | 5 | 2 |

Manifestazione contiene le otto sottosezioni da AMORE a SFIDE KARMICHE; Rito e Frasi di manifestazione sono interni. Pietre contiene PRIMA CHIAVE — CORNIOLA, SECONDA CHIAVE — LABRADORITE, TERZA CHIAVE — QUARZO FUMÉ; Potere sul corpo, Energia del chakra, Utilizzo ecc. restano nella chiave. Codici contiene Numeri e Colori; Energia da ricordare resta interna. Le sezioni finali restano separate.

Indice: 68 link (15 + 53), tutti con destinazione; nessun microtitolo. Navigazione a Corniola verificata nel browser.

Stesso scenario di render della pagina completa, tutte le parti chiuse:

| Misura | Prima | Dopo |
|---|---:|---:|
| HTML statico | 5.139.070 byte | 8.420 byte |
| Form | 5.579 | 1, logout |
| Elementi DOM | 65.361 | 126 |
| Details | 3.433 | 16 |
| Singolo render SSR locale, indicativo | ~661 ms | ~35 ms |

Queste misure non sono il trasferimento completo Next/RSC: i dati dei 1.167 blocchi vengono ancora caricati e passati al client. Non è introdotta virtualizzazione. Aprire Manifestazione monta otto intestazioni senza il testo dei gruppi; chiuderla riporta il DOM a 126 elementi. Nessun freeze evidente nelle interazioni provate. Anteprima continua: circa 147 KB HTML.

Review su componenti reali renderizzati/idratati localmente, snapshot production letto via SELECT, autenticazione simulata e azioni inerti. Non è un E2E autenticato production né un benchmark su telefono fisico. Le fixture versionate mantengono la struttura ma hanno paragrafi sintetici. Il testo reale resta negli artefatti locali ignorati.

## Test e riproducibilità

```text
git diff --check
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Suite: 179 test, di cui 10 gerarchia/bootstrap/paginazione/modalità, 19 RPC PostgreSQL locali, 5 UI/routing/errori e 145 preesistenti. PGlite riproduce le migration applicative con stub Auth/Storage. Errori iniettati durante UPDATE, DELETE e INSERT verificano veri rollback. Coperti anche RLS, mismatch, idempotenza, conflitti, mappe malformate, identità stabili e ordini univoci.

Esito finale: git diff --check, typecheck, lint e build superati (exit code 0); 179/179 test superati, zero fallimenti o skip. Lint senza warning. Build Next.js completata anche per tutte le route legacy.

Review visiva riproducibile con snapshot locale {sections, blocks, project}:

```text
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/review-editorial-snapshot.mjs PERCORSO_SNAPSHOT_JSON --serve
```

Server solo 127.0.0.1:3216, nessuna credenziale o connessione DB. Artefatti ignorati in node_modules/.cache/editorial-builder-review/.

## File interessati

- Gerarchia/dati: editorial-hierarchy.ts, editorial-book-mode.ts, editorial-repository.ts, complete-collection.ts, section-blocks.ts, src/types/database.ts.
- Builder: pagine contenuti/anteprima; editorial-builder, editorial-builder-forms, editorial-disclosure, editorial-actions, editorial-setup, editorial-preview; copie legacy-builder/legacy-preview; actions.ts, content-anchor-scroll.tsx e globals.css.
- SQL: la sola nuova migration locale indicata sopra.
- Test/supporto: fixture editoriali, test gerarchia/RPC, script editorial-test-runtime, review-editorial-snapshot, verify-editorial-builder-actions, verify-editorial-builder-ui, package.json/package-lock.json e questo documento.

## Limiti e confini

Aggiornamento rollout autorizzato: history riconciliata tramite CLI repair; applicata la sola migration 20260914122408; bootstrap Ariete completato con 15 mappe e 53 sottosezioni. Test rename e reorder production passati con ripristino nella stessa transazione. Diario intatto. La successiva verifica tramite sessione applicativa autenticata su https://kdp.manalicorporate.com ha rilevato ancora la UI precedente: 1.000 blocchi caricati, 6.079 form, 65.273 elementi DOM e 5.538.127 caratteri HTML nel contenitore principale. Introduzione mostrata come Senza titolo, anteprima tecnica senza link indice, nessuna gerarchia V1. Il Diario conserva l'accesso alle 110 pagine in 7 sezioni; il collegamento Editor blocchi apre ancora il flusso precedente. Queste sono misure della production prima del deploy dei fix, distinte dal render locale riportato sopra.

Il rilascio applicativo deve essere verificato sul commit pubblicato prima di ripetere i controlli runtime autenticati in sola lettura. Non occorre ripetere migration, repair o bootstrap; non sono autorizzate altre scritture sui libri. Report DB dettagliato in `supabase-migration-history-audit-2026-09-14.md`.

Il trasferimento di sottosezioni tra capitoli diversi non è esposto: le operazioni implementate lavorano nella stessa sezione. I comandi preesistenti per riordinare le sezioni del libro restano legacy; la garanzia atomica descritta riguarda blocchi e mappa tramite RPC. La paginazione HTTP non offre uno snapshot transazionale; rileva conteggi/ID incoerenti, mentre le mutazioni verificano lock, revisione e ordine osservato.

Parser KDP_EDITORIAL_DRAFT_V1 e KDP_DRAFT_V1, persistenza/importazione originali, normalized_project, testo definitivo, AI, immagini, copertina, PDF e Layout Engine invariati. La nuova persistenza è il metadato Builder autorizzato, ora attivato su Ariete tramite RPC production. Le modifiche temporanee dei test sono state ripristinate; revisioni e audit di modifica sono aggiornati dalle RPC. Nessun numero pagina o page break introdotto. La migration è inclusa nel rilascio per mantenere coerente il repository, non per rieseguirla in production.
