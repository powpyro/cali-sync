import React from "react";

interface CaliSyncLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  showBadge?: boolean;
  badgeText?: string;
  variant?: "light" | "dark" | "mono";
  className?: string;
}

export const CaliSyncLogo: React.FC<CaliSyncLogoProps> = ({
  size = "md",
  showText = true,
  showBadge = false,
  badgeText = "v2.0",
  variant = "light",
  className = "",
}) => {
  // Dimension maps
  const dimensions = {
    sm: { icon: 28, text: "text-base", subtext: "text-[9px]", gap: "gap-2" },
    md: { icon: 36, text: "text-xl", subtext: "text-[10px]", gap: "gap-2.5" },
    lg: { icon: 48, text: "text-2xl", subtext: "text-xs", gap: "gap-3" },
    xl: { icon: 64, text: "text-3xl", subtext: "text-xs", gap: "gap-4" },
  }[size];

  const iconSize = dimensions.icon;
  const isDarkTheme = variant === "dark";

  return (
    <div className={`inline-flex items-center ${dimensions.gap} select-none group ${className}`}>
      {/* ── VECTOR ICON : DYNAMIC AUDIO SYNC WAVES & CALIBRATION CORE ── */}
      <div
        style={{ width: iconSize, height: iconSize }}
        className="relative flex-shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          <defs>
            {/* Wave Cyan Gradient */}
            <linearGradient id="caliCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1DC4FF" />
              <stop offset="100%" stopColor="#0088CC" />
            </linearGradient>

            {/* Deep Slate Navy Gradient */}
            <linearGradient id="caliNavyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
          </defs>

          {/* Background Rounded Shield / Tile */}
          <rect
            x="2"
            y="2"
            width="60"
            height="60"
            rx="18"
            fill={isDarkTheme ? "#0F172A" : "#FFFFFF"}
            stroke={isDarkTheme ? "#1E293B" : "#E2E8F0"}
            strokeWidth="2"
            className="transition-colors duration-300"
          />

          {/* Left Wave Arc (Evaluation / Input Wave) */}
          <path
            d="M20 22C14 26 14 38 20 42"
            stroke={isDarkTheme ? "#64748B" : "#0F172A"}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M26 16C16 23 16 41 26 48"
            stroke={isDarkTheme ? "#475569" : "#334155"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="1 3"
          />

          {/* Right Wave Arc (Gauge / Reference Wave - Vibrant Wave Cyan) */}
          <path
            d="M44 22C50 26 50 38 44 42"
            stroke="url(#caliCyanGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M38 16C48 23 48 41 38 48"
            stroke="url(#caliCyanGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.75"
          />

          {/* Central Convergence Alignment Nodes (Sync Loop & Pulse Core) */}
          {/* Synchronizing Infinity Curves */}
          <path
            d="M24 32C24 28 28 26 32 32C36 38 40 36 40 32C40 28 36 26 32 32C28 38 24 36 24 32Z"
            stroke="url(#caliCyanGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Central Target Focal Point */}
          <circle
            cx="32"
            cy="32"
            r="3.5"
            fill="#1DC4FF"
            className="animate-pulse"
          />
          <circle
            cx="32"
            cy="32"
            r="7"
            stroke="#1DC4FF"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* ── TYPOGRAPHY WORDMARK ── */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight ${dimensions.text} ${
                isDarkTheme ? "text-white" : "text-[#0F172A]"
              }`}
            >
              Cali
              <span className="text-[#1DC4FF]">Sync</span>
            </span>

            {showBadge && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-[#1DC4FF]/10 text-[#0077AA] border border-[#1DC4FF]/30">
                {badgeText}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
