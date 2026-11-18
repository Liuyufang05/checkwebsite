import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { ScanResult } from "../lib/types";
import ResultView from "../components/scanner/ResultView";

export default function ScanDetail() {
  const { id = "" } = useParams();
  const [r, setR] = useState<ScanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.scanById(id).then(setR).catch((e) => setErr(e.message)); }, [id]);
  return (
    <main className="shell min-h-[100svh] pb-32 pt-16">
      <Link to="/history" className="text-sm text-mist hover:text-biolume">Quay lại lần quét gần đây</Link>
      <h1 className="mt-6 font-display text-display-md font-extrabold">Báo cáo quét</h1>
      <div className="mt-8">
        {err && <p className="rounded-[28px] border border-lure/50 p-8">{err}</p>}
        {!r && !err && <p className="text-mist">Đang tải báo cáo</p>}
        {r && <ResultView r={r} />}
      </div>
    </main>
  );
}
