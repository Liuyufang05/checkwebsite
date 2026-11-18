import { motion, useReducedMotion } from "framer-motion";
import type { Mood } from "../../lib/scan";

/**
 * "The Angler" - an original hooded villain holding a fishing rod.
 * The rod tip sits at (228, 18) in the viewBox so the hero can attach a line to it.
 * Mood: idle = shifty, scanning = nervous, legitimate = foiled, phishing = busted (spotlit).
 */
export default function Phisher({ mood, className = "" }: { mood: Mood; className?: string }) {
  const reduce = useReducedMotion();
  const busted = mood === "phishing";
  const foiled = mood === "legitimate";
  const nervous = mood === "scanning";

  const grin = foiled
    ? "M96 150 Q112 140 128 150"
    : busted
      ? "M98 142 Q112 136 126 142 Q128 158 112 160 Q96 158 98 142 Z"
      : "M92 140 Q112 160 134 138";

  return (
    <motion.svg
      viewBox="0 0 240 250"
      className={className}
      role="img"
      aria-label={`Nhân vật Lừa gạt trông ${busted ? "bị phát hiện" : foiled ? "đã thất bại" : "rất xảo quyệt"}`}
      animate={
        reduce ? undefined : busted ? { x: [0, -5, 5, -5, 0], transition: { duration: 0.4, repeat: 3 } } : { rotate: [-1.5, 1.5, -1.5], transition: { duration: 6, repeat: Infinity } }
      }
      style={{ transformOrigin: "110px 240px" }}
    >
      <defs>
        <radialGradient id="angler-spot" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="rgb(var(--lure))" stopOpacity="0.45" />
          <stop offset="100%" stopColor="rgb(var(--lure))" stopOpacity="0" />
        </radialGradient>
      </defs>

      {busted && <motion.ellipse cx="112" cy="130" rx="120" ry="130" fill="url(#angler-spot)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />}

      {/* fishing rod */}
      <motion.g animate={{ rotate: foiled ? 18 : busted ? -8 : 0 }} style={{ transformOrigin: "160px 170px" }} transition={{ type: "spring", stiffness: 120 }}>
        <path d="M160 170 L228 18" stroke="#8FAAB6" strokeWidth="5" strokeLinecap="round" />
        <circle cx="168" cy="152" r="9" fill="none" stroke="#8FAAB6" strokeWidth="3" />
      </motion.g>

      {/* hooded cloak */}
      <path d="M40 240 C40 160 60 70 112 52 C164 70 184 160 184 240 Z" fill="#0A2238" stroke="#163A56" strokeWidth="3" />
      <path d="M70 110 C78 74 146 74 154 110 C156 150 136 176 112 176 C88 176 68 150 70 110 Z" fill="#04121F" />
      <path d="M112 52 C122 40 128 30 124 18" fill="none" stroke="#163A56" strokeWidth="6" strokeLinecap="round" />

      {/* glowing eyes */}
      {[94, 130].map((cx, i) => (
        <g key={cx}>
          <ellipse cx={cx} cy="114" rx="11" ry={busted ? 11 : foiled ? 3 : 6} fill="rgb(var(--lure))" opacity="0.95" />
          <motion.circle
            cx={cx} cy="114" r={busted ? 3 : 2.5} fill="#04121F"
            animate={reduce ? { x: 0 } : { x: nervous ? [-5, 5, -5] : [-4, 4, 4, -4] }}
            transition={{ duration: nervous ? 0.6 : 3.2, repeat: Infinity, delay: i * 0.02 }}
          />
          {!busted && (
            <path
              d={foiled ? `M${cx - 12} 108 L${cx + 12} 110` : `M${cx - 13} ${i ? 104 : 106} L${cx + 13} ${i ? 106 : 104}`}
              stroke="#0A2238" strokeWidth="5" strokeLinecap="round"
            />
          )}
        </g>
      ))}

      {/* grin */}
      <motion.path d={grin} initial={false} animate={{ d: grin }} fill={busted ? "rgb(var(--lure) / 0.3)" : "none"}
        stroke="rgb(var(--lure))" strokeWidth="3.5" strokeLinecap="round" />
      {!foiled && !busted && <path d="M104 146 L106 152 M116 148 L117 154" stroke="rgb(var(--lure))" strokeWidth="2.5" strokeLinecap="round" />}

      {/* nervous sweat */}
      {nervous && !reduce && (
        <motion.path d="M150 96 C146 104 146 108 150 110 C154 108 154 104 150 96 Z" fill="rgb(var(--biolume))"
          animate={{ y: [0, 18], opacity: [1, 0] }} transition={{ duration: 1.1, repeat: Infinity }} />
      )}

      {/* busted tag */}
      {busted && (
        <motion.g initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: -8 }} style={{ transformOrigin: "60px 200px" }}>
          <rect x="18" y="186" width="96" height="30" rx="8" fill="rgb(var(--lure))" />
          <text x="66" y="207" textAnchor="middle" fontSize="16" fontWeight="800" fill="rgb(var(--abyss))" fontFamily="Bricolage Grotesque Variable, sans-serif">Bị bắt</text>
        </motion.g>
      )}
    </motion.svg>
  );
}
