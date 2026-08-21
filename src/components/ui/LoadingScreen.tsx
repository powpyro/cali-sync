import React, { useState, useEffect } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";

interface LoadingScreenProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  variant?: "light" | "dark" | "transparent";
  className?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  title = "Connexion au serveur...",
  subtitle = "Chargement de la session en cours. Merci de patienter.",
  onBack,
  variant = "light",
  className = "",
}) => {
  // Dynamic step message sequence
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    "Connexion sécurisée au serveur Apps Script...",
    "Récupération des données et des critères...",
    "Synchronisation des votes et de la jauge...",
    "Finalisation du studio de calibrage...",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [steps.length]);

  const isDark = variant === "dark";

  return (
    <div
      className={`min-h-[60vh] flex flex-col items-center justify-center font-sans relative select-none animate-fade-in ${
        isDark ? "text-white" : "text-slate-900"
      } ${className}`}
    >
      {/* Optional Back Button */}
      {onBack && (
        <div className="w-full max-w-lg mb-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-extrabold cursor-pointer group px-3 py-1.5 rounded-xl hover:bg-slate-100/80"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Retour au menu</span>
          </button>
        </div>
      )}

      {/* ── CARD CONTAINER WITH SOFT GLASS EFFECT ── */}
      <div className="w-full max-w-lg mx-auto bg-white/90 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-8 sm:p-12 text-center shadow-xl shadow-slate-900/5 relative overflow-hidden space-y-8">
        
        {/* Background Ambient Radial Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#1dc4ff]/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* ── ANIMATED LOGO CORE ── */}
        <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
          {/* Outer Pulsating Ripple Halo 1 */}
          <div className="absolute inset-0 rounded-3xl bg-[#1dc4ff]/20 animate-ping opacity-35" />

          {/* Outer Pulsating Ripple Halo 2 (Slower delay) */}
          <div className="absolute -inset-2 rounded-3xl border-2 border-[#1dc4ff]/30 animate-pulse" />

          {/* Rotating Subtle Gradient Border Aura */}
          <div className="absolute -inset-1 rounded-[26px] bg-gradient-to-tr from-[#1dc4ff]/40 via-cyan-400/20 to-blue-600/30 blur-xs animate-spin" style={{ animationDuration: "8s" }} />

          {/* ── LOGO ICON SHIELD ── */}
          <div className="relative w-24 h-24 rounded-2xl bg-white border border-slate-200/90 shadow-lg flex items-center justify-center p-3 z-10 overflow-hidden">
            <svg
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full drop-shadow-sm"
            >
              <defs>
                <linearGradient id="loadCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1DC4FF" />
                  <stop offset="100%" stopColor="#0077AA" />
                </linearGradient>
              </defs>

              {/* Left Wave Arc (Animated Draw & Pulse) */}
              <path
                d="M20 22C14 26 14 38 20 42"
                stroke="#0F172A"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="animate-pulse"
                style={{ animationDuration: "2s" }}
              />
              <path
                d="M26 16C16 23 16 41 26 48"
                stroke="#334155"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="1 3"
                opacity="0.8"
              />

              {/* Right Wave Arc (Cyan Glow Accent) */}
              <path
                d="M44 22C50 26 50 38 44 42"
                stroke="url(#loadCyanGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="animate-pulse"
                style={{ animationDuration: "1.6s", animationDelay: "0.2s" }}
              />
              <path
                d="M38 16C48 23 48 41 38 48"
                stroke="url(#loadCyanGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.75"
              />

              {/* Central Synchronizing Loop */}
              <path
                d="M24 32C24 28 28 26 32 32C36 38 40 36 40 32C40 28 36 26 32 32C28 38 24 36 24 32Z"
                stroke="url(#loadCyanGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Glowing Heartbeat Focal Center */}
              <circle
                cx="32"
                cy="32"
                r="4"
                fill="#1DC4FF"
                className="animate-ping"
                style={{ animationDuration: "1.5s" }}
              />
              <circle
                cx="32"
                cy="32"
                r="3.5"
                fill="#1DC4FF"
              />
            </svg>
          </div>
        </div>

        {/* ── AUDIO EQUALIZER MICRO-BARS ── */}
        <div className="flex items-center justify-center gap-1.5 h-6">
          <span className="w-1 bg-[#1dc4ff] rounded-full animate-bounce h-2" style={{ animationDelay: "0ms", animationDuration: "0.8s" }} />
          <span className="w-1 bg-[#1dc4ff] rounded-full animate-bounce h-4" style={{ animationDelay: "150ms", animationDuration: "0.9s" }} />
          <span className="w-1 bg-[#009ae5] rounded-full animate-bounce h-6" style={{ animationDelay: "300ms", animationDuration: "0.7s" }} />
          <span className="w-1 bg-[#1dc4ff] rounded-full animate-bounce h-5" style={{ animationDelay: "450ms", animationDuration: "1s" }} />
          <span className="w-1 bg-[#1dc4ff] rounded-full animate-bounce h-3" style={{ animationDelay: "200ms", animationDuration: "0.85s" }} />
          <span className="w-1 bg-[#0077aa] rounded-full animate-bounce h-2" style={{ animationDelay: "350ms", animationDuration: "0.95s" }} />
        </div>

        {/* ── TEXT & STATUS HEADINGS ── */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1dc4ff]/10 border border-[#1dc4ff]/25 text-[#0077aa] text-[11px] font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#1dc4ff]" />
            <span>CaliSync Live Sync</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {title}
          </h2>

          <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed max-w-sm mx-auto">
            {subtitle}
          </p>

          {/* Stepped progress ticker */}
          <div className="h-5 flex items-center justify-center">
            <span key={currentStep} className="text-xs font-bold text-[#0077aa] animate-fade-in truncate max-w-xs">
              {steps[currentStep]}
            </span>
          </div>
        </div>

        {/* ── TRAVELING SHIMMER PROGRESS LINE ── */}
        <div className="w-full max-w-xs mx-auto space-y-1.5">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/80">
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-transparent via-[#1dc4ff] to-transparent w-2/3 rounded-full animate-shimmer"
              style={{
                animation: "shimmerLine 1.8s infinite ease-in-out",
              }}
            />
          </div>
        </div>
      </div>

      {/* Global Shimmer Animation Style */}
      <style>{`
        @keyframes shimmerLine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};
