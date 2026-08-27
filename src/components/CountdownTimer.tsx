import React, { useState, useEffect, useRef } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface CountdownTimerProps {
  closingDateStr: string;
  onTimeout?: () => void;
  warningThresholdMinutes?: number;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  closingDateStr,
  onTimeout,
  warningThresholdMinutes = 60,
}) => {
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  // Store onTimeout in a ref so changes to it never restart the interval
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  useEffect(() => {
    if (!closingDateStr) return;

    const calculateTimeLeft = () => {
      const closingTime = new Date(closingDateStr).getTime();
      const now = new Date().getTime();
      return closingTime - now;
    };

    // Initial calculation
    const initialDiff = calculateTimeLeft();
    setTimeLeftMs(initialDiff);

    if (initialDiff <= 0) {
      onTimeoutRef.current?.();
      return; // no interval needed, already expired
    }

    const interval = setInterval(() => {
      const diff = calculateTimeLeft();
      setTimeLeftMs(diff);

      if (diff <= 0) {
        clearInterval(interval);
        onTimeoutRef.current?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  // ⚠️ onTimeout intentionally excluded — we use the ref so the interval
  // is NOT recreated on every render (which was causing the blank-page flash).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closingDateStr]);

  if (timeLeftMs === null) return null;

  // Don't show if remaining time is greater than the warning threshold
  const thresholdMs = warningThresholdMinutes * 60 * 1000;
  if (timeLeftMs > thresholdMs) return null;

  if (timeLeftMs <= 0) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-950/80 border border-rose-500/40 text-rose-200 rounded-xl font-medium text-xs shadow-lg animate-pulse">
        <AlertTriangle className="w-4 h-4 text-rose-400" />
        <span>⏱ Clôturé — Plus de soumission possible</span>
      </div>
    );
  }

  // Format hours, minutes, seconds
  const totalSeconds = Math.floor(timeLeftMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => String(num).padStart(2, "0");
  const formattedTime = `${hours > 0 ? pad(hours) + ":" : ""}${pad(minutes)}:${pad(seconds)}`;

  const isUrgent = timeLeftMs <= 10 * 60 * 1000; // <= 10 minutes

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-md transition-all duration-300 ${
        isUrgent
          ? "bg-rose-950/80 border-rose-500/50 text-rose-200 animate-pulse"
          : "bg-amber-950/85 border-amber-500/40 text-amber-200"
      }`}
    >
      <Clock className={`w-4 h-4 ${isUrgent ? "text-rose-400 animate-bounce" : "text-amber-400"}`} />
      <div className="flex flex-col sm:flex-row sm:items-center gap-1">
        <span>Temps restant pour soumettre :</span>
        <span className="font-mono text-sm tracking-wider font-bold">
          {formattedTime}
        </span>
      </div>
    </div>
  );
};

export default CountdownTimer;
