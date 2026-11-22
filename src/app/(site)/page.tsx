import { getCatalog } from "@/lib/catalog";
import { SiteHeader } from "@/components/site/header";
import { Tour } from "@/components/tour/tour";
import { Facilities, Gallery, Intro, Reviews, Salon, SiteFooter, SpaMenu, Visit } from "@/components/site/sections";
import { JsonLd } from "@/components/site/json-ld";

export default async function HomePage() {
  const catalog = await getCatalog();
  return (
    <>
      <SiteHeader />
      <main>
        <Tour />
        <Intro catalog={catalog} />
        <SpaMenu catalog={catalog} />
        <Salon catalog={catalog} />
        <Facilities />
        <Gallery />
        <Reviews />
        <Visit catalog={catalog} />
      </main>
      <SiteFooter catalog={catalog} />
      <JsonLd catalog={catalog} />
    </>
  );
}
