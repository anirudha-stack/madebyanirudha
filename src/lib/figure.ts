// Small helpers shared by the in-post figures (CornerCompare, ArcGeometry,
// OmegaCap). Figures never move on their own: motion starts from a button,
// and under prefers-reduced-motion it jumps straight to the finished frame.

export const reducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Run `frame(p)` for p = 0..1 over `ms`. Returns a cancel function. */
export function play(ms: number, frame: (p: number) => void, done?: () => void): () => void {
  if (reducedMotion()) {
    frame(1);
    done?.();
    return () => {};
  }
  let raf = 0;
  const t0 = performance.now();
  const tick = (now: number) => {
    const p = Math.min((now - t0) / ms, 1);
    frame(p);
    if (p < 1) raf = requestAnimationFrame(tick);
    else done?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export const f1 = (n: number): string => n.toFixed(1);
