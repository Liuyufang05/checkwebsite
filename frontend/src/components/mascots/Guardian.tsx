import { motion, useReducedMotion } from "framer-motion";
import type { Mood } from "../../lib/scan";

/**
 * "Lumen" - an original shield-shaped lanternfish detective.
 * Đèn trên ăng-ten đổi màu theo kết quả quét.
 */
const LANTERN: Record<Mood, string> = {
  idle: "rgb(var(--biolume))",
  scanning: "rgb(var(--biolume))",
  legitimate: "rgb(var(--biolume))",
  suspicious: "rgb(var(--kelp))",
  phishing: "rgb(var(--lure))",
  error: "rgb(var(--mist))",
};

const MOUTH: Record<Mood, string> = {
  idle: "M92 150 Q110 162 128 150",
  scanning: "M102 152 Q110 148 118 152 Q110 160 102 152",
  legitimate: "M86 146 Q110 176 134 146 Z",
  suspicious: "M92 154 Q101 148 110 154 Q119 160 128 152",
  phishing: "M98 148 Q110 140 122 148 Q124 166 110 168 Q96 166 98 148 Z",
  error: "M94 156 L126 156",
};

export default function Guardian({ mood, className = "" }: { mood: Mood; className?: string }) {
  const reduce = useReducedMotion();
  const celebrating = mood === "legitimate";
  const alarmed = mood === "phishing";
  const scanning = mood === "scanning";

  return (
    <motion.svg
      viewBox="0 0 220 250"
      className={className}
      role="img"
      aria-label={`Lumen the guardian looks ${mood === "idle" ? "ready" : mood}`}
      animate={
        reduce
          ? undefined
          : alarmed
            ? { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.5, repeat: 2 } }
            : celebrating
              ? { y: [0, -22, 0, -12, 0], transition: { duration: 0.9 } }
              : { y: [0, -8, 0], transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" } }
      }
    >
      <defs>
        <radialGradient id="lumen-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={LANTERN[mood]} stopOpacity="0.9" />
          <stop offset="100%" stopColor={LANTERN[mood]} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lumen-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--reef))" />
          <stop offset="100%" stopColor="rgb(var(--trench))" />
        </linearGradient>
      </defs>

      {/* antenna + lantern */}
      <path d="M110 64 C110 40 128 30 140 22" fill="none" stroke="rgb(var(--mist))" strokeWidth="3" strokeLinecap="round" />
      <motion.circle
        cx="142" cy="20" r="26" fill="url(#lumen-glow)"
        animate={reduce ? undefined : { scale: scanning || alarmed ? [1, 1.35, 1] : [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: scanning || alarmed ? 0.7 : 2.6, repeat: Infinity }}
        style={{ transformOrigin: "142px 20px" }}
      />
      <circle cx="142" cy="20" r="7" fill={LANTERN[mood]} />

      {/* arms (raise on celebration) */}
      <motion.path
        d="M52 150 C30 150 22 132 26 118" fill="none" stroke="rgb(var(--biolume))" strokeWidth="9" strokeLinecap="round"
        animate={{ rotate: celebrating ? 52 : alarmed ? 18 : 0 }}
        style={{ transformOrigin: "52px 150px" }}
        transition={{ type: "spring", stiffness: 180, damping: 12 }}
      />

      {/* shield body */}
      <path
        d="M110 62 L176 84 L176 140 C176 186 146 214 110 232 C74 214 44 186 44 140 L44 84 Z"
        fill="url(#lumen-body)" stroke="rgb(var(--biolume))" strokeWidth="4" strokeLinejoin="round"
      />
      <motion.path
        d="M110 62 L176 84 L176 140 C176 186 146 214 110 232 C74 214 44 186 44 140 L44 84 Z"
        fill="rgb(var(--lure))" initial={false} animate={{ opacity: alarmed ? [0, 0.35, 0, 0.35, 0] : 0 }}
        transition={{ duration: 1.2 }}
      />
      <path d="M110 190 C128 186 140 176 146 162" fill="none" stroke="rgb(var(--biolume) / 0.35)" strokeWidth="3" strokeLinecap="round" />

      {/* detective cap */}
      <path d="M58 86 C70 54 150 54 162 86 Z" fill="rgb(var(--foam))" opacity="0.92" />
      <path d="M48 88 L172 88" stroke="rgb(var(--foam))" strokeWidth="7" strokeLinecap="round" />
      <path d="M84 70 L136 70" stroke="rgb(var(--trench))" strokeWidth="4" strokeLinecap="round" opacity="0.5" />

      {/* eyes */}
      {[86, 134].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="122" rx="15" ry={alarmed ? 18 : 15} fill="rgb(var(--foam))" />
          <motion.circle
            cx={cx} cy="124" r={alarmed ? 5 : 7} fill="rgb(var(--abyss))"
            animate={{ x: scanning ? [-6, 6, -6] : mood === "suspicious" ? 5 : 0 }}
            transition={scanning ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
          />
          {/* eyelid blink */}
          <motion.rect
            x={cx - 16} y="105" width="32" height="34" rx="16" fill="rgb(var(--reef))"
            initial={{ scaleY: 0 }}
            animate={reduce ? { scaleY: 0 } : { scaleY: [0, 0, 1, 0] }}
            transition={{ duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity }}
            style={{ transformOrigin: `${cx}px 105px` }}
          />
        </g>
      ))}
      {mood === "suspicious" && <path d="M120 98 L148 92" stroke="rgb(var(--foam))" strokeWidth="4" strokeLinecap="round" />}

      {/* mouth */}
      <motion.path
        d={MOUTH[mood]} initial={false} animate={{ d: MOUTH[mood] }}
        fill={celebrating || alarmed ? "rgb(var(--abyss))" : "none"}
        stroke="rgb(var(--foam))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      />

      {/* magnifying glass arm (sweeps while scanning) */}
      <motion.g
        animate={scanning && !reduce ? { rotate: [-14, 14, -14] } : { rotate: celebrating ? -30 : 0 }}
        transition={scanning ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 160 }}
        style={{ transformOrigin: "168px 160px" }}
      >
        <path d="M168 160 C186 156 194 146 196 134" fill="none" stroke="rgb(var(--biolume))" strokeWidth="9" strokeLinecap="round" />
        <circle cx="198" cy="118" r="17" fill="rgb(var(--biolume) / 0.12)" stroke="rgb(var(--foam))" strokeWidth="5" />
        <path d="M190 112 Q194 106 201 107" fill="none" stroke="rgb(var(--foam))" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      </motion.g>

      {/* celebration sparks / alarm marks */}
      {celebrating &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <motion.circle
            key={i} r="4" fill={i % 2 ? "rgb(var(--kelp))" : "rgb(var(--biolume))"}
            cx={110} cy={60}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(i) * 90, y: -20 + Math.sin(i * 2) * 50, opacity: 0 }}
            transition={{ duration: 1.1, delay: i * 0.05 }}
          />
        ))}
      {alarmed && (
        <motion.text
          x="22" y="60" fontSize="44" fontWeight="800" fill="rgb(var(--lure))"
          animate={reduce ? undefined : { opacity: [1, 0.2, 1] }} transition={{ duration: 0.5, repeat: Infinity }}
        >
          !
        </motion.text>
      )}
    </motion.svg>
  );
}
