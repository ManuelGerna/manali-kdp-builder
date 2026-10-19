# Editorial Text Editor V1

Un'unica superficie per sottosezione, con un solo form e pulsante **Salva
sottosezione**. I campi multilinea nativi, senza bordi e con altezza automatica,
mantengono separati gli UUID e i campi `title`/`body` originali. Titoletti in
grassetto, liste come testo letterale e immagini nella sequenza originale.
Non vengono introdotti HTML, Markdown, separatori testuali o nuovi blocchi.
Invio aggiunge un ritorno nel campo corrente; Backspace e incolla non attraversano
i confini fra campi o immagini. Il titolo principale della sottosezione e il
flusso di apertura del capitolo mantengono i comandi esistenti.

## Testo esatto e salvataggio

Nessun `trim`, join o split dei contenuti persistiti. I valori null e stringa
vuota restano distinti. La normalizzazione LF delle textarea viene compensata:
un campo non modificato o ripristinato mantiene esattamente l'originale, inclusi
CRLF/misti; prefisso e suffisso non modificati conservano gli stessi terminatori.
Le nuove righe usano la convenzione del campo. Un campo può essere svuotato senza
eliminare la riga DB. Il payload JSON evita conversioni dei ritorni da form.

Il client invia solo le differenze con UUID e valori attesi originali. Il server
rifiuta payload malformati e salta ogni accesso Supabase quando non c'è una
differenza. Nessun autosave o salvataggio su focus/blur.

Migration applicata al progetto production `sppsgnhnloumfdldosbe`:
`20261019190920_editorial_text_editor_v1.sql`.
Mantiene la firma pubblica della RPC e delega immagini/operazioni precedenti alla
funzione immagini rinominata. Il ramo `update_text_batch` verifica autenticazione,
libro editoriale, revisione, ordine completo, appartenenza alla sottosezione,
assenza di UUID duplicati e corrispondenza esatta dei valori attesi. Marker,
immagini, note e interruzioni pagina non sono modificabili dal batch.

Una sola transazione aggiorna esclusivamente le righe testo realmente cambiate
e incrementa la revisione una sola volta. Non riscrive sort_order, UUID, asset,
identità semantiche o import originale. Un no-op non esegue UPDATE, neppure sui
metadati del libro/sezione. Un errore annulla l'intero batch.

## Bozza e conflitti

Bozza separata dalla versione salvata, conservata nel provider e in
`sessionStorage`, con revisione e snapshot di partenza. Rimane disponibile dopo
chiusura/riapertura, refresh e conflitto; gli errori non fanno redirect e non
cancellano la bozza. Una risposta non confermata non viene considerata successo.
L'acknowledgement riguarda solo le modifiche inviate, preservando eventuali input
locali più recenti. Le revisioni discordanti non sono ribasate automaticamente.
L'utente può scaricare la bozza JSON, aggiornare la versione salvata o scartare
esplicitamente la bozza. Se il browser blocca sessionStorage, resta la copia in
memoria e viene mostrato un avviso con possibilità di download.

Riordino, aggiunta/eliminazione e strumenti immagine sono disponibili nel pannello
di organizzazione; vengono disabilitati finché la bozza è modificata, in invio o
in conflitto. Nessuna operazione Storage viene eseguita dal salvataggio testo.

## Verifica e limiti

Test mirati su contenuti letterali, LF/CRLF, null/vuoto, delta/no-op, bozza e
acknowledgement; rendering della superficie; azione server; migration e RPC reali
in PGlite con RLS, rollback, conflitti, immagini e riordino.
I test non accedono al database remoto. La migration è applicata a production;
RPC, permessi, RLS e compatibilità immagini verificati tramite cataloghi, senza
scritture di prova sui testi. Nessun'altra migration applicata.

Verifica completata: diff-check, typecheck, lint, **220 test** e build superati.
Prova browser con componenti reali e dati/azioni sintetici locali: conflitto,
chiusura/riapertura, cambio revisione e reload conservano la bozza; liste e
immagini restano nella sequenza originale, campi autoespandibili senza testo
tagliato, organizzazione disabilitata durante le modifiche. Non è un test
autenticato su production.

V1 è un editor di testo letterale con confini protetti: non è un editor rich text,
non fonde/divide blocchi e non riconcilia automaticamente conflitti. La bozza è
locale alla sessione del browser, non sincronizzata tra dispositivi. Parser,
testo importato, PDF, copertina e libri strutturati non sono modificati.
