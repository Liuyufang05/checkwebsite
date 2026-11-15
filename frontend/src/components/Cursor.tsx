import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../lib/motion";

/** A sonar-ping cursor: a dot that tracks exactly plus a lagging ring that grows over interactive elements. */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine || reduced) return;
    setEnabled(true);
    document.documentElement.classList.add("has-cursor");
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0;
    let hover = false, down = false, hidden = false;

    const move = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      const t = e.target as HTMLElement | null;
      hover = !!t?.closest("a, button, input, textarea, select, [role='tab'], [data-cursor]");
      hidden = false;
    };
    const press = () => (down = true);
    const release = () => (down = false);
    const leave = () => (hidden = true);
    const loop = () => {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      if (ring.current) {
        const s = (hover ? 1.8 : 1) * (down ? 0.8 : 1);
        ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) scale(${s})`;
        ring.current.style.opacity = hidden ? "0" : "1";
        ring.current.dataset.hover = String(hover);
      }
      raf = requestAnimationFrame(loop);
    };
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerdown", press);
    addEventListener("pointerup", release);
    document.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
      removeEventListener("pointerdown", press);
      removeEventListener("pointerup", release);
      document.removeEventListener("pointerleave", leave);
      document.documentElement.classList.remove("has-cursor");
    };
  }, [reduced]);

  if (!enabled) return null;
  return (
    <>
      <div ref={ring} aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[100] h-9 w-9 rounded-full border border-biolume/70 transition-[opacity,background-color] duration-200 data-[hover=true]:bg-biolume/10" />
      <div ref={dot} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[100] h-1.5 w-1.5 rounded-full bg-biolume" />
    </>
  );
}
