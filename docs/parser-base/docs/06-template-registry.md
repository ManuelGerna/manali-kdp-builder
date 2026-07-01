# 06 — Template Registry

## Scopo

Definire il ruolo del template registry.

Il parser non deve disegnare pagine. Deve associare ogni pagina a un `template_id` e passare contenuti normalizzati al sistema di preview/rendering.

## Concetto

```text
page.templateId + page.content → template renderer → pagina visiva
```

Il template registry è una mappa dei layout disponibili.

## Esempio concettuale

```ts
export type TemplateDefinition = {
  id: string;
  name: string;
  version: string;
  category?: string;
  acceptedContentShape?: string;
  rendererKey?: string;
  previewComponentKey?: string;
  requiredFields?: string[];
  optionalFields?: string[];
};
```

## Responsabilità del parser

Il parser deve:

- leggere `template_id` dalla bozza;
- salvarlo in ogni pagina;
- contare utilizzo template;
- verificare se il template esiste, se il registry è disponibile;
- segnalare template mancanti;
- non fallire l’intero import per un template mancante, salvo configurazione diversa.

## Responsabilità del registry

Il registry deve:

- dichiarare i template disponibili;
- fornire metadati minimi;
- permettere alla preview di scegliere il componente corretto;
- permettere al renderer di scegliere il layout corretto;
- indicare campi richiesti e opzionali.

## Template mancante

Se il parser trova un template non registrato:

```text
page.status = "needs_review"
page.warnings += "Template not found"
```

Il progetto viene comunque creato, ma il report deve evidenziare la lista dei template mancanti.

## Versionamento template

In futuro si può supportare:

```text
template_id: "template_generico"
template_version: "1.0.0"
```

Parser V0 può ignorare la versione template, ma deve preservarla se presente.

## Template e contenuto

Il template decide come disegnare. Il contenuto decide cosa mostrare.

Esempio:

```text
content.fields = ["Campo 1", "Campo 2"]
```

Il parser non deve decidere se il campo diventa una riga, un box o una tabella. Questa è responsabilità del template.

## Regola anti-accoppiamento

Non scrivere codice tipo:

```text
if templateId == "template_specifico" then fai logica speciale nel parser
```

Le eccezioni devono essere gestite tramite adapter o normalizzatori dedicati, non dentro il parser base.
