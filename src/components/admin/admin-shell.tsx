"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, Bell, BellRing, CalendarDays, Contact, CreditCard, LayoutDashboard, Loader2, LogOut, Settings, Sparkles, Users } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { currentPushSubscription, enablePush, pushSupported, registerSW } from "@/lib/push-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Today", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/customers", label: "Customers", icon: Contact },
  { href: "/admin/services", label: "Services", icon: Sparkles },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { loading, user, profile } = useSession();
  const path = usePathname();
  const [pushOn, setPushOn] = useState(false);

  useEffect(() => {
    registerSW();
    currentPushSubscription().then((s) => setPushOn(Boolean(s)));
  }, []);

  if (loading) {
    return <div className="grid min-h-svh place-items-center bg-ivory text-muted"><Loader2 className="size-6 animate-spin" /></div>;
  }
  if (!user || profile?.role !== "admin") {
    return (
      <div className="grid min-h-svh place-items-center bg-ivory px-6 text-center">
        <div>
          <p className="font-display text-3xl text-ink">Admin access only</p>
          <p className="mt-2 text-muted">Signed in as {user?.email ?? "—"}. Ask the owner to add your Gmail as an admin.</p>
          <Link href="/" className="btn btn-ink mt-6">Back to site</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-[#f6f3ef] text-ink lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 z-20 border-b border-line bg-night text-ivory lg:h-svh lg:border-b-0">
        <div className="flex h-14 items-center gap-2 px-4 lg:h-16">
          <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="rounded-full" />
          <span className="font-display text-lg">Purple Spa · Admin</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3" aria-label="Admin">
          {NAV.map((n) => {
            const on = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={cn("flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors", on ? "bg-ivory/10 text-ivory" : "text-ivory/60 hover:text-ivory")}>
                <n.icon className="size-4" aria-hidden /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-3 pt-6 lg:block">
          {pushSupported() && (
            <button
              onClick={() => enablePush(profile.id).then(() => setPushOn(true)).catch((e) => alert(e.message))}
              disabled={pushOn}
              className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-ivory/60 hover:text-ivory disabled:cursor-default"
            >
              {pushOn ? <BellRing className="size-4 text-emerald-300" /> : <Bell className="size-4" />}
              {pushOn ? "Alerts on" : "Turn on booking alerts"}
            </button>
          )}
          <form action="/auth/signout" method="post">
            <button className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-ivory/60 hover:text-ivory">
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
          <p className="mt-4 truncate px-3 text-xs text-ivory/40">{user.email}</p>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
