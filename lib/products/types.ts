export type CachedProduct = {
  barcode: string;
  name: string;
  brand?: string;
  quantityText?: string;
  category?: string;
  source: "local" | "supabase" | "open_food_facts" | "user";
  updatedAt?: string;
};

export type ProductLookup = { found: true; product: CachedProduct; cache: "local" | "supabase" | "open_food_facts" } | { found: false; barcode: string };
