import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, Mukta, Tiro_Devanagari_Hindi } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope", display: "swap" });
const tiro = Tiro_Devanagari_Hindi({ subsets: ["devanagari"], weight: "400", variable: "--font-tiro", display: "swap" });
const mukta = Mukta({ subsets: ["devanagari"], weight: ["400", "500", "600"], variable: "--font-mukta", display: "swap" });

const title = "The Purple Skin Friendly Salon and Spa · Bhopal";
const description =
  "Massage, body scrubs and salon services at SF 14, Mansarovar Complex, M.P. Nagar, Bhopal. Rated 4.7 by guests. Book online in a minute.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: "%s · The Purple Spa" },
  description,
  applicationName: "The Purple Spa",
  openGraph: { title, description, type: "website", locale: "en_IN", images: ["/images/og.jpg"] },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Purple Spa", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#140a1b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cormorant.variable} ${manrope.variable} ${tiro.variable} ${mukta.variable}`}>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
