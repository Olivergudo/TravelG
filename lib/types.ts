export type Category = {
  id: string;
  name?: string;
  color: string;
  emoji?: string;
  /** Campo legado; se conserva para sincronizar datos existentes. */
  icon?: string;
};
export type Expense = {
  id: string;
  description: string;
  amount: number;
  categoryId: string;
  date: string;
  time?: string;
  source?: "manual" | "purchase" | "receipt";
  purchaseId?: string;
  createdAt: string;
  updatedAt: string;
};
export type ShoppingListItem = {
  id: string;
  name: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};
export type PurchaseItem = {
  id: string;
  purchaseId: string;
  sourcePendingProductId?: string;
  productName: string;
  rawProductName?: string;
  normalizedName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;
};
export type Purchase = {
  id: string;
  supermarketName: string;
  startedAt: string;
  completedAt: string;
  total: number;
  source?: "manual" | "receipt";
  expenseId?: string;
  items: PurchaseItem[];
};
export type AppData = {
  schemaVersion: 3;
  expenses: Expense[];
  categories: Category[];
  shoppingListItems: ShoppingListItem[];
  purchases: Purchase[];
};
export type ScannedReceiptItem = {
  id: string;
  rawName: string;
  displayName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  confidence?: number;
  matchedPendingProductId?: string;
};
export type ScannedReceipt = {
  merchantName: string;
  date?: string;
  time?: string;
  items: ScannedReceiptItem[];
  subtotal?: number;
  total: number;
  confidence?: number;
};
