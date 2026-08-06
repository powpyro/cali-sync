// src/hooks/useVarianceConfig.ts
// Gestion des seuils de codes couleurs pour le rapport de variances
// Persisté en localStorage

export interface VarianceThresholds {
  greenMax: number;   // Variance <= greenMax -> vert (ex: 20)
  orangeMax: number;  // Variance <= orangeMax -> orange (ex: 40), sinon rouge
}

export const DEFAULT_THRESHOLDS: VarianceThresholds = {
  greenMax: 20,
  orangeMax: 40,
};

const STORAGE_KEY = "calisync_variance_thresholds";

export function loadVarianceThresholds(): VarianceThresholds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.greenMax === "number" &&
        typeof parsed.orangeMax === "number" &&
        parsed.greenMax >= 0 &&
        parsed.orangeMax > parsed.greenMax &&
        parsed.orangeMax <= 100
      ) {
        return parsed as VarianceThresholds;
      }
    }
  } catch {}
  return { ...DEFAULT_THRESHOLDS };
}

export function saveVarianceThresholds(t: VarianceThresholds): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

export function getVarianceColor(
  variance: number,
  thresholds: VarianceThresholds
): "green" | "orange" | "red" {
  if (variance <= thresholds.greenMax) return "green";
  if (variance <= thresholds.orangeMax) return "orange";
  return "red";
}

export function getVarianceColorClasses(
  variance: number,
  thresholds: VarianceThresholds
): {
  badge: string;
  dot: string;
  text: string;
  bar: string;
} {
  const color = getVarianceColor(variance, thresholds);
  switch (color) {
    case "green":
      return {
        badge: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
        dot:   "bg-emerald-400",
        text:  "text-emerald-400",
        bar:   "bg-emerald-500",
      };
    case "orange":
      return {
        badge: "bg-amber-500/15 border-amber-500/30 text-amber-300",
        dot:   "bg-amber-400",
        text:  "text-amber-400",
        bar:   "bg-amber-500",
      };
    default:
      return {
        badge: "bg-rose-500/15 border-rose-500/30 text-rose-300",
        dot:   "bg-rose-400",
        text:  "text-rose-400",
        bar:   "bg-rose-500",
      };
  }
}
