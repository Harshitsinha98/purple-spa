"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { downloadCsv, monthRange } from "@/lib/csv";
import { fmtDate, fmtTime, inr, istDate } from "@/lib/format";
import { Notice, PageHead, Panel, Stat } from "@/components/admin/ui";
import type { Booking, MonthlyReport } from "@/lib/types";

export default function ReportsAdmin() {
  const [month, setMonth] = useState(istDate(0).slice(0, 7));
  const [r, setR] = useState<MonthlyReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on month change
    setR(null);
    setErr(null);
    supabaseBrowser()
      .rpc("monthly_report", { p_month: `${month}-01` })
      .then(({ data, error }) => (error ? setErr(error.message) : setR(data as MonthlyReport)));
  }, [month]);

  const exportBookings = async () => {
    const { from, to } = monthRange(month);
    const { data } = await supabaseBrowser().from("bookings").select("*, booking_items(name_en, duration_min, price)").gte("start_at", from).lt("start_at", to).order("start_at");
    const rows = (data as Booking[]) ?? [];
    downloadCsv(`bookings-${month}.csv`, [
      ["Date", "Time", "Booking", "Customer", "Phone", "Services", "Therapist", "Status", "Payment mode", "Total", "Paid", "Due", "Commission", "Source"],
      ...rows.map((b) => [
        fmtDate(b.start_at), fmtTime(b.start_at), b.code, b.customer_name, b.customer_phone,
        (b.booking_items ?? []).map((i) => `${i.name_en} ${i.duration_min}m`).join(" + "),
        b.employee_name, b.status, b.payment_mode, b.total_amount, b.amount_paid, Number(b.total_amount) - Number(b.amount_paid), b.commission_amount, b.source,
      ]),
    ]);
  };

  return (
    <div>
      <PageHead
        title="Reports"
        sub="Revenue counts completed sessions. Collections count money actually received in the month."
        actions={
          <>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="field h-10 min-h-10 w-auto py-0" aria-label="Month" />
            <button onClick={exportBookings} className="btn btn-ghost h-10 text-sm"><FileSpreadsheet className="size-4" /> All bookings CSV</button>
          </>
        }
      />
      {err && <Notice kind="error">{err}</Notice>}
      {!r ? (
        !err && <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Revenue (completed)" value={inr(r.summary.service_value)} hint={`${r.summary.completed} sessions`} />
            <Stat label="Collected" value={inr(r.collections.total)} hint={r.collections.refunded ? `${inr(r.collections.refunded)} refunded` : undefined} />
            <Stat label="Commission payable" value={inr(r.summary.commission)} />
            <Stat label="Unpaid after service" value={inr(r.summary.outstanding)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Bookings" value={r.summary.bookings} />
            <Stat label="Cancelled" value={r.summary.cancelled} />
            <Stat label="No-shows" value={r.summary.no_show} />
          </div>

          <Panel className="p-5">
            <h2 className="font-display text-2xl">Daily revenue</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.daily.map((d) => ({ ...d, label: d.day.slice(8) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7ddd0" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `₹${Number(v) / 1000}k`} />
                  <Tooltip formatter={(v) => inr(Number(v))} labelFormatter={(l) => `Day ${l}`} />
                  <Bar dataKey="revenue" name="Revenue" fill="#6b2fa0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="overflow-x-auto">
              <div className="flex items-center justify-between p-5 pb-0">
                <h2 className="font-display text-2xl">By employee</h2>
                <button onClick={() => downloadCsv(`employees-${month}.csv`, [["Employee", "Completed", "No-shows", "Minutes", "Revenue", "Commission"], ...r.employees.map((e) => [e.name, e.bookings, e.no_show, Math.round(e.minutes), e.revenue, e.commission])])} className="inline-flex min-h-9 cursor-pointer items-center gap-1 text-sm text-violet"><Download className="size-4" /> CSV</button>
              </div>
              <table className="mt-3 w-full text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3 pl-5">Name</th><th className="p-3 text-right">Done</th><th className="p-3 text-right">Hours</th><th className="p-3 text-right">Revenue</th><th className="p-3 pr-5 text-right">Commission</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {r.employees.map((e) => (
                    <tr key={e.id}><td className="p-3 pl-5">{e.name}</td><td className="p-3 text-right tabular-nums">{e.bookings}</td><td className="p-3 text-right tabular-nums">{(e.minutes / 60).toFixed(1)}</td><td className="p-3 text-right tabular-nums">{inr(e.revenue)}</td><td className="p-3 pr-5 text-right font-semibold tabular-nums">{inr(e.commission)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel className="overflow-x-auto">
              <div className="flex items-center justify-between p-5 pb-0">
                <h2 className="font-display text-2xl">By service</h2>
                <button onClick={() => downloadCsv(`services-${month}.csv`, [["Service", "Count", "Revenue"], ...r.services.map((s) => [s.name, s.count, s.revenue])])} className="inline-flex min-h-9 cursor-pointer items-center gap-1 text-sm text-violet"><Download className="size-4" /> CSV</button>
              </div>
              <table className="mt-3 w-full text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3 pl-5">Service</th><th className="p-3 text-right">Count</th><th className="p-3 pr-5 text-right">Revenue</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {r.services.length === 0 && <tr><td colSpan={3} className="p-5 text-muted">No completed sessions yet.</td></tr>}
                  {r.services.map((s) => (
                    <tr key={s.name}><td className="p-3 pl-5">{s.name}</td><td className="p-3 text-right tabular-nums">{s.count}</td><td className="p-3 pr-5 text-right tabular-nums">{inr(s.revenue)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          <Panel className="p-5">
            <h2 className="font-display text-2xl">Collections by method</h2>
            <ul className="mt-3 flex flex-wrap gap-3">
              {Object.entries(r.collections.by_method).map(([m, v]) => (
                <li key={m} className="rounded-xl bg-sand px-4 py-3 text-sm"><span className="capitalize">{m === "razorpay" ? "Online" : m}</span>: <span className="font-semibold">{inr(v)}</span></li>
              ))}
              {Object.keys(r.collections.by_method).length === 0 && <li className="text-sm text-muted">Nothing collected yet.</li>}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
