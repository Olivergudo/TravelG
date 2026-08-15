"use client";

import { supabase } from "@/lib/supabase";
import type { RecipeSuggestion } from "./types";
import { recipeFingerprint, type SavedRecipe } from "./saved-types";

const cacheKey = (userId: string) => `gasto-listo-saved-recipes-v1:${userId}`;
const readLocal = (userId: string): SavedRecipe[] => {
  try {
    const recipes = JSON.parse(localStorage.getItem(cacheKey(userId)) || "[]") as SavedRecipe[];
    return recipes.map((recipe) => ({ ...recipe, optionalIngredients: recipe.optionalIngredients ?? [] }));
  } catch { return []; }
};
const cache = (userId: string, recipes: SavedRecipe[]) => localStorage.setItem(cacheKey(userId), JSON.stringify(recipes));
const fromRow = (row: Record<string, unknown>): SavedRecipe => {
  const extras = row.extra_ingredients;
  const extraData = extras && !Array.isArray(extras) && typeof extras === "object" ? extras as Record<string, unknown> : {};
  return ({
  id: String(row.id), userId: String(row.user_id), fingerprint: String(row.fingerprint),
  title: String(row.name), description: String(row.description), reason: String(row.reason || ""),
  estimatedMinutes: row.estimated_minutes == null ? null : Number(row.estimated_minutes),
  ingredients: Array.isArray(row.ingredients_used) ? row.ingredients_used.map(String) : [],
  missingIngredients: Array.isArray(extras) ? extras.map(String) : Array.isArray(extraData.missingIngredients) ? extraData.missingIngredients.map(String) : [],
  optionalIngredients: Array.isArray(extraData.optionalIngredients) ? extraData.optionalIngredients.map(String) : [],
  steps: Array.isArray(row.steps) ? row.steps.map(String) : [], createdAt: String(row.created_at),
  });
};

export const savedRecipeRepository = {
  local: readLocal,
  async load(userId: string) {
    if (!supabase) return readLocal(userId);
    const { data, error } = await supabase.from("saved_recipes").select("id,user_id,fingerprint,name,description,estimated_minutes,reason,ingredients_used,extra_ingredients,steps,created_at").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) return readLocal(userId);
    const recipes = (data || []).map((row) => fromRow(row)); cache(userId, recipes); return recipes;
  },
  async save(userId: string, recipe: RecipeSuggestion, current: SavedRecipe[]) {
    const fingerprint = recipeFingerprint(recipe);
    const existing = current.find((item) => item.fingerprint === fingerprint);
    if (existing) return { recipes: current, saved: existing };
    const saved: SavedRecipe = { ...recipe, id: crypto.randomUUID(), userId, fingerprint, createdAt: new Date().toISOString() };
    const recipes = [saved, ...current]; cache(userId, recipes);
    if (supabase) await supabase.from("saved_recipes").upsert({ id: saved.id, user_id: userId, fingerprint, name: saved.title, description: saved.description, estimated_minutes: saved.estimatedMinutes, reason: saved.reason, ingredients_used: saved.ingredients, extra_ingredients: { missingIngredients: saved.missingIngredients, optionalIngredients: saved.optionalIngredients ?? [] }, steps: saved.steps, created_at: saved.createdAt }, { onConflict: "user_id,fingerprint" });
    return { recipes, saved };
  },
  async remove(userId: string, id: string, current: SavedRecipe[]) {
    const recipes = current.filter((item) => item.id !== id); cache(userId, recipes);
    if (supabase) await supabase.from("saved_recipes").delete().eq("user_id", userId).eq("id", id);
    return recipes;
  },
};
