import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { pct, VERDICT } from "../lib/format";
import type { HistoryItem } from "../lib/types";

export default function History() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.history(100).then((r) => setItems(r.items)).catch((e) => setErr(e.message)); }, []);

  return (
    <main className="shell min-h-[100svh] pb-32 pt-16">
      <Link to="/" className="text-sm text-mist hover:text-biolume">Quay lại bộ quét</Link>
      <h1 className="mt-6 font-display text-display-lg font-extrabold">Lần quét gần đây</h1>
      <p className="lede mt-4">Các lần quét gần nhất do máy chủ thực hiện, mới nhất trước. Mở một mục để xem lại đầy đủ bằng chứng.</p>
      {err && <p className="mt-10 rounded-[28px] border border-lure/50 p-8">{err}</p>}
      {items && items.length === 0 && (
        <p className="mt-10 rounded-[28px] border border-dashed border-reef p-10 text-mist">
          Chưa có lần quét nào. <Link to="/" className="text-biolume underline underline-offset-4">Quét liên kết đầu tiên</Link>.
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="mt-10 divide-y divide-reef/60 border-y border-reef/60">
          {items.map((it, i) => {
            const v = VERDICT[it.verdict];
            return (
              <motion.li key={it.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 15) * 0.03 }}>
                <Link to={`/scan/${it.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4 transition-colors hover:bg-trench/50 md:grid-cols-[8rem_1fr_7rem_10rem]">
                  <span className={`font-semibold ${v.tw}`}>{v.title}</span>
                  <span className="data min-w-0 truncate text-sm">{it.url}</span>
                  <span className="data text-right text-sm">{it.risk_score}/100</span>
                  <span className="hidden text-right text-sm text-mist md:block">{new Date(it.created_utc).toLocaleString()}</span>
                  <span className="sr-only">Mô hình URL {pct(it.p_url)}</span>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
