import { classifyTicketProduct, normalizeTicketProductName } from "../food-classifier";
import type { FoodCategory } from "../food-classifier";

export type FoodVisual = { category: string; emoji: string };
export type FoodFilterCategory = "produce" | "meat" | "dairy" | "bakery" | "seasoning" | "drink" | "other";
type VisualRule = FoodVisual & { keywords: string[]; priority: number };

const rules: VisualRule[] = [
  { keywords: ["aderezo", "dressing"], category: "sauce", emoji: "🥗", priority: 110 },
  { keywords: ["ketchup", "catsup", "tomato ketchup"], category: "sauce", emoji: "🍅", priority: 110 },
  { keywords: ["mayonesa", "mayo", "mostaza"], category: "sauce", emoji: "🫙", priority: 105 },
  { keywords: ["sal ajo", "oregano", "paprika", "pimienta", "comino", "curcuma", "curry", "sazonador", "condimento"], category: "seasoning", emoji: "🧂", priority: 105 },
  { keywords: ["trix", "corn flakes", "chocapic", "zucaritas"], category: "cereal", emoji: "🥣", priority: 105 },
  { keywords: ["nutella"], category: "sweet", emoji: "🍫", priority: 105 },
  { keywords: ["coca cola", "pepsi", "sprite", "fanta"], category: "drink", emoji: "🥤", priority: 105 },
  { keywords: ["aceite", "olive oil"], category: "oil", emoji: "🫒", priority: 100 },
  { keywords: ["queso", "cheese"], category: "cheese", emoji: "🧀", priority: 95 },
  { keywords: ["leche", "milk", "yogur", "yogurt"], category: "dairy", emoji: "🥛", priority: 90 },
  { keywords: ["huevo", "huevos", "egg", "eggs"], category: "egg", emoji: "🥚", priority: 90 },
  { keywords: ["pollo", "chicken"], category: "chicken", emoji: "🍗", priority: 90 },
  { keywords: ["carne", "res", "beef", "vacuno", "cerdo"], category: "meat", emoji: "🥩", priority: 85 },
  { keywords: ["pescado", "salmon", "atun", "merluza", "seafood"], category: "seafood", emoji: "🐟", priority: 85 },
  { keywords: ["arroz", "rice"], category: "rice", emoji: "🍚", priority: 85 },
  { keywords: ["pasta", "spaghetti", "espagueti", "fideos"], category: "pasta", emoji: "🍝", priority: 85 },
  { keywords: ["pan", "bread", "marraqueta", "hallulla"], category: "bread", emoji: "🍞", priority: 85 },
  { keywords: ["cebolla", "onion"], category: "vegetable", emoji: "🧅", priority: 80 },
  { keywords: ["papa", "patata", "potato"], category: "vegetable", emoji: "🥔", priority: 80 },
  { keywords: ["manzana", "apple"], category: "fruit", emoji: "🍎", priority: 80 },
  { keywords: ["platano", "banana"], category: "fruit", emoji: "🍌", priority: 80 },
  { keywords: ["naranja", "orange"], category: "fruit", emoji: "🍊", priority: 80 },
  { keywords: ["limon", "lemon"], category: "fruit", emoji: "🍋", priority: 80 },
  { keywords: ["brocoli"], category: "vegetable", emoji: "🥦", priority: 80 },
  { keywords: ["lechuga", "lettuce"], category: "vegetable", emoji: "🥬", priority: 80 },
  { keywords: ["zanahoria", "carrot"], category: "vegetable", emoji: "🥕", priority: 80 },
  { keywords: ["maiz", "corn", "choclo", "elote"], category: "vegetable", emoji: "🌽", priority: 80 },
  { keywords: ["cereal", "granola"], category: "cereal", emoji: "🥣", priority: 80 },
  { keywords: ["galleta", "cookie"], category: "sweet", emoji: "🍪", priority: 80 },
  { keywords: ["chocolate"], category: "sweet", emoji: "🍫", priority: 80 },
  { keywords: ["cafe"], category: "drink", emoji: "☕", priority: 80 },
  { keywords: ["agua"], category: "drink", emoji: "💧", priority: 80 },
  { keywords: ["refresco", "soda", "bebida", "gaseosa"], category: "drink", emoji: "🥤", priority: 75 },
  { keywords: ["cerveza"], category: "drink", emoji: "🍺", priority: 80 },
  { keywords: ["vino"], category: "drink", emoji: "🍷", priority: 80 },
  { keywords: ["aguacate", "palta", "avocado"], category: "fruit", emoji: "🥑", priority: 60 },
  { keywords: ["ajo", "garlic"], category: "seasoning", emoji: "🧄", priority: 55 },
].sort((left, right) => right.priority - left.priority);

const categoryVisuals: Partial<Record<FoodCategory, FoodVisual>> = {
  fruit: { category: "fruit", emoji: "🍎" }, vegetable: { category: "vegetable", emoji: "🥬" },
  meat: { category: "meat", emoji: "🥩" }, seafood: { category: "seafood", emoji: "🐟" },
  dairy: { category: "dairy", emoji: "🥛" }, egg: { category: "egg", emoji: "🥚" },
  bakery: { category: "bread", emoji: "🍞" }, grain: { category: "grain", emoji: "🌾" },
  sauce: { category: "sauce", emoji: "🫙" }, spice: { category: "seasoning", emoji: "🧂" },
  beverage: { category: "drink", emoji: "🥤" }, sweet: { category: "sweet", emoji: "🍫" },
  frozen: { category: "frozen", emoji: "❄️" },
};

const hasKeyword = (value: string, keyword: string) =>
  ` ${value} `.includes(` ${normalizeTicketProductName(keyword)} `);

export function getFoodVisual(name: string): FoodVisual {
  const normalized = normalizeTicketProductName(name);
  const match = rules.find((rule) => rule.keywords.some((keyword) => hasKeyword(normalized, keyword)));
  if (match) return { category: match.category, emoji: match.emoji };
  const classified = classifyTicketProduct(name);
  if (classified.classification === "food" && classified.category)
    return categoryVisuals[classified.category] || { category: classified.category, emoji: classified.emoji || "🍴" };
  return { category: "other_food", emoji: "🍴" };
}

export function getFoodFilterCategory(name: string): FoodFilterCategory {
  const category = getFoodVisual(name).category;
  if (["fruit", "vegetable"].includes(category)) return "produce";
  if (["meat", "chicken", "seafood"].includes(category)) return "meat";
  if (["dairy", "cheese", "egg"].includes(category)) return "dairy";
  if (["bread", "bakery", "grain", "rice", "pasta", "cereal"].includes(category)) return "bakery";
  if (["sauce", "seasoning", "oil", "spice"].includes(category)) return "seasoning";
  if (["drink", "beverage"].includes(category)) return "drink";
  return "other";
}

export const foodEmoji = (name: string) => getFoodVisual(name).emoji;
