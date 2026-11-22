"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, Bath, CircleParking, CloudFog, MapPin, MessageCircle, Phone, ShowerHead, Snowflake, Star, Users } from "lucide-react";
import { Marquee } from "@/components/ui/marquee";
import { NumberTicker } from "@/components/ui/number-ticker";
import { EASE, Magnetic, MaskLines, Reveal, Spotlight } from "@/components/site/motion";
import { useOpenStatus } from "@/components/site/open-status";
import { useLocale } from "@/lib/i18n/locale-provider";
import { fmtClock, mapsHref, prettyPhone, telHref, waHref } from "@/lib/format";
import type { Catalog } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ───────────── Facilities ───────────── */

const ICONS = [Bath, CloudFog, ShowerHead, Snowflake, CircleParking, Users];

export function Facilities() {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.18, 1]);

  return (
    <section id="facilities" className="grain-dark relative scroll-mt-16 overflow-hidden bg-night text-ivory">
      <div className="relative z-[2] mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-36">
        <Reveal><p className="eyebrow text-gold-soft">{t.facilities.eyebrow}</p></Reveal>
        <h2 className="display mt-4 max-w-3xl text-[clamp(2.6rem,6vw,5.5rem)]"><MaskLines lines={[t.facilities.title]} /></h2>

        <div className="mt-14 grid auto-rows-[minmax(11rem,auto)] gap-3 md:grid-cols-4 md:gap-4">
          <div ref={ref} className="relative min-h-72 overflow-hidden rounded-[1.75rem] md:col-span-2 md:row-span-2">
            <motion.div style={reduce ? undefined : { scale }} className="absolute inset-0">
              <Image src="/images/lounge-long.webp" alt="The lounge with sofas, plants and a mural" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-night/70 to-transparent" />
          </div>
          {t.facilities.items.map((f, i) => {
            const Icon = ICONS[i] ?? Star;
            return (
              <Reveal key={f.k} delay={(i % 2) * 0.08} className="h-full">
                <Spotlight className="h-full rounded-[1.75rem] border border-ivory/10 bg-ivory/[0.04]" color="rgba(177,74,237,0.22)">
                  <div className="flex h-full flex-col justify-between gap-6 p-6">
                    <span className="grid size-12 place-items-center rounded-2xl bg-gold/15 text-gold"><Icon className="size-5" aria-hidden /></span>
                    <div>
                      <h3 className="font-display text-2xl md:text-[1.7rem]">{f.k}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ivory/65">{f.v}</p>
                    </div>
                  </div>
                </Spotlight>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Gallery ───────────── */

const ROW_A = ["reception-wide", "corridor-violet", "lounge-mural", "room-stripes", "entry-blossom"];
const ROW_B = ["art-wall", "room-magenta", "reception-blossom", "lounge-horses", "corridor-jaali"];

export function Gallery() {
  const tile = (src: string) => (
    <figure key={src} className="relative h-56 w-72 shrink-0 overflow-hidden rounded-2xl md:h-72 md:w-[26rem]">
      <Image src={`/images/${src}-sm.webp`} alt="" fill sizes="420px" className="object-cover transition-transform duration-700 hover:scale-105" />
    </figure>
  );
  return (
    <section aria-label="Photos of the spa" className="space-y-4 overflow-hidden bg-night pb-24 md:pb-32">
      <Marquee pauseOnHover className="[--duration:80s] [--gap:1rem]">{ROW_A.map(tile)}</Marquee>
      <Marquee pauseOnHover reverse className="[--duration:90s] [--gap:1rem]">{ROW_B.map(tile)}</Marquee>
    </section>
  );
}

/* ───────────── Reviews ───────────── */

// From the public listing on Wanderlog: 77 five-star and 6 one-star reviews.
const BREAKDOWN: [number, number][] = [[5, 77], [4, 0], [3, 0], [2, 0], [1, 6]];

export function Reviews() {
  const { t } = useLocale();
  const total = BREAKDOWN.reduce((n, [, c]) => n + c, 0);
  return (
    <section id="reviews" className="grain relative scroll-mt-16 overflow-hidden bg-ivory">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 md:grid-cols-12 md:px-8 md:py-36">
        <div className="md:col-span-5">
          <Reveal><p className="eyebrow text-violet">{t.reviews.eyebrow}</p></Reveal>
          <div className="mt-4 flex items-end gap-5">
            <span className="font-display text-[clamp(7rem,16vw,12rem)] leading-[0.85] text-ink"><span className="sr-only">4.7</span><NumberTicker value={4.7} startValue={3} decimalPlaces={1} className="tracking-tight text-ink" aria-hidden /></span>
            <div className="mb-4">
              <div className="flex gap-1 text-gold" aria-label="4.7 out of 5 stars">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.span key={i} initial={{ opacity: 0, scale: 0.4, rotate: -30 }} whileInView={{ opacity: 1, scale: 1, rotate: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE, delay: 0.3 + i * 0.08 }}>
                    <Star className="size-6" fill="currentColor" strokeWidth={0} aria-hidden />
                  </motion.span>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted">{t.hero.rating}</p>
            </div>
          </div>
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.reviews.breakdown}</p>
            <ul className="mt-3 space-y-2">
              {BREAKDOWN.map(([stars, count], i) => (
                <li key={stars} className="flex items-center gap-3 text-sm">
                  <span className="flex w-8 items-center gap-0.5 tabular-nums text-muted">{stars}<Star className="size-3 text-gold" fill="currentColor" strokeWidth={0} aria-hidden /></span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <motion.span className="block h-full rounded-full bg-violet" initial={{ width: 0 }} whileInView={{ width: `${(count / total) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE, delay: 0.2 + i * 0.08 }} />
                  </span>
                  <span className="w-8 text-right tabular-nums text-ink">{count}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">{t.reviews.source}</p>
          </div>
        </div>
        <div className="md:col-span-7 md:pt-8">
          <Reveal><p className="text-lg text-muted">{t.reviews.body}</p></Reveal>
          <ul className="mt-6 border-t border-line">
            {t.reviews.themes.map((th, i) => (
              <Reveal as="li" key={th} delay={i * 0.07} className="group flex items-center gap-6 border-b border-line py-6">
                <span className="font-display text-xl italic text-violet">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display text-3xl text-ink transition-transform duration-500 group-hover:translate-x-2 md:text-[2.6rem]">{th}</span>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={0.2}>
            <a href={mapsHref("The Purple Skin Friendly Salon and Spa Bhopal")} target="_blank" rel="noreferrer" className="btn btn-ghost mt-10 text-ink">
              {t.reviews.cta} <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Visit ───────────── */

export function Visit({ catalog }: { catalog: Catalog }) {
  const { locale, t } = useLocale();
  const s = catalog.settings;
  const status = useOpenStatus(s, locale);
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(s.maps_query)}&z=17&output=embed`;
  return (
    <section id="visit" className="scroll-mt-16 bg-sand">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-2 md:px-8 md:py-32">
        <div>
          <Reveal><p className="eyebrow text-violet">{t.visit.eyebrow}</p></Reveal>
          <h2 className="display mt-4 text-[clamp(3rem,7vw,6rem)] text-ink"><MaskLines lines={[t.visit.title]} /></h2>
          <Reveal delay={0.1}>
            <address className="mt-8 flex gap-3 text-lg not-italic leading-relaxed text-ink">
              <MapPin className="mt-1.5 size-5 shrink-0 text-violet" aria-hidden />
              {s.address}
            </address>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 border-t border-ink/15 pt-6">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className={cn("size-2 rounded-full", status?.open ? "bg-emerald-500" : "bg-muted/50")} />
                <span className={status?.open ? "text-emerald-700" : "text-muted"}>{status ? (status.open ? t.visit.openNow : t.visit.closed) : t.visit.hours}</span>
                {status && <span className="font-normal text-muted">· {status.open ? t.visit.closesAt : t.visit.opensAt} {status.next}</span>}
              </p>
              <p className="mt-2 font-display text-3xl text-ink">
                {t.visit.everyday}, {fmtClock(s.open_time, locale)} – {fmtClock(s.close_time, locale)}
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href={telHref(s.phone)} className="btn btn-ink"><Phone className="size-4" aria-hidden /> {prettyPhone(s.phone)}</a>
              <a href={waHref(s.whatsapp, "Hi, I'd like to book a session.")} target="_blank" rel="noreferrer" className="btn btn-ghost text-ink"><MessageCircle className="size-4" aria-hidden /> {t.visit.whatsapp}</a>
              <a href={mapsHref(s.maps_query)} target="_blank" rel="noreferrer" className="btn btn-ghost text-ink">{t.visit.directions} <ArrowUpRight className="size-4" aria-hidden /></a>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.1} className="relative min-h-[380px] overflow-hidden rounded-[2rem] border border-line bg-ivory">
          <iframe title="Map to the spa" src={mapSrc} className="absolute inset-0 h-full w-full grayscale-[30%]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────── Closing call to action ───────────── */

export function FinalCta() {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.25, 1]);
  return (
    <section ref={ref} className="relative isolate overflow-hidden bg-night text-ivory">
      <motion.div style={reduce ? undefined : { scale }} className="absolute inset-0 -z-10">
        <Image src="/images/room-chevron-2.webp" alt="" fill sizes="100vw" className="object-cover opacity-45" />
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-night via-night/40 to-night" />
      <div className="mx-auto flex max-w-5xl flex-col items-center px-5 py-32 text-center md:py-48">
        <Reveal><p className="eyebrow text-gold-soft">The Purple Skin Friendly Salon and Spa</p></Reveal>
        <h2 className="display mt-6 text-[clamp(3.2rem,10vw,8.5rem)]"><MaskLines lines={[t.tour.finalTitle]} /></h2>
        <Reveal delay={0.15}>
          <Magnetic className="mt-12">
            <Link href="/book" className="btn btn-gold h-14 px-8 text-lg">
              {t.tour.finalCta} <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Magnetic>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────── Footer ───────────── */

export function SiteFooter({ catalog }: { catalog: Catalog }) {
  const { t } = useLocale();
  const s = catalog.settings;
  return (
    <footer className="border-t border-ivory/10 bg-night text-ivory/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-12 md:px-8">
        <div className="flex items-center gap-4 md:col-span-5">
          <Image src="/icons/icon-192.png" alt="" width={56} height={56} className="rounded-full" />
          <div>
            <p className="font-display text-2xl text-ivory">{s.business_name}</p>
            <p className="text-sm">Maharana Pratap Nagar, Bhopal</p>
          </div>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:col-span-4">
          <Link href="/#menu" className="hover:text-ivory">{t.nav.menu}</Link>
          <Link href="/#salon" className="hover:text-ivory">{t.nav.salon}</Link>
          <Link href="/book" className="hover:text-ivory">{t.nav.book}</Link>
          <Link href="/account" className="hover:text-ivory">{t.nav.account}</Link>
          <Link href="/#visit" className="hover:text-ivory">{t.nav.visit}</Link>
          <Link href="/staff" className="hover:text-ivory">{t.footer.staff}</Link>
          {s.instagram_url && <a href={s.instagram_url} target="_blank" rel="noreferrer" className="hover:text-ivory">Instagram</a>}
        </nav>
        <div className="space-y-1 text-sm md:col-span-3">
          <a href={telHref(s.phone)} className="block hover:text-ivory">{prettyPhone(s.phone)}</a>
          <a href={`mailto:${s.email}`} className="block hover:text-ivory">{s.email}</a>
        </div>
      </div>
      <div className="border-t border-ivory/10">
        <p className="mx-auto max-w-7xl px-5 py-6 text-xs md:px-8">© {s.business_name}. {t.footer.rights}</p>
      </div>
    </footer>
  );
}
