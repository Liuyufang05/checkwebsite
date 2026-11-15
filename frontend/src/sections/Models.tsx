import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api";
import { ms, num, pct, SET_LABEL } from "../lib/format";
import type { FeatureSetResult, ModelResult, Results } from "../lib/types";
import Curves, { SERIES } from "../components/charts/Curves";

type Metric = "f1" | "accuracy" | "precision" | "recall" | "roc_auc" | "pr_auc";
const METRICS: { key: Metric; label: string }[] = [
  { key: "f1", label: "F1" }, { key: "accuracy", label: "Accuracy" }, { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" }, { key: "roc_auc", label: "ROC-AUC" }, { key: "pr_auc", label: "PR-AUC" },
];
const ORDER: ("url" | "content" | "uci")[] = ["url", "content", "uci"];
const INTRO: Record<string, string> = {
  url: "Trained on 80,000 URLs from two sources, split so that no website appears in both training and test data. This is the model that judges the link you paste.",
  content: "Trained on 60,000 pages from PhiUSIIL using only HTML features we can recompute from a live page. It runs when the page can be downloaded.",
  uci: "The classic UCI benchmark with 30 hand-engineered features. Several depend on services that no longer exist (Alexa rank, PageRank), so it is compared here but never used live.",
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
              {m.name === best && <span className="shrink-0 rounded-full bg-biolume px-2 py-0.5 text-[11px] font-semibold text-abyss" title="Selected by 5-fold cross-validation F1">Deployed</span>}
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
      k: "Random split vs. split by website",
      v: `${pct(r.split_comparison.random_split.f1)} vs ${pct(r.split_comparison.domain_grouped_split.f1)} F1`,
      note: "Letting the same site appear in train and test inflates scores. We report the stricter number.",
    });
  }
  if (r.duplicate_leakage) {
    items.push({
      k: "Duplicate rows leaking into test",
      v: `${pct(r.duplicate_leakage.test_rows_also_in_train_pct, 0)} of test rows`,
      note: `On unseen rows only, F1 is ${pct(r.duplicate_leakage.metrics_unseen_test_only.f1)}; deduplicated benchmark F1 is ${pct(r.deduplicated_benchmark.metrics.f1)}.`,
    });
  }
  if (r.cross_dataset) {
    const [a, b] = Object.entries(r.cross_dataset) as [string, { f1: number; roc_auc: number }][];
    items.push({
      k: "Trained on one source, tested on the other",
      v: `${pct(a[1].roc_auc)} and ${pct(b[1].roc_auc)} ROC-AUC`,
      note: "URL styles differ between datasets; combining both sources is what makes the live model hold up.",
    });
  }
  if (r.ablation_without_size_features) {
    items.push({
      k: "Without page-size features",
      v: `${pct(r.ablation_without_size_features.metrics.f1)} F1`,
      note: "Legitimate pages in PhiUSIIL are full homepages; phishing kits are tiny. Removing size counts shows how much signal remains.",
    });
  }
  if (r.sanity_suite) {
    items.push({ k: "Hand-picked real-world URLs", v: `${pct(r.sanity_suite.accuracy, 0)} correct`, note: "24 illustrative URLs never used for training or model selection." });
  }
  items.push({ k: "Calibration (Brier score)", v: num(r.calibration?.brier, 4), note: "Lower is better; 0.25 is a coin flip." });
  items.push({ k: "Single-URL latency", v: ms(best.latency_ms_single), note: `${best.name} on one row, after feature extraction.` });
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
          <h2 className={`max-w-[18ch] font-display font-extrabold ${embedded ? "text-display-md" : "text-display-lg"}`}>Twelve models, same conditions</h2>
          <p className="lede mt-5">
            Logistic regression to stacked ensembles, all tuned with Optuna, cross-validated five times and tested on the same
            held-out data. The deployed model is picked by cross-validation, never by the test set.
          </p>
        </div>
        {sets.length > 0 && (
          <div role="tablist" aria-label="Feature set" className="flex flex-wrap gap-1 rounded-full border border-reef p-1">
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
      {!data && !err && <p className="mt-10 text-mist">Loading results</p>}

      <AnimatePresence mode="wait">
        {fs && (
          <motion.div key={set} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="mt-12 space-y-5">
            <p className="max-w-[75ch] text-mist">{INTRO[set]} <span className="text-foam">{fs.n_train.toLocaleString()} training and {fs.n_test.toLocaleString()} test rows, {fs.features.length} features, {fs.split} split.</span></p>

            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="panel p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-xl font-bold">Leaderboard</h3>
                  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Metric">
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
                  <h3 className="font-display text-xl font-bold">{curve === "roc" ? "ROC curves" : "Precision-recall"}</h3>
                  <div className="flex gap-1">
                    {(["roc", "pr"] as const).map((c) => (
                      <button key={c} onClick={() => setCurve(c)} aria-pressed={curve === c}
                        className={`rounded-full px-3 py-1 text-xs ${curve === c ? "bg-foam text-abyss" : "text-mist hover:text-foam"}`}>{c === "roc" ? "ROC" : "PR"}</button>
                    ))}
                  </div>
                </div>
                <Curves key={set + curve} models={fs.models} kind={curve} highlight={highlight} onHover={setHighlight} />
                <p className="mt-2 text-xs text-mist">Hover a curve or a leaderboard row to isolate a model.</p>
              </div>
            </div>

            <div className="panel overflow-x-auto p-6">
              <h3 className="mb-4 font-display text-xl font-bold">Every metric, every model</h3>
              <table className="w-full min-w-[860px] text-sm">
                <thead className="text-left text-mist">
                  <tr className="border-b border-reef">
                    <th className="py-2 pr-3 font-normal">Model</th>
                    <th className="px-3 font-normal">CV F1 (5-fold)</th>
                    {METRICS.map((m) => <th key={m.key} className="px-3 font-normal">{m.label}</th>)}
                    <th className="px-3 font-normal">Train time</th>
                    <th className="px-3 font-normal">Inference / 1k</th>
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
                <h3 className="font-display text-xl font-bold">Confusion matrices</h3>
                <p className="mb-4 mt-1 text-sm text-mist">Rows are the true class (legitimate, phishing); columns are the prediction.</p>
                <Confusions models={fs.models} highlight={highlight} />
              </div>
              <div className="panel p-6">
                <h3 className="font-display text-xl font-bold">Robustness and leakage checks</h3>
                <p className="mb-4 mt-1 text-sm text-mist">For the deployed model, {fs.best}.</p>
                <Robustness fs={fs} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
