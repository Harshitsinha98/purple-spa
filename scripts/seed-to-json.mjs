// Builds src/lib/fallback-catalog.json from supabase/migrations/0002_seed.sql so the public
// menu can render before the database is set up. Run: node scripts/seed-to-json.mjs
import { readFileSync, writeFileSync } from "node:fs";
const sql = readFileSync("supabase/migrations/0002_seed.sql", "utf8");
const str = (s) => (s === "null" ? null : s.slice(1, -1).replace(/''/g, "'"));
const cats = [];
const catBlock = sql.split("insert into service_categories")[1].split("on conflict")[0];
for (const m of catBlock.matchAll(/\('([^']+)', '(spa|salon)', '([^']+)', '([^']+)', (null|'[^']*'), (null|'[^']*'), (\d+)\)/g)) {
  cats.push({ id: `fallback-${m[1]}`, slug: m[1], kind: m[2], name_en: m[3], name_hi: m[4], description_en: str(m[5]), description_hi: str(m[6]), sort: +m[7], is_active: true, services: [] });
}
for (const m of sql.matchAll(/select pg_temp\.svc\('([^']+)', '([^']+)', '([^']+)', '([^']+)', (null|'[^']*'), (null|'[^']*'), '(bed|chair)', (\d+), array\[(.+?)\]\);/g)) {
  const cat = cats.find((c) => c.slug === m[1]);
  const id = `fallback-${m[2]}`;
  const variants = [...m[9].matchAll(/\[(\d+),(\d+)\]/g)].map((v) => ({ id: `${id}-${v[1]}`, service_id: id, duration_min: +v[1], price: +v[2], is_active: true }));
  cat.services.push({ id, category_id: cat.id, slug: m[2], name_en: m[3], name_hi: m[4], description_en: null, description_hi: null, tag_en: str(m[5]), tag_hi: str(m[6]), resource: m[7], commission_percent: null, sort: +m[8], is_active: true, service_variants: variants });
}
writeFileSync("src/lib/fallback-catalog.json", JSON.stringify(cats, null, 1));
console.log(cats.length, "categories,", cats.reduce((n, c) => n + c.services.length, 0), "services");
