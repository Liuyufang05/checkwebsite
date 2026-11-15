import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap, ScrollTrigger, usePrefersReducedMotion } from "../lib/motion";

const STEPS = [
  {
    title: "We open it safely",
    body: "First we make sure the link doesn't point somewhere it shouldn't, like devices on your own network. Then a locked-down browser opens it for us, so nothing ever touches your computer.",
    visual: 0,
  },
  {
    title: "We look for the tricks",
    body: "Scammers leave clues: a bank's name in the wrong part of the address, cheap endings like .top, words like 'verify', or a password box that sends your details to another website. We check 68 of them.",
    visual: 1,
  },
  {
    title: "We give you a straight answer",
    body: "Two trained models make a guess, then we double-check with facts: how old the website is, whether its security padlock is real, and Google's list of known scams. You get Safe, Suspicious or Phishing, with the reasons.",
    visual: 4,
  },
];

function Visual({ step }: { step: number }) {
  const common = { initial: { opacity: 0, y: 24, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -24, scale: 0.97 }, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } as const;
  return (
    <AnimatePresence mode="wait">
      {step === 0 && (
        <motion.ul key="0" {...common} className="data w-full space-y-3 text-sm">
          {[["127.0.0.1", "your own computer", false], ["169.254.169.254", "cloud server secrets", false], ["10.0.0.5", "your home network", false], ["93.184.216.34", "a public website", true]].map(([ip, why, ok]) => (
            <li key={String(ip)} className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${ok ? "border-biolume/60 text-biolume" : "border-lure/50 text-lure"}`}>
              <span>{String(ip)}</span><span className="text-mist">{String(why)}</span><span>{ok ? "allowed" : "blocked"}</span>
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
            <li className="chip justify-center border-lure/50 text-lure">PayPal's name in the wrong place</li>
            <li className="chip justify-center border-kelp/50 text-kelp">Words like "login", "verify"</li>
            <li className="chip justify-center border-lure/50 text-lure">Cheap ending: .top</li>
            <li className="chip justify-center border-lure/50 text-lure">Points to a script file</li>
          </ul>
        </motion.div>
      )}
      {step === 2 && (
        <motion.div key="2" {...common} className="w-full rounded-2xl border border-reef p-6">
          <p className="font-display text-xl font-bold">Verify your account</p>
          <div className="mt-4 space-y-3">
            <div className="h-11 rounded-xl border border-reef" />
            <div className="flex h-11 items-center rounded-xl border-2 border-lure px-4 text-lure">password field</div>
            <div className="flex h-11 items-center justify-center rounded-xl bg-foam/90 font-semibold text-abyss">Sign in</div>
          </div>
          <p className="data mt-4 text-sm text-lure">form action = https://collector.another-domain.ru/p.php</p>
          <p className="mt-2 text-sm text-mist">0 links to the brand's real site, 0 images, 1 hidden field</p>
        </motion.div>
      )}
      {step === 3 && (
        <motion.div key="3" {...common} className="w-full space-y-5">
          {[["URL model", 0.91, "bg-lure"], ["Page-content model", 0.97, "bg-lure"], ["Blended", 0.934, "bg-foam"]].map(([n, p, c]) => (
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
            {[["Website created 3 days ago", "risky", "text-lure"], ["Password box sends to another site", "risky", "text-lure"], ["Security padlock is real", "fine", "text-biolume"], ["On Google's list of scam sites", "risky", "text-lure"]].map(([a, b, c]) => (
              <li key={a} className="flex justify-between rounded-xl border border-reef px-4 py-3"><span>{a}</span><span className={`data ${c}`}>{b}</span></li>
            ))}
          </ul>
          <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring" }}
            className="mt-6 inline-flex rounded-full bg-lure px-6 py-3 font-display text-2xl font-extrabold text-abyss">Verdict: Phishing</motion.p>
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
      <h2 className="max-w-[16ch] font-display text-display-lg font-extrabold">How it works, in 3 steps</h2>
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
