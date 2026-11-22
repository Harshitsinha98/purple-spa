"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, Check, Clock, Download, Loader2, Phone, Play, StickyNote, UserX, Wallet } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useLiveBookings } from "@/hooks/use-live-bookings";
import { pick, useLocale } from "@/lib/i18n/locale-provider";
import { api } from "@/lib/checkout";
import { currentPushSubscription, enablePush, pushSupported, registerSW } from "@/lib/push-client";
import { fmtDate, fmtTime, inr, istDate, minutesLabel, prettyPhone, telHref } from "@/lib/format";
import { StatusBadge } from "@/components/booking/status-badge";
import type { Booking, Employee } from "@/lib/types";
import { cn } from "@/lib/utils";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function StaffApp() {
  const { t, locale, toggle } = useLocale();
  const { user, profile, loading } = useSession();
  const params = useSearchParams();
  const [employee, setEmployee] = useState<Employee | null | undefined>(undefined);
  const [tab, setTab] = useState<"today" | "upcoming">("today");
  const [pushOn, setPushOn] = useState(false);
  const [pushErr, setPushErr] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (!user) return;
    supabaseBrowser()
      .from("employees")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle()
      .then(({ data }) => setEmployee((data as Employee) ?? null));
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

  const from = useMemo(() => new Date(`${istDate(0)}T00:00:00+05:30`).toISOString(), []);
  const { bookings, reload } = useLiveBookings({
    channel: "staff-bookings",
    filter: employee ? `employee_id=eq.${employee.id}` : undefined,
    from,
    enabled: Boolean(employee),
  });

  const todayEnd = new Date(`${istDate(1)}T00:00:00+05:30`).getTime();
  const visible = (bookings ?? []).filter((b) => !["cancelled"].includes(b.status));
  const today = visible.filter((b) => new Date(b.start_at).getTime() < todayEnd);
  const upcoming = visible.filter((b) => new Date(b.start_at).getTime() >= todayEnd);
  const list = tab === "today" ? today : upcoming;

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

  return (
    <Shell
      right={
        <button onClick={toggle} className="min-h-11 cursor-pointer px-2 text-sm text-ivory/70">
          {t.nav.language}
        </button>
      }
    >
      <p className="eyebrow text-gold-soft">{employee.full_name}</p>
      <h1 className="display mt-2 text-4xl text-ivory">{t.staff.title}</h1>

      <div className="mt-5 flex flex-wrap gap-2">
        {pushSupported() && (
          <button onClick={turnOnPush} disabled={pushOn} className={cn("btn h-10 text-sm", pushOn ? "bg-emerald-500/15 text-emerald-300" : "btn-gold")}>
            {pushOn ? <BellRing className="size-4" /> : <Bell className="size-4" />}
            {pushOn ? t.staff.notifyOn : t.staff.notify}
          </button>
        )}
        {install && (
          <button onClick={() => install.prompt().then(() => setInstall(null))} className="btn btn-ghost h-10 text-sm text-ivory">
            <Download className="size-4" /> {t.staff.install}
          </button>
        )}
      </div>
      {pushErr && <p className="mt-2 text-sm text-magenta">{pushErr}</p>}

      <div role="tablist" className="mt-6 grid grid-cols-2 rounded-full bg-ivory/5 p-1">
        {(["today", "upcoming"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("min-h-11 cursor-pointer rounded-full text-sm font-semibold transition-colors", tab === k ? "bg-ivory text-ink" : "text-ivory/70")}>
            {t.staff[k]} ({(k === "today" ? today : upcoming).length})
          </button>
        ))}
      </div>

      <ul className="mt-5 space-y-3 pb-10">
        {!bookings && <li className="text-ivory/60">{t.common.loading}</li>}
        {bookings && list.length === 0 && <li className="rounded-2xl bg-ivory/5 p-6 text-center text-ivory/60">{t.staff.none}</li>}
        <AnimatePresence initial={false}>
          {list.map((b) => (
            <motion.li key={b.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <StaffCard b={b} focus={params.get("focus") === b.id} onChange={reload} locale={locale} showDate={tab === "upcoming"} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Shell>
  );
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-night text-ivory">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-ivory/10 bg-night/90 px-4 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center gap-2">
          <Image src="/icons/icon-192.png" alt="" width={30} height={30} className="rounded-full" />
          <span className="font-display text-lg">Purple Spa · Staff</span>
        </div>
        {right}
      </header>
      <main className="mx-auto max-w-lg px-4 pt-6" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {children}
      </main>
    </div>
  );
}

function StaffCard({ b, focus, onChange, locale, showDate }: { b: Booking; focus: boolean; onChange: () => void; locale: "en" | "hi"; showDate: boolean }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [collect, setCollect] = useState(false);
  const due = Number(b.total_amount) - Number(b.amount_paid);
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState<"cash" | "upi" | "card">("cash");

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

  return (
    <article className={cn("rounded-2xl border bg-ivory p-4 text-ink", focus ? "border-gold ring-2 ring-gold/40" : "border-transparent")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-display text-2xl">
            <Clock className="size-4 text-violet" aria-hidden />
            {showDate && `${fmtDate(b.start_at, locale)} · `}
            {fmtTime(b.start_at, locale)}
          </p>
          <p className="text-sm text-muted">→ {fmtTime(b.end_at, locale)} · {b.resource === "bed" ? "Spa" : "Salon"}</p>
        </div>
        <StatusBadge status={b.status} />
      </div>
      <p className="mt-3 font-semibold">{b.customer_name}</p>
      <ul className="mt-1 text-sm text-ink/80">
        {(b.booking_items ?? []).map((i) => (
          <li key={i.id}>{pick(i, "name", locale)} · {minutesLabel(i.duration_min, locale)}</li>
        ))}
      </ul>
      {b.notes && (
        <p className="mt-2 flex gap-1.5 rounded-lg bg-sand px-3 py-2 text-sm"><StickyNote className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />{b.notes}</p>
      )}
      <p className="mt-2 text-sm">
        {inr(b.total_amount, locale)} · {t.account.paid} {inr(b.amount_paid, locale)}
        {due > 0 && <span className="font-semibold text-magenta"> · {t.staff.balance} {inr(due, locale)}</span>}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={telHref(b.customer_phone)} className="btn btn-ghost h-11 text-sm" aria-label={`${t.staff.call} ${prettyPhone(b.customer_phone)}`}>
          <Phone className="size-4" /> {t.staff.call}
        </a>
        {(b.status === "assigned" || b.status === "confirmed") && (
          <button onClick={() => act("start", `/api/bookings/${b.id}/status`, { status: "in_progress" })} disabled={!!busy} className="btn btn-ink h-11 text-sm">
            {busy === "start" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {t.staff.start}
          </button>
        )}
        {b.status === "in_progress" && (
          <button onClick={() => act("done", `/api/bookings/${b.id}/status`, { status: "completed" })} disabled={!!busy} className="btn btn-ink h-11 text-sm">
            {busy === "done" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {t.staff.complete}
          </button>
        )}
        {due > 0 && !["cancelled", "no_show"].includes(b.status) && (
          <button onClick={() => setCollect((v) => !v)} className="btn btn-gold h-11 text-sm">
            <Wallet className="size-4" /> {t.staff.collect}
          </button>
        )}
        {(b.status === "assigned" || b.status === "confirmed") && new Date(b.start_at) < new Date() && (
          <button onClick={() => act("noshow", `/api/bookings/${b.id}/status`, { status: "no_show" })} disabled={!!busy} className="btn btn-ghost h-11 text-sm text-magenta">
            <UserX className="size-4" /> {t.staff.noShow}
          </button>
        )}
      </div>

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
