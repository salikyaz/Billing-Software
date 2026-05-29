import type { InvoiceStatus } from "@prisma/client";

import { INVOICE_STATUS_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  const style = INVOICE_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  );
}
