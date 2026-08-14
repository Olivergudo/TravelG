import type { DictionaryEntry, FoodCategory } from "../types";
export const foods = (category: FoodCategory, rows: Array<[string, string]>): DictionaryEntry[] => rows.map(([canonical, aliases]) => ({ canonical, category, aliases: aliases.split("|") }));
export const nonFoods = (rows: Array<[string, string]>): DictionaryEntry[] => rows.map(([canonical, aliases]) => ({ canonical, aliases: aliases.split("|") }));
