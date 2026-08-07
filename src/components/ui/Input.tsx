import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  icon,
  className = "",
  id,
  ...props
}) => {
  const inputId = id || (label ? `input_${label.toLowerCase().replace(/\s+/g, "_")}` : undefined);

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && <div className="absolute left-3.5 text-slate-400 pointer-events-none">{icon}</div>}
        <input
          id={inputId}
          className={`w-full px-4 py-2.5 bg-slate-950 border ${
            error ? "border-rose-500/80 focus:border-rose-500" : "border-slate-800 focus:border-teal-500"
          } rounded-xl text-white font-bold text-xs placeholder:text-slate-500 focus:outline-none transition-all ${
            icon ? "pl-10" : ""
          } ${className}`}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-[11px] font-semibold text-rose-400">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
};

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  className = "",
  id,
  ...props
}) => {
  const selectId = id || (label ? `select_${label.toLowerCase().replace(/\s+/g, "_")}` : undefined);

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full px-4 py-2.5 bg-slate-950 border ${
          error ? "border-rose-500/80 focus:border-rose-500" : "border-slate-800 focus:border-teal-500"
        } rounded-xl text-white font-bold text-xs focus:outline-none transition-all cursor-pointer ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] font-semibold text-rose-400">{error}</p>}
    </div>
  );
};
