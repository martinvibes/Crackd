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
    include: [
      "buffer",
      // Privy lazy-loads internal chunks (LandingScreen, OAuth flows, etc.)
      // when the login modal opens. Listing the SDK + the extended-chains
      // entry tells Vite to pre-bundle ALL of it up front so those chunks
      // don't 504 with "Outdated Optimize Dep" the first time a user
      // clicks "Continue with email".
      "@privy-io/react-auth",
      "@privy-io/react-auth/extended-chains",
    ],
  },
});
