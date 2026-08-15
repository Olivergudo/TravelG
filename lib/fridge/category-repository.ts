"use client";

import { supabase } from "@/lib/supabase";
import type { FoodFilterCategory } from "./emoji";
import type { LearnedCategoryRule } from "./types";

const key = (userId: string) => `gasto-listo-category-rules-v1:${userId}`;
const read = (userId: string): LearnedCategoryRule[] => {
  try { return JSON.parse(localStorage.getItem(key(userId)) || "[]") as LearnedCategoryRule[]; } catch { return []; }
};
const cache = (userId: string, rules: LearnedCategoryRule[]) => localStorage.setItem(key(userId), JSON.stringify(rules));
const rulesTableIsMissing = (error: { code?: string; message?: string; details?: string }) => {
  const text = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" ||
    (text.includes("fridge_category_rules") && (text.includes("does not exist") || text.includes("schema cache")));
};

export const categoryRuleRepository = {
  local: read,
  async load(userId: string) {
    if (!supabase) return read(userId);
    const { data, error } = await supabase.from("fridge_category_rules")
      .select("normalized_name,category").eq("user_id", userId).limit(500);
    if (error) return read(userId);
    const rules = (data || []).map((row) => ({ normalizedName: String(row.normalized_name), category: row.category as FoodFilterCategory }));
    cache(userId, rules);
    return rules;
  },
  async save(userId: string, rule: LearnedCategoryRule, current: LearnedCategoryRule[]) {
    const next = [...current.filter((item) => item.normalizedName !== rule.normalizedName), rule];
    cache(userId, next);
    if (supabase) {
      const { error } = await supabase.from("fridge_category_rules").upsert({ user_id: userId, normalized_name: rule.normalizedName, category: rule.category, updated_at: new Date().toISOString() }, { onConflict: "user_id,normalized_name" });
      if (error && !rulesTableIsMissing(error)) { cache(userId, current); throw error; }
    }
    return next;
  },
};
