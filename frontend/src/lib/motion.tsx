import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { afterTransition } from "./transition";

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

const LenisCtx = createContext<{ scrollTo: (target: string | HTMLElement | number) => void }>({
  scrollTo: () => {},
});

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const lenisRef = useRef<Lenis | null>(null);

  // Sections fill in asynchronously (model results, scan results, images), which changes the page
  // height. Recompute every ScrollTrigger (pins, scrubs) whenever that happens, or pinned sections
  // start at stale offsets and overlap their neighbours.
  useEffect(() => {
    let cancel = () => {};
    let last = document.body.scrollHeight;
    const ro = new ResizeObserver(() => {
      const h = document.body.scrollHeight;
      if (Math.abs(h - last) < 2) return;
      last = h;
      cancel();
      cancel = afterTransition(() => ScrollTrigger.refresh(), 150);
    });
    ro.observe(document.body);
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);
    document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
    return () => { ro.disconnect(); cancel(); window.removeEventListener("load", onLoad); };
  }, []);

  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    lenisRef.current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduced]);

  const scrollTo = (target: string | HTMLElement | number) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target as never, { offset: -24, duration: 1.4 });
      return;
    }
    if (typeof target === "number") window.scrollTo({ top: target });
    else {
      const el = typeof target === "string" ? document.querySelector(target) : target;
      el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    }
  };

  return <LenisCtx.Provider value={{ scrollTo }}>{children}</LenisCtx.Provider>;
}

export const useSmoothScroll = () => useContext(LenisCtx);

/** Split a string into per-word spans wrapped in masks for GSAP line reveals. */
export function SplitWords({ text, className = "" }: { text: string; className?: string }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className={`line-mask inline-block ${className}`} style={{ display: "inline-block" }}>
          <span data-word>{w}&nbsp;</span>
        </span>
      ))}
    </>
  );
}
