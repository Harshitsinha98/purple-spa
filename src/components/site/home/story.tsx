"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Magnetic, MaskLines, Parallax, Reveal, ScrollWords } from "@/components/site/motion";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { Catalog } from "@/lib/types";

export function Story({ catalog }: { catalog: Catalog }) {
  const { t } = useLocale();
  const treatments = catalog.categories.filter((c) => c.kind === "spa").reduce((n, c) => n + c.services.length, 0);
  const stats = [
    { v: <NumberTicker value={4.7} decimalPlaces={1} className="text-ink" />, k: t.intro.stats.rating },
    { v: <NumberTicker value={83} className="text-ink" />, k: t.intro.stats.reviews },
    { v: <NumberTicker value={7} className="text-ink" />, k: t.intro.stats.open },
    { v: <NumberTicker value={treatments} className="text-ink" />, k: t.intro.stats.rooms },
  ];
  return (
    <section id="story" className="grain relative scroll-mt-16 overflow-hidden bg-ivory">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 md:grid-cols-12 md:px-8 md:py-36">
        <div className="md:col-span-8">
          <Reveal><p className="eyebrow text-violet">{t.intro.eyebrow}</p></Reveal>
          <ScrollWords text={t.intro.title} className="display mt-6 text-[clamp(2.4rem,5.6vw,5rem)] text-ink" />
          <Reveal delay={0.1}><p className="mt-8 max-w-xl text-lg leading-relaxed text-muted">{t.intro.body}</p></Reveal>
        </div>
        <div className="hidden md:col-span-4 md:block md:pt-16">
          <Parallax speed={0.08} className="relative aspect-[3/4] overflow-hidden rounded-[2rem]">
            <div className="relative h-full w-full scale-110">
              <Image src="/images/entry-blossom-sm.webp" alt="The blossom panel by the entrance" fill sizes="30vw" className="object-cover" />
            </div>
          </Parallax>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line md:col-span-12 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.k} delay={i * 0.06} className="bg-ivory px-6 py-8 md:px-8 md:py-10">
              <dt className="sr-only">{s.k}</dt>
              <dd className="font-display text-5xl md:text-7xl">{s.v}</dd>
              <dd className="mt-2 text-sm text-muted">{s.k}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

const STEPS = ["reception-entry", "reception-front", "corridor-neon", "lounge-mural", "art-wall", "room-magenta"];

/**
 * "Step inside": a pinned strip of real photos that moves sideways as you scroll down,
 * walking from the door to the therapy room.
 */
export function Walkthrough() {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  const [vh, setVh] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!track.current) return;
      setDist(Math.max(0, track.current.scrollWidth - window.innerWidth));
      setVh(window.innerHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const x = useTransform(p, [0, 1], [0, -dist]);
  const imgX = useTransform(p, [0, 1], ["0%", "-14%"]);
  const bar = useTransform(p, [0, 1], ["0%", "100%"]);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(STEPS.length - 1, Math.max(0, Math.round(v * (STEPS.length + 0.6) - 0.6)))));

  if (reduce) {
    return (
      <section id="inside" className="bg-night px-5 py-24 text-ivory md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow text-gold-soft">{t.walk.eyebrow}</p>
          <h2 className="display mt-4 max-w-2xl text-5xl">{t.walk.title}</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-2">
            {t.tour.chapters.map((c, i) => (
              <article key={c.n}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image src={`/images/${STEPS[i]}-sm.webp`} alt={c.title} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                </div>
                <h3 className="mt-4 font-display text-3xl">{c.title}</h3>
                <p className="mt-2 text-ivory/70">{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} id="inside" aria-label={t.walk.eyebrow} className="relative bg-night text-ivory" style={{ height: dist ? dist + vh : "400svh" }}>
      <div className="grain-dark sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="aurora absolute left-[30%] top-[10%] size-[60vmax] rounded-full bg-[radial-gradient(circle,rgba(107,47,160,0.35),transparent_60%)] blur-3xl" />
        </div>
        <motion.div ref={track} style={{ x }} className="relative z-[2] flex w-max items-center gap-6 pl-5 pr-[10vw] md:gap-10 md:pl-[8vw]">
          <div className="w-[78vw] shrink-0 md:w-[34vw]">
            <p className="eyebrow text-gold-soft">{t.walk.eyebrow}</p>
            <h2 className="display mt-5 text-[clamp(2.6rem,5vw,4.8rem)]">
              <MaskLines lines={[t.walk.title]} />
            </h2>
            <p className="mt-6 flex items-center gap-2 text-sm text-ivory/50">
              <span className="h-px w-10 bg-ivory/30" /> {t.hero.scroll} <ArrowRight className="size-4" aria-hidden />
            </p>
          </div>

          {t.tour.chapters.map((c, i) => (
            <article key={c.n} className="w-[82vw] shrink-0 md:w-[min(52vw,52rem)]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] ring-1 ring-ivory/10 md:aspect-[16/10]">
                <motion.div style={{ x: imgX }} className="absolute inset-y-0 left-0 w-[118%]">
                  <Image src={`/images/${STEPS[i]}.webp`} alt={c.title} fill sizes="(min-width: 768px) 60vw, 95vw" className="object-cover" />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
                  <span className="font-display text-5xl italic leading-none text-gold md:text-7xl">{c.n}</span>
                  <h3 className="display mt-3 text-3xl md:text-5xl">{c.title}</h3>
                  <p className="mt-3 max-w-md text-[0.98rem] leading-relaxed text-ivory/80 md:text-lg">{c.body}</p>
                </div>
              </div>
            </article>
          ))}

          <div className="flex w-[78vw] shrink-0 flex-col items-start justify-center md:w-[32vw]">
            <h3 className="display text-[clamp(2.8rem,5vw,4.8rem)]">{t.tour.finalTitle}</h3>
            <Magnetic className="mt-8">
              <Link href="/book" className="btn btn-gold h-13 px-7 text-base">
                {t.tour.finalCta} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Magnetic>
          </div>
        </motion.div>

        <div className="absolute inset-x-5 bottom-8 z-[2] flex items-center gap-4 md:inset-x-[8vw]">
          <span className="font-display text-lg tabular-nums text-gold-soft">{String(active + 1).padStart(2, "0")}</span>
          <div className="h-px flex-1 bg-ivory/15">
            <motion.div style={{ width: bar }} className="h-full bg-gold" />
          </div>
          <span className="font-display text-lg tabular-nums text-ivory/40">{String(STEPS.length).padStart(2, "0")}</span>
        </div>
      </div>
    </section>
  );
}
