import { round2 } from "@/lib/utils";

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  serviceId?: string | null;
}

export interface ComputedItem extends LineItemInput {
  total: number;
}

export interface InvoiceTotals {
  items: ComputedItem[];
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
}

/**
 * Compute line-item totals, subtotal, tax and grand total for an invoice.
 * `taxRate` is a percentage (e.g. 10 => 10%).
 */
export function computeInvoiceTotals(
  rawItems: LineItemInput[],
  taxRate = 0
): InvoiceTotals {
  const items: ComputedItem[] = rawItems.map((item) => ({
    ...item,
    total: round2(item.quantity * item.unitPrice),
  }));

  const subtotal = round2(items.reduce((sum, i) => sum + i.total, 0));
  const tax = round2((subtotal * taxRate) / 100);
  const total = round2(subtotal + tax);

  return { items, subtotal, taxRate, tax, total };
}
