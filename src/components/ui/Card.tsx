import React from "react";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

// ── 3-Color Wave Design System ────────────────────────────────────────────────
// Cards are always white (#FFFFFF) with subtle slate-200 border and soft shadow
// ─────────────────────────────────────────────────────────────────────────────

export const Card: React.FC<CardProps> = ({ children, className = "", interactive = false }) => {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4 ${
        interactive ? "hover:border-[#1dc4ff]/40 hover:shadow-md transition-all duration-200 cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <div className={`flex items-center justify-between pb-3 border-b border-slate-100 gap-3 ${className}`}>{children}</div>;

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <h3 className={`font-bold text-slate-900 text-sm tracking-tight ${className}`}>{children}</h3>;

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <p className={`text-xs text-slate-500 font-medium ${className}`}>{children}</p>;

export const CardBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <div className={`space-y-3 ${className}`}>{children}</div>;

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <div className={`pt-3 border-t border-slate-100 flex items-center justify-end gap-2 ${className}`}>{children}</div>;
