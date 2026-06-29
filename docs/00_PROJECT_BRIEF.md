# 00 — Project Brief

## Nome progetto

**KDP Builder**

## Contesto

KDP Builder è una web app privata di Manali Corporate per creare libretti da pubblicare su Amazon KDP.

Il primo caso d'uso è la creazione di libretti su:

- pietre;
- cristalli;
- journaling spirituale;
- affermazioni;
- mini guide tematiche.

## Obiettivo principale

Ridurre drasticamente il tempo di impaginazione e preparazione pubblicazione.

L'utente deve poter entrare nella app, compilare campi guidati, revisionare i testi con AI, esportare un PDF interno e copiare tutti i dati necessari per pubblicare manualmente su Amazon KDP.

## Dominio previsto

```text
kdp.manalicorporate.com
```

## Brand interno

```text
KDP Builder
```

## App privata

La app non deve essere pubblica.

Requisiti:

- login obbligatorio;
- nessuna pagina marketing pubblica nella V1;
- no indexing;
- accesso solo autorizzato;
- nessun dato pubblico non intenzionale.

## Separazione da Artingo

KDP Builder non deve avere nessun collegamento con Artingo.

Non usare:

- dominio Artingo;
- database Artingo;
- Supabase project Artingo;
- storage Artingo;
- codice Artingo;
- copy Artingo;
- brand Artingo;
- componenti business Artingo;
- logiche di billing Artingo.

## Relazione con Manali Corporate

KDP Builder è un progetto separato dentro Manali Corporate.

Freedom & Urus è un altro progetto separato dentro Manali Corporate.

Artingo resta un prodotto separato fuori da questa linea operativa.

## Visione V1

La V1 deve fare bene una cosa:

```text
Creo un libretto, compilo contenuti e impostazioni, uso AI come redattore, esporto il PDF interno e copio i dati KDP.
```

## Fuori scope V1

Non implementare nella V1:

- upload automatico su Amazon KDP;
- scraping o browser automation di KDP;
- report automatici vendite KDP;
- copertina completa paperback;
- editor drag & drop tipo Canva;
- marketplace template;
- multiutente avanzato;
- pagamenti;
- app pubblica.
