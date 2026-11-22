"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, ExternalLink, Loader2, MessageCircle, Phone, Play, RotateCcw, Undo2, UserRound, UserX, Wand2, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { uniqueChannel } from "@/lib/realtime";
import { useNow } from "@/hooks/use-now";
import { api } from "@/lib/checkout";
import { fmtDate, fmtTime, inr, istDate, minutesLabel, prettyPhone, telHref, waHref } from "@/lib/format";
import { StatusBadge, holdExpired } from "@/components/booking/status-badge";
import { Notice } from "./ui";
import type { Booking, BookingEvent, Employee, Payment } from "@/lib/types";
import { cn } from "@/lib/utils";

type Staff = { employees: Employee[]; skills: Record<string, Set<string>> };

export function useStaffList(): Staff {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [skills, setSkills] = useState<Record<string, Set<string>>>({});
  useEffect(() => {
    const db = supabaseBrowser();
    Promise.all([db.from("employees").select("*").eq("is_active", true).order("full_name"), db.from("employee_services").select("*")]).then(([e, s]) => {
      setEmployees((e.data as Employee[]) ?? []);
      const map: Record<string, Set<string>> = {};
      for (const r of (s.data as { employee_id: string; service_id: string }[]) ?? []) (map[r.employee_id] ??= new Set()).add(r.service_id);
      setSkills(map);
    });
  }, []);
  return { employees, skills };
}

/** Side panel with everything about one booking, and every action the admin can take on it. */
export function BookingDrawer({ id, onClose, onChanged, staff }: { id: string | null; onClose: () => void; onChanged?: () => void; staff: Staff }) {
  const now = useNow(30_000);
  const [b, setB] = useState<Booking | null>(null);
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "upi" | "card">("cash");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDay, setMoveDay] = useState(istDate(0));
  const [moveTime, setMoveTime] = useState("10:00");

  const load = useCallback(async () => {
    if (!id) return;
    const db = supabaseBrowser();
    const [bk, ev, pay] = await Promise.all([
      db.from("bookings").select("*, booking_items(*)").eq("id", id).maybeSingle(),
      db.from("booking_events").select("*").eq("booking_id", id).order("created_at", { ascending: false }),
      db.from("payments").select("*").eq("booking_id", id).order("created_at", { ascending: false }),
    ]);
    const booking = bk.data as Booking | null;
    setB(booking);
    setEvents((ev.data as BookingEvent[]) ?? []);
    setPayments((pay.data as Payment[]) ?? []);
    if (booking) {
      setAmount(String(Number(booking.total_amount) - Number(booking.amount_paid)));
      setMoveDay(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(booking.start_at)));
      setMoveTime(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(booking.start_at)));
    }
  }, [id]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset and fetch when a different booking opens */
    setB(null);
    setMsg(null);
    setPayOpen(false);
    setMoveOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!id) return;
    load();
    const db = supabaseBrowser();
    const ch = db
      .channel(uniqueChannel(`admin-booking-${id}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_events", filter: `booking_id=eq.${id}` }, () => load())
      .subscribe();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      db.removeChannel(ch);
    };
  }, [id, load, onClose]);

  const run = async (key: string, url: string, body?: unknown, ok?: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await api(url, body);
      if (ok) setMsg({ kind: "ok", text: ok });
      setPayOpen(false);
      setMoveOpen(false);
      await load();
      onChanged?.();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    }
    setBusy(null);
  };

  const serviceIds = (b?.booking_items ?? []).map((i) => i.service_id).filter(Boolean) as string[];
  const qualified = (e: Employee) => serviceIds.every((s) => staff.skills[e.id]?.has(s)) && (!b || b.gender_preference === "any" || e.gender === b.gender_preference);
  const due = b ? Number(b.total_amount) - Number(b.amount_paid) : 0;
  const open = b ? ["pending_payment", "confirmed", "assigned"].includes(b.status) && !holdExpired(b) : false;
  const early = b ? new Date(b.start_at).getTime() > now : false;

  return (
    <AnimatePresence>
      {id && (
        <motion.div className="fixed inset-0 z-50 flex justify-end bg-night/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Booking details"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-xl overflow-y-auto bg-[#f6f3ef] shadow-2xl"
            data-lenis-prevent
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[#f6f3ef]/95 px-5 py-3 backdrop-blur">
              <p className="font-mono text-sm text-muted">{b ? `#${b.code}` : ""}</p>
              <button onClick={onClose} className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-sand" aria-label="Close"><X className="size-5" /></button>
            </div>

            {!b ? (
              <p className="flex items-center gap-2 p-6 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>
            ) : (
              <div className="space-y-5 p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={b.status} expired={holdExpired(b)} />
                    <span className="text-xs text-muted">{b.source === "admin" ? "Walk-in / phone" : "Website"} · created {fmtDate(b.created_at)} {fmtTime(b.created_at)}</span>
                  </div>
                  <h2 className="mt-3 font-display text-3xl">{fmtDate(b.start_at, "en", { weekday: "long", day: "numeric", month: "long" })}</h2>
                  <p className="text-lg text-muted">{fmtTime(b.start_at)} – {fmtTime(b.end_at)} · {b.resource === "bed" ? "Spa room" : "Salon chair"}</p>
                </div>

                {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

                {/* Customer */}
                <section className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Customer</p>
                      <p className="mt-1 font-display text-2xl">{b.customer_name}</p>
                      <p className="text-sm text-muted">{prettyPhone(b.customer_phone)}{b.customer_email && ` · ${b.customer_email}`}</p>
                      <p className="text-sm text-muted">Therapist preference: {b.gender_preference}</p>
                    </div>
                    {b.customer_phone_key && (
                      <Link href={`/admin/customers?key=${b.customer_phone_key}`} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line px-3 text-xs font-semibold hover:bg-sand">
                        Profile <ExternalLink className="size-3" />
                      </Link>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href={telHref(b.customer_phone)} className="btn btn-ghost h-10 min-h-10 text-sm"><Phone className="size-4" /> Call</a>
                    <a href={waHref(b.customer_phone)} target="_blank" rel="noreferrer" className="btn btn-ghost h-10 min-h-10 text-sm"><MessageCircle className="size-4" /> WhatsApp</a>
                  </div>
                  {b.notes && <p className="mt-3 rounded-lg bg-sand px-3 py-2 text-sm">{b.notes}</p>}
                </section>

                {/* Services */}
                <section className="rounded-2xl border border-line bg-white p-4">
                  <ul className="divide-y divide-line">
                    {(b.booking_items ?? []).map((i) => (
                      <li key={i.id} className="flex justify-between py-2 text-sm">
                        <span><span className="font-semibold">{i.name_en}</span> · {minutesLabel(i.duration_min)}</span>
                        <span className="tabular-nums">{inr(i.price)}</span>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-2 space-y-1 border-t border-line pt-2 text-sm">
                    <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{inr(b.total_amount)}</dd></div>
                    <div className="flex justify-between text-muted"><dt>Paid ({b.payment_mode.replaceAll("_", " ")})</dt><dd>{inr(b.amount_paid)}</dd></div>
                    {due > 0 && <div className="flex justify-between text-magenta"><dt>Balance</dt><dd>{inr(due)}</dd></div>}
                    {b.commission_amount != null && <div className="flex justify-between text-muted"><dt>Commission</dt><dd>{inr(b.commission_amount)}</dd></div>}
                  </dl>
                </section>

                {/* Therapist */}
                <section className="rounded-2xl border border-line bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Therapist</p>
                  {open ? (
                    <div className="mt-2 flex gap-2">
                      <label htmlFor="drawer-assign" className="sr-only">Therapist</label>
                      <select
                        id="drawer-assign"
                        value={b.employee_id ?? ""}
                        disabled={!!busy || b.status === "pending_payment"}
                        onChange={(e) => e.target.value && run("assign", `/api/admin/bookings/${b.id}/assign`, { employeeId: e.target.value }, "Therapist assigned. The customer can see it now.")}
                        className={cn("field flex-1", !b.employee_id && b.status === "confirmed" && "border-magenta")}
                      >
                        <option value="">{b.employee_id ? b.employee_name : "Choose therapist…"}</option>
                        {staff.employees.map((e) => (
                          <option key={e.id} value={e.id} disabled={!qualified(e)}>
                            {e.full_name} ({e.gender[0].toUpperCase()}){qualified(e) ? "" : " – not trained / preference"}
                          </option>
                        ))}
                      </select>
                      {b.status === "confirmed" && !b.employee_id && (
                        <button onClick={() => run("auto", `/api/admin/bookings/${b.id}/assign`, { employeeId: null }, "Assigned automatically.")} className="btn btn-ghost" disabled={!!busy} title="Auto-assign">
                          {busy === "auto" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 flex items-center gap-2 font-semibold"><UserRound className="size-4 text-violet" /> {b.employee_name ?? "—"}</p>
                  )}
                  {b.status === "pending_payment" && <p className="mt-2 text-xs text-muted">Waiting for the customer to pay. A therapist is assigned once it&apos;s confirmed.</p>}
                </section>

                {/* Actions */}
                <section className="flex flex-wrap gap-2">
                  {(b.status === "assigned" || (b.status === "confirmed" && b.employee_id)) && (
                    <button onClick={() => run("start", `/api/bookings/${b.id}/status`, { status: "in_progress" }, "Session started.")} disabled={!!busy} className="btn btn-ink h-10 min-h-10 text-sm">
                      {busy === "start" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {early ? "Start early" : "Start session"}
                    </button>
                  )}
                  {b.status === "in_progress" && (
                    <>
                      <button onClick={() => run("done", `/api/bookings/${b.id}/status`, { status: "completed" }, "Marked completed.")} disabled={!!busy} className="btn btn-ink h-10 min-h-10 text-sm">
                        <Check className="size-4" /> Complete
                      </button>
                      <button onClick={() => run("undo", `/api/bookings/${b.id}/status`, { status: "assigned" }, "Start undone.")} disabled={!!busy} className="btn btn-ghost h-10 min-h-10 text-sm">
                        <Undo2 className="size-4" /> Undo start
                      </button>
                    </>
                  )}
                  {b.status === "assigned" && !early && (
                    <button onClick={() => run("done", `/api/bookings/${b.id}/status`, { status: "completed" }, "Marked completed.")} disabled={!!busy} className="btn btn-ghost h-10 min-h-10 text-sm">
                      <Check className="size-4" /> Complete
                    </button>
                  )}
                  {open && (
                    <button onClick={() => setMoveOpen((v) => !v)} className="btn btn-ghost h-10 min-h-10 text-sm"><CalendarClock className="size-4" /> Reschedule</button>
                  )}
                  {due > 0 && !["cancelled", "pending_payment", "no_show"].includes(b.status) && (
                    <button onClick={() => setPayOpen((v) => !v)} className="btn btn-gold h-10 min-h-10 text-sm">Record payment</button>
                  )}
                  {(b.status === "assigned" || b.status === "confirmed") && !early && (
                    <button onClick={() => confirm("Mark as no-show?") && run("ns", `/api/bookings/${b.id}/status`, { status: "no_show" })} disabled={!!busy} className="btn btn-ghost h-10 min-h-10 text-sm text-magenta">
                      <UserX className="size-4" /> No-show
                    </button>
                  )}
                  {["pending_payment", "confirmed", "assigned", "in_progress"].includes(b.status) && (
                    <button
                      onClick={() => {
                        const r = prompt("Reason for cancelling?");
                        if (r !== null) run("cancel", `/api/bookings/${b.id}/cancel`, { reason: r || "Cancelled by spa" }, "Booking cancelled. Refund online payments from the list below if needed.");
                      }}
                      disabled={!!busy}
                      className="btn btn-ghost h-10 min-h-10 text-sm text-magenta"
                    >
                      Cancel booking
                    </button>
                  )}
                </section>

                {moveOpen && (
                  <form className="space-y-3 rounded-2xl border border-line bg-white p-4" onSubmit={(e) => { e.preventDefault(); run("move", `/api/admin/bookings/${b.id}/reschedule`, { start: new Date(`${moveDay}T${moveTime}:00+05:30`).toISOString() }, "Moved. The customer has been sent the new time."); }}>
                    <p className="text-sm font-semibold">Move to</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="sr-only" htmlFor="mv-day">Day</label>
                      <input id="mv-day" type="date" className="field" value={moveDay} onChange={(e) => setMoveDay(e.target.value)} />
                      <label className="sr-only" htmlFor="mv-time">Time</label>
                      <input id="mv-time" type="time" step={900} className="field" value={moveTime} onChange={(e) => setMoveTime(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted">Same length ({minutesLabel(Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000))}). The therapist stays if they are free then; otherwise you&apos;ll need to assign again.</p>
                    <button className="btn btn-ink h-10 min-h-10 w-full text-sm" disabled={!!busy}>{busy === "move" && <Loader2 className="size-4 animate-spin" />} Move booking</button>
                  </form>
                )}

                {payOpen && (
                  <form className="flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-4" onSubmit={(e) => { e.preventDefault(); run("pay", `/api/bookings/${b.id}/payment`, { amount: Number(amount), method }, "Payment recorded."); }}>
                    <label className="sr-only" htmlFor="dp-amt">Amount</label>
                    <input id="dp-amt" className="field w-28" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <label className="sr-only" htmlFor="dp-m">Method</label>
                    <select id="dp-m" className="field w-auto" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                      <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
                    </select>
                    <button className="btn btn-ink" disabled={!!busy}>Save</button>
                  </form>
                )}

                {/* Payments */}
                {payments.length > 0 && (
                  <section className="rounded-2xl border border-line bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Payments</p>
                    <ul className="mt-2 divide-y divide-line text-sm">
                      {payments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                          <span>{fmtDate(p.created_at)} {fmtTime(p.created_at)} · <span className="capitalize">{p.method}</span> · {p.status === "created" ? "not paid" : p.status}</span>
                          <span className="flex items-center gap-2">
                            <span className="font-semibold tabular-nums">{inr(p.amount)}</span>
                            {p.method === "razorpay" && p.status === "captured" && (
                              <button
                                onClick={() => {
                                  const r = prompt(`Refund ${inr(p.amount)}? Reason:`);
                                  if (r) run(`refund-${p.id}`, `/api/admin/payments/${p.id}/refund`, { reason: r }, "Refund started. Razorpay usually credits it in 5–7 working days.");
                                }}
                                className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border border-line px-2.5 text-xs font-semibold hover:bg-sand"
                              >
                                <RotateCcw className="size-3" /> Refund
                              </button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Timeline */}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">History</p>
                  <ol className="mt-3 border-l border-line pl-5">
                    {events.map((e) => (
                      <li key={e.id} className="relative pb-4">
                        <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-violet" aria-hidden />
                        <p className="text-sm">{e.message}</p>
                        <p className="text-xs text-muted">{fmtDate(e.created_at)} · {fmtTime(e.created_at)}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
