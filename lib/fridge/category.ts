import { normalizeTicketProductName } from "@/lib/food-classifier";
import { getFoodFilterCategory, getFoodVisual, getFilterCategoryEmoji, type FoodFilterCategory, type FoodVisual } from "./emoji";
import type { FridgeItem, LearnedCategoryRule } from "./types";

export function normalizeCategoryRuleName(name: string) {
  return normalizeTicketProductName(name);
}

export function resolveProductCategory(item: Pick<FridgeItem, "name" | "customCategory">, rules: LearnedCategoryRule[]): FoodFilterCategory {
  if (item.customCategory) return item.customCategory;
  const normalizedName = normalizeCategoryRuleName(item.name);
  return rules.find((rule) => rule.normalizedName === normalizedName)?.category ?? getFoodFilterCategory(item.name);
}

export function resolveProductVisual(item: Pick<FridgeItem, "name" | "customCategory">, rules: LearnedCategoryRule[]): FoodVisual {
  const resolved = resolveProductCategory(item, rules);
  if (item.customCategory || rules.some((rule) => rule.normalizedName === normalizeCategoryRuleName(item.name)))
    return { category: resolved, emoji: getFilterCategoryEmoji(resolved) };
  return getFoodVisual(item.name);
}
