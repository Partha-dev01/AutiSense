import type { MetadataRoute } from "next";

const BASE = "https://autisense.imaginaerium.in";

// Only genuinely public, indexable routes belong here. The intake flow,
// kid-dashboard, parent dashboard, feed, auth and API routes are gated/dynamic
// and are excluded (and disallowed in robots.ts) — keeping the sitemap honest
// avoids "indexed sitemap URL blocked by robots" warnings.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE}/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
  ];
}
