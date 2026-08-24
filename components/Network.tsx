import { OTHER_SITES } from "@/lib/content/network";

/**
 * Links out to the rest of the network.
 *
 * A section near the foot of the home page rather than a sitewide banner. A block
 * of reciprocal external links on every page of every site is the shape search
 * engines discount, and it is not what anybody wants above a game either. The
 * footer carries the same links in a column, which is enough.
 */
export function Network({ className = "" }: { className?: string }) {
  if (OTHER_SITES.length === 0) return null;
  return (
    <section className={`border-t border-border-dim pt-8 ${className}`}>
      <h2 className="font-display text-xl font-bold text-text-hi">
        More from the same crowd
      </h2>
      <p className="mt-1 text-text-mid">
        A few other small browser games by us. Nothing to install, no accounts, all free.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {OTHER_SITES.map((site) => (
          <li key={site.id}>
            <a
              href={site.url}
              // Not nofollow: a handful of genuinely related games, recommended
              // because they are worth playing. If the network ever grows into a
              // farm, revisit that.
              rel="noopener"
              className="flex min-h-16 items-center gap-3 rounded-lg border border-border-dim bg-bg-1 px-4 py-3 transition-colors hover:border-accent/50 hover:bg-bg-2"
            >
              <span className="text-2xl leading-none" aria-hidden>
                {site.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block font-bold text-text-hi">{site.name}</span>
                <span className="block text-sm text-text-mid">{site.tagline}</span>
              </span>
              <span className="text-text-low" aria-hidden>
                ›
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
