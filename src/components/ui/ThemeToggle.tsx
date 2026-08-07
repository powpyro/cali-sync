import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "", showLabel = false }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl border transition-all duration-200 flex items-center gap-2 cursor-pointer select-none ${
        isDark
          ? "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800 hover:border-slate-700"
          : "bg-white border-slate-200 text-indigo-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
      } ${className}`}
      title={isDark ? "Passer en Mode Clair ☀️" : "Passer en Mode Sombre 🌙"}
      aria-label="Changer le thème"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 animate-scale-up" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-600 animate-scale-up" />
      )}
      {showLabel && (
        <span className="text-xs font-bold tracking-tight">
          {isDark ? "Mode Clair" : "Mode Sombre"}
        </span>
      )}
    </button>
  );
};
