import type { ReplacementDebt } from "./types";

export function getUserPendingDebts(debts: ReplacementDebt[], userId: string) {
  return debts.filter((debt) =>
    debt.status !== "resolved" &&
    (debt.debtor_user_id === userId || debt.owner_user_id === userId),
  );
}
