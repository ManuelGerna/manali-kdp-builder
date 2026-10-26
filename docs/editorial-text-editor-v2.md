# Editorial Text Editor V2 e Editorial Images V2

## Rilascio coordinato — 26 ottobre 2026

Applicati in quest'ordine al progetto production `sppsgnhnloumfdldosbe`, senza
backfill né conversioni automatiche:

| File locale | Versione registrata da Supabase MCP |
|---|---|
| `20261020064131_editorial_text_editor_v2_local.sql` | `20261026175727` |
| `20261026173537_editorial_images_v2_local.sql` | `20261026175734` |

Le versioni assegnate dal servizio differiscono dai timestamp dei file locali:
riconoscere queste migration anche per nome e non riapplicarle con un push CLI
basato soltanto sui timestamp locali. Le altre 15 migration restano invariate.

Verifica SELECT prima/dopo: libro, sezioni, blocchi, asset, import e mappa semantica
dell'Ariete hanno gli stessi hash. Confermati 15 sezioni, 53 sottosezioni,
1.167 blocchi e zero sezioni V2 in tutti i libri. Nessuna scrittura di prova.
Le RPC mantengono la firma esistente, `SECURITY INVOKER`, accesso autenticato
e nessun `EXECUTE` anonimo; i due trigger V2 risultano abilitati.

Le immagini sono blocchi autonomi: si inseriscono prima/dopo il testo e tra
sottosezioni senza nuovi marker semantici. Le operazioni sono atomiche e
preservano documenti, UUID e ledger di pulizia Storage. Il form supporta
PNG/JPG fino a 3 MB, anteprima locale, descrizione facoltativa, formato e allineamento.

La disponibilità dell'editor production resta vincolata a gruppi già convertiti
e alla allowlist esistente. Questo rilascio non attiva conversioni, nemmeno
il canary Ariete. Il renderer PDF non fa parte del commit.

Validazione del candidato esportato dallo stage, con renderer PDF originale:
diff-check, typecheck, lint, **266 test** e build production superati.

Le note che seguono documentano la preparazione storica precedente al rilascio.

Implementazione del 20 ottobre 2026. Nessuna attivazione, conversione o migration
su production. Nessun commit o push. Parser e flusso dei libri strutturati invariati.

## Editor e dati

Tiptap 3.32.0, dipendenze fissate nel lockfile. Un documento continuo per gruppo
introduttivo/sottosezione, segmentato in corrispondenza di immagini, heading
espliciti, note interne e interruzioni pagina. I confini dei vecchi blocchi
testuali non limitano selezione, cancellazione, riscrittura o annulla/ripristina.
Invio crea un paragrafo con margine CSS; Maiusc+Invio crea un hardBreak. Il wrap
visivo non modifica il documento. Nessun riconoscimento automatico di liste o
Markdown. Un solo Salva invia tutti i segmenti del gruppo.

`kdp_sections.settings.editorial_text_v2` contiene `{version: 2, groups: {...}}`.
Le chiavi sono `opening` oppure l'UUID del marker strutturale. Ogni gruppo conserva:

- snapshot completo e ordinato delle righe V1, con UUID e metadati;
- eventuale `kdp_sections.body` introduttivo e corpo del marker della sottosezione;
- sequenza deterministica di segmenti testuali e riferimenti ai blocchi distinti;
- documento JSON per segmento: paragrafi, testo, grassetto e hardBreak.

La conversione crea un paragrafo per campo testuale non nullo, compresi i campi
esplicitamente vuoti. Non separa ulteriormente le righe del campo in paragrafi:
ogni terminatore CRLF, LF o CR diventa un hardBreak con il terminatore originale
in `attrs.ending`. Conserva spazi, tab, Unicode, punteggiatura, elenchi e separatori.
Un gruppo senza campi testuali ha un documento vuoto, senza paragrafi aggiunti.
Titoli strutturali e immagini non entrano nel documento editabile.

`readEditorialSectionText` è il lettore condiviso da Builder, anteprima e dalla
proiezione per TXT/PDF (`buildBookPreview`). Ogni gruppo non convertito usa V1.
I gruppi convertiti sostituiscono le righe archiviate nel rendering; non vengono
concatenati al testo V1. Versioni sconosciute e snapshot discordanti bloccano la
lettura, evitando un fallback che nasconderebbe modifiche V2.

## Reversibilità e salvataggio

`restoreEditorialGroupV1` verifica il documento convertito e ricostruisce lo
snapshot V1 esatto, distinguendo anche null/stringa vuota e i terminatori misti.
Dopo modifiche editoriali rifiuta un ritorno automatico ai vecchi campi: prima
occorre conservare la versione V2, senza inventare una distribuzione dei nuovi
paragrafi sui vecchi UUID. L'archivio originale resta disponibile e immutato.

La RPC verifica accesso al libro editoriale, revisione, ordine completo, scope,
snapshot, schema JSON, UUID e sequenza delle immagini. Aggiorna soltanto le
impostazioni e la revisione in una transazione; nessuna scrittura a blocchi,
import originale o Storage. Un no-op non attiva V2 e non esegue UPDATE.
Trigger proteggono le sorgenti convertite dalle scritture legacy.

Bozze in memoria e sessionStorage, separate da V1, con snapshot di partenza.
Conflitti, risposte incerte e refresh conservano la bozza; nessun rebase
automatico. L'acknowledgement riguarda esclusivamente il documento inviato.
Il cambio di editabilità Tiptap non emette aggiornamenti, così non può
sovrascrivere una bozza mentre viene ripristinata.

## Limiti volontari della fase 1

L'editor/salvataggio V2 richiede `EDITORIAL_TEXT_V2_LOCAL=1`, ambiente diverso da
production e URL Supabase con hostname loopback. Il controllo avviene anche
nell'azione server, prima di creare un client. Non sono stati modificati `.env`
né aggiunti comandi di attivazione per libri reali.

Gli strumenti di organizzazione strutturale sono sospesi nell'editor V2 di
questa fase. Le RPC rifiutano operazioni strutturali nelle sezioni convertite;
i gruppi V1 non convertiti mantengono il loro salvataggio batch. Estendere
riordino e inserimenti immagine richiederà aggiornare atomicamente anche la
sequenza V2. Il renderer PDF tecnico conserva le sue convenzioni tipografiche;
il lettore e la proiezione V2 preservano il testo letterale.

## Migration solo locale

`supabase/migrations/20261020064131_editorial_text_editor_v2_local.sql`, generata
con CLI. Aggiunge validatore JSON, ramo RPC V2 e protezioni delle sorgenti.
Non crea tabelle/colonne, non modifica policy e non converte o attiva dati.
Verificata applicando le migration reali esclusivamente in PGlite locale.

## Verifica Ariete read-only

Snapshot production letto con SELECT il 20 ottobre 2026 alle 06:44:48 UTC,
con tutte le righe aggregate: nessun limite implicito di 1.000 blocchi.

| Controllo | Risultato |
|---|---:|
| Sezioni | 15 |
| Sottosezioni | 53 |
| Blocchi/UUID originali verificati | 1.167 |
| COME AMI DAVVERO | 34 blocchi |
| Campi testuali confrontati | 1.114 |
| Unità UTF-16 confrontate | 77.808 |
| Perdite / duplicazioni / mismatch | 0 / 0 / 0 |

Verificati roundtrip dello schema Tiptap, campi letterali, ricostruzione integrale
di ogni riga e metadato, ordine/gerarchia, proiezione export e immutabilità dello
snapshot. SHA-256 dello snapshot JSON:
`b380a8f961db14d39ed2acfd783413bdb34085f36c44f417033d97a5018ac10a`.
L'Ariete corrente non contiene immagini: i confini immagine sono verificati
con fixture sintetiche, RPC locali e browser reale.

Snapshot e report completi sono nella cache ignorata
`node_modules/.cache/editorial-text-v2/`, senza manoscritto versionato.
Riproduzione su uno snapshot locale, senza client DB né credenziali:

```powershell
npm.cmd run kdp:editorial-v2-simulate -- PERCORSO_SNAPSHOT_JSON PERCORSO_REPORT_JSON
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/review-editorial-text-v2.mjs
```

La fixture browser usa soltanto testo sintetico e azioni in memoria. Lo script
`scripts/test-editorial-text-v2-browser.mjs` usa Playwright tramite il pacchetto
disponibile nel runtime (`EDITORIAL_PLAYWRIGHT_PACKAGE`), contro il solo server
loopback 3217. Blocca richieste a origini esterne. Report e screenshot sono nella
stessa cache locale. Verificati 12 scenari, inclusi selezione multiparagrafo,
invii, grassetto, undo/redo, wrap, confine immagine, refresh, conflitto e Salva.

La verifica finale SELECT su production conferma 15/53/1.167, **zero sezioni V2
in tutti i libri** e migration V2 non applicata.

Controlli finali superati: **258 test**, typecheck, lint, build production e
diff-check; **12 scenari Chromium** senza errori JavaScript.

## Fase 2 — preflight preparato, rollout fermato

Al 21 ottobre 2026 il progetto confermato è `manali-kdp-builder`, ref
`sppsgnhnloumfdldosbe`, stato `ACTIVE_HEALTHY`. La history contiene le 15
migration V1 attese; V2 non è applicata. La revisione della sezione AMORE è 0.

Il codice locale ora consente l'editor production soltanto quando il gruppo è
già convertito nel DB **e** corrisponde alla allowlist esatta:

- libro `ca3de2df-6dfc-422a-bf4f-8d54fef09cdf`;
- sezione `65bda051-5149-4907-85e5-f6a1ee2c60cf`;
- COME AMI DAVVERO `63523ace-914f-40e5-97ee-d3a6127c2acc`.

L'azione server controlla sia la allowlist sia il formato letto dal DB; un
payload client non può attivare un gruppo V1. Il percorso locale delle fixture
rimane disponibile. Tutti gli altri gruppi production mantengono V1.

Snapshot recuperabili e piano di conversione non attivato sono conservati in
`backups/editorial-text-v2/preactivation/`, esclusi da Git:

- `aries-readonly-snapshot.json`: libro, 15 sezioni, 1.167 blocchi, asset e hash import;
- `come-ami-davvero-original-34.json`: 34 righe esatte, marker, sezione, ordine e metadati;
- `come-ami-davvero-v2-plan.json`: documento V2 verificato, revisione e ordine attesi;
- `rpc-v1-baseline.json`: definizioni delle quattro RPC lette da production;
- `preactivation-report.json`: esito della simulazione 34/34, zero perdite o duplicazioni.

SHA-256 canonico dei 34 blocchi originali:
`e2b6c8764ab74c429ed85e133155a0240c06bacd491f407fe5759e4833613093`.
Lettura snapshot: 21 ottobre 2026, 00:19:30 Europe/Rome.

`scripts/verify-editorial-text-v2-migration.mjs` riproduce V1 e V2 esclusivamente
in PGlite: i corpi delle quattro RPC coincidono con production; il corpo V1
rinominato resta identico; firma, security invoker e grant autenticati sono
preservati, senza EXECUTE anonimo. Nessuna scrittura remota di prova.

**STOP_AND_FIX prima di qualsiasi mutazione production:** l'accesso alla
sessione Chrome ha restituito `Computer Use app approval timed out`.
La verifica autenticata richiesta non è quindi eseguibile. Non sono stati
applicati migration, creati commit, eseguiti push/deploy o convertiti gruppi.
Per riprendere occorre autorizzare l'accesso al browser e ripetere il preflight
sui dati correnti; gli snapshot non vanno sovrascritti.

Controlli locali della fase 2 completati: **261 test**, typecheck, lint, build
production e diff-check superati. Il blocco riguarda esclusivamente la
verifica autenticata e il successivo rollout, non i controlli locali.
