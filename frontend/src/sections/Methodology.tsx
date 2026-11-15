import { useLayoutEffect, useRef } from "react";
import { gsap, usePrefersReducedMotion } from "../lib/motion";

const IMG = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

type Card = { kind: "stat" | "text" | "image"; title: string; body: string; stat?: string; img?: string; credit?: string };

const CARDS: Card[] = [
  {
    kind: "image", title: "Three public collections", img: IMG("photo-1760039894970-eb66a3633c5a"), credit: "Photo: Digital Reach / Unsplash",
    body: "Two come from university researchers and one from GitHub. They're downloaded automatically and checked, so nothing was quietly changed.",
  },
  {
    kind: "stat", stat: "100%", title: "of the 'real' links in one collection were plain homepages",
    body: "So a lazy model could learn 'any link with a page after the slash is fake'. We tidied every link the same way and added real links that go deeper, so it can't take that shortcut.",
  },
  {
    kind: "stat", stat: "1", title: "column gave the answer away",
    body: "One column in a dataset almost told the model the answer outright. A link you paste doesn't come with that column, so we threw it out and used only clues we can read from a real page.",
  },
  {
    kind: "image", title: "No peeking at the exam", img: IMG("photo-1714880003292-17685b9999b6"), credit: "Photo: Kaptured by Kasia / Unsplash",
    body: "If a model practises on one page of a website and is tested on another page of the same site, that's like seeing the exam early. Every website sits on one side only. The score dropped from 87.9 to 85.5: the honest number.",
  },
  {
    kind: "text", title: "Same rules for everyone",
    body: "Every model got the same practice examples, the same amount of fine-tuning and the same final exam. We timed how long each one took to learn and to answer.",
  },
  {
    kind: "image", title: "One rulebook, used twice", img: IMG("photo-1750944881571-458e33204353"), credit: "Photo: Anne Nyg\u00e5rd / Unsplash",
    body: "The exact same code reads the clues while the model learns and when you paste a link, so it always sees things the way it was taught.",
  },
  {
    kind: "text", title: "What it can't promise",
    body: "Brand-new scams, hacked real websites and pages that hide from scanners can still slip through. Treat the answer as strong advice, not a guarantee.",
  },
];

export default function Methodology() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    if (reduced) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", () => {
      const el = track.current!;
      const distance = () => el.scrollWidth - window.innerWidth + 48;
      gsap.to(el, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${distance()}`, scrub: 0.8, pin: true, invalidateOnRefresh: true, anticipatePin: 1 },
      });
    });
    return () => mm.revert();
  }, [reduced]);

  return (
    <section id="method" ref={root} className="relative z-10 overflow-hidden bg-abyss py-24 md:py-0">
      <div className="flex min-h-[100svh] flex-col justify-center">
        <div className="shell">
          <p className="font-display text-lg font-bold text-biolume">Chapter 5</p>
          <h2 className="mt-2 max-w-[20ch] font-display text-display-lg font-extrabold">How we kept the score honest</h2>
          <p className="lede mt-5 text-xl">Many phishing projects online report near-perfect scores because their data has hidden shortcuts. Here are the ones we found, and what we did about them.</p>
        </div>
        <div ref={track} className="mt-12 flex gap-5 overflow-x-auto px-5 pb-6 sm:px-8 md:overflow-visible lg:px-12" style={{ scrollbarWidth: "none" }}>
          {CARDS.map((c) => (
            <article key={c.title} className={`panel relative flex w-[82vw] shrink-0 flex-col justify-end overflow-hidden p-7 sm:w-[440px] ${c.kind === "image" ? "min-h-[440px]" : "min-h-[440px]"}`}>
              {c.img && (
                <>
                  <img src={c.img} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-45" />
                  <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/70 to-transparent" />
                </>
              )}
              <div className="relative">
                {c.stat && <p className="font-display text-[clamp(4rem,9vw,7rem)] font-extrabold leading-none tracking-tighter text-lure">{c.stat}</p>}
                <h3 className="mt-3 font-display text-2xl font-bold tracking-tight">{c.title}</h3>
                <p className="mt-3 text-mist">{c.body}</p>
                {c.credit && <p className="mt-4 text-[11px] text-mist/80">{c.credit}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
