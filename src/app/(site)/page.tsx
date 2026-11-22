import { getCatalog } from "@/lib/catalog";
import { SiteHeader } from "@/components/site/header";
import { JsonLd } from "@/components/site/json-ld";
import { Curtain } from "@/components/site/home/curtain";
import { Hero } from "@/components/site/home/hero";
import { Story, Walkthrough } from "@/components/site/home/story";
import { Combos, Salon, SpaMenu } from "@/components/site/home/menu";
import { Facilities, FinalCta, Gallery, Reviews, SiteFooter, Visit } from "@/components/site/home/rest";

export default async function HomePage() {
  const catalog = await getCatalog();
  return (
    <>
      <Curtain />
      <SiteHeader />
      <main>
        <Hero catalog={catalog} />
        <Story catalog={catalog} />
        <Walkthrough />
        <SpaMenu catalog={catalog} />
        <Combos catalog={catalog} />
        <Salon catalog={catalog} />
        <Facilities />
        <Gallery />
        <Reviews />
        <Visit catalog={catalog} />
        <FinalCta />
      </main>
      <SiteFooter catalog={catalog} />
      <JsonLd catalog={catalog} />
    </>
  );
}
