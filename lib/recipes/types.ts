import { z } from "zod";

export const recipeSuggestionSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(240),
  reason: z.string().max(240).optional().default(""),
  estimatedMinutes: z.number().int().positive().max(360).nullable(),
  ingredients: z.array(z.string().min(1).max(100)).max(20),
  missingIngredients: z.array(z.string().min(1).max(100)).max(3),
  steps: z.array(z.string().min(1).max(300)).min(1).max(10),
});

export const recipeResponseSchema = z.object({
  suggestions: z.array(recipeSuggestionSchema).min(1).max(3),
});
export type RecipeSuggestion = z.infer<typeof recipeSuggestionSchema>;
export type RecipeGenerationResult =
  | { status: "ok"; suggestions: RecipeSuggestion[] }
  | { status: "insufficient_ingredients"; suggestions: [] };

export function parseRecipeResponse(payload: unknown): { suggestions: RecipeSuggestion[] } {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const candidates = Array.isArray(root.suggestions) ? root.suggestions : Array.isArray(root.recipes) ? root.recipes : [];
  const suggestions = candidates.slice(0, 3).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const value = candidate as Record<string, unknown>;
    const rawTime = value.estimatedMinutes ?? value.estimatedTime;
    const parsedTime = typeof rawTime === "number" ? rawTime : typeof rawTime === "string" ? Number(rawTime.match(/\d+/)?.[0]) : null;
    const normalized = {
      title: value.title ?? value.name,
      description: value.description ?? value.reason ?? value.title ?? value.name,
      reason: value.reason ?? value.description ?? "",
      estimatedMinutes: Number.isFinite(parsedTime) ? parsedTime : null,
      ingredients: value.ingredients ?? value.ingredientsUsed ?? [],
      missingIngredients: value.missingIngredients ?? value.extraIngredients ?? [],
      steps: value.steps,
    };
    const parsed = recipeSuggestionSchema.safeParse(normalized);
    return parsed.success ? [parsed.data] : [];
  });
  return recipeResponseSchema.parse({ suggestions });
}

export function parseRecipeGenerationResult(payload: unknown): RecipeGenerationResult {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (root.status === "insufficient_ingredients")
    return { status: "insufficient_ingredients", suggestions: [] };
  const parsed = parseRecipeResponse(payload);
  return { status: "ok", suggestions: parsed.suggestions };
}
