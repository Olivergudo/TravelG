"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BadgeDollarSign,
  MoreHorizontal,
  Plus,
  ListChecks,
  ReceiptText,
} from "lucide-react";
import { ShoppingV2 } from "./shopping-v2";
import { ShoppingList } from "./shopping-list";
import { ReceiptScanner } from "./receipt-scanner";
import { categoryEmoji, CategoryManager, formatMoney, QuickExpenseForm } from "./expense-ui";
import { useAppData } from "@/hooks/use-app-data";
import type { AppData, Expense } from "@/lib/types";
import { deleteExpense, saveExpense } from "@/lib/expense-sync";
import { FinanceCharts, FinanceHeroDonut } from "./finance-charts";
import { getCategoryColor, getCategorySoftColor } from "@/lib/category-colors";
import { AccountAccess } from "./account-access";
import { AnonymousLinkScreen, EmailAccessScreen, UpdatePasswordScreen } from "./email-access-screen";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
type Update = (fn: (data: AppData) => AppData) => void;

export function AppShell() {
  const { data, update, ready, reload } = useAppData();
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [tab, setTab] = useState<"finances" | "list" | "shopping">("finances");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [addingExpense, setAddingExpense] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    const recoveryTimer = new URLSearchParams(window.location.search).get("recovery") === "1"
      ? window.setTimeout(() => setRecoveringPassword(true), 0)
      : undefined;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true);
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => {
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (authUser) reload().catch(() => undefined);
  }, [authUser, reload]);
  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithDevice = (event?: MediaQueryListEvent) => {
      setTheme((event?.matches ?? colorScheme.matches) ? "dark" : "light");
    };

    syncWithDevice();
    colorScheme.addEventListener("change", syncWithDevice);
    localStorage.removeItem("gasto-listo-theme");

    return () => colorScheme.removeEventListener("change", syncWithDevice);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.appTheme = theme;
  }, [theme]);
  if (!authReady || (authUser && !ready))
    return (
      <main className="grid min-h-screen place-items-center text-[#708078]">
        Cargando…
      </main>
    );
  if (isSupabaseConfigured && !authUser) return <EmailAccessScreen />;
  if (recoveringPassword) return <UpdatePasswordScreen completed={() => setRecoveringPassword(false)} />;
  if (authUser?.is_anonymous) return <AnonymousLinkScreen />;
  return (
    <main data-theme={theme} className="theme-root mx-auto min-h-dvh w-full min-w-0 max-w-2xl bg-[#f3f6f3] safe-bottom sm:shadow-[0_0_40px_rgba(23,61,45,.08)]">
      {tab === "finances" ? (
        <Finances data={data} update={update} dark={theme === "dark"} reload={reload} />
      ) : tab === "list" ? (
        <ShoppingList data={data} update={update} />
      ) : (
        <ShoppingV2
          data={data}
          update={update}
          showFinances={() => setTab("finances")}
        />
      )}
      <nav aria-label="Navegación principal" className="bottom-nav fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full min-w-0 max-w-2xl grid-cols-3 border-t border-black/[.06] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <Nav
          active={tab === "finances"}
          click={() => setTab("finances")}
          icon={<BadgeDollarSign />}
          label="Finanzas"
        />
        <Nav active={tab === "list"} click={() => setTab("list")} icon={<ListChecks />} label="Lista" />
        <Nav active={tab === "shopping"} click={() => setTab("shopping")} icon={<ReceiptText />} label="Compras" />
        <button
          type="button"
          onClick={() => setAddingExpense(true)}
          aria-label="Nuevo gasto"
          className="tap absolute left-1/2 -top-5 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[20px] border-4 border-[#f3f6f3] bg-[#176b46] text-white shadow-[0_8px_22px_rgba(23,107,70,.32)] transition-transform duration-150"
        >
          <Plus size={30} strokeWidth={2.5} />
        </button>
      </nav>
      {addingExpense && (
        <QuickExpenseForm
          categories={data.categories}
          close={() => setAddingExpense(false)}
          save={(expense) => {
            update((current) => saveExpense(current, expense));
            setAddingExpense(false);
            setTab("finances");
            setSavedFeedback(true);
            window.setTimeout(() => setSavedFeedback(false), 2200);
          }}
          onScanReceipt={() => setScanningReceipt(true)}
          onManageCategories={() => setManagingCategories(true)}
        />
      )}
      {scanningReceipt && (
        <ReceiptScanner
          data={data}
          update={update}
          close={() => setScanningReceipt(false)}
          completed={() => {
            setScanningReceipt(false);
            setAddingExpense(false);
            setTab("finances");
            setSavedFeedback(true);
            window.setTimeout(() => setSavedFeedback(false), 2200);
          }}
        />
      )}
      {managingCategories && (
        <CategoryManager
          categories={data.categories}
          usedCategoryIds={new Set(data.expenses.map((expense) => expense.categoryId))}
          close={() => setManagingCategories(false)}
          onChange={(categories) => update((current) => ({ ...current, categories }))}
        />
      )}
      {savedFeedback && (
        <div role="status" className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#173d2d] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          Gasto guardado
        </div>
      )}
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
      className={`flex min-h-20 flex-1 flex-col items-center justify-center gap-1 pt-4 text-[12px] font-semibold transition-colors duration-150 ${active ? "text-[#176b46]" : "text-[#718078]"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Finances({ data, update, dark, reload }: { data: AppData; update: Update; dark: boolean; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<Expense>();
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
        <AccountAccess onAccountChanged={() => { reload().catch(() => undefined); }} />
      </header>
      <section className="mx-4 min-w-0 rounded-[30px] bg-[#173d2d] p-6 text-white shadow-[0_10px_30px_rgba(23,61,45,.12)]">
        <FinanceHeroDonut expenses={month} categories={data.categories} total={total} />
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
          <span className="text-[13px] text-white/65">Esta semana <b className="mt-1 block text-base text-white">{formatMoney(week)}</b></span>
          <span className="text-[13px] text-white/65">Movimientos <b className="mt-1 block text-base text-white">{month.length} gastos</b></span>
        </div>
      </section>
      <div className="mt-5 w-full min-w-0 max-w-full space-y-6 px-4">
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
                <span style={{ backgroundColor: getCategorySoftColor(category) }} className="mr-3 grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl">{categoryEmoji(category)}</span>
                <span className="min-w-0 flex-1 pr-3">
                  {category.name && <b className="block truncate">{category.name}</b>}
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#dfe8e2]">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(5, total / largestCategoryTotal * 100)}%`, backgroundColor: getCategoryColor(category) }} />
                  </span>
                </span>
                <b className="shrink-0 whitespace-nowrap text-sm">{formatMoney(total)}</b>
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
                  <span style={{ backgroundColor: getCategorySoftColor(c) }} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl">{categoryEmoji(c)}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">{e.description}</b>
                    <small className="mt-1 block truncate text-[13px] text-[#718078]">
                      {c?.name ? `${c.name} · ` : ""}
                      {new Date(e.date).toLocaleDateString("es-CL")}
                    </small>
                  </span>
                  <b className="shrink-0 whitespace-nowrap text-sm">{formatMoney(e.amount)}</b>
                  <span className="grid h-11 w-8 shrink-0 place-items-center" aria-hidden="true"><MoreHorizontal size={20} /></span>
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
      {editing && (
        <QuickExpenseForm
          categories={data.categories}
          expense={editing}
          close={() => {
            setEditing(undefined);
          }}
          save={save}
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
