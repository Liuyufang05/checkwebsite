import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useSmoothScroll } from "../lib/motion";

const SECTIONS = [
  { id: "top", label: "Quét", icon: "M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" },
  { id: "how", label: "Cách hoạt động", icon: "M4 6h16v2H4zm0 5h10v2H4zm0 5h16v2H4z" },
];

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? "dark");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("pg-theme", theme); } catch { /* ignore */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#04121F" : "#EAF3F1");
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))] as const;
}

export default function Dock() {
  const { scrollTo } = useSmoothScroll();
  const { pathname } = useLocation();
  const [active, setActive] = useState("top");
  const [theme, toggle] = useTheme();
  const home = pathname === "/";
  const research = pathname === "/research";
  const navigate = useNavigate();

  useEffect(() => {
    if (!home) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.45;
      let current = "top";
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [home]);

  return (
    <nav aria-label="Điều hướng chính" className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
      <div className="flex items-center gap-1 rounded-full border border-reef/80 bg-trench/80 p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl">
        {SECTIONS.map((s) => {
          const on = home && active === s.id;
          const inner = (
            <>
              {on && <motion.span layoutId="dock-pill" className="absolute inset-0 rounded-full bg-biolume" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
              <svg viewBox="0 0 24 24" className="relative h-[18px] w-[18px]" fill="currentColor" aria-hidden="true"><path d={s.icon} /></svg>
              <span className="relative hidden text-sm font-medium lg:inline">{s.label}</span>
            </>
          );
          const cls = `relative flex h-11 items-center gap-2 rounded-full px-3.5 transition-colors ${on ? "text-abyss" : "text-mist hover:text-foam"}`;
          return home ? (
            <button key={s.id} className={cls} aria-label={s.label} aria-current={on ? "true" : undefined} onClick={() => scrollTo(s.id === "top" ? 0 : `#${s.id}`)}>
              {inner}
            </button>
          ) : (
            <Link key={s.id} to={s.id === "top" ? "/" : `/#${s.id}`} className={cls} aria-label={s.label}>{inner}</Link>
          );
        })}
        <button
          onClick={() => (research ? scrollTo(0) : navigate("/research"))}
          aria-label="Bên trong mô hình" aria-current={research ? "page" : undefined}
          className={`relative flex h-11 items-center gap-2 rounded-full px-3.5 transition-colors ${research ? "bg-biolume text-abyss" : "text-mist hover:text-foam"}`}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true"><path d="M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-7h3v7z" /></svg>
          <span className="hidden text-sm font-medium lg:inline">Bên trong mô hình</span>
        </button>
        <span className="mx-1 h-6 w-px bg-reef" aria-hidden="true" />
        <Link to="/history" aria-label="Lịch sử quét" className={`flex h-11 items-center rounded-full px-3.5 transition-colors ${pathname === "/history" ? "bg-biolume text-abyss" : "text-mist hover:text-foam"}`}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true"><path d="M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2.1 5l-1.4 1.4A9 9 0 1 0 13 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8z" /></svg>
        </Link>
        <button onClick={toggle} aria-label={`Chuyển sang giao diện ${theme === "dark" ? "sáng" : "tối"}`} className="flex h-11 items-center rounded-full px-3.5 text-mist transition-colors hover:text-foam">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
            {theme === "dark"
              ? <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM3.5 4.9l1.4-1.4 2.1 2.1-1.4 1.4zm13 13 1.4-1.4 2.1 2.1-1.4 1.4zM1 11h3v2H1zm19 0h3v2h-3zM3.5 19.1l2.1-2.1 1.4 1.4-2.1 2.1zm13-13 2.1-2.1 1.4 1.4-2.1 2.1z" />
              : <path d="M12.3 2a10 10 0 1 0 9.7 12.6A8 8 0 0 1 12.3 2z" />}
          </svg>
        </button>
      </div>
    </nav>
  );
}
