import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffApp } from "./staff-app";

export const metadata: Metadata = { title: "Staff", robots: { index: false } };

export default function StaffPage() {
  return (
    <Suspense>
      <StaffApp />
    </Suspense>
  );
}
