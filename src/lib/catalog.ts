import { cacheLife, cacheTag } from "next/cache";
import { supabaseConfigured } from "@/lib/env";
import { supabasePublic } from "@/lib/supabase/public";
import fallbackCategories from "@/lib/fallback-catalog.json";
import type { Catalog, CatalogCategory, Category, Service, Settings } from "@/lib/types";

export const CATALOG_TAG = "catalog";

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  business_name: "The Purple Skin Friendly Salon and Spa",
  phone: "+918109750539",
  whatsapp: "+918109750539",
  email: "purplespasalon23@gmail.com",
  address: "SF 14, Second Floor, Mansarovar Complex, C Block, Maharana Pratap Nagar, Bhopal, Madhya Pradesh 462016",
  maps_query: "6CGP+36 Bhopal, Madhya Pradesh",
  instagram_url: null,
  timezone: "Asia/Kolkata",
  open_time: "10:00:00",
  close_time: "20:30:00",
  slot_interval_min: 30,
  buffer_min: 10,
  booking_window_days: 30,
  min_lead_min: 60,
  bed_count: 5,
  chair_count: 2,
  allow_gender_preference: true,
  cancellation_hours: 2,
  payment_modes: ["full", "partial", "pay_at_spa"],
  advance_percent: 30,
  auto_assign: true,
  payment_hold_min: 15,
  staff_early_start_min: 0,
};

function fallback(): Catalog {
  return { categories: fallbackCategories as unknown as CatalogCategory[], settings: DEFAULT_SETTINGS, fallback: true };
}

/**
 * Active menu + business settings. Cached and tagged so the admin panel can refresh it
 * instantly after an edit (see /api/admin/revalidate).
 */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  if (!supabaseConfigured) return fallback();
  try {
    const db = supabasePublic();
    const [cats, svcs, settings] = await Promise.all([
      db.from("service_categories").select("*").eq("is_active", true).order("sort"),
      db.from("services").select("*, service_variants(*)").eq("is_active", true).order("sort"),
      db.from("settings").select("*").eq("id", 1).single(),
    ]);
    if (cats.error || svcs.error || settings.error) return fallback();

    const services = (svcs.data as Service[]).map((s) => ({
      ...s,
      service_variants: s.service_variants.filter((v) => v.is_active).sort((a, b) => a.duration_min - b.duration_min),
    }));
    const categories = (cats.data as Category[])
      .map((c) => ({ ...c, services: services.filter((s) => s.category_id === c.id && s.service_variants.length) }))
      .filter((c) => c.services.length);
    return { categories, settings: settings.data as Settings, fallback: false };
  } catch {
    return fallback();
  }
}
