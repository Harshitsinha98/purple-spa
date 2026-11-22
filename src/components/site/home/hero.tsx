"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Star } from "lucide-react";
import { Marquee } from "@/components/ui/marquee";
import { EASE, Magnetic, MaskLines } from "@/components/site/motion";
import { useOpenStatus } from "@/components/site/open-status";
import { pick, useLocale } from "@/lib/i18n/locale-provider";
import type { Catalog } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Rotating circular label, like a stamp. */
function Stamp({ className }: { className?: string }) {
  const text = "SKIN FRIENDLY · SPA & SALON · BHOPAL · ";
  return (
    <div className={cn("pointer-events-none select-none", className)} aria-hidden>
      <svg viewBox="0 0 200 200" className="size-full animate-[spin_24s_linear_infinite] motion-reduce:animate-none">
        <defs>
          <path id="stamp-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <text className="fill-gold-soft text-[15px] tracking-[0.32em]" style={{ fontFamily: "var(--font-manrope)" }}>
          <textPath href="#stamp-circle">{text}</textPath>
        </text>
      </svg>
      <Image src="/icons/icon-192.png" alt="" width={96} height={96} className="absolute left-1/2 top-1/2 size-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
    </div>
  );
}

export function Hero({ catalog }: { catalog: Catalog }) {
  const { t, locale } = useLocale();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const status = useOpenStatus(catalog.settings, locale);

  // Scroll: text drifts up and fades, photos sink a little slower — a gentle depth effect.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const textO = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const photoY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const photoS = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const floatA = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const floatB = useTransform(scrollYProgress, [0, 1], [0, -70]);

  // Pointer: floating photos lean toward the cursor (desktop only).
  const px = useSpring(0, { stiffness: 60, damping: 18 });
  const py = useSpring(0, { stiffness: 60, damping: 18 });
  const ax = useTransform(px, (v) => v * 18);
  const ay = useTransform(py, (v) => v * 14);
  const bx = useTransform(px, (v) => v * -12);
  const by = useTransform(py, (v) => v * -10);

  const treatments = catalog.categories.filter((c) => c.kind === "spa").flatMap((c) => c.services.map((s) => pick(s, "name", locale)));

  return (
    <section
      ref={ref}
      id="hero"
      className="grain-dark relative flex min-h-svh flex-col overflow-hidden bg-night text-ivory"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || reduce) return;
        px.set(e.clientX / window.innerWidth - 0.5);
        py.set(e.clientY / window.innerHeight - 0.5);
      }}
    >
      {/* Colour from the spa's LED strips, drifting slowly behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora absolute -left-[15%] -top-[20%] size-[70vmax] rounded-full bg-[radial-gradient(circle,rgba(107,47,160,0.55),transparent_60%)] blur-3xl" />
        <div className="aurora-slow absolute -right-[20%] top-[10%] size-[60vmax] rounded-full bg-[radial-gradient(circle,rgba(214,48,127,0.32),transparent_60%)] blur-3xl" />
        <div className="aurora absolute -bottom-[30%] left-[20%] size-[55vmax] rounded-full bg-[radial-gradient(circle,rgba(63,208,224,0.16),transparent_60%)] blur-3xl" />
      </div>

      <div className="relative z-[2] mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-5 pb-14 pt-28 md:grid-cols-12 md:gap-8 md:px-8 md:pt-28">
        <motion.div style={reduce ? undefined : { y: textY, opacity: textO }} className="md:col-span-6">
          <motion.p initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 1.1 }} className="eyebrow flex items-center gap-3 text-gold-soft">
            <span className="h-px w-10 bg-gold/60" /> {t.hero.eyebrow}
          </motion.p>
          <h1 className="display mt-6 text-[clamp(3.4rem,12vw,7rem)] leading-[0.95] md:text-[clamp(4rem,8.2vw,7rem)]">
            <span className="sr-only">The Purple Skin Friendly Salon and Spa — </span>
            <MaskLines inView={false} delay={1.2} lines={[t.hero.line1, t.hero.line2]} lineClassName={(i) => (i === 1 ? "italic text-shimmer whitespace-nowrap" : "whitespace-nowrap")} />
          </h1>
          <motion.p initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 1.55 }} className="balance mt-7 max-w-md text-lg leading-relaxed text-ivory/75">
            {t.hero.body}
          </motion.p>
          <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 1.7 }} className="mt-9 flex flex-wrap items-center gap-3">
            <Magnetic>
              <Link href="/book" className="btn btn-gold h-13 px-7 text-base">
                {t.hero.book} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Magnetic>
            <Link href="/#menu" className="btn btn-ghost h-13 px-6 text-base text-ivory">
              {t.hero.menu}
            </Link>
          </motion.div>
          <motion.dl initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.9 }} className="mt-9 flex flex-wrap gap-x-8 gap-y-4 border-t border-ivory/10 pt-6 text-sm">
            <div className="flex items-center gap-3">
              <dt className="sr-only">Rating</dt>
              <dd className="font-display text-3xl text-ivory">4.7</dd>
              <dd className="leading-tight text-ivory/60">
                <span className="flex gap-0.5 text-gold" aria-label="4.7 out of 5">
                  {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="size-3.5" fill="currentColor" strokeWidth={0} aria-hidden />)}
                </span>
                {t.hero.rating}
              </dd>
            </div>
            <div className="flex items-center gap-3">
              <dt className="sr-only">{t.visit.hours}</dt>
              <dd className="relative flex size-2.5">
                <span className={cn("absolute inline-flex size-full rounded-full opacity-60", status?.open ? "animate-ping bg-emerald-400" : "bg-ivory/30")} />
                <span className={cn("relative inline-flex size-2.5 rounded-full", status?.open ? "bg-emerald-400" : "bg-ivory/40")} />
              </dd>
              <dd className="leading-tight text-ivory/70">
                {status ? (status.open ? t.visit.openNow : t.visit.closed) : t.hero.today}
                <span className="block text-ivory/50">{status ? `${status.open ? t.visit.closesAt : t.visit.opensAt} ${status.next}` : "\u00a0"}</span>
              </dd>
            </div>
          </motion.dl>
        </motion.div>

        {/* Photo collage */}
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[30rem] md:col-span-6 md:max-w-none md:justify-self-end md:aspect-auto md:h-[min(76svh,46rem)] md:w-[92%]">
          <motion.div style={reduce ? undefined : { y: photoY, scale: photoS }} className="absolute inset-0">
            <motion.div
              className="absolute inset-0 overflow-hidden rounded-[2rem] ring-1 ring-ivory/10"
              initial={reduce ? false : { clipPath: "inset(100% 0% 0% 0% round 2rem)" }}
              animate={{ clipPath: "inset(0% 0% 0% 0% round 2rem)" }}
              transition={{ duration: 1.4, ease: [0.76, 0, 0.24, 1], delay: 0.9 }}
            >
              <Image src="/images/reception-wide.webp" alt="The reception desk of The Purple Spa & Salon, lit in violet and cyan" fill priority sizes="(min-width: 768px) 46vw, 92vw" className="ken-burns object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-night/60 via-transparent to-transparent" />
            </motion.div>
          </motion.div>

          <motion.div style={reduce ? undefined : { y: floatA }} className="absolute -bottom-6 -left-4 w-[38%] md:-left-16 md:bottom-10">
            <motion.div style={reduce ? undefined : { x: ax, y: ay }} initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: 1.6 }} className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-4 ring-night">
              <Image src="/images/lounge-mural-sm.webp" alt="The lounge with its painted mural" fill sizes="220px" className="object-cover" />
            </motion.div>
          </motion.div>

          <motion.div style={reduce ? undefined : { y: floatB }} className="absolute -right-3 top-6 w-[30%] md:-right-8 md:top-12">
            <motion.div style={reduce ? undefined : { x: bx, y: by }} initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: 1.8 }} className="relative aspect-square overflow-hidden rounded-2xl shadow-2xl shadow-black/50 ring-4 ring-night">
              <Image src="/images/room-magenta-sm.webp" alt="A therapy room in magenta light" fill sizes="180px" className="object-cover" />
            </motion.div>
          </motion.div>

          <motion.div initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: EASE, delay: 2 }} className="absolute -bottom-10 right-6 size-28 md:-bottom-8 md:right-10 md:size-36">
            <Stamp className="relative size-full" />
          </motion.div>
        </div>
      </div>

      <div className="relative z-[2] border-y border-ivory/10 bg-night/60 py-4 backdrop-blur-sm">
        <Marquee className="[--duration:55s] [--gap:2.5rem]" repeat={3}>
          {treatments.map((n, i) => (
            <span key={`${n}-${i}`} className="flex items-center gap-10 whitespace-nowrap font-display text-2xl italic text-ivory/80 md:text-3xl">
              {n} <span className="text-base not-italic text-gold">✦</span>
            </span>
          ))}
        </Marquee>
      </div>

    </section>
  );
}
