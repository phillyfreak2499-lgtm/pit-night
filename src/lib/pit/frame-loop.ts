type Environment = { request: (cb: (now: number) => void) => number; cancel: (id: number) => void };
/** No idle timer: drawing continues only while the renderer explicitly needs motion. */
export function createFrameLoop(
  draw: (now: number, dt: number) => boolean,
  env: Environment = {
    request: (cb) => requestAnimationFrame(cb),
    cancel: (id) => cancelAnimationFrame(id),
  },
) {
  let id = 0,
    visible = true,
    disposed = false,
    last: number | null = null;
  function invalidate() {
    if (!disposed && visible && !id) id = env.request(frame);
  }
  function frame(now: number) {
    id = 0;
    if (disposed || !visible) return;
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    if (draw(now, dt)) invalidate();
    else last = null;
  }
  return {
    invalidate,
    setVisible(next: boolean) {
      visible = next;
      last = null;
      if (!next && id) {
        env.cancel(id);
        id = 0;
      }
      if (next) invalidate();
    },
    dispose() {
      disposed = true;
      if (id) env.cancel(id);
      id = 0;
    },
  };
}
