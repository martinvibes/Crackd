/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#040008", // aligned with Home — deep almost-black
          raised: "#0B0612",
          elevated: "#14091C",
          border: "rgba(255, 0, 168, 0.14)", // magenta hairline
          "border-strong": "rgba(255, 0, 168, 0.28)",
        },
        fg: {
          primary: "#EDE6F0",
          secondary: "#A69DAD",
          muted: "#5E5568",
          dim: "#2C2630",
        },
        accent: {
          DEFAULT: "#FF00A8", // electric magenta — the only real colour
          glow: "rgba(255, 0, 168, 0.35)",
          dim: "rgba(255, 0, 168, 0.12)",
          deep: "#CC0086",
        },
        // PAN chip: soft neutral outline. Intentionally NOT a second brand colour.
        honey: {
          DEFAULT: "#EDE6F0",
          glow: "rgba(237, 230, 240, 0.25)",
          dim: "rgba(237, 230, 240, 0.08)",
        },
        danger: {
          DEFAULT: "#FF5C6A",
          dim: "rgba(255, 92, 106, 0.12)",
        },
        // --- variant palettes (v1 editorial, v2 terminal, v3 reveal, v4 vault) ---
        violet: {
          deep: "#7C3AED", // v1 editorial — deep purple
          soft: "#A78BFA",
          mist: "#E9E2F5",
          cream: "#F5F1E8",
        },
        magenta: {
          hot: "#FF00A8", // v4 vault
          plasma: "#E91E63", // v2 terminal
          glow: "rgba(255, 0, 168, 0.4)",
        },
        lilac: {
          DEFAULT: "#C4B5FD", // v3 reveal
          soft: "#DDD6FE",
          mist: "rgba(196, 181, 253, 0.15)",
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
