# Editorial Builder: Image Upload V1

PNG/JPG esterni fino a 3 MiB. Il limite lascia spazio al multipart entro i 4 MB
già configurati per le Server Actions. Nessun generatore, trasformazione o crop.
Piccola/media/larghezza testo corrispondono al 33/66/100% della larghezza disponibile;
altezza automatica e allineamento sinistra/centro/destra.

Riutilizza `kdp_assets`, bucket privato `kdp-assets`, ownership, URL firmati,
`removeStoredKdpAssetFile`, `deleteAsset`, mappa semantica e pianificatori di ordine.
Il riordino include immagini e testo, senza attraversare i confini delle sottosezioni.
L'aggiunta avviene in fondo al gruppo scelto; i pulsanti su/giù permettono di
inserire l'immagine tra due blocchi di testo.

La migration **solo locale** `20261019000000_editorial_images_v1.sql` estende la RPC
esistente: il nucleo continua a validare revisione, ordine completo e mappa nella
stessa transazione delle modifiche immagine. Va applicata separatamente prima
dell'utilizzo in un ambiente distribuito. È stata applicata nel successivo rilascio
autorizzato riportato in fondo a questo documento.

Ogni percorso è registrato prima dell'upload. Sostituzione/eliminazione conservano
l'asset come registro di pulizia (`editorial-image-v1:garbage`) finché Storage non
conferma la rimozione. La pulizia controlla i riferimenti e viene ritentata nelle
azioni e alla successiva visita del Builder. Include eliminazioni di sottosezioni
e sezioni tramite trigger sui blocchi. Gli errori non cancellano il registro.
Gli upload `pending` sono elencati nel pannello **Upload da recuperare**: si può
inserire il file già caricato nel capitolo/sottosezione scelto, oppure scartarlo.
Il recupero scarica e valida il file prima di riusare lo stesso asset, senza un
secondo upload. Il controllo di revisione e la RPC valgono anche per lo scarto.
Alla visita/azione successiva, il collector ritira i `pending` più vecchi di un'ora
sotto lo stesso lock del libro usato dalla RPC. Non ritira gli asset attivi.
Un trigger impedisce nuovi riferimenti ad asset pending/ritirati, evitando che
un file venga ricollegato durante la pulizia. Un upload tardivo non può finalizzarsi
dopo lo scarto/scadenza e rimane rintracciabile per la pulizia successiva.

Una risposta Storage vuota non conferma la rimozione: il record e il percorso
vengono conservati come tombstone, anche se il file non è ancora arrivato. Questo
può lasciare record senza file, ma evita file senza registro. Non è previsto un
worker autonomo: retry e scadenza avvengono alle visite/azioni del Builder.
Inventario e coda di pulizia usano la paginazione completa con conteggio esatto:
le tombstone conservate non impediscono di raggiungere le pagine successive.

URL firmati validi un'ora: ricaricare la pagina per rinnovare l'anteprima.
Parser, import originale, flusso strutturato, anteprima editoriale/PDF e copertina
non sono modificati. Le immagini V1 sono visualizzate nel Builder.
Le immagini con `block_type=image` non sono ancora incluse nell'export PDF:
il caricamento file del renderer esistente seleziona soltanto `image_prompt`.

## Verifica compatibilità production (sola lettura, 19 ottobre 2026)

Verificati su `manali-kdp-builder`, Postgres 17: firma/ACL/security invoker delle
RPC, colonne e vincoli di assets/blocchi, bucket privato e policy Storage per
libri accessibili. I corpi delle tre funzioni prerequisito coincidono con la
migration locale `20260914122408_editorial_builder_atomic_v1.sql` (MD5 dopo
rimozione CR, senza alterare gli altri caratteri):

- `apply_editorial_section_change_v1`: `b07a67e70de6a9ba7219c5950b33a654`
- `editorial_book_access_v1`: `db0cc667f271d0c6196aaa4b5234e52c`
- `editorial_section_map_v1`: `914c4652cf20a2e67839555f506e1e4a`

Prima del rilascio la migration immagini era necessaria: la RPC production non
accettava ancora le operazioni immagini. Nessuna migration o modifica dati è
stata eseguita dalla sola verifica iniziale. La migration viene provata nella suite PGlite con schema/RLS
reali del repository e stub delle sole API della piattaforma.

## Rilascio autorizzato (19 ottobre 2026)

Applicata esclusivamente `20261019000000_editorial_images_v1.sql` al progetto
production `sppsgnhnloumfdldosbe`. Le dodici migration precedenti non sono state
rieseguite. Il timestamp assegnato dal connettore alla nuova voce di history è
stato allineato alla versione `20261019000000` del file, senza rieseguire SQL.

Verificati dopo l'applicazione: sette funzioni coinvolte con `SECURITY INVOKER`,
esecuzione concessa ad `authenticated` e negata ad `anon`, due nuovi trigger
attivi, nucleo RPC precedente invariato, RLS attiva, bucket privato e quattro
policy Storage invariati. Nessuna modifica a parser, testo, PDF o copertina.
Gli advisor non segnalano le nuove funzioni; restano avvisi preesistenti su
`set_updated_at`, `kdp_book_is_visible_to_authenticated` e la protezione password
compromesse disabilitata, fuori dall'ambito di questo rilascio.

Controlli prima del commit: `git diff --check`, `npm.cmd run typecheck`,
`npm.cmd run lint`, `npm.cmd test` (**202/202**) e `npm.cmd run build` superati.
Il commit include solo i path della funzionalità; `tmp/` e il manoscritto Ariete
restano esclusi.
