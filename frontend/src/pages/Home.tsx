import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Hero from "../components/hero/Hero";
import HowItWorks from "../sections/HowItWorks";
import Scanner from "../sections/Scanner";
import ResearchTeaser from "../sections/ResearchTeaser";
import { ScrollTrigger, useSmoothScroll } from "../lib/motion";
import { afterTransition } from "../lib/transition";

export default function Home() {
  const { hash } = useLocation();
  const { scrollTo } = useSmoothScroll();
  useEffect(() => {
    return afterTransition(() => {
      ScrollTrigger.refresh();
      if (hash) scrollTo(hash);
    }, 400);
  }, [hash, scrollTo]);

  return (
    <main>
      <Hero />
      <Scanner />
      <HowItWorks />
      <ResearchTeaser />
    </main>
  );
}
