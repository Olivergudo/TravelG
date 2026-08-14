import type { RecipeSuggestion } from "./types";
import { createPdfDocument } from "@/lib/pdf/document";

export function recipeAsText(recipe: RecipeSuggestion) {
  const time = recipe.estimatedMinutes ? ` — ${recipe.estimatedMinutes} min` : "";
  const extras = recipe.missingIngredients.length ? `\n\nNecesitas comprar:\n${recipe.missingIngredients.map((item) => `- ${item}`).join("\n")}` : "";
  return `${recipe.title}${time}\n\nIngredientes:\n${recipe.ingredients.map((item) => `- ${item}`).join("\n")}${extras}\n\nPreparación:\n${recipe.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`;
}

export async function recipePdf(recipe: RecipeSuggestion) {
  const document = await createPdfDocument("Receta", recipe.title);
  if (recipe.estimatedMinutes) document.write(`${recipe.estimatedMinutes} min`, { color: [70, 90, 80] });
  document.section("Ingredientes"); recipe.ingredients.forEach((item) => document.write(`• ${item}`));
  if (recipe.missingIngredients.length) { document.section("Necesitas comprar"); recipe.missingIngredients.forEach((item) => document.write(`• ${item}`)); }
  document.section("Preparación"); recipe.steps.forEach((step, index) => document.write(`${index + 1}. ${step}`, { gap: 3 }));
  return document.finish();
}
