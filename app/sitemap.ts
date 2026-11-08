import type { MetadataRoute } from "next";

// Public pages only; signed-in tools (garage, admin, studio) stay out.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://roadie.mymymy.studio";
const PAGES = ["", "community", "venues", "map", "tour", "host", "roadietv", "localjam", "festivals", "discover",
  "sponsors", "advertising", "membership", "wire", "crossing", "regions"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(p => ({ url: `${SITE}/${p}`, changeFrequency: "weekly", priority: p ? 0.7 : 1 }));
}
