import type { User } from "@supabase/supabase-js";

export type Plan = "basic" | "pro";
export type Feature = "barcodeScanner" | "fridge" | "aiRecipes";

export const FEATURES: Record<Feature, Plan> = {
  barcodeScanner: "pro",
  fridge: "pro",
  aiRecipes: "pro",
};

export type UserEntitlements = Pick<User, "id"> & {
  plan: Plan;
  proExpiresAt?: string | null;
};

export function canUseFeature(user: UserEntitlements, feature: Feature) {
  const requiredPlan = FEATURES[feature];
  if (requiredPlan === "basic") return true;
  if (user.plan !== "pro") return false;
  return !user.proExpiresAt || new Date(user.proExpiresAt).getTime() > Date.now();
}
