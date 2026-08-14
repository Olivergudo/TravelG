import { supabase } from "@/lib/supabase";
import { recipeResponseSchema, type RecipeSuggestion } from "./types";

export const RecipeService = {
  async generate(
    items: Array<{ name: string; quantity?: number; unit?: string }>,
    preference?: string,
    craving?: string,
  ): Promise<RecipeSuggestion[]> {
    const token = (await supabase?.auth.getSession())?.data.session
      ?.access_token;
    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ items, preference, craving }),
    });
    const body: unknown = await response.json();
    if (!response.ok)
      throw new Error(
        (body as { error?: string }).error || "No pudimos crear recetas ahora.",
      );
    return recipeResponseSchema.parse(body).suggestions;
  },
};
