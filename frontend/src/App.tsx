import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import PlayLayout from "./components/PlayLayout";
import Home from "./pages/Home";
import Game from "./pages/Game";
import Leaderboard from "./pages/Leaderboard";
import Logos from "./pages/Logos";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home owns its own chrome (no bottom nav — cleaner landing). */}
        <Route path="/" element={<Home />} />

        {/* Temporary brand-review route. Delete once a logo is picked. */}
        <Route path="/logos" element={<Logos />} />

        {/* Everything else gets the game-app chrome with floating bottom tab bar. */}
        <Route element={<PlayLayout />}>
          <Route path="/play" element={<Game />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
