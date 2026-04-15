import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Game from "./pages/Game";
import Leaderboard from "./pages/Leaderboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home owns its own nav + footer so its magenta palette doesn't collide with the shared Layout's. */}
        <Route path="/" element={<Home />} />

        {/* Play + Leaderboard keep the shared Layout for now. Phase 5 can restyle them to match Home's palette. */}
        <Route element={<Layout />}>
          <Route path="/play" element={<Game />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
