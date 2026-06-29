# 05 — AI Editor

## Obiettivo

Integrare un redattore AI che aiuta a correggere, migliorare e uniformare testi per libretti KDP senza trasformare la app in un generatore incontrollato.

## Principio

L'AI deve essere un assistente editoriale.

Priorità V1:

1. correggere testi scritti dall'utente;
2. migliorare tono e chiarezza;
3. ridurre rischi di claim medici;
4. generare campi KDP copiabili;
5. tracciare uso AI.

## Azioni AI V1

```text
correct
professionalize
simplify
premium_tone
shorten
expand
remove_medical_claims
generate_disclaimer
generate_kdp_description
generate_keywords
generate_crystal_card
```

## UI comportamento

Ogni azione AI deve mostrare:

```text
Input originale
Output proposto
Pulsante Applica
Pulsante Copia
Pulsante Scarta
```

Non sovrascrivere mai automaticamente un testo senza conferma.

## Tono editoriale cristalli

Tono desiderato:

- elegante;
- chiaro;
- semplice;
- premium;
- non troppo esoterico;
- non medico;
- adatto a principianti.

Evitare:

- promesse di guarigione;
- frasi assolute;
- superstizione spinta;
- linguaggio aggressivo;
- claim scientifici non supportati.

Preferire:

```text
Secondo la tradizione cristalloterapica...
È spesso associata a...
Può essere usata come supporto simbolico...
Nelle pratiche di journaling...
Durante una routine personale...
```

## Prompt base: correggi testo

```text
Sei un redattore editoriale per libretti Amazon KDP su cristalli, pietre e journaling.
Correggi grammatica, punteggiatura e chiarezza del testo seguente.
Mantieni il significato originale.
Non aggiungere promesse mediche.
Non inventare dati scientifici.
Restituisci solo il testo revisionato.

Testo:
{{input_text}}
```

## Prompt base: rendi più premium

```text
Sei un editor professionale per un libretto premium su cristalli e journaling.
Riscrivi il testo con tono elegante, chiaro e curato.
Mantieni uno stile accessibile per principianti.
Evita promesse mediche o affermazioni assolute.
Usa formule come "secondo la tradizione", "è spesso associata a", "può essere usata come supporto simbolico".
Restituisci solo il testo revisionato.

Testo:
{{input_text}}
```

## Prompt base: rimuovi promesse mediche

```text
Analizza il testo seguente e riscrivilo eliminando promesse mediche, claim di guarigione o affermazioni rischiose.
Mantieni un tono editoriale adatto a un libretto su cristalli e journaling.
Trasforma eventuali claim in formule simboliche, tradizionali o meditative.
Restituisci solo il testo revisionato.

Testo:
{{input_text}}
```

## Prompt base: genera disclaimer

```text
Genera un disclaimer breve e professionale per un libretto Amazon KDP su cristalli, pietre e journaling.
Il disclaimer deve chiarire che il contenuto ha finalità informative, simboliche e di benessere personale.
Non deve sostituire consulenza medica, psicologica, legale o professionale.
Tono: semplice, elegante, rassicurante.
Lingua: {{language}}.
```

## Prompt base: genera descrizione KDP

```text
Sei un copywriter editoriale per Amazon KDP.
Genera una descrizione libro professionale e persuasiva basata sui dati seguenti.

Titolo: {{title}}
Sottotitolo: {{subtitle}}
Tipo libro: {{book_type}}
Tema: cristalli, pietre, journaling, pratiche simboliche
Pubblico: principianti e persone interessate a spiritualità leggera, self-care e journaling

Regole:
- non usare promesse mediche;
- non promettere risultati garantiti;
- tono chiaro, premium, non esagerato;
- includi benefici editoriali concreti: guida, schede, affermazioni, pagine journaling;
- restituisci una versione plain text e una versione HTML semplice compatibile con descrizione KDP.
```

## Prompt base: genera keyword KDP

```text
Genera 7 keyword per Amazon KDP per il seguente libro.

Titolo: {{title}}
Sottotitolo: {{subtitle}}
Lingua: {{language}}
Tema: cristalli, pietre, journaling, guida per principianti

Regole:
- keyword naturali;
- evitare keyword ingannevoli;
- evitare nomi brand o autori famosi;
- evitare promesse mediche;
- ogni keyword deve essere una frase breve;
- restituisci esattamente 7 keyword numerate.
```

## Tracciamento uso AI

Ogni revisione va salvata in `kdp_ai_revisions`.

Campi minimi:

- book_id;
- target_type;
- target_id;
- action_type;
- input_text;
- output_text;
- model;
- status;
- created_at.

## AI usage type

La app deve permettere di segnare:

```text
none
ai_assisted
ai_generated
mixed
```

Regole operative:

- se AI corregge testo umano: `ai_assisted`;
- se AI genera schede, descrizioni o capitoli da zero: `ai_generated` o `mixed`;
- mostrare avviso finale nella pagina dati KDP.
