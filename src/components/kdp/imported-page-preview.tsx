import type { ReactNode } from "react";
import {
  buildImportedPagePreviewModel,
  type ImportedPreviewBlock,
  type ImportedPreviewEntry,
  type ImportedPreviewTable,
} from "@/lib/kdp/imported-page-preview";
import type { Json } from "@/types/database";

type ImportedPagePreviewProps = {
  content: Json;
  pageNumber: number;
  sourceType: string | null;
  status: string;
  templateId: string | null;
  title: string | null;
};

function isRecord(value: unknown): value is Record<string, string> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getStatusChipClass(status: string) {
  if (status === "imported") {
    return "section-chip-success";
  }

  if (status === "invalid") {
    return "section-chip-error";
  }

  return "section-chip-warning";
}

function getDerivedColumns(table: ImportedPreviewTable) {
  if (table.columns.length > 0) {
    return table.columns;
  }

  const keys = new Set<string>();

  for (const row of table.rows) {
    if (Array.isArray(row)) {
      row.forEach((_, index) => keys.add(`Colonna ${index + 1}`));
      continue;
    }

    if (isRecord(row)) {
      Object.keys(row).forEach((key) => keys.add(key));
    }
  }

  return [...keys];
}

function getCellValue(
  row: ImportedPreviewTable["rows"][number],
  column: string,
  index: number,
) {
  if (Array.isArray(row)) {
    return row[index] ?? "";
  }

  if (isRecord(row)) {
    return row[column] ?? row[formatLabel(column)] ?? "";
  }

  return index === 0 ? row : "";
}

function renderTextList(items: string[], className?: string): ReactNode {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={className ?? "imported-page-preview-text"}>
      {items.map((item, index) => (
        <p key={`${index}-${item.slice(0, 24)}`}>{item}</p>
      ))}
    </div>
  );
}

function PreviewTable({ table }: { table: ImportedPreviewTable }) {
  const columns = getDerivedColumns(table);
  const fallbackColumns =
    columns.length > 0 ? columns : ["Spazio", "Contenuto", "Note"];
  const plannedRows =
    table.rowCount > 0 ? table.rowCount : Math.max(table.rows.length, 4);
  const visibleRowCount = Math.min(Math.max(plannedRows, table.rows.length), 14);
  const blankRowCount = Math.max(0, visibleRowCount - table.rows.length);
  const hiddenRowCount = Math.max(0, plannedRows - visibleRowCount);

  return (
    <div className="imported-page-preview-table-shell">
      {table.title ? <h5>{table.title}</h5> : null}
      <table className="imported-page-preview-table">
        <thead>
          <tr>
            {fallbackColumns.map((column) => (
              <th key={column}>{formatLabel(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.slice(0, visibleRowCount).map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {fallbackColumns.map((column, columnIndex) => (
                <td key={`${column}-${columnIndex}`}>
                  {getCellValue(row, column, columnIndex)}
                </td>
              ))}
            </tr>
          ))}
          {Array.from({ length: blankRowCount }, (_, index) => (
            <tr key={`blank-${index}`}>
              {fallbackColumns.map((column, columnIndex) => (
                <td key={`${column}-${columnIndex}`}>&nbsp;</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hiddenRowCount > 0 ? (
        <p className="imported-page-preview-footnote">
          Altre righe previste: {hiddenRowCount}
        </p>
      ) : null}
    </div>
  );
}

function PreviewFields({ fields }: { fields: string[] }) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="imported-page-preview-fields">
      {fields.map((field, index) => (
        <div className="imported-page-preview-field" key={`${index}-${field}`}>
          <span>{field}</span>
          <span className="imported-page-preview-field-box" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

function PreviewPrompts({ prompts }: { prompts: string[] }) {
  if (prompts.length === 0) {
    return null;
  }

  return (
    <div className="imported-page-preview-prompts">
      {prompts.map((prompt, index) => (
        <div className="imported-page-preview-note" key={`${index}-${prompt}`}>
          <p className="imported-page-preview-prompt">{prompt}</p>
          <div className="imported-page-preview-note-area" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewLists({ lists }: { lists: string[][] }) {
  if (lists.length === 0) {
    return null;
  }

  return (
    <div className="imported-page-preview-lists">
      {lists.map((list, index) => (
        <ul className="imported-page-preview-list" key={`list-${index}`}>
          {list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function PreviewTables({ tables }: { tables: ImportedPreviewTable[] }) {
  if (tables.length === 0) {
    return null;
  }

  return tables.map((table, index) => (
    <PreviewTable
      key={`${index}-${table.title ?? table.columns.join("-")}`}
      table={table}
    />
  ));
}

function PreviewTechnicalDetails({
  entries,
  sourceType,
  status,
  templateId,
}: {
  entries: ImportedPreviewEntry[];
  sourceType: string | null;
  status: string;
  templateId: string | null;
}) {
  const technicalEntries: ImportedPreviewEntry[] = [
    {
      label: "status",
      value: status,
    },
    ...(templateId
      ? [
          {
            label: "template id",
            value: templateId,
          },
        ]
      : []),
    ...(sourceType
      ? [
          {
            label: "source type",
            value: sourceType,
          },
        ]
      : []),
    ...entries,
  ];

  if (technicalEntries.length === 0) {
    return null;
  }

  return (
    <details className="imported-page-preview-technical">
      <summary>Dettagli tecnici</summary>
      <dl>
        {technicalEntries.map((entry, index) => (
          <div key={`${entry.label}-${index}`}>
            <dt>{formatLabel(entry.label)}</dt>
            <dd>
              {entry.label === "status" ? (
                <span className={`section-chip ${getStatusChipClass(status)}`}>
                  {formatLabel(entry.value)}
                </span>
              ) : (
                formatLabel(entry.value)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function PreviewBlock({
  block,
  depth = 0,
}: {
  block: ImportedPreviewBlock;
  depth?: number;
}) {
  return (
    <section className="imported-page-preview-block">
      {block.title || block.type ? (
        <div className="imported-page-preview-block-header">
          {block.title ? <h5>{block.title}</h5> : null}
          {block.type ? <span>{formatLabel(block.type)}</span> : null}
        </div>
      ) : null}
      {block.subtitle ? (
        <p className="imported-page-preview-subtitle">{block.subtitle}</p>
      ) : null}
      {renderTextList(block.text)}
      <PreviewFields fields={block.fields} />
      <PreviewLists lists={block.lists} />
      <PreviewPrompts prompts={block.prompts} />
      <PreviewTables tables={block.tables} />
      {depth < 2
        ? block.blocks.map((childBlock, index) => (
            <PreviewBlock
              block={childBlock}
              depth={depth + 1}
              key={`${index}-${childBlock.title ?? childBlock.type ?? "block"}`}
            />
          ))
        : null}
    </section>
  );
}

export function ImportedPagePreview({
  content,
  pageNumber,
  sourceType,
  status,
  templateId,
  title,
}: ImportedPagePreviewProps) {
  const model = buildImportedPagePreviewModel(content);
  const displayTitle = title || `Pagina ${pageNumber}`;

  return (
    <article
      className={[
        "imported-page-preview",
        pageNumber === 1 ? "imported-page-preview-title" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Anteprima pagina ${pageNumber}`}
    >
      <header className="imported-page-preview-header">
        <div>
          <p className="section-meta">Pagina {pageNumber}</p>
          <h3>{displayTitle}</h3>
          {model.subtitle ? (
            <p className="imported-page-preview-subtitle">{model.subtitle}</p>
          ) : null}
        </div>
      </header>

      <div className="imported-page-preview-body">
        {model.isEmpty ? (
          <p className="imported-page-preview-empty">
            Contenuto non disponibile per questa pagina.
          </p>
        ) : null}
        {renderTextList(model.text)}
        <PreviewFields fields={model.fields} />
        <PreviewLists lists={model.lists} />
        <PreviewPrompts prompts={model.prompts} />
        <PreviewTables tables={model.tables} />
        {model.blocks.map((block, index) => (
          <PreviewBlock
            block={block}
            key={`${index}-${block.title ?? block.type ?? "block"}`}
          />
        ))}
        {model.fallbackEntries.length > 0 ? (
          <dl className="imported-page-preview-fallback">
            {model.fallbackEntries.map((entry) => (
              <div key={entry.label}>
                <dt>{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <PreviewTechnicalDetails
        entries={model.technicalEntries}
        sourceType={sourceType}
        status={status}
        templateId={templateId}
      />
    </article>
  );
}
