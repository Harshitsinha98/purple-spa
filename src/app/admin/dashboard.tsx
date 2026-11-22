"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmtDate, inr, istDate } from "@/lib/format";
import { BookingsBoard } from "@/components/admin/bookings-board";
import { PageHead, Stat } from "@/components/admin/ui";
import type { MonthlyReport } from "@/lib/types";

export function Dashboard() {
  const [r, setR] = useState<MonthlyReport | null>(null);
  useEffect(() => {
    supabaseBrowser().rpc("monthly_report", { p_month: istDate(0) }).then(({ data }) => setR(data as MonthlyReport));
  }, []);
  return (
    <div>
      <PageHead title="Today" sub={fmtDate(new Date(), "en", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Collected this month" value={r ? inr(r.collections.total) : "…"} />
        <Stat label="Completed this month" value={r ? r.summary.completed : "…"} hint={r ? `${inr(r.summary.service_value)} in services` : undefined} />
        <Stat label="Upcoming this month" value={r ? r.summary.upcoming : "…"} />
        <Stat label="Commission due" value={r ? inr(r.summary.commission) : "…"} />
      </div>
      <BookingsBoard compact />
    </div>
  );
}
