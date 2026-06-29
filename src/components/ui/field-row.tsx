type FieldRowProps = {
  label: React.ReactNode;
  value: React.ReactNode;
};

export function FieldRow({ label, value }: FieldRowProps) {
  return (
    <li className="field-row">
      <span className="panel-label">{label}</span>
      <span className="panel-value">{value}</span>
    </li>
  );
}
