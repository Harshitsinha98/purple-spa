"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, MapPin, MessageCircle, Phone, Star } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { Marquee } from "@/components/ui/marquee";
import { NumberTicker } from "@/components/ui/number-ticker";
import { pick, useLocale } from "@/lib/i18n/locale-provider";
import { fmtClock, inr, mapsHref, minutesLabel, prettyPhone, telHref, waHref } from "@/lib/format";
import type { Catalog, CatalogCategory, Service } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

function SectionHead({ eyebrow, title, light, className }: { eyebrow: string; title: string; light?: boolean; className?: string }) {
  return (
    <div className={className}>
      <BlurFade inView direction="up" offset={12}>
        <p className={cn("eyebrow", light ? "text-gold-soft" : "text-violet")}>{eyebrow}</p>
      </BlurFade>
      <BlurFade inView direction="up" offset={18} delay={0.08}>
        <h2 className={cn("display mt-4 text-5xl md:text-7xl", light ? "text-ivory" : "text-ink")}>{title}</h2>
      </BlurFade>
    </div>
  );
}

/* ───────────── Intro ───────────── */

export function Intro({ catalog }: { catalog: Catalog }) {
  const { t } = useLocale();
  return (
    <section className="grain relative bg-ivory">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 py-24 md:grid-cols-12 md:px-8 md:py-36">
        <div className="md:col-span-7">
          <BlurFade inView direction="up">
            <p className="eyebrow text-violet">{t.intro.eyebrow}</p>
          </BlurFade>
          <BlurFade inView direction="up" delay={0.08}>
            <h2 className="display mt-5 text-[2.6rem] text-ink md:text-7xl">{t.intro.title}</h2>
          </BlurFade>
        </div>
        <div className="md:col-span-5 md:pt-14">
          <BlurFade inView direction="up" delay={0.16}>
            <p className="text-lg leading-relaxed text-muted">{t.intro.body}</p>
          </BlurFade>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:col-span-12 md:grid-cols-4">
          {[
            { v: <NumberTicker value={4.7} decimalPlaces={1} className="text-ink" />, k: t.intro.stats.rating },
            { v: <NumberTicker value={83} className="text-ink" />, k: t.intro.stats.reviews },
            { v: <NumberTicker value={7} className="text-ink" />, k: t.intro.stats.open },
            { v: <NumberTicker value={catalog.categories.filter((c) => c.kind === "spa").reduce((n, c) => n + c.services.length, 0)} className="text-ink" />, k: t.intro.stats.rooms },
          ].map((s) => (
            <div key={s.k} className="bg-ivory px-6 py-8">
              <dt className="sr-only">{s.k}</dt>
              <dd className="font-display text-5xl tracking-normal md:text-6xl">{s.v}</dd>
              <dd className="mt-2 text-sm text-muted">{s.k}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ───────────── Menu ───────────── */

function MenuRow({ service, index }: { service: Service; index: number }) {
  const { locale, t } = useLocale();
  const tag = pick(service, "tag", locale);
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Link href={`/book?service=${service.slug}`} className="group -mx-3 block rounded-xl px-3 py-4 transition-colors hover:bg-sand/70">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-display text-2xl text-ink md:text-[1.7rem]">{pick(service, "name", locale)}</h4>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-violet opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {t.menu.book} <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </div>
        {tag && <p className="eyebrow mt-1 text-[0.65rem] text-muted">{tag}</p>}
        <ul className="mt-2 space-y-1">
          {service.service_variants.map((v) => (
            <li key={v.id} className="flex items-baseline text-[0.95rem] text-ink/80">
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

function CategoryBlock({ cat }: { cat: CatalogCategory }) {
  const { locale } = useLocale();
  const desc = pick(cat, "description", locale);
  return (
    <div>
      <div className="flex items-baseline gap-4 border-b border-ink/15 pb-3">
        <h3 className="font-display text-3xl italic text-violet md:text-4xl">{pick(cat, "name", locale)}</h3>
      </div>
      {desc && <p className="mt-3 text-sm text-muted">{desc}</p>}
      <ul className="mt-2 divide-y divide-line">
        {cat.services.map((s, i) => (
          <MenuRow key={s.id} service={s} index={i} />
        ))}
      </ul>
    </div>
  );
}

export function SpaMenu({ catalog }: { catalog: Catalog }) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.18, 1]);
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  const spa = catalog.categories.filter((c) => c.kind === "spa" && c.slug !== "combos");

  return (
    <section id="menu" className="relative scroll-mt-20 bg-ivory">
      <div ref={ref} className="mx-auto grid max-w-7xl gap-16 px-6 pb-24 md:grid-cols-12 md:px-8 md:pb-36">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-28">
            <SectionHead eyebrow={t.menu.eyebrow} title={t.menu.title} />
            <div className="relative mt-10 aspect-[4/5] overflow-hidden rounded-[28px]">
              <motion.div style={{ scale, y }} className="absolute inset-0">
                <Image src="/images/room-chevron.webp" alt="A therapy room with chevron walls and violet light" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
              </motion.div>
            </div>
            <p className="mt-5 max-w-sm text-sm text-muted">{t.menu.note}</p>
          </div>
        </div>
        <div className="space-y-16 md:col-span-7 md:pt-40">
          {spa.map((c) => (
            <CategoryBlock key={c.id} cat={c} />
          ))}
        </div>
      </div>
      <Combos catalog={catalog} />
    </section>
  );
}

function Combos({ catalog }: { catalog: Catalog }) {
  const { locale, t } = useLocale();
  const combos = catalog.categories.find((c) => c.slug === "combos");
  if (!combos) return null;
  return (
    <div className="border-y border-line bg-sand/60">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-8">
        <div className="flex items-end justify-between gap-6">
          <h3 className="display text-4xl text-ink md:text-6xl">{pick(combos, "name", locale)}</h3>
          <p className="hidden max-w-xs text-sm text-muted md:block">{pick(combos, "description", locale)}</p>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {combos.services.map((s, i) => {
            const v = s.service_variants[0];
            return (
              <motion.li key={s.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease, delay: i * 0.07 }}>
                <Link href={`/book?service=${s.slug}`} className="group flex h-full flex-col justify-between rounded-[22px] border border-line bg-ivory p-6 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-violet/50">
                  <div>
                    <p className="eyebrow text-[0.65rem] text-muted">{minutesLabel(v.duration_min, locale)}</p>
                    <h4 className="mt-3 font-display text-2xl leading-tight text-ink">{pick(s, "name", locale)}</h4>
                  </div>
                  <div className="mt-8 flex items-end justify-between">
                    <span className="font-display text-4xl text-violet">{inr(v.price, locale)}</span>
                    <ArrowUpRight className="size-5 text-ink/40 transition-colors group-hover:text-violet" aria-hidden />
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </ul>
        <p className="sr-only">{t.menu.combos}</p>
      </div>
    </div>
  );
}

/* ───────────── Salon ───────────── */

export function Salon({ catalog }: { catalog: Catalog }) {
  const { locale, t } = useLocale();
  const salon = catalog.categories.filter((c) => c.kind === "salon");
  if (!salon.length) return null;
  return (
    <section id="salon" className="relative scroll-mt-16 overflow-hidden bg-plum text-ivory">
      <div className="absolute inset-0 opacity-25">
        <Image src="/images/reception-sign.webp" alt="" fill sizes="100vw" className="object-cover" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-plum via-plum/95 to-night" />
      <div className="relative mx-auto max-w-7xl px-6 py-24 md:px-8 md:py-36">
        <div className="grid gap-8 md:grid-cols-2 md:items-end">
          <SectionHead eyebrow={t.salon.eyebrow} title={t.salon.title} light />
          <BlurFade inView direction="up" delay={0.1}>
            <p className="max-w-md text-lg text-ivory/75 md:justify-self-end">{t.salon.body}</p>
          </BlurFade>
        </div>
        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {salon.map((c) => (
            <div key={c.id}>
              <h3 className="border-b border-ivory/15 pb-3 font-display text-3xl italic text-gold-soft">{pick(c, "name", locale)}</h3>
              <ul className="mt-2">
                {c.services.map((s) => (
                  <li key={s.id}>
                    <Link href={`/book?service=${s.slug}`} className="-mx-3 flex items-baseline rounded-lg px-3 py-3 transition-colors hover:bg-ivory/5">
                      <span className="text-[1.02rem]">{pick(s, "name", locale)}</span>
                      <span className="leader text-ivory/60" aria-hidden />
                      <span className="font-semibold tabular-nums">
                        {s.service_variants.length > 1 && <span className="mr-1 text-xs font-normal text-ivory/60">{t.menu.from}</span>}
                        {inr(s.service_variants[0].price, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Facilities ───────────── */

export function Facilities() {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const clip = useTransform(scrollYProgress, [0, 1], ["inset(18% 12% 18% 12% round 40px)", "inset(0% 0% 0% 0% round 28px)"]);

  return (
    <section className="bg-night text-ivory">
      <div className="mx-auto max-w-7xl px-6 py-24 md:px-8 md:py-36">
        <SectionHead eyebrow={t.facilities.eyebrow} title={t.facilities.title} light className="max-w-3xl" />
        <div ref={ref} className="relative mt-14 aspect-[16/9] w-full md:aspect-[21/9]">
          <motion.div style={{ clipPath: clip }} className="absolute inset-0 overflow-hidden">
            <Image src="/images/lounge-long.webp" alt="The lounge, with a mural, sofas and plants" fill sizes="100vw" className="object-cover" />
          </motion.div>
        </div>
        <ul className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {t.facilities.items.map((f, i) => (
            <motion.li key={f.k} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: (i % 3) * 0.08 }} className="border-t border-ivory/15 pt-5">
              <span className="font-display text-sm italic text-gold">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-display text-3xl">{f.k}</h3>
              <p className="mt-2 text-ivory/70">{f.v}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────────── Gallery ───────────── */

const GALLERY = [
  { src: "reception-wide", alt: "Reception desk with the spa's name" },
  { src: "corridor-violet", alt: "Violet-lit corridor" },
  { src: "lounge-mural", alt: "Lounge with a painted mural" },
  { src: "room-stripes", alt: "Therapy room with striped walls" },
  { src: "entry-blossom", alt: "Blossom panel at the entrance" },
  { src: "art-wall", alt: "Paintings on the wall" },
  { src: "room-magenta", alt: "Therapy room in magenta light" },
  { src: "reception-blossom", alt: "Reception with blossom wall" },
  { src: "lounge-horses", alt: "Lounge with horse painting" },
  { src: "corridor-jaali", alt: "Corridor with jaali screen" },
];

export function Gallery() {
  return (
    <section aria-label="Photos of the spa" className="bg-night pb-24">
      <Marquee pauseOnHover className="[--duration:70s] [--gap:1.25rem]">
        {GALLERY.map((g) => (
          <figure key={g.src} className="relative h-64 w-80 shrink-0 overflow-hidden rounded-2xl md:h-80 md:w-[28rem]">
            <Image src={`/images/${g.src}-sm.webp`} alt={g.alt} fill sizes="448px" className="object-cover transition-transform duration-700 hover:scale-105" />
          </figure>
        ))}
      </Marquee>
    </section>
  );
}

/* ───────────── Reviews ───────────── */

export function Reviews() {
  const { t } = useLocale();
  return (
    <section className="grain relative bg-ivory">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 md:grid-cols-12 md:px-8 md:py-32">
        <div className="md:col-span-5">
          <p className="eyebrow text-violet">{t.reviews.eyebrow}</p>
          <div className="mt-6 flex items-end gap-4">
            <span className="font-display text-[7rem] leading-none text-ink md:text-[10rem]">
              <NumberTicker value={4.7} decimalPlaces={1} className="text-ink" />
            </span>
            <div className="mb-5 flex gap-1 text-gold" aria-label="4.7 out of 5 stars">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="size-5" fill="currentColor" strokeWidth={0} aria-hidden />
              ))}
            </div>
          </div>
        </div>
        <div className="md:col-span-7 md:pt-10">
          <p className="text-lg text-muted">{t.reviews.body}</p>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {t.reviews.themes.map((th, i) => (
              <motion.li key={th} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: i * 0.07 }} className="flex items-center gap-5 py-5">
                <span className="font-display text-lg italic text-violet">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display text-2xl text-ink md:text-3xl">{th}</span>
              </motion.li>
            ))}
          </ul>
          <a href={mapsHref("The Purple Skin Friendly Salon and Spa Bhopal")} target="_blank" rel="noreferrer" className="btn btn-ghost mt-8 text-ink">
            {t.reviews.cta} <ArrowUpRight className="size-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Visit + footer ───────────── */

export function Visit({ catalog }: { catalog: Catalog }) {
  const { locale, t } = useLocale();
  const s = catalog.settings;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(s.maps_query)}&z=17&output=embed`;
  return (
    <section id="visit" className="scroll-mt-16 bg-sand">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 md:grid-cols-2 md:px-8 md:py-32">
        <div>
          <SectionHead eyebrow={t.visit.eyebrow} title={t.visit.title} />
          <address className="mt-8 flex gap-3 not-italic text-lg leading-relaxed text-ink">
            <MapPin className="mt-1.5 size-5 shrink-0 text-violet" aria-hidden />
            {s.address}
          </address>
          <div className="mt-8 border-t border-ink/15 pt-6">
            <p className="eyebrow text-muted">{t.visit.hours}</p>
            <p className="mt-2 font-display text-3xl text-ink">
              {t.visit.everyday}, {fmtClock(s.open_time, locale)} – {fmtClock(s.close_time, locale)}
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href={telHref(s.phone)} className="btn btn-ink">
              <Phone className="size-4" aria-hidden /> {t.visit.call} {prettyPhone(s.phone)}
            </a>
            <a href={waHref(s.whatsapp, "Hi, I'd like to book a session.")} target="_blank" rel="noreferrer" className="btn btn-ghost text-ink">
              <MessageCircle className="size-4" aria-hidden /> {t.visit.whatsapp}
            </a>
            <a href={mapsHref(s.maps_query)} target="_blank" rel="noreferrer" className="btn btn-ghost text-ink">
              {t.visit.directions} <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
        <div className="relative min-h-[360px] overflow-hidden rounded-[28px] border border-line bg-ivory">
          <iframe title="Map to the spa" src={mapSrc} className="absolute inset-0 h-full w-full grayscale-[35%]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </div>
    </section>
  );
}

export function SiteFooter({ catalog }: { catalog: Catalog }) {
  const { t } = useLocale();
  return (
    <footer className="bg-night text-ivory/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-16 md:flex-row md:items-end md:justify-between md:px-8">
        <div className="flex items-center gap-4">
          <Image src="/icons/icon-192.png" alt="" width={56} height={56} className="rounded-full" />
          <div>
            <p className="font-display text-2xl text-ivory">{catalog.settings.business_name}</p>
            <p className="text-sm">Maharana Pratap Nagar, Bhopal</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Link href="/book" className="hover:text-ivory">{t.nav.book}</Link>
          <Link href="/account" className="hover:text-ivory">{t.nav.account}</Link>
          <Link href="/staff" className="hover:text-ivory">{t.footer.staff}</Link>
          {catalog.settings.instagram_url && (
            <a href={catalog.settings.instagram_url} target="_blank" rel="noreferrer" className="hover:text-ivory">Instagram</a>
          )}
        </div>
      </div>
      <div className="border-t border-ivory/10">
        <p className="mx-auto max-w-7xl px-6 py-6 text-xs md:px-8">
          © {catalog.settings.business_name}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
