import React from "react";
import { Loader2 } from "lucide-react";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = "md", className = "", label }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div className="flex items-center justify-center gap-2 p-4">
      <Loader2 className={`animate-spin text-teal-400 ${sizeClasses[size]} ${className}`} />
      {label && <span className="text-xs font-semibold text-slate-400">{label}</span>}
    </div>
  );
};
