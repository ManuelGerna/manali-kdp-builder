"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { archiveBook, restoreBook } from "@/lib/kdp/books";
import { createOwnershipActor } from "@/lib/kdp/ownership";
import {
  createClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

function getString(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function getBooksPath(params: { error?: string; status?: string } = {}) {
  const searchParams = new URLSearchParams();

  if (params.error) {
    searchParams.set("error", params.error);
  }

  if (params.status) {
    searchParams.set("status", params.status);
  }

  const query = searchParams.toString();

  return `/libri${query ? `?${query}` : ""}`;
}

function revalidateBookViews(bookId: string) {
  revalidatePath("/libri");
  revalidatePath(`/libri/${bookId}`);
  revalidatePath(`/libri/${bookId}/contenuti`);
  revalidatePath(`/libri/${bookId}/importa`);
}

async function getAuthenticatedActor(actionName: string) {
  if (!hasSupabaseServerConfig()) {
    console.error("[kdp-books:archive-action]", {
      actionName,
      event: "missing_supabase_config",
    });

    return {
      actor: null,
      error:
        "Supabase non configurato. Completa le variabili del progetto KDP Builder.",
      supabase: null,
    };
  }

  const supabase = await createClient().catch((error: unknown) => {
    console.error("[kdp-books:archive-action]", {
      actionName,
      errorName: error instanceof Error ? error.name : typeof error,
      event: "create_supabase_client_failed",
    });

    return null;
  });

  if (!supabase) {
    return {
      actor: null,
      error: "Supabase non disponibile in questo momento.",
      supabase: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  return {
    actor: createOwnershipActor({
      email: user.email,
      userId: user.id,
    }),
    error: null,
    supabase,
  };
}

export async function archiveBookAction(formData: FormData) {
  const bookId = getString(formData, "book_id");

  if (!bookId) {
    redirect(getBooksPath({ error: "Libretto non valido." }));
  }

  const { supabase, actor, error } =
    await getAuthenticatedActor("archive-book");

  if (!supabase || !actor) {
    redirect(getBooksPath({ error: error ?? "Accesso non valido." }));
  }

  const result = await archiveBook(supabase, {
    actor,
    bookId,
  });

  if (result.data === null) {
    redirect(getBooksPath({ error: result.error }));
  }

  revalidateBookViews(bookId);
  redirect(getBooksPath({ status: "book_archived" }));
}

export async function restoreBookAction(formData: FormData) {
  const bookId = getString(formData, "book_id");

  if (!bookId) {
    redirect(getBooksPath({ error: "Libretto non valido." }));
  }

  const { supabase, actor, error } =
    await getAuthenticatedActor("restore-book");

  if (!supabase || !actor) {
    redirect(getBooksPath({ error: error ?? "Accesso non valido." }));
  }

  const result = await restoreBook(supabase, {
    actor,
    bookId,
  });

  if (result.data === null) {
    redirect(getBooksPath({ error: result.error }));
  }

  revalidateBookViews(bookId);
  redirect(getBooksPath({ status: "book_restored" }));
}
