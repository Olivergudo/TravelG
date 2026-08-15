import type { GroupExpense, RoomieObligations } from "./types";

export function paymentObligations(data: RoomieObligations, userId: string) {
  const active = (expense: GroupExpense) => expense.status !== "paid" && expense.status !== "cancelled";
  const toPay = data.groupExpenses.flatMap((expense) => active(expense) ? expense.group_expense_shares.filter((share) => share.user_id === userId && share.status !== "confirmed_paid").map((share) => ({ expense, share })) : []);
  const toReceive = data.groupExpenses.flatMap((expense) => active(expense) && expense.payer_id === userId ? expense.group_expense_shares.filter((share) => share.user_id !== userId && share.status !== "confirmed_paid").map((share) => ({ expense, share })) : []);
  return { toPay, toReceive };
}

export function roomieAttentionCount(data: RoomieObligations, userId: string) {
  const replacements = data.debts.filter((debt) => (debt.debtor_user_id === userId && debt.status === "pending") || (debt.owner_user_id === userId && debt.status === "awaiting_confirmation")).length;
  const payments = new Set([...paymentObligations(data, userId).toPay, ...paymentObligations(data, userId).toReceive].map(({ expense }) => expense.id)).size;
  return replacements + payments;
}
