import React from "react";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = "", interactive = false }) => {
  return (
    <div
      className={`glass-panel p-5 space-y-4 ${
        interactive ? "hover:border-teal-500/30 hover:shadow-xl hover:shadow-teal-500/5 transition-all" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <div className={`flex items-center justify-between pb-3 border-b border-slate-800/80 gap-3 ${className}`}>{children}</div>;

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <h3 className={`font-bold text-white text-sm tracking-tight ${className}`}>{children}</h3>;

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <p className={`text-xs text-slate-400 font-medium ${className}`}>{children}</p>;

export const CardBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <div className={`space-y-3 ${className}`}>{children}</div>;

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <div className={`pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2 ${className}`}>{children}</div>;
