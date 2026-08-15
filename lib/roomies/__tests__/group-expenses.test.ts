import assert from "node:assert/strict";
import test from "node:test";
import { buildExpenseShares } from "../group-expenses";

test("divide equitativamente sin perder centavos por redondeo", () => {
  const shares = buildExpenseShares(10, ["a", "b", "c"]);
  assert.deepEqual(shares.map((share) => share.amount), [2.5, 2.5, 2.5]);
  assert.equal(shares.reduce((sum, share) => sum + share.amount, 0), 7.5);
});

test("acepta una división personalizada cuya suma coincide", () => {
  assert.deepEqual(buildExpenseShares(874, ["a", "b"], { a: 300, b: 274 }), [
    { userId: "a", amount: 300 }, { userId: "b", amount: 274 },
  ]);
  assert.throws(() => buildExpenseShares(874, ["a", "b"], { a: 500, b: 400 }));
});

test("incluye al pagador al dividir entre dos personas", () => {
  assert.deepEqual(buildExpenseShares(10000, ["roomie"]), [{ userId: "roomie", amount: 5000 }]);
});
