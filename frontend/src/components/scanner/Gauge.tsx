import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import type { Verdict } from "../../lib/types";

/** Semicircular risk gauge, 0-100, with zone bands at the decision thresholds. */
export default function Gauge({ value, verdict, thresholds }: { value: number; verdict: Verdict; thresholds: { suspicious: number; phishing: number } }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    const c = animate(0, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [value, reduce]);

  const R = 120, CX = 150, CY = 150;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => [CX + R * Math.cos(Math.PI * (1 - a)), CY - R * Math.sin(Math.PI * (1 - a))];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
  };
  const color = verdict === "phishing" ? "rgb(var(--lure))" : verdict === "suspicious" ? "rgb(var(--kelp))" : "rgb(var(--biolume))";
  const angle = -90 + (shown / 100) * 180;

  return (
    <svg viewBox="0 0 300 180" className="w-full max-w-[360px]" role="img" aria-label={`Risk score ${value} out of 100`}>
      <path d={arc(0, thresholds.suspicious)} stroke="rgb(var(--biolume) / 0.35)" strokeWidth="16" fill="none" strokeLinecap="round" />
      <path d={arc(thresholds.suspicious + 0.01, thresholds.phishing)} stroke="rgb(var(--kelp) / 0.35)" strokeWidth="16" fill="none" />
      <path d={arc(thresholds.phishing + 0.01, 1)} stroke="rgb(var(--lure) / 0.35)" strokeWidth="16" fill="none" strokeLinecap="round" />
      <motion.path d={arc(0, Math.max(0.001, shown / 100))} stroke={color} strokeWidth="16" fill="none" strokeLinecap="round" />
      <g transform={`rotate(${angle} ${CX} ${CY})`}>
        <path d={`M ${CX - 4} ${CY} L ${CX} ${CY - 98} L ${CX + 4} ${CY} Z`} fill="rgb(var(--foam))" />
      </g>
      <circle cx={CX} cy={CY} r="9" fill="rgb(var(--foam))" />
      <text x={CX} y={CY - 40} textAnchor="middle" className="font-display" fontSize="44" fontWeight="800" fill="rgb(var(--foam))">{shown}</text>
      <text x="30" y="175" fontSize="11" fill="rgb(var(--mist))">An toàn</text>
      <text x="270" y="175" textAnchor="end" fontSize="11" fill="rgb(var(--mist))">Lừa đảo</text>
    </svg>
  );
}
