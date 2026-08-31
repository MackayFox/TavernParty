/**
 * The desk, plus the writing that explains what the desk is for.
 *
 * `WriteIndex` is a client component and it is mostly a button and a list of
 * your own drafts, which on a first visit is a pitch and an empty state. That is
 * not a page. Everything below is checkable against `lib/campaign/gate.ts`, and
 * the caps are imported from it rather than typed out, so a cap that moves moves
 * here too.
 *
 * It sits below the desk because `WriteIndex` owns the h1 and the button is what
 * somebody came for.
 */
import type { Metadata } from "next";
import Link from "next/link";
import {
  MAX_CALLINGS,
  MAX_FLOORS,
  MAX_KIT,
  MIN_CALLINGS,
  MIN_FLOORS,
  MIN_KIT,
} from "@/lib/campaign/gate";
import { WriteIndex } from "./WriteIndex";

export const metadata: Metadata = {
  title: "Write a Dungeon: Build One People Can Play",
  description:
    "Build a small dungeon crawl and a solver tells you the truth before you publish: whether anybody gets out, what par is, and which door nobody would take.",
  alternates: { canonical: "/write" },
  openGraph: {
    title: "Write a Dungeon Other People Can Play",
    description:
      "Pick some floors, set what they may bring, and a solver tells you whether it is a dungeon or a lock before anybody else sees it.",
    url: "/write",
  },
};

export default function Page() {
  return (
    <>
      <WriteIndex />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-12">
        <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
          <h2 className="font-display text-2xl font-bold text-text-hi">
            What the desk checks, and when
          </h2>
          <p className="prose-read text-text-mid">
            Two passes, and they run at different speeds because they cost
            different amounts. The first is instant and fires on every keystroke: it counts
            your floors, reads your doors and looks for things that are wrong on their face. A
            floor with no name. A floor with only one way to try it. A check with no number to
            beat. Two doors on one floor sharing an id, which sounds like pedantry and is not:
            the runner resolves a submitted move by finding the first match, so a duplicate id
            means the wrong door opens.
          </p>
          <p className="prose-read text-text-mid">
            The second pass is the solver, and it is the expensive one, so it only runs when
            something that can move par has changed. Prose cannot move par. You can rewrite
            every sentence in the dungeon all afternoon and it will not solve once, which is
            deliberate: writing is what an author is doing most of the time. Change a target
            number, a price, a mark or the shelf, and it goes again.
          </p>
          <p className="prose-read text-text-mid">
            What it does then is enumerate every distinct character your settings allow, play
            each one perfectly all the way down, and report what happened. It can do that
            exactly, with no sampling and no guesswork, because every room throws its die before
            the player picks a door. There is no probability in the problem, so the best line
            for a given character is a walk rather than an expectation. That is the whole reason
            this feature exists: a level editor that can tell you your level is impossible is a
            rare thing, and it is only possible here by accident of the engine.
          </p>
          <p className="prose-read text-text-mid">
            The caps exist to keep that honest rather than to be tidy. {MIN_FLOORS} to{" "}
            {MAX_FLOORS} floors, {MIN_CALLINGS} to {MAX_CALLINGS} Callings allowed, and{" "}
            {MIN_KIT} to {MAX_KIT} things on the shelf. They were measured, not chosen: at the
            top of that range a dungeon solves in about a quarter of a second, and letting
            everything through would take several seconds, which is a desk that feels broken
            while it thinks.
          </p>
        </section>

        <section className="flex flex-col gap-4 border-t border-border-dim pt-8">
          <h2 className="font-display text-2xl font-bold text-text-hi">
            What a rejected dungeon looks like
          </h2>
          <p className="prose-read text-text-mid">
            Almost nothing is rejected. A block is kept for a dungeon that is not a dungeon, and
            there are four ways to write one.
          </p>
          <p className="prose-read text-text-mid">
            <strong className="text-text-hi">Nobody gets out.</strong> The best character you
            allow, playing perfectly, runs out of Vigour on a floor the report names for you.
            That is usually a pricing problem two floors above the one you are staring at.
          </p>
          <p className="prose-read text-text-mid">
            <strong className="text-text-hi">Only one or two kinds of person get out.</strong>{" "}
            That is a lock rather than a dungeon: you have not written a challenge, you have
            written a key and a keyhole, and everybody who does not happen to be carrying the
            key has an unwinnable evening.
          </p>
          <p className="prose-read text-text-mid">
            <strong className="text-text-hi">A door that can never open.</strong> Marks are the
            things a floor leaves on you, and a lower floor can ask about them. Put a door on
            floor four that wants the lamp, and hand the lamp out nowhere above floor four, and
            you have written dead content. Neither floor looks wrong on its own, which is why
            this one is worth a machine.
          </p>
          <p className="prose-read text-text-mid">
            <strong className="text-text-hi">A floor with no way through.</strong> Every floor
            needs one door that always works and always costs, and at least one of those has to
            be open to everybody. Gate the checks all you like. Gate the guaranteed door and
            somebody arrives carrying nothing, meets two checks they can fail and a door that
            will not open, and stops. A floor is a price, never a wall.
          </p>
          <p className="prose-read text-text-mid">
            Everything else warns and publishes anyway. You will be told when one door on a
            floor is taken by everybody and the others are furniture, when a Calling has quietly
            become a requirement instead of a choice, when a mark is handed out that no door
            ever reads, and when nine tenths of the people you allow stroll out of it. None of
            that stops you. A brutal dungeon is sometimes the point, and a validator that
            refuses taste is a validator people learn to route around.
          </p>
          <p className="prose-read text-text-mid">
            The one thing you never get to choose is the difficulty word on the card. A walk,
            Fair, Stiff, Brutal, Barely possible: it is derived from how many of your allowed
            characters survive, so nobody can call a walkover brutal.{" "}
            <Link href="/dungeons" className="text-accent underline">
              The Hall explains how the rest of the card is worked out
            </Link>
            , and{" "}
            <Link href="/daily/deeprun" className="text-accent underline">
              tonight&apos;s official dungeon
            </Link>{" "}
            is the same engine if you would rather play one before writing one.
          </p>
        </section>
      </div>
    </>
  );
}
