"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { UI_DIMENSIONS } from "@/shared/constants/ui";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={UI_DIMENSIONS.THEME_TOGGLE.SIZE} />; // skeleton width
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={`flex items-center justify-center ${UI_DIMENSIONS.THEME_TOGGLE.SIZE} rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer`}
      aria-label="Toggle Theme"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
