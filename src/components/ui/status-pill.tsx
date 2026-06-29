import { BOOK_STATUS_LABELS, type BookStatus } from "@/lib/kdp/constants";

type StatusPillProps = {
  status: BookStatus;
};

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span className={`status-pill status-${status}`}>
      {BOOK_STATUS_LABELS[status]}
    </span>
  );
}
