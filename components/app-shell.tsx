"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  Plus,
  LoaderCircle,
  ReceiptText,
  Refrigerator,
  House,
  UserRound,
} from "lucide-react";
import { buildPurchaseHistory, ShoppingV2 } from "./shopping-v2";
import { ShoppingList } from "./shopping-list";
import { ReceiptScanner } from "./receipt-scanner";
import {
  categoryEmoji,
  CategoryManager,
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
import { formatCurrency, isCurrency, type Currency } from "@/lib/currency";
import { requiredPreferences } from "@/lib/user-preferences";
import { RoomiesScreen } from "./roomies-screen";

type MainTab = "finances" | "list" | "fridge" | "roomies" | "shopping";

export function AppShell() {
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const { data, update, ready, reload } = useAppData(authUser?.id);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [tab, setTab] = useState<MainTab>(() => {
    if (typeof window === "undefined") return "finances";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested === "roomies" ? "roomies" : requested === "purchases" ? "shopping" : requested === "list" ? "list" : "finances";
  });
  const [roomiesAttention, setRoomiesAttention] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [currency, setCurrency] = useState<Currency>("CLP");
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
  const selectTab = (next: MainTab) => {
    if (tab === "shopping" || tab === "list") {
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setTab(next);
  };
  const openPurchases = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "purchases");
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setTab("shopping");
  };
  const openShoppingList = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "list");
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setTab("list");
  };
  const required = requiredPreferences(authUser?.user_metadata);
  const displayName = required.displayName;
  const configuredCurrency = required.currency;
  const needsName = Boolean(authUser && !authUser.is_anonymous && required.needsName);
  const needsCurrency = Boolean(authUser && !authUser.is_anonymous && required.needsCurrency);
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
    if (!authUser) return;
    const metadata = authUser.user_metadata;
    const storedTheme = localStorage.getItem(`gasto-listo-theme:${authUser.id}`);
    const nextTheme = metadata?.theme === "light" || metadata?.theme === "dark"
      ? metadata.theme
      : storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
    const nextCurrency = isCurrency(metadata?.currency) ? metadata.currency : "CLP";
    queueMicrotask(() => {
      setTheme(nextTheme);
      setCurrency(nextCurrency);
    });
  }, [authUser]);
  useEffect(() => {
    const restoreFromUrl = () => {
      const requested = new URLSearchParams(window.location.search).get("tab");
      setTab(requested === "purchases" ? "shopping" : requested === "roomies" ? "roomies" : requested === "list" ? "list" : "finances");
    };
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.appTheme = theme;
  }, [theme]);
  useEffect(() => {
    if (!supabase || !authUser) return;
    let active = true;
    const refreshAttention = async () => {
      const { data: debts } = await supabase!
        .from("replacement_debts")
        .select("debtor_user_id,owner_user_id,status")
        .in("status", ["pending", "awaiting_confirmation"]);
      if (!active || !debts) return;
      setRoomiesAttention(debts.filter((debt) =>
        (debt.debtor_user_id === authUser.id && debt.status === "pending") ||
        (debt.owner_user_id === authUser.id && debt.status === "awaiting_confirmation"),
      ).length);
    };
    queueMicrotask(() => void refreshAttention());
    const channel = supabase
      .channel(`roomies-attention:${authUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "replacement_debts" }, () => void refreshAttention())
      .subscribe();
    return () => { active = false; void supabase?.removeChannel(channel); };
  }, [authUser]);
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
          displayName={displayName}
          isPro={Boolean(entitlements && canUseFeature(entitlements, "aiRecipes"))}
          currency={currency}
          theme={theme}
          preferencesChanged={(user) => {
            const nextTheme = user.user_metadata.theme === "light" ? "light" : "dark";
            setTheme(nextTheme);
            if (isCurrency(user.user_metadata.currency)) setCurrency(user.user_metadata.currency);
            setAuthUser(user);
          }}
          openPurchases={openPurchases}
        />
      ) : tab === "list" ? (
        <ShoppingList data={data} update={update} showFridge={() => selectTab("fridge")} />
      ) : tab === "fridge" && authUser ? (
        <FridgeScreen
          userId={authUser.id}
          data={data}
          update={update}
          canScanProducts={canScanProducts}
          canCook={canCook}
          openShoppingList={openShoppingList}
        />
      ) : tab === "roomies" && authUser ? (
        <RoomiesScreen userId={authUser.id} onAttentionChange={setRoomiesAttention} />
      ) : (
        <ShoppingV2
          data={data}
          update={update}
          currency={currency}
          showFinances={() => selectTab("finances")}
        />
      )}
      <nav
        aria-label="Navegación principal"
        className={`bottom-nav fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full min-w-0 max-w-2xl ${hasFridge ? "grid-cols-3" : "grid-cols-2"} border-t border-black/[.06] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl`}
      >
        <Nav
          active={tab === "finances" || tab === "shopping"}
          click={() => selectTab("finances")}
          icon={<BadgeDollarSign />}
          label="Finanzas"
        />
        {hasFridge && (
          <Nav
            active={tab === "fridge" || tab === "list"}
            click={() => selectTab("fridge")}
            icon={<Refrigerator />}
            label="Refrigerador"
          />
        )}
        <Nav
          active={tab === "roomies"}
          click={() => selectTab("roomies")}
          icon={<House />}
          label="Roomies"
          badge={roomiesAttention}
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
          currency={currency}
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
      {(needsName || needsCurrency) && authUser && (
        <PreferencesOnboarding
          email={authUser.email || ""}
          displayName={displayName}
          currency={configuredCurrency}
          saved={(user) => {
            setAuthUser(user);
            if (isCurrency(user.user_metadata.currency)) setCurrency(user.user_metadata.currency);
          }}
        />
      )}
    </main>
  );
}

function PreferencesOnboarding({ email, displayName, currency, saved }: { email: string; displayName: string; currency?: Currency; saved: (user: User) => void }) {
  const needsName = !displayName;
  const needsCurrency = !currency;
  const [step, setStep] = useState<"name" | "currency">(needsName ? "name" : "currency");
  const [name, setName] = useState(displayName);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | undefined>(currency);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const persist = async () => {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!supabase || (needsName && clean.length < 2) || !selectedCurrency || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    const { data, error: updateError } = await supabase.auth.updateUser({
      data: {
        ...(needsName ? { full_name: clean, name: clean } : {}),
        currency: selectedCurrency,
        needs_name: false,
      },
    });
    setSaving(false);
    if (updateError || !data.user) {
      savingRef.current = false;
      setError("No pudimos guardar tus preferencias. Intenta nuevamente.");
      return;
    }
    savingRef.current = false;
    saved(data.user);
  };
  const totalSteps = needsName && needsCurrency ? 2 : 1;
  const currentStep = totalSteps === 2 && step === "currency" ? 2 : 1;
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/55 p-5">
      <section className="theme-card w-full max-w-sm rounded-[30px] bg-white p-6 text-center shadow-2xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[#e5f3ea] text-[#176b46]">
          <UserRound size={31}/>
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#718078]">Paso {currentStep} de {totalSteps}</p>
        {step === "name" ? <>
          <h2 className="mt-2 text-3xl font-bold tracking-[-.03em]">¿Cómo te llamas?</h2>
          <p className="mt-2 text-sm text-[#587067]">Usaremos tu nombre para personalizar tu experiencia.</p>
          <label htmlFor="welcome-name" className="mt-6 block text-left text-sm font-bold">Tu nombre</label>
          <input id="welcome-name" autoFocus required minLength={2} maxLength={50} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Oliver" className="theme-card mt-2 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[#176b46]"/>
        </> : <>
          <h2 className="mt-2 text-2xl font-bold tracking-[-.03em]">¿Cuál es tu moneda principal?</h2>
          <p className="mt-2 text-sm text-[#587067]">La usaremos para mostrar y registrar tus montos.</p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-black/[.06] text-left">
            {([ ["CLP", "🇨🇱", "Peso chileno"], ["MXN", "🇲🇽", "Peso mexicano"], ["USD", "🇺🇸", "Dólar estadounidense"], ["EUR", "🇪🇺", "Euro"] ] as Array<[Currency, string, string]>).map(([code, flag, label]) => <button key={code} type="button" onClick={() => setSelectedCurrency(code)} className={`flex min-h-16 w-full items-center gap-3 border-b border-black/[.06] px-4 last:border-0 ${selectedCurrency === code ? "bg-[#e6f3ec]" : ""}`}><span className="text-2xl">{flag}</span><span className="min-w-0 flex-1"><b className="block">{code}</b><small className="text-[#718078]">{label}</small></span>{selectedCurrency === code ? <CheckCircle2 className="text-[#176b46]" size={21}/> : <span className="h-5 w-5 rounded-full border border-[#91a098]"/>}</button>)}
          </div>
        </>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-left text-sm text-red-700">{error}</p>}
        <button type="button" onClick={() => { if (step === "name" && needsCurrency) { setError(""); setStep("currency"); } else { void persist(); } }} disabled={saving || (step === "name" ? name.trim().length < 2 : !selectedCurrency)} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-4 font-bold text-white disabled:opacity-50">
          {saving && <LoaderCircle className="animate-spin" size={20}/>} {saving ? "Guardando..." : step === "name" && needsCurrency ? "Continuar" : "Comenzar"}
        </button>
        {email && <p className="mt-4 truncate text-xs text-[#718078]">Cuenta: {email}</p>}
      </section>
    </div>
  );
}

function Nav({
  active,
  click,
  icon,
  label,
  badge = 0,
}: {
  active: boolean;
  click: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={click}
      className={`flex min-h-20 flex-1 flex-col items-center justify-center gap-1 pt-4 text-[12px] font-semibold transition-colors duration-150 ${active ? "text-[#176b46]" : "text-[#718078]"}`}
    >
      <span className="relative">{icon}{badge > 0 && <span className="absolute -right-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#176b46] px-1 text-[9px] font-bold leading-none text-white">{Math.min(badge, 9)}{badge > 9 ? "+" : ""}</span>}</span>
      {label}
    </button>
  );
}

function Finances({
  data,
  reload,
  admin,
  displayName,
  isPro,
  currency,
  theme,
  preferencesChanged,
  openPurchases,
}: {
  data: AppData;
  reload: () => Promise<void>;
  admin: boolean;
  displayName: string;
  isPro: boolean;
  currency: Currency;
  theme: "light" | "dark";
  preferencesChanged: (user: User) => void;
  openPurchases: () => void;
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
  const recentPurchases = buildPurchaseHistory(data).slice(0, 3);
  return (
    <>
      <header className="flex items-center px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex-1">
          <p className="text-[13px] font-bold uppercase tracking-[.18em] text-[#6f8278]">
            {displayName ? `Hola, ${displayName.split(/\s+/)[0]}` : "Tu dinero"}
          </p>
          <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-[-.02em]">
            Finanzas
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          {isPro && (
            <span className="pro-badge-shine rounded-full border border-[#c7a95b]/45 bg-[#173d2d] px-3 py-1.5 text-[11px] font-extrabold tracking-[.2em] text-[#ecd990] shadow-[0_5px_16px_rgba(23,61,45,.18)]">
              PRO
            </span>
          )}
          <AccountAccess
            admin={admin}
            displayName={displayName}
            currency={currency}
            theme={theme}
            onPreferencesChanged={preferencesChanged}
            onAccountChanged={() => {
              reload().catch(() => undefined);
            }}
          />
        </div>
      </header>
      <section className="mx-4 min-w-0 rounded-[24px] border border-[#4fc187]/20 bg-[#101a14] px-5 py-4 text-white shadow-[0_8px_22px_rgba(0,0,0,.08)]">
        <p className="text-xs font-medium text-white/60">Gastado este mes</p>
        <p className="mt-1.5 truncate text-[clamp(1.75rem,8vw,2.25rem)] font-bold leading-none tracking-[-.035em]">{formatCurrency(total, currency)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
          <span className="text-xs text-white/60">
            Esta semana{" "}
            <b className="mt-0.5 block text-sm text-white">
              {formatCurrency(week, currency)}
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
          currency={currency}
        />
        <section className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Historial</p><h2 className="mt-1 text-xl font-bold">Compras recientes</h2></div>
            <button type="button" onClick={openPurchases} className="min-h-10 shrink-0 rounded-xl px-2 text-sm font-bold text-[#176b46]">Ver todas</button>
          </div>
          <div className="theme-card overflow-hidden rounded-[22px] border border-black/[.06] bg-white shadow-sm">
            {recentPurchases.length ? recentPurchases.map((item) => (
              <button key={item.id} type="button" onClick={openPurchases} className="flex min-h-[68px] w-full min-w-0 items-center gap-3 border-b border-black/[.06] px-4 py-3 text-left last:border-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e3f2e9] text-xl">{categoryEmoji(item.category)}</span>
                <span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.title}</b><small className="mt-0.5 block text-xs text-[#718078]">{new Date(item.date).toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "")}</small></span>
                <span className="shrink-0 text-right"><b className="block whitespace-nowrap text-sm">{formatCurrency(item.amount, currency)}</b><ChevronRight className="ml-auto mt-1 text-[#91a098]" size={16}/></span>
              </button>
            )) : (
              <button type="button" onClick={openPurchases} className="flex min-h-20 w-full items-center gap-3 px-4 text-left">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3f2e9] text-[#176b46]"><ReceiptText size={20}/></span>
                <span className="min-w-0 flex-1"><b className="block text-sm">Aún no tienes compras</b><small className="text-xs text-[#718078]">Aquí aparecerán tus movimientos recientes.</small></span><ChevronRight className="text-[#91a098]" size={20}/>
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
