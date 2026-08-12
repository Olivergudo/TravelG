"use client";
import { useRef, useState } from "react";
import { Camera, GripVertical, Trash2, X } from "lucide-react";
import type { Category, Expense } from "@/lib/types";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const parseAmount = (value: string) => Number(value.replace(/\D/g, "")) || 0;
export const formatMoney = (value = 0) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);

const commonEmojis = [
  "🚗", "🚕", "🚌", "🚇", "✈️", "⛽", "🚲", "🍽️", "🍔", "🍕", "☕", "🍺",
  "🍸", "🛒", "🛍️", "👕", "👟", "📱", "💻", "🏠", "💡", "🧹", "🪑", "🔧",
  "🎮", "🎬", "🎵", "🎟️", "⚽", "💊", "🏥", "🩺", "🎁", "💸", "📦", "⭐", "❤️",
];

export const categoryEmoji = (category?: Category) =>
  category?.emoji || category?.icon || "💸";

export function CategoryPicker({ categories, value, onChange, recentIds = [] }: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  recentIds?: string[];
}) {
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
          aria-label={`Categoría ${category.name || categoryEmoji(category)}`}
          onClick={() => onChange(category.id)}
          className={`relative flex min-h-[68px] min-w-0 flex-col items-center justify-center rounded-2xl border px-1 py-2 transition ${value === category.id ? "scale-[1.03] border-[#176b46] bg-[#e5f3ea] shadow-[inset_0_0_0_1px_#176b46]" : "border-black/5 bg-[#f3f6f3]"}`}
        >
          <span className="text-[27px] leading-none">{categoryEmoji(category)}</span>
          {category.name && <span className="mt-1 max-w-full truncate text-[10px] font-semibold text-[#53655c]">{category.name}</span>}
          {value === category.id && <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#176b46] text-[10px] text-white">✓</span>}
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
            {expense ? "Gasto" : "Registrar gasto"}
          </h2>
          {remove && (
            <button
              type="button"
              onClick={remove}
              aria-label="Eliminar gasto"
              title="Eliminar gasto"
              className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-600"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="rounded-full bg-[#f1f4f2] p-2"
          >
            <X size={19} />
          </button>
        </div>}
        <label className="block">
          <b className="mb-2 block text-sm">Monto</b>
          <input
            ref={amountInput}
            autoFocus
            inputMode="numeric"
            enterKeyHint="next"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$ 0"
            className="min-h-16 w-full rounded-2xl bg-[#f3f6f3] p-4 text-3xl font-bold outline-none focus:ring-2 focus:ring-[#176b46]"
          />
        </label>
        <label className="block">
          <b className="mb-2 block text-sm">Descripción</b>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. Uber al centro"
            className="min-h-14 w-full rounded-2xl bg-[#f3f6f3] p-4 outline-none focus:ring-2 focus:ring-[#176b46]"
          />
        </label>
        <div>
          <div className="mb-2 flex items-center">
            <b className="flex-1 text-sm">Categoría</b>
            {onManageCategories && <button type="button" onClick={onManageCategories} className="min-h-9 rounded-xl px-2 text-xs font-semibold text-[#176b46]">+ Administrar</button>}
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
            <p className="mb-2 text-sm font-semibold text-[#176b46]">¿Cómo quieres registrarlo?</p>
            <button type="button" onClick={onScanReceipt} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-[#176b46] shadow-sm">
              <Camera size={22} /><span><b className="block">Escanear ticket</b><small className="text-[#718078]">Detecta productos y total</small></span>
            </button>
            <p className="mt-2 text-xs text-[#718078]">También puedes completar el formulario manualmente.</p>
          </div>
        )}
        <label className="block">
          <b className="mb-2 block text-sm">Fecha</b>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl bg-[#f3f6f3] p-3"
          />
        </label>
        <button className="min-h-14 w-full rounded-2xl bg-[#176b46] px-5 font-bold text-white">
          Guardar gasto
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
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#4f8f73");
  const [creating, setCreating] = useState(false);
  const [editingEmojiId, setEditingEmojiId] = useState<string>();
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
    setCreating(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center">
      <section className="sheet max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-[30px] bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[30px]">
        <div className="mb-5 flex">
          <h2 className="flex-1 text-xl font-bold">Administrar categorías</h2>
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
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-2xl"
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
              <input
                type="color"
                value={category.color}
                onChange={(e) =>
                  onChange(
                    categories.map((c) =>
                      c.id === category.id
                        ? { ...c, color: e.target.value }
                        : c,
                    ),
                  )
                }
                className="h-8 w-8"
              />
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
        {editingEmojiId && <div className="mt-4"><b className="mb-2 block">Cambiar emoji</b><EmojiGrid value={categoryEmoji(categories.find((category) => category.id === editingEmojiId))} select={(emoji) => { onChange(categories.map((category) => category.id === editingEmojiId ? { ...category, emoji, icon: emoji } : category)); setEditingEmojiId(undefined); }} /></div>}
        {!creating ? (
          <button onClick={() => setCreating(true)} className="mt-5 min-h-14 w-full rounded-2xl bg-[#176b46] px-5 font-bold text-white">+ Nueva categoría</button>
        ) : (
          <form onSubmit={add} className="mt-5 space-y-4 rounded-3xl bg-[#f5f7f5] p-4">
            <div><b className="mb-2 block">Elige un emoji</b><EmojiGrid value={icon} select={setIcon} /></div>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Nombre <span className="font-normal text-[#718078]">(opcional)</span></span><input value={name} onChange={(event) => setName(event.target.value)} className="min-h-12 w-full rounded-2xl bg-white px-4 outline-none" /></label>
            <div className="flex items-center gap-3"><span className="text-sm font-semibold">Color <span className="font-normal text-[#718078]">(opcional)</span></span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-11 w-11" /></div>
            {icon && orderedCategories.some((category) => categoryEmoji(category) === icon && !category.name && !name.trim()) && <p className="text-sm text-amber-700">Ya existe una categoría con este emoji.</p>}
            <button disabled={!icon} className="min-h-14 w-full rounded-2xl bg-[#176b46] px-5 font-bold text-white disabled:opacity-40">Crear categoría</button>
          </form>
        )}
        <p className="mt-3 text-xs text-[#718078]">
          Mantén presionado el asa y arrastra para ordenar. Las primeras tres categorías aparecen en Finanzas. {" "}
          Las categorías con gastos asociados no se pueden eliminar hasta
          reclasificar esos gastos.
        </p>
      </section>
    </div>
  );
}

function EmojiGrid({ value, select }: { value: string; select: (emoji: string) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <div className="space-y-2 rounded-2xl bg-white p-2">
      <div className="grid grid-cols-7 gap-1.5">
        {commonEmojis.map((emoji) => (
          <button type="button" key={emoji} onClick={() => select(emoji)} aria-label={`Elegir emoji ${emoji}`} className={`grid aspect-square min-h-10 place-items-center rounded-xl text-2xl ${value === emoji ? "bg-[#dcefe4] ring-2 ring-[#176b46]" : "active:bg-[#f1f4f2]"}`}>{emoji}</button>
        ))}
      </div>
      <label className="flex items-center gap-2 border-t border-black/5 pt-2">
        <span className="flex-1 text-xs font-semibold text-[#718078]">Más emojis</span>
        <input
          value={custom}
          onChange={(event) => {
            const emoji = event.target.value;
            setCustom(emoji);
            if (emoji.trim()) select(emoji.trim());
          }}
          inputMode="text"
          placeholder="🙂"
          aria-label="Emoji personalizado"
          className="h-11 w-16 rounded-xl bg-[#f3f6f3] text-center text-2xl outline-none"
        />
      </label>
    </div>
  );
}
