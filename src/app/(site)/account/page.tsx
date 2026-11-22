import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { AccountBookings } from "./account-bookings";

export const metadata: Metadata = { title: "My bookings", robots: { index: false } };

export default function AccountPage() {
  return (
    <>
      <SiteHeader solid />
      <main className="min-h-svh bg-ivory pt-28 pb-24">
        <div className="mx-auto max-w-4xl px-5 md:px-8">
          <Suspense>
            <AccountBookings />
          </Suspense>
        </div>
      </main>
    </>
  );
}
