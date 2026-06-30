"use client";

import { useFormStatus } from "react-dom";
import {
  archiveBookAction,
  restoreBookAction,
} from "@/app/libri/actions";

function ArchiveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="secondary-button archive-button"
      disabled={pending}
      type="submit"
    >
      {pending ? "Archiviazione..." : "Archivia"}
    </button>
  );
}

function RestoreButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button restore-button" disabled={pending} type="submit">
      {pending ? "Ripristino..." : "Ripristina"}
    </button>
  );
}

export function ArchiveBookForm({
  bookId,
  title,
}: {
  bookId: string;
  title: string;
}) {
  return (
    <form
      action={archiveBookAction}
      className="inline-form"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Archiviare "${title}"? Il libretto restera' nel database e potrai ripristinarlo dalla vista Archiviati.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="book_id" type="hidden" value={bookId} />
      <ArchiveButton />
    </form>
  );
}

export function RestoreBookForm({ bookId }: { bookId: string }) {
  return (
    <form action={restoreBookAction} className="inline-form">
      <input name="book_id" type="hidden" value={bookId} />
      <RestoreButton />
    </form>
  );
}
