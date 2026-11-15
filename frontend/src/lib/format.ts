import type { Verdict } from "./types";

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null || Number.isNaN(v) ? "n/a" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined, digits = 3) =>
  v == null || Number.isNaN(v) ? "n/a" : v.toFixed(digits);

export const ms = (v: number | null | undefined) =>
  v == null ? "n/a" : v < 1 ? `${(v * 1000).toFixed(0)} µs` : v < 1000 ? `${v.toFixed(v < 10 ? 2 : 0)} ms` : `${(v / 1000).toFixed(1)} s`;

export const VERDICT: Record<Verdict, { title: string; line: string; color: string; tw: string }> = {
  legitimate: {
    title: "Looks legitimate",
    line: "No sign of a trap. Still check the address before you type a password.",
    color: "rgb(var(--biolume))",
    tw: "text-biolume",
  },
  suspicious: {
    title: "Suspicious",
    line: "Some signals look off. Don't sign in or pay until you've confirmed the site another way.",
    color: "rgb(var(--kelp))",
    tw: "text-kelp",
  },
  phishing: {
    title: "Phishing",
    line: "This looks like a trap built to steal logins or payments. Close it and don't enter anything.",
    color: "rgb(var(--lure))",
    tw: "text-lure",
  },
};

export const FEATURE_LABELS: Record<string, string> = {
  url_length: "URL length", host_length: "Hostname length", path_length: "Path length", query_length: "Query length",
  num_path_segments: "Path segments", max_path_segment_length: "Longest path segment", num_subdomains: "Subdomains",
  sld_length: "Domain-name length", tld_length: "TLD length", is_ip_host: "Raw IP as host", has_port: "Explicit port",
  has_at_symbol: "'@' in URL", num_dots_host: "Dots in hostname", num_hyphens_host: "Hyphens in hostname",
  num_hyphens_url: "Hyphens in URL", num_underscores: "Underscores", num_slashes: "Slashes", has_double_slash_in_path: "'//' in path",
  num_equals: "'=' count", num_question: "'?' count", num_ampersand: "'&' count", num_percent: "Percent-encoding",
  num_tilde: "'~' count", num_digits_url: "Digits in URL", digit_ratio_url: "Digit ratio", num_digits_host: "Digits in hostname",
  letter_ratio_url: "Letter ratio", host_entropy: "Hostname randomness", url_entropy: "URL randomness",
  longest_token_length: "Longest token", num_host_tokens: "Words in hostname", has_punycode: "Punycode look-alike",
  sensitive_word_count: "Login / verify words", brand_outside_domain: "Brand outside its domain",
  brand_in_domain_not_exact: "Brand inside another domain", is_shortener: "URL shortener", is_free_hosting: "Free hosting",
  suspicious_tld: "High-abuse TLD", has_file_extension: "Script file in path", has_php: "PHP in path",
  http_token_in_url: "'http' inside URL", embedded_url: "Embedded URL", max_char_repeat: "Repeated characters", num_hex_runs: "Hex strings",
  LineOfCode: "Lines of HTML", LargestLineLength: "Longest HTML line", HasTitle: "Has title", HasFavicon: "Has favicon",
  Robots: "Has robots.txt", IsResponsive: "Responsive layout", HasDescription: "Meta description", NoOfPopup: "Pop-ups",
  NoOfiFrame: "Iframes", HasExternalFormSubmit: "Form posts elsewhere", HasSocialNet: "Social links", HasSubmitButton: "Submit button",
  HasHiddenFields: "Hidden fields", HasPasswordField: "Password field", Bank: "Banking words", Pay: "Payment words",
  Crypto: "Crypto words", HasCopyrightInfo: "Copyright notice", NoOfImage: "Images", NoOfCSS: "Stylesheets", NoOfJS: "Scripts",
  NoOfSelfRef: "Internal links", NoOfEmptyRef: "Empty links", NoOfExternalRef: "External links",
};

export const featureLabel = (f: string) => FEATURE_LABELS[f] ?? f.replace(/_/g, " ");

export const SET_LABEL: Record<string, string> = {
  url: "Live URL model",
  content: "Live page-content model",
  uci: "UCI benchmark",
};
