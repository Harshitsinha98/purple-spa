"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, UserRound } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { uniqueChannel } from "@/lib/realtime";
import { useSession } from "@/hooks/use-session";
import { useNow } from "@/hooks/use-now";
import { pick, useLocale } from "@/lib/i18n/locale-provider";
import { api, payWithRazorpay, verifyPayment } from "@/lib/checkout";
import { fmtDate, fmtTime, inr, minutesLabel } from "@/lib/format";
import { StatusBadge, holdExpired } from "@/components/booking/status-badge";
import type { Booking, BookingEvent, Settings } from "@/lib/types";

export function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { t, locale } = useLocale();
  const { user } = useSession();
  const now = useNow();
  const [b, setB] = useState<Booking | null>(null);
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [settings, setSettings] = useState<Pick<Settings, "cancellation_hours"> | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(params.get("payment") === "cancelled" ? t.book.paymentCancelled : null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const db = supabaseBrowser();
    const [{ data }, { data: ev }, { data: s }] = await Promise.all([
      db.from("bookings").select("*, booking_items(*)").eq("id", id).maybeSingle(),
      db.from("booking_events").select("*").eq("booking_id", id).order("created_at", { ascending: false }),
      db.from("settings").select("cancellation_hours").eq("id", 1).single(),
    ]);
    if (!data) setMissing(true);
    setB(data as Booking | null);
    setEvents((ev as BookingEvent[]) ?? []);
    setSettings(s as Pick<Settings, "cancellation_hours">);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load();
    const db = supabaseBrowser();
    const ch = db
      .channel(uniqueChannel(`booking-${id}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_events", filter: `booking_id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      db.removeChannel(ch);
    };
  }, [id, load]);

  if (missing) return <p className="text-muted">Booking not found.</p>;
  if (!b) return <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" /> {t.common.loading}</p>;

  const expired = holdExpired(b);
  const open = ["pending_payment", "confirmed", "assigned"].includes(b.status) && !expired;
  const canCancel = open && settings && new Date(b.start_at).getTime() - now >= settings.cancellation_hours * 3600_000;
  const due = Number(b.total_amount) - Number(b.amount_paid);
  const needsPayment = b.status === "pending_payment" && !expired;
  const canPayBalance = !needsPayment && open && due > 0 && b.payment_mode !== "pay_at_spa";

  const pay = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<{ order: { id: string; amount: number; currency: string } }>(`/api/bookings/${b.id}/pay`);
      const r = await payWithRazorpay(res.order, { name: b.customer_name, contact: b.customer_phone, email: user?.email }, b.code);
      if (r) await verifyPayment(r);
      else setMsg(t.book.paymentCancelled);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t.book.errorGeneric);
    }
    setBusy(false);
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api(`/api/bookings/${b.id}/cancel`, { reason: reason || undefined });
      setMsg(t.account.cancelled);
      setConfirmCancel(false);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t.book.errorGeneric);
    }
    setBusy(false);
  };

  return (
    <div>
      <Link href="/account" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {t.account.title}
      </Link>

      {params.get("new") && b.status !== "pending_payment" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-800">
          <CheckCircle2 className="size-5" /> {t.status.confirmed} · {t.account.code} {b.code}
        </motion.div>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-violet">{t.account.code} {b.code}</p>
          <h1 className="display mt-3 text-4xl text-ink md:text-5xl">
            {fmtDate(b.start_at, locale, { weekday: "long", day: "numeric", month: "long" })}
          </h1>
          <p className="mt-2 text-lg text-muted">
            {fmtTime(b.start_at, locale)} – {fmtTime(b.end_at, locale)}
          </p>
        </div>
        <StatusBadge status={b.status} expired={expired} />
      </div>

      {/* Therapist card: updates live when admin or auto-assign picks someone */}
      <div className="card mt-8 flex items-center gap-4 p-5">
        <div className="grid size-12 place-items-center rounded-full bg-violet/10 text-violet">
          <UserRound className="size-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted">{t.account.therapist}</p>
          <AnimatePresence mode="wait">
            <motion.p key={b.employee_name ?? "none"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="font-display text-2xl text-ink">
              {b.employee_name ?? (b.status === "cancelled" ? "—" : t.account.waiting)}
            </motion.p>
          </AnimatePresence>
        </div>
        {!b.employee_name && open && <Loader2 className="size-5 animate-spin text-violet/60" aria-hidden />}
      </div>

      <div className="card mt-4 p-5">
        <ul className="divide-y divide-line">
          {(b.booking_items ?? []).map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-3">
              <span>
                <span className="block font-semibold text-ink">{pick(i, "name", locale)}</span>
                <span className="text-sm text-muted">{minutesLabel(i.duration_min, locale)}</span>
              </span>
              <span className="font-semibold tabular-nums">{inr(i.price, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between font-semibold text-ink"><dt>{t.book.total}</dt><dd>{inr(b.total_amount, locale)}</dd></div>
          <div className="flex justify-between text-muted"><dt>{t.account.paid}</dt><dd>{inr(b.amount_paid, locale)}</dd></div>
          {due > 0 && b.status !== "cancelled" && <div className="flex justify-between text-muted"><dt>{t.account.due}</dt><dd>{inr(due, locale)}</dd></div>}
        </dl>
      </div>

      {msg && <p role="status" className="mt-4 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink">{msg}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        {(needsPayment || canPayBalance) && (
          <button onClick={pay} disabled={busy} className="btn btn-gold">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {needsPayment ? `${t.book.payNow} ${inr(Number(b.advance_amount) - Number(b.amount_paid), locale)}` : `${t.account.payBalance} · ${inr(due, locale)}`}
          </button>
        )}
        {canCancel && !confirmCancel && (
          <button onClick={() => setConfirmCancel(true)} className="btn btn-ghost text-ink">{t.account.cancel}</button>
        )}
      </div>

      {confirmCancel && (
        <div className="card mt-4 p-5">
          <p className="font-semibold text-ink">{t.account.cancelConfirm}</p>
          <label htmlFor="reason" className="label mt-4">{t.account.cancelReason}</label>
          <input id="reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <div className="mt-4 flex gap-3">
            <button onClick={cancel} disabled={busy} className="btn btn-ink">{busy && <Loader2 className="size-4 animate-spin" />}{t.common.yes}</button>
            <button onClick={() => setConfirmCancel(false)} className="btn btn-ghost text-ink">{t.common.no}</button>
          </div>
        </div>
      )}

      {open && settings && <p className="mt-6 text-sm text-muted">{t.book.cancellation(settings.cancellation_hours)}</p>}

      {events.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow text-muted">{t.account.timeline}</h2>
          <ol className="mt-4 border-l border-line pl-5">
            {events.map((e) => (
              <li key={e.id} className="relative pb-5">
                <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-violet" aria-hidden />
                <p className="text-ink">{e.message}</p>
                <p className="text-xs text-muted">{fmtDate(e.created_at, locale)} · {fmtTime(e.created_at, locale)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
