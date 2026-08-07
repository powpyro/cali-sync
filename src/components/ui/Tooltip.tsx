import React, { useState } from "react";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = "top" }) => {
  const [visible, setVisible] = useState(false);

  const positionStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <div
          className={`absolute ${positionStyles[position]} z-50 px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none animate-slide-down`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
