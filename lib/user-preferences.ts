import { isCurrency, type Currency } from "./currency";
import { isAppLanguage, type AppLanguage } from "./i18n";

export type RequiredPreferences = {
  displayName: string;
  currency?: Currency;
  language?: AppLanguage;
  needsLanguage: boolean;
  needsName: boolean;
  needsCurrency: boolean;
};

export function requiredPreferences(metadata: Record<string, unknown> | undefined): RequiredPreferences {
  const displayName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : "";
  const currency = isCurrency(metadata?.currency) ? metadata.currency : undefined;
  const language = isAppLanguage(metadata?.language) ? metadata.language : undefined;
  return { displayName, currency, language, needsLanguage: !language, needsName: !displayName, needsCurrency: !currency };
}
