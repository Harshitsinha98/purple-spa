import { Suspense } from "react";
import { BookingsBoard } from "@/components/admin/bookings-board";
import { PageHead } from "@/components/admin/ui";

export default function AdminBookings() {
  return (
    <div>
      <PageHead title="Bookings" sub="Assign therapists, update status and record counter payments. Changes appear on customers' phones instantly." />
      <Suspense>
        <BookingsBoard />
      </Suspense>
    </div>
  );
}
