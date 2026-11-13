import { useEffect, useRef, useState } from "react";
import { celebrationCast, celebrationMessage } from "@/lib/pit/celebration-cast";
import { CHAMPIONSHIP_OPENING_MS, createCelebrationClock } from "@/lib/pit/championship-opening";
import { createFrameLoop } from "@/lib/pit/frame-loop";
import type { PitData } from "@/lib/pit/types";
import { paintCelebration } from "./team-janelle-scene";
import "./team-janelle-opening.css";

export function TeamJanelleOpening({ data, playing, onComplete }: { data: PitData; playing: boolean; onComplete: () => void }) {
  const [cast] = useState(() => celebrationCast(data));
  const [clock] = useState(createCelebrationClock);
  const [second, setSecond] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completed = useRef(false);
  const completion = useRef(onComplete);
  completion.current = onComplete;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    clock.suspend();
    const loop = createFrameLoop((now) => {
      const elapsed = playing ? clock.tick(now) : clock.elapsed;
      const seconds = elapsed / 1000;
      if (ctx) paintCelebration(ctx, canvas.width, canvas.height, cast, seconds, motion.matches);
      setSecond(Math.floor(seconds));
      if (playing && elapsed >= CHAMPIONSHIP_OPENING_MS && !completed.current) {
        completed.current = true;
        completion.current();
      }
      return playing && !completed.current;
    });
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      loop.invalidate();
    };
    let visible = true;
    const visibility = () => { clock.suspend(); loop.setVisible(visible && !document.hidden); };
    const changedMotion = () => loop.invalidate();
    const observer = new ResizeObserver(resize);
    const intersection = new IntersectionObserver((rows) => { visible = rows.some((row) => row.isIntersecting); visibility(); });
    observer.observe(canvas);
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", changedMotion);
    resize();
    visibility();
    return () => { clock.suspend(); loop.dispose(); observer.disconnect(); intersection.disconnect(); document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", changedMotion); };
  }, [cast, clock, playing]);
  return <section className="janelle-opening" aria-label="Team Janelle championship celebration" data-testid="team-janelle-opening">
    <header className="janelle-opening-heading">
      <p className="janelle-opening-kicker">Before the bell, we stand together</p>
      <h2><span aria-hidden="true">♥</span> Team Janelle</h2>
      <p className="janelle-opening-message" role="status" aria-live="polite" aria-atomic="true">{celebrationMessage(second)}</p>
    </header>
    <canvas ref={canvasRef} className="janelle-opening-stage" aria-label={`${cast.length} store bots together in a celebration for Team Janelle`} />
    <p className="sr-only">Celebrating together: {cast.map((bot) => `${bot.storeName}, ${bot.botName}`).join("; ")}.</p>
    <footer className="janelle-opening-footer"><span>{cast.length} stores · One team</span><span>{playing ? "The fights follow this celebration" : "Celebration paused"}</span></footer>
    <div className="janelle-opening-progress" aria-hidden="true"><span style={{ width: `${second * 1000 / CHAMPIONSHIP_OPENING_MS * 100}%` }} /></div>
  </section>;
}
