"use client";

import {
  ChevronLeft,
  Clipboard,
  FileText,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  ReceiptText,
  Search,
  Share2,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  categoryEmoji,
  categoryName,
  CategoryManager,
  QuickExpenseForm,
} from "./expense-ui";
import type {
  AppData,
  Category,
  Expense,
  Purchase,
  PurchaseItem,
} from "@/lib/types";
import { deleteExpense, saveExpense } from "@/lib/expense-sync";
import { getCategorySoftColor } from "@/lib/category-colors";
import { formatCurrency, type Currency } from "@/lib/currency";
import {
  movementAsText,
  movementPdf,
  movementPdfFilename,
  type MovementShareData,
} from "@/lib/movements/share";
import { shareOrDownloadPdf } from "@/lib/pdf/share";
import { useI18n } from "@/lib/i18n";

type Update = (fn: (data: AppData) => AppData) => void;
export type PurchaseHistoryItem = {
  id: string;
  expense?: Expense;
  purchase?: Purchase;
  title: string;
  description?: string;
  amount: number;
  date: string;
  category?: Category;
  products: PurchaseItem[];
};
export const cleanStoreName = (value?: string) => {
  const clean = (value || "").replace(/^compra\s*[-–—:]\s*/i, "").trim();
  return clean && !/^sin registrar$/i.test(clean)
    ? clean
    : "Compra sin registrar";
};

export function buildPurchaseHistory(data: AppData): PurchaseHistoryItem[] {
  const linked = new Set<string>();
  const expenses = data.expenses.map((expense) => {
    const purchase = data.purchases.find(
      (p) => p.id === expense.purchaseId || p.expenseId === expense.id,
    );
    if (purchase) linked.add(purchase.id);
    const category = data.categories.find((c) => c.id === expense.categoryId);
    const title = purchase
      ? cleanStoreName(purchase.supermarketName || expense.description)
      : expense.description;
    return {
      id: `expense:${expense.id}`,
      expense,
      purchase,
      title,
      description:
        purchase && cleanStoreName(expense.description) !== title
          ? expense.description
          : undefined,
      amount: expense.amount,
      date: expense.date,
      category,
      products: purchase?.items || [],
    };
  });
  const purchases = data.purchases
    .filter((p) => !linked.has(p.id))
    .map((purchase) => ({
      id: `purchase:${purchase.id}`,
      purchase,
      title: cleanStoreName(purchase.supermarketName),
      amount: purchase.total,
      date: purchase.completedAt,
      category: data.categories.find((c) => c.id === "supermarket"),
      products: purchase.items,
    }));
  return [...expenses, ...purchases].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

export function ShoppingV2({
  data,
  update,
  currency,
  showFinances,
}: {
  data: AppData;
  update: Update;
  showFinances: () => void;
  currency: Currency;
}) {
  const [selected, setSelected] = useState<PurchaseHistoryItem>();
  const [actions, setActions] = useState<PurchaseHistoryItem>();
  const [deleting, setDeleting] = useState<PurchaseHistoryItem>();
  const [editing, setEditing] = useState<Expense>();
  const [managingCategories, setManagingCategories] = useState(false);
  const remove = (item: PurchaseHistoryItem) => {
    if (item.expense) update((data) => deleteExpense(data, item.expense!.id));
    else if (item.purchase)
      update((data) => ({
        ...data,
        purchases: data.purchases.filter((p) => p.id !== item.purchase!.id),
      }));
    setDeleting(undefined);
    setSelected(undefined);
  };
  return (
    <>
      <PurchaseHistory
        data={data}
        currency={currency}
        open={setSelected}
        actions={setActions}
        showFinances={showFinances}
      />
      {selected && (
        <HistoryDetail
          item={selected}
          currency={currency}
          close={() => setSelected(undefined)}
        />
      )}
      {actions && (
        <HistoryActions
          item={actions}
          close={() => setActions(undefined)}
          edit={() => {
            if (actions.expense) setEditing(actions.expense);
            setActions(undefined);
          }}
          remove={() => {
            setDeleting(actions);
            setActions(undefined);
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          item={deleting}
          cancel={() => setDeleting(undefined)}
          confirm={() => remove(deleting)}
        />
      )}
      {editing && (
        <QuickExpenseForm
          categories={data.categories}
          expense={editing}
          close={() => setEditing(undefined)}
          save={(next) => {
            update((current) => saveExpense(current, next));
            setEditing(undefined);
          }}
          onManageCategories={() => setManagingCategories(true)}
        />
      )}
      {managingCategories && (
        <CategoryManager
          categories={data.categories}
          usedCategoryIds={new Set(data.expenses.map((e) => e.categoryId))}
          close={() => setManagingCategories(false)}
          onChange={(categories) =>
            update((current) => ({ ...current, categories }))
          }
        />
      )}
    </>
  );
}

function PurchaseHistory({
  data,
  currency,
  open,
  actions,
  showFinances,
}: {
  data: AppData;
  currency: Currency;
  open: (item: PurchaseHistoryItem) => void;
  actions: (item: PurchaseHistoryItem) => void;
  showFinances: () => void;
}) {
  const { t, formatDate } = useI18n();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const history = useMemo(() => buildPurchaseHistory(data), [data]);
  const categories = useMemo(
    () =>
      data.categories.filter((c) =>
        history.some((i) => i.category?.id === c.id),
      ),
    [data.categories, history],
  );
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("es-CL");
    return history.filter(
      (item) =>
        (categoryId === "all" || item.category?.id === categoryId) &&
        (!search ||
          [
            item.title,
            item.description || "",
            item.category?.name || "",
            item.purchase?.supermarketName || "",
            ...item.products.flatMap((p) => [
              p.productName,
              p.rawProductName || "",
            ]),
          ].some((v) => v.toLocaleLowerCase("es-CL").includes(search))),
    );
  }, [categoryId, history, query]);
  const groups = useMemo(() => {
    const map = new Map<string, PurchaseHistoryItem[]>();
    visible.forEach((item) => {
      const key = formatDate(item.date, { month: "long", year: "numeric" });
      map.set(key, [...(map.get(key) || []), item]);
    });
    return [...map.entries()];
  }, [formatDate, visible]);
  return (
    <>
      <header className="flex items-center gap-3 px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={showFinances}
          aria-label={t("common.back")}
          className="theme-card grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/[.06] bg-white"
        >
          <ChevronLeft size={21} />
        </button>
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[.18em] text-[#6f8278]">
            {t("finance.history")}
          </p>
          <h1 className="mt-1 text-[30px] font-bold">{t("purchases.title")}</h1>
        </div>
      </header>
      <main className="space-y-7 px-4 pb-28">
        <div className="flex min-w-0 gap-2">
          <label className="theme-card flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-black/[.04] bg-white px-4">
            <Search className="shrink-0 text-[#718078]" size={19} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("purchases.search")}
              className="min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
          <button
            onClick={() => setFilterOpen(true)}
            aria-label={t("purchases.filter")}
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border text-xl font-bold ${categoryId === "all" ? "theme-card border-black/[.04] bg-white" : "border-[#4fc187] bg-[#173c2b] text-[#62d196]"}`}
          >
            •••
          </button>
        </div>
        {!history.length && <Empty title={t("purchases.noItems")} />}{" "}
        {history.length > 0 && !groups.length && (
          <Empty title={t("purchases.noResults")} />
        )}
        {groups.map(([month, items]) => (
          <section key={month}>
            <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-[.14em] text-[#718078]">
              {month}
            </h2>
            <div className="theme-card overflow-hidden rounded-[26px] border border-black/[.04] bg-white">
              {items.map((item) => (
                <HistoryRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  open={() => open(item)}
                  actions={() => actions(item)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
      {filterOpen && (
        <HistoryFilter
          categories={categories}
          selected={categoryId}
          close={() => setFilterOpen(false)}
          select={(id) => {
            setCategoryId(id);
            setFilterOpen(false);
          }}
        />
      )}
    </>
  );
}

function HistoryRow({
  item,
  currency,
  open,
  actions,
}: {
  item: PurchaseHistoryItem;
  currency: Currency;
  open: () => void;
  actions: () => void;
}) {
  const { formatDate, t } = useI18n();
  const products = item.products.length
    ? ` · ${item.products.length} ${item.products.length === 1 ? "producto" : "productos"}`
    : "";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") open();
      }}
      className="flex min-h-[76px] w-full cursor-pointer items-center gap-3 border-b border-black/5 px-4 py-3 text-left last:border-0"
    >
      <span
        style={{ backgroundColor: getCategorySoftColor(item.category) }}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl"
      >
        {categoryEmoji(item.category)}
      </span>
      <span className="min-w-0 flex-1">
        <b className="line-clamp-2 text-[15px] leading-tight">{item.title}</b>
        <small className="mt-1 block truncate text-[13px] text-[#718078]">
          {categoryName(item.category, t)} ·{" "}
          {formatDate(item.date, { day: "numeric", month: "short" }).replace(
            ".",
            "",
          )}
          {products}
        </small>
      </span>
      <b className="shrink-0 whitespace-nowrap text-sm">
        {formatCurrency(item.amount, currency)}
      </b>
      <button
        onClick={(e) => {
          e.stopPropagation();
          actions();
        }}
        aria-label={item.title}
        className="grid h-11 w-9 shrink-0 place-items-center rounded-xl"
      >
        <MoreHorizontal size={20} />
      </button>
    </div>
  );
}
function Empty({ title }: { title: string }) {
  return (
    <section className="theme-card rounded-[28px] bg-white p-8 text-center">
      <ShoppingBasket className="mx-auto mb-3 text-[#91a098]" size={32} />
      <p className="font-semibold">{title}</p>
    </section>
  );
}

function HistoryDetail({
  item,
  currency,
  close,
}: {
  item: PurchaseHistoryItem;
  currency: Currency;
  close: () => void;
}) {
  const { t, formatDate } = useI18n();
  const [shareOpen, setShareOpen] = useState(false);
  const shareData: MovementShareData = {
    title: item.title,
    amount: item.amount,
    date: item.date,
    category: categoryName(item.category, t),
    description: item.description,
    products: item.products,
    isTicket: Boolean(item.purchase),
  };
  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center">
        <section className="theme-card max-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
          <div className="flex items-center gap-2">
            <button
              onClick={close}
              aria-label={t("common.back")}
              className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"
            >
              <ChevronLeft size={21} />
            </button>
            <p className="flex-1 text-center text-xs font-bold uppercase tracking-[.16em] text-[#718078]">
              {item.purchase ? t("purchases.purchaseDetail") : t("purchases.detail")}
            </p>
            <span className="h-11 w-11" aria-hidden="true" />
          </div>
          <div className="mt-5 text-center">
            <span
              style={{ backgroundColor: getCategorySoftColor(item.category) }}
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl"
            >
              {categoryEmoji(item.category)}
            </span>
            <h2 className="mx-auto mt-3 max-w-sm text-2xl font-bold leading-tight">
              {item.title}
            </h2>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-3">
            <Info label={t("purchases.amount")} value={formatCurrency(item.amount, currency)} />
            <Info label={t("purchases.category")} value={categoryName(item.category, t)} />
            <div className="col-span-2">
              <Info label={t("purchases.date")} value={formatDate(item.date)} />
            </div>
          </dl>
          {item.description && (
            <section className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">
                {t("purchases.description")}
              </h3>
              <p className="mt-2 text-sm">{item.description}</p>
            </section>
          )}
          {item.products.length > 0 && (
            <section className="mt-6">
              <div className="flex items-center gap-2">
                <ReceiptText className="text-[#176b46]" size={19} />
                <h3 className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">
                  {t("purchases.products", { count: item.products.length })}
                </h3>
              </div>
              <div className="mt-2 overflow-hidden rounded-2xl border border-black/[.07]">
                {item.products.map((p) => (
                  <div
                    key={p.id}
                    className="flex gap-3 border-b border-black/[.06] px-4 py-3 text-sm last:border-0"
                  >
                    <span className="min-w-0 flex-1 font-semibold">
                      {p.productName}
                    </span>
                    <span className="shrink-0 text-[#718078]">
                      {p.quantity} ×{" "}
                      {p.unitPrice > 0
                        ? formatCurrency(p.unitPrice, currency)
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <button
            onClick={() => setShareOpen(true)}
            className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-semibold text-white"
          >
            <Share2 size={20} /> {t("purchases.share")}
          </button>
        </section>
      </div>
      {shareOpen && (
        <MovementShareSheet
          item={shareData}
          currency={currency}
          close={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="h-full rounded-2xl bg-[#f3f6f3] p-4">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#718078]">
        {label}
      </dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  );
}

function MovementShareSheet({
  item,
  currency,
  close,
}: {
  item: MovementShareData;
  currency: Currency;
  close: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const createPdf = async () => {
    if (working) return;
    setWorking(true);
    setStatus("");
    try {
      const blob = await movementPdf(item, currency);
      const result = await shareOrDownloadPdf(
        blob,
        movementPdfFilename(item),
        item.title,
      );
      setStatus(result === "shared" ? "PDF compartido" : "PDF descargado");
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError"))
        setStatus("No pudimos crear el PDF. Intenta nuevamente.");
    } finally {
      setWorking(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(movementAsText(item, currency));
      setStatus("Resumen copiado");
    } catch {
      setStatus("No pudimos copiar el resumen.");
    }
  };
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 sm:items-center"
      onClick={close}
    >
      <section
        className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#176b46]">
              Compartir
            </p>
            <h2 className="mt-1 truncate text-xl font-bold">{item.title}</h2>
          </div>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"
          >
            <X />
          </button>
        </div>
        <div className="mt-5 space-y-2">
          <button
            disabled={working}
            onClick={createPdf}
            className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[#176b46] px-4 font-semibold text-white disabled:opacity-60"
          >
            {working ? (
              <LoaderCircle className="animate-spin" size={20} />
            ) : (
              <FileText size={20} />
            )}{" "}
            {working ? "Preparando PDF..." : "Compartir como PDF"}
          </button>
          <button
            disabled={working}
            onClick={copy}
            className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[#e6f3ec] px-4 font-semibold text-[#176b46]"
          >
            <Clipboard size={20} /> Copiar resumen
          </button>
        </div>
        {status && (
          <p
            role="status"
            className={`mt-3 text-center text-sm font-semibold ${status.startsWith("No pudimos") ? "text-red-700" : "text-[#176b46]"}`}
          >
            {status}
          </p>
        )}
      </section>
    </div>
  );
}

function HistoryActions({
  item,
  close,
  edit,
  remove,
}: {
  item: PurchaseHistoryItem;
  close: () => void;
  edit: () => void;
  remove: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={close}
    >
      <section
        className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 truncate text-xl font-bold">
            {item.title}
          </h2>
          <button
            onClick={close}
            aria-label={t("common.close")}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"
          >
            <X />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {item.expense && (
            <button
              onClick={edit}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-[#edf2ee] px-4 font-semibold"
            >
              <Pencil size={19} /> {t("common.edit")}
            </button>
          )}
          <button
            onClick={remove}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-red-50 px-4 font-semibold text-red-700"
          >
            <Trash2 size={19} /> {t("common.delete")}
          </button>
        </div>
      </section>
    </div>
  );
}
function DeleteDialog({
  item,
  cancel,
  confirm,
}: {
  item: PurchaseHistoryItem;
  cancel: () => void;
  confirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-5">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-history-title"
        className="theme-card w-full max-w-sm rounded-[26px] bg-white p-5 text-center"
      >
        <h2 id="delete-history-title" className="text-xl font-bold">
          {t("purchases.deleteTitle")}
        </h2>
        <p className="mt-2 text-sm text-[#718078]">
          “{item.title}”. {t("purchases.deleteHint")}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={cancel}
            className="min-h-12 rounded-2xl border border-black/10 font-semibold"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={confirm}
            className="min-h-12 rounded-2xl bg-red-600 font-semibold text-white"
          >
            {t("common.delete")}
          </button>
        </div>
      </section>
    </div>
  );
}
function HistoryFilter({
  categories,
  selected,
  close,
  select,
}: {
  categories: Category[];
  selected: string;
  close: () => void;
  select: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={close}
    >
      <section
        className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          <h2 className="flex-1 text-xl font-bold">{t("purchases.filter")}</h2>
          <button
            onClick={close}
            aria-label={t("common.close")}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"
          >
            <X />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => select("all")}
            className={`min-h-12 rounded-2xl border px-3 font-semibold ${selected === "all" ? "border-[#176b46] bg-[#e6f3ec] text-[#176b46]" : "border-black/10"}`}
          >
            {t("purchases.all")}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              className={`min-h-12 min-w-0 truncate rounded-2xl border px-3 font-semibold ${selected === c.id ? "border-[#176b46] bg-[#e6f3ec] text-[#176b46]" : "border-black/10"}`}
            >
              {categoryEmoji(c)} {categoryName(c, t)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
