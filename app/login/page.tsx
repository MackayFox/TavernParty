"use client";

/** Optional. Everything on this site works without it. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorNote, Field, Input, Sheet } from "@/components/ui";
import { browserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = browserClient();
    if (!supabase) return;
    if (!email.trim() || !password) {
      setError("Both boxes, please.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError(authError.message);
      setBusy(false);
      return;
    }
    router.push("/history");
    router.refresh();
  }

  if (!browserClient()) {
    return (
      <div className="mx-auto w-full max-w-xl py-8">
        <Sheet title="No accounts yet" subtitle="The ledger is closed">
          <p className="text-paper-ink">
            Accounts are not switched on here, so there is nothing to log in to. Guest play covers
            every game on the site. The only thing you give up is a record that follows you between
            devices.
          </p>
          <p className="mt-3">
            <Link href="/" className="text-paper-ink underline">
              Back to the tavern
            </Link>
          </p>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md py-8">
      <p className="label-caps">The ledger</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Log in</h1>
      <p className="mt-3 text-text-mid">
        Behind this form: your daily streaks, every run you have played and your line on the board of
        Hoards.
      </p>

      <Card className="mt-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorNote message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Checking" : "Log in"}
          </Button>
        </form>
      </Card>

      <div className="mt-6 flex flex-col gap-2 text-sm text-text-mid">
        <p>
          No account?{" "}
          <Link href="/signup" className="text-accent underline">
            Make one
          </Link>
          . Twenty seconds, no approval needed.
        </p>
        <p>
          Or{" "}
          <Link href="/" className="text-accent underline">
            play as a guest
          </Link>
          . Everything works, nothing is written down.
        </p>
      </div>
    </div>
  );
}
