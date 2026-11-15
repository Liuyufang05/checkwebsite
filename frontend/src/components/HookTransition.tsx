import { useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** Timing shared with the page "reel up" exit in App.tsx. */
export const HOOK_TOTAL = 4.2;
/** Page: still while the hook drops (0-0.5s), tug (0.5-0.65s), reeled away (0.65-1.5s). */
export const PAGE_EXIT = { duration: 1.5, times: [0, 0.5 / 1.5, 0.65 / 1.5, 1] };
export const REEL_EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];
/** seconds -> fraction of the hook timeline */
const at = (s: number) => s / HOOK_TOTAL;

const TITLES: [RegExp, string][] = [
  [/^\/$/, "The scanner"],
  [/^\/research/, "Inside the models"],
  [/^\/history/, "Recent scans"],
  [/^\/scan\//, "Scan report"],
];
const titleFor = (path: string) => TITLES.find(([re]) => re.test(path))?.[1] ?? "Lost at sea";

/** Original fish illustration with a luggage tag naming the destination page. */
function Fish({ label }: { label: string }) {
  return (
    <g>
      {/* tag string + tag */}
      <path d="M0 52 L0 92" stroke="rgb(var(--mist))" strokeWidth="1.5" />
      <g transform="translate(0 92)">
        <rect x={-label.length * 5.2 - 18} y="0" width={label.length * 10.4 + 36} height="40" rx="12" fill="rgb(var(--biolume))" />
        <circle cx={-label.length * 5.2 - 6} cy="20" r="4" fill="rgb(var(--abyss))" />
        <text x="6" y="26" textAnchor="middle" fontSize="17" fontWeight="800" fill="rgb(var(--abyss))"
          fontFamily='"Bricolage Grotesque Variable", system-ui, sans-serif'>{label}</text>
      </g>
      {/* fish body, hanging nose-up from the hook */}
      <g transform="translate(0 4)">
        <path d="M0 0 C 22 6 30 26 26 44 C 22 60 8 66 0 68 C -8 66 -22 60 -26 44 C -30 26 -22 6 0 0 Z" fill="rgb(var(--lure))" />
        <path d="M0 66 L -16 88 L 0 80 L 16 88 Z" fill="rgb(var(--lure))" />
        <path d="M-14 30 C -4 34 4 34 14 30" fill="none" stroke="rgb(var(--abyss) / 0.35)" strokeWidth="2" strokeLinecap="round" />
        <path d="M-12 42 C -4 46 4 46 12 42" fill="none" stroke="rgb(var(--abyss) / 0.35)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="-9" cy="14" r="5" fill="rgb(var(--foam))" /><circle cx="-9" cy="14" r="2.4" fill="rgb(var(--abyss))" />
        <circle cx="9" cy="14" r="5" fill="rgb(var(--foam))" /><circle cx="9" cy="14" r="2.4" fill="rgb(var(--abyss))" />
        <path d="M24 30 L 36 22 L 32 36 Z" fill="rgb(var(--lure))" />
        <path d="M-24 30 L -36 22 L -32 36 Z" fill="rgb(var(--lure))" />
      </g>
    </g>
  );
}

/**
 * On every route change: a hook drops from the top, bites the old page (which App.tsx animates up and away),
 * then swings back carrying a fish whose tag names the page you just arrived on.
 */
export default function HookTransition() {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  const first = useRef(true);
  const [run, setRun] = useState<{ id: number; label: string } | null>(null);

  // layout effect: the hook starts in the same frame as the page exit, so the two never drift apart
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    setRun({ id: Date.now(), label: titleFor(pathname) });
    const t = setTimeout(() => setRun(null), HOOK_TOTAL * 1000 + 100);
    return () => clearTimeout(t);
  }, [pathname, reduce]);

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const bite = vh * 0.22;

  return (
    <AnimatePresence>
      {run && (
        <motion.div key={run.id} className="pointer-events-none fixed inset-0 z-[85] overflow-hidden" aria-hidden="true"
          initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
          {/* an HTML wrapper animated with a `transform` string runs on the compositor (smooth even when busy) */}
          <motion.div
            className="absolute left-1/2 top-0 h-0 w-0"
            initial={{ transform: "translateY(-120px)" }}
            animate={{ transform: [-120, bite, bite + 14, -vh * 0.95, -vh * 0.95, vh * 0.17, vh * 0.13, vh * 0.155, vh * 0.135, vh * 0.15, -vh * 0.75].map((y) => `translateY(${y}px)`) }}
            transition={{
              duration: HOOK_TOTAL,
              // one ease per segment; the reel-up segment uses the page's curve so the hook stays on its bite point
              ease: Array.from({ length: 10 }, (_, i) => (i === 2 ? REEL_EASE : "easeInOut")),
              // drop, tug, reel page away, pause, lower the catch, bob while it hangs (~1.6s), reel out
              times: [0, at(0.5), at(0.65), at(1.5), at(1.65), at(2.3), at(2.65), at(3.0), at(3.3), at(3.55), 1],
            }}
          >
          <svg className="absolute left-0 top-0 overflow-visible" width="1" height="1">
            {/* the line runs far above the viewport so it always reaches the "rod" */}
            <line x1="0" y1="-3000" x2="0" y2="0" stroke="rgb(var(--foam) / 0.8)" strokeWidth="1.6" />
            <motion.g
              animate={{ rotate: [0, -10, 8, -3, 0, 0, -6, 4, -2, 0] }}
              transition={{ duration: HOOK_TOTAL, times: [0, at(0.3), at(0.5), at(0.6), at(0.7), at(2.2), at(2.6), at(3.0), at(3.4), 1] }}
            >
              {/* swivel + hook */}
              <circle cx="0" cy="4" r="4" fill="none" stroke="rgb(var(--foam))" strokeWidth="2" />
              <path d="M0 8 L0 40 C0 62 -26 62 -26 44 L-19 36" fill="none" stroke="rgb(var(--foam))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {/* the catch appears once the old page is gone */}
              <motion.g
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: [0, 0, 1, 1], scale: [0.6, 0.6, 1, 1], rotate: [0, 0, 14, -10, 7, -4, 0] }}
                transition={{
                  opacity: { duration: HOOK_TOTAL, times: [0, at(1.6), at(1.85), 1] },
                  scale: { duration: HOOK_TOTAL, times: [0, at(1.6), at(1.95), 1] },
                  rotate: { duration: HOOK_TOTAL, times: [0, at(2.2), at(2.55), at(2.9), at(3.25), at(3.55), 1] },
                }}
                style={{ transformOrigin: "-13px 52px" }}
              >
                <g transform="translate(-13 52)"><Fish label={run.label} /></g>
              </motion.g>
            </motion.g>
          </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
