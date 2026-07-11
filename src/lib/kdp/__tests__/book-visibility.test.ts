import assert from "node:assert/strict";
import test from "node:test";
import {
  getBookVisibilityBadge,
  getBookVisibilityFromFormData,
  getBookVisibilityPersistenceFields,
  isBookVisibleToUser,
  normalizeBookVisibility,
} from "../book-visibility.ts";

function formDataWithVisibility(value?: string) {
  const formData = new FormData();

  if (value !== undefined) {
    formData.set("visibility", value);
  }

  return formData;
}

test("manual book creation defaults visibility to private", () => {
  assert.equal(getBookVisibilityFromFormData(formDataWithVisibility()), "private");
  assert.deepEqual(getBookVisibilityPersistenceFields("private"), {
    visibility: "private",
  });
});

test("manual book creation persists public visibility", () => {
  assert.equal(
    getBookVisibilityFromFormData(formDataWithVisibility("public")),
    "public",
  );
  assert.deepEqual(getBookVisibilityPersistenceFields("public"), {
    visibility: "public",
  });
});

test("imported draft book creation uses the selected visibility", () => {
  assert.equal(
    getBookVisibilityFromFormData(formDataWithVisibility("public")),
    "public",
  );
  assert.equal(
    getBookVisibilityFromFormData(formDataWithVisibility("private")),
    "private",
  );
});

test("private books are visible only to their creator", () => {
  const books = [
    {
      created_by: "manuel",
      id: "private-manuel",
      visibility: "private",
    },
    {
      created_by: "alice",
      id: "private-alice",
      visibility: "private",
    },
  ];

  assert.deepEqual(
    books
      .filter((book) => isBookVisibleToUser(book, "manuel"))
      .map((book) => book.id),
    ["private-manuel"],
  );
});

test("public books are visible to the other authenticated user", () => {
  const publicBook = {
    created_by: "manuel",
    visibility: "public",
  };

  assert.equal(isBookVisibleToUser(publicBook, "alice"), true);
});

test("visibility badge labels match the UI copy", () => {
  assert.deepEqual(getBookVisibilityBadge("private"), {
    className: "visibility-badge visibility-private",
    label: "Privato",
    visibility: "private",
  });
  assert.deepEqual(getBookVisibilityBadge("public"), {
    className: "visibility-badge visibility-public",
    label: "Pubblico",
    visibility: "public",
  });
});

test("visibility updates persist private to public and back", () => {
  assert.deepEqual(getBookVisibilityPersistenceFields("public"), {
    visibility: "public",
  });
  assert.deepEqual(getBookVisibilityPersistenceFields("private"), {
    visibility: "private",
  });
});

test("books without a visibility value remain private-compatible", () => {
  const legacyBook = {
    created_by: "manuel",
  };

  assert.equal(normalizeBookVisibility(undefined), "private");
  assert.equal(isBookVisibleToUser(legacyBook, "manuel"), true);
  assert.equal(isBookVisibleToUser(legacyBook, "alice"), false);
});
