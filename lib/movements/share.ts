import type { PurchaseItem } from "@/lib/types";
import { formatCurrency, type Currency } from "@/lib/currency";
import { formatLongDate } from "@/lib/date";
import { createPdfDocument } from "@/lib/pdf/document";

export type MovementShareData = { title: string; amount: number; date: string; category: string; description?: string; products: PurchaseItem[]; isTicket: boolean };
const productDetail = (item: PurchaseItem, currency: Currency) => [item.quantity > 1 ? `${item.quantity} unidades` : "", item.unitPrice > 0 ? `${formatCurrency(item.unitPrice, currency)} c/u` : "", item.totalPrice > 0 ? `Total ${formatCurrency(item.totalPrice, currency)}` : ""].filter(Boolean).join(" · ");
export const safePdfName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
export function movementPdfFilename(item: MovementShareData) {
  const date = new Date(item.date); const stamp = [date.getDate(), date.getMonth() + 1, date.getFullYear()].map((part) => String(part).padStart(2, "0")).join("-");
  return `${item.isTicket ? "ticket" : "gasto"}-${safePdfName(item.title) || "movimiento"}-${stamp}.pdf`;
}
export function movementAsText(item: MovementShareData, currency: Currency) {
  const rows = [item.title, "", `${item.isTicket ? "Total" : "Monto"}: ${formatCurrency(item.amount, currency)}`, `Fecha: ${formatLongDate(item.date)}`, `Categoría: ${item.category}`];
  if (item.description) rows.push(`Descripción: ${item.description}`);
  if (item.products.length) rows.push("", "Productos:", ...item.products.map((product) => `- ${product.productName}${productDetail(product, currency) ? ` — ${productDetail(product, currency)}` : ""}`));
  return rows.join("\n");
}
export async function movementPdf(item: MovementShareData, currency: Currency) {
  const document = await createPdfDocument(item.isTicket ? "Detalle de compra" : "Comprobante de gasto", item.title);
  document.section(item.isTicket ? "Monto total" : "Monto"); document.write(formatCurrency(item.amount, currency), { size: 18, bold: true });
  document.section("Fecha"); document.write(formatLongDate(item.date));
  document.section("Categoría"); document.write(item.category);
  if (item.description) { document.section("Descripción"); document.write(item.description); }
  if (item.products.length) { document.section("Productos"); item.products.forEach((product) => { document.write(product.productName, { bold: true }); const detail = productDetail(product, currency); if (detail) document.write(detail, { size: 9, color: [90, 105, 97], gap: 5 }); }); }
  return document.finish();
}
