import { SITE_URL } from "@/lib/env";
import type { Catalog } from "@/lib/types";

/** Local business structured data for Google. */
export function JsonLd({ catalog }: { catalog: Catalog }) {
  const s = catalog.settings;
  const data = {
    "@context": "https://schema.org",
    "@type": "DaySpa",
    name: s.business_name,
    url: SITE_URL,
    image: `${SITE_URL}/images/og.jpg`,
    telephone: s.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: "SF 14, Second Floor, Mansarovar Complex, C Block, Maharana Pratap Nagar",
      addressLocality: "Bhopal",
      addressRegion: "Madhya Pradesh",
      postalCode: "462016",
      addressCountry: "IN",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: s.open_time.slice(0, 5),
        closes: s.close_time.slice(0, 5),
      },
    ],
    priceRange: "₹₹",
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
