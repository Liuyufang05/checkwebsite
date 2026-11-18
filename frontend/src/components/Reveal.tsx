import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const LINES = ["Đang thả câu", "Có gì đó đang cắn câu", "Đang kéo lên"];

/** A bobber dipping on the water: ripples spread, bubbles rise, the caption tells the little fishing story. */
export function BobberLoader({ size = "md", duration }: { size?: "sm" | "md"; duration: number }) {
  // each caption stays up at least ~0.4s so it can actually be read
  const n = Math.max(1, Math.min(LINES.length, Math.floor(duration / 400)));
  const lines = n === 1 ? [LINES[2]] : n === 2 ? [LINES[0], LINES[2]] : LINES;
  const [i, setI] = useState(0);
  useEffect(() => {
    const step = duration / lines.length;
    const ts = lines.slice(1).map((_, k) => setTimeout(() => setI(k + 1), step * (k + 1)));
    return () => ts.forEach(clearTimeout);
  }, [duration, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const sm = size === "sm";
  const w = sm ? 72 : 112;
  const h = sm ? 48 : 72;
  const id = useId().replace(/:/g, "");

  return (
    <div role="status" aria-live="polite" className={`flex items-center ${sm ? "gap-3 py-3" : "justify-center gap-5 py-10"}`}>
      <svg viewBox="0 0 112 72" width={w} height={h} aria-hidden="true" className="shrink-0 overflow-visible">
        <defs>
          <linearGradient id={`fade${id}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.25" stopColor="#fff" />
            <stop offset="0.75" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={`water${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="112" height="72">
            <rect x="0" y="0" width="112" height="72" fill={`url(#fade${id})`} />
          </mask>
        </defs>
        <g mask={`url(#water${id})`}>
        {/* water surface: two drifting waves */}
        <motion.path d="M-40 40 q 14 -6 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0" fill="none" stroke="rgb(var(--biolume) / 0.55)" strokeWidth="2" strokeLinecap="round"
          animate={{ x: [0, 28] }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }} />
        <motion.path d="M-40 46 q 14 -4 28 0 t 28 0 t 28 0 t 28 0 t 28 0 t 28 0" fill="none" stroke="rgb(var(--biolume) / 0.22)" strokeWidth="1.5" strokeLinecap="round"
          animate={{ x: [28, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
        {/* ripples around the bobber */}
        {[0, 0.5].map((d) => (
          <motion.ellipse key={d} cx="56" cy="40" rx="10" ry="3" fill="none" stroke="rgb(var(--foam) / 0.6)" strokeWidth="1.2"
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, 2.6], opacity: [0.8, 0] }}
            style={{ transformOrigin: "56px 40px" }} transition={{ duration: 1, delay: d, repeat: Infinity, ease: "easeOut" }} />
        ))}
        {/* bubbles rising from below */}
        {[{ x: 40, d: 0 }, { x: 70, d: 0.35 }, { x: 62, d: 0.7 }].map((b) => (
          <motion.circle key={b.x} cx={b.x} cy="70" r="2.2" fill="none" stroke="rgb(var(--biolume) / 0.7)" strokeWidth="1.2"
            animate={{ cy: [72, 46], opacity: [0, 1, 0] }} transition={{ duration: 1.1, delay: b.d, repeat: Infinity, ease: "easeIn" }} />
        ))}
        </g>
        {/* line + bobber, dipping as if something nibbles */}
        <motion.g animate={{ y: [0, 0, 7, -1, 0], rotate: [0, -4, 6, -2, 0] }} style={{ transformOrigin: "56px 38px" }}
          transition={{ duration: 1, repeat: Infinity, times: [0, 0.35, 0.5, 0.7, 1], ease: "easeInOut" }}>
          <line x1="56" y1="-60" x2="56" y2="22" stroke="rgb(var(--foam) / 0.7)" strokeWidth="1.2" />
          <path d="M56 22 a 9 9 0 0 1 9 9 h -18 a 9 9 0 0 1 9 -9 z" fill="rgb(var(--lure))" />
          <path d="M47 31 h 18 a 9 9 0 0 1 -18 0 z" fill="rgb(var(--foam))" />
          <rect x="54.5" y="16" width="3" height="7" rx="1.5" fill="rgb(var(--lure))" />
        </motion.g>
      </svg>
      <span className={`whitespace-nowrap text-left font-display font-bold text-foam ${sm ? "min-w-[9rem] text-sm" : "min-w-[13rem] text-lg"}`}>
        <AnimatePresence mode="wait">
          <motion.span key={i} className="inline-block" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
            {lines[i]}
          </motion.span>
        </AnimatePresence>
        <motion.span className="inline-block text-biolume" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.9, repeat: Infinity }}>…</motion.span>
      </span>
      <span className="sr-only">Đang tải chi tiết</span>
    </div>
  );
}

/**
 * Collapsible area that, the first time it opens, shows the bobber for `wait` ms before the content swims in.
 * Height is measured and animated, so the loader-to-content swap stays smooth. Reduced motion: no loader, no delay.
 */
export default function Reveal({ open, children, wait = 900, size = "md" }: { open: boolean; children: ReactNode; wait?: number; size?: "sm" | "md" }) {
  const reduce = useReducedMotion();
  const seen = useRef(false);
  const [loading, setLoading] = useState(false);
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (seen.current || reduce) { seen.current = true; return; }
    seen.current = true;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), wait);
    return () => { clearTimeout(t); setLoading(false); };
  }, [open, reduce, wait]);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    setHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div key="reveal" className="overflow-hidden"
          initial={{ height: 0, opacity: 0 }} animate={{ height, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}>
          <div ref={inner}>
            {loading ? (
              <BobberLoader size={size} duration={wait} />
            ) : (
              <motion.div initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                {children}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
