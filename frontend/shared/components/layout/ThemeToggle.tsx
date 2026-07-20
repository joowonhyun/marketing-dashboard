"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { UI_DIMENSIONS } from "@/shared/constants/ui";

const emptySubscribe = () => () => {};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // SSR과 클라이언트의 초기 렌더가 항상 일치하도록(effect에서 setState하는 대신)
  // useSyncExternalStore로 "마운트 여부"를 표현한다.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return <div className={UI_DIMENSIONS.THEME_TOGGLE.SIZE} />; // 스켈레톤 너비
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
