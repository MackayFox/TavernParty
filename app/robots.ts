import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Tables are ephemeral and private by obscurity, and the API is not a page.
      // Neither belongs in an index.
      disallow: ["/api/", "/room/"],
    },
    sitemap: "https://tavernparty.co.uk/sitemap.xml",
  };
}
