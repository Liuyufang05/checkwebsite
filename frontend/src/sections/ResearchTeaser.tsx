import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
const IMG = "https://images.unsplash.com/photo-1760039894970-eb66a3633c5a?auto=format&fit=crop&w=1800&q=70";

/** A tilt-on-hover portal card. Clicking it "dives" into the Inside-the-models page. */
export default function ResearchTeaser() {
  const card = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 150, damping: 18 });
  const ry = useSpring(useTransform(mx, [0, 1], [-8, 8]), { stiffness: 150, damping: 18 });
  const glowX = useTransform(mx, (v) => `${v * 100}%`);
  const glowY = useTransform(my, (v) => `${v * 100}%`);
  const glow = useTransform([glowX, glowY], ([x, y]) => `radial-gradient(500px circle at ${x} ${y}, rgb(var(--biolume) / 0.22), transparent 60%)`);

  return (
    <>
      <section id="inside" className="shell py-24 md:py-32" style={{ perspective: 1400 }}>
        <motion.button
          ref={card}
          onClick={() => navigate("/research")}
          onPointerMove={(e) => {
            if (reduce || e.pointerType !== "mouse") return;
            const r = e.currentTarget.getBoundingClientRect();
            mx.set((e.clientX - r.left) / r.width);
            my.set((e.clientY - r.top) / r.height);
          }}
          onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
          style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="group relative block min-h-[70svh] w-full overflow-hidden rounded-[36px] border border-reef text-left"
          aria-label="Xem bên trong mô hình: cách PhishGuard học nhận diện lừa đảo"
        >
          <div className="depth-gradient absolute inset-0" />
          <img src={IMG} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover opacity-40 transition-transform duration-[1.6s] ease-out group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/40 to-transparent" />
          {!reduce && (
            <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: glow }} />
          )}
          {/* sonar rings */}
          <div className="pointer-events-none absolute right-[12%] top-[22%] hidden md:block" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="absolute -left-24 -top-24 h-48 w-48 animate-ping rounded-full border border-biolume/40" style={{ animationDelay: `${i * 0.8}s` }} />
            ))}
            <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-biolume shadow-[0_0_30px_rgb(var(--biolume))]" />
          </div>
          <div className="relative flex min-h-[70svh] flex-col justify-end p-8 md:p-14" style={{ transform: "translateZ(40px)" }}>
            <p className="font-display text-lg font-bold text-biolume">Bạn tò mò cách nó đưa ra quyết định?</p>
            <h2 className="mt-3 max-w-[14ch] font-display text-display-lg font-extrabold">Xem bên trong mô hình</h2>
            <p className="lede mt-5 text-xl">
              Cách chúng tôi dạy máy tính phát hiện lừa đảo, kết quả của 12 mô hình trong bài kiểm tra công bằng và các dấu hiệu làm lộ trang giả.
              Viết cho mọi người, không cần kiến thức toán học.
            </p>
            <span className="btn-primary mt-9 w-fit">
              Khám phá
              <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden="true"><path d="M12 5v14m0 0l-6-6m6 6l6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </div>
        </motion.button>
      </section>
    </>
  );
}
