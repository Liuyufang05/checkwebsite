import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { featureLabel, SET_LABEL } from "../lib/format";
import type { Results } from "../lib/types";

/** Global explanation of the deployed models: mean |SHAP| ranking + an interactive beeswarm. */
export default function Explain({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<Results | null>(null);
  const [set, setSet] = useState<"url" | "content">("url");
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => { api.results().then(setData).catch(() => setData(null)); }, []);

  const fs = data?.feature_sets[set];
  const top = useMemo(() => (fs ? fs.shap.mean_abs.slice(0, 12) : []), [fs]);
  const swarm = useMemo(() => {
    if (!fs) return [];
    const names = Object.keys(fs.shap.beeswarm);
    const all = names.flatMap((n) => fs.shap.beeswarm[n].map((p) => p[0]));
    const lim = Math.max(...all.map(Math.abs), 1e-6);
    return names.map((n) => ({ name: n, lim, pts: fs.shap.beeswarm[n] }));
  }, [fs]);

  if (!fs) return null;
  const maxAbs = Math.max(...top.map((t) => t.value), 1e-9);

  return (
    <section id={embedded ? undefined : "explain"} className={embedded ? "" : "shell py-24 md:py-32"}>
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h2 className={`max-w-[18ch] font-display font-extrabold ${embedded ? "text-display-md" : "text-display-lg"}`}>What the models look at</h2>
          <p className="lede mt-5">
            SHAP values measure how much each feature pushed a prediction toward phishing or away from it. These come from the
            deployed {fs.best} model on {fs.shap.n_explained.toLocaleString()} held-out examples.
          </p>
        </div>
        <div role="tablist" aria-label="Model" className="flex gap-1 rounded-full border border-reef p-1">
          {(["url", "content"] as const).filter((k) => data?.feature_sets[k]).map((k) => (
            <button key={k} role="tab" aria-selected={set === k} onClick={() => setSet(k)}
              className={`rounded-full px-4 py-2 text-sm ${set === k ? "bg-biolume text-abyss" : "text-mist hover:text-foam"}`}>{SET_LABEL[k]}</button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="panel p-6">
          <h3 className="mb-5 font-display text-xl font-bold">Average impact</h3>
          <ol className="space-y-2.5">
            {top.map((t, i) => (
              <li key={t.feature} onPointerEnter={() => setHover(t.feature)} onPointerLeave={() => setHover(null)}
                className={`grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 rounded-lg px-1 text-sm ${hover === t.feature ? "text-biolume" : ""}`}>
                <span className="truncate">{featureLabel(t.feature)}</span>
                <span className="h-3 rounded-full bg-reef/40">
                  <motion.span key={set + t.feature} className="block h-3 rounded-full bg-biolume"
                    initial={{ width: 0 }} whileInView={{ width: `${(t.value / maxAbs) * 100}%` }} viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.04 }} />
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel p-6">
          <h3 className="font-display text-xl font-bold">Every prediction, one dot</h3>
          <p className="mb-5 mt-1 text-sm text-mist">
            Dots right of the line pushed toward phishing. Colour shows the feature's value, from <span className="text-biolume">low</span> to <span className="text-lure">high</span>.
          </p>
          <div className="space-y-1">
            {swarm.map((row) => (
              <div key={row.name} className={`grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 ${hover && hover !== row.name ? "opacity-40" : ""}`}
                onPointerEnter={() => setHover(row.name)} onPointerLeave={() => setHover(null)}>
                <span className="truncate text-xs text-mist">{featureLabel(row.name)}</span>
                <svg viewBox="0 0 400 22" className="h-[22px] w-full" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="200" x2="200" y1="0" y2="22" stroke="rgb(var(--mist) / 0.4)" />
                  {row.pts.map(([s, v], i) => {
                    const x = 200 + (s / row.lim) * 195;
                    const jitter = ((i * 7919) % 17) - 8;
                    const c = `color-mix(in srgb, rgb(var(--biolume)) ${Math.round((1 - v) * 100)}%, rgb(var(--lure)))`;
                    return <circle key={i} cx={x} cy={11 + jitter * 0.9} r="2.1" fill={c} opacity="0.85" />;
                  })}
                </svg>
              </div>
            ))}
          </div>
          <p className="mt-3 flex justify-between pl-[9.75rem] text-xs text-mist"><span>Toward legitimate</span><span>Toward phishing</span></p>
        </div>
      </div>
    </section>
  );
}
