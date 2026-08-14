import type { RecipeSuggestion } from "./types";

export function recipeAsText(recipe: RecipeSuggestion) {
  const time = recipe.estimatedMinutes ? ` — ${recipe.estimatedMinutes} min` : "";
  const extras = recipe.missingIngredients.length ? `\n\nNecesitas comprar:\n${recipe.missingIngredients.map((item) => `- ${item}`).join("\n")}` : "";
  return `${recipe.title}${time}\n\nIngredientes:\n${recipe.ingredients.map((item) => `- ${item}`).join("\n")}${extras}\n\nPreparación:\n${recipe.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`;
}

export async function recipePdf(recipe: RecipeSuggestion) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 52, width = 595 - margin * 2, bottom = 790;
  let y = 62;
  const lines = (text: string, size = 11) => { pdf.setFontSize(size); const chunks = pdf.splitTextToSize(text, width) as string[]; for (const chunk of chunks) { if (y > bottom) { pdf.addPage(); y = 58; } pdf.text(chunk, margin, y); y += size * 1.45; } };
  pdf.setTextColor(23, 61, 45); pdf.setFont("helvetica", "bold"); lines(recipe.title, 22);
  if (recipe.estimatedMinutes) { pdf.setTextColor(70, 90, 80); pdf.setFont("helvetica", "normal"); lines(`${recipe.estimatedMinutes} min`, 11); }
  y += 14; pdf.setTextColor(23, 35, 29); pdf.setFont("helvetica", "bold"); lines("INGREDIENTES", 12);
  pdf.setFont("helvetica", "normal"); recipe.ingredients.forEach((item) => lines(`• ${item}`));
  if (recipe.missingIngredients.length) { y += 12; pdf.setFont("helvetica", "bold"); lines("NECESITAS COMPRAR", 12); pdf.setFont("helvetica", "normal"); recipe.missingIngredients.forEach((item) => lines(`• ${item}`)); }
  y += 12; pdf.setFont("helvetica", "bold"); lines("PREPARACIÓN", 12); pdf.setFont("helvetica", "normal"); recipe.steps.forEach((step, index) => lines(`${index + 1}. ${step}`));
  y += 20; pdf.setTextColor(110, 125, 117); lines("Generado con Gasto Listo", 9);
  return pdf.output("blob");
}
