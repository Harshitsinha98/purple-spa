"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GoogleButton } from "@/components/auth/google-button";
import { useLocale } from "@/lib/i18n/locale-provider";

export function LoginCard() {
  const { t, toggle } = useLocale();
  const params = useSearchParams();
  const raw = params.get("next");
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;

  return (
    <div className="w-full max-w-sm rounded-[28px] bg-ivory p-8 shadow-2xl shadow-black/40">
      <Link href="/" className="mx-auto block w-fit">
        <Image src="/images/logo.webp" alt="The Purple Spa & Salon" width={112} height={112} className="rounded-full" priority />
      </Link>
      <h1 className="display mt-6 text-center text-4xl text-ink">{t.auth.title}</h1>
      <p className="mt-3 text-center text-muted">{t.auth.body}</p>
      {params.get("error") && <p role="alert" className="mt-4 rounded-xl bg-magenta/10 px-4 py-3 text-sm text-magenta">{t.auth.error}</p>}
      <div className="mt-8">
        <GoogleButton next={next} />
      </div>
      <p className="mt-6 text-center text-xs text-muted">{t.auth.staffNote}</p>
      <button onClick={toggle} className="mx-auto mt-4 block min-h-11 cursor-pointer text-sm text-violet">
        {t.nav.language}
      </button>
    </div>
  );
}
