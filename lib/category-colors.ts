import type { Category } from "./types";

export const categoryPalette = [
  "#1F8A5B", "#268C82", "#4FAE9A", "#317A78",
  "#748E7A", "#176B50", "#55A995", "#7D8983",
] as const;

export const knownCategoryColors: Record<string, string> = {
  supermarket: "#1F8A5B",
  restaurant: "#268C82",
  nightlife: "#4FAE9A",
  transport: "#317A78",
  home: "#748E7A",
  entertainment: "#176B50",
  health: "#55A995",
  other: "#7D8983",
  shopping: "#3D8F76",
};

const validHex = /^#[0-9a-f]{6}$/i;
const fallbackIndex = (value: string) => [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % categoryPalette.length;

export const getCategoryColor = (category?: Pick<Category, "id" | "color">) => {
  if (!category) return knownCategoryColors.other;
  return validHex.test(category.color || "")
    ? category.color.toUpperCase()
    : knownCategoryColors[category.id] || categoryPalette[fallbackIndex(category.id)];
};

export const withAlpha = (color: string, opacity: number) => {
  const safe = validHex.test(color) ? color.slice(1) : knownCategoryColors.other.slice(1);
  const red = Number.parseInt(safe.slice(0, 2), 16);
  const green = Number.parseInt(safe.slice(2, 4), 16);
  const blue = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
};

export const getCategorySoftColor = (category?: Pick<Category, "id" | "color">) => withAlpha(getCategoryColor(category), 0.14);
export const getCategoryBorderColor = (category?: Pick<Category, "id" | "color">) => withAlpha(getCategoryColor(category), 0.32);
