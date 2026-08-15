import assert from "node:assert/strict";
import test from "node:test";
import { paymentObligations, roomieAttentionCount } from "../obligations";
import type { RoomieObligations } from "../types";

const base: RoomieObligations = {
  householdId: "home",
  members: [],
  debts: [{ id: "d1", household_id: "home", debtor_user_id: "debtor", owner_user_id: "owner", product_name: "Leche", status: "pending", created_at: "", replacement_reported_at: null, resolved_at: null, confirmed_by: null, purchased_at: "2026-08-15" }],
  groupExpenses: [{ id: "e1", household_id: "home", creator_id: "owner", payer_id: "owner", concept: "Internet", total_amount: 30, currency: "USD", category: null, notes: null, status: "partially_paid", created_at: "", resolved_at: null, group_expense_shares: [
    { id: "s1", expense_id: "e1", user_id: "a", amount: 10, status: "confirmed_paid", reported_at: "", confirmed_at: "" },
    { id: "s2", expense_id: "e1", user_id: "b", amount: 10, status: "reported_paid", reported_at: "", confirmed_at: null },
  ] }],
};

test("una reposición comprada sigue activa hasta la confirmación", () => {
  assert.equal(roomieAttentionCount(base, "debtor"), 1);
  assert.equal(roomieAttentionCount({ ...base, debts: [{ ...base.debts[0], status: "resolved" }] }, "debtor"), 0);
});

test("la confirmación se calcula por participante sin cerrar las demás cuotas", () => {
  assert.equal(paymentObligations(base, "a").toPay.length, 0);
  assert.equal(paymentObligations(base, "b").toPay.length, 1);
  assert.equal(paymentObligations(base, "owner").toReceive.length, 1);
});
