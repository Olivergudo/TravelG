"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Home,
  LoaderCircle,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
  Send,
  ShoppingCart,
  LogOut,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  createEvent,
  createGroupExpense,
  createHousehold,
  joinHousehold,
  leaveHousehold,
  loadRoomies,
  sendMessage,
  updateDebt,
  updateGroupExpensePayment,
} from "@/lib/roomies/repository";
import type { GroupExpense, Household, HouseholdMember, ReplacementDebt, RoomieMessage } from "@/lib/roomies/types";
import { enableRoomieNotifications, notifyRoomieEvent } from "@/lib/roomies/push-client";
import { getUserPendingDebts } from "@/lib/roomies/pending";
import { buildExpenseShares } from "@/lib/roomies/group-expenses";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, type Currency } from "@/lib/currency";

type RoomiesData = Awaited<ReturnType<typeof loadRoomies>>;
type Sheet = "create" | "join" | "household" | "actions" | "request" | "taken" | "purchased" | "groupExpense" | null;
const groupExpenseCategories = ["food", "transport", "home", "supermarket", "services", "other"] as const;

export function RoomiesScreen({
  userId,
  currency,
  onAttentionChange,
}: {
  userId: string;
  currency: Currency;
  onAttentionChange: (count: number) => void;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<RoomiesData>({ household: null, members: [], messages: [], debts: [], groupExpenses: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [view, setView] = useState<"chat" | "pending">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "pending" ? "pending" : "chat",
  );

  const reload = useCallback(async () => {
    try {
      const next = await loadRoomies();
      setData(next);
      setError("");
    } catch (loadError) {
      console.error("roomies_load_failed", loadError);
      setError("No pudimos abrir Roomies. Revisa que hayas ejecutado la migración SQL.");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void reload()); }, [reload]);
  useEffect(() => {
    const paymentAttention = data.groupExpenses.filter((expense) => expense.status !== "paid" && expense.status !== "cancelled" && (expense.payer_id === userId || expense.group_expense_shares.some((share) => share.user_id === userId && share.status !== "confirmed_paid"))).length;
    const attention = getUserPendingDebts(data.debts, userId).length + paymentAttention;
    onAttentionChange(attention);
  }, [data.debts, data.groupExpenses, onAttentionChange, userId]);
  useEffect(() => {
    if (!supabase || !data.household) return;
    const householdId = data.household.id;
    const channel = supabase
      .channel(`roomies:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_messages", filter: `household_id=eq.${householdId}` }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "replacement_debts", filter: `household_id=eq.${householdId}` }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_expenses", filter: `household_id=eq.${householdId}` }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_expense_shares" }, () => void reload())
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [data.household, reload]);

  if (!ready) return <ScreenLoader />;
  if (!data.household) return <RoomiesWelcome error={error} open={setSheet} reload={reload} sheet={sheet} />;
  return (
    <section className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <RoomiesHeader household={data.household} members={data.members} openMenu={() => setSheet("household")} />
      <div className="mx-4 grid grid-cols-2 rounded-2xl bg-black/[.045] p-1 dark:bg-white/[.045]">
        <button type="button" onClick={() => setView("chat")} className={`min-h-11 rounded-xl text-sm font-bold ${view === "chat" ? "theme-card bg-white text-[#176b46] shadow-sm" : "text-[#718078]"}`}>{t("roomies.chat")}</button>
        <button type="button" onClick={() => setView("pending")} className={`min-h-11 rounded-xl text-sm font-bold ${view === "pending" ? "theme-card bg-white text-[#176b46] shadow-sm" : "text-[#718078]"}`}>{t("roomies.pending")}</button>
      </div>
      {error && <p role="alert" className="mx-4 mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <NotificationPrompt />
      {view === "chat" ? (
        <ChatView userId={userId} data={data} openActions={() => setSheet("actions")} openPending={() => setView("pending")} reload={reload} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))]"><DebtsView userId={userId} data={data} reload={reload} /></div>
      )}
      {sheet && (
        <RoomieSheet
          sheet={sheet}
          close={() => setSheet(null)}
          next={setSheet}
          household={data.household}
          members={data.members}
          debts={data.debts}
          userId={userId}
          currency={currency}
          completed={async () => { setSheet(null); await reload(); }}
        />
      )}
    </section>
  );
}

function ScreenLoader() {
  return <div className="grid min-h-[70dvh] place-items-center text-[#718078]"><LoaderCircle className="animate-spin" /></div>;
}

function RoomiesWelcome({ error, open, reload, sheet }: { error: string; open: (sheet: Sheet) => void; reload: () => Promise<void>; sheet: Sheet }) {
  const { t } = useI18n();
  return (
    <section className="grid min-h-[calc(100dvh-5rem)] place-items-center px-5 pb-20 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-[#e3f2e9] text-[#176b46]"><Home size={38}/></div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[.2em] text-[#6f8278]">Roomies</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-.03em]">{t("roomies.tagline")}</h1>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={() => open("create")} className="mt-7 min-h-14 w-full rounded-2xl bg-[#176b46] px-4 font-bold text-white">{t("roomies.create")}</button>
        <button type="button" onClick={() => open("join")} className="theme-card mt-3 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 font-bold text-[#176b46]">{t("roomies.join")}</button>
      </div>
      {sheet && <OnboardingSheet sheet={sheet} close={() => open(null)} completed={reload}/>}
    </section>
  );
}

function OnboardingSheet({ sheet, close, completed }: { sheet: Sheet; close: () => void; completed: () => Promise<void> }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const create = sheet === "create";
  const submit = async () => {
    if (!value.trim() || saving) return;
    setSaving(true); setError("");
    try {
      if (create) await createHousehold(value);
      else await joinHousehold(value);
      close(); await completed();
    } catch {
      setError(create ? "No pudimos crear el hogar." : "El código no existe o ya perteneces al hogar.");
    } finally { setSaving(false); }
  };
  return <SheetFrame close={close} title={create ? "Crear hogar" : "Unirme a un hogar"}>
    <label className="block text-sm font-bold">{create ? "Nombre del hogar" : "Código de invitación"}</label>
    <input autoFocus value={value} onChange={(event) => setValue(create ? event.target.value : event.target.value.toUpperCase())} maxLength={60} placeholder={create ? "Depto Viña" : "VINA-8421"} className="theme-card mt-2 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[#176b46]"/>
    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    <button type="button" onClick={() => void submit()} disabled={!value.trim() || saving} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-bold text-white disabled:opacity-50">{saving && <LoaderCircle size={19} className="animate-spin"/>}{create ? "Crear" : "Unirme"}</button>
  </SheetFrame>;
}

function RoomiesHeader({ household, members, openMenu }: { household: Household; members: HouseholdMember[]; openMenu: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return <header className="px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]">
    <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#6f8278]">Roomies</p>
    <div className="mt-1 flex items-start justify-between gap-3">
      <div className="min-w-0"><h1 className="truncate text-[30px] font-bold tracking-[-.03em]">{household.name}</h1><p className="mt-1 line-clamp-2 text-sm text-[#718078]">{members.map((member) => member.display_name).join(" · ")}</p></div>
      <div className="flex shrink-0 gap-2"><button type="button" onClick={async () => { await navigator.clipboard.writeText(household.invite_code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="theme-card flex min-h-11 items-center gap-2 rounded-xl border border-black/[.07] bg-white px-3 text-xs font-bold text-[#176b46]" aria-label={t("roomies.copyInvite")}><Copy size={16}/>{copied ? t("roomies.copied") : household.invite_code}</button><button type="button" onClick={openMenu} aria-label={t("roomies.viewMembers")} className="theme-card grid h-11 w-11 place-items-center rounded-xl border border-black/[.07] bg-white text-[#176b46]"><Users size={20}/></button></div>
    </div>
  </header>;
}

function ChatView({ userId, data, openActions, openPending, reload }: { userId: string; data: RoomiesData; openActions: () => void; openPending: () => void; reload: () => Promise<void> }) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [data.messages.length]);
  const names = useMemo(() => new Map(data.members.map((member) => [member.user_id, member.display_name])), [data.members]);
  const submit = async () => {
    if (!message.trim() || sending || !data.household) return;
    setSending(true); setError("");
    try { await sendMessage(data.household.id, userId, message); setMessage(""); await reload(); }
    catch { setError("No pudimos enviar el mensaje. Revisa tu conexión."); }
    finally { setSending(false); }
  };
  return <div className="flex min-h-0 flex-1 flex-col px-4 pb-[calc(5rem+env(safe-area-inset-bottom)+8px)]">
    <PendingAlert userId={userId} data={data} open={openPending}/>
    <div className="mt-4 flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-y-auto overscroll-contain [&>*]:shrink-0">
      {data.messages.length === 0 && (
        <Empty icon={<MessageCircle/>} title={t("roomies.chat")} text={t("roomies.tagline")}/>
      )}
      {data.messages.map((item) => <MessageCard key={item.id} item={item} mine={item.user_id === userId} actor={names.get(item.user_id) || "Roomie"} names={names} debts={data.debts} groupExpenses={data.groupExpenses} userId={userId} householdId={data.household!.id} reload={reload}/>) }
      <div ref={endRef}/>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="theme-card mt-2.5 flex shrink-0 items-center gap-2 rounded-2xl border border-black/[.07] bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,.09)]">
      <button type="button" onClick={openActions} aria-label="Acciones especiales" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e3f2e9] text-[#176b46]"><Plus/></button>
      <input data-i18n-ignore value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} maxLength={1000} placeholder={t("roomies.typeMessage")} className="min-w-0 flex-1 bg-transparent px-1 text-base outline-none"/>
      <button type="button" onClick={() => void submit()} disabled={!message.trim() || sending} aria-label={t("roomies.send")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#176b46] text-white disabled:opacity-40">{sending ? <LoaderCircle className="animate-spin" size={19}/> : <Send size={19}/>}</button>
    </div>
  </div>;
}

function PendingAlert({ userId, data, open }: { userId: string; data: RoomiesData; open: () => void }) {
  const { t, count } = useI18n();
  const pending = getUserPendingDebts(data.debts, userId);
  const pendingExpenses = data.groupExpenses.filter((expense) => expense.status !== "paid" && expense.status !== "cancelled" && (expense.payer_id === userId || expense.group_expense_shares.some((share) => share.user_id === userId && share.status !== "confirmed_paid")));
  const pendingCount = pending.length + pendingExpenses.length;
  if (pendingCount === 0) return null;
  if (pending.length === 0) {
    const expense = pendingExpenses[0];
    const myShare = expense.group_expense_shares.find((share) => share.user_id === userId);
    const payer = data.members.find((member) => member.user_id === expense.payer_id)?.display_name || t("roomies.member");
    return <button type="button" onClick={open} aria-label={t("activities.pending.view")} className="theme-card mt-4 flex min-h-[92px] w-full items-center gap-3 rounded-[22px] border border-amber-400/30 bg-white p-4 text-left shadow-sm transition active:scale-[.99]"><span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500"><CircleDollarSign size={22}/>{pendingCount > 1 && <b className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] text-white">{pendingCount}</b>}</span><span className="min-w-0 flex-1"><b className="block text-sm">{count("activities.pending.count", pendingCount)}</b><span className="mt-1 block truncate text-sm text-[#587067]">{pendingCount === 1 && myShare ? t("roomies.groupExpense.pendingFrom", { payer, amount: formatGroupAmount(Number(myShare.amount), expense.currency) }) : t("activities.pending.multipleHint")}</span></span><ChevronRight className="shrink-0 text-amber-500" size={21}/></button>;
  }
  const debt = pending[0];
  const names = new Map(data.members.map((member) => [member.user_id, member.display_name]));
  const debtor = names.get(debt.debtor_user_id) || t("roomies.member");
  const owner = names.get(debt.owner_user_id) || t("roomies.member");
  let description = t("activities.pending.multipleHint");
  let detail = "";
  if (pending.length === 1 && debt.debtor_user_id === userId) {
    description = debt.status === "pending"
      ? t("activities.pending.debtorMain", { product: debt.product_name })
      : t("activities.pending.debtorReported", { product: debt.product_name });
    detail = debt.status === "pending"
      ? t("activities.pending.forOwner", { owner })
      : t("activities.pending.waitingOwner", { owner });
  } else if (pending.length === 1) {
    description = debt.status === "pending"
      ? t("activities.pending.ownerMain", { debtor, product: debt.product_name })
      : t("activities.pending.ownerReported", { debtor, product: debt.product_name });
    detail = debt.status === "pending" ? t("roomies.pendingReplacement") : t("roomies.activity.awaiting");
  }
  return <button type="button" onClick={open} aria-label={t("activities.pending.view")} className="theme-card mt-4 flex min-h-[92px] w-full items-center gap-3 rounded-[22px] border border-amber-400/30 bg-white p-4 text-left shadow-sm transition active:scale-[.99]">
    <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500"><Bell size={21}/>{pendingCount > 1 && <b className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] text-white">{pendingCount}</b>}</span>
    <span className="min-w-0 flex-1"><b className="block text-sm">{count("activities.pending.count", pendingCount)}</b><span className="mt-1 block truncate text-sm text-[#587067]">{pendingCount > 1 ? t("activities.pending.multipleHint") : description}</span>{pendingCount === 1 && detail && <small className="mt-0.5 block truncate font-semibold text-amber-600">{detail}</small>}</span>
    <ChevronRight className="shrink-0 text-amber-500" size={21}/>
  </button>;
}

function MessageCard({ item, mine, actor, names, debts, groupExpenses, userId, householdId, reload }: { item: RoomieMessage; mine: boolean; actor: string; names: Map<string, string>; debts: ReplacementDebt[]; groupExpenses: GroupExpense[]; userId: string; householdId: string; reload: () => Promise<void> }) {
  const { t } = useI18n();
  const metadata = item.metadata;
  const product = String(metadata.productName || "producto");
  const owner = names.get(String(metadata.ownerUserId || "")) || "otro roomie";
  const event = item.type !== "message";
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");
  const debt = debts.find((candidate) => candidate.id === String(metadata.debtId || ""));
  const groupExpense = groupExpenses.find((candidate) => candidate.id === String(metadata.expenseId || ""));
  let text = item.message || "";
  if (item.type === "product_request") text = t("roomies.event.request", { product });
  if (item.type === "product_available") text = t("roomies.event.available", { actor, product });
  if (item.type === "product_taken") text = t(metadata.needsReplacement ? "roomies.event.takenReplace" : "roomies.event.takenNoReplace", { actor, product, owner });
  if (item.type === "product_purchased") text = t(metadata.target === "all" ? "roomies.event.boughtAll" : metadata.target === "self" ? "roomies.event.boughtSelf" : "roomies.event.boughtMember", { actor, product, target: names.get(String(metadata.targetUserId)) || "Roomie" });
  if (item.type === "replacement_reported") text = mine
    ? t("roomies.event.reportedMine", { product })
    : t("roomies.event.reported", { actor, product });
  if (item.type === "replacement_confirmed") text = t("roomies.event.confirmed", { actor, product });
  if (item.type === "replacement_rejected") text = t("roomies.event.rejected", { product });
  const activityStyle = {
    product_request: { icon: "🔎", accent: "#A1DBEE" },
    product_available: { icon: "🟢", accent: "#4DC686" },
    product_taken: { icon: "🥛", accent: "#D1AEDC" },
    product_purchased: { icon: "🛒", accent: "#A1DBEE" },
    replacement_reported: { icon: "⏳", accent: "#D9B44A" },
    replacement_confirmed: { icon: "✅", accent: "#4DC686" },
    replacement_rejected: { icon: "⚠️", accent: "#D1AEDC" },
  }[item.type as "product_request" | "product_available" | "product_taken" | "product_purchased" | "replacement_reported" | "replacement_confirmed" | "replacement_rejected"];
  const activityStatus = item.type === "product_taken"
    ? t(!metadata.needsReplacement
      ? "activities.status.noReplacement"
      : debt?.status === "resolved"
        ? "activities.status.resolved"
        : debt?.status === "awaiting_confirmation"
          ? "activities.status.awaitingConfirmation"
          : "activities.status.pending")
    : item.type === "replacement_reported"
      ? t(debt?.status === "resolved" ? "activities.status.resolved" : "activities.status.awaitingConfirmation")
      : item.type === "replacement_confirmed"
        ? t("activities.status.resolved")
        : item.type === "replacement_rejected"
          ? t("activities.status.pending")
          : item.type === "product_purchased"
            ? t("activities.status.added")
            : t("activities.status.active");
  const activityDetail = item.type === "product_taken"
    ? t("activities.compact.taken", { actor, owner })
    : item.type === "replacement_reported"
      ? t(mine ? "activities.compact.reportedMine" : "activities.compact.reported", { actor })
      : item.type === "replacement_confirmed"
        ? t("activities.compact.confirmed")
        : item.type === "replacement_rejected"
          ? t("activities.compact.rejected")
          : item.type === "product_request"
            ? t("activities.compact.request", { actor })
            : item.type === "product_available"
              ? t("activities.compact.available", { actor })
              : t("activities.compact.purchased", { actor });
  const answer = async () => {
    setSending(true);
    try { const id = await createEvent(householdId, "product_available", { requestId: item.id, productName: product }); await notifyRoomieEvent(id); await reload(); }
    finally { setSending(false); }
  };
  const updateReplacement = async (operation: "report" | "confirm" | "reject") => {
    if (!debt || sending) return;
    setSending(true); setActionError("");
    try {
      const messageId = await updateDebt(debt.id, operation);
      await notifyRoomieEvent(messageId);
      await reload();
    } catch {
      setActionError(t("roomies.debtUpdateError"));
    } finally {
      setSending(false);
    }
  };
  const time = new Date(item.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (item.type.startsWith("group_expense_") && groupExpense) return <GroupExpenseCard expense={groupExpense} item={item} names={names} actor={actor} userId={userId} reload={reload}/>;
  if (event && activityStyle) return <article className="theme-card relative w-fit min-w-[min(13rem,78%)] max-w-[88%] overflow-hidden rounded-2xl border bg-white px-3 py-2.5 shadow-sm md:max-w-[68%]" style={{ borderColor: `${activityStyle.accent}44` }}>
    <span className="absolute inset-y-0 left-0 w-0.5" style={{ backgroundColor: activityStyle.accent }}/>
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-0.5 text-sm leading-snug">
      <span className="shrink-0 text-base">{activityStyle.icon}</span>
      <b className="break-words">{product}</b>
      <span className="text-[#839087]">·</span>
      <span className="text-xs font-bold" style={{ color: activityStyle.accent }}>{activityStatus}</span>
    </div>
    <p className="mt-1 break-words pl-0.5 text-xs leading-snug text-[#718078]">{activityDetail} <span className="text-[#839087]">· {time}</span></p>
    {item.type === "product_request" && item.user_id !== userId && <button type="button" disabled={sending} onClick={() => void answer()} className="mt-3 min-h-10 rounded-xl bg-[#e3f2e9] px-4 text-sm font-bold text-[#176b46] disabled:opacity-50">{t("roomies.activity.iHaveIt")}</button>}
    {item.type === "product_taken" && debt?.status === "pending" && debt.debtor_user_id === userId && <button type="button" disabled={sending} onClick={() => void updateReplacement("report")} className="mt-3 min-h-10 w-full rounded-xl bg-[#176b46] px-4 text-sm font-bold text-white disabled:opacity-50">{t("roomies.replaced")}</button>}
    {item.type === "replacement_reported" && debt?.status === "awaiting_confirmation" && debt.owner_user_id === userId && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={sending} onClick={() => void updateReplacement("confirm")} className="min-h-10 rounded-xl bg-[#176b46] px-2 text-sm font-bold text-white disabled:opacity-50">{t("roomies.replacedByOther")}</button><button type="button" disabled={sending} onClick={() => void updateReplacement("reject")} className="theme-card min-h-10 rounded-xl border border-black/10 bg-white px-2 text-sm font-bold disabled:opacity-50">{t("roomies.notYet")}</button></div>}
    {actionError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{actionError}</p>}
  </article>;
  return <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
    <article className={`${mine ? "bg-[#176b46] text-white" : "theme-card bg-white"} w-fit min-w-[min(140px,70vw)] max-w-[82%] rounded-2xl px-4 py-3 shadow-sm md:max-w-[65%]`}>
      <p className={`break-words text-xs font-bold ${mine ? "text-white/70" : "text-[#176b46]"}`}>{actor}</p>
      <p data-i18n-ignore className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>
      <time className={`ml-auto mt-1 block w-fit text-[11px] ${mine ? "text-white/55" : "text-[#839087]"}`}>{time}</time>
    </article>
  </div>;
}

const formatGroupAmount = (amount: number, currency: Currency) => formatCurrency(amount, currency);

function GroupExpenseCard({ expense, item, names, actor, userId, reload }: { expense: GroupExpense; item: RoomieMessage; names: Map<string, string>; actor: string; userId: string; reload: () => Promise<void> }) {
  const { t, count } = useI18n();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const payer = names.get(expense.payer_id) || t("roomies.member");
  const myShare = expense.group_expense_shares.find((share) => share.user_id === userId);
  const reported = expense.group_expense_shares.filter((share) => share.status === "reported_paid");
  const time = new Date(item.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const update = async (participantId: string, operation: "report" | "confirm" | "reject") => {
    setBusy(participantId + operation); setError("");
    try { const messageId = await updateGroupExpensePayment(expense.id, participantId, operation); await notifyRoomieEvent(messageId); await reload(); }
    catch { setError(t("roomies.groupExpense.updateError")); }
    finally { setBusy(""); }
  };
  if (item.type !== "group_expense_created") {
    const participantId = String(item.metadata.participantUserId || "");
    const participant = names.get(participantId) || actor;
    const rejected = item.metadata.operation === "reject";
    return <article className="theme-card w-fit max-w-[88%] rounded-2xl border border-[#A1DBEE]/30 bg-white px-3 py-2.5 shadow-sm md:max-w-[68%]"><p className="text-sm font-bold">{item.type === "group_expense_payment_confirmed" ? "✅" : rejected ? "↩️" : "⏳"} {expense.concept}</p><p className="mt-1 text-xs text-[#718078]">{t(item.type === "group_expense_payment_confirmed" ? "roomies.groupExpense.paymentConfirmedEvent" : rejected ? "roomies.groupExpense.paymentRejectedEvent" : "roomies.groupExpense.paymentReportedEvent", { participant })} · {time}</p></article>;
  }
  const statusKey = expense.status === "paid" ? "paid" : expense.status === "partially_paid" ? "partiallyPaid" : expense.status === "cancelled" ? "cancelled" : "pending";
  return <details className="theme-card group w-full max-w-[94%] overflow-hidden rounded-[24px] border border-[#A1DBEE]/30 bg-white shadow-sm md:max-w-[78%]">
    <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
      <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-[#A1DBEE]/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#5aa8c4]">{t("roomies.groupExpense.cardLabel")}</span><span className="text-[11px] text-[#839087]">{time}</span></div>
      <strong className="mt-3 block text-3xl tracking-[-.04em]">{formatGroupAmount(Number(expense.total_amount), expense.currency)}</strong>
      <h3 className="mt-1 text-base font-bold">{expense.concept}</h3>
      <p className="mt-1 text-sm text-[#718078]">{t("roomies.groupExpense.paidBy", { payer })} · {count("roomies.groupExpense.roomies", expense.group_expense_shares.length)}</p>
      <span className="mt-3 inline-flex rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-extrabold uppercase text-amber-600">{t(`roomies.groupExpense.${statusKey}`)}</span>
    </summary>
    <div className="border-t border-black/[.06] px-4 pb-4 pt-3">
      <div className="space-y-2">{expense.group_expense_shares.map((share) => <div key={share.id} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{names.get(share.user_id) || t("roomies.member")}</span><b>{formatGroupAmount(Number(share.amount), expense.currency)}</b><small className="rounded-full bg-black/[.045] px-2 py-1 text-[10px] font-bold text-[#718078]">{t(`roomies.groupExpense.share.${share.status}`)}</small></div>)}</div>
      {myShare?.status === "pending" && <button type="button" disabled={Boolean(busy)} onClick={() => void update(userId, "report")} className="mt-4 min-h-11 w-full rounded-xl bg-[#176b46] px-3 text-sm font-bold text-white disabled:opacity-50">{t("roomies.groupExpense.markPaid")}</button>}
      {expense.payer_id === userId && reported.map((share) => <div key={share.id} className="mt-4"><p className="mb-2 text-xs font-bold">{t("roomies.groupExpense.confirmHint", { participant: names.get(share.user_id) || t("roomies.member") })}</p><div className="grid grid-cols-2 gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void update(share.user_id, "confirm")} className="min-h-10 rounded-xl bg-[#176b46] px-2 text-sm font-bold text-white">{t("roomies.groupExpense.confirm")}</button><button type="button" disabled={Boolean(busy)} onClick={() => void update(share.user_id, "reject")} className="theme-card min-h-10 rounded-xl border border-black/10 bg-white px-2 text-sm font-bold">{t("roomies.notYet")}</button></div></div>)}
      {error && <p role="alert" className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  </details>;
}

function DebtsView({ userId, data, reload }: { userId: string; data: RoomiesData; reload: () => Promise<void> }) {
  const { t } = useI18n();
  const initialResolved = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "resolved";
  const [resolved, setResolved] = useState(initialResolved);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const names = new Map(data.members.map((member) => [member.user_id, member.display_name]));
  const debts = data.debts.filter((debt) =>
    (debt.debtor_user_id === userId || debt.owner_user_id === userId) &&
    (resolved ? debt.status === "resolved" : debt.status !== "resolved"),
  );
  const paymentExpenses = data.groupExpenses.filter((expense) =>
    (expense.payer_id === userId || expense.group_expense_shares.some((share) => share.user_id === userId)) &&
    (resolved ? expense.status === "paid" : expense.status !== "paid" && expense.status !== "cancelled"),
  );
  const act = async (debt: ReplacementDebt, operation: "report" | "confirm" | "reject") => {
    setBusy(debt.id + operation); setError("");
    try { const messageId = await updateDebt(debt.id, operation); await notifyRoomieEvent(messageId); await reload(); }
    catch { setError("No pudimos actualizar la reposición. Revisa tu conexión."); }
    finally { setBusy(""); }
  };
  return <div className="px-4 pb-4">
    <div className="mt-4 flex gap-2"><button type="button" onClick={() => setResolved(false)} className={`min-h-10 rounded-full px-4 text-sm font-bold ${!resolved ? "bg-[#176b46] text-white" : "theme-card bg-white text-[#718078]"}`}>{t("roomies.active")}</button><button type="button" onClick={() => setResolved(true)} className={`min-h-10 rounded-full px-4 text-sm font-bold ${resolved ? "bg-[#176b46] text-white" : "theme-card bg-white text-[#718078]"}`}>{t("roomies.resolved")}</button></div>
    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="mt-4 space-y-3">
      {debts.length === 0 && paymentExpenses.length === 0 && (
        <Empty icon={<PackageCheck/>} title={resolved ? t("roomies.noResolved") : t("roomies.allGood")} text={resolved ? t("roomies.resolvedHistory") : t("roomies.noPendingProducts")}/>
      )}
      {paymentExpenses.map((expense) => { const message = data.messages.find((item) => item.type === "group_expense_created" && item.metadata.expenseId === expense.id); return message ? <GroupExpenseCard key={expense.id} expense={expense} item={message} names={names} actor={names.get(message.user_id) || t("roomies.member")} userId={userId} reload={reload}/> : null; })}
      {debts.map((debt) => <article key={debt.id} className="theme-card rounded-[22px] border border-black/[.06] bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e3f2e9] text-[#176b46]">🥛</div><div className="min-w-0 flex-1"><h3 className="font-bold">{debt.product_name}</h3><p className="text-sm text-[#718078]">{names.get(debt.debtor_user_id)} → {names.get(debt.owner_user_id)}</p></div></div>
        <p className="mt-3 text-sm font-semibold text-[#176b46]">{debt.status === "pending" ? t("roomies.pendingReplacement") : debt.status === "awaiting_confirmation" ? t("roomies.waiting", { name: names.get(debt.owner_user_id) || "" }) : t("roomies.resolved")}</p>
        <p className="mt-1 text-xs text-[#839087]">{relativeDate(debt.resolved_at || debt.created_at)}</p>
        {debt.status === "pending" && debt.debtor_user_id === userId && <button type="button" disabled={busy !== ""} onClick={() => void act(debt, "report")} className="mt-4 min-h-11 w-full rounded-xl bg-[#176b46] font-bold text-white">Ya lo repuse</button>}
        {debt.status === "awaiting_confirmation" && debt.owner_user_id === userId && <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={busy !== ""} onClick={() => void act(debt, "confirm")} className="min-h-11 rounded-xl bg-[#176b46] px-2 text-sm font-bold text-white">{t("roomies.confirmReplacement")}</button><button type="button" disabled={busy !== ""} onClick={() => void act(debt, "reject")} className="theme-card min-h-11 rounded-xl border border-black/10 bg-white px-2 text-sm font-bold">{t("roomies.notYet")}</button></div>}
      </article>)}
    </div>
  </div>;
}

function RoomieSheet({ sheet, close, next, household, members, debts, userId, currency, completed }: { sheet: Sheet; close: () => void; next: (sheet: Sheet) => void; household: Household; members: HouseholdMember[]; debts: ReplacementDebt[]; userId: string; currency: Currency; completed: () => Promise<void> }) {
  const { t } = useI18n();
  if (sheet === "household") return <HouseholdMenu household={household} members={members} userId={userId} close={close} completed={completed}/>;
  if (sheet === "actions") return <SheetFrame title={t("roomies.actions")} close={close}>
    <Action icon={<Search/>} label={t("roomies.ask")} click={() => next("request")}/>
    <Action icon={<PackageCheck/>} label={t("roomies.taken")} click={() => next("taken")}/>
    <Action icon={<ShoppingCart/>} label={t("roomies.purchased")} click={() => next("purchased")}/>
    <Action icon={<CircleDollarSign/>} label={t("roomies.groupExpense.action")} click={() => next("groupExpense")}/>
  </SheetFrame>;
  if (sheet === "groupExpense") return <GroupExpenseForm close={close} household={household} members={members} userId={userId} currency={currency} completed={completed}/>;
  return <EventForm kind={sheet as "request" | "taken" | "purchased"} close={close} household={household} members={members} debts={debts} userId={userId} completed={completed}/>;
}

function GroupExpenseForm({ close, household, members, userId, currency, completed }: { close: () => void; household: Household; members: HouseholdMember[]; userId: string; currency: Currency; completed: () => Promise<void> }) {
  const { t } = useI18n();
  const others = members.filter((member) => member.user_id !== userId);
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [selected, setSelected] = useState<string[]>(others.map((member) => member.user_id));
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const total = Number(amount);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const submit = async () => {
    if (!concept.trim() || !Number.isFinite(total) || total <= 0 || selected.length === 0 || saving) return;
    let shares: Array<{ userId: string; amount: number }>;
    try { shares = buildExpenseShares(total, selected, mode === "custom" ? Object.fromEntries(selected.map((id) => [id, Number(custom[id] || 0)])) : undefined); }
    catch { setError(t("roomies.groupExpense.splitError")); return; }
    setSaving(true); setError("");
    try {
      const messageId = await createGroupExpense({ householdId: household.id, concept, totalAmount: total, currency, category, notes, shares });
      await notifyRoomieEvent(messageId);
      await completed();
    } catch { setError(t("roomies.groupExpense.createError")); setSaving(false); }
  };
  return <SheetFrame close={close} title={t("roomies.groupExpense.title")}>
    <label className="block text-sm font-bold">{t("roomies.groupExpense.amount")}</label><input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="$0" className="theme-card mt-2 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-xl font-bold outline-none focus:border-[#176b46]"/>
    <label className="mt-4 block text-sm font-bold">{t("roomies.groupExpense.concept")}</label><input value={concept} onChange={(event) => setConcept(event.target.value)} maxLength={100} className="theme-card mt-2 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none focus:border-[#176b46]"/>
    <p className="mt-4 text-sm font-bold">{t("roomies.groupExpense.chargeTo")}</p><div className="mt-2 flex flex-wrap gap-2">{others.map((member) => <button key={member.user_id} type="button" onClick={() => toggle(member.user_id)} className={`min-h-10 rounded-full border px-3 text-sm font-bold ${selected.includes(member.user_id) ? "border-[#176b46] bg-[#e3f2e9] text-[#176b46]" : "theme-card border-black/10 bg-white"}`}>{selected.includes(member.user_id) && <Check className="mr-1 inline" size={14}/>} {member.display_name}</button>)}</div>
    <p className="mt-4 text-sm font-bold">{t("roomies.groupExpense.split")}</p><div className="mt-2 grid grid-cols-2 gap-2"><Choice selected={mode === "equal"} label={t("roomies.groupExpense.equal")} click={() => setMode("equal")}/><Choice selected={mode === "custom"} label={t("roomies.groupExpense.custom")} click={() => setMode("custom")}/></div>
    {mode === "custom" && <div className="mt-3 space-y-2">{selected.map((id) => <label key={id} className="flex items-center gap-3 text-sm"><span className="min-w-0 flex-1 truncate">{members.find((member) => member.user_id === id)?.display_name}</span><input inputMode="decimal" value={custom[id] || ""} onChange={(event) => setCustom((current) => ({ ...current, [id]: event.target.value }))} placeholder="$0" className="theme-card h-11 w-28 rounded-xl border border-black/10 bg-white px-3 text-right outline-none"/></label>)}</div>}
    <label className="mt-4 block text-sm font-bold">{t("roomies.groupExpense.category")}</label><select value={category} onChange={(event) => setCategory(event.target.value)} className="theme-card mt-2 min-h-12 w-full rounded-xl border border-black/10 bg-white px-3"><option value="">{t("roomies.groupExpense.noCategory")}</option>{groupExpenseCategories.map((value) => <option key={value} value={value}>{t(`roomies.groupExpense.category.${value}`)}</option>)}</select>
    <label className="mt-4 block text-sm font-bold">{t("roomies.groupExpense.notes")}</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={2} className="theme-card mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white p-3 outline-none"/>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <button type="button" disabled={saving || !concept.trim() || total <= 0 || selected.length === 0} onClick={() => void submit()} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-bold text-white disabled:opacity-50">{saving && <LoaderCircle className="animate-spin" size={18}/>} {t("roomies.groupExpense.create")}</button>
  </SheetFrame>;
}

function HouseholdMenu({ household, members, userId, close, completed }: { household: Household; members: HouseholdMember[]; userId: string; close: () => void; completed: () => Promise<void> }) {
  const { t, count } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const me = members.find((member) => member.user_id === userId);
  const ownerWithOthers = me?.role === "owner" && members.length > 1;
  const leave = async () => {
    if (leaving) return;
    setLeaving(true); setError("");
    try { await leaveHousehold(household.id); close(); await completed(); }
    catch { setError(t("roomies.leaveError")); setLeaving(false); }
  };
  if (confirming) return <SheetFrame close={() => setConfirming(false)} title={t("roomies.leaveTitle")}>
    <p className="text-sm leading-relaxed text-[#587067]">{t("roomies.leaveHint", { household: household.name })}</p>
    {ownerWithOthers && <p className="mt-3 rounded-2xl bg-[#e3f2e9] p-3 text-sm text-[#176b46]">Eres el propietario. La propiedad se transferirá automáticamente al miembro más antiguo.</p>}
    {me?.role === "owner" && members.length === 1 && <p className="mt-3 rounded-2xl bg-[#e3f2e9] p-3 text-sm text-[#176b46]">{t("roomies.onlyMember")}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirming(false)} className="theme-card min-h-12 rounded-xl border border-black/10 bg-white font-bold">{t("common.cancel")}</button><button type="button" disabled={leaving} onClick={() => void leave()} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 font-bold text-white disabled:opacity-50">{leaving ? <LoaderCircle size={18} className="animate-spin"/> : <LogOut size={18}/>} {t("roomies.leaveConfirm")}</button></div>
  </SheetFrame>;
  return <SheetFrame close={close} title={t("roomies.participants")}>
    <p className="-mt-3 mb-4 text-sm text-[#718078]">{household.name} · {count("roomies.person", members.length)}</p>
    <div className="overflow-hidden rounded-2xl border border-black/[.06]">{members.map((member) => <div key={member.id} className="theme-card flex min-h-16 items-center gap-3 border-b border-black/[.06] bg-white px-4 last:border-0"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e3f2e9] font-bold text-[#176b46]">{member.display_name.trim().charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="block truncate">{member.display_name}{member.user_id === userId ? ` · ${t("roomies.you")}` : ""}</b><small className="text-[#718078]">{member.role === "owner" ? t("roomies.owner") : t("roomies.member")}</small></span>{member.role === "owner" && <span className="rounded-full bg-[#e3f2e9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#176b46]">{t("roomies.owner")}</span>}</div>)}</div>
    <button type="button" onClick={() => setConfirming(true)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-500/25 text-sm font-bold text-red-600"><LogOut size={18}/> {t("roomies.leave")}</button>
  </SheetFrame>;
}

function EventForm({ kind, close, household, members, debts, userId, completed }: { kind: "request" | "taken" | "purchased"; close: () => void; household: Household; members: HouseholdMember[]; debts: ReplacementDebt[]; userId: string; completed: () => Promise<void> }) {
  const [product, setProduct] = useState("");
  const others = members.filter((member) => member.user_id !== userId);
  const [target, setTarget] = useState(others[0]?.user_id || "");
  const [purchaseTarget, setPurchaseTarget] = useState<"all" | "member" | "self">("all");
  const [needsReplacement, setNeedsReplacement] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<ReplacementDebt | null>(null);
  const title = kind === "request" ? "¿Qué necesitas?" : kind === "taken" ? "Tomé algo" : "Compré algo";
  const submit = async () => {
    if (!product.trim() || saving || (kind === "taken" && !target)) return;
    setSaving(true); setError("");
    try {
      const payload = kind === "request" ? { productName: product } : kind === "taken" ? { productName: product, ownerUserId: target, needsReplacement } : { productName: product, target: purchaseTarget, targetUserId: purchaseTarget === "member" ? target : undefined };
      const id = await createEvent(household.id, kind === "request" ? "product_request" : kind === "taken" ? "product_taken" : "product_purchased", payload);
      await notifyRoomieEvent(id);
      if (kind === "purchased" && purchaseTarget === "member") {
        const match = debts.find((debt) => debt.debtor_user_id === userId && debt.owner_user_id === target && debt.status === "pending" && debt.product_name.trim().toLocaleLowerCase("es") === product.trim().toLocaleLowerCase("es"));
        if (match) { setSuggestion(match); setSaving(false); return; }
      }
      await completed();
    } catch { setError("No pudimos enviar la acción. Revisa tu conexión."); setSaving(false); }
  };
  if (suggestion) return <SheetFrame close={close} title="¿Marcar como repuesta?"><p className="text-sm text-[#587067]">Tienes una reposición pendiente de {suggestion.product_name}. El propietario todavía deberá confirmarla.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => void (async () => { const id = await updateDebt(suggestion.id, "report"); await notifyRoomieEvent(id); await completed(); })()} className="min-h-12 rounded-xl bg-[#176b46] font-bold text-white">Sí</button><button type="button" onClick={() => void completed()} className="theme-card min-h-12 rounded-xl border border-black/10 bg-white font-bold">No</button></div></SheetFrame>;
  return <SheetFrame close={close} title={title}>
    {kind === "taken" && <><label className="block text-sm font-bold">¿De quién?</label><select value={target} onChange={(event) => setTarget(event.target.value)} className="theme-card mt-2 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-base">{others.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select></>}
    <label className={`${kind === "taken" ? "mt-4" : ""} block text-sm font-bold`}>{kind === "request" ? "Producto" : kind === "taken" ? "¿Qué tomaste?" : "¿Qué compraste?"}</label>
    <input autoFocus={kind !== "taken"} value={product} onChange={(event) => setProduct(event.target.value)} maxLength={100} placeholder="Leche" className="theme-card mt-2 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[#176b46]"/>
    {kind === "taken" && <><p className="mt-4 text-sm font-bold">¿Debes reponerlo?</p><div className="mt-2 grid grid-cols-2 gap-2"><Choice selected={needsReplacement} label="Sí" click={() => setNeedsReplacement(true)}/><Choice selected={!needsReplacement} label="No" click={() => setNeedsReplacement(false)}/></div></>}
    {kind === "purchased" && <><p className="mt-4 text-sm font-bold">¿Para quién?</p><div className="mt-2 grid grid-cols-3 gap-2"><Choice selected={purchaseTarget === "all"} label="Todos" click={() => setPurchaseTarget("all")}/><Choice selected={purchaseTarget === "member"} label="Roomie" click={() => setPurchaseTarget("member")}/><Choice selected={purchaseTarget === "self"} label="Para mí" click={() => setPurchaseTarget("self")}/></div>{purchaseTarget === "member" && <select value={target} onChange={(event) => setTarget(event.target.value)} className="theme-card mt-3 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4">{others.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select>}</>}
    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    <button type="button" disabled={!product.trim() || saving || ((kind === "taken" || (kind === "purchased" && purchaseTarget === "member")) && !target)} onClick={() => void submit()} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-bold text-white disabled:opacity-50">{saving && <LoaderCircle size={18} className="animate-spin"/>}{kind === "request" ? "Preguntar" : "Avisar"}</button>
  </SheetFrame>;
}

function NotificationPrompt() {
  const { t } = useI18n();
  const [state, setState] = useState<"hidden" | "ready" | "saving" | "done" | "error">(() =>
    typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && localStorage.getItem("roomies-push-dismissed") !== "1" ? "ready" : "hidden",
  );
  if (state === "hidden" || state === "done") return null;
  return <aside className="theme-card mx-4 mt-4 rounded-[22px] border border-[#176b46]/15 bg-white p-4 shadow-sm">
    <div className="flex gap-3"><Bell className="mt-0.5 shrink-0 text-[#176b46]"/><div><h3 className="font-bold">{t("roomies.notifications")}</h3><p className="mt-1 text-sm text-[#718078]">{t("roomies.notificationsHint")}</p></div></div>
    {state === "error" && <p className="mt-3 text-sm text-red-600">No pudimos activar las notificaciones.</p>}
    <div className="mt-4 flex gap-2"><button type="button" disabled={state === "saving"} onClick={() => void (async () => { setState("saving"); try { await enableRoomieNotifications(); setState("done"); } catch { setState("error"); } })()} className="min-h-11 flex-1 rounded-xl bg-[#176b46] px-3 text-sm font-bold text-white">{t("roomies.enableNotifications")}</button><button type="button" onClick={() => { localStorage.setItem("roomies-push-dismissed", "1"); setState("hidden"); }} className="min-h-11 rounded-xl px-3 text-sm text-[#718078]">{t("roomies.notNow")}</button></div>
  </aside>;
}

function SheetFrame({ close, title, children }: { close: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, []);
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section role="dialog" aria-modal="true" className="theme-card max-h-[88dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[30px] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-2xl font-bold tracking-[-.025em]">{title}</h2><button type="button" onClick={close} aria-label="Cerrar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/[.045]"><X/></button></div>{children}</section></div>;
}

function Action({ icon, label, click }: { icon: React.ReactNode; label: string; click: () => void }) { return <button type="button" onClick={click} className="theme-card mb-2 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-black/[.06] bg-white px-4 text-left font-bold"><span className="text-[#176b46]">{icon}</span>{label}</button>; }
function Choice({ selected, label, click }: { selected: boolean; label: string; click: () => void }) { return <button type="button" onClick={click} className={`min-h-12 rounded-xl border px-2 text-sm font-bold ${selected ? "border-[#176b46] bg-[#e3f2e9] text-[#176b46]" : "theme-card border-black/10 bg-white"}`}>{selected && <Check className="mr-1 inline" size={16}/>} {label}</button>; }
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="theme-card rounded-[24px] bg-white px-5 py-10 text-center"><div className="mx-auto w-fit text-[#91a098]">{icon}</div><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-sm text-[#718078]">{text}</p></div>; }
function relativeDate(value: string) { const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000); return days <= 0 ? "Hoy" : days === 1 ? "Ayer" : `Hace ${days} días`; }
