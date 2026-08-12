import type { AppData, PendingProduct, Purchase, PurchaseItem } from "./types";
const KEY = "gasto-listo-data-v1";
export const defaultCategories = [
  { id: "supermarket", name: "Supermercado", color: "#2f9d68", icon: "🛒" },
  { id: "transport", name: "Transporte", color: "#438de0", icon: "🚗" },
  { id: "restaurant", name: "Restaurante", color: "#e87945", icon: "🍽️" },
  { id: "nightlife", name: "Antro", color: "#a855c7", icon: "🍸" },
  { id: "home", name: "Casa", color: "#e7af32", icon: "🏠" },
  { id: "shopping", name: "Compras", color: "#db5c87", icon: "🛍️" },
  {
    id: "entertainment",
    name: "Entretenimiento",
    color: "#7767d8",
    icon: "🎮",
  },
  { id: "health", name: "Salud", color: "#dc5c5c", icon: "💊" },
  { id: "other", name: "Otro", color: "#718078", icon: "•••" },
];
const categories = defaultCategories;
export const emptyData: AppData = {
  schemaVersion: 2,
  expenses: [],
  categories,
  pendingProducts: [],
  purchases: [],
};
export interface DataRepository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}
type LegacyItem = {
  id: string;
  name: string;
  quantity?: number;
  completed?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
type LegacyList = { items?: LegacyItem[] };
type LegacySessionItem = {
  id?: string;
  shoppingItemId?: string;
  name: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  purchased?: boolean;
  createdAt?: string;
};
type LegacySession = {
  id: string;
  supermarketName?: string;
  startedAt: string;
  completedAt: string;
  total?: number;
  items?: LegacySessionItem[];
};
type Stored = Partial<AppData> & {
  lists?: LegacyList[];
  shoppingSessions?: LegacySession[];
};
const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalize = (name: string) =>
  name
    .trim()
    .toLocaleLowerCase("es-CL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
function migrate(value: unknown): AppData {
  if (!value || typeof value !== "object") return emptyData;
  const old = value as Stored;
  if (
    old.schemaVersion === 2 &&
    Array.isArray(old.pendingProducts) &&
    Array.isArray(old.purchases)
  ) {
    return { ...emptyData, ...old } as AppData;
  }
  if (Array.isArray(old.pendingProducts) && Array.isArray(old.purchases)) {
    const existing = Array.isArray(old.categories) ? old.categories : [];
    const mergedCategories = [
      ...defaultCategories,
      ...existing.filter((c) => !defaultCategories.some((d) => d.id === c.id)),
    ];
    const categoryMap: Record<string, string> = {
      food: "supermarket",
      fun: "entertainment",
    };
    return {
      schemaVersion: 2,
      expenses: Array.isArray(old.expenses)
        ? old.expenses.map((expense) => ({
            ...expense,
            categoryId: categoryMap[expense.categoryId] || expense.categoryId,
            source:
              expense.source || (expense.purchaseId ? "purchase" : "manual"),
          }))
        : [],
      categories: mergedCategories,
      pendingProducts: old.pendingProducts,
      purchases: old.purchases,
      activePurchase: old.activePurchase,
    };
  }
  const seen = new Set<string>();
  const pending: PendingProduct[] = [];
  (old.lists || [])
    .flatMap((l) => l.items || [])
    .filter((i) => !i.completed)
    .forEach((i) => {
      const key = normalize(i.name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const at = i.createdAt || new Date().toISOString();
      pending.push({
        id: i.id || uid(),
        name: i.name.trim(),
        normalizedName: key,
        defaultQuantity: i.quantity || 1,
        createdAt: at,
        updatedAt: i.updatedAt || at,
      });
    });
  const purchases: Purchase[] = (old.shoppingSessions || []).map((s) => {
    const items: PurchaseItem[] = (s.items || [])
      .filter((i) => i.purchased !== false && (i.unitPrice || 0) > 0)
      .map((i) => ({
        id: i.id || uid(),
        purchaseId: s.id,
        sourcePendingProductId: i.shoppingItemId,
        productName: i.name,
        normalizedName: normalize(i.name),
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || 0,
        totalPrice: i.totalPrice ?? (i.quantity || 1) * (i.unitPrice || 0),
        createdAt: i.createdAt || s.completedAt,
      }));
    return {
      id: s.id,
      supermarketName: s.supermarketName || "Sin registrar",
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      total: s.total ?? items.reduce((n, i) => n + i.totalPrice, 0),
      items,
    };
  });
  return {
    schemaVersion: 2,
    expenses: Array.isArray(old.expenses)
      ? old.expenses.map((expense) => ({
          ...expense,
          categoryId:
            expense.categoryId === "food"
              ? "supermarket"
              : expense.categoryId === "fun"
                ? "entertainment"
                : expense.categoryId,
          source: expense.source || "manual",
        }))
      : [],
    categories: defaultCategories,
    pendingProducts: pending,
    purchases,
  };
}
export class LocalRepository implements DataRepository {
  async load() {
    if (typeof window === "undefined") return emptyData;
    try {
      return migrate(JSON.parse(localStorage.getItem(KEY) || "null"));
    } catch {
      return emptyData;
    }
  }
  async save(data: AppData) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }
}
export const repository = new LocalRepository();
