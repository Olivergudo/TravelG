"use client";
import { useRef, useState } from "react";
import { Ban, Camera, Check, CircleHelp, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { CategoryPicker } from "./expense-ui";
import type {
  AppData,
  Purchase,
  PurchaseItem,
  ScannedReceipt,
  ScannedReceiptItem,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { classifyTicketProduct, normalizeTicketProductName, type ClassificationResult, type TicketProductAlias } from "@/lib/food-classifier";
import { ticketAliasRepository } from "@/lib/food-classifier/alias-repository";
import { fridgeRepository } from "@/lib/fridge/repository";
import { findPossibleDuplicateProduct } from "@/lib/fridge/duplicates";
type Update = (fn: (data: AppData) => AppData) => void;
const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalize = (s: string) =>
  s
    .trim()
    .toLocaleLowerCase("es-CL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const money = (n = 0) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
const numeric = (s: string) => Number(s.replace(/\D/g, "")) || 0;
type ReviewedItem = ScannedReceiptItem & {
  classifier: ClassificationResult;
  originalClassification: "food" | "non_food" | "unknown";
  finalClassification: "food" | "non_food" | "unknown";
  selected: boolean;
  duplicateName?: string;
};
export function ReceiptScanner({
  data,
  update,
  close,
  completed,
}: {
  data: AppData;
  update: Update;
  close: () => void;
  completed?: () => void;
}) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [receipt, setReceipt] = useState<ScannedReceipt>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("supermarket");
  const [reviewedItems, setReviewedItems] = useState<ReviewedItem[]>([]);
  const [aliases, setAliases] = useState<TicketProductAlias[]>([]);
  const [userId, setUserId] = useState<string>();
  const confirming = useRef(false);
  const choose = (selected?: File) => {
    if (!selected) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setReceipt(undefined);
    setError("");
  };
  const analyze = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", await compress(file));
      const session = (await supabase?.auth.getSession())?.data.session;
      const token = session?.access_token;
      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        body,
      });
      const json = await response.json();
      if (!response.ok) {
        const base =
          json.message || json.error || "No pudimos leer este ticket.";
        const detail =
          json.stage || json.azureCode
            ? `\nEtapa: ${json.stage || "desconocida"}\nError: ${json.azureCode || "desconocido"}`
            : "";
        throw new Error(`${base}${detail}`);
      }
      const scanned = json as ScannedReceipt;
      const learned = session?.user.id
        ? await ticketAliasRepository.load(session.user.id)
        : aliases;
      const currentFridge = session?.user.id
        ? await fridgeRepository.load(session.user.id)
        : [];
      setAliases(learned);
      setUserId(session?.user.id);
      const reviewed = scanned.items.map((item) => {
          const classifier = classifyTicketProduct(
            item.rawName || item.displayName,
            learned,
          );
          const duplicate = findPossibleDuplicateProduct(
            classifier.suggestedDisplayName || item.displayName,
            currentFridge,
          );
          return {
            ...item,
            displayName: classifier.suggestedDisplayName || item.displayName,
            classifier,
            originalClassification: classifier.classification,
            finalClassification: classifier.classification,
            selected: classifier.classification === "food" && !duplicate,
            duplicateName: duplicate?.product.name,
          };
        });
      setReceipt({ ...scanned, items: reviewed });
      setReviewedItems(reviewed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer este ticket.");
    } finally {
      setLoading(false);
    }
  };
  const sum = receipt?.items.reduce((n, i) => n + i.totalPrice, 0) || 0;
  const difference = receipt ? receipt.total - sum : 0;
  const confirm = async (finance: boolean) => {
    if (!receipt || !receipt.items.length || confirming.current) return;
    confirming.current = true;
    const completedAt = receipt.date
        ? new Date(`${receipt.date}T${receipt.time || "12:00"}`).toISOString()
        : new Date().toISOString(),
      purchaseId = uid(),
      expenseId = finance ? uid() : undefined;
    const items: PurchaseItem[] = receipt.items.map((i) => ({
      id: uid(),
      purchaseId,
      productName: i.displayName.trim(),
      rawProductName: i.rawName,
      normalizedName: normalize(i.displayName),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      createdAt: completedAt,
    }));
    const purchase: Purchase = {
      id: purchaseId,
      supermarketName: receipt.merchantName.trim() || "Sin registrar",
      startedAt: completedAt,
      completedAt,
      total: receipt.total || sum,
      source: "receipt",
      expenseId,
      items,
    };
    if (userId) {
      let currentAliases = aliases;
      for (const item of reviewedItems) {
        if (item.finalClassification === "unknown" || !item.rawName.trim()) continue;
        const suggestedName = item.classifier.suggestedDisplayName || item.rawName.trim();
        const wasCorrected =
          item.originalClassification === "unknown" ||
          item.finalClassification !== item.originalClassification ||
          item.displayName.trim() !== suggestedName;
        if (!wasCorrected) continue;
        const alias: TicketProductAlias = {
          rawNameNormalized: normalizeTicketProductName(item.rawName),
          displayName: item.displayName.trim(),
          classification: item.finalClassification,
        };
        currentAliases = await ticketAliasRepository.save(userId, item.rawName, alias, currentAliases);
      }
      setAliases(currentAliases);
      let fridgeItems = await fridgeRepository.load(userId);
      for (const item of reviewedItems.filter((candidate) => candidate.selected && candidate.finalClassification === "food")) {
        fridgeItems = await fridgeRepository.add(userId, {
          name: item.displayName.trim(),
          quantity: item.classifier.quantity ?? item.quantity ?? 1,
          unit: item.classifier.unit || "unidad",
        }, fridgeItems);
      }
    }
    update((d) => {
      const expense = expenseId
        ? {
            id: expenseId,
            description: `Compra - ${purchase.supermarketName}`,
            amount: purchase.total,
            categoryId,
            date: completedAt,
            time: new Date(completedAt).toTimeString().slice(0, 8),
            source: "receipt" as const,
            purchaseId,
            createdAt: completedAt,
            updatedAt: completedAt,
          }
        : undefined;
      return {
        ...d,
        purchases: [purchase, ...d.purchases],
        expenses: expense ? [expense, ...d.expenses] : d.expenses,
      };
    });
    completed?.();
    close();
  };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f5f7f5]">
      <header className="sticky top-0 z-10 flex min-h-16 items-center border-b border-black/[.04] bg-white/95 p-4 backdrop-blur-xl">
        <h1 className="flex-1 text-xl font-bold">
          {receipt ? "Revisar ticket" : "Escanear ticket"}
        </h1>
        <button
          onClick={close}
          className="grid h-11 w-11 place-items-center rounded-full bg-[#f1f4f2]"
        >
          <X />
        </button>
      </header>
      <div className="mx-auto max-w-lg space-y-4 p-4">
        {!receipt && (
          <>
            <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-[#aac1b4] bg-white text-[#176b46]">
              {preview ? (
                <span
                  role="img"
                  aria-label="Vista previa del ticket"
                  className="block h-80 w-full bg-contain bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${preview})` }}
                />
              ) : (
                <>
                  <Camera size={36} />
                  <b className="mt-3">Tomar foto o elegir imagen</b>
                </>
              )}
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => choose(e.target.files?.[0])}
              />
            </label>
            <button
              disabled={!file || loading}
              onClick={analyze}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-5 font-bold text-white disabled:opacity-40"
            >
              {loading ? (
                <>
                  <LoaderCircle className="animate-spin" /> Analizando ticket…
                </>
              ) : (
                "Analizar ticket"
              )}
            </button>
            {error && (
              <div className="whitespace-pre-line rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                {error}
                <p className="mt-2">
                  Intenta otra foto o registra la compra manualmente.
                </p>
              </div>
            )}
          </>
        )}
        {receipt && (
          <Review
            receipt={receipt}
            setReceipt={setReceipt}
            reviewedItems={reviewedItems}
            setReviewedItems={setReviewedItems}
          />
        )}
        {receipt && (
          <>
            <div
              className={
                "rounded-2xl p-4 text-sm " +
                (difference
                  ? "bg-amber-50 text-amber-800"
                  : "bg-green-50 text-green-800")
              }
            >
              {difference
                ? `Revisa el ticket: existe una diferencia de ${money(Math.abs(difference))}.`
                : "✓ La suma de productos coincide con el total."}
              <div className="mt-1">
                Productos: {money(sum)} · Ticket: {money(receipt.total)}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <b className="mb-2 block text-sm">Categoría en Finanzas</b>
              <CategoryPicker
                categories={data.categories}
                value={categoryId}
                onChange={setCategoryId}
              />
            </div>
            <button
              onClick={() => confirm(true)}
              className="min-h-14 w-full rounded-2xl bg-[#176b46] px-5 font-bold text-white"
            >
              Agregar{" "}
              {reviewedItems.filter((item) => item.selected && item.finalClassification === "food").length}{" "}
              al refrigerador y guardar gasto
            </button>
          </>
        )}
      </div>
    </div>
  );
}
function Review({
  receipt,
  setReceipt,
  reviewedItems,
  setReviewedItems,
}: {
  receipt: ScannedReceipt;
  setReceipt: (r: ScannedReceipt) => void;
  reviewedItems: ReviewedItem[];
  setReviewedItems: (items: ReviewedItem[]) => void;
}) {
  const change = (id: string, patch: Partial<ScannedReceiptItem>) => {
    setReceipt({
      ...receipt,
      items: receipt.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
    setReviewedItems(reviewedItems.map((item) => item.id === id ? { ...item, ...patch } : item));
  };
  const classify = (id: string, classification: "food" | "non_food" | "unknown") =>
    setReviewedItems(reviewedItems.map((item) => item.id === id ? {
      ...item, finalClassification: classification, selected: classification === "food",
    } : item));
  const remove = (id: string) => {
    setReceipt({ ...receipt, items: receipt.items.filter((item) => item.id !== id) });
    setReviewedItems(reviewedItems.filter((item) => item.id !== id));
  };
  const foodCount = reviewedItems.filter((item) => item.finalClassification === "food").length;
  const nonFoodCount = reviewedItems.filter((item) => item.finalClassification === "non_food").length;
  const unknownCount = reviewedItems.length - foodCount - nonFoodCount;
  return (
    <>
      <div className="rounded-3xl bg-white p-4">
        <label className="text-xs font-bold text-[#718078]">Supermercado</label>
        <input
          value={receipt.merchantName}
          onChange={(e) =>
            setReceipt({ ...receipt, merchantName: e.target.value })
          }
          className="w-full py-2 text-xl font-bold outline-none"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={receipt.date || ""}
            onChange={(e) => setReceipt({ ...receipt, date: e.target.value })}
            className="rounded-xl bg-[#f3f6f3] p-3"
          />
          <input
            type="time"
            value={receipt.time || ""}
            onChange={(e) => setReceipt({ ...receipt, time: e.target.value })}
            className="rounded-xl bg-[#f3f6f3] p-3"
          />
        </div>
      </div>
      <section className="rounded-3xl bg-white p-4">
        <h2 className="text-lg font-bold">Productos del ticket</h2>
        <p className="mt-1 text-sm font-semibold">Productos detectados: {reviewedItems.length}</p>
        <p className="mt-1 text-sm text-[#68766f]">Revisa qué alimentos quieres guardar en tu refrigerador.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-800"><b className="block text-base">{foodCount}</b>Alimentos</div>
          <div className="rounded-xl bg-slate-50 p-2 text-slate-700"><b className="block text-base">{nonFoodCount}</b>No alimentos</div>
          <div className="rounded-xl bg-amber-50 p-2 text-amber-800"><b className="block text-base">{unknownCount}</b>Por revisar</div>
        </div>
      </section>
      {receipt.items.map((item) => {
        const reviewed = reviewedItems.find((candidate) => candidate.id === item.id);
        if (!reviewed) return null;
        return (
        <div key={item.id} className="space-y-3 rounded-3xl bg-white p-4">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <input aria-label="Nombre del producto" value={item.displayName} onChange={(e) => change(item.id, { displayName: e.target.value })} className="w-full font-bold outline-none" />
              {item.rawName && normalize(item.rawName) !== normalize(item.displayName) && <p className="truncate text-xs text-[#7a8780]">Ticket: {item.rawName}</p>}
            </div>
            <button
              aria-label={`Eliminar ${item.displayName}`}
              onClick={() => remove(item.id)}
              className="text-red-500"
            >
              <Trash2 size={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => classify(item.id, "food")} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold ${reviewed.finalClassification === "food" && reviewed.selected ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-[#d9e1dc] text-[#66736c]"}`}>
              <Check size={17} /> Al refrigerador
            </button>
            <button type="button" onClick={() => classify(item.id, "non_food")} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold ${reviewed.finalClassification === "non_food" ? "border-slate-500 bg-slate-100 text-slate-800" : "border-[#d9e1dc] text-[#66736c]"}`}>
              <Ban size={17} /> No alimento
            </button>
          </div>
          {reviewed.finalClassification === "unknown" && <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-800"><CircleHelp size={16} /> No pudimos clasificarlo. Elige una opción.</p>}
          {reviewed.duplicateName && !reviewed.selected && reviewed.finalClassification === "food" && <p className="rounded-xl bg-amber-50 p-2 text-xs text-amber-800"><b>{reviewed.duplicateName}</b> ya está en tu refrigerador. Toca “Al refrigerador” si quieres agregar otro.</p>}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <label>
              Cantidad
              <input
                inputMode="decimal"
                value={item.quantity}
                onChange={(e) => {
                  const q = Number(e.target.value) || 1;
                  change(item.id, {
                    quantity: q,
                    totalPrice: q * item.unitPrice,
                  });
                }}
                className="mt-1 w-full rounded-xl bg-[#f3f6f3] p-2"
              />
            </label>
            <label>
              Unitario
              <input
                inputMode="numeric"
                value={item.unitPrice}
                onChange={(e) => {
                  const unit = numeric(e.target.value);
                  change(item.id, {
                    unitPrice: unit,
                    totalPrice: item.quantity * unit,
                  });
                }}
                className="mt-1 w-full rounded-xl bg-[#f3f6f3] p-2"
              />
            </label>
            <label>
              Total
              <input
                inputMode="numeric"
                value={item.totalPrice}
                onChange={(e) =>
                  change(item.id, { totalPrice: numeric(e.target.value) })
                }
                className="mt-1 w-full rounded-xl bg-[#f3f6f3] p-2"
              />
            </label>
          </div>
        </div>
      );})}
      <button
        onClick={() => {
          const item: ScannedReceiptItem = { id: uid(), rawName: "", displayName: "Nuevo producto", quantity: 1, unitPrice: 0, totalPrice: 0 };
          const classifier = classifyTicketProduct(item.displayName, []);
          setReceipt({ ...receipt, items: [...receipt.items, item] });
          setReviewedItems([...reviewedItems, { ...item, classifier, originalClassification: "unknown", finalClassification: "unknown", selected: false }]);
        }}
        className="flex w-full justify-center gap-2 rounded-2xl bg-white py-3 font-bold text-[#176b46]"
      >
        <Plus /> Agregar producto
      </button>
      <label className="block rounded-2xl bg-white p-4">
        Total detectado
        <input
          inputMode="numeric"
          value={receipt.total}
          onChange={(e) =>
            setReceipt({ ...receipt, total: numeric(e.target.value) })
          }
          className="w-full pt-2 text-2xl font-bold outline-none"
        />
      </label>
    </>
  );
}
async function compress(file: File) {
  if (file.size < 2_000_000) return file;
  try {
    const bitmap = await createImageBitmap(file),
      scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86),
    );
    bitmap.close();
    return blob ? new File([blob], "ticket.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
