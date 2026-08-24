import Link from "next/link";
import { Sheet } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16">
      <Sheet title="No such door" subtitle="The map disagrees with you">
        <p className="text-paper-ink">
          There is nothing down here. Either the link was mistyped, or whatever used to be at
          this address has been rolled up and put behind the bar.
        </p>
      </Sheet>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="font-display inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-ink hover:bg-accent-hover"
        >
          Back to the tavern
        </Link>
        <Link
          href="/daily"
          className="font-display inline-flex min-h-11 items-center rounded-md border border-border-strong bg-bg-2 px-5 font-medium text-text-hi hover:bg-bg-3"
        >
          Today&apos;s puzzles
        </Link>
      </div>
    </div>
  );
}
