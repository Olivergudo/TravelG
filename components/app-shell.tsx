"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BadgeDollarSign,
  Plus,
  ListChecks,
  ReceiptText,
  Refrigerator,
} from "lucide-react";
import { ShoppingV2 } from "./shopping-v2";
import { ShoppingList } from "./shopping-list";
import { ReceiptScanner } from "./receipt-scanner";
import {
  CategoryManager,
  formatMoney,
  QuickExpenseForm,
} from "./expense-ui";
import { useAppData } from "@/hooks/use-app-data";
import type { AppData } from "@/lib/types";
import { saveExpense } from "@/lib/expense-sync";
import { FinanceCharts } from "./finance-charts";
import { AccountAccess } from "./account-access";
import {
  AnonymousLinkScreen,
  EmailAccessScreen,
  UpdatePasswordScreen,
} from "./email-access-screen";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { FridgeScreen } from "./fridge-screen";
import { useUserPlan } from "@/hooks/use-user-plan";
import { canUseFeature } from "@/lib/features/plans";
export function AppShell() {
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const { data, update, ready, reload } = useAppData(authUser?.id);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [tab, setTab] = useState<"finances" | "list" | "fridge" | "shopping">(
    "finances",
  );
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [addingExpense, setAddingExpense] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const {
    user: entitlements,
    role,
    ready: planReady,
  } = useUserPlan(authUser?.id);
  const hasFridge = Boolean(
    entitlements && canUseFeature(entitlements, "fridge"),
  );
  const canScanReceipts = Boolean(
    entitlements && canUseFeature(entitlements, "receiptScanner"),
  );
  const canScanProducts = Boolean(
    entitlements && canUseFeature(entitlements, "barcodeScanner"),
  );
  const canCook = Boolean(
    entitlements && canUseFeature(entitlements, "aiRecipes"),
  );
  const showGlobalExpenseButton = tab === "finances";
  useEffect(() => {
    if (!supabase) return;
    const recoveryTimer =
      new URLSearchParams(window.location.search).get("recovery") === "1"
        ? window.setTimeout(() => setRecoveringPassword(true), 0)
        : undefined;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true);
        setAuthUser(session?.user ?? null);
        setAuthReady(true);
      },
    );
    return () => {
      if (recoveryTimer !== undefined) window.clearTimeout(recoveryTimer);
      listener.subscription.unsubscribe();
    };
  }, []);
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
  if (!authReady || (authUser && (!ready || !planReady)))
    return (
      <main className="grid min-h-screen place-items-center text-[#708078]">
        Cargando…
      </main>
    );
  if (isSupabaseConfigured && !authUser) return <EmailAccessScreen />;
  if (recoveringPassword)
    return (
      <UpdatePasswordScreen completed={() => setRecoveringPassword(false)} />
    );
  if (authUser?.is_anonymous) return <AnonymousLinkScreen />;
  return (
    <main
      data-theme={theme}
      className="theme-root mx-auto min-h-dvh w-full min-w-0 max-w-2xl bg-[#f3f6f3] safe-bottom sm:shadow-[0_0_40px_rgba(23,61,45,.08)]"
    >
      {tab === "finances" ? (
        <Finances
          data={data}
          reload={reload}
          admin={role === "admin"}
        />
      ) : tab === "list" ? (
        <ShoppingList data={data} update={update} />
      ) : tab === "fridge" && authUser ? (
        <FridgeScreen
          userId={authUser.id}
          data={data}
          update={update}
          canScanProducts={canScanProducts}
          canCook={canCook}
        />
      ) : (
        <ShoppingV2
          data={data}
          update={update}
          showFinances={() => setTab("finances")}
        />
      )}
      <nav
        aria-label="Navegación principal"
        className={`bottom-nav fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full min-w-0 max-w-2xl ${hasFridge ? "grid-cols-4" : "grid-cols-3"} border-t border-black/[.06] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl`}
      >
        <Nav
          active={tab === "finances"}
          click={() => setTab("finances")}
          icon={<BadgeDollarSign />}
          label="Finanzas"
        />
        <Nav
          active={tab === "list"}
          click={() => setTab("list")}
          icon={<ListChecks />}
          label="Lista"
        />
        {hasFridge && (
          <Nav
            active={tab === "fridge"}
            click={() => setTab("fridge")}
            icon={<Refrigerator />}
            label="Refrigerador"
          />
        )}
        <Nav
          active={tab === "shopping"}
          click={() => setTab("shopping")}
          icon={<ReceiptText />}
          label="Compras"
        />
        {showGlobalExpenseButton && (
          <button
            type="button"
            onClick={() => setAddingExpense(true)}
            aria-label="Nuevo gasto"
            className="tap absolute left-1/2 -top-7 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[20px] border-4 border-[#f3f6f3] bg-[#176b46] text-white shadow-[0_8px_22px_rgba(23,107,70,.32)] transition-transform duration-150"
          >
            <Plus size={30} strokeWidth={2.5} />
          </button>
        )}
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
          onScanReceipt={
            canScanReceipts ? () => setScanningReceipt(true) : undefined
          }
          onManageCategories={() => setManagingCategories(true)}
        />
      )}
      {scanningReceipt && canScanReceipts && (
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
          usedCategoryIds={
            new Set(data.expenses.map((expense) => expense.categoryId))
          }
          close={() => setManagingCategories(false)}
          onChange={(categories) =>
            update((current) => ({ ...current, categories }))
          }
        />
      )}
      {savedFeedback && (
        <div
          role="status"
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#173d2d] px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
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

function Finances({
  data,
  reload,
  admin,
}: {
  data: AppData;
  reload: () => Promise<void>;
  admin: boolean;
}) {
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
  return (
    <>
      <header className="flex items-center px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex-1">
          <p className="text-[13px] font-bold uppercase tracking-[.18em] text-[#6f8278]">
            Tu dinero
          </p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-[-.02em]">
            Finanzas
          </h1>
        </div>
        <AccountAccess
          admin={admin}
          onAccountChanged={() => {
            reload().catch(() => undefined);
          }}
        />
      </header>
      <section className="mx-4 min-w-0 rounded-[24px] border border-[#4fc187]/20 bg-[#101a14] px-5 py-4 text-white shadow-[0_8px_22px_rgba(0,0,0,.08)]">
        <p className="text-xs font-medium text-white/60">Gastado este mes</p>
        <p className="mt-1.5 truncate text-[clamp(1.75rem,8vw,2.25rem)] font-bold leading-none tracking-[-.035em]">{formatMoney(total)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
          <span className="text-xs text-white/60">
            Esta semana{" "}
            <b className="mt-0.5 block text-sm text-white">
              {formatMoney(week)}
            </b>
          </span>
          <span className="text-xs text-white/60">
            Movimientos{" "}
            <b className="mt-0.5 block text-sm text-white">
              {month.length} gastos
            </b>
          </span>
        </div>
      </section>
      <div className="mt-5 w-full min-w-0 max-w-full space-y-6 px-4">
        <FinanceCharts
          expenses={month}
          categories={data.categories}
          total={total}
        />
      </div>
    </>
  );
}
