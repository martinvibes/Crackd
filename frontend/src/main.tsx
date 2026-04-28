import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import { useWalletStore } from "./store/walletStore";
import { PrivyWalletBridge } from "./lib/privyBridge";
import "./index.css";

// Buffer is required by parts of @stellar/stellar-sdk in a browser env.
import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  (window as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

function Root() {
  const restore = useWalletStore((s) => s.restore);
  useEffect(() => {
    restore();
  }, [restore]);
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

function WrappedRoot() {
  // If Privy isn't configured (e.g. dev without an app id), skip the
  // provider so the kit path still works. Privy buttons will be hidden
  // by ConnectModal when usePrivy isn't available.
  if (!PRIVY_APP_ID) {
    console.warn(
      "[crackd] VITE_PRIVY_APP_ID not set — Privy login disabled. Crypto wallet path still works.",
    );
    return <Root />;
  }
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google", "apple"],
        appearance: {
          theme: "dark",
          accentColor: "#FF00A8",
          // Privy renders the logo inside its modal at ~40px tall.
          // Same PNG we point the dashboard at, so there's only one
          // file to swap if branding changes. Served from /public.
          logo: `${window.location.origin}/crackd-logo.png`,
        },
      }}
    >
      <PrivyWalletBridge />
      <Root />
    </PrivyProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WrappedRoot />
  </StrictMode>,
);
