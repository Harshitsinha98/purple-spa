"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const tone: Record<BookingStatus, string> = {
  pending_payment: "bg-gold/15 text-[#7a5a17] border-gold/40",
  confirmed: "bg-cyan/10 text-[#0e6b75] border-cyan/40",
  assigned: "bg-violet/10 text-violet border-violet/30",
  in_progress: "bg-orchid/15 text-[#6d1f9c] border-orchid/40",
  completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-neutral-100 text-neutral-600 border-neutral-200",
  no_show: "bg-magenta/10 text-magenta border-magenta/30",
};

export function StatusBadge({ status, expired }: { status: BookingStatus; expired?: boolean }) {
  const { t, locale } = useLocale();
  const label = expired ? (locale === "hi" ? "भुगतान समय समाप्त" : "Payment window expired") : t.status[status];
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", expired ? tone.cancelled : tone[status])}>{label}</span>;
}

export const holdExpired = (b: { status: BookingStatus; hold_expires_at: string | null }) =>
  b.status === "pending_payment" && !!b.hold_expires_at && new Date(b.hold_expires_at) < new Date();
