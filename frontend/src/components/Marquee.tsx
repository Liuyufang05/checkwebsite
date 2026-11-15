/** Infinite marquee. Content is duplicated once; CSS animates -50%. Pauses on hover. */
export default function Marquee({ items, speed = 40, outline = false, reverse = false }: { items: string[]; speed?: number; outline?: boolean; reverse?: boolean }) {
  const row = (aria: boolean) => (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={aria}>
      {items.map((t, i) => (
        <li key={i} className={`whitespace-nowrap ${outline ? "text-outline" : ""}`}>{t}</li>
      ))}
    </ul>
  );
  return (
    <div className="group relative flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div
        className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        style={{ ["--marquee-speed" as string]: `${speed}s`, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
