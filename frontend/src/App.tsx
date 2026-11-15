import { lazy, Suspense, useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ScrollTrigger, SmoothScroll } from "./lib/motion";
import { ScanProvider } from "./lib/scan";
import Cursor from "./components/Cursor";
import HookTransition, { PAGE_EXIT, REEL_EASE } from "./components/HookTransition";
import Dock from "./components/Dock";
import Footer from "./components/Footer";
import Intro from "./components/Intro";
import Home from "./pages/Home";
import { afterTransition, markTransition } from "./lib/transition";

const History = lazy(() => import("./pages/History"));
const ScanDetail = lazy(() => import("./pages/ScanDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Research = lazy(() => import("./pages/Research"));

/**
 * Page wrapper. On exit, the old page is frozen in place (clipped to what was on screen) and reeled up
 * off the screen by the hook in <HookTransition>, revealing the new page underneath.
 */
const pageVariants = {
  enter: { opacity: 1 },
  exit: (scroll: number) => {
    const vh = window.innerHeight;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return { opacity: 0, transition: { duration: 0.2 } };
    }
    return {
      position: "fixed" as const,
      top: -scroll,
      left: 0,
      right: 0,
      zIndex: 70,
      // constant keyframes = applied instantly (a single value would be tweened from "none")
      clipPath: Array(4).fill(`inset(${scroll}px 0px calc(100% - ${scroll + vh}px) 0px)`),
      transformOrigin: `50% ${scroll + vh * 0.22}px`,
      // a single `transform` string lets the browser run this on the compositor (WAAPI), so it stays
      // smooth even while the incoming page is busy mounting
      transform: [
        "translateY(0px) rotate(0deg)",
        "translateY(0px) rotate(0deg)",
        "translateY(14px) rotate(0.6deg)",
        `translateY(${-(vh * 1.15)}px) rotate(-3deg)`,
      ],
      // one ease per segment: on the compositor a single ease would stretch over the whole timeline
      transition: { duration: PAGE_EXIT.duration, times: PAGE_EXIT.times, ease: Array(3).fill(REEL_EASE) },
    };
  },
};

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div className="bg-abyss" variants={pageVariants} initial={false} animate="enter" exit="exit">
      {children}
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();
  // Freeze the leaving page's scroll position at the instant the route changes. AnimatePresence re-sends
  // `custom` to exiting pages on every render, and the new page resets scroll to 0 right after.
  const exitScroll = useRef(0);
  const lastPath = useRef(location.pathname);
  if (lastPath.current !== location.pathname) {
    exitScroll.current = window.scrollY;
    lastPath.current = location.pathname;
    markTransition(PAGE_EXIT.duration * 1000 + 150);
  }
  useEffect(() => {
    window.scrollTo(0, 0);
    return afterTransition(() => ScrollTrigger.refresh(), 700);
  }, [location.pathname]);

  return (
    <SmoothScroll>
      <ScanProvider>
        <a href="#scan-url" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-biolume focus:px-4 focus:py-2 focus:text-abyss">Skip to the scanner</a>
        <div className="grain">
          <Intro />
          <Cursor />
          <HookTransition />
          {/* custom = scroll position of the page that is leaving (read before the new page resets it) */}
          <AnimatePresence initial={false} custom={exitScroll.current}>
            <Suspense fallback={<div className="min-h-[100svh]" />} key={location.pathname}>
              <Routes location={location}>
                <Route path="/" element={<Page><Home /></Page>} />
                <Route path="/history" element={<Page><History /></Page>} />
                <Route path="/scan/:id" element={<Page><ScanDetail /></Page>} />
                <Route path="/research" element={<Page><Research /></Page>} />
                <Route path="*" element={<Page><NotFound /></Page>} />
              </Routes>
            </Suspense>
          </AnimatePresence>
          <Footer />
          <Dock />
        </div>
      </ScanProvider>
    </SmoothScroll>
  );
}
