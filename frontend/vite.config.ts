import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Stellar SDK references `global` and `Buffer` as if they were Node — we
// shim them via the `buffer` package on window (see main.tsx) and set
// `global = globalThis` here for libs that expect it at build time.
export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
    "process.env": {},
  },
  optimizeDeps: {
    include: ["buffer"],
  },
});
