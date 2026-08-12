"use client";
import { useState } from "react";
import {
  BadgeDollarSign,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShoppingBasket,
} from "lucide-react";
import { ShoppingV2 } from "./shopping-v2";
import { CategoryManager, formatMoney, QuickExpenseForm } from "./expense-ui";
import { useAppData } from "@/hooks/use-app-data";
import type { AppData, Expense } from "@/lib/types";
type Update = (fn: (data: AppData) => AppData) => void;

export function AppShell() {
  const { data, update, ready } = useAppData();
  const [tab, setTab] = useState<"finances" | "shopping">("finances");
  if (!ready)
    return (
      <main className="grid min-h-screen place-items-center text-[#708078]">
        Cargando…
      </main>
    );
  return (
    <main className="mx-auto min-h-screen max-w-2xl safe-bottom">
      {tab === "finances" ? (
        <Finances data={data} update={update} />
      ) : (
        <ShoppingV2 data={data} update={update} />
      )}
      <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-2xl -translate-x-1/2 border-t border-black/5 bg-white/95 px-6 pb-[env(safe-area-inset-bottom)]">
        <Nav
          active={tab === "finances"}
          click={() => setTab("finances")}
          icon={<BadgeDollarSign />}
          label="Finanzas"
        />
        <Nav
          active={tab === "shopping"}
          click={() => setTab("shopping")}
          icon={<ShoppingBasket />}
          label="Compras"
        />
      </nav>
    </main>
  );
}
function Nav({
  active,
  click,
  icon,
  label,
}: {
  active: boolean;
  click: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={click}
      className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs ${active ? "text-[#176b46]" : "text-[#819087]"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Finances({ data, update }: { data: AppData; update: Update }) {
  const [editing, setEditing] = useState<Expense>();
  const [adding, setAdding] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const today = new Date();
  const month = data.expenses.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  });
  const total = month.reduce((n, e) => n + e.amount, 0);
  const week = month
    .filter((e) => Date.now() - new Date(e.date).getTime() < 604800000)
    .reduce((n, e) => n + e.amount, 0);
  const shown = data.expenses
    .filter(
      (e) =>
        (filter === "all" || e.categoryId === filter) &&
        e.description
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const totals = data.categories
    .map((category) => ({
      category,
      total: month
        .filter((e) => e.categoryId === category.id)
        .reduce((sum, e) => sum + e.amount, 0),
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
  const save = (expense: Expense) => {
    update((d) => ({
      ...d,
      expenses: editing
        ? d.expenses.map((e) => (e.id === expense.id ? expense : e))
        : [expense, ...d.expenses],
    }));
    setAdding(false);
    setEditing(undefined);
  };
  return (
    <>
      <header className="px-5 pb-4 pt-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#789087]">
          Tu dinero
        </p>
        <h1 className="text-2xl font-bold">Finanzas</h1>
      </header>
      <section className="mx-4 rounded-[28px] bg-[#173d2d] p-6 text-white">
        <p className="text-sm text-white/65">Gastado este mes</p>
        <p className="mt-2 text-4xl font-bold">{formatMoney(total)}</p>
        <div className="mt-5 flex gap-6 text-sm">
          <span>
            Esta semana <b>{formatMoney(week)}</b>
          </span>
          <span>
            <b>{month.length}</b> gastos
          </span>
        </div>
      </section>
      <div className="space-y-5 px-4">
        <button
          onClick={() => setAdding(true)}
          className="mt-4 flex w-full justify-center gap-2 rounded-2xl bg-[#176b46] py-4 font-bold text-white"
        >
          <Plus /> Nuevo gasto
        </button>
        <div className="flex justify-end">
          <button
            onClick={() => setManagingCategories(true)}
            className="flex items-center gap-1 text-xs font-semibold text-[#718078]"
          >
            <Settings2 size={15} /> Administrar categorías
          </button>
        </div>
        <div className="relative">
          <Search
            className="absolute left-4 top-3.5 text-[#829087]"
            size={19}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar gastos…"
            className="w-full rounded-2xl bg-white py-3 pl-11 pr-4 outline-none"
          />
        </div>
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === "all" ? "bg-[#173d2d] text-white" : "bg-white"}`}
            >
              Todos
            </button>
            {data.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === c.id ? "bg-[#173d2d] text-white" : "bg-white"}`}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
        <section>
          <h2 className="mb-3 text-lg font-bold">Por categoría</h2>
          <div className="overflow-hidden rounded-3xl bg-white">
            {totals.map(({ category, total }) => (
              <button
                key={category.id}
                onClick={() => setFilter(category.id)}
                className="flex w-full items-center border-b border-black/5 p-4 text-left last:border-0"
              >
                <span className="mr-3 text-xl">{category.icon}</span>
                <b className="flex-1">{category.name}</b>
                <b>{formatMoney(total)}</b>
              </button>
            ))}
            {!totals.length && (
              <p className="p-6 text-center text-sm text-[#718078]">
                Las categorías aparecerán cuando registres gastos.
              </p>
            )}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-bold">Movimientos</h2>
          <div className="overflow-hidden rounded-3xl bg-white">
            {shown.map((e) => {
              const c = data.categories.find((x) => x.id === e.categoryId);
              return (
                <button
                  key={e.id}
                  onClick={() => setEditing(e)}
                  className="flex w-full items-center gap-3 border-b border-black/5 p-4 text-left last:border-0"
                >
                  <span className="text-xl">{c?.icon || "•••"}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{e.description}</b>
                    <small className="text-[#809087]">
                      {c?.name || "Sin categoría"} ·{" "}
                      {new Date(e.date).toLocaleDateString("es-CL")}
                    </small>
                  </span>
                  <b>{formatMoney(e.amount)}</b>
                  <MoreHorizontal size={18} />
                </button>
              );
            })}
            {!shown.length && (
              <p className="p-8 text-center text-sm text-[#718078]">
                No hay movimientos para mostrar.
              </p>
            )}
          </div>
        </section>
      </div>
      {(adding || editing) && (
        <QuickExpenseForm
          categories={data.categories}
          expense={editing}
          close={() => {
            setAdding(false);
            setEditing(undefined);
          }}
          save={save}
          remove={
            editing
              ? () => {
                  update((d) => ({
                    ...d,
                    expenses: d.expenses.filter((e) => e.id !== editing.id),
                  }));
                  setEditing(undefined);
                }
              : undefined
          }
        />
      )}
      {managingCategories && (
        <CategoryManager
          categories={data.categories}
          usedCategoryIds={
            new Set(data.expenses.map((expense) => expense.categoryId))
          }
          close={() => setManagingCategories(false)}
          onChange={(categories) =>
            update((current) => ({ ...current, categories }))
          }
        />
      )}
    </>
  );
}
