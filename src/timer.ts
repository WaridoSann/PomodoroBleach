export type Phase = "focus" | "short" | "long";
export type Timer = {
  phase: Phase;
  duration: number;
  remaining: number;
  deadline: number | null;
  completed: number;
};

const DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 20 * 60 };

export function freshTimer(phase: Phase = "focus", completed = 0): Timer {
  return {
    phase,
    duration: DURATIONS[phase],
    remaining: DURATIONS[phase],
    deadline: null,
    completed,
  };
}
export function remaining(timer: Timer, now: number): number {
  return timer.deadline === null
    ? timer.remaining
    : Math.max(0, Math.ceil((timer.deadline - now) / 1000));
}
export function start(timer: Timer, now: number): Timer {
  if (timer.deadline !== null) return timer;
  return { ...timer, deadline: now + timer.remaining * 1000 };
}
export function pause(timer: Timer, now: number): Timer {
  return { ...timer, remaining: remaining(timer, now), deadline: null };
}
export function settle(timer: Timer, now: number): Timer {
  if (timer.deadline === null || remaining(timer, now) > 0) return timer;
  if (timer.phase === "focus") {
    const completed = Math.min(4, timer.completed + 1);
    return freshTimer(completed === 4 ? "long" : "short", completed);
  }
  return freshTimer("focus", timer.phase === "long" ? 0 : timer.completed);
}
export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export function restore(raw: string | null): Timer {
  if (!raw) return freshTimer();
  try {
    const value = JSON.parse(raw);
    if (!value || !["focus", "short", "long"].includes(value.phase))
      return freshTimer();
    const phase = value.phase as Phase;
    const duration = DURATIONS[phase];
    if (
      value.duration !== duration ||
      !Number.isInteger(value.remaining) ||
      value.remaining < 0 ||
      value.remaining > duration
    )
      return freshTimer();
    if (
      !Number.isInteger(value.completed) ||
      value.completed < 0 ||
      value.completed > 4
    )
      return freshTimer();
    if (
      (phase === "focus" && value.completed >= 4) ||
      (phase === "short" && (value.completed === 0 || value.completed >= 4)) ||
      (phase === "long" && value.completed !== 4)
    )
      return freshTimer();
    if (
      value.deadline !== null &&
      (typeof value.deadline !== "number" ||
        !Number.isFinite(value.deadline) ||
        value.deadline <= 0 ||
        value.deadline > Date.now() + duration * 1000)
    )
      return freshTimer();
    if (value.remaining === 0 && value.deadline === null)
      return freshTimer(phase, value.completed);
    return {
      phase,
      duration,
      remaining: value.remaining,
      deadline: value.deadline,
      completed: value.completed,
    };
  } catch {
    return freshTimer();
  }
}
