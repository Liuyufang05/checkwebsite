import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import { ms, num, pct, SET_LABEL } from "../lib/format";
import type { FeatureSetResult, ModelResult, Results } from "../lib/types";
import Curves, { SERIES } from "../components/charts/Curves";

type Metric = "f1" | "accuracy" | "precision" | "recall" | "roc_auc" | "pr_auc";
const METRICS: { key: Metric; label: string }[] = [
  { key: "f1", label: "F1" }, { key: "accuracy", label: "Độ chính xác" }, { key: "precision", label: "Độ chuẩn xác" },
  { key: "recall", label: "Độ nhạy" }, { key: "roc_auc", label: "ROC-AUC" }, { key: "pr_auc", label: "PR-AUC" },
];
const ORDER: ("url" | "content" | "uci")[] = ["url", "content", "uci"];
const INTRO: Record<string, string> = {
  url: "Huấn luyện trên 80.000 URL từ hai nguồn, được chia sao cho website không xuất hiện đồng thời trong dữ liệu huấn luyện và thử nghiệm. Đây là mô hình đánh giá liên kết bạn dán.",
  content: "Huấn luyện trên 60.000 trang từ PhiUSIIL bằng các đặc trưng HTML có thể tính lại từ trang trực tiếp. Mô hình chạy khi trang tải được.",
  uci: "Bộ chuẩn UCI kinh điển với 30 đặc trưng được thiết kế thủ công. Một số phụ thuộc dịch vụ đã ngừng hoạt động (Alexa rank, PageRank), nên chỉ được dùng để so sánh, không dùng trực tiếp.",
};

function Leaderboard({ models, best, metric, highlight, setHighlight }: {
  models: ModelResult[]; best: string; metric: Metric; highlight: string | null; setHighlight: (n: string | null) => void;
}) {
  const sorted = [...models].sort((a, b) => b.test[metric] - a.test[metric]);
  const lo = Math.min(...sorted.map((m) => m.test[metric]));
  const floor = Math.max(0, lo - 0.05);
  return (
    <ol className="space-y-1.5">
      {sorted.map((m, i) => {
        const w = ((m.test[metric] - floor) / (1 - floor)) * 100;
        const color = SERIES[models.indexOf(m) % SERIES.length];
        return (
          <motion.li
            layout key={m.name}
            initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.04, layout: { type: "spring", stiffness: 300, damping: 30 } }}
            onPointerEnter={() => setHighlight(m.name)} onPointerLeave={() => setHighlight(null)}
            className={`grid grid-cols-[1.6rem_minmax(0,13rem)_1fr_4.2rem] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors ${highlight === m.name ? "bg-reef/40" : ""}`}
          >
            <span className="data text-sm text-mist">{i + 1}</span>
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
              <span className="truncate">{m.name}</span>
              {m.name === best && <span className="shrink-0 rounded-full bg-biolume px-2 py-0.5 text-[11px] font-semibold text-abyss" title="Được chọn bằng F1 kiểm định chéo 5-fold">Đang triển khai</span>}
            </span>
            <span className="h-2.5 rounded-full bg-reef/40">
              <motion.span className="block h-2.5 rounded-full" style={{ background: color }}
                initial={{ width: 0 }} whileInView={{ width: `${Math.max(2, w)}%` }} viewport={{ once: true }}
                animate={{ width: `${Math.max(2, w)}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
            </span>
            <span className="data text-right text-sm">{pct(m.test[metric], 2)}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}

function Confusions({ models, highlight }: { models: ModelResult[]; highlight: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {models.map((m) => {
        const [[tn, fp], [fn, tp]] = m.test.confusion_matrix;
        const max = Math.max(tn, fp, fn, tp);
        const cell = (v: number, good: boolean) => (
          <div className="grid aspect-[1.6] place-items-center rounded-md text-xs data"
            style={{ background: `rgb(var(${good ? "--biolume" : "--lure"}) / ${0.08 + (v / max) * 0.6})`, color: v / max > 0.5 ? "rgb(var(--abyss))" : "rgb(var(--foam))" }}>
            {v.toLocaleString()}
          </div>
        );
        return (
          <figure key={m.name} className={`rounded-2xl border p-3 transition-colors ${highlight === m.name ? "border-biolume" : "border-reef/60"}`}>
            <figcaption className="mb-2 truncate text-xs text-mist">{m.name}</figcaption>
            <div className="grid grid-cols-2 gap-1">{cell(tn, true)}{cell(fp, false)}{cell(fn, false)}{cell(tp, true)}</div>
          </figure>
        );
      })}
    </div>
  );
}

function Robustness({ fs }: { fs: FeatureSetResult }) {
  const r = fs.robustness;
  const best = fs.models.find((m) => m.name === fs.best)!;
  const items: { k: string; v: string; note: string }[] = [];
  if (r.split_comparison) {
    items.push({
      k: "Chia ngẫu nhiên so với chia theo website",
      v: `${pct(r.split_comparison.random_split.f1)} vs ${pct(r.split_comparison.domain_grouped_split.f1)} F1`,
      note: "Để cùng website xuất hiện trong tập huấn luyện và thử nghiệm làm điểm số tăng. Chúng tôi báo số nghiêm ngặt hơn.",
    });
  }
  if (r.duplicate_leakage) {
    items.push({
      k: "Dòng trùng lặp rò rỉ vào tập thử nghiệm",
      v: `${pct(r.duplicate_leakage.test_rows_also_in_train_pct, 0)} dòng thử nghiệm`,
      note: `Chỉ trên dòng chưa từng gặp, F1 là ${pct(r.duplicate_leakage.metrics_unseen_test_only.f1)}; F1 bộ chuẩn sau khử trùng lặp là ${pct(r.deduplicated_benchmark.metrics.f1)}.`,
    });
  }
  if (r.cross_dataset) {
    const [a, b] = Object.entries(r.cross_dataset) as [string, { f1: number; roc_auc: number }][];
    items.push({
      k: "Huấn luyện trên một nguồn, thử nghiệm trên nguồn khác",
      v: `${pct(a[1].roc_auc)} và ${pct(b[1].roc_auc)} ROC-AUC`,
      note: "Kiểu URL khác nhau giữa các bộ dữ liệu; kết hợp cả hai nguồn giúp mô hình trực tiếp ổn định.",
    });
  }
  if (r.ablation_without_size_features) {
    items.push({
      k: "Không dùng đặc trưng kích thước trang",
      v: `${pct(r.ablation_without_size_features.metrics.f1)} F1`,
      note: "Trang hợp pháp trong PhiUSIIL là trang chủ đầy đủ; bộ công cụ lừa đảo thường rất nhỏ. Loại bỏ số lượng kích thước cho thấy còn lại bao nhiêu tín hiệu.",
    });
  }
  if (r.sanity_suite) {
    items.push({ k: "URL thực được chọn thủ công", v: `${pct(r.sanity_suite.accuracy, 0)} chính xác`, note: "24 URL minh họa chưa từng dùng để huấn luyện hoặc chọn mô hình." });
  }
  items.push({ k: "Hiệu chỉnh (Brier score)", v: num(r.calibration?.brier, 4), note: "Càng thấp càng tốt; 0.25 tương đương tung đồng xu." });
  items.push({ k: "Độ trễ cho một URL", v: ms(best.latency_ms_single), note: `${best.name} trên một dòng sau khi trích xuất đặc trưng.` });
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.k} className="rounded-2xl border border-reef/60 p-4">
          <dt className="text-sm text-mist">{it.k}</dt>
          <dd className="mt-1 font-display text-2xl font-bold tracking-tight">{it.v}</dd>
          <dd className="mt-1 text-sm text-mist">{it.note}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Models({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<Results | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [set, setSet] = useState<"url" | "content" | "uci">("url");
  const [metric, setMetric] = useState<Metric>("f1");
  const [curve, setCurve] = useState<"roc" | "pr">("roc");
  const [highlight, setHighlight] = useState<string | null>(null);

  useEffect(() => {
    api.results().then(setData).catch((e) => setErr(e.message));
  }, []);

  const fs = data?.feature_sets[set];
  const sets = useMemo(() => ORDER.filter((k) => data?.feature_sets[k]), [data]);

  return (
    <section id={embedded ? undefined : "models"} className={embedded ? "" : "shell py-24 md:py-32"}>
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h2 className={`max-w-[18ch] font-display font-extrabold ${embedded ? "text-display-md" : "text-display-lg"}`}>Mười hai mô hình, cùng điều kiện</h2>
          <p className="lede mt-5">
            Từ hồi quy logistic đến tập hợp stacking, tất cả đều được tinh chỉnh bằng Optuna, kiểm định chéo 5 lần
            và thử nghiệm trên cùng dữ liệu giữ lại. Mô hình triển khai được chọn bằng kiểm định chéo, không phải bằng tập thử nghiệm.
          </p>
        </div>
        {sets.length > 0 && (
          <div role="tablist" aria-label="Tập đặc trưng" className="flex flex-wrap gap-1 rounded-full border border-reef p-1">
            {sets.map((k) => (
              <button key={k} role="tab" aria-selected={set === k} onClick={() => setSet(k)}
                className={`relative rounded-full px-4 py-2 text-sm transition-colors ${set === k ? "text-abyss" : "text-mist hover:text-foam"}`}>
                {set === k && <motion.span layoutId="set-pill" className="absolute inset-0 rounded-full bg-biolume" />}
                <span className="relative">{SET_LABEL[k]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {err && <p className="mt-10 rounded-[28px] border border-dashed border-reef p-8 text-mist">{err}</p>}
      {!data && !err && <p className="mt-10 text-mist">Đang tải kết quả</p>}

      <AnimatePresence mode="wait">
        {fs && (
          <motion.div key={set} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="mt-12 space-y-5">
            <p className="max-w-[75ch] text-mist">{INTRO[set]} <span className="text-foam">{fs.n_train.toLocaleString()} dòng huấn luyện và {fs.n_test.toLocaleString()} dòng thử nghiệm, {fs.features.length} đặc trưng, phép chia {fs.split}.</span></p>

            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="panel p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-xl font-bold">Bảng xếp hạng</h3>
                  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Chỉ số">
                    {METRICS.map((m) => (
                      <button key={m.key} role="radio" aria-checked={metric === m.key} onClick={() => setMetric(m.key)}
                        className={`rounded-full px-3 py-1 text-xs transition-colors ${metric === m.key ? "bg-foam text-abyss" : "text-mist hover:text-foam"}`}>{m.label}</button>
                    ))}
                  </div>
                </div>
                <Leaderboard models={fs.models} best={fs.best} metric={metric} highlight={highlight} setHighlight={setHighlight} />
              </div>
              <div className="panel p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold">{curve === "roc" ? "Đường cong ROC" : "Đường cong độ chuẩn xác - độ nhạy"}</h3>
                  <div className="flex gap-1">
                    {(["roc", "pr"] as const).map((c) => (
                      <button key={c} onClick={() => setCurve(c)} aria-pressed={curve === c}
                        className={`rounded-full px-3 py-1 text-xs ${curve === c ? "bg-foam text-abyss" : "text-mist hover:text-foam"}`}>{c === "roc" ? "ROC" : "PR"}</button>
                    ))}
                  </div>
                </div>
                <Curves key={set + curve} models={fs.models} kind={curve} highlight={highlight} onHover={setHighlight} />
                <p className="mt-2 text-xs text-mist">Di chuột qua đường cong hoặc dòng bảng xếp hạng để cô lập mô hình.</p>
              </div>
            </div>

            <div className="panel overflow-x-auto p-6">
              <h3 className="mb-4 font-display text-xl font-bold">Mọi chỉ số, mọi mô hình</h3>
              <table className="w-full min-w-[860px] text-sm">
                <thead className="text-left text-mist">
                  <tr className="border-b border-reef">
                    <th className="py-2 pr-3 font-normal">Mô hình</th>
                    <th className="px-3 font-normal">CV F1 (5-fold)</th>
                    {METRICS.map((m) => <th key={m.key} className="px-3 font-normal">{m.label}</th>)}
                    <th className="px-3 font-normal">Thời gian huấn luyện</th>
                    <th className="px-3 font-normal">Suy luận / 1k</th>
                  </tr>
                </thead>
                <tbody className="data">
                  {fs.models.map((m) => (
                    <tr key={m.name} className={`border-b border-reef/40 ${m.name === fs.best ? "text-biolume" : ""}`} onPointerEnter={() => setHighlight(m.name)} onPointerLeave={() => setHighlight(null)}>
                      <td className="py-2 pr-3 font-sans">{m.name}</td>
                      <td className="px-3">{num(m.cv.f1.mean, 4)} ± {num(m.cv.f1.std, 3)}</td>
                      {METRICS.map((k) => <td key={k.key} className="px-3">{num(m.test[k.key], 4)}</td>)}
                      <td className="px-3">{m.train_time_s.toFixed(1)} s</td>
                      <td className="px-3">{ms(m.inference_ms_per_1k)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="panel p-6">
                <h3 className="font-display text-xl font-bold">Ma trận nhầm lẫn</h3>
                <p className="mb-4 mt-1 text-sm text-mist">Hàng là lớp thật (hợp pháp, lừa đảo); cột là dự đoán.</p>
                <Confusions models={fs.models} highlight={highlight} />
              </div>
              <div className="panel p-6">
                <h3 className="font-display text-xl font-bold">Kiểm tra độ bền và rò rỉ dữ liệu</h3>
                <p className="mb-4 mt-1 text-sm text-mist">Dành cho mô hình đang triển khai, {fs.best}.</p>
                <Robustness fs={fs} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
