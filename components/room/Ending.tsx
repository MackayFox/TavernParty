"use client";

/**
 * BALLAD and FINAL.
 *
 * The Ballad is one secret toast, never for yourself. The standings are itemised
 * for the same reason the ledger is: a player should be able to see which part of
 * the night paid them and which part did not.
 */
import { AdSlot, Avatar, Button, Pill, Sheet } from "@/components/ui";
import { KEPT_SCAR_VALUE, LAUREL_VALUE } from "@/lib/game/rules";
import { meOf, nameOf, type PhaseProps } from "./shared";

export function Ballad({ view, post, busy }: PhaseProps) {
  const mine = view.me.laurelFor;
  const voted = view.players.filter((p) => p.hasVoted).length;
  return (
    <div className="phase-in space-y-6">
      <p className="prose-read">
        Somebody starts the song and everybody gets one line in it. A Laurel is worth{" "}
        {LAUREL_VALUE}, it is secret until the last second, and it cannot be for you.
        Whoever is out of the running still holds something the leaders want.
      </p>

      <section aria-label="Cast your Laurel" className="space-y-2">
        <h3 className="label-caps">Toast one of them</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {view.players
            .filter((p) => p.id !== view.me.id)
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={mine === p.id}
                  disabled={busy || !view.me.id}
                  onClick={() => void post("/laurel", { targetId: p.id })}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-md border px-3 text-left ${
                    mine === p.id
                      ? "border-accent bg-accent-dim"
                      : "border-border-strong bg-bg-1"
                  }`}
                >
                  <Avatar id={p.id} name={p.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="font-display block truncate text-text-hi">{p.name}</span>
                    <span className="block text-xs text-text-mid">
                      {p.renown} Renown · {p.scars.length} Scar
                      {p.scars.length === 1 ? "" : "s"} worn
                    </span>
                  </span>
                  {mine === p.id && (
                    <span className="text-sm text-accent">✓ yours</span>
                  )}
                </button>
              </li>
            ))}
        </ul>
        <p className="text-sm text-text-mid">
          {mine
            ? `You have toasted ${nameOf(view, mine)}. You can change it until the song ends.`
            : "Nobody yet."}{" "}
          {voted} of {view.players.length} have sung. Nobody sees who anybody voted for.
        </p>
        {/* The one phase whose deadline default is genuinely nothing, which is
            worth saying rather than leaving somebody to find out. */}
        <p className="text-sm text-text-low">
          Sing nothing and your Laurel goes nowhere. It is the only thing all night that
          costs you nothing to skip, and it is worth {LAUREL_VALUE} to somebody.
        </p>
      </section>
    </div>
  );
}

export function Final({ view, post, busy }: PhaseProps) {
  const me = meOf(view);
  const standings = view.standings ?? [];
  const winner = standings.find((s) => s.hoard);

  return (
    <div className="phase-in space-y-6">
      <header>
        <p className="label-caps">Last orders</p>
        <h2 className="font-display text-2xl text-text-hi sm:text-3xl">
          {winner ? `${winner.name} walks out with the lot` : "The night is over"}
        </h2>
        <p className="prose-read mt-2">
          The party survived together. One of you got paid. Kept Scars only pay if your
          Renown finished at or above the middle of the table, which is the whole reason
          hiding in the corner does not win.
        </p>
      </header>

      <ol className="space-y-3">
        {standings.map((row) => {
          const isMe = row.playerId === view.me.id;
          // Straight from the server, never derived by subtraction: see the note
          // on Standing.scarsPaid. A Scar kept with a Blood power pays whatever
          // your Renown, so the total does not tell you how many paid.
          const scarPay = row.scarsPaid * KEPT_SCAR_VALUE;
          const body = (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-lg">{row.placement}</span>
                <Avatar id={row.playerId} name={row.name} size={32} />
                <span className="font-display flex-1 truncate">{row.name}</span>
                {isMe && <span className="text-xs opacity-70">(you)</span>}
                {row.hoard &&
                  (isMe ? (
                    <span className="sheet-label">Takes the Hoard</span>
                  ) : (
                    <Pill tone="accent">Takes the Hoard</Pill>
                  ))}
                <span className="num text-xl">{row.total}</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-sm">
                <li>{row.renown} Renown earned</li>
                <li>
                  {row.keptScars} Scar{row.keptScars === 1 ? "" : "s"} worn
                  {row.keptScars === 0
                    ? ""
                    : row.scarsPaid === row.keptScars
                      ? `, paying ${scarPay}`
                      : row.scarsPaid > 0
                        ? `, and only ${row.scarsPaid} of them paid: ${scarPay}, off a Blood that does not care where you finished`
                        : ", paying nothing: below the middle of the table"}
                </li>
                <li>
                  {row.laurels} Laurel{row.laurels === 1 ? "" : "s"}
                  {row.laurels > 0 ? `, worth ${row.laurels * LAUREL_VALUE}` : ""}
                </li>
              </ul>
            </>
          );
          return (
            <li key={row.playerId}>
              {isMe ? (
                <Sheet className="max-w-none">{body}</Sheet>
              ) : (
                <div className="rounded-lg border border-border-dim bg-bg-1 p-4 text-text-hi">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {me?.isHost ? (
        <div className="space-y-2">
          <Button size="lg" disabled={busy} onClick={() => void post("/again")}>
            Another round
          </Button>
          <p className="text-sm text-text-mid">
            Everybody keeps their chair. New array, new draft, no memory of this one.
          </p>
        </div>
      ) : (
        // No clock on this screen and no button on it either, for everybody who
        // is not the host. Without a line here it reads as a page that has hung.
        me && (
          <p className="text-sm text-text-mid">
            Nothing is running now. {nameOf(view, view.players.find((p) => p.isHost)?.id ?? "")}{" "}
            can call another round, and your chair is held until they do.
          </p>
        )
      )}

      <AdSlot zone="room-final" className="pt-2" />
    </div>
  );
}
