"use client";

import { useEffect, useState } from "react";

// Opal light is the default (no attribute). Dark (reversed black+gold) is opt-in,
// persisted in localStorage and applied pre-paint by the inline script in layout.tsx.
export default function ThemeToggle() {
  const [light, setLight] = useState(true);

  useEffect(() => {
    setLight(document.documentElement.dataset.theme !== "dark");
  }, []);

  function toggle() {
    const next = !light; // next === true → light
    setLight(next);
    const root = document.documentElement;
    if (next) delete root.dataset.theme;
    else root.dataset.theme = "dark";
    try { localStorage.setItem("bc-theme", next ? "light" : "dark"); } catch { /* ignore */ }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-pressed={light}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      title={light ? "Dark mode" : "Light mode"}
    >
      {light ? "☾" : "☀"}
    </button>
  );
}
