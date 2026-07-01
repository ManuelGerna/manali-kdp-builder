# Importer Quality Checklist

Usare questa checklist prima di considerare completato Parser V0.

## Input

- [ ] Il parser gestisce testo vuoto con errore chiaro.
- [ ] Il parser normalizza newline e spazi problematici.
- [ ] Il parser preserva il testo originale.
- [ ] Il parser rileva la versione bozza se presente.
- [ ] Il parser genera warning se la versione manca.

## Blocchi

- [ ] Il parser riconosce blocchi principali.
- [ ] Il parser non fallisce se un blocco opzionale manca.
- [ ] Il parser conserva dati non riconosciuti in `extras` o `rawBlocks`.
- [ ] Il parser separa interno, copertina e metadati.

## Pagine

- [ ] Il parser genera pagine singole.
- [ ] Il parser espande intervalli inclusivi.
- [ ] Il parser controlla coerenza tra intervallo e `ripeti`.
- [ ] Il parser gestisce rotazione contenuti.
- [ ] Il parser rileva pagine duplicate.
- [ ] Il parser rileva pagine mancanti se il target è noto.
- [ ] Ogni pagina ha uno stato.

## Template

- [ ] Ogni pagina conserva il proprio `templateId`.
- [ ] Il parser produce summary dei template richiesti.
- [ ] Template mancanti non bloccano tutto l’import.
- [ ] Le pagine con template mancante finiscono in `needs_review`.

## Sezioni

- [ ] Le sezioni vengono importate.
- [ ] Le pagine vengono assegnate alle sezioni quando possibile.
- [ ] I conteggi sezioni vengono validati.
- [ ] Le incoerenze sezione generano warning.

## Report

- [ ] Il report mostra stato finale.
- [ ] Il report include conteggi principali.
- [ ] Il report include warning.
- [ ] Il report include errori.
- [ ] Warning/errori hanno codici stabili.

## Test

- [ ] Esistono test unitari.
- [ ] Esistono test end-to-end con fixture generica.
- [ ] Esistono test per input malformato.
- [ ] Esistono test per intervalli.
- [ ] Esistono test per template mancanti.
- [ ] Esistono test per separazione interno/copertina/metadati.

## Confini

- [ ] Il parser non genera PDF.
- [ ] Il parser non genera copertina.
- [ ] Il parser non contiene logiche di nicchia.
- [ ] Il parser produce dati riutilizzabili da preview e renderer.
