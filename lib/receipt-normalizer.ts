import type { ScannedReceipt, ScannedReceiptItem } from "./types";
type Field = {
  content?: string;
  confidence?: number;
  valueString?: string;
  valueNumber?: number;
  valueCurrency?: { amount?: number };
  valueDate?: string;
  valueTime?: string;
  valueArray?: Field[];
  valueObject?: Record<string, Field>;
};
const text = (f?: Field) => f?.valueString || f?.content || "";
const numeric = (f?: Field) =>
  (f?.valueNumber ??
    f?.valueCurrency?.amount ??
    Number((f?.content || "").replace(/[^0-9.,-]/g, "").replace(",", "."))) ||
  0;
export function normalizeAzureReceipt(payload: unknown): ScannedReceipt {
  const result = payload as {
    analyzeResult?: {
      documents?: Array<{
        confidence?: number;
        fields?: Record<string, Field>;
      }>;
    };
  };
  const doc = result.analyzeResult?.documents?.[0],
    fields = doc?.fields || {};
  const items = (fields.Items?.valueArray || []).map(
    (entry, index): ScannedReceiptItem => {
      const f = entry.valueObject || {},
        quantity = numeric(f.Quantity) || 1,
        total = numeric(f.TotalPrice),
        unit =
          numeric(f.Price) ||
          numeric(f.UnitPrice) ||
          (quantity ? total / quantity : total);
      const raw =
        text(f.Description) || text(f.Name) || `Producto ${index + 1}`;
      return {
        id: `scan-${index}-${Date.now()}`,
        rawName: raw,
        displayName: raw,
        quantity,
        unitPrice: unit,
        totalPrice: total || quantity * unit,
        confidence:
          entry.confidence ?? f.Description?.confidence ?? f.Name?.confidence,
      };
    },
  );
  return {
    merchantName: text(fields.MerchantName),
    date: fields.TransactionDate?.valueDate || text(fields.TransactionDate),
    time: fields.TransactionTime?.valueTime || text(fields.TransactionTime),
    items,
    subtotal: numeric(fields.Subtotal) || undefined,
    total:
      numeric(fields.Total) ||
      numeric(fields.Subtotal) ||
      items.reduce((sum, item) => sum + item.totalPrice, 0),
    confidence: doc?.confidence,
  };
}
