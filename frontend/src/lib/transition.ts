/**
 * Tracks the page-change animation so heavy work (ScrollTrigger recalculation, the WebGL scene) can wait
 * until the old page has been reeled away instead of stuttering it mid-flight.
 */
let busyUntil = 0;

export function markTransition(ms: number) {
  busyUntil = performance.now() + ms;
}

/** Milliseconds until the current page transition has finished (0 if none). */
export function transitionLeft(): number {
  return Math.max(0, busyUntil - performance.now());
}

/** Run `fn` after at least `minMs`, and never while a page transition is in flight. Returns a cancel function. */
export function afterTransition(fn: () => void, minMs = 0): () => void {
  let t: ReturnType<typeof setTimeout>;
  const go = () => {
    const left = transitionLeft();
    if (left > 0) t = setTimeout(go, left + 60);
    else fn();
  };
  t = setTimeout(go, minMs);
  return () => clearTimeout(t);
}
