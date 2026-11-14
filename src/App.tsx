import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coffee,
  Expand,
  Flame,
  Focus,
  Headphones,
  Leaf,
  LoaderCircle,
  Minimize,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { audio } from "./audio";
import {
  changeMode,
  complete,
  dayKey,
  DEFAULTS,
  formatTime,
  freshTimer,
  LABELS,
  pause,
  remaining,
  restore,
  start,
} from "./timer";
import type { Data, Mode, Settings } from "./timer";
import { readModel, saveModel } from "./model-store";

const SwordView = lazy(() => import("./SwordView"));
const STORAGE = "zangetsu-focus-v1";
function load(): Data {
  try {
    return restore(localStorage.getItem(STORAGE));
  } catch {
    return restore(null);
  }
}
const quotes = [
  [
    "La force se trouve dans ce que l’on choisit de faire, maintenant.",
    "Une session suffit pour commencer.",
  ],
  [
    "Une seule intention. Un peu de calme. Et le premier pas.",
    "Revenez simplement à l’essentiel.",
  ],
  [
    "Ce que vous répétez doucement finit par devenir une force.",
    "Avancez à votre rythme.",
  ],
];
function BladeMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      width={small ? 23 : 31}
      height={small ? 28 : 38}
      viewBox="0 0 31 38"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m24 1-9 20 4 2L30 1ZM14 20l-4 6 4 2 4-6ZM11 26 4 36l3 2 7-10Z"
        fill="currentColor"
      />
      <path d="m7 23 14 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function Dialog({
  title,
  subtitle,
  onClose,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) {
          const r = ref.current!.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-head">
        <div>
          <h2 id="dialog-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Fermer">
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Switch({
  value,
  onChange,
  label,
  text,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  text: string;
}) {
  return (
    <label className="switch-row">
      <span>
        <strong>{label}</strong>
        <small>{text}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}
function SettingsDialog({
  data,
  onSave,
  onClose,
  onModelChange,
  onClear,
}: {
  data: Data;
  onSave: (settings: Settings) => void;
  onClose: () => void;
  onModelChange: () => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState({ ...data.settings });
  const [busy, setBusy] = useState(false);
  const [modelName, setModelName] = useState("");
  const [message, setMessage] = useState("");
  const [notification, setNotification] = useState(
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void readModel()
      .then((m) => setModelName(m?.name ?? ""))
      .catch(() => {});
  }, []);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((s) => ({ ...s, [key]: value }));
  async function importFile(file: File) {
    setMessage("");
    if (!/\.(zip|glb)$/i.test(file.name)) {
      setMessage("Choisissez une archive ZIP glTF ou un fichier GLB.");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setMessage("Choisissez un fichier de moins de 40 Mo.");
      return;
    }
    setBusy(true);
    try {
      const model = { name: file.name, bytes: await file.arrayBuffer() };
      // Validate the full asset before replacing the user's working model.
      const { validateModel } = await import("./sword-scene");
      await validateModel(model);
      await saveModel(model);
      setModelName(file.name);
      onModelChange();
      setMessage("Sabre importé. Il est conservé uniquement sur cet appareil.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Import impossible. Vérifiez le fichier et l’espace disponible.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <Dialog
      title="À votre rythme"
      subtitle="Un espace de concentration qui vous ressemble."
      onClose={onClose}
      className="settings-dialog"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
          onClose();
        }}
      >
        <section className="setting-section">
          <h3>
            <Clock3 size={15} /> Vos durées <span>minutes</span>
          </h3>
          <div className="duration-inputs">
            {(["focus", "short", "long"] as const).map((mode) => (
              <label key={mode}>
                {LABELS[mode]}
                <input
                  type="number"
                  min="1"
                  max="180"
                  step="1"
                  required
                  value={draft[mode] || ""}
                  onChange={(e) => update(mode, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <p className="hint">
            Les changements s’appliquent aux prochaines sessions. Votre session
            entamée est conservée.
          </p>
        </section>
        <section className="setting-section">
          <h3>
            <Headphones size={15} /> Ambiance sonore
          </h3>
          <Switch
            label="Cloche de fin"
            text="Une note douce pour marquer la transition."
            value={draft.sound}
            onChange={(v) => update("sound", v)}
          />
          <Switch
            label="Souffle d’ambiance"
            text="Un fond sonore discret pendant le chrono."
            value={draft.ambient}
            onChange={(v) => update("ambient", v)}
          />
          <div className="volume-row">
            <label htmlFor="volume">Volume</label>
            <input
              id="volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={draft.volume}
              onChange={(e) => update("volume", Number(e.target.value))}
            />
            <button
              type="button"
              className="text-button"
              onClick={async () => {
                await audio.unlock();
                audio.bell(draft.volume);
              }}
            >
              Écouter
            </button>
          </div>
        </section>
        <section className="setting-section">
          <h3>
            <Focus size={15} /> Votre expérience
          </h3>
          <Switch
            label="Animations discrètes"
            text="Une respiration légère autour de la lame."
            value={draft.motion}
            onChange={(v) => update("motion", v)}
          />
          <Switch
            label="Enchaîner automatiquement"
            text="Lancer le prochain chrono après chaque fin."
            value={draft.autoStart}
            onChange={(v) => update("autoStart", v)}
          />
          <div className="notification-row">
            <span>Notifications de fin</span>
            <button
              type="button"
              className="text-button"
              disabled={
                notification === "unsupported" || notification === "granted"
              }
              onClick={async () => {
                try {
                  setNotification(await Notification.requestPermission());
                } catch {
                  setMessage(
                    "Les notifications ne sont pas disponibles dans ce navigateur.",
                  );
                }
              }}
            >
              {notification === "granted"
                ? "Activées"
                : notification === "denied"
                  ? "Bloquées dans le navigateur"
                  : notification === "unsupported"
                    ? "Indisponibles"
                    : "Activer"}
            </button>
          </div>
        </section>
        <section className="setting-section">
          <h3>
            <BladeMark small /> Votre sabre en 3D
          </h3>
          <p className="hint">
            Importez votre ZIP Sketchfab (glTF + textures) ou un GLB. Le fichier
            reste dans ce navigateur et n’est envoyé à aucun serveur.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.glb"
            className="sr-only"
            aria-label="Fichier du sabre 3D"
            onChange={(e) => {
              if (e.target.files?.[0]) void importFile(e.target.files[0]);
            }}
          />
          <div className="model-import">
            <span>
              <strong>
                {modelName ? "Modèle personnel" : "Lame originelle"}
              </strong>
              <small>
                {modelName || "Sabre original inclus avec l’application"}
              </small>
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                <Upload size={14} />
              )}{" "}
              {busy ? "Import…" : "Importer"}
            </button>
          </div>
          {modelName && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={async () => {
                try {
                  await saveModel(null);
                  setModelName("");
                  onModelChange();
                  setMessage("Lame originelle restaurée.");
                } catch {
                  setMessage("Impossible de modifier le stockage local.");
                }
              }}
            >
              Revenir à la lame originelle
            </button>
          )}
          {message && (
            <p className="inline-message" role="status">
              {message}
            </p>
          )}
        </section>
        <div className="settings-bottom">
          <button
            type="button"
            className="text-button"
            onClick={() => setDraft({ ...DEFAULTS })}
          >
            Réglages par défaut
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            Enregistrer <Check size={16} />
          </button>
        </div>
        <button
          type="button"
          className="clear-data text-button"
          onClick={onClear}
        >
          Effacer le journal et la progression
        </button>
      </form>
    </Dialog>
  );
}
function Journal({ data, now }: { data: Data; now: number }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 6 + i);
    return d;
  });
  const totals = days.map((d) =>
    data.sessions
      .filter((s) => dayKey(s.endedAt) === dayKey(d.getTime()))
      .reduce((sum, s) => sum + s.seconds / 60, 0),
  );
  const max = Math.max(60, ...totals);
  const totalMinutes = Math.round(
    data.sessions.reduce((sum, s) => sum + s.seconds / 60, 0),
  );
  function exportCSV() {
    const escape = (v: string) =>
      `"${(/^[=+\-@\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`;
    const rows = [
      ["Date", "Tâche", "Minutes"],
      ...data.sessions.map((s) => [
        new Date(s.endedAt).toISOString(),
        s.task,
        String(s.seconds / 60),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((row) => row.map(escape).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `zangetsu-journal-${dayKey(now)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main id="main-content" className="journal page-enter">
      <div className="journal-title">
        <div>
          <span className="eyebrow">CHAQUE INSTANT COMPTE</span>
          <h1>Votre rythme se dessine.</h1>
          <p>La régularité se construit une session à la fois.</p>
        </div>
        <button
          className="secondary-button"
          onClick={exportCSV}
          disabled={!data.sessions.length}
        >
          <ArrowDownToLine size={15} /> Exporter le journal
        </button>
      </div>
      <div className="journal-overview">
        <div>
          <span>Temps de concentration</span>
          <strong>
            {totalMinutes}
            <small> min</small>
          </strong>
        </div>
        <div>
          <span>Sessions terminées</span>
          <strong>{data.sessions.length.toString().padStart(2, "0")}</strong>
        </div>
        <div>
          <span>Cycles accomplis</span>
          <strong>
            {data.sessions
              .filter((session) => session.cycleCompleted)
              .length.toString()
              .padStart(2, "0")}
          </strong>
        </div>
      </div>
      <div className="journal-grid">
        <section className="chart-section">
          <div className="section-heading">
            <h2>Les 7 derniers jours</h2>
            <span>Minutes de concentration</span>
          </div>
          <div className="chart">
            {days.map((day, i) => (
              <div
                className={`chart-column ${i === 6 ? "today" : ""}`}
                key={dayKey(day.getTime())}
              >
                <span>{Math.round(totals[i])}</span>
                <div className="bar-track">
                  <div
                    className="bar"
                    style={{ height: `${(totals[i] / max) * 100}%` }}
                  />
                </div>
                <small>
                  {new Intl.DateTimeFormat("fr", { weekday: "short" })
                    .format(day)
                    .replace(".", "")}
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="progression-section">
          <span className="eyebrow">LA FORCE DE L’HABITUDE</span>
          <h2>Votre lame évolue avec vous.</h2>
          <p>
            Chaque session terminée affine votre concentration et révèle un peu
            plus la lumière de votre sabre.
          </p>
          {[
            ["Le calme", "Votre point de départ", 0],
            ["L’éveil", "Une première session accomplie", 1],
            ["La maîtrise", "Quatre sessions accomplies", 4],
          ].map(([name, text, count]) => (
            <div
              className={`milestone ${data.sessions.length >= Number(count) ? "unlocked" : ""}`}
              key={name}
            >
              <div>
                {data.sessions.length >= Number(count) ? (
                  <Check size={14} />
                ) : (
                  <span>0{Number(count) === 4 ? 3 : 2}</span>
                )}
              </div>
              <span>
                <strong>{name}</strong>
                <small>{text}</small>
              </span>
              {data.sessions.length >= Number(count) && (
                <span className="milestone-tag">Atteint</span>
              )}
            </div>
          ))}
        </section>
      </div>
      <section className="recent-section">
        <div className="section-heading">
          <h2>Vos dernières sessions</h2>
          <span>
            {data.sessions.length
              ? "Les 30 plus récentes"
              : "Votre histoire commence ici"}
          </span>
        </div>
        {!data.sessions.length ? (
          <div className="empty-journal">
            <Leaf size={28} />
            <h3>Un premier instant pour vous.</h3>
            <p>Terminez une session de concentration : elle apparaîtra ici.</p>
          </div>
        ) : (
          <div className="session-list">
            {data.sessions
              .slice(-30)
              .reverse()
              .map((session) => (
                <div className="session-row" key={session.id}>
                  <span className="session-check">
                    <Check size={14} />
                  </span>
                  <span className="session-task">
                    {session.task}
                    <small>
                      {new Intl.DateTimeFormat("fr", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(session.endedAt)}
                    </small>
                  </span>
                  <span>{Math.round(session.seconds / 60)} min</span>
                </div>
              ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [data, setData] = useState<Data>(load);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<"focus" | "journal">("focus");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    action: () => void;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [modelVersion, setModelVersion] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [modelName, setModelName] = useState("Lame originelle");
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const dataRef = useRef(data);
  const onModelName = useCallback((name: string) => setModelName(name), []);
  useEffect(() => {
    dataRef.current = data;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(data));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [data]);
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE && event.newValue)
        setData(restore(event.newValue));
    };
    window.addEventListener("storage", listener);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    media.addEventListener("change", change);
    return () => {
      window.removeEventListener("storage", listener);
      media.removeEventListener("change", change);
    };
  }, []);
  useEffect(() => {
    const tick = () => {
      const time = Date.now();
      setNow(time);
      const previous = dataRef.current;
      const next = complete(previous, time);
      if (next === previous) return;
      dataRef.current = next;
      setData(next);
      const focusEnded = previous.timer.mode === "focus";
      const message = focusEnded
        ? previous.timer.cycle === 3
          ? "Quatre sessions accomplies. Offrez-vous une vraie pause."
          : "Session terminée. Prenez un instant pour respirer."
        : "La pause est terminée. Prêt pour un nouvel instant ?";
      setNotice(message);
      setTransitioning(true);
      if (previous.settings.sound && !previous.settings.muted)
        audio.bell(previous.settings.volume);
      if (
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        try {
          new Notification("Zangetsu", {
            body: message,
            icon: `${import.meta.env.BASE_URL}favicon.svg`,
            tag: "session-complete",
          });
        } catch {
          /* Some mobile browsers require a service worker. */
        }
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const seconds = remaining(data.timer, now);
  const running = data.timer.deadline !== null;
  const started = seconds < data.timer.duration || running;
  const motion = data.settings.motion && !reducedMotion;
  const today = data.sessions.filter(
    (session) => dayKey(session.endedAt) === dayKey(now),
  );
  const todayMinutes = Math.round(
    today.reduce((sum, s) => sum + s.seconds / 60, 0),
  );
  const level =
    data.sessions.length >= 4 ? 2 : data.sessions.length >= 1 ? 1 : 0;
  useEffect(() => {
    document.title = `${running ? formatTime(seconds) + " · " : ""}${LABELS[data.timer.mode]} — Zangetsu`;
  }, [running, seconds, data.timer.mode]);
  useEffect(() => {
    audio.ambient(
      !data.settings.muted && data.settings.ambient && running,
      data.settings.volume,
    );
    return () => {
      audio.ambient(false, 0);
    };
  }, [
    data.settings.muted,
    data.settings.ambient,
    data.settings.volume,
    running,
  ]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 9000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!transitioning) return;
    const id = setTimeout(() => setTransitioning(false), 850);
    return () => clearTimeout(id);
  }, [transitioning]);
  async function toggle() {
    await audio.unlock();
    const current = dataRef.current;
    if (
      !current.timer.deadline &&
      current.settings.sound &&
      !current.settings.muted
    )
      audio.bell(current.settings.volume * 0.4, false);
    setNow(Date.now());
    setData((prev) => {
      const settled = complete(prev, Date.now());
      return prev.timer.deadline !== null
        ? pause(settled, Date.now())
        : start(settled, Date.now());
    });
  }
  function confirmIfStarted(title: string, text: string, action: () => void) {
    if (started) setConfirmation({ title, text, action });
    else action();
  }
  function reset() {
    confirmIfStarted(
      "Recommencer cette session ?",
      "Le temps de cette session sera remis à zéro. Vos sessions déjà terminées sont conservées.",
      () =>
        setData((prev) => ({
          ...prev,
          timer: freshTimer(prev.timer.mode, prev.settings, prev.timer.cycle),
        })),
    );
  }
  function selectMode(mode: Mode) {
    if (mode === data.timer.mode) return;
    confirmIfStarted(
      "Changer de mode ?",
      "Le chrono actuel sera arrêté. Une session interrompue ne compte pas dans votre progression.",
      () => setData((prev) => changeMode(prev, mode)),
    );
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(
          event.target.tagName,
        ) ||
          event.target.isContentEditable)
      )
        return;
      if (
        settingsOpen ||
        helpOpen ||
        confirmation ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        void toggle();
      }
      if (event.key.toLowerCase() === "r") reset();
      if (event.key === "Escape") setImmersive(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const quote = quotes[new Date(now).getDate() % quotes.length];
  return (
    <div
      className={`app ${immersive ? "immersive" : ""} ${motion ? "" : "still"} ${running ? "is-running" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Aller au minuteur
      </a>
      <header className="header">
        <a
          className="brand"
          href="#"
          aria-label="Zangetsu, accueil"
          onClick={(e) => {
            e.preventDefault();
            setTab("focus");
          }}
        >
          <BladeMark />
          <span>
            ZANGETSU<small>UN INSTANT À LA FOIS</small>
          </span>
        </a>
        <nav aria-label="Navigation principale">
          <button
            className={tab === "focus" ? "active" : ""}
            onClick={() => setTab("focus")}
            aria-current={tab === "focus" ? "page" : undefined}
          >
            <Focus size={15} /> Concentration
          </button>
          <button
            className={tab === "journal" ? "active" : ""}
            onClick={() => setTab("journal")}
            aria-current={tab === "journal" ? "page" : undefined}
          >
            <AudioLines size={15} /> Mon journal
          </button>
        </nav>
        <div className="header-actions">
          <button
            className={`icon-button sound-toggle ${data.settings.muted ? "muted" : ""}`}
            aria-label={
              data.settings.muted ? "Activer les sons" : "Couper tous les sons"
            }
            title={
              data.settings.muted ? "Activer les sons" : "Couper tous les sons"
            }
            aria-pressed={!data.settings.muted}
            onClick={async () => {
              await audio.unlock();
              setData((prev) => ({
                ...prev,
                settings: { ...prev.settings, muted: !prev.settings.muted },
              }));
            }}
          >
            {!data.settings.muted ? (
              <Volume2 size={18} />
            ) : (
              <VolumeX size={18} />
            )}
          </button>
          <span className="header-divider" />
          <button
            className="settings-button"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={17} />
            <span>Réglages</span>
          </button>
        </div>
      </header>
      {storageError && (
        <p className="storage-warning" role="status">
          Le stockage local est indisponible. Votre progression restera
          disponible jusqu’à la fermeture de cette page.
        </p>
      )}
      {tab === "focus" ? (
        <main id="main-content" className="focus-page page-enter">
          <div className="page-intro">
            <div>
              <span className="eyebrow">
                <span className="tiny-line" /> VOTRE RITUEL DE CONCENTRATION
              </span>
              <h1>L’esprit calme. La lame prête.</h1>
            </div>
            <span className="local-badge">
              <span /> Un espace à vous
            </span>
          </div>
          <section
            className={`workspace ${transitioning ? "scene-shift" : ""}`}
            aria-label="Minuteur et sabre en 3D"
          >
            <div className={`sword-stage level-${level}`}>
              <div className="exhibit-top">
                <span className="eyebrow">
                  0{level + 1} <span className="muted-text">/</span>{" "}
                  {["LE CALME", "L’ÉVEIL", "LA MAÎTRISE"][level]}
                </span>
                <span className="exhibit-dot" />
              </div>
              <div className="kanji" aria-hidden="true">
                集中
              </div>
              <div className="stage-aura" />
              <div className="stage-circle circle-outer" />
              <div className="stage-circle circle-inner" />
              <div className="axis axis-h" />
              <div className="axis axis-v" />
              <Suspense
                fallback={
                  <div className="model-loading">
                    <LoaderCircle className="spin" size={15} /> Préparation de
                    la vue 3D
                  </div>
                }
              >
                <SwordView
                  motion={motion}
                  running={running}
                  level={level}
                  modelVersion={modelVersion}
                  onModelName={onModelName}
                />
              </Suspense>
              <div className="exhibit-caption">
                <span className="caption-line" />
                <div>
                  <strong>{modelName}</strong>
                  <span>
                    {
                      [
                        "Tout commence par un instant.",
                        "La régularité révèle votre force.",
                        "Votre concentration prend forme.",
                      ][level]
                    }
                  </span>
                </div>
              </div>
              <span className="stage-coordinate" aria-hidden="true">
                静けさ — 01
              </span>
            </div>
            <div className="timer-panel">
              <div className="timer-top">
                <div
                  className="mode-tabs"
                  role="group"
                  aria-label="Mode du minuteur"
                >
                  {(["focus", "short", "long"] as const).map((mode) => (
                    <button
                      key={mode}
                      aria-pressed={data.timer.mode === mode}
                      className={data.timer.mode === mode ? "selected" : ""}
                      onClick={() => selectMode(mode)}
                    >
                      {LABELS[mode]}
                    </button>
                  ))}
                </div>
                <button
                  className="icon-button immersive-toggle"
                  title={
                    immersive ? "Quitter le mode immersif" : "Mode immersif"
                  }
                  aria-label={
                    immersive ? "Quitter le mode immersif" : "Mode immersif"
                  }
                  onClick={() => setImmersive((v) => !v)}
                >
                  {immersive ? <Minimize size={17} /> : <Expand size={17} />}
                </button>
              </div>
              <div className="timer-body">
                <div className="session-label">
                  <span className={`status-dot ${running ? "pulsing" : ""}`} />
                  {data.timer.mode === "focus"
                    ? `SESSION ${Math.min(data.timer.cycle + 1, 4)
                        .toString()
                        .padStart(2, "0")} / 04`
                    : data.timer.mode === "short"
                      ? "UN INSTANT POUR SOUFFLER"
                      : "LE TEMPS DE RÉCUPÉRER"}
                </div>
                <div
                  className="timer-digits"
                  role="timer"
                  aria-label={`${Math.floor(seconds / 60)} minutes et ${seconds % 60} secondes`}
                  aria-live="off"
                >
                  {formatTime(seconds)}
                  <span className="timer-state">
                    {running
                      ? data.timer.mode === "focus"
                        ? "Votre attention est ici."
                        : "Respirez. Vous l’avez mérité."
                      : started
                        ? "Reprenez quand vous êtes prêt."
                        : data.timer.mode === "focus"
                          ? "Rien d’autre que cet instant."
                          : "Éloignez-vous un peu de l’écran."}
                  </span>
                </div>
                <div className="timer-buttons">
                  <button
                    className="primary-button start-button"
                    onClick={() => void toggle()}
                  >
                    {running ? (
                      <Pause size={17} fill="currentColor" />
                    ) : (
                      <Play size={17} fill="currentColor" />
                    )}
                    {running
                      ? "Mettre en pause"
                      : started
                        ? "Reprendre"
                        : "Commencer"}
                    {!running && <span className="key-hint">␣</span>}
                  </button>
                  <button
                    className="reset-button"
                    aria-label="Recommencer la session"
                    title="Recommencer la session (R)"
                    onClick={reset}
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
                <label className="task-field">
                  <span>VOTRE INTENTION</span>
                  <div>
                    <Plus size={15} />
                    <input
                      aria-label="Votre tâche de concentration"
                      placeholder="Sur quoi voulez-vous avancer ?"
                      maxLength={160}
                      value={data.task}
                      onChange={(e) =>
                        setData((prev) => ({ ...prev, task: e.target.value }))
                      }
                    />
                  </div>
                </label>
              </div>
              <div className="cycle-progress">
                <div className="cycle-heading">
                  <span>Votre cycle</span>
                  <span>
                    {Math.min(data.timer.cycle, 4)}{" "}
                    <span className="muted-text">/ 4 sessions</span>
                  </span>
                </div>
                <div className="cycle-segments">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div
                      key={i}
                      className={`${i < data.timer.cycle ? "done" : ""} ${i === data.timer.cycle && data.timer.mode === "focus" ? "current" : ""}`}
                    >
                      <span>
                        {i < data.timer.cycle ? (
                          <Check size={11} />
                        ) : (
                          String(i + 1).padStart(2, "0")
                        )}
                      </span>
                      <div />
                    </div>
                  ))}
                </div>
                <p>
                  <Coffee size={13} /> Après 4 sessions, une pause longue pour
                  récupérer.
                </p>
              </div>
            </div>
          </section>
          <section
            className="daily-section"
            aria-label="Votre concentration aujourd’hui"
          >
            <div className="daily-title">
              <span className="eyebrow">AUJOURD’HUI</span>
              <span>
                {new Intl.DateTimeFormat("fr", {
                  day: "numeric",
                  month: "long",
                }).format(now)}
              </span>
            </div>
            <div className="daily-stats">
              <div className="stat">
                <span className="stat-icon">
                  <Clock3 size={18} />
                </span>
                <div>
                  <strong>
                    {todayMinutes}
                    <small> min</small>
                  </strong>
                  <span>de concentration</span>
                </div>
              </div>
              <div className="stat">
                <span className="stat-icon">
                  <Target size={18} />
                </span>
                <div>
                  <strong>{today.length.toString().padStart(2, "0")}</strong>
                  <span>
                    session{today.length > 1 ? "s" : ""} terminée
                    {today.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="stat daily-goal">
                <span className="stat-icon">
                  <Flame size={18} />
                </span>
                <div>
                  <strong>
                    {Math.min(today.length, 4)}
                    <small> / 4</small>
                  </strong>
                  <span>
                    {today.length >= 4
                      ? "objectif du jour atteint"
                      : "votre objectif du jour"}
                  </span>
                </div>
                <div
                  className="goal-ring"
                  style={
                    {
                      "--progress": `${Math.min(today.length / 4, 1) * 360}deg`,
                    } as CSSProperties
                  }
                >
                  <Check size={12} />
                </div>
              </div>
            </div>
          </section>
          <div className="closing-note">
            <span className="quote-mark">“</span>
            <div>
              <p>{quote[0]}</p>
              <span>{quote[1]}</span>
            </div>
            <button className="text-button" onClick={() => setTab("journal")}>
              Voir ma progression <ArrowRight size={14} />
            </button>
          </div>
        </main>
      ) : (
        <Journal data={data} now={now} />
      )}
      <footer className="footer">
        <span>
          <BladeMark small /> Le calme est une force.
        </span>
        <div>
          <span className="privacy-note">
            <ShieldCheck size={12} /> Votre progression reste sur cet appareil
          </span>
          <button className="text-button" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={14} /> Comment ça marche
          </button>
        </div>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Sparkles size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Fermer le message"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {settingsOpen && (
        <SettingsDialog
          data={data}
          onSave={(settings) => {
            setData((prev) => ({
              ...prev,
              settings,
              timer:
                prev.timer.deadline === null &&
                prev.timer.remaining === prev.timer.duration
                  ? freshTimer(prev.timer.mode, settings, prev.timer.cycle)
                  : prev.timer,
            }));
            setNotice("Vos réglages sont enregistrés.");
          }}
          onClose={() => setSettingsOpen(false)}
          onModelChange={() => setModelVersion((v) => v + 1)}
          onClear={() => {
            setSettingsOpen(false);
            setConfirmation({
              title: "Effacer votre progression ?",
              text: "Votre journal et le cycle actuel seront effacés. Les réglages et votre modèle 3D seront conservés. Cette action est définitive.",
              action: () => {
                setData((prev) => ({
                  ...prev,
                  sessions: [],
                  timer: freshTimer("focus", prev.settings),
                }));
                setNotice("Votre espace est prêt pour un nouveau départ.");
              },
            });
          }}
        />
      )}
      {confirmation && (
        <Dialog
          title={confirmation.title}
          onClose={() => setConfirmation(null)}
          className="confirm-dialog"
        >
          <p>{confirmation.text}</p>
          <div className="confirm-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirmation(null)}
            >
              Annuler
            </button>
            <button
              className="primary-button"
              onClick={() => {
                confirmation.action();
                setConfirmation(null);
              }}
            >
              Confirmer <ChevronRight size={15} />
            </button>
          </div>
        </Dialog>
      )}
      {helpOpen && (
        <Dialog
          title="Une seule chose à la fois."
          subtitle="Un rituel simple pour retrouver votre attention."
          onClose={() => setHelpOpen(false)}
          className="help-dialog"
        >
          <div className="help-steps">
            {[
              [
                Focus,
                "Concentrez-vous pendant 25 minutes.",
                "Choisissez une tâche et commencez. Vous pouvez mettre le chrono en pause à tout moment.",
              ],
              [
                Coffee,
                "Soufflez pendant 5 minutes.",
                "À la fin d’une session, la pause est prête. Lancez-la quand vous le souhaitez.",
              ],
              [
                Leaf,
                "Après 4 sessions, récupérez.",
                "Une pause de 20 minutes termine le cycle. Toutes les durées sont personnalisables.",
              ],
            ].map(([Icon, title, text], i) => {
              const I = Icon as typeof Focus;
              return (
                <div key={i}>
                  <span className="help-icon">
                    <I size={20} />
                  </span>
                  <div>
                    <h3>{title as string}</h3>
                    <p>{text as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="help-note">
            <Sparkles size={16} />
            <p>
              Votre sabre s’éclaire au fil des sessions. La progression compte
              les sessions entièrement terminées ; une interruption n’efface
              jamais vos acquis.
            </p>
          </div>
          <p className="hint">
            Raccourcis : <kbd>Espace</kbd> pour démarrer ou mettre en pause,{" "}
            <kbd>R</kbd> pour recommencer. Les sons nécessitent un premier clic.
            L’onglet peut rester en arrière-plan ; la page doit rester ouverte
            pour jouer la cloche à l’heure.
          </p>
          <p className="hint credits">
            Projet de fan indépendant, sans affiliation à Bleach. Modèle
            personnel fourni : « fullbring Tensa Zangetsu - BLEACH » par{" "}
            <a
              href="https://sketchfab.com/worms845"
              target="_blank"
              rel="noreferrer"
            >
              worms845
            </a>
            , sous licence Sketchfab Standard. La lame incluse par défaut est
            une création originale.
          </p>
          <button className="primary-button" onClick={() => setHelpOpen(false)}>
            C’est parti <ArrowRight size={16} />
          </button>
        </Dialog>
      )}
    </div>
  );
}
