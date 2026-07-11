import { getBookVisibilityBadge } from "@/lib/kdp/book-visibility";

type BookVisibilityBadgeProps = {
  visibility?: string | null;
};

export function BookVisibilityBadge({
  visibility,
}: BookVisibilityBadgeProps) {
  const badge = getBookVisibilityBadge(visibility);

  return <span className={badge.className}>{badge.label}</span>;
}
