import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://roadie.mymymy.studio";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/biz-admin", "/signin", "/claim", "/vendor-shoot"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
