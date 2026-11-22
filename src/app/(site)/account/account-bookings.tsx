"use client";

import Link from "next/link";
import { ChevronRight, Loader2, Radio } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useNow } from "@/hooks/use-now";
import { useLiveBookings } from "@/hooks/use-live-bookings";
import { pick, useLocale } from "@/lib/i18n/locale-provider";
import { fmtDate, fmtTime, inr } from "@/lib/format";
import { StatusBadge, holdExpired } from "@/components/booking/status-badge";
import type { Booking } from "@/lib/types";

export function AccountBookings() {
  const { t } = useLocale();
  const { user, profile, loading } = useSession();
  const now = useNow();
  const { bookings } = useLiveBookings({ channel: "my-bookings", filter: user ? `customer_id=eq.${user.id}` : undefined, enabled: Boolean(user) });

  if (loading || (user && !bookings)) {
    return <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" /> {t.common.loading}</p>;
  }

  const upcoming = (bookings ?? []).filter((b) => new Date(b.end_at).getTime() >= now && !["cancelled", "completed", "no_show"].includes(b.status) && !holdExpired(b));
  const past = (bookings ?? []).filter((b) => !upcoming.includes(b)).reverse();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-violet">{profile?.full_name ?? user?.email}</p>
          <h1 className="display mt-3 text-5xl text-ink md:text-6xl">{t.account.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Radio className="size-3.5" aria-hidden /> {t.account.live}
          </span>
          <form action="/auth/signout" method="post">
            <button className="min-h-11 cursor-pointer text-sm text-muted hover:text-ink">{t.auth.signOut}</button>
          </form>
        </div>
      </div>

      {!bookings?.length ? (
        <div className="card mt-10 p-10 text-center">
          <p className="text-muted">{t.account.none}</p>
          <Link href="/book" className="btn btn-ink mt-6">{t.account.bookFirst}</Link>
        </div>
      ) : (
        <>
          <Group title={t.account.upcoming} items={upcoming} />
          {past.length > 0 && <Group title={t.account.past} items={past} muted />}
        </>
      )}
    </div>
  );
}

function Group({ title, items, muted }: { title: string; items: Booking[]; muted?: boolean }) {
  const { t, locale } = useLocale();
  if (!items.length) return null;
  return (
    <section className="mt-12">
      <h2 className="eyebrow text-muted">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((b) => (
          <li key={b.id}>
            <Link href={`/account/bookings/${b.id}`} className={`card flex items-center gap-4 p-5 transition-colors hover:border-violet/40 ${muted ? "opacity-75" : ""}`}>
              <div className="w-16 shrink-0 text-center">
                <p className="text-xs uppercase text-muted">{fmtDate(b.start_at, locale, { day: undefined, month: "short", weekday: undefined })}</p>
                <p className="font-display text-3xl leading-none text-ink">{fmtDate(b.start_at, locale, { weekday: undefined, month: undefined })}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{(b.booking_items ?? []).map((i) => pick(i, "name", locale)).join(", ")}</p>
                <p className="text-sm text-muted">
                  {fmtTime(b.start_at, locale)} · {inr(b.total_amount, locale)}
                  {b.employee_name && ` · ${t.account.therapist}: ${b.employee_name}`}
                </p>
              </div>
              <StatusBadge status={b.status} expired={holdExpired(b)} />
              <ChevronRight className="size-4 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
