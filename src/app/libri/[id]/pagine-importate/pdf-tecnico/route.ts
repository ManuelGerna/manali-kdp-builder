import { NextResponse } from "next/server";
import { getBookDetail } from "@/lib/kdp/books";
import {
  generateImportedPagesTechnicalPdf,
  getImportedPagesTechnicalPdfFileName,
} from "@/lib/kdp/imported-page-pdf";
import { buildImportedPrintRenderModel } from "@/lib/kdp/imported-page-print-renderer";
import { getImportedPagesReadModel } from "@/lib/kdp/imported-pages";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type ImportedPagesTechnicalPdfRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    },
  );
}

function idTail(value: string) {
  return value.slice(-8);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : "unknown";
}

function logImportedPdfError(
  stage: string,
  error: unknown,
  context: Record<string, string | undefined> = {},
) {
  console.error("[kdp-imported-pages-pdf]", {
    context,
    message: getErrorMessage(error),
    stage,
  });
}

export async function GET(
  _request: Request,
  { params }: ImportedPagesTechnicalPdfRouteProps,
) {
  const { id } = await params;

  if (!hasSupabaseServerConfig()) {
    return jsonError("Supabase non configurato.", 500);
  }

  const supabase = await createClient().catch((error) => {
    logImportedPdfError("create_supabase_client", error, {
      bookIdTail: idTail(id),
    });

    return null;
  });

  if (!supabase) {
    return jsonError("Supabase non disponibile.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Accesso richiesto per scaricare il PDF tecnico.", 401);
  }

  const detailResult = await getBookDetail(supabase, id);

  if (detailResult.data === null) {
    return jsonError(detailResult.error, detailResult.notFound ? 404 : 500);
  }

  const { book, sections, settings } = detailResult.data;

  if (book.created_by !== user.id) {
    return jsonError("Libretto non trovato o non accessibile.", 404);
  }

  const importedPagesResult = await getImportedPagesReadModel(supabase, {
    bookId: book.id,
    sections,
  });

  if (importedPagesResult.data === null) {
    return jsonError(importedPagesResult.error, 500);
  }

  if (importedPagesResult.data.pages.length === 0) {
    return jsonError(
      "Questo libretto non ha pagine importate da trasformare in PDF tecnico.",
      400,
    );
  }

  try {
    const renderModel = buildImportedPrintRenderModel({
      bookSettings: settings
        ? {
            trimSize: settings.trim_size,
          }
        : null,
      normalizedProject:
        importedPagesResult.data.importRun?.normalized_project ?? null,
      pages: importedPagesResult.data.pages.map((page) => ({
        content: page.content,
        pageNumber: page.page_number,
        sourceType: page.source_type,
        status: page.status,
        templateId: page.template_id,
        title: page.title,
      })),
    });
    const pdfBytes = await generateImportedPagesTechnicalPdf(renderModel, {
      title: book.title,
    });
    const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(pdfBuffer).set(pdfBytes);

    return new Response(pdfBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${getImportedPagesTechnicalPdfFileName(book.title)}"`,
        "Content-Length": String(pdfBytes.length),
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    logImportedPdfError("generate_imported_pages_pdf", error, {
      bookIdTail: idTail(book.id),
    });

    return jsonError("Non riesco a generare il PDF tecnico importato.", 500);
  }
}
