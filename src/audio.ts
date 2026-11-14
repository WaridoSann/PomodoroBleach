let context: AudioContext | null = null;

export async function unlockAudio(): Promise<void> {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") await context.resume();
  } catch {
    /* Sound is optional; the timer must always remain usable. */
  }
}

export type Cue = "start" | "pause" | "resume" | "reset";

// Quiet, rounded notes: rising to begin, falling to pause, one low tap to reset.
const CUES: Record<Cue, readonly number[]> = {
  start: [392, 523.25],
  pause: [440, 329.63],
  resume: [440, 554.37],
  reset: [293.66],
};

export async function playCue(cue: Cue): Promise<void> {
  // Called directly from a gesture; audio readiness never blocks the timer.
  await unlockAudio();
  if (!context || context.state !== "running") return;
  const ctx = context;
  const origin = ctx.currentTime;
  for (const [index, frequency] of CUES[cue].entries()) {
    const time = origin + index * 0.075;
    const note = ctx.createOscillator();
    const gain = ctx.createGain();
    note.type = "sine";
    note.frequency.setValueAtTime(frequency, time);
    note.frequency.exponentialRampToValueAtTime(frequency * 0.985, time + 0.18);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.045, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    note.connect(gain).connect(ctx.destination);
    note.start(time);
    note.stop(time + 0.27);
    note.onended = () => {
      note.disconnect();
      gain.disconnect();
    };
  }
}

export function bell(): void {
  if (!context || context.state !== "running") return;
  const time = context.currentTime;
  for (const [frequency, volume] of [
    [528, 0.075],
    [1056, 0.015],
  ]) {
    const note = context.createOscillator();
    const gain = context.createGain();
    note.type = "sine";
    note.frequency.value = frequency;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 2.6);
    note.connect(gain).connect(context.destination);
    note.start(time);
    note.stop(time + 3);
    note.onended = () => {
      note.disconnect();
      gain.disconnect();
    };
  }
}
