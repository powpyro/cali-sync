import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "indigo" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-extrabold rounded-2xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.97] button-press";

  const variantStyles = {
    primary:
      "bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 shadow-md shadow-[#1dc4ff]/25 border border-[#1dc4ff]/40",
    secondary:
      "bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 shadow-xs",
    danger:
      "bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 border border-rose-400/30",
    indigo:
      "bg-[#0f172a] hover:bg-[#1e293b] text-white shadow-md border border-slate-800",
    outline:
      "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-[#1dc4ff] shadow-xs",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-700 hover:text-slate-900",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-xs gap-2",
    lg: "px-5 py-2.5 text-sm gap-2.5",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
