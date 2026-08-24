"use client";

/**
 * ACT_RESULT. The most important render in the game.
 *
 * Never a bare total. Every roll is printed as the named parts that made it, in
 * the order the engine put them in, then the sum, then the number it had to
 * beat, then one sentence of what happened. Your own ledger is on paper because
 * it is yours; everybody else's is on the dark table.
 */
import { useState } from "react";
import { Avatar, Button, Die, Pill, Sheet } from "@/components/ui";
import { BLOODS } from "@/lib/content/bloods";
import { SCENES_BY_ID } from "@/lib/content/scenes";
import {
  ABILITY_LABEL,
  ASHKIN_DREAD,
  EMBERKIN_RENOWN,
  HIDE_SCAR_RENOWN,
  KEEP_SCAR_DREAD,
  KEPT_SCAR_VALUE,
  SIGNATURE_CLEAR_DREAD,
  SIGNATURE_OATH_RENOWN,
} from "@/lib/game/rules";
import { ABILITIES, type Ability, type Outcome, type Scores } from "@/lib/game/types";
import { CALLING_BY_ID, meOf, nameOf, signed, type PhaseProps } from "./shared";

const BLOOD_BY_ID = new Map(BLOODS.map((b) => [b.id, b]));

export function ActResult({ view, post, busy }: PhaseProps) {
  const act = view.act;
  const scene = act ? SCENES_BY_ID[act.sceneId] : undefined;
  const me = meOf(view);
  if (!act || !scene || !act.outcomes) return null;

  const outcomes = act.outcomes;
  const mine = outcomes.find((o) => o.playerId === view.me.id);
  const others = outcomes.filter((o) => o.playerId !== view.me.id);
  const taken = new Set(outcomes.map((o) => o.approachId));
  const untaken = scene.approaches.filter((a) => !taken.has(a.id));
  const openScar = view.me.scars.find((s) => s.kept === null);
  const decided = view.me.scars.filter((s) => s.kept !== null);

  function approachLabel(outcome: Outcome): string {
    if (outcome.approachId === "flinch") return "Did not move";
    return scene?.approaches.find((a) => a.id === outcome.approachId)?.label ?? "Something else";
  }

  function sentence(outcome: Outcome): string {
    if (outcome.approachId === "flinch")
      return "You could see the whole thing and you stayed where you were.";
    const approach = scene?.approaches.find((a) => a.id === outcome.approachId);
    if (!approach) return "";
    return outcome.success ? approach.win : approach.lose;
  }

  return (
    <div className="phase-in space-y-6">
      <header>
        <p className="label-caps">Act {act.index}</p>
        <h2 className="font-display text-2xl text-text-hi">{scene.title}</h2>
      </header>

      {mine && (
        <Sheet title={me?.name ?? "You"} subtitle={approachLabel(mine)}>
          <LedgerBody outcome={mine} sentence={sentence(mine)} onPaper />
          {/*
            The whetstone and the spare bowstring advertise "2 rerolls" on the
            card you rank them on. For a while that is all they did: only torch
            charges were honoured, so a player who drafted the whetstone for its
            rerolls went looking for a button that was never built.
          */}
          {(me?.rerolls ?? 0) > 0 &&
            mine.approachId !== "flinch" &&
            (!mine.scar ||
              view.me.scars.some((s) => s.id === mine.scar!.id && s.kept === null)) && (
              <div className="mt-4 border-t border-paper-rule pt-3">
                <p className="text-sm text-paper-ink">
                  Your gear will buy you another throw. You keep the second one, whatever it
                  is, and you have {me?.rerolls} left.
                </p>
                <Button
                  variant="secondary"
                  className="mt-2"
                  disabled={busy}
                  onClick={() => void post("/reroll")}
                >
                  Throw it again
                </Button>
              </div>
            )}
        </Sheet>
      )}

      {openScar && (
        <Sheet subtitle="You are carrying something out of this" title="The Scar">
          <p className="text-sm text-paper-ink">{openScar.label}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sheet-box p-3">
              <p className="sheet-label">Keep it</p>
              <p className="mt-1 text-sm text-paper-ink">
                Public, and everybody can see it. Worth {KEPT_SCAR_VALUE} at the Ballad, but
                only if your Renown ends at or above the middle of the table. It puts{" "}
                {KEEP_SCAR_DREAD} Dread on the whole party.
              </p>
              <Button
                className="mt-2 w-full"
                disabled={busy}
                onClick={() => void post("/scar", { scarId: openScar.id, keep: true })}
              >
                Wear it
              </Button>
            </div>
            <div className="sheet-box p-3">
              <p className="sheet-label">Hide it</p>
              <p className="mt-1 text-sm text-paper-ink">
                Private. Nobody at the table finds out. It costs you {HIDE_SCAR_RENOWN} Renown
                now and pays nothing later.
              </p>
              <Button
                variant="secondary"
                className="mt-2 w-full"
                disabled={busy}
                onClick={() => void post("/scar", { scarId: openScar.id, keep: false })}
              >
                Say nothing
              </Button>
            </div>
          </div>
          <p className="sheet-label mt-3">
            Decide nothing and it is hidden for you when the window closes, which costs you
            the Renown anyway.
          </p>
        </Sheet>
      )}

      <SignatureCall view={view} post={post} busy={busy} outcome={mine} />
      {mine && <BloodCall view={view} post={post} busy={busy} outcome={mine} />}

      {!openScar && decided.length > 0 && (
        <p className="text-sm text-text-mid">
          {decided.filter((s) => s.kept).length} Scar
          {decided.filter((s) => s.kept).length === 1 ? "" : "s"} worn where the table can see
          them, {decided.filter((s) => !s.kept).length} said nothing about.
        </p>
      )}

      {others.length > 0 && (
        <section aria-label="Everybody else" className="space-y-3">
          <h3 className="label-caps">The rest of the table</h3>
          {others.map((outcome) => (
            <article
              key={outcome.playerId}
              className="rounded-lg border border-border-dim bg-bg-1 p-4"
            >
              <header className="flex flex-wrap items-center gap-2">
                <Avatar id={outcome.playerId} name={nameOf(view, outcome.playerId)} size={28} />
                <span className="font-display text-text-hi">
                  {nameOf(view, outcome.playerId)}
                </span>
                <span className="text-sm text-text-mid">{approachLabel(outcome)}</span>
                <Pill tone={outcome.success ? "success" : "danger"}>
                  {outcome.success ? "Made it" : "Did not"}
                </Pill>
              </header>
              <LedgerBody outcome={outcome} sentence={sentence(outcome)} />
            </article>
          ))}
        </section>
      )}

      {Object.keys(act.nominations).length > 0 && (
        <section aria-label="Who sent whom" className="space-y-1">
          <h3 className="label-caps">Nominations, now that it is over</h3>
          <ul className="space-y-1 text-sm text-text-mid">
            {Object.entries(act.nominations).map(([nominator, nominee]) => {
              const result = outcomes.find((o) => o.playerId === nominee);
              return (
                <li key={nominator}>
                  {nameOf(view, nominator)} put {nameOf(view, nominee)} forward, and{" "}
                  {result?.success
                    ? "took half the credit for it."
                    : "paid for it when it went wrong."}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {untaken.length > 0 && (
        <section aria-label="What nobody took" className="space-y-2">
          <h3 className="label-caps">Nobody went this way</h3>
          <ul className="space-y-2">
            {untaken.map((approach) => (
              <li
                key={approach.id}
                className="rounded-md border border-dashed border-border-strong px-3 py-2"
              >
                <p className="font-display text-text-hi">
                  {approach.label}
                  {approach.reckless ? " (the Reckless line)" : ""}
                </p>
                <p className="num text-sm text-text-mid">
                  {ABILITY_LABEL[approach.ability]} · needed {approach.tn} · paid{" "}
                  {approach.deed} Renown
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Your Signature, for the six Callings whose one is an answer to a result.
 *
 * The Chanter's and the Reckoner's are on the Act screen instead, because those
 * two are declared before the die. Rendered only when it can actually be spent,
 * with what it will do to this specific Act stated in numbers rather than in the
 * abstract, and it never appears at all once it is gone.
 */
function SignatureCall({
  view,
  post,
  busy,
  outcome,
}: PhaseProps & { outcome: Outcome | undefined }) {
  const me = meOf(view);
  const calling = me?.callingId ? CALLING_BY_ID.get(me.callingId) : undefined;
  const act = view.act;
  const scene = act ? SCENES_BY_ID[act.sceneId] : undefined;
  const [targetId, setTargetId] = useState("");
  const [doorId, setDoorId] = useState("");

  if (!me || !calling || me.usedSignature || !act?.outcomes || !scene) return null;
  const kind = calling.signature.kind;
  const outcomes = act.outcomes;
  const others = view.players.filter((p) => p.id !== me.id);

  // Who or what this Signature could be pointed at, and therefore whether it is
  // callable at all right now.
  const wins = outcomes.filter((o) => o.playerId !== me.id && o.success && o.renownDelta > 0);
  const wounded = others.filter((p) => p.scars.some((s) => s.kept === null));
  const dreadThisAct = outcomes.reduce((t, o) => t + Math.max(0, o.dreadDelta), 0);
  const myScarUndecided = me.scars.some((s) => s.kept === null);
  const otherDoors = scene.approaches.filter((a) => a.id !== outcome?.approachId);

  let detail: string;
  let ready = true;
  switch (kind) {
    case "rerollOwn":
      detail =
        "Throw your die again for the line you took, and live with the second one. It has to be before you decide what to do with the wound: once that is settled, the table has seen it.";
      // A real roll to throw again, and if it left a wound that wound must still
      // be undecided, because taking a settled Scar back out would silently
      // reverse a Dread charge everybody has already read.
      ready = !!outcome && outcome.approachId !== "flinch" && (!outcome.scar || myScarUndecided);
      break;
    case "shieldParty":
      detail = `Take all ${dreadThisAct} Dread this Act put on the party straight back off it. Not just yours: everybody's.`;
      ready = dreadThisAct > 0;
      break;
    case "clearDread":
      detail = `Take ${SIGNATURE_CLEAR_DREAD} Dread off the party. It is ${view.dread} now, so it would be ${Math.max(0, view.dread - SIGNATURE_CLEAR_DREAD)}.`;
      ready = view.dread > 0;
      break;
    case "stealDeed":
      detail =
        "Take half the credit for somebody else's win. It costs them nothing: the story grows in the telling and you are in it now.";
      ready = wins.length > 0;
      break;
    case "takeScarFor":
      detail = `Carry somebody else's wound out of here on your own body. It arrives undecided, and you take ${SIGNATURE_OATH_RENOWN} Renown for the saying.`;
      ready = wounded.length > 0;
      break;
    case "secondApproach":
      detail =
        "One way in shut in your face, so try another. A second roll is a second chance at the Deed and a second chance at the wound.";
      ready = !!outcome && !outcome.success && otherDoors.length > 0;
      break;
    default:
      return null; // The two bets live on the Act screen.
  }

  if (!ready) return null;

  const body =
    kind === "stealDeed" || kind === "takeScarFor" ? (
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        aria-label={kind === "stealDeed" ? "Whose win" : "Whose wound"}
        className="min-h-11 rounded-md border border-paper-rule bg-paper px-3 py-2 text-paper-ink"
      >
        <option value="">Choose somebody</option>
        {(kind === "stealDeed"
          ? wins.map((w) => ({ id: w.playerId, name: nameOf(view, w.playerId) }))
          : wounded.map((p) => ({ id: p.id, name: p.name }))
        ).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    ) : kind === "secondApproach" ? (
      <select
        value={doorId}
        onChange={(e) => setDoorId(e.target.value)}
        aria-label="Which other way in"
        className="min-h-11 rounded-md border border-paper-rule bg-paper px-3 py-2 text-paper-ink"
      >
        <option value="">Choose a door</option>
        {otherDoors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
            {a.reckless ? " (Reckless)" : ""}
          </option>
        ))}
      </select>
    ) : null;

  const needsChoice =
    (kind === "stealDeed" || kind === "takeScarFor") ? !targetId : kind === "secondApproach" ? !doorId : false;

  return (
    <Sheet title={calling.signature.label} subtitle="Your Signature, once a night">
      <p className="text-sm text-paper-ink">{detail}</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {body}
        <Button
          className="ml-auto"
          disabled={busy || needsChoice}
          onClick={() =>
            void post("/signature", {
              ...(targetId ? { targetId } : {}),
              ...(doorId ? { approachId: doorId } : {}),
            })
          }
        >
          {needsChoice ? "Choose one first" : `Call ${calling.signature.label}`}
        </Button>
      </div>
      <p className="sheet-label mt-3">
        Once in the whole night. Nothing happens if you leave it.
      </p>
    </Sheet>
  );
}

/**
 * Calling on your Blood, for the three whose power is a decision.
 *
 * The other five fire on their own and are reported in the log instead, because
 * a prompt whose only sensible answer is yes is not a decision, it is a delay.
 * Shown only when it can actually be spent, and it says what it will cost the
 * table in the same breath as what it gives you.
 */
function BloodCall({
  view,
  post,
  busy,
  outcome,
}: PhaseProps & { outcome: Outcome }) {
  const me = meOf(view);
  const blood = me?.bloodId ? BLOOD_BY_ID.get(me.bloodId) : undefined;
  const [from, setFrom] = useState<Ability>("brawn");
  const [to, setTo] = useState<Ability>("wits");

  if (!me || !blood || me.usedBloodPower) return null;
  const kind = blood.power.kind;

  // Why the button is not there, when it is not there. Silence would read as a
  // bug to somebody who drafted the Blood for this.
  if (kind === "costToDread" && outcome.renownDelta >= 0) return null;
  if (kind === "dreadShield" && outcome.dreadDelta <= 0) return null;
  if (kind !== "costToDread" && kind !== "dreadShield" && kind !== "reassignOne") return null;

  const detail =
    kind === "costToDread"
      ? `Take back the ${-outcome.renownDelta} Renown that cost you, and put ${ASHKIN_DREAD} Dread on the party instead. Everyone pays a little, including the people who were not there.`
      : kind === "dreadShield"
        ? `Stop the ${outcome.dreadDelta} Dread this put on the party. The table thanks you for it: ${EMBERKIN_RENOWN} Renown.`
        : "Move two of your own numbers. Same six numbers, different places, now that you have seen what this night is asking for.";

  return (
    <Sheet title={blood.name} subtitle="Once a run, and this is the run">
      <p className="text-sm text-paper-ink">{detail}</p>

      {kind === "reassignOne" ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="sheet-label mb-1 block">Move this</span>
            <AbilityPicker value={from} onChange={setFrom} scores={me.scores} />
          </label>
          <span className="pb-2 text-paper-ink">and this</span>
          <label className="block">
            <span className="sheet-label mb-1 block">For this</span>
            <AbilityPicker value={to} onChange={setTo} scores={me.scores} />
          </label>
          <Button
            className="ml-auto"
            disabled={busy || from === to}
            onClick={() => void post("/blood", { swap: [from, to] })}
          >
            {from === to ? "Pick two different ones" : "Move them"}
          </Button>
        </div>
      ) : (
        <Button className="mt-4" disabled={busy} onClick={() => void post("/blood", {})}>
          Call on it
        </Button>
      )}

      <p className="sheet-label mt-3">
        You only get this once in the whole night. Nothing happens if you leave it.
      </p>
    </Sheet>
  );
}

function AbilityPicker({
  value,
  onChange,
  scores,
}: {
  value: Ability;
  onChange: (a: Ability) => void;
  scores: Scores | null;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Ability)}
      className="min-h-11 rounded-md border border-paper-rule bg-paper px-3 py-2 text-paper-ink"
    >
      {ABILITIES.map((a) => (
        <option key={a} value={a}>
          {ABILITY_LABEL[a]} {scores ? scores[a] : ""}
        </option>
      ))}
    </select>
  );
}

/**
 * The itemised ledger. One named line per modifier, then the sum, then the
 * target. A total never appears without the parts that made it.
 */
function LedgerBody({
  outcome,
  sentence,
  onPaper = false,
}: {
  outcome: Outcome;
  sentence: string;
  onPaper?: boolean;
}) {
  const flinched = outcome.approachId === "flinch";
  const ink = onPaper ? "text-paper-ink" : "text-text-hi";
  const quiet = onPaper ? "text-paper-ink-mid" : "text-text-mid";
  const rule = onPaper ? "border-paper-rule" : "border-border-dim";

  return (
    <div className="mt-2">
      {!flinched && (
        <div className="flex items-start gap-4">
          <Die face={outcome.roll} rolling size={52} />
          <dl className="min-w-0 flex-1">
            {outcome.mods.map((mod, i) => (
              <div key={`${mod.label}-${i}`} className={`flex items-baseline justify-between gap-3 border-b ${rule} py-1`}>
                <dt className={`text-sm ${quiet}`}>{mod.label}</dt>
                <dd className={`num text-sm ${ink}`}>{signed(mod.value)}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 py-1">
              <dt className={`label-caps ${onPaper ? "text-paper-ink-mid" : ""}`}>Total</dt>
              <dd className={`num text-lg ${ink}`}>{outcome.total}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className={`label-caps ${onPaper ? "text-paper-ink-mid" : ""}`}>Needed</dt>
              <dd className={`num text-lg ${ink}`}>{outcome.tn}</dd>
            </div>
          </dl>
        </div>
      )}
      <p className={`mt-2 text-base ${ink}`}>
        <strong className="font-display">
          {flinched ? "Flinched." : outcome.success ? "Made it." : "Did not make it."}
        </strong>{" "}
        {sentence}
      </p>
      <p className={`num mt-1 text-sm ${quiet}`}>
        {signed(outcome.renownDelta)} Renown
        {outcome.dreadDelta > 0 ? ` · +${outcome.dreadDelta} party Dread` : ""}
        {outcome.hookRefilled ? " · Hook tokens back to full" : ""}
      </p>
    </div>
  );
}
