import { isCurrency, type Currency } from "./currency";

export type RequiredPreferences = {
  displayName: string;
  currency?: Currency;
  needsName: boolean;
  needsCurrency: boolean;
};

export function requiredPreferences(metadata: Record<string, unknown> | undefined): RequiredPreferences {
  const displayName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : "";
  const currency = isCurrency(metadata?.currency) ? metadata.currency : undefined;
  return { displayName, currency, needsName: !displayName, needsCurrency: !currency };
}
