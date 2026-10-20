# Editorial Text Editor V1: introduzioni

Migration `20261020050144_editorial_opening_text_editor_v1.sql` applicata al
progetto production `sppsgnhnloumfdldosbe`. Nessun'altra migration applicata.
RPC e permessi verificati nei cataloghi; nessuna scrittura di prova sui testi.

Introduzione generale, aperture dei capitoli e sezioni speciali usano lo stesso
editor, bozza e azione batch delle sottosezioni, con un solo **Salva testo**.
Il gruppo comprende i blocchi prima del primo marker semantico, oppure tutti i
blocchi quando la sezione non ha sottosezioni. Le immagini restano nella sequenza
originale e non sono modificabili dal batch testo. UUID, confini dei blocchi,
contenuti letterali e terminatori di riga restano protetti come nella V1.

L'eventuale `kdp_sections.body` compare prima dei blocchi nello stesso editor;
è uno snapshot solo client con UUID della sezione, mai un nuovo blocco DB.
La RPC può aggiornare solo quel campo e solo nel batch introduttivo; non può
rinominare la sezione. Il form dei metadati omette il body, evitando invii di
copie obsolete e normalizzazioni involontarie. I form che inviano esplicitamente
il body mantengono il comportamento precedente.

La migration sostituisce esclusivamente il corpo della RPC pubblica esistente,
senza cambiare firma, tabelle, policy o dati. `subsection_id: null` seleziona il
prefisso introduttivo; i marker espliciti conservano i confini precedenti.
Restano autenticazione/RLS, lock, revisione, ordine completo, confronto dei testi
attesi, rollback dell'intero batch e delega invariata alle funzioni immagini.
Un batch vuoto o identico non esegue UPDATE, inclusi metadati libro/sezione.

Cache e sessionStorage usano un gruppo `opening` separato dalle sottosezioni.
Le bozze persistono su conflitto, risposta incerta e riapertura; nessun rebase
automatico. Gli strumenti interni di organizzazione e upload sono disabilitati
durante modifiche o conflitti.

Verifica tramite fixture sintetiche locali e PGlite sulle migration reali:
introduzioni di tutti e tre i tipi, section body, no-op con trigger sentinella,
confini, rollback, revisioni/ordine obsoleti, RLS, immagini e riordino.
Nessun test scrive su production. Parser, PDF, copertina e flusso dei libri
strutturati non sono modificati. Il rilascio segue l'applicazione della migration
approvata e il superamento di tutti i controlli locali.

Controlli locali completati: diff-check, typecheck, lint, **234 test superati**
(14 nuovi) e build production riuscita.
