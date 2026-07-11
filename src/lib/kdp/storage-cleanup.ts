import type { RepositoryResult } from "@/lib/kdp/books";

export type StorageCleanupOperation =
  | "remove_deleted_asset_file"
  | "remove_previous_file"
  | "remove_uploaded_file";

export type StorageCleanupWarning = {
  filePath: string;
  message: string;
  operation: StorageCleanupOperation;
  errorName?: string | null;
};

export type StorageRemoveResult = {
  error?: {
    message?: string | null;
    name?: string | null;
  } | null;
};

export type RemoveStoredFile = (
  filePath: string,
) => Promise<StorageRemoveResult>;

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

function getStorageCleanupMessage(operation: StorageCleanupOperation) {
  if (operation === "remove_previous_file") {
    return "Immagine aggiornata, ma il vecchio file Storage non e' stato rimosso.";
  }

  if (operation === "remove_uploaded_file") {
    return "Update asset fallito e non riesco a ripulire il nuovo file Storage caricato.";
  }

  return "Blocco e asset eliminati, ma il file Storage collegato e' rimasto nel bucket.";
}

export async function removeStoredKdpAssetFile(
  removeStoredFile: RemoveStoredFile,
  filePath: string | null | undefined,
  operation: StorageCleanupOperation,
): Promise<StorageCleanupWarning | null> {
  if (!filePath) {
    return null;
  }

  try {
    const result = await removeStoredFile(filePath);

    if (!result.error) {
      return null;
    }

    return {
      errorName: result.error.name ?? null,
      filePath,
      message: getStorageCleanupMessage(operation),
      operation,
    };
  } catch (error: unknown) {
    return {
      errorName: getErrorName(error),
      filePath,
      message: getStorageCleanupMessage(operation),
      operation,
    };
  }
}

export async function persistUploadedAssetFile(
  input: {
    previousFilePath: string | null;
    uploadedFilePath: string;
    updateAsset: () => Promise<RepositoryResult<{ assetId: string }>>;
    removeStoredFile: RemoveStoredFile;
  },
): Promise<
  RepositoryResult<{ assetId: string }> & {
    warning: StorageCleanupWarning | null;
  }
> {
  const updateResult = await input.updateAsset();

  if (updateResult.data === null) {
    const warning = await removeStoredKdpAssetFile(
      input.removeStoredFile,
      input.uploadedFilePath,
      "remove_uploaded_file",
    );

    return {
      data: null,
      error: updateResult.error,
      warning,
    };
  }

  const warning =
    input.previousFilePath && input.previousFilePath !== input.uploadedFilePath
      ? await removeStoredKdpAssetFile(
          input.removeStoredFile,
          input.previousFilePath,
          "remove_previous_file",
        )
      : null;

  return {
    data: updateResult.data,
    error: null,
    warning,
  };
}

export async function cleanupAssetAfterImageBlockDelete(
  input: {
    assetId: string | null;
    filePath: string | null;
    countAssetReferences: (
      assetId: string,
    ) => Promise<RepositoryResult<{ count: number }>>;
    deleteAssetRecord: (
      assetId: string,
    ) => Promise<RepositoryResult<{ assetId: string }>>;
    removeStoredFile: RemoveStoredFile;
  },
): Promise<{
  assetDeleted: boolean;
  fileDeleted: boolean;
  warning: StorageCleanupWarning | null;
}> {
  if (!input.assetId) {
    return {
      assetDeleted: false,
      fileDeleted: false,
      warning: null,
    };
  }

  const referenceResult = await input.countAssetReferences(input.assetId);

  if (referenceResult.data === null) {
    return {
      assetDeleted: false,
      fileDeleted: false,
      warning: {
        filePath: input.filePath ?? "",
        message:
          "Blocco eliminato, ma non riesco a verificare se l'asset immagine e' ancora usato.",
        operation: "remove_deleted_asset_file",
      },
    };
  }

  if (referenceResult.data.count > 0) {
    return {
      assetDeleted: false,
      fileDeleted: false,
      warning: null,
    };
  }

  const deleteResult = await input.deleteAssetRecord(input.assetId);

  if (deleteResult.data === null) {
    return {
      assetDeleted: false,
      fileDeleted: false,
      warning: {
        filePath: input.filePath ?? "",
        message:
          "Blocco eliminato, ma non riesco a eliminare il record asset collegato.",
        operation: "remove_deleted_asset_file",
      },
    };
  }

  const warning = await removeStoredKdpAssetFile(
    input.removeStoredFile,
    input.filePath,
    "remove_deleted_asset_file",
  );

  return {
    assetDeleted: true,
    fileDeleted: Boolean(input.filePath && !warning),
    warning,
  };
}
