# 01 — Product Scope

## Obiettivo

Implementare un importer generico per KDP Builder capace di trasformare bozze testuali strutturate in progetti interni modificabili.

Il sistema deve supportare libretti diversi, purché descritti tramite sezioni, pagine, template e contenuti strutturati.

## In scope

Il parser/importer deve:

- accettare testo grezzo incollato dall’utente;
- riconoscere una versione della bozza;
- identificare i blocchi principali;
- estrarre specifiche tecniche;
- estrarre sistema visivo;
- estrarre piano sezioni;
- estrarre sequenza pagine;
- espandere intervalli pagina;
- associare ogni pagina a un `template_id`;
- separare interno, copertina e metadati;
- creare un modello dati normalizzato;
- generare un report importazione;
- segnalare warning e errori bloccanti;
- essere testabile con fixture generiche.

## Fuori scope per Parser V0

Non implementare in questa fase:

- PDF finale;
- generazione copertina;
- generazione immagini;
- keyword research;
- pubblicazione automatica su KDP;
- editor drag and drop avanzato;
- marketplace template;
- traduzioni automatiche;
- ottimizzazione commerciale del listing;
- logiche specifiche di un singolo tipo di libretto.

## Confini del parser

Il parser deve leggere e normalizzare. Non deve decidere il design finale.

La grafica viene applicata dal template registry e dal renderer. Il parser deve solo dire quale template usare e con quali dati.

## Principio di riutilizzabilità

Ogni decisione tecnica deve rispondere a questa domanda:

> Questa logica funzionerebbe anche per un altro tipo di libretto?

Se la risposta è no, quella logica non appartiene al parser base. Deve diventare un plugin, un template specifico o una regola di dominio separata.
