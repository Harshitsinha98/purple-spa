"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, type Dict, type Locale } from "./dictionaries";

const KEY = "purple-locale";
type Ctx = { locale: Locale; t: Dict; setLocale: (l: Locale) => void; toggle: () => void };
const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a browser-only preference after hydration
    if (saved === "hi" || saved === "en") setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(KEY, l);
  }, []);
  const toggle = useCallback(() => setLocale(locale === "en" ? "hi" : "en"), [locale, setLocale]);

  return <LocaleContext.Provider value={{ locale, t: dictionaries[locale], setLocale, toggle }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}

/** Picks the *_en / *_hi field of a database row for the active locale. */
export function pick<T extends object>(row: T, field: string, locale: Locale): string {
  const r = row as Record<string, unknown>;
  const v = r[`${field}_${locale}`] ?? r[`${field}_en`];
  return typeof v === "string" ? v : "";
}
