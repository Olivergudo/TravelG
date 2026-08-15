import assert from "node:assert/strict";
import test from "node:test";
import { buildExpenseShares } from "../group-expenses";

test("divide equitativamente sin perder centavos por redondeo", () => {
  const shares = buildExpenseShares(10, ["a", "b", "c"]);
  assert.deepEqual(shares.map((share) => share.amount), [3.33, 3.33, 3.34]);
  assert.equal(shares.reduce((sum, share) => sum + share.amount, 0), 10);
});

test("acepta una división personalizada cuya suma coincide", () => {
  assert.deepEqual(buildExpenseShares(874, ["a", "b"], { a: 500, b: 374 }), [
    { userId: "a", amount: 500 }, { userId: "b", amount: 374 },
  ]);
  assert.throws(() => buildExpenseShares(874, ["a", "b"], { a: 500, b: 300 }));
});
