import type { AppData, Expense, Purchase } from "./types";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const linkedPurchase = (data: AppData, expense: Expense) =>
  data.purchases.find(
    (purchase) =>
      purchase.id === expense.purchaseId || purchase.expenseId === expense.id,
  );

/** Guarda un gasto y mantiene su registro de Compras sincronizado. */
export function saveExpense(data: AppData, expense: Expense): AppData {
  const exists = data.expenses.some((item) => item.id === expense.id);
  const linked = linkedPurchase(data, expense);

  if (linked) {
    const synchronizedExpense = { ...expense, purchaseId: linked.id };
    return {
      ...data,
      expenses: exists
        ? data.expenses.map((item) =>
            item.id === expense.id ? synchronizedExpense : item,
          )
        : [synchronizedExpense, ...data.expenses],
      purchases: data.purchases.map((purchase) =>
        purchase.id === linked.id
          ? {
              ...purchase,
              supermarketName: expense.description,
              completedAt: expense.date,
              total: expense.amount,
              expenseId: expense.id,
            }
          : purchase,
      ),
    };
  }

  if (expense.categoryId === "supermarket") {
    const purchaseId = expense.purchaseId || uid();
    const synchronizedExpense = { ...expense, purchaseId };
    const purchase: Purchase = {
      id: purchaseId,
      supermarketName: expense.description,
      startedAt: expense.date,
      completedAt: expense.date,
      total: expense.amount,
      source: "manual",
      expenseId: expense.id,
      items: [],
    };
    return {
      ...data,
      expenses: exists
        ? data.expenses.map((item) =>
            item.id === expense.id ? synchronizedExpense : item,
          )
        : [synchronizedExpense, ...data.expenses],
      purchases: [purchase, ...data.purchases],
    };
  }

  return {
    ...data,
    expenses: exists
      ? data.expenses.map((item) => (item.id === expense.id ? expense : item))
      : [expense, ...data.expenses],
  };
}

/** Elimina el gasto y cualquier compra que represente el mismo movimiento. */
export function deleteExpense(data: AppData, expenseId: string): AppData {
  const expense = data.expenses.find((item) => item.id === expenseId);
  return {
    ...data,
    expenses: data.expenses.filter((item) => item.id !== expenseId),
    purchases: data.purchases.filter(
      (purchase) =>
        purchase.expenseId !== expenseId && purchase.id !== expense?.purchaseId,
    ),
  };
}
