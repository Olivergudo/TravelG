import assert from "node:assert/strict";
import test from "node:test";
import { getUserPendingDebts } from "../pending";
import type { ReplacementDebt } from "../types";

const debt = (overrides: Partial<ReplacementDebt>): ReplacementDebt => ({
  id: "debt-1",
  household_id: "home-1",
  debtor_user_id: "debtor",
  owner_user_id: "owner",
  product_name: "Leche",
  status: "pending",
  created_at: "2026-08-15T12:00:00.000Z",
  replacement_reported_at: null,
  resolved_at: null,
  confirmed_by: null,
  ...overrides,
});

test("muestra pendientes al responsable y al propietario, pero no a terceros", () => {
  const debts = [debt({})];
  assert.equal(getUserPendingDebts(debts, "debtor").length, 1);
  assert.equal(getUserPendingDebts(debts, "owner").length, 1);
  assert.equal(getUserPendingDebts(debts, "other").length, 0);
});

test("mantiene la alerta mientras espera confirmación y la elimina al resolverse", () => {
  const awaiting = debt({ status: "awaiting_confirmation" });
  const resolved = debt({ id: "debt-2", status: "resolved", resolved_at: "2026-08-15T13:00:00.000Z" });
  assert.deepEqual(getUserPendingDebts([awaiting, resolved], "owner").map((item) => item.id), ["debt-1"]);
});
