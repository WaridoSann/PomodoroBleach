export type Mode = "focus" | "short" | "long";
export type Settings = {
  focus: number;
  short: number;
  long: number;
  sound: boolean;
  volume: number;
  ambient: boolean;
  muted: boolean;
  motion: boolean;
  autoStart: boolean;
};
export type Session = {
  id: string;
  endedAt: number;
  seconds: number;
  task: string;
  cycleCompleted?: boolean;
};
export type Timer = {
  mode: Mode;
  duration: number;
  remaining: number;
  deadline: number | null;
  cycle: number;
  task: string;
};
export type Data = {
  settings: Settings;
  timer: Timer;
  sessions: Session[];
  task: string;
};
export const DEFAULTS: Settings = {
  focus: 25,
  short: 5,
  long: 20,
  sound: true,
  volume: 0.45,
  muted: false,
  ambient: false,
  motion: true,
  autoStart: false,
};
export const LABELS: Record<Mode, string> = {
  focus: "Concentration",
  short: "Pause courte",
  long: "Pause longue",
};
export function freshTimer(
  mode: Mode = "focus",
  settings = DEFAULTS,
  cycle = 0,
): Timer {
  return {
    mode,
    duration: settings[mode] * 60,
    remaining: settings[mode] * 60,
    deadline: null,
    cycle,
    task: "",
  };
}
export function freshData(): Data {
  return {
    settings: { ...DEFAULTS },
    timer: freshTimer(),
    sessions: [],
    task: "",
  };
}
export function remaining(timer: Timer, now: number): number {
  return timer.deadline === null
    ? timer.remaining
    : Math.max(0, Math.ceil((timer.deadline - now) / 1000));
}
export function start(data: Data, now: number): Data {
  if (data.timer.deadline !== null) return data;
  return {
    ...data,
    timer: {
      ...data.timer,
      task:
        data.timer.remaining === data.timer.duration
          ? data.task.trim()
          : data.timer.task,
      deadline: now + data.timer.remaining * 1000,
    },
  };
}
export function pause(data: Data, now: number): Data {
  return {
    ...data,
    timer: {
      ...data.timer,
      remaining: remaining(data.timer, now),
      deadline: null,
    },
  };
}
export function complete(data: Data, now: number): Data {
  if (data.timer.deadline === null || remaining(data.timer, now) > 0)
    return data;
  const focus = data.timer.mode === "focus";
  const cycle = focus
    ? Math.min(4, data.timer.cycle + 1)
    : data.timer.mode === "long" || data.timer.cycle >= 4
      ? 0
      : data.timer.cycle;
  const mode: Mode = focus ? (cycle >= 4 ? "long" : "short") : "focus";
  const timer = freshTimer(mode, data.settings, cycle);
  const sessions = focus
    ? [
        ...data.sessions,
        {
          id: `session-${data.timer.deadline}`,
          endedAt: data.timer.deadline,
          seconds: data.timer.duration,
          task: data.timer.task || "Concentration libre",
          cycleCompleted: cycle === 4,
        },
      ].slice(-5000)
    : data.sessions;
  const next = { ...data, timer, sessions };
  // Reconcile one interval only. A sleeping device must never earn unattended sessions.
  return data.settings.autoStart ? start(next, now) : next;
}
export function changeMode(data: Data, mode: Mode): Data {
  // A new focus block after a completed cycle begins a new cycle.
  return {
    ...data,
    timer: freshTimer(
      mode,
      data.settings,
      mode === "focus" && data.timer.cycle >= 4 ? 0 : data.timer.cycle,
    ),
  };
}
export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function validNumber(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
export function restore(raw: string | null): Data {
  if (!raw) return freshData();
  try {
    const parsed = JSON.parse(raw);
    const data = freshData();
    for (const mode of ["focus", "short", "long"] as const) {
      if (
        Number.isInteger(parsed.settings?.[mode]) &&
        validNumber(parsed.settings[mode], 1, 180)
      )
        data.settings[mode] = parsed.settings[mode];
    }
    for (const key of [
      "sound",
      "ambient",
      "motion",
      "autoStart",
      "muted",
    ] as const) {
      if (typeof parsed.settings?.[key] === "boolean")
        data.settings[key] = parsed.settings[key];
    }
    if (validNumber(parsed.settings?.volume, 0, 1))
      data.settings.volume = parsed.settings.volume;
    data.task =
      typeof parsed.task === "string" ? parsed.task.slice(0, 160) : "";
    data.sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions
          .filter(
            (s: Session) =>
              s &&
              typeof s.id === "string" &&
              typeof s.task === "string" &&
              validNumber(s.seconds, 1, 10800) &&
              validNumber(s.endedAt, 1, Date.now() + 10800000),
          )
          .slice(-5000)
      : [];
    const t = parsed.timer;
    if (
      t &&
      ["focus", "short", "long"].includes(t.mode) &&
      validNumber(t.duration, 60, 10800) &&
      validNumber(t.remaining, 0, t.duration) &&
      Number.isInteger(t.cycle) &&
      validNumber(t.cycle, 0, 4) &&
      (t.deadline === null || validNumber(t.deadline, 1, Date.now() + 10800000))
    ) {
      data.timer = {
        ...t,
        task: typeof t.task === "string" ? t.task.slice(0, 160) : "",
      };
    } else data.timer = freshTimer("focus", data.settings);
    return data;
  } catch {
    return freshData();
  }
}
