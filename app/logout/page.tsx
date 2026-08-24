"use client";

/**
 * A page rather than a GET route, so signing out always takes a deliberate
 * click. A link that logs you out can be fired by an image tag on someone
 * else's site.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { browserClient } from "@/lib/supabase/browser";

export default function LogoutPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    await browserClient()?.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">Settle up?</h1>
      <p className="mt-3 text-text-mid">
        Logging out keeps your record. You will just be a guest again until you log back in.
      </p>
      <Card className="mt-6">
        <Button onClick={onClick} disabled={busy}>
          {busy ? "Closing the tab" : "Log out"}
        </Button>
      </Card>
    </div>
  );
}
