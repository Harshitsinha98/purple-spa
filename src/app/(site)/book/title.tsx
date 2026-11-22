"use client";

import { useLocale } from "@/lib/i18n/locale-provider";

export function BookTitle() {
  const { t } = useLocale();
  return <h1 className="display mb-10 text-5xl text-ink md:text-7xl">{t.book.title}</h1>;
}
