import type { ButtonHTMLAttributes } from "react";

type ActionButtonVariant = "primary" | "secondary" | "ghost";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionButtonVariant;
};

export function actionButtonClassName(
  variant: ActionButtonVariant = "primary",
  className?: string,
) {
  const baseClass =
    variant === "primary"
      ? "button"
      : variant === "secondary"
        ? "secondary-button"
        : "ghost-button";

  return [baseClass, className].filter(Boolean).join(" ");
}

export function ActionButton({
  className,
  variant = "primary",
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={actionButtonClassName(variant, className)}
      type="button"
      {...props}
    />
  );
}
