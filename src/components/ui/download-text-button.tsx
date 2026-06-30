"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/action-button";

type DownloadTextButtonProps = {
  content: string;
  filename: string;
  label?: string;
};

export function DownloadTextButton({
  content,
  filename,
  label = "Scarica dati KDP .txt",
}: DownloadTextButtonProps) {
  const [downloaded, setDownloaded] = useState(false);

  function downloadTextFile() {
    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);

    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 1800);
  }

  return (
    <ActionButton
      className={`download-button ${downloaded ? "is-downloaded" : ""}`}
      onClick={downloadTextFile}
    >
      {downloaded ? "Scaricato" : label}
    </ActionButton>
  );
}
