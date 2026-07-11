import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupAssetAfterImageBlockDelete,
  persistUploadedAssetFile,
  type RemoveStoredFile,
} from "../storage-cleanup.ts";

function successfulRemove(calls: string[]): RemoveStoredFile {
  return async (filePath) => {
    calls.push(filePath);
    return {
      error: null,
    };
  };
}

test("replacement removes the previous stored file after a successful asset update", async () => {
  const removedPaths: string[] = [];
  const steps: string[] = [];

  const result = await persistUploadedAssetFile({
    previousFilePath: "alice-uid/book-id/asset-id/old.png",
    removeStoredFile: async (filePath) => {
      steps.push(`remove:${filePath}`);
      removedPaths.push(filePath);
      return { error: null };
    },
    uploadedFilePath: "manuel-uid/book-id/asset-id/new.png",
    updateAsset: async () => {
      steps.push("update");
      return {
        data: { assetId: "asset-id" },
        error: null,
      };
    },
  });

  assert.deepEqual(result, {
    data: { assetId: "asset-id" },
    error: null,
    warning: null,
  });
  assert.deepEqual(steps, ["update", "remove:alice-uid/book-id/asset-id/old.png"]);
  assert.deepEqual(removedPaths, ["alice-uid/book-id/asset-id/old.png"]);
});

test("replacement does not remove the previous file when the asset update fails", async () => {
  const removedPaths: string[] = [];

  const result = await persistUploadedAssetFile({
    previousFilePath: "alice-uid/book-id/asset-id/old.png",
    removeStoredFile: successfulRemove(removedPaths),
    uploadedFilePath: "manuel-uid/book-id/asset-id/new.png",
    updateAsset: async () => ({
      data: null,
      error: "db update failed",
    }),
  });

  assert.equal(result.data, null);
  assert.equal(result.error, "db update failed");
  assert.equal(result.warning, null);
  assert.deepEqual(removedPaths, ["manuel-uid/book-id/asset-id/new.png"]);
});

test("replacement reports a warning when the uploaded file cleanup fails after DB update failure", async () => {
  const result = await persistUploadedAssetFile({
    previousFilePath: "alice-uid/book-id/asset-id/old.png",
    removeStoredFile: async (filePath) => ({
      error: {
        message: `cannot remove ${filePath}`,
        name: "StorageError",
      },
    }),
    uploadedFilePath: "manuel-uid/book-id/asset-id/new.png",
    updateAsset: async () => ({
      data: null,
      error: "db update failed",
    }),
  });

  assert.equal(result.data, null);
  assert.equal(result.error, "db update failed");
  assert.equal(result.warning?.operation, "remove_uploaded_file");
  assert.equal(result.warning?.filePath, "manuel-uid/book-id/asset-id/new.png");
});

test("replacement uses the previous file_path saved in the database even when it belongs to the other account", async () => {
  const removedPaths: string[] = [];

  await persistUploadedAssetFile({
    previousFilePath: "alice-uid/public-book/asset-id/old.webp",
    removeStoredFile: successfulRemove(removedPaths),
    uploadedFilePath: "manuel-uid/public-book/asset-id/new.webp",
    updateAsset: async () => ({
      data: { assetId: "asset-id" },
      error: null,
    }),
  });

  assert.deepEqual(removedPaths, ["alice-uid/public-book/asset-id/old.webp"]);
});

test("deleting an image block with an exclusive asset removes the block asset record and stored file", async () => {
  const removedPaths: string[] = [];
  const deletedAssets: string[] = [];

  const result = await cleanupAssetAfterImageBlockDelete({
    assetId: "asset-id",
    countAssetReferences: async () => ({
      data: { count: 0 },
      error: null,
    }),
    deleteAssetRecord: async (assetId) => {
      deletedAssets.push(assetId);
      return {
        data: { assetId },
        error: null,
      };
    },
    filePath: "alice-uid/public-book/asset-id/image.png",
    removeStoredFile: successfulRemove(removedPaths),
  });

  assert.deepEqual(result, {
    assetDeleted: true,
    fileDeleted: true,
    warning: null,
  });
  assert.deepEqual(deletedAssets, ["asset-id"]);
  assert.deepEqual(removedPaths, ["alice-uid/public-book/asset-id/image.png"]);
});

test("deleting an image block keeps an asset that is still referenced by another block", async () => {
  const removedPaths: string[] = [];
  const deletedAssets: string[] = [];

  const result = await cleanupAssetAfterImageBlockDelete({
    assetId: "asset-id",
    countAssetReferences: async () => ({
      data: { count: 1 },
      error: null,
    }),
    deleteAssetRecord: async (assetId) => {
      deletedAssets.push(assetId);
      return {
        data: { assetId },
        error: null,
      };
    },
    filePath: "alice-uid/public-book/asset-id/image.png",
    removeStoredFile: successfulRemove(removedPaths),
  });

  assert.deepEqual(result, {
    assetDeleted: false,
    fileDeleted: false,
    warning: null,
  });
  assert.deepEqual(deletedAssets, []);
  assert.deepEqual(removedPaths, []);
});

test("deleting an image block does not remove the stored file if asset DB deletion fails", async () => {
  const removedPaths: string[] = [];

  const result = await cleanupAssetAfterImageBlockDelete({
    assetId: "asset-id",
    countAssetReferences: async () => ({
      data: { count: 0 },
      error: null,
    }),
    deleteAssetRecord: async () => ({
      data: null,
      error: "asset delete failed",
    }),
    filePath: "alice-uid/public-book/asset-id/image.png",
    removeStoredFile: successfulRemove(removedPaths),
  });

  assert.equal(result.assetDeleted, false);
  assert.equal(result.fileDeleted, false);
  assert.equal(result.warning?.operation, "remove_deleted_asset_file");
  assert.deepEqual(removedPaths, []);
});

test("public book image cleanup is independent from the authenticated user's storage folder", async () => {
  const removedPaths: string[] = [];

  const result = await cleanupAssetAfterImageBlockDelete({
    assetId: "asset-id",
    countAssetReferences: async () => ({
      data: { count: 0 },
      error: null,
    }),
    deleteAssetRecord: async (assetId) => ({
      data: { assetId },
      error: null,
    }),
    filePath: "alice-uid/manuel-public-book/asset-id/image.png",
    removeStoredFile: successfulRemove(removedPaths),
  });

  assert.equal(result.assetDeleted, true);
  assert.deepEqual(removedPaths, [
    "alice-uid/manuel-public-book/asset-id/image.png",
  ]);
});
