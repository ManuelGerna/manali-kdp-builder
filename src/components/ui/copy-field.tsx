"use client";

import { useState } from "react";

type CopyFieldProps = {
  label: string;
  value: string;
};

export function CopyField({ label, value }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="copy-field">
      <div className="copy-field-header">
        <h3 className="copy-field-label">{label}</h3>
        <button
          className={`secondary-button copy-field-button ${
            copied ? "is-copied" : ""
          }`}
          disabled={!value}
          aria-label={`Copia ${label}`}
          onClick={copyValue}
          type="button"
        >
          {copied ? "Copiato" : "Copia"}
        </button>
      </div>
      <div className="copy-field-value-shell">
        <p className="copy-field-value">{value || "Campo vuoto"}</p>
      </div>
    </div>
  );
}
