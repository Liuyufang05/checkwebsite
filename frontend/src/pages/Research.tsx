import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { api } from "../lib/api";
import { CLUES, MODEL_PLAIN } from "../lib/plain";
import { featureLabel } from "../lib/format";
import type { FeatureSetResult, Results } from "../lib/types";
import Methodology from "../sections/Methodology";
import Models from "../sections/Models";
import Explain from "../sections/Explain";
import Reveal from "../components/Reveal";
import Magnetic from "../components/Magnetic";
import { useSmoothScroll } from "../lib/motion";

const IMG = (id: string, w = 1800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;
const CHAPTERS = [
  { id: "r-intro", label: "Start" },
  { id: "r-examples", label: "Examples" },
  { id: "r-exam", label: "The exam" },
  { id: "r-report", label: "Report card" },
  { id: "r-clues", label: "Clues" },
  { id: "method", label: "Honest score" },
  { id: "r-tech", label: "Details" },
];
type SetKey = "url" | "content" | "uci";
const SET_NAME: Record<SetKey, string> = { url: "Judging the link", content: "Judging the page", uci: "Classic test" };

/* ---------------------------------------------------------------- small helpers */
function Count({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) { setV(to); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1800;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        setV(to * (1 - Math.pow(1 - t, 4)));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, reduce]);
  return <span ref={ref} className="inline-block tabular-nums">{v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

function Chapter({ id, n, title, children, lede }: { id: string; n: number; title: string; lede: string; children: React.ReactNode }) {
  return (
    <section id={id} className="shell scroll-mt-10 py-24 md:py-36">
      <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-20%" }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
        <p className="font-display text-lg font-bold text-biolume">Chapter {n}</p>
        <h2 className="mt-2 max-w-[20ch] font-display text-display-lg font-extrabold">{title}</h2>
        <p className="lede mt-5 text-xl">{lede}</p>
      </motion.div>
      <div className="mt-14">{children}</div>
    </section>
  );
}

function Tabs({ value, onChange, sets }: { value: SetKey; onChange: (k: SetKey) => void; sets: SetKey[] }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-full border border-reef p-1">
      {sets.map((k) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={`relative rounded-full px-4 py-2 text-sm transition-colors ${value === k ? "text-abyss" : "text-mist hover:text-foam"}`}>
          {value === k && <motion.span layoutId={`tab-${sets.join("")}`} className="absolute inset-0 rounded-full bg-biolume" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
          <span className="relative">{SET_NAME[k]}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- chapter rail */
function Rail() {
  const { scrollTo } = useSmoothScroll();
  const [active, setActive] = useState(CHAPTERS[0].id);
  useEffect(() => {
    const on = () => {
      let cur = CHAPTERS[0].id;
      for (const c of CHAPTERS) {
        const el = document.getElementById(c.id);
        if (el && el.getBoundingClientRect().top < innerHeight * 0.45) cur = c.id;
      }
      setActive(cur);
    };
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  return (
    <nav aria-label="Chapters" className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 xl:block">
      <ol className="space-y-3">
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <button onClick={() => scrollTo(`#${c.id}`)} className="group relative flex h-4 w-8 items-center justify-end" aria-label={c.label} aria-current={active === c.id ? "true" : undefined}>
              <span className={`pointer-events-none absolute right-full mr-3 whitespace-nowrap text-xs transition-opacity ${active === c.id ? "text-foam opacity-100" : "text-mist opacity-0 group-hover:opacity-100"}`}>{c.label}</span>
              <span className={`block h-2.5 rounded-full transition-all duration-300 ${active === c.id ? "w-8 bg-biolume" : "w-2.5 bg-reef group-hover:bg-mist"}`} />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ---------------------------------------------------------------- chapter 0: intro */
function Intro() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.25]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  return (
    <section id="r-intro" ref={ref} className="relative grid min-h-[100svh] place-items-end overflow-hidden">
      <div className="depth-gradient absolute inset-0" />
      <motion.img src={IMG("photo-1760039894970-eb66a3633c5a")} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover opacity-50"
        style={reduce ? undefined : { scale }} initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 2.4, ease: "easeOut" }} />
      <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/50 to-abyss/10" />
      <motion.div style={reduce ? undefined : { y, opacity: fade }} className="shell relative pb-32">
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="font-display text-lg font-bold text-biolume">Inside the models</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 max-w-[16ch] font-display text-display-xl font-extrabold">How does it know a link is fake?</motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="lede mt-6 text-xl">
          We taught computers to spot scams by showing them 140,000 real examples, tested them like students sitting an exam,
          and made sure nobody cheated. Here's the whole story, no maths needed.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, y: [0, 8, 0] }} transition={{ delay: 1.6, y: { repeat: Infinity, duration: 2 } }} className="mt-12 text-sm text-mist">
          Scroll to begin
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ---------------------------------------------------------------- chapter 1: examples */
function DotField() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const [sorted, setSorted] = useState(false);
  const dots = useMemo(() => Array.from({ length: 200 }, (_, i) => ({ id: i, scam: ((i * 7919) % 200) < 100 })), []);
  const order = sorted ? [...dots].sort((a, b) => Number(a.scam) - Number(b.scam)) : dots;
  return (
    <div ref={ref}>
      <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1.5 sm:gap-2">
        {order.map((d, i) => (
          <motion.span key={d.id} layout={!reduce}
            className={`aspect-square rounded-full ${d.scam ? "bg-lure" : "bg-biolume"}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ opacity: { delay: reduce ? 0 : (i % 20) * 0.02 + Math.floor(i / 20) * 0.04 }, scale: { delay: reduce ? 0 : (i % 20) * 0.02 + Math.floor(i / 20) * 0.04 }, layout: { type: "spring", stiffness: 120, damping: 18 } }} />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-biolume" /> Real link</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-lure" /> Phishing link</span>
        <span className="text-mist">Each dot stands for 700 examples.</span>
        <button onClick={() => setSorted((s) => !s)} className="btn-ghost ml-auto">{sorted ? "Mix them up" : "Sort them"}</button>
      </div>
    </div>
  );
}

function Examples() {
  const stats = [
    { n: 80000, label: "web links", sub: "Half real, half phishing, from two research collections." },
    { n: 60000, label: "web pages", sub: "The page code behind real and fake sites." },
    { n: 11055, label: "classic test sites", sub: "An older, well-known benchmark, for comparison." },
  ];
  return (
    <Chapter id="r-examples" n={1} title="First, we showed it examples" lede="Like teaching someone to spot a fake banknote, we showed the computer real and fake links, each one labelled. It slowly learns which details usually come with the fakes.">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <dl className="space-y-8">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="font-display text-[clamp(3rem,7vw,5.5rem)] font-extrabold leading-none tracking-tight"><Count to={s.n} /></dt>
              <dd className="mt-2 text-lg">{s.label}</dd>
              <dd className="text-mist">{s.sub}</dd>
            </div>
          ))}
        </dl>
        <div className="panel p-6 md:p-8"><DotField /></div>
      </div>
    </Chapter>
  );
}

/* ---------------------------------------------------------------- chapter 2: the exam */
function Exam({ data }: { data: Results }) {
  const sets = (["url", "content", "uci"] as SetKey[]).filter((k) => data.feature_sets[k]);
  const [set, setSet] = useState<SetKey>("url");
  const [open, setOpen] = useState<string | null>(null);
  const fs = data.feature_sets[set]!;
  const rows = [...fs.models].sort((a, b) => b.test.f1 - a.test.f1);
  const min = Math.min(...rows.map((r) => r.test.f1));
  const floor = Math.max(0, min - 0.08);
  return (
    <Chapter id="r-exam" n={2} title="Then 12 models sat the same exam" lede="A 'model' is a recipe the computer follows to make a guess. We tried 12 different recipes. They all practised on the same examples and then sat the same final exam, on websites they had never seen before.">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Tabs value={set} onChange={(k) => { setSet(k); setOpen(null); }} sets={sets} />
        <p className="text-sm text-mist">Score out of 100. Tap a model to see what it is.</p>
      </div>
      <ol className="panel divide-y divide-reef/50 p-2 md:p-4">
        {rows.map((m, i) => {
          const isBest = m.name === fs.best;
          const w = ((m.test.f1 - floor) / (1 - floor)) * 100;
          const plain = MODEL_PLAIN[m.name];
          const expanded = open === m.name;
          return (
            <motion.li layout key={`${set}-${m.name}`} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <button onClick={() => setOpen(expanded ? null : m.name)} aria-expanded={expanded}
                className="grid w-full grid-cols-[2rem_minmax(0,1fr)_4rem] items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-reef/30 md:grid-cols-[2.5rem_18rem_1fr_5rem]">
                <span className="font-display text-lg font-bold text-mist">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{m.name}</span>
                  {isBest && <span className="shrink-0 rounded-full bg-biolume px-2 py-0.5 text-[11px] font-semibold text-abyss">We use this one</span>}
                </span>
                <span className="col-span-3 row-start-2 h-3 rounded-full bg-reef/40 md:col-span-1 md:row-start-auto">
                  <motion.span className={`block h-3 rounded-full ${isBest ? "bg-biolume" : "bg-foam/60"}`} initial={{ width: 0 }}
                    whileInView={{ width: `${Math.max(3, w)}%` }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.2 + i * 0.06, ease: [0.16, 1, 0.3, 1] }} />
                </span>
                <span className="text-right font-display text-xl font-bold">{(m.test.f1 * 100).toFixed(1)}</span>
              </button>
              <Reveal open={expanded} wait={700} size="sm">
                    <div className="grid gap-4 px-3 pb-5 pt-1 md:grid-cols-[1fr_auto] md:pl-[3.25rem]">
                      <div>
                        <p className="text-lg">{plain?.what ?? "A machine-learning model."}</p>
                        <p className="mt-1 text-mist">Think of it as: {plain?.like ?? "a recipe for guessing"}</p>
                      </div>
                      <dl className="grid grid-cols-3 gap-4 text-center md:min-w-[22rem]">
                        <div className="rounded-2xl border border-reef p-3"><dt className="text-xs text-mist">Caught scams</dt><dd className="font-display text-xl font-bold">{Math.round(m.test.recall * 100)}%</dd></div>
                        <div className="rounded-2xl border border-reef p-3"><dt className="text-xs text-mist">Right when it warned</dt><dd className="font-display text-xl font-bold">{Math.round(m.test.precision * 100)}%</dd></div>
                        <div className="rounded-2xl border border-reef p-3"><dt className="text-xs text-mist">Time to answer</dt><dd className="font-display text-xl font-bold">{m.latency_ms_single < 1 ? "<1" : Math.round(m.latency_ms_single)} ms</dd></div>
                      </dl>
                    </div>
              </Reveal>
            </motion.li>
          );
        })}
      </ol>
      <p className="mt-6 max-w-[70ch] text-mist">
        The score balances two things: catching scams, and not crying wolf on real sites. We picked the winner using its practice
        scores only, never the final exam, so the exam stays a fair test. That's why the model we use isn't always first by a hair.
      </p>
    </Chapter>
  );
}

/* ---------------------------------------------------------------- chapter 3: report card */
function Waffle({ good, goodLabel, badLabel, goodClass, badClass }: { good: number; goodLabel: string; badLabel: string; goodClass: string; badClass: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className="max-w-[360px]">
      <div className="grid grid-cols-10 gap-1.5">
        {Array.from({ length: 100 }).map((_, i) => (
          <motion.span key={i} className={`aspect-square rounded-[4px] ${i < good ? goodClass : badClass}`}
            initial={{ opacity: 0, scale: 0.4 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: reduce ? 0 : i * 0.012, duration: 0.3 }} />
        ))}
      </div>
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <span className="flex items-center gap-2"><span className={`h-3 w-3 rounded-sm ${goodClass}`} />{goodLabel}</span>
        <span className="flex items-center gap-2"><span className={`h-3 w-3 rounded-sm ${badClass}`} />{badLabel}</span>
      </p>
    </div>
  );
}

function Report({ data }: { data: Results }) {
  const sets = (["url", "content"] as SetKey[]).filter((k) => data.feature_sets[k]);
  const [set, setSet] = useState<SetKey>("url");
  const fs = data.feature_sets[set] as FeatureSetResult;
  const best = fs.models.find((m) => m.name === fs.best)!;
  const [[tn, fp], [fn, tp]] = best.test.confusion_matrix;
  const caught = Math.round((tp / (tp + fn)) * 100);
  const trusted = Math.round((tn / (tn + fp)) * 100);
  return (
    <Chapter id="r-report" n={3} title="Its report card" lede="Here's how the model we use did on the final exam, shown as 100 links of each kind.">
      <Tabs value={set} onChange={setSet} sets={sets} />
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="panel p-6 md:p-8" key={`a${set}`}>
          <h3 className="font-display text-2xl font-bold">Out of 100 phishing links</h3>
          <p className="mb-6 mt-1 text-mist">it caught <span className="text-foam">{caught}</span> and missed <span className="text-foam">{100 - caught}</span>.</p>
          <Waffle good={caught} goodLabel="Caught" badLabel="Missed" goodClass="bg-biolume" badClass="bg-lure" />
        </div>
        <div className="panel p-6 md:p-8" key={`b${set}`}>
          <h3 className="font-display text-2xl font-bold">Out of 100 real links</h3>
          <p className="mb-6 mt-1 text-mist">it trusted <span className="text-foam">{trusted}</span> and raised a false alarm on <span className="text-foam">{100 - trusted}</span>.</p>
          <Waffle good={trusted} goodLabel="Correctly trusted" badLabel="False alarm" goodClass="bg-biolume" badClass="bg-kelp" />
        </div>
      </div>
      <p className="mt-8 max-w-[70ch] text-lg">
        {set === "url"
          ? "Judging a link by its address alone is hard, so the scanner never relies on this model by itself. It also checks how old the website is, whether its security padlock is real, and Google's list of known scam sites."
          : "Page content gives almost perfect scores here, partly because fake pages in this dataset are tiny copies. Real-world scams can be more convincing, so we combine it with the other checks."}
      </p>
    </Chapter>
  );
}

/* ---------------------------------------------------------------- chapter 4: clues */
function direction(fs: FeatureSetResult, feature: string): "up" | "down" | null {
  const pts = fs.shap.beeswarm[feature];
  if (!pts || pts.length < 10) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[1], 0) / n;
  const my = pts.reduce((s, p) => s + p[0], 0) / n;
  let cov = 0, vx = 0, vy = 0;
  for (const [y, x] of pts) { cov += (x - mx) * (y - my); vx += (x - mx) ** 2; vy += (y - my) ** 2; }
  const r = cov / Math.sqrt(vx * vy || 1);
  return r > 0.15 ? "up" : r < -0.15 ? "down" : null;
}

function Clues({ data }: { data: Results }) {
  const sets = (["url", "content"] as SetKey[]).filter((k) => data.feature_sets[k]);
  const [set, setSet] = useState<SetKey>("url");
  const fs = data.feature_sets[set] as FeatureSetResult;
  const top = fs.shap.mean_abs.slice(0, 6);
  const max = top[0]?.value || 1;
  return (
    <Chapter id="r-clues" n={4} title="What gives a fake away" lede="These are the clues the model leans on most. The bar shows how much each one matters compared with the strongest clue.">
      <Tabs value={set} onChange={setSet} sets={sets} />
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {top.map((t, i) => {
            const c = CLUES[t.feature] ?? { title: featureLabel(t.feature), explain: "" };
            const dir = direction(fs, t.feature);
            return (
              <motion.article key={`${set}-${t.feature}`} layout
                initial={{ opacity: 0, y: 40, rotateX: -15 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -6 }}
                className="panel group relative overflow-hidden p-6">
                <span className="absolute -right-2 -top-6 font-display text-[7rem] font-extrabold leading-none text-foam/5">{i + 1}</span>
                <h3 className="relative font-display text-2xl font-bold tracking-tight">{c.title}</h3>
                <p className="relative mt-2 text-mist">{c.explain}</p>
                <div className="relative mt-5 h-2 rounded-full bg-reef/40">
                  <motion.div className="h-2 rounded-full bg-biolume" initial={{ width: 0 }} animate={{ width: `${(t.value / max) * 100}%` }} transition={{ duration: 1, delay: 0.3 + i * 0.07 }} />
                </div>
                <p className="relative mt-3 flex items-center justify-between text-xs text-mist">
                  <span>{dir === "up" ? "More of this looks more like phishing" : dir === "down" ? "More of this looks more like a real site" : "Depends on the other clues"}</span>
                  <span className="data opacity-0 transition-opacity group-hover:opacity-100">{t.feature}</span>
                </p>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </Chapter>
  );
}

/* ---------------------------------------------------------------- chapter 6: technical */
function Technical() {
  const [open, setOpen] = useState(false);
  return (
    <section id="r-tech" className="shell scroll-mt-10 py-24 md:py-32">
      <p className="font-display text-lg font-bold text-biolume">Chapter 6</p>
      <h2 className="mt-2 max-w-[20ch] font-display text-display-lg font-extrabold">Every number, if you want it</h2>
      <p className="lede mt-5 text-xl">For teachers, examiners and the curious: the full results table, accuracy curves, mistake grids and the detailed explanation charts.</p>
      <Magnetic className="mt-8">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn-primary">
          {open ? "Hide the technical details" : "Show the technical details"}
          <motion.svg viewBox="0 0 24 24" className="h-4 w-4" animate={{ rotate: open ? 180 : 0 }}><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></motion.svg>
        </button>
      </Magnetic>
      <Reveal open={open} wait={1300}>
        <div className="space-y-24 pt-16">
          <Models embedded />
          <Explain embedded />
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------- page */
export default function Research() {
  const [data, setData] = useState<Results | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.results().then(setData).catch((e) => setErr(e.message)); }, []);

  return (
    <main>
      <Rail />
      <Intro />
      <Examples />
      {/* Stable wrappers: GSAP's pin wraps <Methodology> in a spacer element, so React must never
          insert siblings directly before it (that crashes with "insertBefore ... not a child"). */}
      <div>
        {err && <p className="shell text-mist">{err}</p>}
        {data && (
          <>
            <Exam data={data} />
            <Report data={data} />
            <Clues data={data} />
          </>
        )}
      </div>
      <div><Methodology /></div>
      <Technical />
      <section className="shell pb-40 pt-10 text-center">
        <h2 className="font-display text-display-md font-extrabold">Ready to check a link?</h2>
        <div className="mt-8 flex justify-center">
          <Magnetic><Link to="/" className="btn-primary">Go to the scanner</Link></Magnetic>
        </div>
      </section>
    </main>
  );
}
