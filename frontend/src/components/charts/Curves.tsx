import { motion } from "framer-motion";
import type { ModelResult } from "../../lib/types";

export const SERIES = ["#4FF0D2", "#FF6A3D", "#FFC94A", "#8AB4FF", "#C792EA", "#7CE38B", "#F78FB3", "#5CC8FF", "#E2E86C", "#FF9E64", "#B4F8C8", "#A0A8FF"];

/** ROC or Precision-Recall curves for all models, with one highlighted. */
export default function Curves({ models, kind, highlight, onHover }: {
  models: ModelResult[]; kind: "roc" | "pr"; highlight: string | null; onHover: (n: string | null) => void;
}) {
  const W = 420, H = 340, P = 40;
  const sx = (v: number) => P + v * (W - P - 12);
  const sy = (v: number) => H - P - v * (H - P - 34);
  const path = (m: ModelResult) => {
    const xs = kind === "roc" ? m.curves.fpr : m.curves.recall;
    const ys = kind === "roc" ? m.curves.tpr : m.curves.precision;
    return xs.map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join(" ");
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${kind === "roc" ? "ROC" : "Độ chuẩn xác - độ nhạy"} cho ${models.length} mô hình`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(0)} x2={sx(1)} y1={sy(t)} y2={sy(t)} stroke="rgb(var(--reef))" strokeDasharray="2 4" />
          <text x={P - 8} y={sy(t) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--mist))">{t}</text>
          <text x={sx(t)} y={H - P + 16} textAnchor="middle" fontSize="10" fill="rgb(var(--mist))">{t}</text>
        </g>
      ))}
      <text x={(W + P) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="rgb(var(--mist))">{kind === "roc" ? "Tỷ lệ dương tính giả" : "Độ nhạy"}</text>
      <text x={P + 6} y={22} fontSize="11" fill="rgb(var(--mist))">{kind === "roc" ? "Tỷ lệ dương tính thật" : "Độ chuẩn xác"}</text>
      {kind === "roc" && <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="rgb(var(--mist) / 0.4)" strokeDasharray="4 4" />}
      {models.map((m, i) => {
        const on = highlight === null || highlight === m.name;
        return (
          <motion.path key={m.name} d={path(m)} fill="none" stroke={SERIES[i % SERIES.length]}
            strokeWidth={highlight === m.name ? 3 : 1.6} strokeOpacity={on ? 1 : 0.15}
            initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
            transition={{ duration: 1.4, delay: i * 0.05, ease: "easeInOut" }}
            onPointerEnter={() => onHover(m.name)} onPointerLeave={() => onHover(null)} style={{ cursor: "pointer" }}
          />
        );
      })}
    </svg>
  );
}
