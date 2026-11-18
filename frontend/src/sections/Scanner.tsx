import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useScan } from "../lib/scan";
import { ms } from "../lib/format";
import Radar from "../components/scanner/Radar";
import ResultView from "../components/scanner/ResultView";
import ScanBar from "../components/ScanBar";

const STEPS = [
  { key: "guard", label: "Đảm bảo liên kết an toàn để mở", at: 0.2 },
  { key: "fetch", label: "Mở trang trong trình duyệt cô lập", at: 1.5 },
  { key: "tls", label: "Kiểm tra ổ khóa bảo mật", at: 3 },
  { key: "whois", label: "Kiểm tra tuổi của website", at: 4.5 },
  { key: "intel", label: "Tra Google Safe Browsing, VirusTotal và urlscan.io", at: 6 },
  { key: "screenshot", label: "Chụp ảnh trang", at: 8 },
  { key: "models", label: "Hỏi các mô hình đã huấn luyện", at: Infinity },
];

function stepTime(key: string, t: Record<string, number>) {
  if (key === "intel") return Math.max(t.safe_browsing ?? 0, t.virustotal ?? 0, t.urlscan ?? 0) || undefined;
  if (key === "guard" || key === "models") return undefined;
  return t[key];
}

export default function Scanner() {
  const { status, result, error, url, mood, startedAt } = useScan();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "scanning" || startedAt == null) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((performance.now() - startedAt) / 1000), 150);
    return () => clearInterval(id);
  }, [status, startedAt]);

  const done = status === "done";

  return (
    <section id="scanner" className="shell scroll-mt-8 py-24 md:py-32" aria-live="polite">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="font-display text-display-lg font-extrabold">Bộ quét trực tiếp</h2>
          <p className="lede mt-5">
            Theo dõi từng bước kiểm tra. Khi hoàn tất, bạn sẽ nhận kết luận rõ ràng cùng các lý do.
          </p>
          <div className="mt-8 lg:hidden"><ScanBar compact /></div>
        </div>
        <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
          <Radar mood={mood} size={240} />
          <ol className="w-full space-y-3">
            {STEPS.map((s, i) => {
              const ticked = done || (status === "scanning" && elapsed > s.at);
              const active = status === "scanning" && !ticked && (i === 0 || elapsed > STEPS[i - 1].at);
              const t = done && result ? stepTime(s.key, result.timings_ms) : undefined;
              return (
                <li key={s.key} className={`flex items-center gap-3 text-[15px] transition-colors ${ticked ? "text-foam" : active ? "text-foam" : "text-mist/70"}`}>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${ticked ? "border-biolume bg-biolume text-abyss" : active ? "border-biolume" : "border-reef"}`}>
                    {ticked ? (
                      <motion.svg viewBox="0 0 24 24" className="h-3.5 w-3.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}>
                        <motion.path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
                      </motion.svg>
                    ) : active ? <span className="h-2 w-2 animate-ping rounded-full bg-biolume" /> : <span className="data text-[11px]">{i + 1}</span>}
                  </span>
                  <span className="flex-1">{s.label}</span>
                  {t != null && <span className="data text-xs text-mist">{ms(t)}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="mt-14">
        <AnimatePresence mode="wait">
          {status === "idle" && (
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-[28px] border border-dashed border-reef p-10 text-center text-mist">
              Dán liên kết ở trên để bắt đầu quét. Kết quả sẽ hiển thị tại đây.
            </motion.p>
          )}
          {status === "scanning" && (
            <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-[28px] border border-reef p-10 text-center">
              <p className="data break-all text-mist">{url}</p>
              <p className="mt-2 font-display text-2xl font-bold">Đang quét: {elapsed.toFixed(1)} giây</p>
              <p className="mt-1 text-sm text-mist">Hầu hết lần quét mất từ 5 đến 20 giây, tùy tốc độ phản hồi của website và các dịch vụ tình báo.</p>
            </motion.div>
          )}
          {status === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-[28px] border border-lure/60 p-8" role="alert">
              <p className="font-display text-2xl font-bold text-lure">Quét đã dừng</p>
              <p className="mt-2">{error}</p>
            </motion.div>
          )}
          {done && result && (
            <motion.div key={result.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ResultView r={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
