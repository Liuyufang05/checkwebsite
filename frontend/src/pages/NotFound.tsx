import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import Phisher from "../components/mascots/Phisher";
import Magnetic from "../components/Magnetic";

export default function NotFound() {
  const reduce = useReducedMotion();
  return (
    <main className="depth-gradient relative grid min-h-[100svh] place-items-center overflow-hidden px-5 pb-28">
      <svg className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-10 -translate-x-1/2" viewBox="0 0 40 300" aria-hidden="true">
        <line x1="20" y1="0" x2="20" y2="262" stroke="rgb(var(--mist) / 0.6)" strokeWidth="1.2" />
        <g transform="translate(20 262)">
          <g className={reduce ? "" : "animate-sway"} style={{ transformOrigin: "0 0" }}>
            <path d="M0 0 L0 18 C0 32 -15 32 -15 21 L-11 16" fill="none" stroke="rgb(var(--foam))" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </svg>
      <div className="relative z-10 max-w-xl text-center">
        <motion.p initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-24 font-display text-[clamp(7rem,24vw,15rem)] font-extrabold leading-none tracking-tighter text-outline">404</motion.p>
        <h1 className="mt-2 font-display text-display-md font-extrabold">Không có gì trên móc câu này</h1>
        <p className="lede mx-auto mt-4">Trang bạn yêu cầu không tồn tại. Nếu một liên kết đưa bạn tới đây, có thể liên kết bị nhập sai hoặc là một mồi nhử.</p>
        <div className="mt-8 flex justify-center">
          <Magnetic><Link to="/" className="btn-primary">Đi tới bộ quét</Link></Magnetic>
        </div>
      </div>
      <Phisher mood="legitimate" className="absolute bottom-24 right-[6vw] hidden w-40 opacity-80 md:block" />
    </main>
  );
}
