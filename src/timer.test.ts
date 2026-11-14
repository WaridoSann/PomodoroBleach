import { describe, expect, it } from "vitest";
import {
  formatTime,
  freshTimer,
  pause,
  remaining,
  restore,
  settle,
  start,
} from "./timer";

const NOW = Date.now();
describe("minimal Pomodoro", () => {
  it("starts a fixed 25-minute session", () => {
    const timer = start(freshTimer(), NOW);
    expect(timer.deadline).toBe(NOW + 1_500_000);
    expect(remaining(timer, NOW + 1234)).toBe(1499);
    expect(start(timer, NOW + 500)).toBe(timer);
  });
  it("pauses and resumes without losing the elapsed time", () => {
    const paused = pause(start(freshTimer(), NOW), NOW + 65_000);
    expect(paused).toMatchObject({
      deadline: null,
      remaining: 1435,
      completed: 0,
    });
    expect(start(paused, NOW + 500_000).deadline).toBe(NOW + 1_935_000);
  });
  it("prepares a five-minute break after a completed focus session", () => {
    const done = settle(start(freshTimer(), NOW), NOW + 1_500_000);
    expect(done).toEqual(freshTimer("short", 1));
    expect(settle(done, NOW + 20_000_000)).toBe(done);
  });
  it("prepares a long rest after four sessions, then starts a new cycle", () => {
    const done = settle(start(freshTimer("focus", 3), NOW), NOW + 1_500_000);
    expect(done).toEqual(freshTimer("long", 4));
    expect(settle(start(done, NOW), NOW + 1_200_000)).toEqual(freshTimer());
  });
  it("returns from a short break without advancing the completed count", () => {
    const timer = start(freshTimer("short", 2), NOW);
    expect(settle(timer, NOW + 300_000)).toEqual(freshTimer("focus", 2));
  });
  it("never counts multiple sessions after a long device sleep", () => {
    const done = settle(start(freshTimer(), NOW), NOW + 86_400_000);
    expect(done.completed).toBe(1);
    expect(done.deadline).toBeNull();
    expect(done.phase).toBe("short");
  });
  it("restores the active deadline after reload", () => {
    const timer = start(freshTimer(), NOW);
    expect(restore(JSON.stringify(timer))).toEqual(timer);
  });
  it("rejects corrupted or incompatible saved timers", () => {
    for (const raw of [
      "null",
      "broken",
      "{}",
      JSON.stringify({ ...freshTimer(), phase: "invalid" }),
      JSON.stringify({ ...freshTimer(), completed: 4 }),
      JSON.stringify({ ...freshTimer(), deadline: "tomorrow" }),
      JSON.stringify({ ...freshTimer(), remaining: -1 }),
      JSON.stringify({ ...freshTimer(), duration: 60 }),
    ]) {
      expect(restore(raw)).toEqual(freshTimer());
    }
  });
  it("does not finish before the deadline and formats the countdown", () => {
    const timer = start(freshTimer(), NOW);
    expect(settle(timer, NOW + 1_499_999)).toBe(timer);
    expect(formatTime(1500)).toBe("25:00");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(0)).toBe("00:00");
  });
});
