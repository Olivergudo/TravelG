const aliases: Record<string, string> = {
  jitomate: "tomate",
  jitomates: "tomate",
  scallion: "cebolla verde",
  "cebollin": "cebolla verde",
  "cebollines": "cebolla verde",
};

const removableDescriptors = new Set([
  "entera", "entero", "fresco", "fresca", "frescos", "frescas",
  "picado", "picada", "picados", "picadas", "rallado", "rallada",
  "grande", "grandes", "mediano", "mediana", "pequeno", "pequena",
]);

function singularize(word: string) {
  if (word.length > 4 && word.endsWith("ces")) return `${word.slice(0, -3)}z`;
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function normalizeIngredientName(value: string) {
  const normalized = value.trim().toLocaleLowerCase("es-CL").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const canonical = aliases[normalized] ?? normalized;
  return canonical.split(" ")
    .map(singularize)
    .filter((word) => word && !removableDescriptors.has(word))
    .join(" ");
}

export function ingredientsMatch(left: string, right: string) {
  const a = normalizeIngredientName(left);
  const b = normalizeIngredientName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const aWords = new Set(a.split(" "));
  const bWords = new Set(b.split(" "));
  const shorter = aWords.size <= bWords.size ? aWords : bWords;
  const longer = aWords.size <= bWords.size ? bWords : aWords;
  return [...shorter].every((word) => longer.has(word));
}

export function splitRecipeIngredients(required: string[], inventory: Array<{ name: string }>) {
  const available: string[] = [];
  const missing: string[] = [];
  for (const ingredient of required) {
    (inventory.some((item) => ingredientsMatch(ingredient, item.name)) ? available : missing).push(ingredient);
  }
  return { available, missing };
}

export function uniqueIngredients(values: string[]) {
  return values.filter((value, index) =>
    value.trim() && values.findIndex((candidate) => ingredientsMatch(candidate, value)) === index,
  );
}
