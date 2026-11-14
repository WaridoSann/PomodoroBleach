import { useEffect, useRef, useState } from "react";
import { RotateCcw, Move, LoaderCircle } from "lucide-react";
import { SwordScene } from "./sword-scene";
import { readModel } from "./model-store";

export default function SwordView({
  motion,
  running,
  level,
  modelVersion,
  onModelName,
}: {
  motion: boolean;
  running: boolean;
  level: number;
  modelVersion: number;
  onModelName: (name: string) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<SwordScene | null>(null);
  const [error, setError] = useState("");
  const [webglError, setWebglError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!mount.current) return;
    try {
      scene.current = new SwordScene(mount.current);
    } catch {
      setWebglError(true);
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    scene.current?.update(motion, running, level);
  }, [motion, running, level]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void readModel()
      .then(async (model) => {
        if (cancelled || !scene.current) return;
        await scene.current.load(model);
        if (!cancelled)
          onModelName(model ? "Tensa Zangetsu" : "Lame originelle");
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Le modèle enregistré n’a pas pu être chargé. Vous pouvez le réimporter dans les réglages.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelVersion, onModelName]);
  return (
    <>
      <div ref={mount} className="sword-canvas" />
      {loading && (
        <div className="model-loading">
          <LoaderCircle size={15} className="spin" /> Préparation de la lame
        </div>
      )}
      {(error || webglError) && (
        <p className="model-error" role="status">
          {webglError
            ? "La vue 3D nécessite WebGL. Essayez un navigateur récent avec l’accélération graphique activée."
            : error}
        </p>
      )}
      <div className="scene-controls">
        <span>
          <Move size={12} /> Faites glisser pour explorer
        </span>
        <button
          className="icon-button"
          onClick={() => scene.current?.resetView()}
          aria-label="Recentrer le sabre"
          title="Recentrer le sabre"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </>
  );
}
