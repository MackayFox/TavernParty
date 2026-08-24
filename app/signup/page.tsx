"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorNote, Field, Input, Sheet } from "@/components/ui";
import { browserClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That did not work.");

      // The signup call may or may not have produced a session, depending on
      // whether email confirmation is on. Try to log in; if that fails, the
      // account exists and is waiting on a confirmation click.
      const supabase = browserClient();
      const signedIn =
        supabase &&
        !(await supabase.auth.signInWithPassword({ email: email.trim(), password })).error;
      if (signedIn) {
        router.push("/history");
        router.refresh();
        return;
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!browserClient()) {
    return (
      <div className="mx-auto w-full max-w-xl py-8">
        <Sheet title="No accounts yet" subtitle="The ledger is closed">
          <p className="text-paper-ink">
            Accounts are not switched on here. Guest play covers every game on the site.
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

  if (done) {
    return (
      <div className="mx-auto w-full max-w-xl py-8">
        <Sheet title="Check your email" subtitle="Almost in">
          <p className="text-paper-ink">
            The name <strong>{username}</strong> is yours. There is a confirmation link waiting in
            your inbox. Click it, then come back and log in.
          </p>
          <p className="mt-3">
            <Link href="/login" className="text-paper-ink underline">
              Go to the login page
            </Link>
          </p>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md py-8">
      <p className="label-caps">The ledger</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Get a name in the book
      </h1>
      <p className="mt-3 text-text-mid">
        Optional, and always will be. An account keeps your streaks and your runs when you switch
        devices. That is the whole of it.
      </p>

      <Card className="mt-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Name at the table" hint="Letters, numbers and underscores. 3 to 20.">
            <Input
              autoComplete="username"
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]{3,20}"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="grimsby_pete"
            />
          </Field>
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
          <Field label="Password" hint="Eight characters at least.">
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorNote message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Writing you in" : "Make the account"}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-sm text-text-mid">
        Already have one?{" "}
        <Link href="/login" className="text-accent underline">
          Log in
        </Link>
        .
      </p>
    </div>
  );
}
