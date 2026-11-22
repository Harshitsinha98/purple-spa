import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginCard } from "./login-card";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-night px-5 py-16">
      <Suspense>
        <LoginCard />
      </Suspense>
    </main>
  );
}
