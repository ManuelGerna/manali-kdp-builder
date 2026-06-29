"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AI_USAGE_TYPES,
  LANGUAGE_OPTIONS,
  type AiUsageType,
} from "@/lib/kdp/constants";
import { createBookWithDefaultSettings } from "@/lib/kdp/books";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

export type CreateBookFormState = {
  message: string | null;
  fields?: {
    title?: string;
    subtitle?: string;
    author_name?: string;
    language?: string;
    ai_usage_type?: string;
  };
};

const SUPPORTED_LANGUAGES: readonly string[] = LANGUAGE_OPTIONS.map(
  (option) => option.value,
);

function logCreateBookAction(
  event: string,
  context: Record<string, boolean | number | string | null | undefined> = {},
) {
  console.error("[kdp-books:create-action]", {
    event,
    context,
  });
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isAiUsageType(value: string): value is AiUsageType {
  return AI_USAGE_TYPES.includes(value as AiUsageType);
}

export async function createBook(
  _previousState: CreateBookFormState,
  formData: FormData,
): Promise<CreateBookFormState> {
  const title = getString(formData, "title");
  const subtitle = getString(formData, "subtitle");
  const authorName = getString(formData, "author_name");
  const language = getString(formData, "language") || "it";
  const aiUsageType = getString(formData, "ai_usage_type") || "none";

  const fields = {
    title,
    subtitle,
    author_name: authorName,
    language,
    ai_usage_type: aiUsageType,
  };

  if (!title || !authorName) {
    return {
      message: "Titolo e autore sono obbligatori.",
      fields,
    };
  }

  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return {
      message: "Lingua non supportata per questo progetto.",
      fields,
    };
  }

  if (!isAiUsageType(aiUsageType)) {
    return {
      message: "Valore uso AI non valido.",
      fields,
    };
  }

  if (!hasSupabaseServerConfig()) {
    logCreateBookAction("missing_supabase_config");

    return {
      message:
        "Supabase non configurato. Completa le variabili del progetto KDP Builder prima di creare libretti.",
      fields,
    };
  }

  const supabase = await createClient().catch((error: unknown) => {
    logCreateBookAction("create_supabase_client_failed", {
      errorName: getErrorName(error),
    });

    return null;
  });

  if (!supabase) {
    return {
      message: "Supabase non disponibile in questo momento.",
      fields,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logCreateBookAction("auth_user_missing", {
      hasUser: Boolean(user),
      authErrorName: userError?.name,
      authErrorStatus: userError?.status,
    });

    redirect("/login");
  }

  const result = await createBookWithDefaultSettings(supabase, {
    title,
    subtitle: subtitle || null,
    authorName,
    language,
    aiUsageType,
    userId: user.id,
  });

  if (result.data === null) {
    return {
      message: result.error,
      fields,
    };
  }

  revalidatePath("/libri");
  redirect(`/libri/${result.data.bookId}`);
}
