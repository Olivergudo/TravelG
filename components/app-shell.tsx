"use client";
import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  MoreHorizontal,
  Moon,
  Plus,
  ShoppingBasket,
  Sun,
} from "lucide-react";
import { ShoppingV2 } from "./shopping-v2";
import { ReceiptScanner } from "./receipt-scanner";
import { categoryEmoji, CategoryManager, formatMoney, QuickExpenseForm } from "./expense-ui";
import { useAppData } from "@/hooks/use-app-data";
import type { AppData, Expense } from "@/lib/types";
import { deleteExpense, saveExpense } from "@/lib/expense-sync";
import { FinanceCharts, FinanceHeroDonut } from "./finance-charts";
type Update = (fn: (data: AppData) => AppData) => void;

export function AppShell() {
  const { data, update, ready } = useAppData();
  const [tab, setTab] = useState<"finances" | "shopping">("finances");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = localStorage.getItem("gasto-listo-theme");
    const preferred = saved === "dark" || saved === "light"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const timer = window.setTimeout(() => setTheme(preferred), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const toggleTheme = () => setTheme((current) => {
    const next = current === "light" ? "dark" : "light";
    localStorage.setItem("gasto-listo-theme", next);
    return next;
  });
  if (!ready)
    return (
      <main className="grid min-h-screen place-items-center text-[#708078]">
        Cargando…
      </main>
    );
  return (
    <main data-theme={theme} className="theme-root mx-auto min-h-screen max-w-2xl bg-[#f3f6f3] safe-bottom sm:shadow-[0_0_40px_rgba(23,61,45,.08)]">
      {tab === "finances" ? (
        <Finances data={data} update={update} dark={theme === "dark"} toggleTheme={toggleTheme} />
      ) : (
        <ShoppingV2
          data={data}
          update={update}
          showFinances={() => setTab("finances")}
        />
      )}
      <nav className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-2xl -translate-x-1/2 border-t border-black/[.06] bg-white/95 px-5 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
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
      className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1.5 py-2 text-[13px] font-semibold ${active ? "text-[#176b46]" : "text-[#718078]"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Finances({ data, update, dark, toggleTheme }: { data: AppData; update: Update; dark: boolean; toggleTheme: () => void }) {
  const [editing, setEditing] = useState<Expense>();
  const [adding, setAdding] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
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
  const shown = [...data.expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  const totals = data.categories
    .map((category) => ({
      category,
      total: month
        .filter((e) => e.categoryId === category.id)
        .reduce((sum, e) => sum + e.amount, 0),
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
  const largestCategoryTotal = totals[0]?.total || 1;
  const save = (expense: Expense) => {
    update((current) => saveExpense(current, expense));
    setAdding(false);
    setEditing(undefined);
  };
  return (
    <>
      <header className="flex items-center px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex-1"><p className="text-[13px] font-bold uppercase tracking-[.18em] text-[#6f8278]">
          Tu dinero
        </p>
        <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-[-.02em]">Finanzas</h1>
        </div>
        <button onClick={toggleTheme} aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"} className="theme-card grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#176b46] shadow-sm">{dark ? <Sun size={21} /> : <Moon size={21} />}</button>
      </header>
      <section className="mx-4 rounded-[30px] bg-[#173d2d] p-6 text-white shadow-[0_10px_30px_rgba(23,61,45,.12)]">
        <FinanceHeroDonut expenses={month} categories={data.categories} total={total} />
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
          <span className="text-[13px] text-white/65">Esta semana <b className="mt-1 block text-base text-white">{formatMoney(week)}</b></span>
          <span className="text-[13px] text-white/65">Movimientos <b className="mt-1 block text-base text-white">{month.length} gastos</b></span>
        </div>
      </section>
      <div className="space-y-6 px-4">
        <button
          onClick={() => setAdding(true)}
          className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-5 text-base font-bold text-white shadow-[0_7px_18px_rgba(23,107,70,.16)] active:scale-[.99]"
        >
          <Plus /> Nuevo gasto
        </button>
        <FinanceCharts expenses={month} categories={data.categories} total={total} dark={dark} showDistribution={false} />
        <section>
          <h2 className="mb-3 text-xl font-bold tracking-[-.01em]">Por categoría</h2>
          <div className="overflow-hidden rounded-[26px] border border-black/[.04] bg-white">
            {totals.map(({ category, total }) => (
              <button
                key={category.id}
                type="button"
                className="flex min-h-[68px] w-full items-center border-b border-black/5 px-4 py-3 text-left last:border-0"
              >
                <span className="mr-3 text-2xl">{categoryEmoji(category)}</span>
                <span className="min-w-0 flex-1 pr-3">
                  {category.name && <b className="block truncate">{category.name}</b>}
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#dfe8e2]">
                    <span className="block h-full rounded-full bg-[#2f9d68]" style={{ width: `${Math.max(5, total / largestCategoryTotal * 100)}%` }} />
                  </span>
                </span>
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
          <h2 className="mb-3 text-xl font-bold tracking-[-.01em]">Movimientos recientes</h2>
          <div className="overflow-hidden rounded-[26px] border border-black/[.04] bg-white">
            {shown.map((e) => {
              const c = data.categories.find((x) => x.id === e.categoryId);
              return (
                <button
                  key={e.id}
                  onClick={() => setEditing(e)}
                  className="flex min-h-[76px] w-full items-center gap-3 border-b border-black/5 px-4 py-3.5 text-left last:border-0"
                >
                  <span className="text-2xl">{categoryEmoji(c)}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">{e.description}</b>
                    <small className="mt-1 block text-[13px] text-[#718078]">
                      {c?.name ? `${c.name} · ` : ""}
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
          onScanReceipt={() => setScanningReceipt(true)}
          onManageCategories={() => setManagingCategories(true)}
          remove={
            editing
              ? () => {
                  if (!window.confirm("¿Eliminar este gasto y su compra asociada?")) return;
                  update((current) => deleteExpense(current, editing.id));
                  setEditing(undefined);
                }
              : undefined
          }
        />
      )}
      {scanningReceipt && (
        <ReceiptScanner
          data={data}
          update={update}
          close={() => setScanningReceipt(false)}
          completed={() => {
            setAdding(false);
            setEditing(undefined);
          }}
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
