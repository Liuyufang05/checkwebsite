import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap, ScrollTrigger, usePrefersReducedMotion } from "../lib/motion";

const STEPS = [
  {
    title: "Chúng tôi mở an toàn",
    body: "Trước tiên, chúng tôi đảm bảo liên kết không trỏ tới khu vực không nên truy cập, như thiết bị trong mạng riêng. Sau đó trình duyệt cô lập mở trang, nên máy tính của bạn không bị ảnh hưởng.",
    visual: 0,
  },
  {
    title: "Chúng tôi tìm dấu hiệu lừa đảo",
    body: "Kẻ lừa đảo để lại dấu vết: tên ngân hàng nằm sai vị trí trong địa chỉ, đuôi rẻ tiền như .top, từ như \"verify\" hoặc ô mật khẩu gửi dữ liệu tới website khác. Chúng tôi kiểm tra 68 dấu hiệu.",
    visual: 1,
  },
  {
    title: "Chúng tôi đưa ra câu trả lời rõ ràng",
    body: "Hai mô hình đã huấn luyện đưa ra dự đoán, sau đó chúng tôi đối chiếu: tuổi website, tính hợp lệ của ổ khóa bảo mật và danh sách lừa đảo của Google. Bạn nhận kết quả Hợp pháp, Đáng ngờ hoặc Lừa đảo kèm lý do.",
    visual: 4,
  },
];

function Visual({ step }: { step: number }) {
  const common = { initial: { opacity: 0, y: 24, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -24, scale: 0.97 }, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } as const;
  return (
    <AnimatePresence mode="wait">
      {step === 0 && (
        <motion.ul key="0" {...common} className="data w-full space-y-3 text-sm">
          {[["127.0.0.1", "máy tính của bạn", false], ["169.254.169.254", "bí mật máy chủ đám mây", false], ["10.0.0.5", "mạng gia đình", false], ["93.184.216.34", "website công khai", true]].map(([ip, why, ok]) => (
            <li key={String(ip)} className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${ok ? "border-biolume/60 text-biolume" : "border-lure/50 text-lure"}`}>
              <span>{String(ip)}</span>              <span className="text-mist">{String(why)}</span><span>{ok ? "cho phép" : "chặn"}</span>
            </li>
          ))}
        </motion.ul>
      )}
      {step === 1 && (
        <motion.div key="1" {...common} className="w-full">
          <p className="data break-all rounded-2xl border border-reef p-5 text-lg leading-relaxed">
            <span className="text-mist">http://</span><mark className="rounded bg-lure/20 px-1 text-lure">paypal</mark>.secure-<mark className="rounded bg-kelp/20 px-1 text-kelp">login</mark>.account-check.<mark className="rounded bg-lure/20 px-1 text-lure">top</mark>/<mark className="rounded bg-kelp/20 px-1 text-kelp">verify</mark>.<mark className="rounded bg-lure/20 px-1 text-lure">php</mark>?id=9f3a2c71e8b4d6a0
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <li className="chip justify-center border-lure/50 text-lure">Tên PayPal ở sai vị trí</li>
            <li className="chip justify-center border-kelp/50 text-kelp">Từ như \"login\", \"verify\"</li>
            <li className="chip justify-center border-lure/50 text-lure">Đuôi rẻ: .top</li>
            <li className="chip justify-center border-lure/50 text-lure">Trỏ tới tệp script</li>
          </ul>
        </motion.div>
      )}
      {step === 2 && (
        <motion.div key="2" {...common} className="w-full rounded-2xl border border-reef p-6">
          <p className="font-display text-xl font-bold">Xác minh tài khoản của bạn</p>
          <div className="mt-4 space-y-3">
            <div className="h-11 rounded-xl border border-reef" />
            <div className="flex h-11 items-center rounded-xl border-2 border-lure px-4 text-lure">ô mật khẩu</div>
            <div className="flex h-11 items-center justify-center rounded-xl bg-foam/90 font-semibold text-abyss">Đăng nhập</div>
          </div>
          <p className="data mt-4 text-sm text-lure">hành động biểu mẫu = https://collector.another-domain.ru/p.php</p>
          <p className="mt-2 text-sm text-mist">0 liên kết tới trang thật của thương hiệu, 0 ảnh, 1 trường ẩn</p>
        </motion.div>
      )}
      {step === 3 && (
        <motion.div key="3" {...common} className="w-full space-y-5">
          {[["Mô hình URL", 0.91, "bg-lure"], ["Mô hình nội dung trang", 0.97, "bg-lure"], ["Kết hợp", 0.934, "bg-foam"]].map(([n, p, c]) => (
            <div key={String(n)}>
              <div className="flex justify-between text-sm"><span>{String(n)}</span><span className="data">{(Number(p) * 100).toFixed(1)}%</span></div>
              <div className="mt-2 h-3 rounded-full bg-reef/50"><motion.div className={`h-3 rounded-full ${c}`} initial={{ width: 0 }} animate={{ width: `${Number(p) * 100}%` }} transition={{ duration: 1, delay: 0.2 }} /></div>
            </div>
          ))}
        </motion.div>
      )}
      {step === 4 && (
        <motion.div key="4" {...common} className="w-full">
          <ul className="space-y-2 text-sm">
            {[["Website được tạo 3 ngày trước", "rủi ro", "text-lure"], ["Ô mật khẩu gửi dữ liệu tới website khác", "rủi ro", "text-lure"], ["Ổ khóa bảo mật hợp lệ", "an toàn", "text-biolume"], ["Có trong danh sách lừa đảo của Google", "rủi ro", "text-lure"]].map(([a, b, c]) => (
              <li key={a} className="flex justify-between rounded-xl border border-reef px-4 py-3"><span>{a}</span><span className={`data ${c}`}>{b}</span></li>
            ))}
          </ul>
          <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring" }}
            className="mt-6 inline-flex rounded-full bg-lure px-6 py-3 font-display text-2xl font-extrabold text-abyss">Kết luận: Lừa đảo</motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function HowItWorks() {
  const root = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-step]").forEach((el, i) => {
        ScrollTrigger.create({ trigger: el, start: "top 55%", end: "bottom 55%", onToggle: (self) => self.isActive && setStep(i) });
        if (!reduced) gsap.fromTo(el, { opacity: 0.25 }, { opacity: 1, scrollTrigger: { trigger: el, start: "top 75%", end: "top 45%", scrub: true } });
      });
      if (bar.current) {
        gsap.fromTo(bar.current, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: "[data-steps]", start: "top 55%", end: "bottom 55%", scrub: true } });
      }
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section id="how" ref={root} className="shell py-24 md:py-32">
      <h2 className="max-w-[16ch] font-display text-display-lg font-extrabold">Cách hoạt động, qua 3 bước</h2>
      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        <div className="relative" data-steps>
          <div className="absolute left-[19px] top-2 h-[calc(100%-1rem)] w-px bg-reef" aria-hidden="true" />
          <div ref={bar} className="absolute left-[19px] top-2 h-[calc(100%-1rem)] w-px origin-top bg-biolume" aria-hidden="true" />
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.title} data-step className="relative flex min-h-[46vh] gap-6 pb-10 last:min-h-[30vh]">
                <span className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border font-display font-bold transition-colors ${step >= i ? "border-biolume bg-biolume text-abyss" : "border-reef bg-abyss text-mist"}`}>{i + 1}</span>
                <div>
                  <h3 className="font-display text-display-md font-extrabold">{s.title}</h3>
                  <p className="lede mt-4">{s.body}</p>
                  <div className="mt-8 lg:hidden"><Visual step={s.visual} /></div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="hidden lg:block">
          <div className="sticky top-[18vh] flex min-h-[64vh] items-center rounded-[28px] border border-reef/70 bg-trench/50 p-10 backdrop-blur">
            <Visual step={STEPS[step].visual} />
          </div>
        </div>
      </div>
    </section>
  );
}
