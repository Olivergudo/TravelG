import type { RecipeSuggestion } from "./types";

export type SavedRecipe = RecipeSuggestion & {
  id: string;
  userId: string;
  fingerprint: string;
  createdAt: string;
};

export function recipeFingerprint(recipe: RecipeSuggestion) {
  const source = JSON.stringify({
    title: recipe.title.trim().toLocaleLowerCase("es-CL"),
    ingredients: recipe.ingredients.map((item) => item.trim().toLocaleLowerCase("es-CL")),
    steps: recipe.steps.map((item) => item.trim().toLocaleLowerCase("es-CL")),
  });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `recipe-${(hash >>> 0).toString(16)}`;
}
