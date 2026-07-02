import type { CSSProperties } from "react";
import type {
  ImportedPrintBlock,
  ImportedPrintDocumentSettings,
  ImportedPrintPage,
  ImportedPrintRenderModel,
  ImportedPrintWarning,
} from "@/lib/kdp/imported-page-print-renderer";
import type { ImportedPreviewTable } from "@/lib/kdp/imported-page-preview";

type PrintStyle = CSSProperties & Record<`--${string}`, string>;

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getPageStyle(
  settings: ImportedPrintDocumentSettings,
  pageNumber: number,
): PrintStyle {
  const { margins, pageSize } = settings;
  const leftMargin =
    pageNumber % 2 === 1 ? margins.insideIn : margins.outsideIn;
  const rightMargin =
    pageNumber % 2 === 1 ? margins.outsideIn : margins.insideIn;

  return {
    "--print-margin-bottom": `${(margins.bottomIn / pageSize.heightIn) * 100}%`,
    "--print-margin-left": `${(leftMargin / pageSize.widthIn) * 100}%`,
    "--print-margin-right": `${(rightMargin / pageSize.widthIn) * 100}%`,
    "--print-margin-top": `${(margins.topIn / pageSize.heightIn) * 100}%`,
    "--print-page-aspect-ratio": `${pageSize.widthIn} / ${pageSize.heightIn}`,
  };
}

function WarningList({ warnings }: { warnings: ImportedPrintWarning[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <ul className="imported-print-warning-list">
      {warnings.map((warning, index) => (
        <li key={`${warning.code}-${warning.pageNumber ?? "doc"}-${index}`}>
          <strong>{warning.code}</strong>
          <span>{warning.message}</span>
        </li>
      ))}
    </ul>
  );
}

function ImportedPrintFields({ fields }: { fields: string[] }) {
  return (
    <div className="imported-print-fields">
      {fields.map((field) => (
        <div className="imported-print-field" key={field}>
          <span>{field}</span>
          <span aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

function ImportedPrintPrompts({ prompts }: { prompts: string[] }) {
  return (
    <div className="imported-print-prompts">
      {prompts.map((prompt) => (
        <div className="imported-print-note" key={prompt}>
          <p>{prompt}</p>
          <div className="imported-print-note-lines" aria-hidden="true">
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

function ImportedPrintTable({ table }: { table: ImportedPreviewTable }) {
  const columns =
    table.columns.length > 0
      ? table.columns
      : ["Spazio", "Contenuto", "Note"];
  const visibleRowCount = Math.min(Math.max(table.rowCount, table.rows.length), 18);
  const blankRowCount = Math.max(0, visibleRowCount - table.rows.length);
  const dense = table.layout === "compact";

  return (
    <table
      className={[
        "imported-print-table",
        dense ? "imported-print-table-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{formatLabel(column)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.slice(0, visibleRowCount).map((row, rowIndex) => (
          <tr key={`row-${rowIndex}`}>
            {columns.map((column, columnIndex) => (
              <td key={`${column}-${columnIndex}`}>
                {Array.isArray(row)
                  ? row[columnIndex] ?? ""
                  : typeof row === "string"
                    ? columnIndex === 0
                      ? row
                      : ""
                    : row[column] ?? row[formatLabel(column)] ?? ""}
              </td>
            ))}
          </tr>
        ))}
        {Array.from({ length: blankRowCount }, (_, index) => (
          <tr key={`blank-${index}`}>
            {columns.map((column, columnIndex) => (
              <td key={`${column}-${columnIndex}`}>&nbsp;</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ImportedPrintBlockView({ block }: { block: ImportedPrintBlock }) {
  if (block.type === "text") {
    return (
      <div className="imported-print-text">
        {block.text.map((text, index) => (
          <p key={`${index}-${text.slice(0, 24)}`}>{text}</p>
        ))}
      </div>
    );
  }

  if (block.type === "fields") {
    return <ImportedPrintFields fields={block.fields} />;
  }

  if (block.type === "prompts") {
    return <ImportedPrintPrompts prompts={block.prompts} />;
  }

  if (block.type === "list") {
    return (
      <ul className="imported-print-list">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "tables") {
    return (
      <div className="imported-print-table-list">
        {block.tables.map((table, index) => (
          <ImportedPrintTable
            key={`${index}-${table.title ?? table.columns.join("-")}`}
            table={table}
          />
        ))}
      </div>
    );
  }

  if (block.type === "fallback") {
    return (
      <dl className="imported-print-fallback">
        {block.entries.map((entry) => (
          <div key={entry.label}>
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <section className="imported-print-group">
      {block.title ? <h4>{block.title}</h4> : null}
      {block.subtitle ? <p>{block.subtitle}</p> : null}
      {block.blocks.map((childBlock, index) => (
        <ImportedPrintBlockView block={childBlock} key={index} />
      ))}
    </section>
  );
}

function ImportedPrintPreviewPage({
  page,
  settings,
}: {
  page: ImportedPrintPage;
  settings: ImportedPrintDocumentSettings;
}) {
  return (
    <article className="imported-print-page-frame">
      <div className="imported-print-page-meta">
        <span>Pagina {page.pageNumber}</span>
        <span>{page.templateId ?? "template generico"}</span>
      </div>
      <div
        className={[
          "imported-print-page-sheet",
          page.pageNumber === 1 ? "imported-print-page-title" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={getPageStyle(settings, page.pageNumber)}
      >
        <div className="imported-print-safe-area">
          <header className="imported-print-page-header">
            <h3>{page.title}</h3>
            {page.subtitle ? <p>{page.subtitle}</p> : null}
          </header>
          <div className="imported-print-page-content">
            {page.blocks.length === 0 ? (
              <p className="imported-print-empty">
                Contenuto stampabile non disponibile.
              </p>
            ) : (
              page.blocks.map((block, index) => (
                <ImportedPrintBlockView block={block} key={index} />
              ))
            )}
          </div>
        </div>
      </div>
      <WarningList warnings={page.warnings} />
    </article>
  );
}

export function ImportedPrintPreviewDocument({
  model,
}: {
  model: ImportedPrintRenderModel;
}) {
  return (
    <div className="imported-print-document">
      {model.pages.map((page) => (
        <ImportedPrintPreviewPage
          key={page.pageNumber}
          page={page}
          settings={model.settings}
        />
      ))}
    </div>
  );
}
