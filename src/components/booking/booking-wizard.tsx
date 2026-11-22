"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Clock, Loader2, Minus, Phone } from "lucide-react";
import { pick, useLocale } from "@/lib/i18n/locale-provider";
import { useSession } from "@/hooks/use-session";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api, payWithRazorpay, verifyPayment } from "@/lib/checkout";
import { fmtDate, fmtTime, inr, istDate, minutesLabel, prettyPhone, telHref } from "@/lib/format";
import type { Booking, Catalog, GenderPref, PaymentMode, Service, Variant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GoogleButton } from "@/components/auth/google-button";

type Pick = { service: Service; variant: Variant };
const DRAFT_KEY = "purple-booking-draft";

export function BookingWizard({ catalog }: { catalog: Catalog }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { user, profile, loading: sessionLoading } = useSession();
  const s = catalog.settings;

  const allServices = useMemo(() => catalog.categories.flatMap((c) => c.services), [catalog]);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<"spa" | "salon">("spa");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [date, setDate] = useState(istDate(0));
  const [gender, setGender] = useState<GenderPref>("any");
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<PaymentMode>(s.payment_modes[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore a draft (after returning from Google sign-in) or preselect ?service=slug
  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw) as { v: string[]; date: string; gender: GenderPref; slot: string | null; step: number; notes: string };
        const restored = d.v
          .map((vid) => {
            const service = allServices.find((x) => x.service_variants.some((v) => v.id === vid));
            const variant = service?.service_variants.find((v) => v.id === vid);
            return service && variant ? { service, variant } : null;
          })
          .filter(Boolean) as Pick[];
        if (restored.length) {
          /* eslint-disable react-hooks/set-state-in-effect -- one-time restore of a saved draft */
          setPicks(restored);
          setDate(d.date);
          setGender(d.gender);
          setSlot(d.slot);
          setNotes(d.notes);
          setStep(d.step);
          /* eslint-enable react-hooks/set-state-in-effect */
        }
      } catch {}
      sessionStorage.removeItem(DRAFT_KEY);
      return;
    }
    const slug = params.get("service");
    const svc = slug ? allServices.find((x) => x.slug === slug) : null;
    if (svc) {
      setPicks([{ service: svc, variant: svc.service_variants[0] }]);
      const cat = catalog.categories.find((c) => c.id === svc.category_id);
      if (cat) setKind(cat.kind);
    }
  }, [allServices, catalog.categories, params]);

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill from the signed-in profile
      setName((n) => n || profile.full_name || "");
      setPhone((p) => p || profile.phone || "");
    }
  }, [profile]);

  const total = picks.reduce((n, p) => n + Number(p.variant.price), 0);
  const duration = picks.reduce((n, p) => n + p.variant.duration_min, 0);
  const advance = mode === "full" ? total : mode === "partial" ? Math.ceil((total * s.advance_percent) / 100) : 0;

  const toggle = (service: Service, variant: Variant) => {
    setSlot(null);
    setPicks((cur) => {
      const existing = cur.find((p) => p.service.id === service.id);
      if (existing && existing.variant.id === variant.id) return cur.filter((p) => p.service.id !== service.id);
      if (existing) return cur.map((p) => (p.service.id === service.id ? { service, variant } : p));
      if (cur.length >= 5) {
        setError(t.book.maxServices);
        return cur;
      }
      setError(null);
      return [...cur, { service, variant }];
    });
  };

  const saveDraftAndSignIn = () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ v: picks.map((p) => p.variant.id), date, gender, slot, step: 2, notes }));
  };

  const submit = async () => {
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ booking: Booking; order?: { id: string; amount: number; currency: string } }>("/api/bookings", {
        variantIds: picks.map((p) => p.variant.id),
        start: slot,
        gender,
        paymentMode: mode,
        name,
        phone: phone.replace(/[\s-]/g, ""),
        notes: notes || undefined,
      });
      if (res.order) {
        const result = await payWithRazorpay(res.order, { name, contact: phone, email: user?.email }, picks.map((p) => p.service.name_en).join(", "));
        if (!result) {
          router.push(`/account/bookings/${res.booking.id}?payment=cancelled`);
          return;
        }
        await verifyPayment(result);
      }
      router.push(`/account/bookings/${res.booking.id}?new=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.book.errorGeneric);
      setBusy(false);
    }
  };

  if (catalog.fallback) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <p className="text-lg text-ink">{t.book.unavailable}</p>
        <a href={telHref(s.phone)} className="btn btn-ink mt-6">
          <Phone className="size-4" /> {prettyPhone(s.phone)}
        </a>
      </div>
    );
  }

  const canNext = [picks.length > 0, Boolean(slot), Boolean(user) && name.trim().length >= 2 && /^\+?[0-9]{10,13}$/.test(phone.replace(/[\s-]/g, "")), true][step];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <ol className="mb-8 flex gap-2" aria-label="Booking steps">
          {t.book.steps.map((label, i) => (
            <li key={label} className="flex-1">
              <div className={cn("h-1 rounded-full transition-colors", i <= step ? "bg-violet" : "bg-line")} />
              <span className={cn("mt-2 block text-xs font-semibold", i === step ? "text-ink" : "text-muted")} aria-current={i === step ? "step" : undefined}>
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            {step === 0 && <StepServices catalog={catalog} kind={kind} setKind={setKind} picks={picks} toggle={toggle} />}
            {step === 1 && (
              <StepTime catalog={catalog} picks={picks} date={date} setDate={(d) => { setDate(d); setSlot(null); }} gender={gender} setGender={(g) => { setGender(g); setSlot(null); }} slot={slot} setSlot={setSlot} />
            )}
            {step === 2 && (
              <div className="space-y-5">
                {!sessionLoading && !user ? (
                  <div className="card p-6">
                    <p className="text-ink">{t.auth.body}</p>
                    <div className="mt-5" onClickCapture={saveDraftAndSignIn}>
                      <GoogleButton next="/book" label={t.book.signInToBook} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="b-name" className="label">{t.book.name}</label>
                      <input id="b-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                    </div>
                    <div>
                      <label htmlFor="b-phone" className="label">{t.book.phone}</label>
                      <input id="b-phone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="98765 43210" aria-describedby="b-phone-help" required />
                      <p id="b-phone-help" className="mt-1.5 text-sm text-muted">{t.book.phoneHelp}</p>
                    </div>
                    <div>
                      <label htmlFor="b-notes" className="label">{t.book.notes}</label>
                      <textarea id="b-notes" className="field min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} aria-describedby="b-notes-help" />
                      <p id="b-notes-help" className="mt-1.5 text-sm text-muted">{t.book.notesHelp}</p>
                    </div>
                  </>
                )}
              </div>
            )}
            {step === 3 && (
              <fieldset>
                <legend className="font-display text-3xl text-ink">{t.book.payTitle}</legend>
                <div className="mt-5 space-y-3">
                  {s.payment_modes.map((m) => {
                    const amt = m === "full" ? total : m === "partial" ? Math.ceil((total * s.advance_percent) / 100) : 0;
                    return (
                      <label key={m} className={cn("card flex cursor-pointer items-center gap-4 p-5 transition-colors", mode === m ? "border-violet ring-2 ring-violet/20" : "hover:border-violet/40")}>
                        <input type="radio" name="pay" value={m} checked={mode === m} onChange={() => setMode(m)} className="size-5 accent-[var(--violet)]" />
                        <span className="flex-1">
                          <span className="block font-semibold text-ink">
                            {t.book.pay[m]}
                            {m === "partial" && ` (${s.advance_percent}%)`}
                          </span>
                          <span className="text-sm text-muted">{t.book.payHint[m]}</span>
                        </span>
                        {m !== "pay_at_spa" && <span className="font-display text-2xl text-ink">{inr(amt, locale)}</span>}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-5 text-sm text-muted">
                  {t.book.cancellation(s.cancellation_hours)} {mode !== "pay_at_spa" && t.book.holdNote(s.payment_hold_min)}
                </p>
              </fieldset>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <p role="alert" className="mt-6 rounded-xl border border-magenta/30 bg-magenta/5 px-4 py-3 text-sm text-magenta">
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setStep((x) => Math.max(0, x - 1))} className={cn("btn btn-ghost text-ink", step === 0 && "invisible")}>
            <ArrowLeft className="size-4" /> {t.book.back}
          </button>
          {step < 3 ? (
            <button type="button" disabled={!canNext} onClick={() => { setError(null); setStep((x) => x + 1); }} className="btn btn-ink">
              {t.book.next} <ArrowRight className="size-4" />
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={submit} className="btn btn-gold">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "pay_at_spa" ? t.book.confirm : `${t.book.payNow} ${inr(advance, locale)}`}
            </button>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-6">
          <h2 className="font-display text-2xl text-ink">
            {picks.length} {t.book.selected}
          </h2>
          <ul className="mt-4 space-y-3">
            {picks.map((p) => (
              <li key={p.service.id} className="flex items-start gap-3 text-sm">
                <span className="flex-1">
                  <span className="block font-semibold text-ink">{pick(p.service, "name", locale)}</span>
                  <span className="text-muted">{minutesLabel(p.variant.duration_min, locale)}</span>
                </span>
                <span className="font-semibold tabular-nums text-ink">{inr(p.variant.price, locale)}</span>
                {step === 0 && (
                  <button type="button" onClick={() => toggle(p.service, p.variant)} className="grid size-7 cursor-pointer place-items-center rounded-full border border-line text-muted hover:text-ink" aria-label={`Remove ${p.service.name_en}`}>
                    <Minus className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {slot && (
            <p className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-sm text-ink">
              <Clock className="size-4 text-violet" /> {fmtDate(slot, locale)} · {fmtTime(slot, locale)}
            </p>
          )}
          <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-muted">
              <dt>{t.book.duration}</dt>
              <dd>{minutesLabel(duration, locale)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold text-ink">
              <dt>{t.book.total}</dt>
              <dd className="tabular-nums">{inr(total, locale)}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          <a href={telHref(s.phone)} className="underline-offset-4 hover:underline">{prettyPhone(s.phone)}</a> ·{" "}
          <Link href="/" className="underline-offset-4 hover:underline">The Purple Spa</Link>
        </p>
      </aside>
    </div>
  );
}

function StepServices({ catalog, kind, setKind, picks, toggle }: { catalog: Catalog; kind: "spa" | "salon"; setKind: (k: "spa" | "salon") => void; picks: Pick[]; toggle: (s: Service, v: Variant) => void }) {
  const { t, locale } = useLocale();
  const cats = catalog.categories.filter((c) => c.kind === kind);
  return (
    <div>
      <div role="tablist" className="inline-flex rounded-full border border-line bg-white p-1">
        {(["spa", "salon"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("min-h-10 cursor-pointer rounded-full px-5 text-sm font-semibold transition-colors", kind === k ? "bg-ink text-ivory" : "text-muted hover:text-ink")}>
            {t.book[k]}
          </button>
        ))}
      </div>
      <div className="mt-8 space-y-10">
        {cats.map((c) => (
          <section key={c.id}>
            <h3 className="font-display text-3xl italic text-violet">{pick(c, "name", locale)}</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {c.services.map((s) => {
                const chosen = picks.find((p) => p.service.id === s.id);
                return (
                  <li key={s.id} className={cn("card p-4 transition-colors", chosen && "border-violet ring-2 ring-violet/15")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink">{pick(s, "name", locale)}</p>
                        {pick(s, "tag", locale) && <p className="text-xs text-muted">{pick(s, "tag", locale)}</p>}
                      </div>
                      {chosen && <Check className="size-5 shrink-0 text-violet" aria-label="Selected" />}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.service_variants.map((v) => {
                        const on = chosen?.variant.id === v.id;
                        return (
                          <button key={v.id} type="button" onClick={() => toggle(s, v)} aria-pressed={on} className={cn("min-h-10 cursor-pointer rounded-full border px-3.5 text-sm transition-colors", on ? "border-violet bg-violet text-white" : "border-line text-ink hover:border-violet/50")}>
                            {minutesLabel(v.duration_min, locale)} · {inr(v.price, locale)}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function StepTime({ catalog, picks, date, setDate, gender, setGender, slot, setSlot }: { catalog: Catalog; picks: Pick[]; date: string; setDate: (d: string) => void; gender: GenderPref; setGender: (g: GenderPref) => void; slot: string | null; setSlot: (s: string) => void }) {
  const { t, locale } = useLocale();
  const s = catalog.settings;
  const [slots, setSlots] = useState<string[] | null>(null);
  const [err, setErr] = useState(false);
  const days = useMemo(() => Array.from({ length: Math.min(s.booking_window_days, 21) }, (_, i) => istDate(i)), [s.booking_window_days]);
  const variantKey = picks.map((p) => p.variant.id).join(",");

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show loading while fetching
    setSlots(null);
    setErr(false);
    supabaseBrowser()
      .rpc("get_available_slots", { p_date: date, p_variant_ids: variantKey.split(","), p_gender: gender })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setErr(true);
        setSlots(((data as { slot_start: string }[] | null) ?? []).map((r) => r.slot_start));
      });
    return () => {
      alive = false;
    };
  }, [date, gender, variantKey]);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="label">{t.book.pickDate}</h3>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" data-lenis-prevent>
          {days.map((d) => {
            const dt = new Date(`${d}T12:00:00+05:30`);
            const on = d === date;
            return (
              <button key={d} type="button" onClick={() => setDate(d)} aria-pressed={on} className={cn("flex min-w-16 cursor-pointer flex-col items-center rounded-2xl border px-3 py-2.5 transition-colors", on ? "border-ink bg-ink text-ivory" : "border-line bg-white text-ink hover:border-ink/40")}>
                <span className="text-xs uppercase opacity-70">{fmtDate(dt, locale, { day: undefined, month: undefined })}</span>
                <span className="font-display text-2xl leading-tight">{fmtDate(dt, locale, { weekday: undefined, month: undefined })}</span>
                <span className="text-xs opacity-70">{fmtDate(dt, locale, { weekday: undefined, day: undefined })}</span>
              </button>
            );
          })}
        </div>
      </div>

      {s.allow_gender_preference && (
        <fieldset>
          <legend className="label">{t.book.therapist}</legend>
          <div className="flex flex-wrap gap-2">
            {(["any", "female", "male"] as const).map((g) => (
              <button key={g} type="button" onClick={() => setGender(g)} aria-pressed={gender === g} className={cn("min-h-11 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors", gender === g ? "border-violet bg-violet text-white" : "border-line bg-white text-ink hover:border-violet/50")}>
                {t.book.pref[g]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <h3 className="label">{t.book.pickTime}</h3>
        {slots === null ? (
          <p className="flex items-center gap-2 py-6 text-muted">
            <Loader2 className="size-4 animate-spin" /> {t.book.loadingSlots}
          </p>
        ) : slots.length === 0 ? (
          <p className="rounded-xl border border-line bg-white px-4 py-5 text-muted">{err ? t.book.errorGeneric : t.book.noSlots}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {slots.map((x) => (
              <button key={x} type="button" onClick={() => setSlot(x)} aria-pressed={slot === x} className={cn("min-h-11 cursor-pointer rounded-xl border text-sm font-semibold tabular-nums transition-colors", slot === x ? "border-violet bg-violet text-white" : "border-line bg-white text-ink hover:border-violet/50")}>
                {fmtTime(x, locale)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
