"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, CalendarDays, Check, Clock, Download, IndianRupee, ListChecks, Loader2, Lock, LogOut, Play, StickyNote, Sunrise, TrendingUp, UserX, Wallet, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useNow } from "@/hooks/use-now";
import { pick, useLocale } from "@/lib/i18n/locale-provider";
import { api } from "@/lib/checkout";
import { currentPushSubscription, enablePush, pushSupported, registerSW } from "@/lib/push-client";
import { fmtDate, fmtTime, inr, istDate, minutesLabel } from "@/lib/format";
import { StatusBadge } from "@/components/booking/status-badge";
import { BookingCalendar, calendarRange, istDay, type CalView } from "@/components/calendar/calendar";
import type { Employee, StaffBooking, StaffStats, TimeOff } from "@/lib/types";
import { cn } from "@/lib/utils";

type InstallEvent = Event & { prompt: () => Promise<void> };
type Tab = "today" | "upcoming" | "calendar" | "work";

async function fetchStaff(from: string, to: string) {
  const { data, error } = await supabaseBrowser().rpc("staff_bookings", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return (data as StaffBooking[]) ?? [];
}

/** Keeps a range of the therapist's bookings fresh: realtime events, every minute, and on focus. */
function useStaffBookings(from: string, to: string, enabled: boolean) {
  const [list, setList] = useState<StaffBooking[] | null>(null);
  const load = useCallback(() => fetchStaff(from, to).then(setList).catch(() => setList((l) => l ?? [])), [from, to]);
  useEffect(() => {
    if (!enabled) return;
     
    load();
    const db = supabaseBrowser();
    const ch = db.channel(`staff-${from}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_events" }, () => load()).subscribe();
    const id = setInterval(load, 60_000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", load);
      db.removeChannel(ch);
    };
  }, [enabled, from, load]);
  return { list, reload: load };
}

export function StaffApp() {
  const { t, locale, toggle } = useLocale();
  const { user, profile, loading } = useSession();
  const params = useSearchParams();
  const [employee, setEmployee] = useState<Employee | null | undefined>(undefined);
  const [early, setEarly] = useState(0);
  const [tab, setTab] = useState<Tab>("today");
  const [pushOn, setPushOn] = useState(false);
  const [pushErr, setPushErr] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [leave, setLeave] = useState<TimeOff[]>([]);
  const [calView, setCalView] = useState<CalView>("day");
  const [calDay, setCalDay] = useState(istDate(0));
  const [open, setOpen] = useState<StaffBooking | null>(null);

  useEffect(() => {
    if (!user) return;
    const db = supabaseBrowser();
    db.from("employees").select("*").eq("profile_id", user.id).maybeSingle().then(({ data }) => setEmployee((data as Employee) ?? null));
    db.from("settings").select("staff_early_start_min").eq("id", 1).single().then(({ data }) => setEarly(data?.staff_early_start_min ?? 0));
  }, [user]);

  useEffect(() => {
    registerSW();
    currentPushSubscription().then((s) => setPushOn(Boolean(s)));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const range = useMemo(() => ({ from: new Date(`${istDate(0)}T00:00:00+05:30`).toISOString(), to: new Date(`${istDate(60)}T00:00:00+05:30`).toISOString() }), []);
  const { list, reload } = useStaffBookings(range.from, range.to, Boolean(employee));
  const cal = calendarRange(calView, calDay);
  const { list: calList, reload: reloadCal } = useStaffBookings(cal.from, cal.to, Boolean(employee) && tab === "calendar");

  const loadStats = useCallback(() => {
    const db = supabaseBrowser();
    db.rpc("staff_stats", { p_month: istDate(0) }).then(({ data }) => setStats(data as StaffStats));
    if (employee) db.from("employee_time_off").select("*").eq("employee_id", employee.id).gte("day", istDate(0)).order("day").then(({ data }) => setLeave((data as TimeOff[]) ?? []));
  }, [employee]);
  useEffect(() => {
     
    if (employee) loadStats();
  }, [employee, loadStats, list]);

  // Arriving from a notification: open that booking.
  useEffect(() => {
    const f = params.get("focus");
    const hit = f && list?.find((b) => b.id === f);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the booking the notification pointed to
    if (hit) setOpen(hit);
  }, [params, list]);

  const today = istDate(0);
  const todays = (list ?? []).filter((b) => istDay(b.start_at) === today);
  const upcoming = (list ?? []).filter((b) => istDay(b.start_at) > today && b.status !== "no_show");
  const refresh = () => {
    reload();
    reloadCal();
    loadStats();
  };

  if (loading || (user && employee === undefined)) {
    return <Shell><p className="flex items-center gap-2 text-ivory/70"><Loader2 className="size-4 animate-spin" /> {t.common.loading}</p></Shell>;
  }
  if (!employee) {
    return (
      <Shell>
        <p className="rounded-2xl bg-ivory/5 p-6 text-ivory/80">{t.staff.notStaff}</p>
        <p className="mt-3 text-sm text-ivory/50">{user?.email}</p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="btn btn-ghost text-ivory">{t.auth.signOut}</button>
        </form>
      </Shell>
    );
  }

  const turnOnPush = async () => {
    setPushErr(null);
    try {
      await enablePush(profile!.id);
      setPushOn(true);
    } catch (e) {
      setPushErr(e instanceof Error ? e.message : String(e));
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Clock; count?: number }[] = [
    { id: "today", label: t.staff.today, icon: Sunrise, count: todays.filter((b) => b.status !== "completed" && b.status !== "no_show").length },
    { id: "upcoming", label: t.staff.upcoming, icon: ListChecks, count: upcoming.length },
    { id: "calendar", label: t.staff.calendar, icon: CalendarDays },
    { id: "work", label: t.staff.myWork, icon: TrendingUp },
  ];

  return (
    <Shell
      wide={tab === "calendar"}
      right={
        <div className="flex items-center">
          <button onClick={toggle} className="min-h-11 cursor-pointer px-2 text-sm text-ivory/70">{t.nav.language}</button>
          <form action="/auth/signout" method="post">
            <button className="grid size-11 cursor-pointer place-items-center text-ivory/70" aria-label={t.auth.signOut}><LogOut className="size-4" /></button>
          </form>
        </div>
      }
    >
      <p className="eyebrow text-gold-soft">{employee.full_name} · {employee.title}</p>
      <h1 className="display mt-2 text-4xl text-ivory">{t.staff.title}</h1>

      {stats && (
        <dl className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat label={t.staff.statDone} value={String(stats.month_completed)} />
          <MiniStat label={t.staff.statHours} value={(stats.month_minutes / 60).toFixed(1)} />
          <MiniStat label={t.staff.statEarned} value={inr(stats.month_commission, locale)} />
        </dl>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {pushSupported() && (
          <button onClick={turnOnPush} disabled={pushOn} className={cn("btn h-10 min-h-10 text-sm", pushOn ? "bg-emerald-500/15 text-emerald-300" : "btn-gold")}>
            {pushOn ? <BellRing className="size-4" /> : <Bell className="size-4" />}
            {pushOn ? t.staff.notifyOn : t.staff.notify}
          </button>
        )}
        {install && (
          <button onClick={() => install.prompt().then(() => setInstall(null))} className="btn btn-ghost h-10 min-h-10 text-sm text-ivory">
            <Download className="size-4" /> {t.staff.install}
          </button>
        )}
      </div>
      {pushErr && <p className="mt-2 text-sm text-magenta">{pushErr}</p>}

      <div role="tablist" className="mt-6 grid grid-cols-4 gap-1 rounded-2xl bg-ivory/5 p-1">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={cn("flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[0.72rem] font-semibold transition-colors", tab === x.id ? "bg-ivory text-ink" : "text-ivory/70")}>
            <x.icon className="size-4" aria-hidden />
            <span>{x.label}{x.count ? ` (${x.count})` : ""}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 pb-12">
        {tab === "calendar" ? (
          <BookingCalendar
            view={calView}
            day={calDay}
            onViewChange={setCalView}
            onDayChange={setCalDay}
            loading={!calList}
            events={(calList ?? []).map((b) => ({ id: b.id, start: b.start_at, end: b.end_at, title: b.customer_name, subtitle: b.items.map((i) => i.name_en).join(", "), status: b.status }))}
            onSelect={(id) => setOpen((calList ?? []).find((b) => b.id === id) ?? null)}
            dark
          />
        ) : tab === "work" ? (
          <MyWork stats={stats} leave={leave} />
        ) : (
          <ul className="space-y-3">
            {!list && <li className="text-ivory/60">{t.common.loading}</li>}
            {list && (tab === "today" ? todays : upcoming).length === 0 && <li className="rounded-2xl bg-ivory/5 p-6 text-center text-ivory/60">{t.staff.none}</li>}
            <AnimatePresence initial={false}>
              {(tab === "today" ? todays : upcoming).map((b) => (
                <motion.li key={b.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <StaffCard b={b} early={early} focus={params.get("focus") === b.id} onChange={refresh} showDate={tab === "upcoming"} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-night/70 p-3 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={open.customer_name}>
              <button onClick={() => setOpen(null)} className="absolute -top-12 right-0 grid size-10 cursor-pointer place-items-center rounded-full bg-ivory/10 text-ivory" aria-label={t.common.close}><X className="size-5" /></button>
              <StaffCard b={(list ?? []).find((x) => x.id === open.id) ?? (calList ?? []).find((x) => x.id === open.id) ?? open} early={early} focus={false} onChange={refresh} showDate />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-ivory/5 px-3 py-3">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-ivory/50">{label}</dt>
      <dd className="mt-1 font-display text-2xl tabular-nums text-ivory">{value}</dd>
    </div>
  );
}

function MyWork({ stats, leave }: { stats: StaffStats | null; leave: TimeOff[] }) {
  const { t, locale } = useLocale();
  if (!stats) return <p className="text-ivory/60">{t.common.loading}</p>;
  const rows: [string, string][] = [
    [t.staff.statDone, String(stats.month_completed)],
    [t.staff.statHours, `${(stats.month_minutes / 60).toFixed(1)}`],
    [t.staff.statValue, inr(stats.month_service_value, locale)],
    [t.staff.statEarned, inr(stats.month_commission, locale)],
    [t.staff.statNoShow, String(stats.month_no_show)],
    [t.staff.statUpcoming, String(stats.upcoming)],
    [t.staff.statAllTime, String(stats.all_time_completed)],
    [t.staff.statRate, `${stats.commission_percent}%`],
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ivory p-5 text-ink">
        <p className="eyebrow text-violet">{fmtDate(new Date(), locale, { weekday: undefined, day: undefined, month: "long", year: "numeric" })}</p>
        <dl className="mt-3 divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between py-2.5">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="font-display text-xl tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-2xl bg-ivory/5 p-5">
        <p className="eyebrow text-gold-soft">{t.staff.leave}</p>
        {leave.length === 0 ? (
          <p className="mt-2 text-sm text-ivory/60">{t.staff.noLeave}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-ivory/85">
            {leave.map((l) => (
              <li key={l.id}>{fmtDate(`${l.day}T12:00:00+05:30`, locale, { weekday: "long" })}{l.reason && ` · ${l.reason}`}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Shell({ children, right, wide }: { children: React.ReactNode; right?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-svh bg-night text-ivory">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-ivory/10 bg-night/90 px-4 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center gap-2">
          <Image src="/icons/icon-192.png" alt="" width={30} height={30} className="rounded-full" />
          <span className="font-display text-lg">Purple Spa · Staff</span>
        </div>
        {right}
      </header>
      <main className={cn("mx-auto px-4 pt-6", wide ? "max-w-5xl" : "max-w-lg")} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {children}
      </main>
    </div>
  );
}

function StaffCard({ b, early, focus, onChange, showDate }: { b: StaffBooking; early: number; focus: boolean; onChange: () => void; showDate: boolean }) {
  const { t, locale } = useLocale();
  const now = useNow(30_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [collect, setCollect] = useState(false);
  const due = Number(b.total_amount) - Number(b.amount_paid);
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState<"cash" | "upi" | "card">("cash");

  const startAt = new Date(b.start_at).getTime();
  const unlocks = startAt - early * 60_000;
  const canStart = b.status === "assigned" && now >= unlocks;
  const canNoShow = b.status === "assigned" && now >= startAt;

  const act = async (key: string, url: string, body: unknown) => {
    setBusy(key);
    setErr(null);
    try {
      await api(url, body);
      setCollect(false);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  };

  const waitText = () => {
    const mins = Math.max(1, Math.round((unlocks - now) / 60_000));
    const rel = mins < 60 ? `${mins} ${t.common.min}` : mins < 1440 ? `${Math.round(mins / 60)} h` : fmtDate(new Date(unlocks), locale);
    return `${t.staff.locked} ${fmtTime(new Date(unlocks), locale)} (${rel})`;
  };

  return (
    <article className={cn("rounded-2xl border bg-ivory p-4 text-ink", focus ? "border-gold ring-2 ring-gold/40" : "border-transparent")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-display text-2xl">
            <Clock className="size-4 text-violet" aria-hidden />
            {showDate && `${fmtDate(b.start_at, locale)} · `}
            {fmtTime(b.start_at, locale)}
          </p>
          <p className="text-sm text-muted">→ {fmtTime(b.end_at, locale)} · {b.resource === "bed" ? t.book.spa : t.book.salon} · #{b.code}</p>
        </div>
        <StatusBadge status={b.status} />
      </div>
      <p className="mt-3 font-semibold">{b.customer_name}</p>
      <ul className="mt-1 text-sm text-ink/80">
        {b.items.map((i) => (
          <li key={i.id}>{pick(i, "name", locale)} · {minutesLabel(i.duration_min, locale)}</li>
        ))}
      </ul>
      {b.notes && (
        <p className="mt-2 flex gap-1.5 rounded-lg bg-sand px-3 py-2 text-sm"><StickyNote className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />{b.notes}</p>
      )}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
        <IndianRupee className="size-3.5 text-muted" aria-hidden />
        {inr(b.total_amount, locale)} · {t.account.paid} {inr(b.amount_paid, locale)}
        {due > 0 && b.status !== "no_show" && <span className="font-semibold text-magenta">· {t.staff.balance} {inr(due, locale)}</span>}
        {b.status === "completed" && b.commission_amount != null && <span className="font-semibold text-emerald-700">· {t.staff.yourShare} {inr(b.commission_amount, locale)}</span>}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {b.status === "assigned" &&
          (canStart ? (
            <button onClick={() => act("start", `/api/bookings/${b.id}/status`, { status: "in_progress" })} disabled={!!busy} className="btn btn-ink h-11 text-sm">
              {busy === "start" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {t.staff.start}
            </button>
          ) : (
            <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-muted">
              <Lock className="size-4" aria-hidden /> {waitText()}
            </span>
          ))}
        {b.status === "in_progress" && (
          <button onClick={() => act("done", `/api/bookings/${b.id}/status`, { status: "completed" })} disabled={!!busy} className="btn btn-ink h-11 text-sm">
            {busy === "done" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {t.staff.complete}
          </button>
        )}
        {due > 0 && ["in_progress", "completed"].includes(b.status) && (
          <button onClick={() => setCollect((v) => !v)} className="btn btn-gold h-11 text-sm">
            <Wallet className="size-4" /> {t.staff.collect}
          </button>
        )}
        {canNoShow && (
          <button onClick={() => confirm(t.staff.noShowConfirm) && act("noshow", `/api/bookings/${b.id}/status`, { status: "no_show" })} disabled={!!busy} className="btn btn-ghost h-11 text-sm text-magenta">
            <UserX className="size-4" /> {t.staff.noShow}
          </button>
        )}
      </div>
      {b.status === "assigned" && !canStart && <p className="mt-2 text-xs text-muted">{t.staff.earlyHint}</p>}

      {collect && (
        <form
          className="mt-4 grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-sand p-3"
          onSubmit={(e) => {
            e.preventDefault();
            act("pay", `/api/bookings/${b.id}/payment`, { amount: Number(amount), method });
          }}
        >
          <label className="sr-only" htmlFor={`amt-${b.id}`}>{t.staff.amount}</label>
          <input id={`amt-${b.id}`} className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <label className="sr-only" htmlFor={`m-${b.id}`}>{t.staff.method}</label>
          <select id={`m-${b.id}`} className="field w-auto" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </select>
          <button className="btn btn-ink col-span-2" disabled={!!busy}>
            {busy === "pay" && <Loader2 className="size-4 animate-spin" />} {t.staff.save}
          </button>
        </form>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-magenta">{err}</p>}
    </article>
  );
}
