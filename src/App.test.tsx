// @vitest-environment jsdom
import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { bell, playCue } from "./audio";
import { freshTimer, start } from "./timer";

vi.mock("./audio", () => ({
  playCue: vi.fn().mockResolvedValue(undefined),
  bell: vi.fn(),
}));
const KEY = "zangetsu-minimal-v2";
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("minimal timer controls", () => {
  it("renders nothing except the time and start button", () => {
    const { container } = render(<App />);
    expect(container.textContent).toBe("25:00Commencer");
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Réinitialiser le chrono" }),
    ).toBeTruthy();
    expect(container.querySelector("nav, header, footer, input, a")).toBeNull();
  });
  it("starts, pauses, and resumes the same countdown", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Commencer" }));
    expect(playCue).toHaveBeenLastCalledWith("start");
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByRole("timer").textContent).toBe("23:55");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(playCue).toHaveBeenLastCalledWith("pause");
    act(() => {
      vi.advanceTimersByTime(100_000);
    });
    expect(screen.getByRole("timer").textContent).toBe("23:55");
    fireEvent.click(screen.getByRole("button", { name: "Reprendre" }));
    expect(playCue).toHaveBeenLastCalledWith("resume");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("timer").textContent).toBe("23:54");
  });
  it("restores a running timer on reload", () => {
    const first = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Commencer" }));
    first.unmount();
    vi.setSystemTime(Date.now() + 120_000);
    render(<App />);
    expect(screen.getByRole("timer").textContent).toBe("23:00");
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
  });
  it("resets the current session, stops it, and persists the reset", () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Commencer" }));
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Réinitialiser le chrono" }),
    );
    expect(screen.getByRole("timer").textContent).toBe("25:00");
    expect(screen.getByRole("button", { name: "Commencer" })).toBeTruthy();
    expect(playCue).toHaveBeenLastCalledWith("reset");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("timer").textContent).toBe("25:00");
    view.unmount();
    render(<App />);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({
      remaining: 1500,
      deadline: null,
      completed: 0,
    });
  });
  it("identifies a saved break and resets it to 25 minutes of focus", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...freshTimer("short", 2), remaining: 120 }),
    );
    render(<App />);
    expect(screen.getByRole("status").textContent).toBe("Pause de 5 min");
    fireEvent.click(
      screen.getByRole("button", { name: "Réinitialiser le chrono" }),
    );
    expect(screen.getByRole("timer").textContent).toBe("25:00");
    expect(screen.queryByRole("status")).toBeNull();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({
      phase: "focus",
      duration: 1500,
      completed: 0,
      deadline: null,
    });
  });
  it("prepares a break without adding new controls or messages", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify(start(freshTimer(), Date.now() - 1_501_000)),
    );
    const { container } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(container.textContent).toBe("Pause de 5 min05:00Commencer");
    expect(bell).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(bell).toHaveBeenCalledTimes(1);
  });
  it("retains a long break without showing cycle counts", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify(start(freshTimer("focus", 3), Date.now() - 1_500_000)),
    );
    const { container } = render(<App />);
    expect(container.textContent).toBe("Pause de 20 min20:00Commencer");
  });
  it("supports Space without adding any shortcut labels", () => {
    render(<App />);
    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.keyDown(window, { code: "Space" });
    expect(screen.getByRole("button", { name: "Reprendre" })).toBeTruthy();
  });
  it("remains functional when local persistence is blocked", () => {
    const blocked = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    try {
      const { container } = render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Commencer" }));
      expect(container.textContent).toBe("25:00Pause");
    } finally {
      blocked.mockRestore();
    }
  });
});
