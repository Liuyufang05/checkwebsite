import type { Health, HistoryItem, Results, ScanResult } from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Can't reach the PhishGuard API. Start the backend (docker compose up) and try again.", 0, "offline");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status}).`;
    let code: string | undefined;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = "Enter a valid URL, for example https://example.com.";
      code = body.code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail, res.status, code);
  }
  return res.json() as Promise<T>;
}

export const api = {
  scan: (url: string, signal?: AbortSignal) =>
    request<ScanResult>("/api/scan", { method: "POST", body: JSON.stringify({ url }), signal }),
  health: () => request<Health>("/api/health"),
  history: (limit = 30) => request<{ items: HistoryItem[] }>(`/api/history?limit=${limit}`),
  scanById: (id: string) => request<ScanResult>(`/api/history/${id}`),
  urlscan: (uuid: string) => request<Record<string, unknown>>(`/api/intel/urlscan/${uuid}`),
  async results(): Promise<Results> {
    try {
      return await request<Results>("/api/models");
    } catch {
      // Static snapshot bundled at build time, so the dashboard works even if the API is down.
      const r = await fetch("/data/results.json");
      if (!r.ok) throw new ApiError("Model results are not available yet. Train the models first.", r.status);
      return r.json();
    }
  },
};

export const assetUrl = (path: string | null) => (path ? `${BASE}${path}` : null);
