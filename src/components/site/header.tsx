"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

/** Transparent over the dark tour, turns to ivory paper once the visitor reaches the content. */
export function SiteHeader({ solid = false }: { solid?: boolean }) {
  const { t, toggle } = useLocale();
  const { user, profile } = useSession();
  const { scrollY } = useScroll();
  const [paper, setPaper] = useState(solid);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    const tour = document.getElementById("tour");
    const tourEnd = tour ? tour.offsetTop + tour.offsetHeight - 80 : 0;
    setPaper(solid || y > tourEnd);
    setHidden(y > 300 && y > prev && !open);
  });

  const accountHref = profile?.role === "admin" ? "/admin" : profile?.role === "employee" ? "/staff" : "/account";
  const links = [
    { href: "/#menu", label: t.nav.menu },
    { href: "/#salon", label: t.nav.salon },
    { href: "/#visit", label: t.nav.visit },
  ];

  return (
    <motion.header
      animate={{ y: hidden ? -96 : 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-500",
        paper ? "border-b border-line bg-ivory/90 text-ink backdrop-blur-md" : "text-ivory",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 md:h-[72px] md:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="The Purple Skin Friendly Salon and Spa, home">
          <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="rounded-full" />
          <span className="font-display text-lg leading-none md:text-xl">
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

        <div className="flex items-center gap-2">
          <button onClick={toggle} className="hidden min-h-11 cursor-pointer rounded-full px-3 text-sm font-medium opacity-80 hover:opacity-100 sm:block" aria-label="Change language">
            {t.nav.language}
          </button>
          <Link href={user ? accountHref : "/login"} className="hidden min-h-11 items-center px-3 text-sm font-medium opacity-80 hover:opacity-100 sm:flex">
            {user ? t.nav.account : t.nav.signIn}
          </Link>
          <Link href="/book" className={cn("btn h-11 text-sm", paper ? "btn-ink" : "btn-gold")}>
            {t.nav.book}
          </Link>
          <button onClick={() => setOpen((v) => !v)} className="grid size-11 cursor-pointer place-items-center md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-line bg-ivory text-ink md:hidden"
            aria-label="Mobile"
          >
            <div className="flex flex-col px-5 py-3">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-3 text-lg font-display">
                  {l.label}
                </Link>
              ))}
              <Link href={user ? accountHref : "/login"} onClick={() => setOpen(false)} className="py-3 text-lg font-display">
                {user ? t.nav.account : t.nav.signIn}
              </Link>
              <button onClick={toggle} className="cursor-pointer py-3 text-left text-lg font-display">
                {t.nav.language}
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
