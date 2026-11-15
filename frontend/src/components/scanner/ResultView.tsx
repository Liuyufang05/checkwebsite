import { useState } from "react";
import { motion } from "framer-motion";
import Reveal from "../Reveal";
import { api, assetUrl } from "../../lib/api";
import { ms, pct, VERDICT } from "../../lib/format";
import type { Contribution, IntelResult, ScanResult, Signal } from "../../lib/types";
import Gauge from "./Gauge";

const ICON: Record<Signal["severity"], string> = { good: "\u2713", info: "i", warn: "!", bad: "\u2715" };
const SEV_ORDER: Record<Signal["severity"], number> = { bad: 0, warn: 1, good: 2, info: 3 };

const SEV: Record<Signal["severity"], string> = {
  good: "bg-biolume", info: "bg-mist", warn: "bg-kelp", bad: "bg-lure",
};

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel p-6 ${className}`}>
      <h3 className="mb-4 font-display text-xl font-bold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function Row({ k, v, mono = false }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-reef/50 py-2 text-sm last:border-0">
      <dt className="text-mist">{k}</dt>
      <dd className={`text-right ${mono ? "data break-all" : ""}`}>{v}</dd>
    </div>
  );
}

function Contributions({ items, title }: { items: Contribution[]; title: string }) {
  if (!items.length) return null;
  const max = Math.max(...items.map((c) => Math.abs(c.shap)), 1e-6);
  return (
    <div>
      <p className="mb-3 text-sm text-mist">{title}</p>
      <ul className="space-y-2">
        {items.map((c, i) => {
          const w = (Math.abs(c.shap) / max) * 50;
          const toPhish = c.shap > 0;
          return (
            <li key={c.feature} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3 text-sm">
              <span className="truncate" title={`${c.label} = ${c.value}`}>
                {c.label} <span className="data text-mist">= {Number.isInteger(c.value) ? c.value : c.value.toFixed(2)}</span>
              </span>
              <span className="relative h-3 rounded-full bg-reef/40">
                <span className="absolute left-1/2 top-[-3px] h-[18px] w-px bg-mist/50" />
                <motion.span
                  className={`absolute top-0 h-3 rounded-full ${toPhish ? "bg-lure" : "bg-biolume"}`}
                  style={toPhish ? { left: "50%" } : { right: "50%" }}
                  initial={{ width: 0 }} whileInView={{ width: `${w}%` }} viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.05 }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex justify-between text-xs text-mist"><span>Pushes toward legitimate</span><span>Pushes toward phishing</span></p>
    </div>
  );
}

function IntelCard({ name, r, children }: { name: string; r: IntelResult; children?: React.ReactNode }) {
  const label: Record<IntelResult["status"], string> = {
    not_configured: "Not configured", ok: "Checked", pending: "Queued", rate_limited: "Rate limited", error: "Error",
  };
  return (
    <div className="rounded-2xl border border-reef/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{name}</p>
        <span className={`chip ${r.status === "not_configured" ? "" : r.status === "ok" ? "border-biolume/50 text-biolume" : r.status === "error" ? "border-lure/50 text-lure" : "border-kelp/50 text-kelp"}`}>{label[r.status]}</span>
      </div>
      <div className="mt-2 text-sm text-mist">
        {r.status === "not_configured" ? "Add an API key in backend/.env to enable this check." : children}
        {r.status === "error" && <span>{String(r.error ?? "The service returned an error.")}</span>}
        {r.status === "rate_limited" && <span>Free-tier limit reached; try again in a minute.</span>}
      </div>
    </div>
  );
}

function UrlscanPanel({ r }: { r: IntelResult }) {
  const [state, setState] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const data = (state ?? r) as Record<string, any>;
  const check = async () => {
    if (!r.uuid) return;
    setLoading(true);
    try { setState(await api.urlscan(String(r.uuid))); } catch { /* keep previous */ }
    setLoading(false);
  };
  return (
    <IntelCard name="urlscan.io" r={{ ...r, status: data.status } as IntelResult}>
      {data.status === "ok" ? (
        <span>{data.malicious ? "Marked malicious" : "No malicious verdict"}{data.brands?.length ? `, impersonating ${data.brands.join(", ")}` : ""}. </span>
      ) : (
        <span>{String(r.message ?? "")} </span>
      )}
      {data.report_url && <a className="text-biolume underline-offset-4 hover:underline" href={String(data.report_url)} target="_blank" rel="noreferrer noopener">Open report</a>}
      {r.uuid && data.status !== "ok" && (
        <button onClick={check} disabled={loading} className="ml-3 text-foam underline underline-offset-4 disabled:opacity-50">
          {loading ? "Checking" : "Check result"}
        </button>
      )}
    </IntelCard>
  );
}

export default function ResultView({ r }: { r: ScanResult }) {
  const v = VERDICT[r.verdict];
  const gsb = r.intel.google_safe_browsing as Record<string, any>;
  const vt = r.intel.virustotal as Record<string, any>;
  const tls = r.tls as Record<string, any>;
  const whois = r.whois as Record<string, any>;
  const shot = assetUrl(r.screenshot_url);
  const signals = [...r.signals].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || Math.abs(b.impact) - Math.abs(a.impact));
  const [showTech, setShowTech] = useState(false);

  return (
    <div className="space-y-5">
      {/* verdict */}
      <motion.div
        initial={{ opacity: 0, y: 30, clipPath: "inset(0 0 100% 0 round 28px)" }}
        animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0 round 28px)" }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className={`panel grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8 ${r.verdict === "phishing" ? "glow-lure" : r.verdict === "legitimate" ? "glow-biolume" : ""}`}
      >
        <div>
          <p className="data break-all text-sm text-mist">{r.url}</p>
          <h3 className={`mt-3 font-display text-display-lg font-extrabold ${v.tw}`}>{v.title}</h3>
          <p className="mt-4 max-w-[52ch] text-lg">{v.line}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="chip">Confidence {pct(r.confidence, 0)}</span>
            {r.cached && <span className="chip">From cache</span>}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <Gauge value={r.risk_score} verdict={r.verdict} thresholds={r.thresholds} />
          <p className="text-sm text-mist">Risk score, out of 100</p>
        </div>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Section title="What the page looks like">
          {shot ? (
            <figure>
              <img src={shot} alt={`Screenshot of ${r.final_url}`} loading="lazy" className="w-full rounded-2xl border border-reef/70" />
              <figcaption className="mt-2 text-xs text-mist">
                Captured in a sandboxed browser. {r.blocked_subrequests > 0 && `${r.blocked_subrequests} sub-requests were blocked by the network guard.`}
              </figcaption>
            </figure>
          ) : (
            <p className="rounded-2xl border border-dashed border-reef p-8 text-center text-sm text-mist">{r.screenshot_error ?? "No screenshot was captured."}</p>
          )}
        </Section>

        <Section title="Why we think so">
          <ul className="space-y-4">
            {signals.map((s, i) => (
              <motion.li key={s.id + s.label} className="flex gap-3"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08 }}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-abyss ${SEV[s.severity]}`} aria-hidden="true">{ICON[s.severity]}</span>
                <div className="min-w-0">
                  <p className="font-medium">{s.label}</p>
                  <p className="text-sm text-mist">{s.detail}</p>
                </div>
              </motion.li>
            ))}
            <motion.li className="flex gap-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + signals.length * 0.08 }}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-abyss ${r.ml.blend >= 0.5 ? "bg-kelp" : "bg-biolume"}`} aria-hidden="true">{r.ml.blend >= 0.5 ? "!" : "\u2713"}</span>
              <div className="min-w-0">
                <p className="font-medium">Our trained models rate it {Math.round(r.ml.blend * 100)} out of 100 for risk</p>
                <p className="text-sm text-mist">Based on {r.ml.p_content == null ? "the address only, because the page couldn't be opened" : "the address and the page's content"}. The checks above can raise or lower the final score.</p>
              </div>
            </motion.li>
          </ul>
        </Section>
      </div>

      <div className="flex justify-center pt-2">
        <button onClick={() => setShowTech((v) => !v)} aria-expanded={showTech} className="btn-ghost">
          {showTech ? "Hide technical details" : "Show technical details"}
          <motion.svg viewBox="0 0 24 24" className="h-4 w-4" animate={{ rotate: showTech ? 180 : 0 }} aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></motion.svg>
        </button>
      </div>
      <Reveal open={showTech} wait={1000}>
            <div className="space-y-5 pt-2">
      <div className="flex flex-wrap gap-2">
        <span className="chip">URL model: {pct(r.ml.p_url, 1)} phishing</span>
        <span className="chip">{r.ml.p_content == null ? "Page content not analysed" : `Content model: ${pct(r.ml.p_content, 1)} phishing`}</span>
        <span className="chip">Blended: {pct(r.ml.blend, 1)}</span>
        {signals.filter((x) => x.impact !== 0).map((x) => <span key={x.id} className="chip">{x.label}: {x.impact > 0 ? "+" : ""}{x.impact.toFixed(1)} log-odds</span>)}
      </div>
      <Section title="Why the models decided this">
        <div className="grid gap-8 md:grid-cols-2">
          <Contributions items={r.explanations.url} title={`URL model (${r.model.url_model ?? "best"}), SHAP contributions`} />
          {r.explanations.content.length ? (
            <Contributions items={r.explanations.content} title={`Page-content model (${r.model.content_model ?? "best"}), from ${r.features.content_source} HTML`} />
          ) : (
            <p className="text-sm text-mist">The page couldn't be downloaded, so only the URL model was used. Phishing pages are often taken down within hours.</p>
          )}
        </div>
      </Section>

      <div className="grid gap-5 md:grid-cols-3">
        <Section title="Redirects">
          <ol className="space-y-2">
            {r.redirect_chain.length ? r.redirect_chain.map((h, i) => (
              <li key={i} className="text-sm">
                <span className="data mr-2 text-mist">{h.kind === "meta-refresh" ? "meta" : h.status ?? "n/a"}</span>
                <span className="data break-all">{h.url}</span>
              </li>
            )) : <li className="text-sm text-mist">{r.fetch.error ?? "No response."}</li>}
          </ol>
          <dl className="mt-4">
            <Row k="Fetch time" v={ms(r.fetch.elapsed_ms)} />
            <Row k="Content" v={r.fetch.content_type || "n/a"} />
            <Row k="robots.txt" v={r.fetch.robots_txt ? "Present" : "Missing"} />
          </dl>
        </Section>
        <Section title="Certificate">
          {tls.available ? (
            <dl>
              <Row k="Status" v={tls.verified ? "Valid" : <span className="text-lure">{tls.verify_error ?? "Invalid"}</span>} />
              <Row k="Issuer" v={tls.issuer ?? "n/a"} />
              <Row k="Issued" v={`${tls.cert_age_days} days ago`} />
              <Row k="Expires in" v={`${tls.days_remaining} days`} />
              <Row k="Protocol" v={tls.protocol ?? "n/a"} mono />
            </dl>
          ) : <p className="text-sm text-mist">{tls.error ?? "No TLS information."}</p>}
        </Section>
        <Section title="Domain">
          <dl>
            <Row k="Registered domain" v={r.domain || "n/a"} mono />
            <Row k="Age" v={whois.available ? `${whois.age_days} days` : "Unknown"} />
            <Row k="Registrar" v={whois.registrar ?? "n/a"} />
            <Row k="On reputation list" v={r.reputable_domain ? "Yes" : "No"} />
          </dl>
        </Section>
      </div>

      <Section title="Threat intelligence">
        <div className="grid gap-4 md:grid-cols-3">
          <IntelCard name="Google Safe Browsing" r={r.intel.google_safe_browsing}>
            {gsb.flagged ? <span className="text-lure">Listed as {gsb.threats?.join(", ")}.</span> : "Not on Google's blocklists."}
          </IntelCard>
          <IntelCard name="VirusTotal" r={r.intel.virustotal}>
            {vt.status === "ok" && vt.known ? <span>{vt.malicious + vt.suspicious} of {vt.engines} engines flag this URL. </span> : <span>{vt.message ?? ""} </span>}
            {vt.permalink && <a className="text-biolume underline-offset-4 hover:underline" href={vt.permalink} target="_blank" rel="noreferrer noopener">Open report</a>}
          </IntelCard>
          <UrlscanPanel r={r.intel.urlscan} />
        </div>
      </Section>
            <p className="text-xs text-mist">Scanned {new Date(r.created_utc).toLocaleString()} with model version {r.model.version} (scan id {r.id.slice(0, 8)}).</p>
            </div>
      </Reveal>

    </div>
  );
}
