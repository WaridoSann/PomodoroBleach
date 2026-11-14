import { describe, expect, it } from "vitest";
import {
  changeMode,
  complete,
  dayKey,
  DEFAULTS,
  formatTime,
  freshData,
  freshTimer,
  pause,
  remaining,
  restore,
  start,
} from "./timer";

const NOW = 1_800_000_000_000;
describe("wall-clock Pomodoro", () => {
  it("starts a 25-minute block and captures the intention", () => {
    const data = start({ ...freshData(), task: "  Lire un chapitre  " }, NOW);
    expect(data.timer.deadline).toBe(NOW + 25 * 60 * 1000);
    expect(data.timer.task).toBe("Lire un chapitre");
    expect(remaining(data.timer, NOW + 1234)).toBe(1499);
  });
  it("pauses without awarding a session and resumes with the saved time", () => {
    const paused = pause(start(freshData(), NOW), NOW + 10_000);
    expect(paused.timer.remaining).toBe(1490);
    expect(paused.timer.deadline).toBeNull();
    expect(paused.sessions).toEqual([]);
    expect(start(paused, NOW + 600_000).timer.deadline).toBe(
      NOW + 600_000 + 1490_000,
    );
  });
  it("does not reset the deadline when already started", () => {
    const data = start(freshData(), NOW);
    expect(start(data, NOW + 1000)).toBe(data);
  });
  it("finishes once, records its original task and prepares a paused short break", () => {
    let data = start({ ...freshData(), task: "Tâche initiale" }, NOW);
    data = { ...data, task: "Tâche suivante" };
    const done = complete(data, NOW + 1500_000);
    expect(done.sessions).toHaveLength(1);
    expect(done.sessions[0]).toMatchObject({
      task: "Tâche initiale",
      seconds: 1500,
      endedAt: NOW + 1500_000,
    });
    expect(done.timer).toMatchObject({
      mode: "short",
      remaining: 300,
      deadline: null,
      cycle: 1,
    });
    expect(complete(done, NOW + 1600_000)).toBe(done);
  });
  it("does not complete before the deadline", () => {
    const data = start(freshData(), NOW);
    expect(complete(data, NOW + 1499_999)).toBe(data);
  });
  it("gives a long break after the fourth focus and starts a fresh cycle after it", () => {
    const data = start(
      { ...freshData(), timer: freshTimer("focus", DEFAULTS, 3) },
      NOW,
    );
    const done = complete(data, NOW + 1500_000);
    expect(done.sessions[0].cycleCompleted).toBe(true);
    expect(done.timer).toMatchObject({
      mode: "long",
      duration: 1200,
      cycle: 4,
      deadline: null,
    });
    const rested = complete(start(done, NOW + 1600_000), NOW + 2800_000);
    expect(rested.timer).toMatchObject({
      mode: "focus",
      cycle: 0,
      duration: 1500,
    });
    expect(rested.sessions).toHaveLength(1);
  });
  it("resets the cycle even if a short break replaces the fourth long break", () => {
    const data = { ...freshData(), timer: freshTimer("short", DEFAULTS, 4) };
    const rested = complete(start(data, NOW), NOW + 300_000);
    expect(rested.timer.cycle).toBe(0);
    const focused = complete(start(rested, NOW + 300_000), NOW + 1800_000);
    expect(focused.timer.cycle).toBe(1);
  });
  it("keeps the cycle count after a short break without logging that break", () => {
    const data = start(
      { ...freshData(), timer: freshTimer("short", DEFAULTS, 2) },
      NOW,
    );
    const done = complete(data, NOW + 300_000);
    expect(done.timer).toMatchObject({ mode: "focus", cycle: 2 });
    expect(done.sessions).toHaveLength(0);
  });
  it("reconciles an overnight sleep only once, even with auto-start enabled", () => {
    const data = freshData();
    data.settings.autoStart = true;
    const nextDay = NOW + 86_400_000;
    const done = complete(start(data, NOW), nextDay);
    expect(done.sessions).toHaveLength(1);
    expect(done.timer.deadline).toBe(nextDay + 300_000);
    expect(done.sessions[0].endedAt).toBe(NOW + 1500_000);
  });
  it("does not award progress for a manual mode switch", () => {
    const switched = changeMode(start(freshData(), NOW), "long");
    expect(switched.sessions).toHaveLength(0);
    expect(switched.timer).toMatchObject({
      mode: "long",
      cycle: 0,
      deadline: null,
    });
  });
  it("begins a fresh cycle if focus is selected after four completed blocks", () => {
    const data = { ...freshData(), timer: freshTimer("long", DEFAULTS, 4) };
    expect(changeMode(data, "focus").timer.cycle).toBe(0);
  });
  it("uses changed settings for the next interval without changing the active interval", () => {
    const data = start(freshData(), NOW);
    data.settings.short = 9;
    expect(data.timer.duration).toBe(1500);
    expect(complete(data, NOW + 1500_000).timer.duration).toBe(540);
  });
  it("preserves the deadline across a reload and never freezes a background timer", () => {
    const before = start(freshData(), Date.now());
    const after = restore(JSON.stringify(before));
    expect(after.timer.deadline).toBe(before.timer.deadline);
    expect(remaining(after.timer, before.timer.deadline! + 1000)).toBe(0);
    expect(
      complete(after, before.timer.deadline! + 1000).sessions,
    ).toHaveLength(1);
  });
  it("restores safely from corrupted, malformed or untrusted storage", () => {
    expect(restore("not JSON")).toEqual(freshData());
    expect(restore("null")).toEqual(freshData());
    const data = restore(
      JSON.stringify({
        settings: { focus: -20, short: "5", long: 999, volume: 7 },
        timer: { duration: -1 },
        sessions: [null, {}],
        task: 1,
      }),
    );
    expect(data).toEqual(freshData());
  });
  it("accepts zero remaining time only when it is consistent with a valid timer", () => {
    const data = freshData();
    data.timer.remaining = 0;
    expect(restore(JSON.stringify(data)).timer.remaining).toBe(0);
    data.timer.remaining = 1600;
    expect(restore(JSON.stringify(data)).timer.remaining).toBe(1500);
  });
  it("formats the full configurable range and local day boundaries", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(10800)).toBe("180:00");
    expect(dayKey(new Date(2026, 10, 14, 23, 59).getTime())).toBe("2026-11-14");
  });
});
