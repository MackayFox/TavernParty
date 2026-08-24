/**
 * Structured data. Content is always developer-authored, but `<` is still
 * escaped so a future dynamic value can never close the script tag and turn
 * metadata into an injection point.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
