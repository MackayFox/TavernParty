"use client";

/**
 * THE DOOR. Where a shared link lands, and where the run is played.
 *
 * One page, not two: the door and the descent are the same screen, because a
 * link that lands on a page whose only control is another link has spent the
 * click it was given.
 *
 * The run itself is `DeepRunGame`, unchanged, pointed at a dungeon instead of a
 * date. That reuse is the whole point of the feature and it is why this file is
 * short.
 */
import { useState } from "react";
import Link from "next/link";
import { Button, Card, Pill } from "@/components/ui";
import { DeepRunGame } from "@/app/daily/deeprun/DeepRunGame";

type DoorInfo = {
  code: string;
  title: string;
  intro: string;
  author: string;
  floors: number;
  par: number | null;
  difficulty: string | null;
  baseVigour: number;
  callings: number;
  kit: number;
  plays: number;
  finishes: number;
};

export function Door({ door }: { door: DoorInfo }) {
  const [down, setDown] = useState(false);

  if (down) return <DeepRunGame date={null} dungeon={door.code} />;

  const share = door.plays > 0 ? Math.round((door.finishes / door.plays) * 100) : null;

  return (
    <section className="mx-auto w-full max-w-2xl py-8">
      <p className="label-caps">
        <span aria-hidden>🕯️ </span>
        Somebody else&rsquo;s dungeon
      </p>
      <h1 className="font-display mt-1 text-3xl font-bold uppercase text-text-hi sm:text-4xl">
        {door.title}
      </h1>
      <p className="mt-1 text-text-mid">by {door.author}</p>

      {door.intro && <p className="prose-read mt-4">{door.intro}</p>}

      <Card className="mt-5">
        <p className="label-caps">The rules of this one</p>
        <ul className="mt-2 space-y-1 text-text-hi">
          <li>
            {door.floors} floors, and something at the bottom of them.
          </li>
          <li>
            {door.callings} Callings on the table. {door.kit} things on the shelf, and you take
            two.
          </li>
          <li>
            Vigour {door.baseVigour}
            {door.baseVigour === 9 ? ", which is standard" : door.baseVigour > 9 ? ", which is generous" : ", which is thin"}.
          </li>
          <li>
            Every room owns its die, and you only see the number once you are in the room. The
            same dungeon, and the same dice, for everybody who opens this link.
          </li>
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {door.difficulty && <Pill tone="accent">{door.difficulty}</Pill>}
          {door.par !== null && (
            <span className="num text-sm text-text-mid">Par {door.par}</span>
          )}
          {share !== null && (
            <span className="num text-sm text-text-mid">
              {share}% of {door.plays} got out
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-text-low">
          The difficulty was worked out by playing every character this dungeon allows, not
          claimed by whoever wrote it.
        </p>

        <Button size="lg" className="mt-4" onClick={() => setDown(true)}>
          Go down
        </Button>
      </Card>

      <p className="mt-6 text-sm text-text-mid">
        <Link href="/daily/deeprun" className="text-accent underline">
          Tonight&rsquo;s official one
        </Link>{" "}
        is a different dungeon, and{" "}
        <Link href="/write" className="text-accent underline">
          you can write your own
        </Link>
        .
      </p>
    </section>
  );
}
