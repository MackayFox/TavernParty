"use client";

/**
 * THREE SOUNDS, SYNTHESISED, NO FILES.
 *
 * A die landing, a door giving, and a door not giving. Adam asked for a sound on
 * the outcome and he is right that a dungeon crawl with no sound feels like a
 * form, but three audio files is three network requests, a licence question and a
 * cache-busting problem, for about two seconds of noise. Oscillators cost nothing
 * and ship as part of the bundle.
 *
 * THREE RULES, all of them about not being rude:
 *
 *   * Nothing is created until the first sound is asked for, which is always
 *     inside a click. Browsers refuse audio that starts on its own, and quite
 *     right too.
 *   * Muting is remembered. Somebody who turns it off has turned it off, not
 *     turned it off for this page.
 *   * A failure here is silence, never an error. Sound is decoration; the game is
 *     the game. Old browsers, blocked contexts and headless test runners all just
 *     get nothing.
 */

const STORE_KEY = "tp:sound";

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function soundOn(): boolean {
  try {
    return window.localStorage.getItem(STORE_KEY) !== "off";
  } catch {
    // Private mode, or storage disabled. Default to on rather than silent, so the
    // toggle in the corner still does what it says.
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    window.localStorage.setItem(STORE_KEY, on ? "on" : "off");
  } catch {
    /* nothing to do, and nothing worth telling anybody */
  }
}

/**
 * One note. `type` shapes it, and the envelope is what stops it clicking: a bare
 * gain of 1 switched on and off is an audible pop at both ends.
 */
function tone(
  at: number,
  freq: number,
  ms: number,
  type: OscillatorType,
  peak: number
): void {
  const audio = context();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  osc.connect(gain).connect(audio.destination);
  osc.start(at);
  osc.stop(at + ms / 1000 + 0.02);
}

function play(build: (audio: AudioContext, now: number) => void): void {
  if (!soundOn()) return;
  const audio = context();
  if (!audio) return;
  try {
    // Suspended is the normal state until a gesture resumes it.
    if (audio.state === "suspended") void audio.resume();
    build(audio, audio.currentTime);
  } catch {
    /* silence is an acceptable outcome for a sound effect */
  }
}

/** A die hitting stone. Two short clicks, the second quieter. */
export function playRoll(): void {
  play((_audio, now) => {
    tone(now, 190, 60, "square", 0.05);
    tone(now + 0.09, 150, 70, "square", 0.035);
    tone(now + 0.2, 120, 90, "triangle", 0.03);
  });
}

/** It gives. Up a fifth, which is the cheapest way to sound like good news. */
export function playCleared(): void {
  play((_audio, now) => {
    tone(now, 392, 110, "triangle", 0.06);
    tone(now + 0.1, 587, 220, "triangle", 0.055);
  });
}

/** It does not. Down a tone, and a low thud under it. */
export function playFailed(): void {
  play((_audio, now) => {
    tone(now, 233, 150, "sawtooth", 0.045);
    tone(now + 0.12, 175, 260, "sawtooth", 0.05);
    tone(now + 0.12, 70, 300, "sine", 0.07);
  });
}

/** Out alive. Three notes, and the only sound in the game that is pleased. */
export function playOut(): void {
  play((_audio, now) => {
    tone(now, 392, 120, "triangle", 0.055);
    tone(now + 0.12, 523, 120, "triangle", 0.055);
    tone(now + 0.26, 659, 320, "triangle", 0.06);
  });
}

/**
 * Something took a piece out of you. Two low sine notes, felt more than heard.
 *
 * Separate from `playFailed` because Vigour goes whether or not the door gave:
 * a brace always works and always costs, and that is still a hit.
 */
export function playHurt(): void {
  play((_audio, now) => {
    tone(now, 92, 220, "sine", 0.09);
    tone(now + 0.03, 62, 320, "sine", 0.07);
  });
}
