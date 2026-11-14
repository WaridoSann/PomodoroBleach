let context: AudioContext | null = null;

export async function unlockAudio(): Promise<void> {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") await context.resume();
  } catch {
    /* Sound is optional; the timer must always remain usable. */
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
