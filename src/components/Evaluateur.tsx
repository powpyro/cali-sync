import React, { useState } from "react";
import { postCalibration, type CalibrationPayload } from "../lib/api";
import { Send, CheckCircle2, AlertCircle, User, FileAudio, Bookmark, Sparkles, MessageSquare } from "lucide-react";

interface EvaluateurProps {
  sessionId: string;
  setSessionId: (id: string) => void;
  evaluateurId: string;
  setEvaluateurId: (id: string) => void;
}

export const Evaluateur: React.FC<EvaluateurProps> = ({
  sessionId,
  setSessionId,
  evaluateurId,
  setEvaluateurId,
}) => {
  const [categorie, setCategorie] = useState("Relationnel");
  const [item, setItem] = useState("Sourire & Empathie");
  const [statut, setStatut] = useState<"Oui" | "Non" | "N.A.">("Oui");
  const [commentaire, setCommentaire] = useState("");
  const [estGauge, setEstGauge] = useState(false);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const categories = [
    "Relationnel",
    "Technique & Outils",
    "Conformité & Process",
    "Clôture & Synthèse",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !evaluateurId || !item) {
      setFeedback({ success: false, message: "Veuillez remplir tous les champs obligatoires." });
      return;
    }

    setLoading(true);
    setFeedback(null);

    const payload: CalibrationPayload = {
      session_id: sessionId,
      evaluateur_id: evaluateurId,
      categorie,
      item,
      statut,
      commentaire,
      est_gauge: estGauge,
    };

    const res = await postCalibration(payload);
    setLoading(false);

    if (res.success) {
      setFeedback({
        success: true,
        message: estGauge
          ? "Référence (Gauge) enregistrée avec succès !"
          : "Évaluation soumise avec succès !",
      });
      setCommentaire("");
    } else {
      setFeedback({
        success: false,
        message: res.message || "Erreur lors de l'enregistrement de l'évaluation.",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Espace Évaluateur
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Saisie d'Évaluation Qualité
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Évaluez les critères de la session ou définissez la réponse de référence (Gauge).
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <User className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="text-xs text-slate-400">Évaluateur actif</div>
              <div className="text-sm font-semibold text-white">{evaluateurId || "EVAL_01"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identifiants Session & Évaluateur */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                ID Session <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <FileAudio className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="ex: SESS_2026_001"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                ID Évaluateur <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={evaluateurId}
                  onChange={(e) => setEvaluateurId(e.target.value)}
                  placeholder="ex: EVAL_01"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          {/* Selection Catégorie & Critère */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Catégorie du Critère
              </label>
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-white">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Nom du Critère / Item <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="ex: Sourire & Empathie"
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                required
              />
            </div>
          </div>

          {/* Sélection de la Note / Statut */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Évaluation du Critère
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["Oui", "Non", "N.A."] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatut(option)}
                  className={`py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border ${
                    statut === option
                      ? option === "Oui"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10"
                        : option === "Non"
                        ? "bg-rose-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/10"
                        : "bg-slate-700/50 border-slate-500 text-slate-200"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {option === "Oui" && <CheckCircle2 className="w-4 h-4" />}
                  {option === "Non" && <AlertCircle className="w-4 h-4" />}
                  {option === "N.A." && <Bookmark className="w-4 h-4" />}
                  {option === "Oui" ? "Oui (Conforme)" : option === "Non" ? "Non (Imputé)" : "N.A. (Exclus)"}
                </button>
              ))}
            </div>
          </div>

          {/* Commentaire Justificatif */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Commentaire & Justification
            </label>
            <div className="relative">
              <MessageSquare className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                rows={3}
                placeholder="Renseignez des détails ou justifications sur la note..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Option Réponse de Référence (Gauge) */}
          <div className="flex items-center gap-3 p-4 bg-indigo-950/40 border border-indigo-500/20 rounded-xl">
            <input
              type="checkbox"
              id="estGauge"
              checked={estGauge}
              onChange={(e) => setEstGauge(e.target.checked)}
              className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500"
            />
            <label htmlFor="estGauge" className="text-sm font-medium text-slate-200 cursor-pointer">
              Définir comme <span className="text-indigo-400 font-bold">Réponse de Référence (Gauge)</span> pour la calibration
            </label>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`p-4 rounded-xl flex items-center gap-3 border ${
                feedback.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {feedback.success ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              )}
              <span className="text-sm font-medium">{feedback.message}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 text-base cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" /> Envoyer la soumission
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
