// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import App from "./App";
import { freshData, start } from "./timer";

// These interaction checks cover the DOM, not WebGL rendering.
vi.mock("./SwordView", () => ({
  default: () => <div data-testid="sword-view" />,
}));
vi.mock("./audio", () => ({
  audio: {
    unlock: vi.fn().mockResolvedValue(undefined),
    bell: vi.fn(),
    ambient: vi.fn(),
  },
}));
vi.mock("./model-store", () => ({
  readModel: vi.fn().mockResolvedValue(null),
  saveModel: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  window.matchMedia = vi
    .fn()
    .mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Pomodoro interactions", () => {
  it("starts and pauses, preserving a named task in local storage", async () => {
    render(<App />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Votre tâche de concentration" }),
      { target: { value: "Préparer mon examen" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Commencer/ }));
    await screen.findByRole("button", { name: "Mettre en pause" });
    const saved = JSON.parse(localStorage.getItem("zangetsu-focus-v1")!);
    expect(saved.timer.task).toBe("Préparer mon examen");
    expect(saved.timer.deadline).toBeGreaterThan(Date.now());
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    await screen.findByRole("button", { name: /Commencer|Reprendre/ });
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("zangetsu-focus-v1")!).timer.deadline,
      ).toBeNull(),
    );
  });
  it("requires confirmation before discarding a running timer and respects cancel", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Commencer/ }));
    await screen.findByRole("button", { name: "Mettre en pause" });
    fireEvent.click(screen.getByRole("button", { name: "Pause courte" }));
    expect(screen.getByRole("dialog").textContent).toContain(
      "Changer de mode ?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Mettre en pause" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause courte" }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmer/ }));
    expect(screen.getByRole("timer").textContent).toContain("05:00");
    expect(
      JSON.parse(localStorage.getItem("zangetsu-focus-v1")!).sessions,
    ).toHaveLength(0);
  });
  it("applies customized durations and restores them after remount", async () => {
    const view = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Concentration" }),
      { target: { value: "40" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(screen.getByRole("timer").textContent).toContain("40:00");
    view.unmount();
    render(<App />);
    expect(screen.getByRole("timer").textContent).toContain("40:00");
  });
  it("preserves an active timer when settings change", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Commencer/ }));
    await screen.findByRole("button", { name: "Mettre en pause" });
    const deadline = JSON.parse(localStorage.getItem("zangetsu-focus-v1")!)
      .timer.deadline;
    fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Concentration" }),
      { target: { value: "40" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(
      JSON.parse(localStorage.getItem("zangetsu-focus-v1")!).timer.deadline,
    ).toBe(deadline);
    expect(
      screen.getByRole("button", { name: "Mettre en pause" }),
    ).toBeTruthy();
  });
  it("reconciles an expired saved session once and shows it in the journal", async () => {
    const data = freshData();
    data.task = "Mon chapitre";
    localStorage.setItem(
      "zangetsu-focus-v1",
      JSON.stringify(start(data, Date.now() - 1501_000)),
    );
    render(<App />);
    expect(screen.getByRole("timer").textContent).toContain("05:00");
    fireEvent.click(screen.getByRole("button", { name: "Mon journal" }));
    expect(await screen.findByText("Mon chapitre")).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("zangetsu-focus-v1")!).sessions,
    ).toHaveLength(1);
  });
  it("stays usable if local storage is unavailable", async () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Quota", "QuotaExceededError");
      });
    try {
      render(<App />);
      expect(screen.getByRole("status").textContent).toContain(
        "stockage local est indisponible",
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Commencer/ }));
      });
      expect(
        screen.getByRole("button", { name: "Mettre en pause" }),
      ).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });
  it("has a master mute independent of the end bell setting", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Couper tous les sons" }),
    );
    return waitFor(() => {
      const settings = JSON.parse(
        localStorage.getItem("zangetsu-focus-v1")!,
      ).settings;
      expect(settings.muted).toBe(true);
      expect(settings.sound).toBe(true);
    });
  });
});
