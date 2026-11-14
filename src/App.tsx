import { useCallback, useEffect, useRef, useState } from "react";
import { bell, playCue } from "./audio";
import {
  formatTime,
  freshTimer,
  pause,
  remaining,
  restore,
  settle,
  start,
} from "./timer";
import type { Timer } from "./timer";

const STORAGE_KEY = "zangetsu-minimal-v2";
function load(): Timer {
  try {
    return restore(localStorage.getItem(STORAGE_KEY));
  } catch {
    return freshTimer();
  }
}

export default function App() {
  const [timer, setTimer] = useState<Timer>(load);
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef(timer);

  const update = useCallback((next: Timer) => {
    timerRef.current = next;
    setTimer(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* The timer also works when browser storage is unavailable. */
    }
  }, []);

  useEffect(() => {
    function tick() {
      const time = Date.now();
      setNow(time);
      const current = timerRef.current;
      const next = settle(current, time);
      if (next !== current) {
        update(next);
        bell();
      }
    }
    tick();
    const interval = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      const next = restore(event.newValue);
      timerRef.current = next;
      setTimer(next);
      tick();
    };
    window.addEventListener("storage", sync);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("storage", sync);
    };
  }, [update]);

  const toggle = useCallback(() => {
    const time = Date.now();
    const current = timerRef.current;
    const next = settle(current, time);
    setNow(time);
    if (next !== current) {
      update(next);
      bell();
    } else {
      const cue =
        current.deadline !== null
          ? "pause"
          : current.remaining < current.duration
            ? "resume"
            : "start";
      update(
        current.deadline === null ? start(current, time) : pause(current, time),
      );
      void playCue(cue);
    }
  }, [update]);

  const reset = useCallback(() => {
    const current = timerRef.current;
    update(freshTimer(current.phase, current.completed));
    setNow(Date.now());
    void playCue("reset");
  }, [update]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      // A focused native button already handles Space itself.
      if (
        event.target instanceof HTMLElement &&
        ["BUTTON", "INPUT", "TEXTAREA"].includes(event.target.tagName)
      )
        return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [toggle]);

  const seconds = remaining(timer, now);
  const running = timer.deadline !== null;
  const label = running
    ? "Pause"
    : seconds < timer.duration
      ? "Reprendre"
      : "Commencer";
  const phase = timer.phase === "focus" ? "Concentration" : "Pause";
  useEffect(() => {
    document.title = `${formatTime(seconds)} · ${phase} — Zangetsu`;
  }, [seconds, phase]);

  return (
    <main className="sanctuary" aria-label="Minuteur Pomodoro">
      <div className="landscape" aria-hidden="true" />
      <div className="mist" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <section
        className="timer"
        aria-label={
          phase === "Concentration"
            ? "Session de concentration"
            : "Temps de repos"
        }
      >
        <div
          className="digits"
          role="timer"
          aria-live="off"
          aria-label={`${Math.floor(seconds / 60)} minutes et ${seconds % 60} secondes`}
        >
          {formatTime(seconds)}
        </div>
        <div className="timer-actions">
          <button type="button" className="timer-button" onClick={toggle}>
            <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true">
              {running ? (
                <path
                  d="M6 4v12M14 4v12"
                  stroke="currentColor"
                  strokeWidth="2.2"
                />
              ) : (
                <path d="m6 3 11 7-11 7Z" fill="currentColor" />
              )}
            </svg>
            <span>{label}</span>
          </button>
          <button
            type="button"
            className="timer-button reset-button"
            aria-label="Réinitialiser le chrono"
            title="Réinitialiser le chrono"
            onClick={reset}
          >
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 7a6.5 6.5 0 1 1-.1 6M4 3v4h4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </section>
    </main>
  );
}
