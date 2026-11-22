import { Suspense } from "react";
import { Dashboard } from "./dashboard";

export default function AdminHome() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
