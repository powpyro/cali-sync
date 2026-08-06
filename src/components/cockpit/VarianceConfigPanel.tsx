import { useState } from "react";
import { Settings, RotateCcw, Save, X, Info, CheckCircle } from "lucide-react";
import {
  type VarianceThresholds,
  DEFAULT_THRESHOLDS,
  saveVarianceThresholds,
  getVarianceColorClasses,
} from "../../hooks/useVarianceConfig";

interface VarianceConfigPanelProps {
  thresholds: VarianceThresholds;
  onSave: (t: VarianceThresholds) => void;
  onClose: () => void;
}

export function VarianceConfigPanel({ thresholds, onSave, onClose }: VarianceConfigPanelProps) {
  const [greenMax, setGreenMax] = useState(thresholds.greenMax);
  const [orangeMax, setOrangeMax] = useState(thresholds.orangeMax);
  const [saved, setSaved] = useState(false);

  const isValid = greenMax >= 0 && orangeMax > greenMax && orangeMax <= 100;

  const handleSave = () => {
    if (!isValid) return;
    const newT: VarianceThresholds = { greenMax, orangeMax };
    saveVarianceThresholds(newT);
    onSave(newT);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setGreenMax(DEFAULT_THRESHOLDS.greenMax);
    setOrangeMax(DEFAULT_THRESHOLDS.orangeMax);
  };

  // Preview badges
  const previewValues = [
    { label: "Très calibré", value: Math.round(greenMax / 2) },
    { label: "Limite verte", value: greenMax },
    { label: "Zone orange", value: Math.round((greenMax + orangeMax) / 2) },
    { label: "Limite orange", value: orangeMax },
    { label: "Forte variance", value: Math.min(100, orangeMax + 20) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">Configuration des Codes Couleurs</h2>
              <p className="text-xs text-slate-400 font-medium">Seuils de variance vs Gauge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-200 font-medium leading-relaxed">
              Le taux de variance représente le pourcentage d'items où un évaluateur a coté différemment du Gauge.
              Définissez les seuils pour personnaliser les badges colorés.
            </p>
          </div>

          {/* Threshold controls */}
          <div className="space-y-5">
            {/* Green threshold */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-white flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                  Seuil Vert (Calibré)
                </label>
                <span className="text-sm font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                  ≤ {greenMax}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={95}
                step={1}
                value={greenMax}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setGreenMax(v);
                  if (v >= orangeMax) setOrangeMax(Math.min(100, v + 5));
                }}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${greenMax}%, #334155 ${greenMax}%, #334155 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            {/* Orange threshold */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-white flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                  Seuil Orange (À surveiller)
                </label>
                <span className="text-sm font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                  ≤ {orangeMax}%
                </span>
              </div>
              <input
                type="range"
                min={Math.min(greenMax + 1, 100)}
                max={100}
                step={1}
                value={orangeMax}
                onChange={(e) => setOrangeMax(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${orangeMax}%, #334155 ${orangeMax}%, #334155 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            {/* Red info */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                Rouge (Forte Variance)
              </div>
              <span className="text-sm font-black text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-lg">
                &gt; {orangeMax}%
              </span>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Aperçu</p>
            <div className="flex flex-wrap gap-2">
              {previewValues.map(({ label, value }) => {
                const cls = getVarianceColorClasses(value, { greenMax, orangeMax });
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${cls.badge}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                    {label} ({value}%)
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation error */}
          {!isValid && (
            <div className="text-xs text-rose-400 font-bold p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              ⚠️ Le seuil orange doit être supérieur au seuil vert et inférieur ou égal à 100%.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              {saved ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-200">Enregistré !</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
