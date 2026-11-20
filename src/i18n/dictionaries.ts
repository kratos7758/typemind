import { locale as rootLocale } from "next/root-params";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";
import type fr from "./messages/fr.json";

export type Dictionary = typeof fr;

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import("./messages/fr.json").then((m) => m.default),
  en: () => import("./messages/en.json").then((m) => m.default),
};

/** Current locale from the URL root segment. Server Components only. */
export async function getLocale(): Promise<Locale> {
  const value = await rootLocale();
  if (!isLocale(value)) notFound();
  return value;
}

export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  return loaders[locale ?? (await getLocale())]();
}

/** Usable in Server Actions, where root params are unavailable. */
export const loadDictionary = (locale: Locale) => loaders[locale]();
