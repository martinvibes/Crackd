/**
 * Global background music toggle. Fixed position, always accessible.
 *
 * - Starts paused (browsers block autoplay anyway)
 * - Loops the track endlessly
 * - Remembers play/pause in localStorage so refreshes don't reset
 * - Subtle pulse animation on the icon when music is playing
 */
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "crackd-music";

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Create Audio element once on mount.
  useEffect(() => {
    const audio = new Audio("/assets/audios/soundchill2.mp3");
    audio.loop = true;
    audio.volume = 0.35;
    audioRef.current = audio;

    // Restore preference.
    if (localStorage.getItem(STORAGE_KEY) === "on") {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      localStorage.setItem(STORAGE_KEY, "off");
    } else {
      audio.play().then(() => {
        setPlaying(true);
        localStorage.setItem(STORAGE_KEY, "on");
      }).catch(() => {});
    }
  }, [playing]);

  return (
    <button
      onClick={toggle}
      className="fixed top-20 right-5 z-50 h-10 w-10 rounded-full grid place-items-center border transition-all hover:-translate-y-0.5"
      style={{
        background: playing
          ? "rgba(255,0,168,0.12)"
          : "rgba(4,0,8,0.85)",
        borderColor: playing
          ? "rgba(255,0,168,0.4)"
          : "rgba(255,255,255,0.1)",
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
      }}
      aria-label={playing ? "Pause music" : "Play music"}
      title={playing ? "Pause music" : "Play music"}
    >
      {playing ? <IconMusicOn /> : <IconMusicOff />}
    </button>
  );
}

function IconMusicOn() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FF00A8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-pulse"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconMusicOff() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(237,230,240,0.5)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
      <line x1="1" y1="1" x2="23" y2="23" stroke="rgba(237,230,240,0.5)" strokeWidth="2" />
    </svg>
  );
}
