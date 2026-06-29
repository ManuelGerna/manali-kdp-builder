# 08 — Codex Operating Rules

## Regola principale

KDP Builder è un progetto separato.

Non toccare Artingo.

Non toccare Freedom & Urus salvo esplicita richiesta.

## Separazione

Non usare:

- codice Artingo;
- domini Artingo;
- Supabase Artingo;
- storage Artingo;
- env Artingo;
- brand Artingo;
- copy Artingo;
- logiche business Artingo;
- billing Artingo.

## Dominio previsto

```text
kdp.manalicorporate.com
```

## Brand UI

```text
KDP Builder
```

## Scope V1

V1 deve creare:

- app privata;
- dashboard libri;
- impostazioni KDP base;
- editor contenuti;
- dati KDP copiabili;
- AI redattore in step dedicato;
- export PDF in step dedicato.

## Fuori scope finché non richiesto

Non implementare:

- upload automatico KDP;
- browser automation;
- scraping KDP;
- report vendite automatici;
- cover PDF;
- editor Canva-like;
- pagamenti;
- multi-tenant complesso;
- integrazione Artingo.

## Regole di sviluppo

- Mantieni scope piccolo.
- Prima analizza e mostra piano file.
- Non fare refactor non richiesti.
- Non introdurre dipendenze pesanti senza motivo.
- Non inserire segreti reali.
- Non stampare `.env.local`.
- Non usare `git add .`.
- Staging sempre per path espliciti.
- Commit piccoli e chiari.
- Test minimi ma reali.
- Se ci sono migration Supabase, prepararle ma applicazione manuale se non richiesto diversamente.
- Non fare commit su main senza autorizzazione.
- Non pushare senza richiesta esplicita.

## Naming

Repo consigliato:

```text
manali-kdp-builder
```

Tabelle DB prefisso:

```text
kdp_
```

Route:

```text
/libri
/libri/nuovo
/libri/[id]
/impostazioni
```

## Sicurezza

- login obbligatorio;
- RLS abilitata;
- nessun accesso anonimo ai dati;
- no indexing;
- storage privato per PDF;
- PDF scaricabili solo da utente autorizzato.

## UX

- mobile-first;
- semplice;
- operativa;
- niente editor libero;
- blocchi strutturati;
- bottoni copia per campi KDP;
- validazione chiara.

## AI

- AI come redattore, non come generatore incontrollato;
- salvare revisioni;
- non sovrascrivere testo senza conferma;
- evitare promesse mediche;
- tracciare uso AI.

## PDF

- V1: interior PDF 6x9 no-bleed;
- no cover;
- no bleed;
- no drag & drop;
- template controllato.
