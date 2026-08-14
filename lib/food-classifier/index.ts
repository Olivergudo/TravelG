import { pantryDictionary } from "./dictionaries/pantry";
import { produceDictionary } from "./dictionaries/produce";
import { proteinDictionary } from "./dictionaries/proteins";
import { nonFoodDictionary } from "./dictionaries/non-food";
import type { ClassificationResult, DictionaryEntry, FoodCategory, TicketProductAlias } from "./types";

const FOOD = [...produceDictionary, ...proteinDictionary, ...pantryDictionary];
const EMOJI: Record<FoodCategory, string> = { vegetable: "🥦", fruit: "🍎", meat: "🥩", seafood: "🐟", dairy: "🥛", egg: "🥚", bakery: "🍞", grain: "🌾", pantry: "🍴", sauce: "🫙", beverage: "🥤", frozen: "❄️", snack: "🍿", sweet: "🍫", legume: "🫘", spice: "🌿", prepared: "🍽️", other_food: "🍴" };
const MODIFIER = /^(?:kg|g|gr|l|ml|u|un|und|pza|pzas|pack|pqt|granel|x\d+)$/;
const MEASURE = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|ml|u|un|und|pza|pzas)(?=\s|$)/i;

export function normalizeTicketProductName(raw: string) {
  return raw.trim().toLocaleLowerCase("es-CL").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.,]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchingName(normalized: string) {
  return normalized.split(" ").filter((token) => !MODIFIER.test(token) && !/^\d+(?:[.,]\d+)?(?:kg|g|gr|l|ml|u|un|und|pza|pzas)$/.test(token)).join(" ");
}

export function extractTicketQuantity(raw: string) {
  const match = normalizeTicketProductName(raw).match(MEASURE);
  if (!match) return {};
  const quantity = Number(match[1].replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) return {};
  const rawUnit = match[2].toLowerCase();
  const unit = ["u", "un", "und", "pza", "pzas"].includes(rawUnit) ? "unidad" : rawUnit === "gr" ? "g" : rawUnit;
  return { quantity, unit };
}

type Match = { entry: DictionaryEntry; alias: string; score: number };
function bestMatch(value: string, dictionary: DictionaryEntry[]): Match | undefined {
  let best: Match | undefined;
  const padded = ` ${value} `;
  for (const entry of dictionary) for (const rawAlias of entry.aliases) {
    const alias = normalizeTicketProductName(rawAlias);
    const exact = value === alias;
    const phrase = !exact && padded.includes(` ${alias} `);
    if (!exact && !phrase) continue;
    const score = exact ? 95 : alias.includes(" ") ? 88 : 84;
    if (!best || score > best.score || (score === best.score && alias.length > best.alias.length)) best = { entry, alias, score };
  }
  return best;
}

const title = (value: string) => value.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("es-CL"));

export function classifyTicketProduct(rawName: string, learnedAliases: TicketProductAlias[] = []): ClassificationResult {
  const normalizedName = normalizeTicketProductName(rawName);
  const quantity = extractTicketQuantity(rawName);
  const learned = learnedAliases.find((alias) => alias.rawNameNormalized === normalizedName);
  if (learned) return { rawName, normalizedName, classification: learned.classification, suggestedDisplayName: learned.displayName, confidence: 100, matchedTerms: [normalizedName], source: "learned", ...quantity };
  const comparable = matchingName(normalizedName);
  const food = bestMatch(comparable, FOOD);
  const nonFood = bestMatch(comparable, nonFoodDictionary);
  if (food && nonFood && Math.abs(food.score - nonFood.score) < 10) return { rawName, normalizedName, classification: "unknown", confidence: Math.max(food.score, nonFood.score) - 25, matchedTerms: [food.alias, nonFood.alias], source: "unknown", ...quantity };
  const winner = food && (!nonFood || food.score > nonFood.score) ? food : nonFood;
  if (!winner || winner.score < 80) return { rawName, normalizedName, classification: "unknown", confidence: winner?.score || 0, matchedTerms: winner ? [winner.alias] : [], source: "unknown", ...quantity };
  const classification = winner === food ? "food" : "non_food";
  const suggestedDisplayName = comparable === winner.alias ? winner.entry.canonical : title(comparable || normalizedName);
  return { rawName, normalizedName, classification, suggestedDisplayName, category: classification === "food" ? winner.entry.category : undefined, emoji: classification === "food" && winner.entry.category ? EMOJI[winner.entry.category] : undefined, confidence: winner.score, matchedTerms: [winner.alias], source: "dictionary", ...quantity };
}

export const classifierStats = {
  foodEntries: FOOD.length,
  foodAliases: FOOD.reduce((sum, entry) => sum + entry.aliases.length, 0),
  nonFoodEntries: nonFoodDictionary.length,
  nonFoodAliases: nonFoodDictionary.reduce((sum, entry) => sum + entry.aliases.length, 0),
};

export type { ClassificationResult, FoodCategory, TicketProductAlias } from "./types";
