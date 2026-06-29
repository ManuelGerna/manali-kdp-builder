type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="header-actions">{action}</div> : null}
    </section>
  );
}
