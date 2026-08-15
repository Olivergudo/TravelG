"use client";

import { Check, Circle, CircleDollarSign, LoaderCircle, PackageCheck } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";
import { markReplacementPurchased, updateDebt, updateGroupExpensePayment } from "@/lib/roomies/repository";
import { paymentObligations } from "@/lib/roomies/obligations";
import type { RoomieObligations } from "@/lib/roomies/types";

type SharedProps = { data: RoomieObligations; userId: string; reload: () => Promise<void>; openRoomies: () => void };

export function ReplacementShoppingSection({ data, userId, reload, openRoomies }: SharedProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string>();
  const debts = data.debts.filter((debt) => debt.debtor_user_id === userId && debt.status !== "resolved");
  const names = new Map(data.members.map((member) => [member.user_id, member.display_name]));
  if (!debts.length) return null;
  const run = async (id: string, action: "purchase" | "report") => {
    setBusy(id);
    try {
      if (action === "purchase") await markReplacementPurchased(id);
      else await updateDebt(id, "report");
      await reload();
    } catch { window.alert(t("shopping.replacements.updateError")); } finally { setBusy(undefined); }
  };
  return <section><div className="mb-2 flex items-center justify-between px-1"><h2 className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">{t("shopping.replacements.title")}</h2><span className="rounded-full bg-[#e3f2e9] px-2 py-1 text-[10px] font-bold text-[#176b46]">{debts.length}</span></div><div className="space-y-3">{debts.map((debt) => {
    const waiting = debt.status === "awaiting_confirmation";
    return <article key={debt.id} className="theme-card rounded-2xl border border-[#4dc686]/20 bg-white p-4 shadow-sm"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e3f2e9] text-[#176b46]"><PackageCheck size={20}/></span><div className="min-w-0 flex-1"><b className="block truncate">{debt.product_name}</b><p className="mt-0.5 text-xs text-[#718078]">{t("shopping.replacements.forUser", { name: names.get(debt.owner_user_id) || "Roomie" })}</p><span className="mt-2 inline-flex rounded-full bg-[#edf2ee] px-2 py-1 text-[10px] font-bold text-[#587067]">{waiting ? t("shopping.replacements.awaiting") : debt.purchased_at ? t("shopping.replacements.ready") : t("shopping.replacements.badge")}</span></div></div>{!waiting && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"><button disabled={Boolean(debt.purchased_at) || busy === debt.id} onClick={() => void run(debt.id, "purchase")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 px-3 text-sm font-bold disabled:opacity-55">{busy === debt.id ? <LoaderCircle className="animate-spin" size={17}/> : debt.purchased_at ? <Check size={17}/> : <Circle size={17}/>} {debt.purchased_at ? t("shopping.replacements.purchased") : t("shopping.replacements.markPurchased")}</button><button disabled={busy === debt.id} onClick={() => void run(debt.id, "report")} className="min-h-11 rounded-xl bg-[#176b46] px-3 text-sm font-bold text-white disabled:opacity-55">{t("shopping.replacements.report")}</button></div>}<button onClick={openRoomies} className="mt-2 min-h-9 text-xs font-bold text-[#176b46]">{t("shopping.replacements.view")}</button></article>;
  })}</div></section>;
}

export function FinancialObligationsSection({ data, userId, reload, openRoomies }: SharedProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string>();
  const { toPay, toReceive } = paymentObligations(data, userId);
  const names = new Map(data.members.map((member) => [member.user_id, member.display_name]));
  if (!toPay.length && !toReceive.length) return null;
  const act = async (expenseId: string, participantId: string, operation: "report" | "confirm" | "reject") => {
    const key = `${expenseId}:${participantId}:${operation}`; setBusy(key);
    try { await updateGroupExpensePayment(expenseId, participantId, operation); await reload(); }
    catch { window.alert(t("finance.pending.updateError")); } finally { setBusy(undefined); }
  };
  const group = (title: string, rows: typeof toPay, receive: boolean) => <details open={rows.length <= 3} className="theme-card rounded-2xl border border-black/[.06] bg-white"><summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-bold"><span className="flex-1">{title}</span><span className="rounded-full bg-[#edf2ee] px-2 py-1 text-xs text-[#587067]">{rows.length}</span></summary><div className="border-t border-black/[.06]">{rows.map(({ expense, share }) => { const payer = names.get(expense.payer_id) || "Roomie"; const participant = names.get(share.user_id) || "Roomie"; return <div key={`${expense.id}:${share.id}:${receive}`} className="border-b border-black/[.06] p-4 last:border-0"><div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 shrink-0 text-[#176b46]" size={20}/><div className="min-w-0 flex-1"><b className="block truncate text-sm">{expense.concept}</b><p className="mt-1 text-xs text-[#718078]">{receive ? t("finance.pending.owesYou", { name: participant }) : t("finance.pending.youOwe", { name: payer })}</p></div><b className="shrink-0 text-sm">{formatCurrency(share.amount, expense.currency)}</b></div><div className="mt-3 flex flex-wrap gap-2">{!receive && share.status === "pending" && <button disabled={Boolean(busy)} onClick={() => void act(expense.id, userId, "report")} className="min-h-10 flex-1 rounded-xl bg-[#176b46] px-3 text-xs font-bold text-white">{t("finance.pending.reportPaid")}</button>}{!receive && share.status === "reported_paid" && <span className="text-xs font-semibold text-[#718078]">{t("finance.pending.awaitingConfirmation")}</span>}{receive && share.status === "reported_paid" && <><button disabled={Boolean(busy)} onClick={() => void act(expense.id, share.user_id, "confirm")} className="min-h-10 flex-1 rounded-xl bg-[#176b46] px-3 text-xs font-bold text-white">{t("finance.pending.confirmPayment")}</button><button disabled={Boolean(busy)} onClick={() => void act(expense.id, share.user_id, "reject")} className="min-h-10 rounded-xl border border-black/10 px-3 text-xs font-bold">{t("finance.pending.notYet")}</button></>}</div></div>; })}</div></details>;
  return <section><div className="mb-3 flex items-end justify-between px-1"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Roomies</p><h2 className="mt-1 text-xl font-bold">{t("finance.pending.title")}</h2></div><button onClick={openRoomies} className="min-h-10 text-sm font-bold text-[#176b46]">{t("shopping.replacements.view")}</button></div><div className="space-y-3">{toPay.length > 0 && group(t("finance.pending.toPay"), toPay, false)}{toReceive.length > 0 && group(t("finance.pending.toReceive"), toReceive, true)}</div></section>;
}
