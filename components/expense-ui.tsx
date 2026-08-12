"use client";
import { useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
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

export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {categories.map((category) => (
        <button
          type="button"
          key={category.id}
          onClick={() => onChange(category.id)}
          className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold ${value === category.id ? "border-[#176b46] bg-[#e5f3ea] text-[#176b46]" : "border-black/5 bg-[#f5f7f5]"}`}
        >
          <span className="mr-1.5">{category.icon || "●"}</span>
          {category.name}
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
}: {
  categories: Category[];
  expense?: Expense;
  initialCategoryId?: string;
  source?: Expense["source"];
  purchaseId?: string;
  close: () => void;
  save: (expense: Expense) => void;
  remove?: () => void;
}) {
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
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center">
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-[30px] bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[30px]"
      >
        <div className="flex items-center">
          <h2 className="flex-1 text-xl font-bold">
            {expense ? "Editar gasto" : "Registrar gasto"}
          </h2>
          <button
            type="button"
            onClick={close}
            className="rounded-full bg-[#f1f4f2] p-2"
          >
            <X size={19} />
          </button>
        </div>
        <label className="block">
          <b className="mb-2 block text-sm">Monto</b>
          <input
            autoFocus
            inputMode="numeric"
            enterKeyHint="next"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$ 0"
            className="w-full rounded-2xl bg-[#f3f6f3] p-4 text-3xl font-bold outline-none focus:ring-2 focus:ring-[#176b46]"
          />
        </label>
        <label className="block">
          <b className="mb-2 block text-sm">Descripción</b>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. Uber al centro"
            className="w-full rounded-2xl bg-[#f3f6f3] p-4 outline-none focus:ring-2 focus:ring-[#176b46]"
          />
        </label>
        <div>
          <b className="mb-2 block text-sm">Categoría</b>
          <CategoryPicker
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />
        </div>
        <label className="block">
          <b className="mb-2 block text-sm">Fecha</b>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl bg-[#f3f6f3] p-3"
          />
        </label>
        <button className="w-full rounded-2xl bg-[#176b46] py-4 font-bold text-white">
          Guardar gasto
        </button>
        {remove && (
          <button
            type="button"
            onClick={remove}
            className="flex w-full justify-center gap-2 py-2 text-sm font-semibold text-red-600"
          >
            <Trash2 size={17} /> Eliminar gasto
          </button>
        )}
      </form>
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
  const [icon, setIcon] = useState("🏷️");
  const [color, setColor] = useState("#4f8f73");
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    onChange([
      ...categories,
      { id: `custom-${uid()}`, name: clean, icon: icon.trim() || "🏷️", color },
    ]);
    setName("");
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center">
      <section className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-[30px] bg-white p-5 sm:rounded-[30px]">
        <div className="mb-5 flex">
          <h2 className="flex-1 text-xl font-bold">Administrar categorías</h2>
          <button onClick={close}>
            <X />
          </button>
        </div>
        <div className="space-y-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center gap-2 rounded-2xl bg-[#f5f7f5] p-3"
            >
              <input
                value={category.icon || ""}
                onChange={(e) =>
                  onChange(
                    categories.map((c) =>
                      c.id === category.id ? { ...c, icon: e.target.value } : c,
                    ),
                  )
                }
                className="w-10 bg-transparent text-center"
              />
              <input
                value={category.name}
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
                disabled={
                  usedCategoryIds.has(category.id) || category.id === "other"
                }
                title={
                  usedCategoryIds.has(category.id)
                    ? "Esta categoría tiene gastos asociados"
                    : "Eliminar"
                }
                onClick={() =>
                  onChange(categories.filter((c) => c.id !== category.id))
                }
                className="text-red-500 disabled:opacity-25"
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={add}
          className="mt-5 grid grid-cols-[3rem_1fr_3rem] gap-2"
        >
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="rounded-xl bg-[#f3f6f3] p-2 text-center"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva categoría"
            className="rounded-xl bg-[#f3f6f3] p-3 outline-none"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-11"
          />
          <button className="col-span-3 rounded-2xl bg-[#176b46] py-3 font-bold text-white">
            Agregar categoría
          </button>
        </form>
        <p className="mt-3 text-xs text-[#718078]">
          Las categorías con gastos asociados no se pueden eliminar hasta
          reclasificar esos gastos.
        </p>
      </section>
    </div>
  );
}
