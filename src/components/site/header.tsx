"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

/** Transparent over the dark tour, turns to ivory paper once the visitor reaches the content. Always visible. */
export function SiteHeader({ solid = false }: { solid?: boolean }) {
  const { t, toggle } = useLocale();
  const { user, profile } = useSession();
  const { scrollY } = useScroll();
  const [paper, setPaper] = useState(solid);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const tour = document.getElementById("tour");
    const tourEnd = tour ? tour.offsetTop + tour.offsetHeight - 80 : 0;
    setPaper(solid || y > tourEnd);
  });

  // Freeze the page behind the open menu and close it with Escape.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    html.classList.add("lenis-stopped");
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      html.classList.remove("lenis-stopped");
      html.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const accountHref = profile?.role === "admin" ? "/admin" : profile?.role === "employee" ? "/staff" : "/account";
  const links = [
    { href: "/#menu", label: t.nav.menu },
    { href: "/#salon", label: t.nav.salon },
    { href: "/#visit", label: t.nav.visit },
  ];
  const dark = !paper && !open;

  return (
    <>
      <header className={cn("fixed inset-x-0 top-0 z-50 transition-colors duration-500", dark ? "text-ivory" : "border-b border-line bg-ivory/95 text-ink backdrop-blur-md")}>
        {dark && <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-night/80 to-transparent" />}
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:h-[72px] md:px-8">
          <Link href="/" onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-2.5" aria-label="The Purple Skin Friendly Salon and Spa, home">
            <Image src="/icons/icon-192.png" alt="" width={34} height={34} className="shrink-0 rounded-full" />
            <span className="truncate whitespace-nowrap font-display text-lg leading-none md:text-xl">
              The Purple <span className="italic text-gold">Spa</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm font-medium opacity-80 transition-opacity hover:opacity-100">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={toggle} className="hidden min-h-11 cursor-pointer rounded-full px-3 text-sm font-medium opacity-80 hover:opacity-100 md:block" aria-label="Change language">
              {t.nav.language}
            </button>
            <Link href={user ? accountHref : "/login"} className="hidden min-h-11 items-center px-3 text-sm font-medium opacity-80 hover:opacity-100 md:flex">
              {user ? t.nav.account : t.nav.signIn}
            </Link>
            <Link href="/book" onClick={() => setOpen(false)} className={cn("btn h-10 min-h-10 whitespace-nowrap px-4 text-sm md:h-11", dark ? "btn-gold" : "btn-ink")}>
              <span className="md:hidden">{t.nav.bookShort}</span>
              <span className="hidden md:inline">{t.nav.book}</span>
            </Link>
            <button
              onClick={() => setOpen((v) => !v)}
              className="grid size-11 cursor-pointer place-items-center rounded-full md:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            data-lenis-prevent
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-ivory px-6 pb-10 pt-24 text-ink md:hidden"
          >
            <nav aria-label="Mobile" className="flex flex-col">
              {[...links, { href: user ? accountHref : "/login", label: user ? t.nav.account : t.nav.signIn }].map((l, i) => (
                <motion.div key={l.href} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="flex items-center justify-between border-b border-line py-5 font-display text-4xl">
                    {l.label}
                    <ArrowRight className="size-5 text-muted" aria-hidden />
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="mt-auto space-y-3 pt-10">
              <Link href="/book" onClick={() => setOpen(false)} className="btn btn-ink w-full text-base">
                {t.nav.book}
              </Link>
              <button onClick={toggle} className="btn btn-ghost w-full text-base">
                {t.nav.language}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
