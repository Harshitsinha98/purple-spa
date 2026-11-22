import type { MetadataRoute } from "next";

/** Installable app for staff (opens straight into the schedule). Customers can install it too. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Purple Spa — Staff & Bookings",
    short_name: "Purple Spa",
    description: "Bookings for The Purple Skin Friendly Salon and Spa, Bhopal",
    start_url: "/staff",
    scope: "/",
    display: "standalone",
    background_color: "#140a1b",
    theme_color: "#140a1b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
