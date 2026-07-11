import {
  BOOK_VISIBILITY_OPTIONS,
  normalizeBookVisibility,
} from "@/lib/kdp/book-visibility";

type BookVisibilityFieldsetProps = {
  defaultValue?: string | null;
};

export function BookVisibilityFieldset({
  defaultValue,
}: BookVisibilityFieldsetProps) {
  const selectedVisibility = normalizeBookVisibility(defaultValue);

  return (
    <fieldset className="visibility-fieldset">
      <legend>Visibilita</legend>
      <div className="visibility-options">
        {BOOK_VISIBILITY_OPTIONS.map((option) => (
          <label className="radio-field" key={option.value}>
            <input
              defaultChecked={option.value === selectedVisibility}
              name="visibility"
              type="radio"
              value={option.value}
            />
            <span className="radio-field-main">
              <span>{option.label}</span>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
