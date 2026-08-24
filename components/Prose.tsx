import { JsonLd } from "./JsonLd";

/** Shared shell for text pages: about, legal, how it works, SEO landers. */
export function Prose({
  title,
  intro,
  children,
  wide = false,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <article className={`mx-auto w-full py-8 ${wide ? "max-w-3xl" : "max-w-2xl"}`}>
      <h1 className="font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
        {title}
      </h1>
      {intro ? <p className="mt-3 text-lg text-text-mid">{intro}</p> : null}
      <div className="mt-6 flex flex-col gap-4 leading-relaxed text-text-mid [&_a]:text-accent [&_a]:underline [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-tight [&_h2]:text-text-hi [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-text-hi [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-text-hi [&_table]:w-full [&_td]:border-t [&_td]:border-border-dim [&_td]:py-2 [&_th]:pb-2 [&_th]:text-left [&_th]:text-text-hi">
        {children}
      </div>
    </article>
  );
}

/** FAQ block that also emits FAQPage structured data. */
export function Faq({ items }: { items: { q: string; a: React.ReactNode; plain: string }[] }) {
  return (
    <>
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.q}>
            <h3>{item.q}</h3>
            <div className="mt-1">{item.a}</div>
          </div>
        ))}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((i) => ({
            "@type": "Question",
            name: i.q,
            acceptedAnswer: { "@type": "Answer", text: i.plain },
          })),
        }}
      />
    </>
  );
}
