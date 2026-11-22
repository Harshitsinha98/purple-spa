import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { BookingDetail } from "./booking-detail";

export const metadata: Metadata = { title: "Booking", robots: { index: false } };

export default function BookingPage() {
  return (
    <>
      <SiteHeader solid />
      <main className="min-h-svh bg-ivory pt-28 pb-24">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <Suspense>
            <BookingDetail />
          </Suspense>
        </div>
      </main>
    </>
  );
}
