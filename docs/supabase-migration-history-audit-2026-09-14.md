# Audit migration history Supabase — 14 settembre 2026

Progetto: **manali-kdp-builder**, ref **sppsgnhnloumfdldosbe**, eu-central-1, PostgreSQL 17.6. Endpoint coerente con la configurazione locale. Audit remoto esclusivamente con SELECT su cataloghi e dati aggregati; nessuna migration storica eseguita, nessuno schema applicativo modificato.

## Criterio

APPLIED_CONFIRMED significa che gli effetti attesi sono presenti nello stato attuale, comprese le sostituzioni dichiarate nelle migration successive. Non è una prova della data storica di esecuzione: la history iniziale è assente. Sono stati letti tutti gli 11 file SQL. Confrontati 128 colonne (tipo, nullability, default), 18 indici espliciti, PK/FK/unique/check, 35 policy finali (ruoli, comando, USING/WITH CHECK), 7 trigger, 4 corpi/firme/modelli di sicurezza di funzione, grant e bucket. Zero differenze riscontrate negli effetti previsti. Nessun dato rimasto da normalizzare nei backfill ownership/archivio/visibility verificati. Nessun DML di audit.

## Esito per migration

| Migration | Esito | Evidenza |
|---|---|---|
| 20260629000000_initial_schema.sql | APPLIED_CONFIRMED | 4 tabelle iniziali; colonne/default/PK/FK/check; 5 indici; set_updated_at; 3 trigger; RLS. Check e policy sostituiti dalle migration successive verificati nella versione finale. |
| 20260629020000_grant_kdp_crud_to_authenticated.sql | APPLIED_CONFIRMED | USAGE public e tutti i grant SELECT/INSERT/DELETE richiesti ad authenticated presenti. |
| 20260630010000_enable_kdp_sections_crud_v1.sql | APPLIED_CONFIRMED | CRUD authenticated sulle sezioni e tutti i 15 section_type ammessi dal constraint. |
| 20260630020000_content_builder_v2_foundation.sql | APPLIED_CONFIRMED | 6 colonne sezione; assets e section_blocks; check/default/relazioni; 2 indici; 2 trigger; RLS e grant. Policy finali aggiornate dalla migration visibility. |
| 20260630030000_enable_kdp_book_settings_edit_v1.sql | APPLIED_CONFIRMED | UPDATE settings e tutti i check finali su formato, bleed, colori, font, corpo, interlinea e margini. |
| 20260630040000_add_kdp_content_ownership_v1.sql | APPLIED_CONFIRMED | 16 colonne ownership e 4 indici. Nessun libro con created_by presente e campi ownership richiesti dal backfill ancora null. |
| 20260630050000_add_archive_and_import_v2.sql | APPLIED_CONFIRMED | 3 colonne archivio, indice, UPDATE books; import_runs e vincoli/indice/RLS/grant; RPC import verificata nella versione successiva visibility. Nessun archivio con archived_at nullo. |
| 20260701010000_add_kdp_assets_storage_v1.sql | APPLIED_CONFIRMED | Bucket privato kdp-assets: limite 10485760, MIME PNG/JPEG/WebP; 4 policy Storage nella versione finale visibility. |
| 20260702010000_add_generic_draft_import_persistence.sql | APPLIED_CONFIRMED | book_type esteso; 7 colonne import_runs; imported_pages con colonne/default/PK/FK/unique/check, 4 indici, trigger/RLS/grant. import_kind successivamente esteso da 20260716010000. |
| 20260711010000_add_kdp_book_visibility_v1.sql | APPLIED_CONFIRMED | visibility/default/check/indice; keep_kdp_book_creator e trigger; helper visibilità STABLE SECURITY DEFINER; 35 policy; RPC import aggiornata; corpi funzioni, firme, search_path e ACL conformi. |
| 20260716010000_add_editorial_draft_import_kind.sql | APPLIED_CONFIRMED | Constraint import_kind valido e validato con legacy_structured_draft, generic_draft_v0, editorial_draft_v1. |

## Impronte dei file SQL letti

- 20260629000000_initial_schema.sql: `169DC430073F40A26A0C93F7721EFAE8910C8869BF4A215E15987060A27D0316`
- 20260629020000_grant_kdp_crud_to_authenticated.sql: `CFFB7F06614E9EE3BE3ABD03C5800DD8A87E1542DF7E361AD50A4557B1EA8633`
- 20260630010000_enable_kdp_sections_crud_v1.sql: `67A528394DEB45A7DD84B36BD212F42B68BA9C90A4E571B9739FAC372A28FC1E`
- 20260630020000_content_builder_v2_foundation.sql: `10C4B91E4320FAFF6611FD8C69E2F370A99141F6466FFA56D8D42AD086CD8A3C`
- 20260630030000_enable_kdp_book_settings_edit_v1.sql: `4A697437CF0CB352595A84ED6A2796C50CB088BDA9E88DF09C8767BA07E1C2D5`
- 20260630040000_add_kdp_content_ownership_v1.sql: `50E828565D4244A86C47C2E98C6E4230ABC9420C87A19F0527F3BA95C9B62BE3`
- 20260630050000_add_archive_and_import_v2.sql: `ECD94D690A0290AE24E35D0752E2990AB3DCB4C0C4E7D11F5DD3F9D5A8E6620B`
- 20260701010000_add_kdp_assets_storage_v1.sql: `77C0F2C1B84FEFD935E16FAAE05D77C55AAC2F7E8A00BC5C9B02F809D3D96CC7`
- 20260702010000_add_generic_draft_import_persistence.sql: `B0C0F6E04F724DBE89C56C70DE272BC9F3A57DF922D25CA4A65F8023182338CA`
- 20260711010000_add_kdp_book_visibility_v1.sql: `36A83B5712171F4B42529D5D75045EEEA055BE43AE882D2C6635C75D50DDB6BD`
- 20260716010000_add_editorial_draft_import_kind.sql: `645362898BA740E7003AD8DA21E9AAD905144409FE488FCC90A51B1C1DB83EB0`

## Preflight dati

Ariete: 15 sezioni, 1.167 blocchi, 0 mappe. Diario Allenamento: 7 sezioni, 110 pagine, 0 mappe. History assente; nuove RPC Editorial Builder assenti. Salvate impronte delle righe books/sections/blocks/import_runs/imported_pages per verificare che il repair modifichi soltanto la history.

Le evidenze complete in sola lettura sono conservate localmente in node_modules/.cache/editorial-builder-review/history-audit-evidence.json. Non contengono credenziali né testo del manoscritto.

## Riconciliazione

Le 11 migration soddisfano il requisito APPLIED_CONFIRMED. Eseguito il comando ufficiale `npx.cmd supabase migration repair --project-ref sppsgnhnloumfdldosbe --status applied` con le sole 11 versioni storiche. Esito positivo, repairAll=false. Il loro SQL NON è stato rieseguito.

La successiva migration list ha restituito esattamente 11 versioni storiche allineate local/remote e la sola 20260914122408 pendente. Il confronto dei cataloghi prima/dopo repair è identico per tabelle, colonne, constraint, indici, policy, funzioni, trigger e grant. Anche tutte le impronte dei dati salvate nel preflight sono identiche.

## Applicazione Editorial Builder

Il dry run di db push ha proposto esclusivamente 20260914122408_editorial_builder_atomic_v1.sql, senza seed o ruoli aggiuntivi. Applicata la sola migration con `--project-ref sppsgnhnloumfdldosbe --skip-vault --yes`. SHA256 del file invariato: `587D61009B9C14BC67CB1D5692D32D84666D293988EE6BD5888892927E253ED9`.

History finale: **12 migration applied, zero pendenti**. Il primo tentativo CLI di applicazione si è fermato nel download npm, prima dell'avvio di Supabase; l'esecuzione con accesso di rete autorizzato è poi riuscita. Nessuna applicazione duplicata.

Verificate le tre RPC bootstrap_editorial_builder_v1, apply_editorial_section_change_v1, create_editorial_section_v1 e i due helper editorial_book_access_v1/editorial_section_map_v1. Corpi e firme corrispondono al file locale. Tutte SECURITY INVOKER, search_path vuoto, EXECUTE ad authenticated, nessun EXECUTE effettivo ad anon/PUBLIC. Nessuna modifica alle policy applicative preesistenti. Dopo la migration, impronte dei dati ancora identiche e zero mappe: nessun bootstrap automatico.

## Bootstrap e test production

Confronto preventivo: 15 sezioni sorgente associate, 1 import run editoriale, **1.167/1.167 blocchi corrispondenti**, zero mismatch, zero mappe preesistenti. Eseguito bootstrap del solo Ariete: initialized=15.

Le chiamate sono state effettuate via connessione amministrativa, con ruolo locale authenticated e contesto del proprietario del libro, in transazioni esplicite. Non sono stati creati account, token o sessioni applicative. Le RPC hanno quindi operato con i grant e le policy del ruolo authenticated.

Risultato: **15 sezioni, 53 sottosezioni; Manifestazione 8, Pietre 3, Codici 2**. Nessuna delle sette etichette minori indicate è diventata marker. Tutti i campi obbligatori sono presenti; original_number copiato per tutte le 8 sottosezioni che lo possiedono nel normalized_project. Zero modifiche alle altre chiavi di settings. Il titolo NULL dell'introduzione resta NULL.

Rename: CONSIGLIO nella sezione 2. RELAZIONI, identità e UUID invariati, titolo ripristinato. Reorder: scambio delle prime due chiavi in PIETRE NATURALI e ripristino, 126 blocchi e 126 sort_order distinti e consecutivi, mappa sincronizzata. Ogni test ha verificato lo stato intermedio ed eseguito il ripristino nella stessa transazione, evitando di rendere visibile agli altri utenti uno stato temporaneo. Le revisioni delle due sezioni sono passate da 0 a 2; timestamp/audit di modifica aggiornati dalle RPC come previsto. Nessun delete.

Il primo script rename aveva un nome di variabile ambiguo in una SELECT prima della chiamata di modifica: è stato annullato. Prima di correggere solo lo script, una rilettura ha confermato revisione 0 e hash dei blocchi invariato. Il test corretto è passato; nessuna RPC di modifica è fallita e nessun retry cieco è stato eseguito.

Confronto finale dopo entrambi i ripristini: **1.167/1.167 corrispondenze, zero mismatch**, zero titoli temporanei, zero ordinamenti duplicati. Import run/normalized_project e pagine importate hanno le impronte originali. Diario Allenamento mantiene **7 sezioni, 110 pagine, 0 mappe**.

## Verifica applicativa e limite residuo

Un nuovo snapshot letto da production è stato renderizzato con i componenti reali in locale: Builder e anteprima hanno entrambi 53 sottosezioni. Builder chiuso: 8.420 byte HTML statico, 1 form (logout), 16 details, circa 32 ms per il singolo render locale. Anteprima: 147.080 byte. Non sono misure di una sessione web production autenticata.

La verifica del repository reale via Data API con la chiave backend esistente è stata bloccata da `42501 permission denied for table kdp_sections`: service_role non ha SELECT sulle tabelle KDP. Nessun grant è stato aggiunto o modificato. Il controllo con sessione applicativa authenticated resta da completare; è stato richiesto l'URL dell'istanza KDP. Non è corretto dichiarare verificato `.range()` in un runtime production autenticato sulla sola base delle SELECT SQL o delle fixture.

Il conteggio e la lettura SQL completi di 1.167 blocchi sono PASS, come i test locali di paginazione oltre 1.000 record e di separazione editorial/structured. Mancano la prova Data API/app autenticata e la navigazione dell'istanza effettivamente usata dall'utente.

## Repository ed esito

`git diff --check`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`: PASS. **179/179 test**, zero fallimenti o skip; lint senza warning. Nessuna modifica a parser, importazione o contenuti definitivi. Nessuna migration locale modificata.

Esito alla conclusione dell'audit DB: **STOP_AND_FIX**, in attesa della verifica applicativa autenticata. Riconciliazione e attivazione DB riuscite; nessun commit, push, deploy frontend o modifica di grant aggiuntiva eseguito durante l'audit. Non occorre rieseguire repair, migration o bootstrap.

## Verifica autenticata prima del deploy applicativo

La normale sessione utente su https://kdp.manalicorporate.com ha poi confermato che la production serviva ancora la UI tecnica precedente. Ariete: 15 sezioni ma soltanto 1.000 UUID di blocco nel DOM; 6.079 form, 65.273 elementi DOM, 5.538.127 caratteri HTML del contenitore principale. La gerarchia Editorial Builder V1 non era attiva, l'introduzione appariva come Senza titolo e l'anteprima mostrava 1.000 blocchi numerati senza link di navigazione nell'indice. PRIMA DI SALUTARCI… non aveva blocchi caricati.

Diario Allenamento: accessibili tutte le 110 pagine importate in 7 sezioni, senza Editorial Builder; Editor blocchi apriva ancora il vecchio percorso con zero blocchi. Nessuna scrittura sui libri durante questi controlli, nessuna sessione service role e nessuna modifica ai grant.

Il database è approvato. Il successivo rilascio autorizzato riguarda esclusivamente il codice applicativo tramite main, seguito da verifica del deploy associato al commit e controlli runtime in sola lettura. La migration già applicata viene versionata senza rieseguirla. L'esito finale del deploy resta da verificare separatamente da questo audit storico.
