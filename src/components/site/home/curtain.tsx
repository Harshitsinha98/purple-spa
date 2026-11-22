import Image from "next/image";

/** Short opening curtain with the logo. CSS-only, so the page underneath renders immediately. */
export function Curtain() {
  return (
    <div aria-hidden className="curtain pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-night">
      <div className="curtain-logo flex flex-col items-center gap-5">
        <Image src="/images/logo.webp" alt="" width={140} height={140} priority className="rounded-full" />
        <span className="eyebrow text-gold-soft">The Purple Skin Friendly Salon and Spa</span>
      </div>
    </div>
  );
}
