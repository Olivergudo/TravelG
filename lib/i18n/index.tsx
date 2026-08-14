"use client";
import { createContext, useContext } from "react";
import { es } from "./locales/es";
import { en } from "./locales/en";
import { fr } from "./locales/fr";
import { de } from "./locales/de";

export const supportedLanguages = ["es", "en", "fr", "de"] as const;
export type AppLanguage = (typeof supportedLanguages)[number];
export type TranslationKey = keyof typeof es;
export const languageOptions: Array<[AppLanguage, string, string]> = [["es", "🇪🇸", "Español"], ["en", "🇬🇧", "English"], ["fr", "🇫🇷", "Français"], ["de", "🇩🇪", "Deutsch"]];
export const intlLocales: Record<AppLanguage, string> = { es: "es-CL", en: "en-US", fr: "fr-FR", de: "de-DE" };
const dictionaries = { es, en, fr, de };
export function isAppLanguage(value: unknown): value is AppLanguage { return typeof value === "string" && supportedLanguages.includes(value as AppLanguage); }
export function translate(language: AppLanguage, key: TranslationKey, variables: Record<string, string | number> = {}) {
  const template = dictionaries[language][key] || es[key] || key;
  return Object.entries(variables).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
}
export function pluralKey(language: AppLanguage, base: string, count: number) {
  return `${base}.${new Intl.PluralRules(intlLocales[language]).select(count) === "one" ? "one" : "other"}` as TranslationKey;
}
type I18nValue = { language: AppLanguage; t: (key: TranslationKey, variables?: Record<string, string | number>) => string; count: (base: string, value: number) => string; formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string };
const I18nContext = createContext<I18nValue>({ language: "es", t: (key, variables) => translate("es", key, variables), count: (base, value) => translate("es", pluralKey("es", base, value), { count: value }), formatDate: (value, options) => new Intl.DateTimeFormat("es-CL", options).format(new Date(value)) });
export function I18nProvider({ language, children }: { language: AppLanguage; children: React.ReactNode }) {
  const value: I18nValue = { language, t: (key, variables) => translate(language, key, variables), count: (base, count) => translate(language, pluralKey(language, base, count), { count }), formatDate: (date, options = { day: "numeric", month: "long", year: "numeric" }) => new Intl.DateTimeFormat(intlLocales[language], options).format(new Date(date)) };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export const useI18n = () => useContext(I18nContext);
