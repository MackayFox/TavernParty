import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * One canonical hostname.
   *
   * Serving both the apex and www with a 200 is two complete copies of the site
   * competing with each other, and on a new domain with no canonical signal that
   * is a good way to have neither indexed. Learned the slow way on the other two
   * sites; built in here from the start.
   */
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.tavernparty.com" }],
        destination: "https://tavernparty.com/:path*",
        permanent: true,
      },
    ];
  },
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
