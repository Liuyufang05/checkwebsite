import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** One orchestrated load moment: a sonar ping draws the mark, then the curtain lifts. */
export default function Intro() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem("pg-intro"); } catch { return true; }
  });

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      setShow(false);
      try { sessionStorage.setItem("pg-intro", "1"); } catch { /* storage unavailable */ }
    }, reduce ? 300 : 1900);
    return () => clearTimeout(t);
  }, [show, reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center bg-abyss"
          exit={{ clipPath: "inset(0 0 100% 0)", transition: { duration: 0.9, ease: [0.76, 0, 0.24, 1] } }}
          aria-hidden="true"
        >
          <div className="relative grid place-items-center">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="absolute h-56 w-56 rounded-full border border-biolume/50"
                initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.6, delay: i * 0.3, ease: "easeOut" }} />
            ))}
            <svg viewBox="0 0 64 64" className="h-20 w-20">
              <motion.path d="M32 8l18 7v14c0 12-8 21-18 27-10-6-18-15-18-27V15z" fill="none" stroke="rgb(var(--biolume))"
                strokeWidth="3" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeInOut" }} />
              <motion.path d="M36 20v16a6 6 0 1 1-12 0" fill="none" stroke="rgb(var(--lure))" strokeWidth="3" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.7 }} />
            </svg>
            <motion.p className="mt-6 font-display text-2xl font-extrabold tracking-tight"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
              PhishGuard
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
