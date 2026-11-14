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
import { bell } from "./audio";
import { freshTimer, start } from "./timer";

vi.mock("./audio", () => ({
  unlockAudio: vi.fn().mockResolvedValue(undefined),
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

describe("one timer, one button", () => {
  it("renders nothing except the time and start button", () => {
    const { container } = render(<App />);
    expect(container.textContent).toBe("25:00Commencer");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(
      container.querySelector("nav, header, footer, input, canvas, a"),
    ).toBeNull();
  });
  it("starts, pauses, and resumes the same countdown", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Commencer" }));
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByRole("timer").textContent).toBe("23:55");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => {
      vi.advanceTimersByTime(100_000);
    });
    expect(screen.getByRole("timer").textContent).toBe("23:55");
    fireEvent.click(screen.getByRole("button", { name: "Reprendre" }));
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
    expect(container.textContent).toBe("05:00Commencer");
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
    expect(container.textContent).toBe("20:00Commencer");
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
