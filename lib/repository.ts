import type { AppData, Category, Purchase, PurchaseItem, ShoppingListItem } from "./types";
import { isSupabaseConfigured, supabase } from "./supabase";
import { getCategoryColor, knownCategoryColors } from "./category-colors";
const KEY = "gasto-listo-data-v1";
export const defaultCategories = [
  { id: "supermarket", name: "Supermercado", color: "#1F8A5B", icon: "🛒" },
  { id: "transport", name: "Transporte", color: "#317A78", icon: "🚗" },
  { id: "restaurant", name: "Restaurante", color: "#268C82", icon: "🍽️" },
  { id: "nightlife", name: "Antro", color: "#4FAE9A", icon: "🍸" },
  { id: "home", name: "Casa", color: "#748E7A", icon: "🏠" },
  { id: "shopping", name: "Compras", color: "#3D8F76", icon: "🛍️" },
  {
    id: "entertainment",
    name: "Entretenimiento",
    color: "#176B50",
    icon: "🎮",
  },
  { id: "health", name: "Salud", color: "#55A995", icon: "💊" },
  { id: "other", name: "Otro", color: "#7D8983", icon: "•••" },
];
const categories = defaultCategories;
export const emptyData: AppData = {
  schemaVersion: 3,
  expenses: [],
  categories,
  shoppingListItems: [],
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
  pendingProducts?: Array<Partial<ShoppingListItem> & { id: string; name: string; checked?: boolean }>;
  activePurchase?: unknown;
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
  if (Array.isArray(old.shoppingListItems) && Array.isArray(old.purchases)) {
    return {
      ...emptyData,
      ...old,
      categories: (old.categories || defaultCategories).map((value) => {
        const category = value as Category;
        return {
          ...category,
          color: knownCategoryColors[category.id] || getCategoryColor(category),
          name: category.name || "",
          emoji: category.emoji || category.icon || "💸",
          icon: category.emoji || category.icon || "💸",
        };
      }),
      schemaVersion: 3,
      shoppingListItems: old.shoppingListItems.map((item) => ({
        id: item.id,
        name: item.name,
        completed: Boolean(item.completed),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    } as AppData;
  }
  if (Array.isArray(old.pendingProducts) && Array.isArray(old.purchases)) {
    const existing = Array.isArray(old.categories) ? old.categories : [];
    const mergedCategories = [
      ...defaultCategories,
      ...existing.filter((c) => !defaultCategories.some((d) => d.id === c.id)),
    ].map((category) => ({ ...category, color: knownCategoryColors[category.id] || getCategoryColor(category) }));
    const categoryMap: Record<string, string> = {
      food: "supermarket",
      fun: "entertainment",
    };
    return {
      schemaVersion: 3,
      expenses: Array.isArray(old.expenses)
        ? old.expenses.map((expense) => ({
            ...expense,
            categoryId: categoryMap[expense.categoryId] || expense.categoryId,
            source:
              expense.source || (expense.purchaseId ? "purchase" : "manual"),
          }))
        : [],
      categories: mergedCategories,
      shoppingListItems: old.pendingProducts.map((item) => ({
        id: item.id,
        name: item.name,
        completed: Boolean(item.completed ?? item.checked),
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      })),
      purchases: old.purchases,
    };
  }
  const seen = new Set<string>();
  const pending: ShoppingListItem[] = [];
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
        completed: false,
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
    schemaVersion: 3,
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
    shoppingListItems: pending,
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

class SupabaseRepository implements DataRepository {
  private local = new LocalRepository();
  private saveQueue: Promise<void> = Promise.resolve();

  private async userId() {
    if (!supabase) throw new Error("Supabase no está configurado");

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user.id) return sessionData.session.user.id;

    throw new Error("Debes iniciar sesión para acceder a tus datos");
  }

  async load(): Promise<AppData> {
    if (!supabase) return this.local.load();

    const userId = await this.userId();
    const { data, error } = await supabase.rpc("load_app_data");

    if (error) throw error;
    if (data) {
      const remote = migrate(data);
      const local = await this.local.load();
      const hasContent = (value: AppData) =>
        value.expenses.length > 0 ||
        value.shoppingListItems.length > 0 ||
        value.purchases.length > 0;

      // Safari y una PWA instalada pueden tener almacenamientos separados.
      // Si Safari creó una cuenta vacía, recupera y sube los datos de la PWA.
      if (hasContent(local) && !hasContent(remote)) {
        await this.write(local);
        return local;
      }
      const localCompleted = new Map(
        local.shoppingListItems.map((item) => [item.id, item.completed]),
      );
      return {
        ...remote,
        shoppingListItems: remote.shoppingListItems.map((item) => ({
          ...item,
          completed: item.completed ?? localCompleted.get(item.id) ?? false,
        })),
      };
    }

    // Primera conexión: sube automáticamente los datos existentes del navegador.
    const { data: legacy } = await supabase
      .from("app_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    const initialData = legacy?.data
      ? migrate(legacy.data)
      : await this.local.load();
    await this.write(initialData);
    return initialData;
  }

  async save(data: AppData): Promise<void> {
    // Serializa las escrituras para que una actualización lenta no pise a la nueva.
    this.saveQueue = this.saveQueue
      .catch(() => undefined)
      .then(async () => {
        await this.userId();
        await this.write(data);
        await this.local.save(data);
      });
    return this.saveQueue;
  }

  private async write(data: AppData) {
    if (!supabase) return;
    const payload = {
      ...data,
      schemaVersion: 3,
      pendingProducts: data.shoppingListItems.map((item) => ({
        id: item.id,
        name: item.name,
        normalizedName: normalize(item.name),
        defaultQuantity: 1,
        checked: item.completed,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      categories: data.categories.map((category) => ({
        ...category,
        name: category.name || "",
        emoji: category.emoji || category.icon || "💸",
        icon: category.emoji || category.icon || "💸",
      })),
    };
    const { error } = await supabase.rpc("save_app_data", { payload });
    if (error) throw error;
  }
}

export const repository: DataRepository = isSupabaseConfigured
  ? new SupabaseRepository()
  : new LocalRepository();
