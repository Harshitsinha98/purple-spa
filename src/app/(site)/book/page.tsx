import type { Metadata } from "next";
import { Suspense } from "react";
import { getCatalog } from "@/lib/catalog";
import { SiteHeader } from "@/components/site/header";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { BookTitle } from "./title";

export const metadata: Metadata = { title: "Book a session", description: "Pick a massage or salon service, choose a time and pay online or at the spa." };

export default async function BookPage() {
  const catalog = await getCatalog();
  return (
    <>
      <SiteHeader solid />
      <main className="min-h-svh bg-ivory pt-28 pb-24">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <BookTitle />
          <Suspense>
            <BookingWizard catalog={catalog} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
