export type FridgeItem = {
  id: string;
  userId: string;
  barcode?: string;
  name: string;
  quantity?: number;
  unit?: string;
  customCategory?: import("./emoji").FoodFilterCategory;
  createdAt: string;
  updatedAt: string;
};

export type FridgeItemInput = Pick<FridgeItem, "name"> & Partial<Pick<FridgeItem, "barcode" | "quantity" | "unit">>;

export type LearnedCategoryRule = {
  normalizedName: string;
  category: import("./emoji").FoodFilterCategory;
};
