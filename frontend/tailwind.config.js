/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        abyss: "rgb(var(--abyss) / <alpha-value>)",
        trench: "rgb(var(--trench) / <alpha-value>)",
        reef: "rgb(var(--reef) / <alpha-value>)",
        foam: "rgb(var(--foam) / <alpha-value>)",
        mist: "rgb(var(--mist) / <alpha-value>)",
        biolume: "rgb(var(--biolume) / <alpha-value>)",
        lure: "rgb(var(--lure) / <alpha-value>)",
        kelp: "rgb(var(--kelp) / <alpha-value>)",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3.2rem, 8.6vw, 9rem)", { lineHeight: "0.88", letterSpacing: "-0.055em" }],
        "display-lg": ["clamp(2.6rem, 6.8vw, 6.4rem)", { lineHeight: "0.9", letterSpacing: "-0.045em" }],
        "display-md": ["clamp(2rem, 4.2vw, 3.6rem)", { lineHeight: "0.95", letterSpacing: "-0.035em" }],
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        sway: { "0%,100%": { transform: "rotate(-3deg)" }, "50%": { transform: "rotate(3deg)" } },
        bob: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        ping: { "0%": { transform: "scale(0.2)", opacity: "0.9" }, "100%": { transform: "scale(1)", opacity: "0" } },
      },
      animation: {
        marquee: "marquee var(--marquee-speed, 40s) linear infinite",
        sway: "sway 5s ease-in-out infinite",
        bob: "bob 4.5s ease-in-out infinite",
        ping: "ping 2.4s cubic-bezier(0.2, 0.6, 0.3, 1) infinite",
      },
    },
  },
  plugins: [],
};
