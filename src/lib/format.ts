import type { Locale } from "@/lib/i18n/dictionaries";

export const TZ = "Asia/Kolkata";

export function inr(amount: number | string, locale: Locale = "en") {
  return new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number(amount) % 1 === 0 ? 0 : 2,
  }).format(Number(amount));
}

export function fmtDate(iso: string | Date, locale: Locale = "en", opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...opts,
  }).format(new Date(iso));
}

export function fmtTime(iso: string | Date, locale: Locale = "en") {
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** "10:00:00" → "10:00 AM" */
export function fmtClock(t: string, locale: Locale = "en") {
  const [h, m] = t.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { timeZone: "UTC", hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

/** YYYY-MM-DD for "today" in the spa's time zone, offset by n days */
export function istDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function minutesLabel(min: number, locale: Locale = "en") {
  if (locale === "hi") return `${min} मिनट`;
  return `${min} min`;
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export function waHref(phone: string, text?: string) {
  const n = phone.replace(/\D/g, "");
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function mapsHref(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function prettyPhone(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : phone;
}
