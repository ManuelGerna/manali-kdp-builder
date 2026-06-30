import { NextResponse } from "next/server";
import { listAssets } from "@/lib/kdp/assets";
import { getBookDetail } from "@/lib/kdp/books";
import {
  generateTechnicalKdpPdf,
  getTechnicalPdfFileName,
} from "@/lib/kdp/pdf";
import { listSectionBlocks } from "@/lib/kdp/section-blocks";
import {
  buildPreExportValidation,
  getExportReadiness,
} from "@/lib/kdp/validation";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

type PdfExportRouteProps = {
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
  if (error instanceof Error) {
    return error.message.slice(0, 300);
  }

  return "unknown";
}

function logPdfExportError(
  stage: string,
  error: unknown,
  context: Record<string, string | undefined> = {},
) {
  console.error("[kdp-pdf-export]", {
    context,
    message: getErrorMessage(error),
    stage,
  });
}

export async function GET(_request: Request, { params }: PdfExportRouteProps) {
  const { id } = await params;

  if (!hasSupabaseServerConfig()) {
    return jsonError("Supabase non configurato.", 500);
  }

  const supabase = await createClient().catch((error) => {
    logPdfExportError("create_supabase_client", error, {
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
    return jsonError("Accesso richiesto per scaricare il PDF.", 401);
  }

  const detailResult = await getBookDetail(supabase, id);

  if (detailResult.data === null) {
    return jsonError(detailResult.error, detailResult.notFound ? 404 : 500);
  }

  const { book, sections, settings } = detailResult.data;

  if (book.created_by !== user.id) {
    return jsonError("Libretto non trovato o non accessibile.", 404);
  }

  if (!settings) {
    return jsonError(
      "Impostazioni KDP mancanti. Completa le impostazioni prima del PDF.",
      400,
    );
  }

  const [blocksResult, assetsResult] = await Promise.all([
    listSectionBlocks(supabase, book.id),
    listAssets(supabase, book.id),
  ]);

  if (blocksResult.data === null) {
    return jsonError(blocksResult.error, 500);
  }

  if (assetsResult.data === null) {
    return jsonError(assetsResult.error, 500);
  }

  const validationReport = buildPreExportValidation({
    assets: assetsResult.data,
    blocks: blocksResult.data,
    book,
    sections,
    settings,
  });
  const readiness = getExportReadiness(validationReport);

  if (readiness.status === "blocked") {
    return jsonError(
      "Export PDF bloccato. Risolvi gli elementi da sistemare nella validazione.",
      409,
    );
  }

  try {
    const pdfBytes = await generateTechnicalKdpPdf({
      assets: assetsResult.data,
      blocks: blocksResult.data,
      book,
      sections,
      settings,
    });
    const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(pdfBuffer).set(pdfBytes);
    const fileName = getTechnicalPdfFileName(book.title);

    return new Response(pdfBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBytes.length),
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    logPdfExportError("generate_pdf", error, {
      bookIdTail: idTail(book.id),
    });

    return jsonError("Non riesco a generare il PDF tecnico.", 500);
  }
}
