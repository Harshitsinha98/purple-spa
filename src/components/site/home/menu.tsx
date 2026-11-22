"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { EASE, MaskLines, Reveal, Spotlight } from "@/components/site/motion";
import { pick, useLocale } from "@/lib/i18n/locale-provider";
import { inr, minutesLabel } from "@/lib/format";
import type { Catalog, Service } from "@/lib/types";
import { cn } from "@/lib/utils";

const CAT_IMAGE: Record<string, string> = { massage: "room-chevron", "spa-rituals": "room-stripes" };

function pressure(tag: string | null) {
  const t = (tag ?? "").toLowerCase();
  if (t.includes("light")) return 1;
  if (t.includes("medium")) return 2;
  if (t.includes("hard") || t.includes("deep")) return 3;
  return 0;
}

function Row({ s, i }: { s: Service; i: number }) {
  const { locale, t } = useLocale();
  const level = pressure(s.tag_en);
  const tag = pick(s, "tag", locale);
  return (
    <motion.li initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5, ease: EASE, delay: i * 0.04 }}>
      <Link href={`/book?service=${s.slug}`} className="group -mx-4 block rounded-2xl px-4 py-5 transition-colors duration-300 hover:bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="font-display text-[1.75rem] leading-tight text-ink transition-colors group-hover:text-violet md:text-3xl">{pick(s, "name", locale)}</h4>
            {tag && (
              <p className="mt-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {level > 0 && (
                  <span className="flex gap-1" aria-hidden>
                    {[1, 2, 3].map((d) => <span key={d} className={cn("size-1.5 rounded-full", d <= level ? "bg-violet" : "bg-line")} />)}
                  </span>
                )}
                {tag}
              </p>
            )}
          </div>
          <span className="mt-2 flex -translate-x-2 items-center gap-1 text-sm font-semibold text-violet opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            {t.menu.book} <ArrowRight className="size-4" aria-hidden />
          </span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {s.service_variants.map((v) => (
            <li key={v.id} className="flex items-baseline text-[0.97rem] text-ink/75">
              <span>{minutesLabel(v.duration_min, locale)}</span>
              <span className="leader" aria-hidden />
              <span className="font-semibold tabular-nums text-ink">{inr(v.price, locale)}</span>
            </li>
          ))}
        </ul>
      </Link>
    </motion.li>
  );
}

export function SpaMenu({ catalog }: { catalog: Catalog }) {
  const { t, locale } = useLocale();
  const cats = catalog.categories.filter((c) => c.kind === "spa" && c.slug !== "combos");
  const [tab, setTab] = useState(cats[0]?.id);
  const current = cats.find((c) => c.id === tab) ?? cats[0];
  if (!current) return null;
  const img = CAT_IMAGE[current.slug] ?? "room-chevron-2";

  return (
    <section id="menu" className="relative scroll-mt-16 bg-ivory">
      <div className="mx-auto max-w-7xl px-5 pb-24 md:px-8 md:pb-36">
        <div className="flex flex-wrap items-end justify-between gap-6 border-t border-line pt-16 md:pt-24">
          <div>
            <Reveal><p className="eyebrow text-violet">{t.menu.eyebrow}</p></Reveal>
            <h2 className="display mt-4 text-[clamp(3.4rem,9vw,7.5rem)] text-ink"><MaskLines lines={[t.menu.title]} /></h2>
          </div>
          <div role="tablist" aria-label={t.menu.title} className="relative inline-flex rounded-full border border-line bg-white p-1">
            {cats.map((c) => (
              <button key={c.id} role="tab" aria-selected={c.id === current.id} onClick={() => setTab(c.id)} className={cn("relative min-h-11 cursor-pointer rounded-full px-5 text-sm font-semibold transition-colors", c.id === current.id ? "text-ivory" : "text-muted hover:text-ink")}>
                {c.id === current.id && <motion.span layoutId="menu-tab" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                <span className="relative">{pick(c, "name", locale)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <div className="md:sticky md:top-28">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-plum">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div key={img} className="absolute inset-0" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: EASE }}>
                    <Image src={`/images/${img}.webp`} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
                  </motion.div>
                </AnimatePresence>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/80 to-transparent p-6 text-ivory">
                  <p className="font-display text-3xl italic">{pick(current, "name", locale)}</p>
                  {pick(current, "description", locale) && <p className="mt-1 text-sm text-ivory/75">{pick(current, "description", locale)}</p>}
                </div>
              </div>
              <p className="mt-5 max-w-sm text-sm text-muted">{t.menu.note}</p>
            </div>
          </div>
          <div className="md:col-span-7">
            <AnimatePresence mode="wait">
              <motion.ul key={current.id} className="divide-y divide-line" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {current.services.map((s, i) => <Row key={s.id} s={s} i={i} />)}
              </motion.ul>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Combos({ catalog }: { catalog: Catalog }) {
  const { locale } = useLocale();
  const combos = catalog.categories.find((c) => c.slug === "combos");
  if (!combos) return null;
  return (
    <section className="grain-dark relative overflow-hidden bg-plum text-ivory">
      <div aria-hidden className="aurora pointer-events-none absolute -right-[20%] -top-[30%] size-[60vmax] rounded-full bg-[radial-gradient(circle,rgba(214,48,127,0.28),transparent_60%)] blur-3xl" />
      <div className="relative z-[2] mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <div className="grid gap-6 md:grid-cols-2 md:items-end">
          <h2 className="display text-[clamp(3rem,7vw,6rem)]"><MaskLines lines={[pick(combos, "name", locale)]} /></h2>
          <Reveal><p className="max-w-sm text-lg text-ivory/70 md:justify-self-end">{pick(combos, "description", locale)}</p></Reveal>
        </div>
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {combos.services.map((s, i) => {
            const v = s.service_variants[0];
            return (
              <Reveal as="li" key={s.id} delay={i * 0.08} className="h-full">
                <Spotlight className="h-full rounded-[1.5rem] border border-ivory/10 bg-ivory/[0.04] transition-[border-color,transform] duration-500 hover:-translate-y-1.5 hover:border-gold/40">
                  <Link href={`/book?service=${s.slug}`} className="flex h-full min-h-60 flex-col justify-between p-6">
                    <div>
                      <p className="eyebrow text-[0.65rem] text-gold-soft">{minutesLabel(v.duration_min, locale)}</p>
                      <h3 className="mt-4 font-display text-[1.7rem] leading-tight">{pick(s, "name", locale)}</h3>
                    </div>
                    <div className="mt-10 flex items-end justify-between">
                      <span className="font-display text-4xl text-gold">{inr(v.price, locale)}</span>
                      <span className="grid size-10 place-items-center rounded-full border border-ivory/20 transition-colors group-hover:border-gold group-hover:bg-gold group-hover:text-night">
                        <ArrowUpRight className="size-4" aria-hidden />
                      </span>
                    </div>
                  </Link>
                </Spotlight>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function Salon({ catalog }: { catalog: Catalog }) {
  const { locale, t } = useLocale();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const clip = useTransform(scrollYProgress, [0, 1], ["inset(14% 10% 14% 10% round 2rem)", "inset(0% 0% 0% 0% round 2rem)"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.2, 1]);
  const salon = catalog.categories.filter((c) => c.kind === "salon");
  if (!salon.length) return null;

  return (
    <section id="salon" className="relative scroll-mt-16 bg-sand">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-36">
        <div className="grid gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <Reveal><p className="eyebrow text-violet">{t.salon.eyebrow}</p></Reveal>
            <h2 className="display mt-4 text-[clamp(3.4rem,9vw,7.5rem)] text-ink"><MaskLines lines={[t.salon.title]} /></h2>
            <Reveal delay={0.1}><p className="mt-5 max-w-sm text-lg text-muted">{t.salon.body}</p></Reveal>
            <div ref={ref} className="relative mt-10 aspect-[4/5] md:aspect-[3/4]">
              <motion.div style={reduce ? undefined : { clipPath: clip }} className="absolute inset-0 overflow-hidden rounded-[2rem]">
                <motion.div style={reduce ? undefined : { scale }} className="absolute inset-0">
                  <Image src="/images/reception-sign.webp" alt="The Purple Spa & Salon sign at the reception" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
                </motion.div>
              </motion.div>
            </div>
          </div>
          <div className="space-y-12 md:col-span-7 md:pt-6">
            {salon.map((c, ci) => (
              <div key={c.id}>
                <Reveal>
                  <div className="flex items-baseline justify-between border-b border-ink/15 pb-3">
                    <h3 className="font-display text-3xl italic text-violet md:text-4xl">{pick(c, "name", locale)}</h3>
                    <span className="font-display text-lg text-muted">0{ci + 1}</span>
                  </div>
                </Reveal>
                <ul className="mt-2">
                  {c.services.map((s, i) => (
                    <Reveal as="li" key={s.id} delay={i * 0.04} y={14}>
                      <Link href={`/book?service=${s.slug}`} className="group -mx-3 flex items-baseline rounded-xl px-3 py-3.5 transition-colors hover:bg-ivory">
                        <span className="text-[1.05rem] text-ink transition-transform duration-300 group-hover:translate-x-1">{pick(s, "name", locale)}</span>
                        <span className="leader text-ink" aria-hidden />
                        <span className="font-semibold tabular-nums text-ink">
                          {s.service_variants.length > 1 && <span className="mr-1 text-xs font-normal text-muted">{t.menu.from}</span>}
                          {inr(s.service_variants[0].price, locale)}
                        </span>
                      </Link>
                    </Reveal>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
