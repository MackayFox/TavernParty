import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * ONE CANONICAL HOSTNAME, AND ONLY ONE PLACE DECIDES WHICH.
   *
   * Serving both the apex and www with a 200 is two complete copies of the site
   * competing with each other, and on a new domain with no canonical signal that
   * is a good way to have neither indexed. So exactly one host answers 200 and
   * the other 308s to it.
   *
   * That redirect used to live here, pointing www at the apex. It was removed
   * because Vercel's own project-domain setting was pointing the apex at www at
   * the same time, and the two of them made an infinite loop: the domain served
   * nothing at all, on every path, while every canonical tag and every sitemap
   * entry pointed into it. It took a crawl of the live site to notice, because
   * the vercel.app URL was fine the whole time.
   *
   * Host canonicalisation now belongs to Vercel alone (Project, Domains: one
   * domain is primary, the other redirects to it) and this file does not have an
   * opinion. If you ever want the apex back as the canonical host, it is that
   * setting plus `CANONICAL_ORIGIN` in `lib/site.ts`, and nothing else.
   */
  /**
   * Keep the forms and the private pages out of the index.
   *
   * A header rather than page metadata, because these pages are client
   * components and a client component cannot export metadata. Google treats
   * X-Robots-Tag exactly as it treats the meta tag. `follow` so links out of
   * them still carry weight.
   */
  async headers() {
    return [
      {
        source: "/(login|logout|signup|forgot-password|reset-password|history)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
    ];
  },
  webpack: (config) => {
    // Tooling writes logs into the repo; don't let the dev watcher rebuild on them.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.playwright-mcp/**", "**/.git/**"],
    };
    return config;
  },
};

export default nextConfig;
