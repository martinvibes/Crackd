import { BrowserRouter, Route, Routes, Navigate, useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import PlayLayout from "./components/PlayLayout";
import Home from "./pages/Home";
import Game from "./pages/Game";
import Leaderboard from "./pages/Leaderboard";
import Logos from "./pages/Logos";

/**
 * /join/:code → redirects to /play?mode=pvp_casual&invite=CODE so the
 * joiner lands on the setup panel with the invite pre-filled. This lets
 * creators share a URL (`crackd.xyz/join/5DA70B`) instead of asking
 * friends to paste a code manually.
 */
function JoinRedirect() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/play?mode=pvp_casual&invite=${code ?? ""}`, { replace: true });
  }, [code, navigate]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home owns its own chrome (no bottom nav — cleaner landing). */}
        <Route path="/" element={<Home />} />

        {/* Brand review — kept for reference. */}
        <Route path="/logos" element={<Logos />} />

        {/* Everything else gets the game-app chrome with floating bottom tab bar. */}
        <Route element={<PlayLayout />}>
          <Route path="/play" element={<Game />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Route>

        {/* /join/:code → auto-redirect into /play with invite pre-filled */}
        <Route
          path="/join/:code"
          element={<JoinRedirect />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
