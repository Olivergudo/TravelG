import { z } from "zod";

export const recipeSuggestionSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(240),
  estimatedMinutes: z.number().int().positive().max(360).nullable(),
  ingredients: z.array(z.string().min(1).max(100)).max(20),
  missingIngredients: z.array(z.string().min(1).max(100)).max(1),
  steps: z.array(z.string().min(1).max(300)).min(1).max(10),
});

export const recipeResponseSchema = z.object({
  suggestions: z.array(recipeSuggestionSchema).max(3),
});
export type RecipeSuggestion = z.infer<typeof recipeSuggestionSchema>;
