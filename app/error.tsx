"use client";

import { useEffect } from "react";
import { Button, Sheet } from "@/components/ui";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16">
      <Sheet title="The candle went out" subtitle="Something on our side, not yours">
        <p className="text-paper-ink">
          We lost the thread. Nothing you did caused it and nothing of yours is gone. Try
          again, and if it happens twice in a row it is worth telling us.
        </p>
      </Sheet>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
