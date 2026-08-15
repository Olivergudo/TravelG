"use client";
import { useRef, useState } from "react";
import { Camera, GripVertical, Trash2, X } from "lucide-react";
import type { Category, Expense } from "@/lib/types";
import { categoryPalette, getCategoryBorderColor, getCategoryColor, getCategorySoftColor, getDefaultCategoryColor, validCategoryHex } from "@/lib/category-colors";
import { formatCurrency } from "@/lib/currency";
import { type TranslationKey, useI18n } from "@/lib/i18n";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const parseAmount = (value: string) => Number(value.replace(/\D/g, "")) || 0;
export const formatMoney = formatCurrency;

const commonEmojis = [
  "🚗", "🚕", "🚌", "🚇", "✈️", "⛽", "🚲", "🍽️", "🍔", "🍕", "☕", "🍺",
  "🍸", "🛒", "🛍️", "👕", "👟", "📱", "💻", "🏠", "💡", "🧹", "🪑", "🔧",
  "🎮", "🎬", "🎵", "🎟️", "⚽", "💊", "🏥", "🩺", "🎁", "💸", "📦", "⭐", "❤️",
];

export const categoryEmoji = (category?: Category) =>
  category?.emoji || category?.icon || "💸";

const defaultCategoryIds = new Set(["supermarket", "transport", "restaurant", "nightlife", "home", "shopping", "entertainment", "health", "other"]);
export const categoryName = (category: Category | undefined, t: (key: TranslationKey) => string) =>
  category && defaultCategoryIds.has(category.id)
    ? t(`category.${category.id}` as TranslationKey)
    : category?.name || t("category.other");

export function CategoryPicker({ categories, value, onChange, recentIds = [] }: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  recentIds?: string[];
}) {
  const { t } = useI18n();
  const ordered = [
    ...recentIds.map((id) => categories.find((category) => category.id === id))
      .filter((category): category is Category => Boolean(category)),
    ...categories.filter((category) => !recentIds.includes(category.id)),
  ];
  return (
    <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
      {ordered.map((category) => (
        <button
          type="button"
          key={category.id}
          aria-label={`${t("expense.category")} ${categoryName(category, t)}`}
          onClick={() => onChange(category.id)}
          style={value === category.id ? { backgroundColor: getCategorySoftColor(category), borderColor: getCategoryBorderColor(category), boxShadow: `inset 0 0 0 1px ${getCategoryBorderColor(category)}` } : undefined}
          className={`relative flex min-h-[68px] min-w-0 flex-col items-center justify-center rounded-2xl border px-1 py-2 transition ${value === category.id ? "scale-[1.03]" : "border-black/5 bg-[#f3f6f3]"}`}
        >
          <span className="text-[27px] leading-none">{categoryEmoji(category)}</span>
          <span className="mt-1 max-w-full truncate text-[10px] font-semibold text-[#53655c]">{categoryName(category, t)}</span>
          {value === category.id && <span style={{ backgroundColor: getCategoryColor(category) }} className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full text-[10px] text-white">✓</span>}
        </button>
      ))}
    </div>
  );
}

export function QuickExpenseForm({
  categories,
  expense,
  initialCategoryId,
  source = "manual",
  purchaseId,
  close,
  save,
  remove,
  embedded = false,
  onSaved,
  recentCategoryIds = [],
  onScanReceipt,
  onManageCategories,
}: {
  categories: Category[];
  expense?: Expense;
  initialCategoryId?: string;
  source?: Expense["source"];
  purchaseId?: string;
  close?: () => void;
  save: (expense: Expense) => void;
  remove?: () => void;
  embedded?: boolean;
  onSaved?: () => void;
  recentCategoryIds?: string[];
  onScanReceipt?: () => void;
  onManageCategories?: () => void;
}) {
  const { t } = useI18n();
  const amountInput = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [description, setDescription] = useState(expense?.description || "");
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId || initialCategoryId || categories[0]?.id || "other",
  );
  const [date, setDate] = useState(
    (expense?.date || new Date().toISOString()).slice(0, 10),
  );
  const saving = useRef(false);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const numeric = parseAmount(amount);
    if (!numeric || !description.trim() || saving.current) return;
    saving.current = true;
    const at = new Date(),
      expenseDate = new Date(
        `${date}T${expense?.time || at.toTimeString().slice(0, 8)}`,
      ).toISOString();
    save({
      id: expense?.id || uid(),
      description: description.trim(),
      amount: numeric,
      categoryId,
      date: expenseDate,
      time: expense?.time || at.toTimeString().slice(0, 8),
      source: expense?.source || source,
      purchaseId: expense?.purchaseId || purchaseId,
      createdAt: expense?.createdAt || at.toISOString(),
      updatedAt: at.toISOString(),
    });
    if (embedded) {
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      saving.current = false;
      onSaved?.();
      requestAnimationFrame(() => amountInput.current?.focus());
    }
  };
  const form = (
    <form
        onSubmit={submit}
        className={`${embedded ? "space-y-5 rounded-[28px] border border-black/[.04] bg-white p-5" : "sheet max-h-[92vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-[30px] bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[30px]"}`}
      >
        {!embedded && <div className="flex items-center gap-2">
          <h2 className="flex-1 text-xl font-bold">
            {expense ? t("expense.editTitle") : t("expense.title")}
          </h2>
          {remove && (
            <button
              type="button"
              onClick={remove}
              aria-label={t("expense.delete")}
              title={t("expense.delete")}
              className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-600"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="rounded-full bg-[#f1f4f2] p-2"
          >
            <X size={19} />
          </button>
        </div>}
        <label className="block">
          <b className="mb-2 block text-sm">{t("expense.amount")}</b>
          <input
            ref={amountInput}
            autoFocus
            inputMode="numeric"
            enterKeyHint="next"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="min-h-16 w-full rounded-2xl bg-[#f3f6f3] p-4 text-3xl font-bold outline-none focus:ring-2 focus:ring-[#176b46]"
          />
        </label>
        <label className="block">
          <b className="mb-2 block text-sm">{t("expense.description")}</b>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("expense.descriptionPlaceholder")}
            className="min-h-14 w-full rounded-2xl bg-[#f3f6f3] p-4 outline-none focus:ring-2 focus:ring-[#176b46]"
          />
        </label>
        <div>
          <div className="mb-2 flex items-center">
            <b className="flex-1 text-sm">{t("expense.category")}</b>
            {onManageCategories && <button type="button" onClick={onManageCategories} className="min-h-9 rounded-xl px-2 text-xs font-semibold text-[#176b46]">+ {t("expense.manage")}</button>}
          </div>
          <CategoryPicker
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            recentIds={recentCategoryIds}
          />
        </div>
        {onScanReceipt && categoryId === "supermarket" && !expense && (
          <div className="sheet rounded-2xl border border-[#176b46]/20 bg-[#e5f3ea] p-3">
            <p className="mb-2 text-sm font-semibold text-[#176b46]">{t("expense.registerHow")}</p>
            <button type="button" onClick={onScanReceipt} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-[#176b46] shadow-sm">
              <Camera size={22} /><span><b className="block">{t("expense.scanTicket")}</b><small className="text-[#718078]">{t("expense.scanHint")}</small></span>
            </button>
            <p className="mt-2 text-xs text-[#718078]">{t("expense.manualHint")}</p>
          </div>
        )}
        <label className="block">
          <b className="mb-2 block text-sm">{t("expense.date")}</b>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl bg-[#f3f6f3] p-3"
          />
        </label>
        <button className="min-h-14 w-full rounded-2xl bg-[#176b46] px-5 font-bold text-white">
          {t("expense.save")}
        </button>
      </form>
  );
  if (embedded) return form;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center">
      {form}
    </div>
  );
}
export function CategoryManager({
  categories,
  usedCategoryIds,
  close,
  onChange,
}: {
  categories: Category[];
  usedCategoryIds: Set<string>;
  close: () => void;
  onChange: (categories: Category[]) => void;
}) {
  const { t } = useI18n();
  const nextAvailableColor = (source: Category[]) => categoryPalette.find((candidate) => !source.some((category) => getCategoryColor(category).toLowerCase() === candidate.toLowerCase())) ?? categoryPalette[source.length % categoryPalette.length];
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState<string>(() => nextAvailableColor(categories));
  const [creating, setCreating] = useState(false);
  const [editingEmojiId, setEditingEmojiId] = useState<string>();
  const [editingColorId, setEditingColorId] = useState<string>();
  const categoriesWithoutOther = categories.filter((category) => category.id !== "other");
  const [dragOrder, setDragOrder] = useState<Category[] | null>(null);
  const orderedCategories = dragOrder || categoriesWithoutOther;
  const orderedRef = useRef(orderedCategories);
  const [draggingId, setDraggingId] = useState<string>();
  const otherCategory = categories.find((category) => category.id === "other");
  const drag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const id = event.currentTarget.dataset.dragId;
    if (!id) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    orderedRef.current = orderedCategories;
    setDragOrder(orderedCategories);
    setDraggingId(id);
  };
  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingId) return;
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-category-id]");
    const overId = row?.dataset.categoryId;
    if (!overId || overId === draggingId) return;
    const current = orderedRef.current;
    const from = current.findIndex((category) => category.id === draggingId);
    const to = current.findIndex((category) => category.id === overId);
    if (from < 0 || to < 0) return;
    const reordered = [...current];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    orderedRef.current = reordered;
    setDragOrder(reordered);
  };
  const finishDrag = () => {
    if (!draggingId) return;
    setDraggingId(undefined);
    const reordered = orderedRef.current;
    onChange(otherCategory ? [...reordered, otherCategory] : reordered);
    setDragOrder(null);
  };
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!icon) return;
    const category = { id: `custom-${uid()}`, name: clean, emoji: icon, icon, color };
    onChange(otherCategory
      ? [...orderedCategories, category, otherCategory]
      : [...orderedCategories, category]);
    setName("");
    setIcon("");
    setColor(nextAvailableColor([...categories, category]));
    setCreating(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center">
      <section className="sheet max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-[30px] bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[30px]">
        <div className="mb-5 flex">
          <h2 className="flex-1 text-xl font-bold">{t("finance.manageCategories")}</h2>
          <button onClick={close} className="grid h-11 w-11 place-items-center rounded-full bg-[#f1f4f2]">
            <X />
          </button>
        </div>
        <div className="space-y-2">
          {orderedCategories.map((category) => (
            <div
              key={category.id}
              data-category-id={category.id}
              className={`flex min-h-[60px] items-center gap-2 rounded-2xl p-3 transition ${draggingId === category.id ? "scale-[1.02] bg-[#e5f3ea] shadow-lg" : "bg-[#f5f7f5]"}`}
            >
              <button
                type="button"
                data-drag-id={category.id}
                onPointerDown={drag}
                onPointerMove={moveDrag}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                aria-label={`Arrastrar ${category.name}`}
                className="grid h-11 w-9 shrink-0 touch-none place-items-center rounded-xl text-[#718078] active:bg-white"
              >
                <GripVertical size={21} />
              </button>
              <button
                type="button"
                onClick={() => setEditingEmojiId(category.id)}
                aria-label={`Cambiar emoji de ${category.name || categoryEmoji(category)}`}
                style={{ backgroundColor: getCategorySoftColor(category) }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl"
              >
                {categoryEmoji(category)}
              </button>
              <input
                value={category.name || ""}
                onChange={(e) =>
                  onChange(
                    categories.map((c) =>
                      c.id === category.id ? { ...c, name: e.target.value } : c,
                    ),
                  )
                }
                className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
              />
              <button type="button" onClick={() => { setEditingColorId(category.id); setEditingEmojiId(undefined); }} aria-label={`${t("categoryManager.changeColor")} ${category.name || categoryEmoji(category)}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl">
                <span className="h-5 w-5 rounded-full ring-2 ring-white/70" style={{ backgroundColor: getCategoryColor(category) }}/>
              </button>
              <button
                disabled={usedCategoryIds.has(category.id)}
                title={
                  usedCategoryIds.has(category.id)
                    ? "Esta categoría tiene gastos asociados"
                    : "Eliminar"
                }
                onClick={() =>
                  onChange(categories.filter((c) => c.id !== category.id))
                }
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-red-500 disabled:opacity-25"
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        {editingColorId && (() => {
          const category = categories.find((item) => item.id === editingColorId);
          if (!category) return null;
          return <CategoryColorEditor
            category={category}
            close={() => setEditingColorId(undefined)}
            change={(nextColor) => onChange(categories.map((item) => item.id === category.id ? { ...item, color: nextColor } : item))}
          />;
        })()}
        {editingEmojiId && <div className="mt-4"><b className="mb-2 block">{t("categoryManager.changeEmoji")}</b><EmojiGrid value={categoryEmoji(categories.find((category) => category.id === editingEmojiId))} select={(emoji) => { onChange(categories.map((category) => category.id === editingEmojiId ? { ...category, emoji, icon: emoji } : category)); setEditingEmojiId(undefined); }} /></div>}
        {!creating ? (
          <button onClick={() => setCreating(true)} className="mt-5 min-h-14 w-full rounded-2xl bg-[#176b46] px-5 font-bold text-white">+ {t("categoryManager.newCategory")}</button>
        ) : (
          <form onSubmit={add} className="mt-5 space-y-4 rounded-3xl bg-[#f5f7f5] p-4">
            <div><b className="mb-2 block">{t("categoryManager.chooseEmoji")}</b><EmojiGrid value={icon} select={setIcon} /></div>
            <label className="block"><span className="mb-2 block text-sm font-semibold">{t("list.name")} <span className="font-normal text-[#718078]">({t("recipes.optional")})</span></span><input value={name} onChange={(event) => setName(event.target.value)} className="min-h-12 w-full rounded-2xl bg-white px-4 outline-none" /></label>
            <div><span className="mb-2 block text-sm font-semibold">{t("categoryManager.color")}</span><ColorPalette value={color} select={setColor}/></div>
            {icon && orderedCategories.some((category) => categoryEmoji(category) === icon && !category.name && !name.trim()) && <p className="text-sm text-amber-700">{t("categoryManager.duplicateEmoji")}</p>}
            <button disabled={!icon} className="min-h-14 w-full rounded-2xl bg-[#176b46] px-5 font-bold text-white disabled:opacity-40">{t("categoryManager.createCategory")}</button>
          </form>
        )}
        <p className="mt-3 text-xs text-[#718078]">
          {t("categoryManager.orderHint")}
        </p>
      </section>
    </div>
  );
}

function CategoryColorEditor({ category, close, change }: { category: Category; close: () => void; change: (color: string) => void }) {
  const { t } = useI18n();
  const color = getCategoryColor(category);
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const lowContrast = (red * 299 + green * 587 + blue * 114) / 1000 < 70;
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 sm:items-center" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section role="dialog" aria-modal="true" className="theme-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
      <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><h2 className="text-xl font-bold">{t("categoryManager.chartColor")}</h2><span className="text-xs text-[#718078]">{color}</span></div><button type="button" onClick={close} aria-label={t("common.close")} className="grid h-11 w-11 place-items-center rounded-full bg-[#f1f4f2]"><X size={18} /></button></div>
      <div className="mt-4 rounded-2xl bg-[#f5f7f5] p-3"><span className="text-xs font-semibold text-[#718078]">{t("categoryManager.preview")}</span><div className="mt-2 flex items-center gap-2 font-bold"><span className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} /><span className="text-xl">{categoryEmoji(category)}</span><span className="truncate">{category.name || t("category.other")}</span></div></div>
      <div className="mt-4"><span className="mb-2 block text-sm font-semibold">{t("categoryManager.suggestedColors")}</span><ColorPalette value={color} select={change} /></div>
      <label className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl bg-[#f5f7f5] px-4 font-semibold"><span className="min-w-0 flex-1">{t("categoryManager.chooseOther")}</span><input type="color" value={color} onChange={(event) => { if (validCategoryHex.test(event.target.value)) change(event.target.value.toUpperCase()); }} className="h-11 w-16 cursor-pointer rounded-lg border-0 bg-transparent" /></label>
      {lowContrast && <p className="mt-2 text-sm font-semibold text-amber-700">{t("categoryManager.lowContrast")}</p>}
      <button type="button" onClick={() => change(getDefaultCategoryColor(category.id))} className="mt-3 min-h-12 w-full rounded-2xl border border-black/10 px-3 font-semibold text-[#176b46]">{t("categoryManager.restoreDefault")}</button>
      <button type="button" onClick={close} className="mt-3 min-h-14 w-full rounded-2xl bg-[#176b46] px-4 font-bold text-white">{t("common.save")}</button>
    </section>
  </div>;
}

function EmojiGrid({ value, select }: { value: string; select: (emoji: string) => void }) {
  const { t } = useI18n();
  const [custom, setCustom] = useState("");
  return (
    <div className="space-y-2 rounded-2xl bg-white p-2">
      <div className="grid grid-cols-7 gap-1.5">
        {commonEmojis.map((emoji) => (
          <button type="button" key={emoji} onClick={() => select(emoji)} aria-label={`Elegir emoji ${emoji}`} className={`grid aspect-square min-h-10 place-items-center rounded-xl text-2xl ${value === emoji ? "bg-[#dcefe4] ring-2 ring-[#176b46]" : "active:bg-[#f1f4f2]"}`}>{emoji}</button>
        ))}
      </div>
      <label className="flex items-center gap-2 border-t border-black/5 pt-2">
        <span className="flex-1 text-xs font-semibold text-[#718078]">{t("categoryManager.moreEmojis")}</span>
        <input
          value={custom}
          onChange={(event) => {
            const emoji = event.target.value;
            setCustom(emoji);
            if (emoji.trim()) select(emoji.trim());
          }}
          inputMode="text"
          placeholder="🙂"
          aria-label={t("categoryManager.customEmoji")}
          className="h-11 w-16 rounded-xl bg-[#f3f6f3] text-center text-2xl outline-none"
        />
      </label>
    </div>
  );
}

function ColorPalette({ value, select }: { value: string; select: (color: string) => void }) {
  const { t } = useI18n();
  return <div className="flex flex-wrap gap-2" role="group" aria-label={t("categoryManager.color")}>{categoryPalette.map((color) => <button key={color} type="button" onClick={() => select(color)} aria-label={t("categoryManager.chooseColor", { color })} aria-pressed={value.toLowerCase() === color.toLowerCase()} className="grid h-11 w-11 place-items-center rounded-full"><span className={`h-7 w-7 rounded-full ${value.toLowerCase() === color.toLowerCase() ? "ring-2 ring-offset-2 ring-[#176b46]" : ""}`} style={{ backgroundColor: color }}/></button>)}</div>;
}
