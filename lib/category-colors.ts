import type { Category } from "./types";

export const categoryPalette = [
  "#4DC686", "#99DDA2", "#C1E0C5", "#E5E9E9",
  "#A1DBEE", "#C6F2EE", "#627887", "#827BDC",
] as const;

export const knownCategoryColors: Record<string, string> = {
  supermarket: "#4DC686",
  transport: "#A1DBEE",
  restaurant: "#99DDA2",
  nightlife: "#827BDC",
  home: "#C1E0C5",
  shopping: "#C6F2EE",
  entertainment: "#627887",
  health: "#E5E9E9",
  other: "#627887",
};

const legacyCategoryColors: Record<string, readonly string[]> = {
  supermarket: ["#1F8A5B", "#085621", "#0B132B", "#8CC6AE"],
  transport: ["#317A78", "#54F087", "#5BC0BE", "#C0DDBF"],
  restaurant: ["#268C82", "#0E9D3D", "#1C2541", "#C4E0CA"],
  nightlife: ["#4FAE9A", "#14E358", "#3A506B", "#DBE9CF"],
  home: ["#748E7A", "#E3E8EA", "#E1EEDD"],
  shopping: ["#3D8F76", "#8CC6AE"],
  entertainment: ["#176B50", "#B5BDC7", "#C0DDBF"],
  health: ["#55A995", "#8296C8", "#C4E0CA"],
  other: ["#7D8983", "#9AF6B8", "#4A7D88", "#DBE9CF"],
};

export const validCategoryHex = /^#[0-9a-f]{6}$/i;
const fallbackIndex = (value: string) => [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % categoryPalette.length;

export const getDefaultCategoryColor = (categoryId: string) =>
  knownCategoryColors[categoryId] || categoryPalette[fallbackIndex(categoryId)];

export const getCategoryColor = (category?: Pick<Category, "id" | "color">) => {
  if (!category) return knownCategoryColors.other;
  return validCategoryHex.test(category.color || "")
    ? category.color.toUpperCase()
    : getDefaultCategoryColor(category.id);
};

// Actualiza solamente colores predeterminados antiguos; respeta los elegidos por el usuario.
export const migrateCategoryColor = (category: Pick<Category, "id" | "color">) => {
  const currentColor = (category.color || "").toUpperCase();
  const isLegacyDefault = legacyCategoryColors[category.id]?.some(
    (color) => color.toUpperCase() === currentColor,
  );
  return isLegacyDefault ? getDefaultCategoryColor(category.id) : getCategoryColor(category);
};

export const withAlpha = (color: string, opacity: number) => {
  const safe = validCategoryHex.test(color) ? color.slice(1) : knownCategoryColors.other.slice(1);
  const red = Number.parseInt(safe.slice(0, 2), 16);
  const green = Number.parseInt(safe.slice(2, 4), 16);
  const blue = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
};

export const getCategorySoftColor = (category?: Pick<Category, "id" | "color">) => withAlpha(getCategoryColor(category), 0.14);
export const getCategoryBorderColor = (category?: Pick<Category, "id" | "color">) => withAlpha(getCategoryColor(category), 0.32);
