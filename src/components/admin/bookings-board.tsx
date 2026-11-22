"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Phone, Plus, Radio, Wand2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLiveBookings } from "@/hooks/use-live-bookings";
import { api } from "@/lib/checkout";
import { fmtDate, fmtTime, inr, istDate, minutesLabel, prettyPhone, telHref } from "@/lib/format";
import { StatusBadge, holdExpired } from "@/components/booking/status-badge";
import { Modal, Notice, Panel } from "./ui";
import { BookingDrawer, useStaffList } from "./booking-drawer";
import type { Booking, BookingStatus, Employee, Service, Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

type Skills = Record<string, Set<string>>; // employee_id → service ids

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00+05:30`);
  x.setDate(x.getDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(x);
};

/** Day view of bookings with assignment, status and payment actions. Updates live. */
export function BookingsBoard({ compact }: { compact?: boolean }) {
  const params = useSearchParams();
  const [day, setDay] = useState(istDate(0));
  const [status, setStatus] = useState<"active" | "all" | BookingStatus>("active");
  const [walkIn, setWalkIn] = useState(false);
  const staff = useStaffList();
  const { employees, skills } = staff;
  const [openId, setOpenId] = useState<string | null>(null);
  const focus = params.get("focus");

  const from = new Date(`${day}T00:00:00+05:30`).toISOString();
  const to = new Date(`${addDays(day, 1)}T00:00:00+05:30`).toISOString();
  const { bookings, reload } = useLiveBookings({ channel: `admin-${compact ? "today" : "board"}`, from, to });

  // If we arrived from a notification for another day, jump to that day.
  useEffect(() => {
    if (!focus) return;
    supabaseBrowser()
      .from("bookings")
      .select("start_at")
      .eq("id", focus)
      .maybeSingle()
      .then(({ data }) => data && setDay(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(data.start_at))));
  }, [focus]);

  const rows = useMemo(() => {
    const list = (bookings ?? []).filter((b) => !holdExpired(b) || status === "all");
    if (status === "all") return list;
    if (status === "active") return list.filter((b) => ["pending_payment", "confirmed", "assigned", "in_progress"].includes(b.status));
    return list.filter((b) => b.status === status);
  }, [bookings, status]);

  const unassigned = (bookings ?? []).filter((b) => b.status === "confirmed" && !b.employee_id).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-full border border-line bg-white">
          <button onClick={() => setDay(addDays(day, -1))} className="grid size-10 cursor-pointer place-items-center" aria-label="Previous day"><ChevronLeft className="size-4" /></button>
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-10 bg-transparent text-sm font-semibold" aria-label="Day" />
          <button onClick={() => setDay(addDays(day, 1))} className="grid size-10 cursor-pointer place-items-center" aria-label="Next day"><ChevronRight className="size-4" /></button>
        </div>
        {day !== istDate(0) && <button onClick={() => setDay(istDate(0))} className="min-h-10 cursor-pointer px-3 text-sm text-violet">Today</button>}
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="field h-10 min-h-10 w-auto py-0" aria-label="Status filter">
          <option value="active">Active</option>
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><Radio className="size-3.5" /> Live</span>
        <button onClick={() => setWalkIn(true)} className="btn btn-ink ml-auto h-10 text-sm"><Plus className="size-4" /> Walk-in / phone booking</button>
      </div>

      {unassigned > 0 && <div className="mb-4"><Notice kind="error">{unassigned} booking{unassigned > 1 ? "s" : ""} need a therapist.</Notice></div>}

      {!bookings ? (
        <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>
      ) : rows.length === 0 ? (
        <Panel className="p-8 text-center text-muted">No bookings for {fmtDate(from)}.</Panel>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => (
            <li key={b.id}>
              <BookingRow b={b} employees={employees} skills={skills} onChange={reload} highlight={focus === b.id} onOpen={() => setOpenId(b.id)} />
            </li>
          ))}
        </ul>
      )}

      <BookingDrawer id={openId} onClose={() => setOpenId(null)} onChanged={reload} staff={staff} />
      <WalkInModal open={walkIn} onClose={() => setWalkIn(false)} onCreated={(d) => { setWalkIn(false); setDay(d); reload(); }} />
    </div>
  );
}

function BookingRow({ b, employees, skills, onChange, highlight, onOpen }: { b: Booking; employees: Employee[]; skills: Skills; onChange: () => void; highlight: boolean; onOpen: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pay, setPay] = useState(false);
  const due = Number(b.total_amount) - Number(b.amount_paid);
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState<"cash" | "upi" | "card">("cash");
  const serviceIds = (b.booking_items ?? []).map((i) => i.service_id).filter(Boolean) as string[];
  const open = ["pending_payment", "confirmed", "assigned"].includes(b.status);

  const qualified = (e: Employee) =>
    serviceIds.every((s) => skills[e.id]?.has(s)) && (b.gender_preference === "any" || e.gender === b.gender_preference);

  const run = async (key: string, url: string, body?: unknown) => {
    setBusy(key);
    setErr(null);
    try {
      await api(url, body);
      setPay(false);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  };

  return (
    <Panel className={cn("p-4 md:p-5", highlight && "ring-2 ring-gold")}>
      <div className="grid gap-4 md:grid-cols-[110px_1fr_260px] md:items-start">
        <div>
          <p className="font-display text-2xl tabular-nums">{fmtTime(b.start_at)}</p>
          <p className="text-xs text-muted">to {fmtTime(b.end_at)} · {b.resource}</p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onOpen} className="cursor-pointer font-semibold underline-offset-4 hover:underline">{b.customer_name}</button>
            <StatusBadge status={b.status} expired={holdExpired(b)} />
            <span className="text-xs text-muted">#{b.code}{b.source === "admin" && " · walk-in"}</span>
          </div>
          <p className="mt-1 text-sm text-ink/80">{(b.booking_items ?? []).map((i) => `${i.name_en} (${minutesLabel(i.duration_min)})`).join(", ")}</p>
          <p className="mt-1 text-sm text-muted">
            <a href={telHref(b.customer_phone)} className="inline-flex items-center gap-1 hover:text-ink"><Phone className="size-3.5" />{prettyPhone(b.customer_phone)}</a>
            {" · "}Pref: {b.gender_preference}
            {" · "}{inr(b.total_amount)} · paid {inr(b.amount_paid)} ({b.payment_mode.replaceAll("_", " ")})
          </p>
          {b.notes && <p className="mt-2 rounded-lg bg-sand px-3 py-2 text-sm">{b.notes}</p>}
        </div>
        <div className="space-y-2">
          {open ? (
            <div className="flex gap-2">
              <label htmlFor={`as-${b.id}`} className="sr-only">Therapist</label>
              <select
                id={`as-${b.id}`}
                value={b.employee_id ?? ""}
                disabled={!!busy || b.status === "pending_payment"}
                onChange={(e) => e.target.value && run("assign", `/api/admin/bookings/${b.id}/assign`, { employeeId: e.target.value })}
                className={cn("field h-10 min-h-10 flex-1 py-0 text-sm", !b.employee_id && b.status === "confirmed" && "border-magenta")}
              >
                <option value="">{b.employee_id ? b.employee_name : "Assign therapist…"}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id} disabled={!qualified(e)}>
                    {e.full_name} ({e.gender[0].toUpperCase()}){qualified(e) ? "" : " – not trained / pref"}
                  </option>
                ))}
              </select>
              {!b.employee_id && b.status === "confirmed" && (
                <button onClick={() => run("auto", `/api/admin/bookings/${b.id}/assign`, { employeeId: null })} disabled={!!busy} className="grid size-10 cursor-pointer place-items-center rounded-full border border-line hover:bg-sand" aria-label="Auto-assign" title="Auto-assign">
                  {busy === "auto" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Therapist: <span className="font-semibold text-ink">{b.employee_name ?? "—"}</span>{b.commission_amount != null && ` · commission ${inr(b.commission_amount)}`}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {b.status === "assigned" && <ActBtn busy={busy === "start"} onClick={() => run("start", `/api/bookings/${b.id}/status`, { status: "in_progress" })}>Start</ActBtn>}
            {b.status === "in_progress" && <ActBtn busy={busy === "undo"} onClick={() => run("undo", `/api/bookings/${b.id}/status`, { status: "assigned" })}>Undo start</ActBtn>}
            <ActBtn onClick={onOpen}>Details</ActBtn>
            {b.status === "in_progress" && <ActBtn busy={busy === "done"} onClick={() => run("done", `/api/bookings/${b.id}/status`, { status: "completed" })}>Complete</ActBtn>}
            {(b.status === "assigned" || b.status === "confirmed") && <ActBtn busy={busy === "ns"} onClick={() => confirm("Mark as no-show?") && run("ns", `/api/bookings/${b.id}/status`, { status: "no_show" })}>No-show</ActBtn>}
            {due > 0 && !["cancelled", "pending_payment"].includes(b.status) && <ActBtn onClick={() => setPay((v) => !v)}>Record payment</ActBtn>}
            {open && <ActBtn danger busy={busy === "cancel"} onClick={() => { const r = prompt("Reason for cancelling?"); if (r !== null) run("cancel", `/api/bookings/${b.id}/cancel`, { reason: r || "Cancelled by spa" }); }}>Cancel</ActBtn>}
          </div>
          {pay && (
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run("pay", `/api/bookings/${b.id}/payment`, { amount: Number(amount), method }); }}>
              <input aria-label="Amount" className="field h-10 min-h-10 w-24 py-0 text-sm" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select aria-label="Method" className="field h-10 min-h-10 w-auto py-0 text-sm" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option>
              </select>
              <button className="btn btn-ink h-10 min-h-10 text-sm" disabled={!!busy}>Save</button>
            </form>
          )}
          {err && <p role="alert" className="text-sm text-magenta">{err}</p>}
        </div>
      </div>
    </Panel>
  );
}

function ActBtn({ children, onClick, busy, danger }: { children: React.ReactNode; onClick: () => void; busy?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className={cn("inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors", danger ? "border-magenta/30 text-magenta hover:bg-magenta/5" : "border-line hover:bg-sand")}>
      {busy && <Loader2 className="size-3 animate-spin" />}
      {children}
    </button>
  );
}

function WalkInModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (day: string) => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [variantIds, setVariantIds] = useState<string[]>([]);
  const [day, setDay] = useState(istDate(0));
  const [gender, setGender] = useState<"any" | "female" | "male">("any");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const db = supabaseBrowser();
    db.from("services").select("*, service_variants(*)").eq("is_active", true).order("sort").then(({ data }) => setServices((data as Service[]) ?? []));
    db.from("settings").select("*").eq("id", 1).single().then(({ data }) => setSettings(data as Settings));
  }, [open]);

  useEffect(() => {
    if (!open || !variantIds.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to look up yet
      setSlots(null);
      return;
    }
    supabaseBrowser()
      .rpc("get_available_slots", { p_date: day, p_variant_ids: variantIds, p_gender: gender })
      .then(({ data }) => setSlots(((data as { slot_start: string }[]) ?? []).map((r) => r.slot_start)));
  }, [open, day, gender, variantIds]);

  const toggleVariant = (svc: Service, vid: string) => {
    setSlot("");
    setVariantIds((cur) => {
      const others = cur.filter((id) => !svc.service_variants.some((v) => v.id === id));
      return cur.includes(vid) ? others : [...others, vid].slice(0, 5);
    });
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/admin/bookings", { variantIds, start: slot, gender, name, phone: phone.replace(/[\s-]/g, ""), notes: notes || undefined });
      onCreated(day);
      setVariantIds([]); setSlot(""); setName(""); setPhone(""); setNotes("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="New booking (pay at counter)" wide>
      <div className="space-y-5">
        <div>
          <p className="label">Services</p>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-line p-3" data-lenis-prevent>
            {services.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-2">
                <span className="w-48 text-sm">{s.name_en}</span>
                {s.service_variants.filter((v) => v.is_active).map((v) => (
                  <button key={v.id} type="button" onClick={() => toggleVariant(s, v.id)} aria-pressed={variantIds.includes(v.id)} className={cn("min-h-8 cursor-pointer rounded-full border px-2.5 text-xs", variantIds.includes(v.id) ? "border-violet bg-violet text-white" : "border-line")}>
                    {v.duration_min}m · {inr(v.price)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="wi-day" className="label">Day</label>
            <input id="wi-day" type="date" className="field" value={day} min={istDate(0)} onChange={(e) => { setDay(e.target.value); setSlot(""); }} />
          </div>
          {settings?.allow_gender_preference && (
            <div>
              <label htmlFor="wi-g" className="label">Therapist preference</label>
              <select id="wi-g" className="field" value={gender} onChange={(e) => { setGender(e.target.value as typeof gender); setSlot(""); }}>
                <option value="any">Any</option><option value="female">Female</option><option value="male">Male</option>
              </select>
            </div>
          )}
        </div>
        {variantIds.length > 0 && (
          <div>
            <p className="label">Start time</p>
            {slots === null ? <p className="text-sm text-muted">Checking…</p> : slots.length === 0 ? <p className="text-sm text-muted">No free slots.</p> : (
              <div className="flex flex-wrap gap-2">
                {slots.map((x) => (
                  <button key={x} type="button" onClick={() => setSlot(x)} aria-pressed={slot === x} className={cn("min-h-9 cursor-pointer rounded-lg border px-3 text-sm tabular-nums", slot === x ? "border-violet bg-violet text-white" : "border-line")}>
                    {fmtTime(x)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="wi-n" className="label">Customer name</label><input id="wi-n" className="field" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label htmlFor="wi-p" className="label">WhatsApp number</label><input id="wi-p" className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div><label htmlFor="wi-notes" className="label">Notes</label><input id="wi-notes" className="field" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {err && <Notice kind="error">{err}</Notice>}
        <button onClick={submit} disabled={busy || !slot || name.trim().length < 2 || phone.replace(/\D/g, "").length < 10} className="btn btn-ink w-full">
          {busy && <Loader2 className="size-4 animate-spin" />} Create booking
        </button>
      </div>
    </Modal>
  );
}
