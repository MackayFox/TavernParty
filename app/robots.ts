import type { MetadataRoute } from "next";
import { DISALLOWED } from "@/app/crawl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The list is in app/crawl.ts because the pages that link to these paths
      // have to nofollow them, and they should not be importing a route file.
      disallow: DISALLOWED,
    },
    sitemap: "https://tavernparty.co.uk/sitemap.xml",
  };
}
