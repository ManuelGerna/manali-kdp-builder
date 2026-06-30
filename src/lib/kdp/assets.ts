import type { PostgrestError } from "@supabase/supabase-js";
import type { RepositoryResult } from "@/lib/kdp/books";
import type { AssetStatus, AssetType } from "@/lib/kdp/constants";
import type { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type KdpSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type KdpAsset = Tables<"kdp_assets">;

export type AssetInput = {
  bookId: string;
  assetType: AssetType;
  title: string | null;
  filePath?: string | null;
  altText: string | null;
  prompt: string | null;
  status: AssetStatus;
};

type LogContext = Record<string, boolean | number | string | null | undefined>;

function redactLogText(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[redacted-email]",
    )
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[redacted-uuid]",
    )
    .slice(0, 500);
}

function idTail(value: string) {
  return value.slice(-8);
}

function logAssetError(
  operation: string,
  error: PostgrestError | null,
  context: LogContext = {},
) {
  console.error("[kdp-assets]", {
    operation,
    code: error?.code ?? "unknown",
    message: redactLogText(error?.message),
    details: redactLogText(error?.details),
    hint: redactLogText(error?.hint),
    context,
  });
}

function getAssetPersistenceMessage(
  error: PostgrestError | null,
  fallback: string,
) {
  if (!error) {
    return fallback;
  }

  if (error.code === "42501") {
    return "Il database non consente questa operazione sugli asset. Verifica grant e policy Supabase.";
  }

  if (error.code === "23503") {
    return "Non riesco a collegare l'asset al libretto selezionato.";
  }

  if (error.code === "23514") {
    return "Il tipo o lo stato asset non e' accettato dal database.";
  }

  return fallback;
}

export async function listAssets(
  supabase: KdpSupabaseClient,
  bookId: string,
): Promise<RepositoryResult<KdpAsset[]>> {
  const { data, error } = await supabase
    .from("kdp_assets")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  if (error) {
    logAssetError("list_assets", error, {
      bookIdTail: idTail(bookId),
    });

    return {
      data: null,
      error: "Non riesco a caricare gli asset del libretto.",
    };
  }

  return {
    data: data ?? [],
    error: null,
  };
}

export async function createAsset(
  supabase: KdpSupabaseClient,
  input: AssetInput,
): Promise<RepositoryResult<{ assetId: string }>> {
  const { data, error } = await supabase
    .from("kdp_assets")
    .insert({
      book_id: input.bookId,
      asset_type: input.assetType,
      title: input.title,
      file_path: input.filePath ?? null,
      alt_text: input.altText,
      prompt: input.prompt,
      status: input.status,
    })
    .select("id")
    .single();

  if (error) {
    logAssetError("create_asset", error, {
      bookIdTail: idTail(input.bookId),
      assetType: input.assetType,
      status: input.status,
    });

    return {
      data: null,
      error: getAssetPersistenceMessage(
        error,
        "Non riesco a creare l'asset. Controlla i dati e riprova.",
      ),
    };
  }

  return {
    data: {
      assetId: data.id,
    },
    error: null,
  };
}

export async function deleteAsset(
  supabase: KdpSupabaseClient,
  bookId: string,
  assetId: string,
): Promise<RepositoryResult<{ assetId: string }>> {
  const { data, error } = await supabase
    .from("kdp_assets")
    .delete()
    .eq("book_id", bookId)
    .eq("id", assetId)
    .select("id")
    .maybeSingle();

  if (error) {
    logAssetError("delete_asset", error, {
      bookIdTail: idTail(bookId),
      assetIdTail: idTail(assetId),
    });

    return {
      data: null,
      error: getAssetPersistenceMessage(
        error,
        "Non riesco a eliminare l'asset. Riprova tra poco.",
      ),
    };
  }

  if (!data) {
    return {
      data: null,
      error: "Asset non trovato o non accessibile.",
    };
  }

  return {
    data: {
      assetId: data.id,
    },
    error: null,
  };
}
