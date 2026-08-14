export type TicketClassification = "food" | "non_food" | "unknown";
export type FoodCategory = "vegetable" | "fruit" | "meat" | "seafood" | "dairy" | "egg" | "bakery" | "grain" | "pantry" | "sauce" | "beverage" | "frozen" | "snack" | "sweet" | "legume" | "spice" | "prepared" | "other_food";

export type DictionaryEntry = { canonical: string; aliases: string[]; category?: FoodCategory };
export type TicketProductAlias = { rawNameNormalized: string; displayName: string; classification: Exclude<TicketClassification, "unknown"> };
export type ClassificationResult = {
  rawName: string; classification: TicketClassification; normalizedName: string;
  suggestedDisplayName?: string; category?: FoodCategory; emoji?: string;
  confidence: number; matchedTerms: string[]; quantity?: number; unit?: string;
  source: "dictionary" | "learned" | "unknown";
};
