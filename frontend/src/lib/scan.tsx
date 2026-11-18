import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { ScanResult } from "./types";

export type ScanStatus = "idle" | "scanning" | "done" | "error";
export type Mood = "idle" | "scanning" | "legitimate" | "suspicious" | "phishing" | "error";

interface ScanState {
  status: ScanStatus;
  url: string;
  result: ScanResult | null;
  error: string | null;
  startedAt: number | null;
  mood: Mood;
  start: (url: string) => Promise<void>;
  reset: () => void;
  show: (r: ScanResult) => void;
}

const Ctx = createContext<ScanState | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  const start = useCallback(async (u: string) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setUrl(u);
    setStatus("scanning");
    setError(null);
    setResult(null);
    setStartedAt(performance.now());
    try {
      const r = await api.scan(u, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResult(r);
      setStatus("done");
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof ApiError ? e.message : "Lần quét thất bại bất ngờ. Hãy thử lại.");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  const show = useCallback((r: ScanResult) => {
    setUrl(r.url);
    setResult(r);
    setStatus("done");
  }, []);

  const mood: Mood =
    status === "scanning" ? "scanning" : status === "error" ? "error" : status === "done" && result ? result.verdict : "idle";

  return (
    <Ctx.Provider value={{ status, url, result, error, startedAt, mood, start, reset, show }}>{children}</Ctx.Provider>
  );
}

export function useScan() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useScan must be used inside ScanProvider");
  return c;
}
