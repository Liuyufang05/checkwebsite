import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { gsap } from "../../lib/motion";
import { useScan } from "../../lib/scan";
import { api } from "../../lib/api";
import type { Health } from "../../lib/types";
import Guardian from "../mascots/Guardian";
import Phisher from "../mascots/Phisher";
import ScanBar from "../ScanBar";
import { afterTransition, transitionLeft } from "../../lib/transition";

const HeroScene = lazy(() => import("./HeroScene"));

function useLine(container: React.RefObject<HTMLElement>, from: React.RefObject<HTMLElement>, to: React.RefObject<HTMLElement>) {
  const [pts, setPts] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  useLayoutEffect(() => {
    const calc = () => {
      const c = container.current?.getBoundingClientRect();
      const a = from.current?.getBoundingClientRect();
      const b = to.current?.getBoundingClientRect();
      if (!c || !a || !b) return;
      if (from.current?.offsetParent === null || (a.width === 0 && a.height === 0 && a.left === 0)) {
        setPts(null); // villain hidden (small screens)
        return;
      }
      setPts({ x1: a.left - c.left, y1: a.top - c.top, x2: b.left - c.left + b.width / 2, y2: b.top - c.top });
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (container.current) ro.observe(container.current);
    addEventListener("resize", calc);
    const t = setTimeout(calc, 600);
    return () => { ro.disconnect(); removeEventListener("resize", calc); clearTimeout(t); };
  }, [container, from, to]);
  return pts;
}

export default function Hero() {
  const { mood } = useScan();
  const reduce = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const rodTip = useRef<HTMLSpanElement>(null);
  const hookAnchor = useRef<HTMLSpanElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const pts = useLine(root, rodTip, hookAnchor);
  const [health, setHealth] = useState<Health | null | "offline">(null);
  // the WebGL scene is the heaviest thing on the page: start it once the page change has finished
  const [sceneOn, setSceneOn] = useState(() => transitionLeft() === 0);
  useEffect(() => (sceneOn ? undefined : afterTransition(() => setSceneOn(true))), [sceneOn]);

  const { scrollYProgress } = useScroll({ target: root, offset: ["start start", "end start"] });
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth("offline"));
  }, []);

  useLayoutEffect(() => {
    if (reduce || !title.current) return;
    let first = true;
    try { first = !sessionStorage.getItem("pg-intro"); } catch { /* ignore */ }
    const ctx = gsap.context(() => {
      gsap.from("[data-word]", { yPercent: 110, rotate: 4, duration: 1.1, ease: "expo.out", stagger: 0.06, delay: first ? 2.0 : 0.15 });
      gsap.from("[data-hero-fade]", { opacity: 0, y: 24, duration: 1, ease: "power3.out", stagger: 0.1, delay: first ? 2.4 : 0.5 });
    }, root);
    return () => ctx.revert();
  }, [reduce]);

  const retracted = mood === "legitimate";
  const hookColor = mood === "phishing" ? "rgb(var(--lure))" : mood === "suspicious" ? "rgb(var(--kelp))" : "rgb(var(--foam))";
  const lineEndY = pts ? pts.y2 - (retracted ? 140 : 0) : 0;

  return (
    <section id="top" ref={root} className="depth-gradient relative min-h-[100svh] overflow-hidden">
      <motion.div style={reduce ? undefined : { y: sceneY }} className="absolute inset-y-0 right-[-20%] w-[95%] opacity-45 md:right-[-8%] md:w-[70%] md:opacity-80">
        {!reduce && sceneOn && (
          <Suspense fallback={null}>
            <HeroScene mood={mood} />
          </Suspense>
        )}
      </motion.div>

      {/* fishing line from the villain's rod down to the hook over the scan bar */}
      {pts && (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true">
          <motion.path
            initial={false}
            animate={{ d: `M ${pts.x1} ${pts.y1} Q ${(pts.x1 + pts.x2) / 2 + 30} ${(pts.y1 + lineEndY) / 2} ${pts.x2} ${lineEndY}` }}
            transition={{ type: "spring", stiffness: 60, damping: 14 }}
            fill="none" stroke="rgb(var(--mist) / 0.55)" strokeWidth="1.2"
          />
          <motion.g initial={false} animate={{ x: pts.x2, y: lineEndY }} transition={{ type: "spring", stiffness: 60, damping: 14 }}>
            <g className={reduce ? "" : "animate-sway"} style={{ transformOrigin: "0 0" }}>
              <path d="M0 0 L0 22 C0 38 -18 38 -18 25 L-13 19" fill="none" stroke={hookColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {mood === "phishing" && <circle cx="-6" cy="24" r="16" fill="rgb(var(--lure) / 0.25)" />}
            </g>
          </motion.g>
        </svg>
      )}

      <div className="shell relative z-20 flex min-h-[100svh] flex-col pb-28 pt-6">
        <header className="flex items-center justify-between" data-hero-fade>
          <a href="/" className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            PhishGuard
          </a>
          <p className="flex items-center gap-2 text-sm text-mist" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${health === "offline" ? "bg-lure" : health && health.status === "ok" ? "bg-biolume" : "bg-kelp"}`} />
            <span className="sr-only sm:not-sr-only">{health === null ? "Đang kết nối bộ quét" : health === "offline" ? "Bộ quét ngoại tuyến, đang hiển thị kết quả đã lưu" : health.status === "ok" ? "Bộ quét trực tuyến" : "Bộ quét cần mô hình đã huấn luyện"}</span>
          </p>
        </header>

        <div className="relative mt-auto pt-16">
          <motion.div style={reduce ? undefined : { y: textY }} className="max-w-[880px]">
            <h1 ref={title} className="font-display text-display-xl font-extrabold">
              <span className="block">{"Đừng vội.".split(" ").map((w, i) => <span key={i} className="line-mask"><span data-word className="inline-block">{w}&nbsp;</span></span>)}</span>
              <span className="block text-biolume">{"Hãy kiểm tra liên kết.".split(" ").map((w, i) => <span key={i} className="line-mask"><span data-word className="inline-block">{w}&nbsp;</span></span>)}</span>
            </h1>
            <p className="lede mt-7" data-hero-fade>
              Bạn có một liên kết chưa chắc chắn? Dán tại đây. Chúng tôi mở nó an toàn, tìm dấu hiệu lừa đảo
              và giải thích rõ ràng liên kết có phải là bẫy hay không.
            </p>
            <div className="relative mt-9 max-w-[720px]" data-hero-fade>
              <span ref={hookAnchor} className="absolute right-[22%] top-0 h-px w-px" aria-hidden="true" />
              <ScanBar />
            </div>
          </motion.div>
        </div>
      </div>

      {/* mascots (desktop): the Angler fishes from the top right, Lumen guards the scan bar */}
      <div className="pointer-events-none absolute right-[5vw] top-[9vh] z-20 hidden w-[clamp(150px,13vw,210px)] lg:block" data-hero-fade>
        <span ref={rodTip} className="absolute right-[5%] top-[7%] h-px w-px" aria-hidden="true" />
        <Phisher mood={mood} className="w-full" />
      </div>
      <div className="pointer-events-none absolute bottom-[14vh] right-[9vw] z-20 hidden w-[clamp(150px,13vw,210px)] lg:block" data-hero-fade>
        <Guardian mood={mood} className="w-full drop-shadow-[0_0_40px_rgb(var(--biolume)/0.25)]" />
      </div>

      <div className="shell relative z-20 -mt-24 pb-24 lg:hidden">
        <div className="flex items-end justify-between" aria-hidden="true">
          <Guardian mood={mood} className="w-28" />
          <Phisher mood={mood} className="w-28" />
        </div>
      </div>
    </section>
  );
}
