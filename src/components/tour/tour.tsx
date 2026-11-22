"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useProgress } from "@react-three/drei";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { CHAPTER_WINDOWS, FINAL_WINDOW, PORTALS } from "./path";

const Canvas = dynamic(() => import("@react-three/fiber").then((m) => m.Canvas), { ssr: false });
const TourScene = dynamic(() => import("./scene").then((m) => m.TourScene), { ssr: false });

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Scroll-driven walk into the spa. A tall section pins a WebGL scene; scrolling moves the camera
 * through the door, past the reception and corridor, into a therapy room.
 */
export function Tour() {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  const [small, setSmall] = useState(false);

  useEffect(() => {
    const isSmall = window.matchMedia("(max-width: 767px)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability check needs the browser
    setSmall(isSmall);
    setMode(reduce || !webglAvailable() ? "static" : "3d");
  }, [reduce]);

  if (mode === "static") return <StaticTour />;
  return <ScrollTour ready={mode === "3d"} small={small} />;
}

function ScrollTour({ ready, small }: { ready: boolean; small: boolean }) {
  const { t } = useLocale();
  const ref = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "100px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // Spring = cinematic lag between the wheel and the camera, like a GSAP scrub of ~1s.
  const progress = useSpring(scrollYProgress, { stiffness: 70, damping: 22, mass: 0.5, restDelta: 0.0001 });
  const hintOpacity = useTransform(scrollYProgress, [0, 0.03], [1, 0]);
  const bar = useTransform(progress, [0, 1], ["0%", "100%"]);
  const shade = useTransform(progress, [0.86, 0.94], [1, 0]);

  return (
    <section ref={ref} id="tour" aria-label="Walk into the spa" className="relative h-[720svh] bg-night text-ivory">
      <div ref={stage} className="sticky top-0 h-svh w-full overflow-hidden">
        {ready && (
          <Canvas
            frameloop={inView ? "always" : "never"}
            dpr={[1, small ? 1.5 : 1.75]}
            gl={{ antialias: !small, powerPreference: "high-performance" }}
            camera={{ fov: small ? 68 : 55, near: 0.1, far: 60, position: [0, 1.6, 6.2] }}
            className="absolute! inset-0"
            aria-hidden
          >
            <Suspense fallback={null}>
              <TourScene progress={progress} small={small} />
            </Suspense>
          </Canvas>
        )}
        <Loader />

        {/* Soft shading only where text sits: left third on desktop, lower half on phones. Fades out in the last room. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(14,6,19,0.5)_100%)]" />
        <motion.div style={{ opacity: shade }} className="pointer-events-none absolute inset-y-0 left-0 hidden w-[44%] bg-gradient-to-r from-[#0e0613]/85 via-[#0e0613]/40 to-transparent md:block" />
        <motion.div style={{ opacity: shade }} className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[#0e0613] via-[#0e0613]/85 to-transparent md:hidden" />

        {t.tour.chapters.map((c, i) => (
          <Chapter key={c.n} progress={progress} window={CHAPTER_WINDOWS[i]} n={c.n} title={c.title} body={c.body} first={i === 0} />
        ))}
        <Final progress={progress} />

        <motion.div style={{ opacity: hintOpacity }} className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-1 text-ivory/70 md:bottom-8 md:gap-2">
          <span className="eyebrow">{t.tour.scroll}</span>
          <ArrowDown className="size-4 animate-bounce" aria-hidden />
        </motion.div>

        <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-ivory/10">
          <motion.div style={{ width: bar }} className="h-full bg-gold" />
        </div>
      </div>
    </section>
  );
}

function Chapter({ progress, window: [a, b], n, title, body, first }: { progress: MotionValue<number>; window: [number, number]; n: string; title: string; body: string; first: boolean }) {
  const fadeIn = first ? a : a + 0.03;
  const opacity = useTransform(progress, first ? [0, b - 0.03, b] : [a, fadeIn, b - 0.03, b], first ? [1, 1, 0] : [0, 1, 1, 0]);
  const y = useTransform(progress, [a, b], [18, -18]);
  const [visible, setVisible] = useState(first);
  useMotionValueEvent(opacity, "change", (v) => setVisible(v > 0.02));

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none absolute inset-x-0 bottom-[11svh] px-6 md:inset-x-auto md:bottom-auto md:left-[6vw] md:top-1/2 md:w-[min(30rem,34vw)] md:-translate-y-1/2 md:px-0"
    >
      <motion.div style={{ opacity, y }}>
        {first && <h1 className="eyebrow mb-5 text-gold-soft">The Purple Skin Friendly Salon and Spa · Bhopal</h1>}
        <div className="flex items-center gap-4">
          <span className="font-display text-4xl italic leading-none text-gold md:text-5xl">{n}</span>
          <span className="h-px w-16 bg-gold/50" />
        </div>
        <h2 className="display mt-4 text-[2.4rem] text-ivory md:text-6xl">{title}</h2>
        <p className="mt-4 max-w-sm text-[0.98rem] leading-relaxed text-ivory/85 md:text-lg">{body}</p>
      </motion.div>
    </div>
  );
}

function Final({ progress }: { progress: MotionValue<number> }) {
  const { t } = useLocale();
  const [a] = FINAL_WINDOW;
  const opacity = useTransform(progress, [a, a + 0.04], [0, 1]);
  const scale = useTransform(progress, [a, 1], [0.96, 1]);
  const [active, setActive] = useState(false);
  useMotionValueEvent(opacity, "change", (v) => setActive(v > 0.5));

  return (
    <motion.div style={{ opacity, scale }} className={`absolute inset-0 flex flex-col items-center justify-center px-6 text-center ${active ? "" : "pointer-events-none"}`}>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0613]/70 via-[#0e0613]/25 to-[#0e0613]/45" />
      <p className="eyebrow relative text-gold-soft">The Purple Skin Friendly Salon and Spa</p>
      <h2 className="display relative mt-4 text-5xl text-ivory md:text-8xl">{t.tour.finalTitle}</h2>
      <Link href="/book" tabIndex={active ? 0 : -1} className="btn btn-gold relative mt-10 text-base">
        {t.tour.finalCta} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </motion.div>
  );
}

function Loader() {
  const { t } = useLocale();
  const { active, progress } = useProgress();
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!active && progress === 100) {
      const id = setTimeout(() => setGone(true), 450);
      return () => clearTimeout(id);
    }
  }, [active, progress]);
  if (gone) return null;
  return (
    <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-night transition-opacity duration-500 ${!active && progress === 100 ? "opacity-0" : "opacity-100"}`}>
      <Image src="/images/logo.webp" alt="" width={120} height={120} className="rounded-full opacity-90" priority />
      <p className="eyebrow mt-6 text-gold-soft/80">{t.tour.loading}</p>
      <div className="mt-4 h-px w-40 overflow-hidden bg-ivory/10">
        <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${Math.max(8, progress)}%` }} />
      </div>
    </div>
  );
}

/** Used for reduced-motion visitors and browsers without WebGL: the same story as still photos. */
function StaticTour() {
  const { t } = useLocale();
  return (
    <section id="tour" className="bg-night text-ivory">
      <div className="mx-auto max-w-6xl px-6 py-24">
        {t.tour.chapters.map((c, i) => {
          const img = i === 0 ? "entry-blossom" : PORTALS[Math.min(i - 1, PORTALS.length - 1)].image;
          return (
            <article key={c.n} className="grid items-center gap-8 border-b border-ivory/10 py-12 md:grid-cols-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image src={`/images/${img}.webp`} alt={c.title} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
              </div>
              <div>
                <span className="font-display text-5xl italic text-gold">{c.n}</span>
                <h2 className="display mt-3 text-4xl md:text-5xl">{c.title}</h2>
                <p className="mt-4 text-lg text-ivory/80">{c.body}</p>
              </div>
            </article>
          );
        })}
        <div className="pt-16 text-center">
          <h2 className="display text-5xl">{t.tour.finalTitle}</h2>
          <Link href="/book" className="btn btn-gold mt-8">
            {t.tour.finalCta} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
