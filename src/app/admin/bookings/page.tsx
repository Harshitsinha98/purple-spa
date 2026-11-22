"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Download, List, Loader2, Radio, Search } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLiveBookings } from "@/hooks/use-live-bookings";
import { downloadCsv } from "@/lib/csv";
import { fmtDate, fmtTime, inr, istDate, prettyPhone } from "@/lib/format";
import { StatusBadge, holdExpired } from "@/components/booking/status-badge";
import { BookingCalendar, calendarRange, type CalView } from "@/components/calendar/calendar";
import { BookingDrawer, useStaffList } from "@/components/admin/booking-drawer";
import { PageHead, Panel } from "@/components/admin/ui";
import type { Booking, Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AdminBookingsPage() {
  return (
    <Suspense>
      <AdminBookings />
    </Suspense>
  );
}

function AdminBookings() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get("view") === "list" ? "list" : "calendar";
  const [openId, setOpenId] = useState<string | null>(params.get("focus"));
  const [bump, setBump] = useState(0);
  const staff = useStaffList();
  const setMode = (m: "list" | "calendar") => router.replace(`/admin/bookings?view=${m}`, { scroll: false });

  return (
    <div>
      <PageHead
        title="Bookings"
        sub="Every booking, as a calendar or a searchable list. Click one to see details, assign, start, move or refund."
        actions={
          <div role="tablist" className="inline-flex rounded-full border border-line bg-white p-0.5">
            {([["calendar", CalendarDays, "Calendar"], ["list", List, "All bookings"]] as const).map(([m, Icon, label]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-semibold", mode === m ? "bg-ink text-ivory" : "text-muted hover:text-ink")}>
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        }
      />
      {mode === "calendar" ? <CalendarMode onOpen={setOpenId} staff={staff} /> : <ListMode onOpen={setOpenId} bump={bump} staff={staff} />}
      <BookingDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => setBump((n) => n + 1)} staff={staff} />
    </div>
  );
}

function CalendarMode({ onOpen, staff }: { onOpen: (id: string) => void; staff: ReturnType<typeof useStaffList> }) {
  const [view, setView] = useState<CalView>("week");
  const [day, setDay] = useState(istDate(0));
  const [hours, setHours] = useState<{ open: number; close: number }>({ open: 600, close: 1290 });
  const { from, to } = calendarRange(view, day);
  const { bookings } = useLiveBookings({ channel: "admin-calendar", from, to });

  useEffect(() => {
    supabaseBrowser().from("settings").select("open_time, close_time").eq("id", 1).single().then(({ data }) => {
      const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      if (data) setHours({ open: m((data as Settings).open_time), close: m((data as Settings).close_time) });
    });
  }, []);

  const events = (bookings ?? [])
    .filter((b) => !holdExpired(b))
    .map((b) => ({
      id: b.id,
      start: b.start_at,
      end: b.end_at,
      title: b.customer_name,
      subtitle: [(b.booking_items ?? []).map((i) => i.name_en).join(", "), b.employee_name].filter(Boolean).join(" · "),
      status: b.status,
      resourceId: b.employee_id,
    }));
  const unassigned = (bookings ?? []).filter((b) => b.status === "confirmed" && !b.employee_id).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700"><Radio className="size-3.5" /> Live</span>
        {unassigned > 0 && <span className="rounded-full bg-magenta/10 px-3 py-1 font-semibold text-magenta">{unassigned} need a therapist</span>}
        <Legend />
      </div>
      <BookingCalendar
        view={view}
        day={day}
        onViewChange={setView}
        onDayChange={setDay}
        events={events}
        loading={!bookings}
        onSelect={onOpen}
        resources={view === "day" ? staff.employees.map((e) => ({ id: e.id, name: e.full_name })) : undefined}
        openMinutes={hours.open}
        closeMinutes={hours.close}
      />
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["Awaiting payment", "bg-[#fbf1dc] border-gold/60"],
    ["Needs therapist", "bg-[#e3f7f9] border-cyan/60"],
    ["Assigned", "bg-[#efe6f8] border-violet/50"],
    ["In session", "bg-[#f3dcff] border-orchid"],
    ["Completed", "bg-emerald-50 border-emerald-300"],
    ["No-show", "bg-[#fbe3ee] border-magenta/40"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted">
      {items.map(([l, c]) => (
        <li key={l} className="flex items-center gap-1.5"><span className={cn("size-3 rounded-sm border-l-[3px]", c)} />{l}</li>
      ))}
    </ul>
  );
}

const PAGE = 50;
const clean = (s: string) => s.replace(/[,()*%"\\]/g, " ").trim();

function ListMode({ onOpen, bump, staff }: { onOpen: (id: string) => void; bump: number; staff: ReturnType<typeof useStaffList> }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [employee, setEmployee] = useState("all");
  const [pay, setPay] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"recent" | "upcoming" | "oldest">("recent");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [count, setCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  const build = useCallback(() => {
    let query = supabaseBrowser().from("bookings").select("*, booking_items(name_en, duration_min)", { count: "exact" });
    const term = clean(q);
    if (term) {
      const digits = term.replace(/\D/g, "");
      query = query.or([`customer_name.ilike."*${term}*"`, `code.ilike."*${term}*"`, `customer_email.ilike."*${term}*"`, ...(digits.length >= 3 ? [`customer_phone_key.like.*${digits}*`] : [])].join(","));
    }
    if (status === "active") query = query.in("status", ["confirmed", "assigned", "in_progress"]);
    else if (status !== "all") query = query.eq("status", status);
    if (employee === "none") query = query.is("employee_id", null);
    else if (employee !== "all") query = query.eq("employee_id", employee);
    if (pay !== "all") query = query.eq("payment_status", pay);
    if (from) query = query.gte("start_at", new Date(`${from}T00:00:00+05:30`).toISOString());
    if (to) query = query.lt("start_at", new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400000).toISOString());
    if (order === "upcoming") query = query.gte("start_at", new Date().toISOString()).order("start_at", { ascending: true });
    else query = query.order("start_at", { ascending: order === "oldest" });
    return query;
  }, [q, status, employee, pay, from, to, order]);

  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      const { data, count: c } = await build().range(page * PAGE, page * PAGE + PAGE - 1);
      if (!alive) return;
      setRows((data as Booking[]) ?? []);
      setCount(c ?? 0);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [build, page, bump]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- new filters start from the first page
  useEffect(() => setPage(0), [q, status, employee, pay, from, to, order]);

  const exportCsv = async () => {
    setExporting(true);
    const { data } = await build().range(0, 4999);
    const list = (data as Booking[]) ?? [];
    downloadCsv(`bookings-${istDate(0)}.csv`, [
      ["Date", "Time", "Booking", "Customer", "Phone", "Services", "Therapist", "Status", "Payment", "Total", "Paid", "Due", "Commission", "Source"],
      ...list.map((b) => [fmtDate(b.start_at), fmtTime(b.start_at), b.code, b.customer_name, b.customer_phone, (b.booking_items ?? []).map((i) => i.name_en).join(" + "), b.employee_name, b.status, b.payment_status, b.total_amount, b.amount_paid, Number(b.total_amount) - Number(b.amount_paid), b.commission_amount, b.source]),
    ]);
    setExporting(false);
  };

  const pages = Math.max(1, Math.ceil(count / PAGE));
  const totals = useMemo(() => (rows ?? []).reduce((n, b) => n + Number(b.total_amount), 0), [rows]);

  return (
    <div className="space-y-3">
      <Panel className="grid gap-2 p-3 md:grid-cols-[1fr_auto_auto_auto] lg:grid-cols-[1.4fr_repeat(6,auto)]">
        <label className="relative">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="field pl-9" placeholder="Name, phone, email or booking ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select aria-label="Status" className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending_payment">Awaiting payment</option>
          <option value="confirmed">Needs therapist</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In session</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
        <select aria-label="Therapist" className="field w-auto" value={employee} onChange={(e) => setEmployee(e.target.value)}>
          <option value="all">All therapists</option>
          <option value="none">Unassigned</option>
          {staff.employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <select aria-label="Payment" className="field w-auto" value={pay} onChange={(e) => setPay(e.target.value)}>
          <option value="all">Any payment</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partly paid</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
        <input aria-label="From date" type="date" className="field w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input aria-label="To date" type="date" className="field w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        <select aria-label="Sort" className="field w-auto" value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
          <option value="recent">Newest date first</option>
          <option value="upcoming">Upcoming only</option>
          <option value="oldest">Oldest first</option>
        </select>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>{rows ? `${count} booking${count === 1 ? "" : "s"}${rows.length ? ` · this page ${inr(totals)}` : ""}` : "Loading…"}</span>
        <button onClick={exportCsv} disabled={exporting || !count} className="btn btn-ghost h-9 min-h-9 text-sm text-ink">
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export CSV
        </button>
      </div>

      <Panel className="overflow-x-auto">
        {!rows ? (
          <p className="flex items-center gap-2 p-6 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-muted">No bookings match these filters.</p>
        ) : (
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3 pl-4">When</th><th className="p-3">Customer</th><th className="p-3">Services</th><th className="p-3">Therapist</th><th className="p-3">Status</th><th className="p-3 text-right">Total</th><th className="p-3 pr-4 text-right">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((b) => (
                <tr key={b.id} onClick={() => onOpen(b.id)} className="cursor-pointer transition-colors hover:bg-sand/50" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(b.id)}>
                  <td className="p-3 pl-4 whitespace-nowrap"><span className="font-semibold">{fmtDate(b.start_at)}</span><br /><span className="text-muted">{fmtTime(b.start_at)}</span></td>
                  <td className="p-3"><span className="font-semibold">{b.customer_name}</span><br /><span className="text-muted">{prettyPhone(b.customer_phone)} · #{b.code}</span></td>
                  <td className="max-w-56 truncate p-3">{(b.booking_items ?? []).map((i) => i.name_en).join(", ")}</td>
                  <td className="p-3">{b.employee_name ?? <span className="text-magenta">—</span>}</td>
                  <td className="p-3"><StatusBadge status={b.status} expired={holdExpired(b)} /></td>
                  <td className="p-3 text-right tabular-nums">{inr(b.total_amount)}</td>
                  <td className="p-3 pr-4 text-right tabular-nums">{inr(b.amount_paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-white disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
          <span>Page {page + 1} of {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-white disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
