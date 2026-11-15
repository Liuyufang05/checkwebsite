import { motion, useReducedMotion } from "framer-motion";
import type { Mood } from "../../lib/scan";

const COLOR: Record<Mood, string> = {
  idle: "var(--biolume)", scanning: "var(--biolume)", legitimate: "var(--biolume)",
  suspicious: "var(--kelp)", phishing: "var(--lure)", error: "var(--mist)",
};

/** Sonar radar. Sweeps while scanning; settles into the verdict colour. */
export default function Radar({ mood, size = 280 }: { mood: Mood; size?: number }) {
  const reduce = useReducedMotion();
  const c = COLOR[mood];
  const sweeping = mood === "scanning" && !reduce;
  const blips = [
    [0.62, 0.28], [0.3, 0.4], [0.72, 0.66], [0.42, 0.74], [0.55, 0.5],
  ];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <div className="absolute inset-0 rounded-full border" style={{ borderColor: `rgb(${c} / 0.5)`, background: `radial-gradient(circle, rgb(${c} / 0.08), transparent 70%)` }} />
      {[0.25, 0.5, 0.75].map((r) => (
        <div key={r} className="absolute rounded-full border" style={{ inset: `${r * 50}%`, borderColor: `rgb(${c} / 0.22)` }} />
      ))}
      <div className="absolute left-1/2 top-0 h-full w-px" style={{ background: `rgb(${c} / 0.15)` }} />
      <div className="absolute left-0 top-1/2 h-px w-full" style={{ background: `rgb(${c} / 0.15)` }} />
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(from 0deg, rgb(${c} / 0.55), transparent 22%)`, opacity: sweeping ? 1 : 0.25 }}
        animate={sweeping ? { rotate: 360 } : { rotate: 0 }}
        transition={sweeping ? { duration: 2.2, repeat: Infinity, ease: "linear" } : { duration: 0.6 }}
      />
      {blips.map(([x, y], i) => (
        <motion.span
          key={i}
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${x * 100}%`, top: `${y * 100}%`, background: `rgb(${i === 0 && mood === "phishing" ? "var(--lure)" : c})` }}
          animate={sweeping ? { opacity: [0, 1, 0], scale: [0.6, 1.4, 0.6] } : { opacity: mood === "idle" ? 0.25 : 0.8, scale: 1 }}
          transition={sweeping ? { duration: 2.2, delay: i * 0.37, repeat: Infinity } : { duration: 0.4 }}
        />
      ))}
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: `rgb(${c})`, boxShadow: `0 0 24px rgb(${c})` }} />
    </div>
  );
}
