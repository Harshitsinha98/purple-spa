"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api } from "@/lib/checkout";
import { downloadCsv, monthRange } from "@/lib/csv";
import { fmtDate, fmtTime, inr, istDate } from "@/lib/format";
import { Notice, PageHead, Panel, Stat } from "@/components/admin/ui";
import type { Payment } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = Payment & { bookings: { code: string; customer_name: string; customer_phone: string } | null };

export default function PaymentsAdmin() {
  const [month, setMonth] = useState(istDate(0).slice(0, 7));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { from, to } = monthRange(month);
    const { data } = await supabaseBrowser()
      .from("payments")
      .select("*, bookings(code, customer_name, customer_phone)")
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
  }, [month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on month change
    setRows(null);
    load();
  }, [load]);

  const refund = async (p: Row) => {
    const reason = prompt(`Refund ${inr(p.amount)} to ${p.bookings?.customer_name}? Enter a reason:`);
    if (!reason) return;
    setBusy(p.id);
    setMsg(null);
    try {
      await api(`/api/admin/payments/${p.id}/refund`, { reason });
      setMsg({ kind: "ok", text: "Refund started. Razorpay usually credits it in 5–7 working days." });
      load();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    }
    setBusy(null);
  };

  const captured = (rows ?? []).filter((r) => r.status === "captured");
  const sum = (m?: string) => captured.filter((r) => !m || r.method === m).reduce((n, r) => n + Number(r.amount), 0);

  return (
    <div>
      <PageHead
        title="Payments"
        actions={
          <>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="field h-10 min-h-10 w-auto py-0" aria-label="Month" />
            <button
              onClick={() => downloadCsv(`payments-${month}.csv`, [["Date", "Time", "Booking", "Customer", "Phone", "Method", "Amount", "Status", "Razorpay payment", "Note"], ...(rows ?? []).map((r) => [fmtDate(r.created_at), fmtTime(r.created_at), r.bookings?.code, r.bookings?.customer_name, r.bookings?.customer_phone, r.method, r.amount, r.status, r.razorpay_payment_id, r.note])])}
              className="btn btn-ghost h-10 text-sm"
            >
              <Download className="size-4" /> CSV
            </button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total collected" value={inr(sum())} />
        <Stat label="Online (Razorpay)" value={inr(sum("razorpay"))} />
        <Stat label="Cash" value={inr(sum("cash"))} />
        <Stat label="UPI + card at counter" value={inr(sum("upi") + sum("card"))} />
      </div>
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
      <Panel className="overflow-x-auto">
        {!rows ? (
          <p className="flex items-center gap-2 p-6 text-muted"><Loader2 className="size-4 animate-spin" /> Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-muted">No payments this month.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <tr><th className="p-3">When</th><th className="p-3">Booking</th><th className="p-3">Customer</th><th className="p-3">Method</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th><th className="p-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3">{fmtDate(r.created_at)} {fmtTime(r.created_at)}</td>
                  <td className="p-3 font-mono text-xs">#{r.bookings?.code}</td>
                  <td className="p-3">{r.bookings?.customer_name}</td>
                  <td className="p-3 capitalize">{r.method}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">{inr(r.amount)}</td>
                  <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", r.status === "captured" ? "bg-emerald-50 text-emerald-700" : r.status === "refunded" ? "bg-neutral-100 text-neutral-600" : r.status === "failed" ? "bg-magenta/10 text-magenta" : "bg-gold/15 text-[#7a5a17]")}>{r.status === "created" ? "not paid" : r.status}</span></td>
                  <td className="p-3 text-right">
                    {r.method === "razorpay" && r.status === "captured" && (
                      <button onClick={() => refund(r)} disabled={busy === r.id} className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-line px-3 text-xs font-semibold hover:bg-sand">
                        {busy === r.id ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />} Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
