export type FridgeItem = {
  id: string;
  userId: string;
  barcode?: string;
  name: string;
  quantity?: number;
  unit?: string;
  createdAt: string;
  updatedAt: string;
};

export type FridgeItemInput = Pick<FridgeItem, "name"> & Partial<Pick<FridgeItem, "barcode" | "quantity" | "unit">>;
