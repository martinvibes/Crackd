/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#070709",
          raised: "#0F0F14",
          elevated: "#16161E",
          border: "rgba(255, 255, 255, 0.08)",
          "border-strong": "rgba(255, 255, 255, 0.14)",
        },
        fg: {
          primary: "#F4F4F7",
          secondary: "#9A9AA8",
          muted: "#5A5A68",
          dim: "#32323D",
        },
        accent: {
          DEFAULT: "#B8FF3B", // acid lime — brand, CTAs, POT (correct place)
          glow: "rgba(184, 255, 59, 0.35)",
          dim: "rgba(184, 255, 59, 0.12)",
          deep: "#95CC2B",
        },
        honey: {
          DEFAULT: "#F6B93B", // warm amber — PAN (wrong place)
          glow: "rgba(246, 185, 59, 0.35)",
          dim: "rgba(246, 185, 59, 0.12)",
        },
        danger: {
          DEFAULT: "#FF5C6A",
          dim: "rgba(255, 92, 106, 0.12)",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        "extra-tight": "-0.02em",
      },
      boxShadow: {
        glow: "0 0 40px -10px var(--accent-glow, rgba(184, 255, 59, 0.45))",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 48px -24px rgba(0,0,0,0.7)",
        cta: "0 10px 30px -10px rgba(184, 255, 59, 0.55), inset 0 1px 0 rgba(255,255,255,0.2)",
      },
      backgroundImage: {
        "grid-dots":
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        "slide-up": {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.6 },
        },
      },
      animation: {
        "fade-in": "fade-in 300ms ease-out",
        "slide-up": "slide-up 260ms cubic-bezier(0.2,0.8,0.2,1)",
        pulse: "pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
