export type Verdict = "legitimate" | "suspicious" | "phishing";

export interface Signal {
  id: string;
  label: string;
  detail: string;
  impact: number;
  severity: "good" | "info" | "warn" | "bad";
  source: string;
}

export interface Contribution {
  feature: string;
  label: string;
  value: number;
  shap: number;
  unit: string;
  direction: "phishing" | "legitimate";
}

export interface IntelResult {
  status: "not_configured" | "ok" | "pending" | "rate_limited" | "error";
  [k: string]: unknown;
}

export interface ScanResult {
  id: string;
  created_utc: string;
  url: string;
  final_url: string;
  host: string;
  domain: string;
  verdict: Verdict;
  probability_phishing: number;
  risk_score: number;
  confidence: number;
  thresholds: { suspicious: number; phishing: number };
  ml: { p_url: number; p_content: number | null; blend: number; weights: { url: number; content: number } };
  signals: Signal[];
  explanations: { url: Contribution[]; content: Contribution[] };
  features: { url: Record<string, number>; content: Record<string, number> | null; content_source: string | null };
  redirect_chain: { url: string; status: number | null; ip: string | null; kind: string }[];
  fetch: {
    ok: boolean; status: number | null; content_type: string; bytes: number; truncated: boolean;
    elapsed_ms: number; error: string | null; server: string | null; tls_verified: boolean | null; robots_txt: boolean;
  };
  tls: Record<string, unknown> & { available: boolean };
  whois: Record<string, unknown> & { available: boolean; age_days?: number | null };
  reputable_domain: boolean;
  intel: { google_safe_browsing: IntelResult; virustotal: IntelResult; urlscan: IntelResult };
  screenshot_url: string | null;
  screenshot_error: string | null;
  page_title: string | null;
  blocked_subrequests: number;
  model: { version: string; url_model?: string; content_model?: string };
  timings_ms: Record<string, number>;
  cached: boolean;
}

export interface HistoryItem {
  id: string;
  created_utc: string;
  url: string;
  final_url: string | null;
  domain: string | null;
  verdict: Verdict;
  risk_score: number;
  p_url: number | null;
  p_content: number | null;
  has_screenshot: number;
}

export interface MetricSet {
  accuracy: number; precision: number; recall: number; f1: number; roc_auc: number; pr_auc: number;
  confusion_matrix: [[number, number], [number, number]];
}

export interface ModelResult {
  name: string;
  key: string;
  params: Record<string, unknown>;
  n_train: number;
  cv: Record<"accuracy" | "precision" | "recall" | "f1" | "roc_auc", { mean: number; std: number }>;
  test: MetricSet;
  train_time_s: number;
  inference_ms_per_1k: number;
  latency_ms_single: number;
  curves: { fpr: number[]; tpr: number[]; recall: number[]; precision: number[] };
}

export interface FeatureSetResult {
  key: "uci" | "url" | "content";
  title: string;
  role: "comparison" | "live";
  note: string;
  live: boolean;
  features: string[];
  n_rows: number;
  n_train: number;
  n_test: number;
  split: string;
  phishing_rate: number;
  models: ModelResult[];
  best: string;
  shap: {
    explainer: string;
    n_explained: number;
    mean_abs: { feature: string; value: number }[];
    beeswarm: Record<string, [number, number][]>;
  };
  importance: { feature: string; value: number; method: string }[];
  robustness: Record<string, any>;
}

export interface Results {
  model_version: string;
  generated_utc: string;
  fast_mode: boolean;
  config: Record<string, unknown>;
  feature_sets: Partial<Record<"uci" | "url" | "content", FeatureSetResult>>;
}

export interface Health {
  status: "ok" | "degraded";
  model: { version: string | null; loaded: Record<string, string>; warnings: string[] };
  browser: { available: boolean | null; error: string | null; enabled: boolean };
  intel: { google_safe_browsing: boolean; virustotal: boolean; urlscan: boolean };
}
