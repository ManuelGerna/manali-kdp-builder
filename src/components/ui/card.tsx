type CardProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
};

export function Card({ children, className, title }: CardProps) {
  return (
    <section className={["panel", className].filter(Boolean).join(" ")}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
