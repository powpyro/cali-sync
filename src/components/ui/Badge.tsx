import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "indigo" | "purple";
  size?: "sm" | "md";
  pulse?: boolean;
  className?: string;
}

// ── 3-Color Wave Design System ────────────────────────────────────────────────
// Primary: Wave Cyan #1DC4FF  |  Navy: #0F172A  |  Neutral: #F1F5F9 / #FFFFFF
// Status (functional only): Success #10B981  |  Danger #EF4444  |  Warning #F59E0B
// ─────────────────────────────────────────────────────────────────────────────

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  pulse = false,
  className = "",
}) => {
  const variantStyles = {
    // Functional status (use sparingly)
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger:  "bg-rose-50 text-rose-700 border-rose-200",
    // Wave Cyan primary accent
    info:    "bg-[#1dc4ff]/10 text-[#0077aa] border-[#1dc4ff]/30",
    indigo:  "bg-[#1dc4ff]/10 text-[#0077aa] border-[#1dc4ff]/30",
    purple:  "bg-[#1dc4ff]/10 text-[#0077aa] border-[#1dc4ff]/30",
    // Neutral
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-lg border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      {children}
    </span>
  );
};
