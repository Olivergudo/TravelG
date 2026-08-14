import { supabase } from "@/lib/supabase";
import { parseRecipeGenerationResult, type RecipeGenerationResult } from "./types";
import type { AppLanguage } from "@/lib/i18n";

export const RecipeService = {
  async generate(input: {
    mealType: "desayuno" | "comida" | "cena";
    preferences: string[];
    craving?: string;
    ingredientMode: "available_only" | "allow_extras";
    language: AppLanguage;
    availableIngredients: Array<{ name: string; quantity?: number; unit?: string }>;
  }): Promise<RecipeGenerationResult> {
    const token = (await supabase?.auth.getSession())?.data.session
      ?.access_token;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 35_000);
    console.debug("[recipes] generate clicked");
    console.debug("[recipes] request payload", {
      mealType: input.mealType,
      preferences: input.preferences,
      ingredientMode: input.ingredientMode,
      hasCraving: Boolean(input.craving),
      inventoryCount: input.availableIngredients.length,
    });
    let response: Response;
    try {
      response = await fetch("/api/recipes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        throw new Error("La generación tardó demasiado. Intenta nuevamente.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    console.debug("[recipes] response status", response.status);
    const body: unknown = await response.json().catch((error) => {
      console.error("[recipes] invalid JSON", error);
      throw new Error("El servicio devolvió una respuesta inválida.");
    });
    if (!response.ok)
      throw new Error(
        (body as { error?: string }).error || "No pudimos crear recetas ahora.",
      );
    const result = parseRecipeGenerationResult(body);
    if (result.status === "insufficient_ingredients") return result;
    const recipes = result.suggestions.map((recipe) => ({
      ...recipe,
      reason: recipe.reason || recipe.description,
    }));
    console.debug("[recipes] parsed recipes", recipes.length);
    return { status: "ok", suggestions: recipes };
  },
};
