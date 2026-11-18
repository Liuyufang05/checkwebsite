import { useState, type FormEvent } from "react";
import { useScan } from "../lib/scan";
import { useSmoothScroll } from "../lib/motion";
import Magnetic from "./Magnetic";

const EXAMPLES = [
  { label: "github.com", url: "https://github.com/demonmj/phishing-detector" },
  { label: "wikipedia.org", url: "https://en.wikipedia.org/wiki/Phishing" },
  { label: "trang đăng nhập giả mạo", url: "http://secure-paypal-account-verify.weebly.com/login" },
];

export default function ScanBar({ compact = false }: { compact?: boolean }) {
  const { start, status } = useScan();
  const { scrollTo } = useSmoothScroll();
  const [value, setValue] = useState("");
  const busy = status === "scanning";

  const go = (url: string) => {
    const u = url.trim();
    if (!u) return;
    start(u);
    setTimeout(() => scrollTo("#scanner"), 120);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(value);
  };

  return (
    <div className="w-full">
      <form onSubmit={submit} className="group relative flex w-full items-center gap-2 rounded-full border border-reef bg-trench/80 p-2 pl-5 backdrop-blur-xl transition-shadow focus-within:glow-biolume" role="search">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-mist" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" strokeLinecap="round" />
        </svg>
        <label htmlFor={compact ? "scan-url-2" : "scan-url"} className="sr-only">Liên kết cần kiểm tra</label>
        <input
          id={compact ? "scan-url-2" : "scan-url"}
          type="text" inputMode="url" autoComplete="off" spellCheck={false}
          placeholder="Dán một liên kết, ví dụ https://secure-login.example.com"
          value={value} onChange={(e) => setValue(e.target.value)}
          className="data min-w-0 flex-1 bg-transparent py-3 text-[15px] text-foam placeholder:text-mist/70 focus:outline-none"
        />
        <Magnetic>
          <button type="submit" disabled={busy || !value.trim()} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Đang quét" : "Quét liên kết"}
          </button>
        </Magnetic>
      </form>
      {!compact && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-mist">
          <span>Thử</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.url} type="button" onClick={() => { setValue(ex.url); go(ex.url); }} disabled={busy}
              className="chip transition-colors hover:border-biolume hover:text-biolume disabled:opacity-50">
              {ex.label}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
