import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BotLookProps } from "../bot-portrait";
import type { GarageLook } from "@/lib/pit/types";
import type { GarageScene } from "./scene";

export function GarageViewer({
  look,
  floor,
  fallback,
}: {
  look: BotLookProps | null;
  floor: GarageLook;
  fallback: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GarageScene | null>(null);
  const latest = useRef({ look, floor });
  latest.current = { look, floor };
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const key = JSON.stringify(look);
  const hasLook = Boolean(look);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      if (preference.matches) setPlaying(false);
    };
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    if (mode !== "3d" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    let stopped = false,
      started = false,
      visible = false;
    setReady(false);
    const fail = () => {
      if (stopped) return;
      setFailed(true);
      setMode("2d");
      setPlaying(false);
    };
    const start = async () => {
      if (started || !latest.current.look) return;
      started = true;
      try {
        const { createGarageScene } = await import("./scene");
        if (stopped) return;
        const instance = createGarageScene(canvas, () => setPlaying(false), fail);
        sceneRef.current = instance;
        instance.setVisible(visible);
        instance.update(latest.current.look!, latest.current.floor);
        setReady(true);
      } catch {
        fail();
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false;
        sceneRef.current?.setVisible(visible);
        if (visible) void start();
      },
      { rootMargin: "100px" },
    );
    observer.observe(canvas);
    return () => {
      stopped = true;
      observer.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [mode, hasLook]);

  useEffect(() => {
    if (!sceneRef.current || !look) return;
    try {
      sceneRef.current.update(look, floor);
    } catch {
      setFailed(true);
      setMode("2d");
      setPlaying(false);
    }
    // The serialized key includes all visual equipment and local crew proposal fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, floor]);
  useEffect(() => {
    sceneRef.current?.setPlaying(playing);
  }, [playing, ready]);

  if (!look) return <>{fallback}</>;
  const buttonClass =
    "min-h-11 border border-line bg-deep px-3 text-xs font-display uppercase tracking-wide text-fg hover:border-amber focus-visible:outline-2 focus-visible:outline-amber disabled:opacity-40";
  return (
    <div data-testid="garage-3d-viewer" className="min-w-0 border border-line bg-deep">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="text-xs tracking-widest text-amber uppercase">
          {mode === "3d" ? "3D Garage" : "Classic view"}
        </p>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setMode(mode === "3d" ? "2d" : "3d");
            setFailed(false);
            setPlaying(false);
          }}
        >
          {mode === "3d" ? "Use 2D view" : "Try 3D view"}
        </button>
      </div>
      {mode === "3d" ? (
        <>
          <div className="relative h-[340px] w-full sm:h-[400px] xl:h-[440px]">
            <canvas
              ref={canvasRef}
              className="block h-full w-full touch-none"
              role="img"
              aria-label={`3D view of ${look.storeName}'s bot with its selected appearance. Drag to orbit or use the controls below.`}
              data-testid="garage-3d-canvas"
            />
            {!ready ? (
              <div
                className="pointer-events-none absolute inset-0 grid place-items-center bg-deep text-sm text-muted"
                role="status"
              >
                Preparing your bot…
              </div>
            ) : null}
          </div>
          <div
            className="flex flex-wrap gap-2 border-t border-line p-3"
            aria-label="3D bot view controls"
          >
            <button
              type="button"
              disabled={!ready}
              className={buttonClass}
              aria-pressed={playing}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? "Pause rotation" : "Rotate bot"}
            </button>
            <button
              type="button"
              disabled={!ready}
              className={buttonClass}
              onClick={() => {
                setPlaying(false);
                sceneRef.current?.reset();
              }}
            >
              Reset view
            </button>
            <button
              type="button"
              disabled={!ready}
              className={buttonClass}
              aria-label="Zoom in on bot"
              onClick={() => sceneRef.current?.zoom(0.85)}
            >
              Zoom +
            </button>
            <button
              type="button"
              disabled={!ready}
              className={buttonClass}
              aria-label="Zoom out from bot"
              onClick={() => sceneRef.current?.zoom(1.15)}
            >
              Zoom −
            </button>
          </div>
          <p className="px-3 pb-3 text-xs text-muted">
            Drag to look around. Pinch or use Zoom to inspect. Reset view fits the whole bot,
            including flags and toppers.
          </p>
        </>
      ) : (
        <div className="p-3">
          {failed ? (
            <p className="mb-3 text-sm text-muted" role="status">
              3D is unavailable on this device right now. Your bot and editing controls are
              available in the classic view.
            </p>
          ) : null}
          {fallback}
        </div>
      )}
    </div>
  );
}
