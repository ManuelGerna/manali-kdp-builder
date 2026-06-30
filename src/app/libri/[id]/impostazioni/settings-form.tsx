"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  BLEED_OPTIONS,
  BODY_FONT_OPTIONS,
  BODY_FONT_SIZES,
  BODY_FONT_SIZE_OPTIONS,
  BODY_FONTS,
  DEFAULT_BOOK_SETTINGS,
  HEADING_FONT_OPTIONS,
  HEADING_FONTS,
  INTERIOR_TYPE_OPTIONS,
  INTERIOR_TYPES,
  LINE_HEIGHT_OPTIONS,
  LINE_HEIGHTS,
  PAPER_TYPE_OPTIONS,
  PAPER_TYPES,
  TRIM_SIZE_OPTIONS,
  TRIM_SIZES,
} from "@/lib/kdp/constants";
import type { KdpBookSettings } from "@/lib/kdp/books";
import {
  updateSettingsAction,
  type SettingsFormState,
} from "@/app/libri/[id]/impostazioni/actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Salvataggio..." : "Salva impostazioni"}
    </button>
  );
}

function isStringOption<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return values.includes(value as T);
}

function isNumberOption<T extends number>(
  values: readonly T[],
  value: number,
): value is T {
  return values.includes(value as T);
}

function getStringOption<T extends string>(
  value: string,
  values: readonly T[],
  fallback: T,
) {
  return isStringOption(values, value) ? value : fallback;
}

function getNumberOption<T extends number>(
  value: number,
  values: readonly T[],
  fallback: T,
) {
  return isNumberOption(values, value) ? value : fallback;
}

function formatNumber(value: number) {
  return String(value);
}

function getInitialFields(settings: KdpBookSettings) {
  return {
    trim_size: getStringOption(
      settings.trim_size,
      TRIM_SIZES,
      DEFAULT_BOOK_SETTINGS.trimSize,
    ),
    bleed: settings.bleed ? "true" : "false",
    interior_type: getStringOption(
      settings.interior_type,
      INTERIOR_TYPES,
      DEFAULT_BOOK_SETTINGS.interiorType,
    ),
    paper_type: getStringOption(
      settings.paper_type,
      PAPER_TYPES,
      DEFAULT_BOOK_SETTINGS.paperType,
    ),
    body_font: getStringOption(
      settings.body_font,
      BODY_FONTS,
      DEFAULT_BOOK_SETTINGS.bodyFont,
    ),
    heading_font: getStringOption(
      settings.heading_font,
      HEADING_FONTS,
      DEFAULT_BOOK_SETTINGS.headingFont,
    ),
    body_font_size: formatNumber(
      getNumberOption(
        settings.body_font_size,
        BODY_FONT_SIZES,
        DEFAULT_BOOK_SETTINGS.bodyFontSize,
      ),
    ),
    line_height: formatNumber(
      getNumberOption(
        settings.line_height,
        LINE_HEIGHTS,
        DEFAULT_BOOK_SETTINGS.lineHeight,
      ),
    ),
    margin_top: formatNumber(settings.margin_top),
    margin_bottom: formatNumber(settings.margin_bottom),
    margin_inner: formatNumber(settings.margin_inner),
    margin_outer: formatNumber(settings.margin_outer),
  };
}

export function SettingsForm({
  bookId,
  settings,
}: {
  bookId: string;
  settings: KdpBookSettings;
}) {
  const initialFields = getInitialFields(settings);
  const initialState: SettingsFormState = {
    message: null,
    fields: initialFields,
  };
  const [state, formAction] = useActionState(
    updateSettingsAction,
    initialState,
  );
  const fields = state.fields ?? initialFields;

  return (
    <form action={formAction} className="form-grid settings-form">
      <input name="book_id" type="hidden" value={bookId} />

      {state.message ? (
        <p className="form-note form-note-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="form-compact-grid">
        <div className="field">
          <label htmlFor="trim_size">Trim size</label>
          <select
            defaultValue={fields.trim_size ?? initialFields.trim_size}
            id="trim_size"
            name="trim_size"
          >
            {TRIM_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="bleed">Bleed</label>
          <select
            defaultValue={fields.bleed ?? initialFields.bleed}
            id="bleed"
            name="bleed"
          >
            {BLEED_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="interior_type">Tipo interno</label>
          <select
            defaultValue={
              fields.interior_type ?? initialFields.interior_type
            }
            id="interior_type"
            name="interior_type"
          >
            {INTERIOR_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="paper_type">Carta</label>
          <select
            defaultValue={fields.paper_type ?? initialFields.paper_type}
            id="paper_type"
            name="paper_type"
          >
            {PAPER_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="body_font">Body font</label>
          <select
            defaultValue={fields.body_font ?? initialFields.body_font}
            id="body_font"
            name="body_font"
          >
            {BODY_FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="heading_font">Heading font</label>
          <select
            defaultValue={fields.heading_font ?? initialFields.heading_font}
            id="heading_font"
            name="heading_font"
          >
            {HEADING_FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="body_font_size">Body font size</label>
          <select
            defaultValue={
              fields.body_font_size ?? initialFields.body_font_size
            }
            id="body_font_size"
            name="body_font_size"
          >
            {BODY_FONT_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="line_height">Line height</label>
          <select
            defaultValue={fields.line_height ?? initialFields.line_height}
            id="line_height"
            name="line_height"
          >
            {LINE_HEIGHT_OPTIONS.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-margin-grid">
        <div className="field">
          <label htmlFor="margin_top">Margine alto</label>
          <input
            defaultValue={fields.margin_top ?? initialFields.margin_top}
            id="margin_top"
            max="2"
            min="0.5"
            name="margin_top"
            step="0.05"
            type="number"
          />
        </div>

        <div className="field">
          <label htmlFor="margin_bottom">Margine basso</label>
          <input
            defaultValue={
              fields.margin_bottom ?? initialFields.margin_bottom
            }
            id="margin_bottom"
            max="2"
            min="0.5"
            name="margin_bottom"
            step="0.05"
            type="number"
          />
        </div>

        <div className="field">
          <label htmlFor="margin_inner">Margine interno</label>
          <input
            defaultValue={fields.margin_inner ?? initialFields.margin_inner}
            id="margin_inner"
            max="2"
            min="0.5"
            name="margin_inner"
            step="0.05"
            type="number"
          />
        </div>

        <div className="field">
          <label htmlFor="margin_outer">Margine esterno</label>
          <input
            defaultValue={fields.margin_outer ?? initialFields.margin_outer}
            id="margin_outer"
            max="2"
            min="0.5"
            name="margin_outer"
            step="0.05"
            type="number"
          />
        </div>
      </div>

      <div className="settings-form-actions">
        <SubmitButton />
      </div>
    </form>
  );
}
