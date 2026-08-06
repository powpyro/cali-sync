import React, { useState } from "react";
import { validerHorsSession, cloturerSession } from "../lib/api";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileCheck,
  Server,
  Info,
  FileLock2,
  FileText,
  User,
} from "lucide-react";

export const Admin: React.FC = () => {
  // ── Validation Hors-Session State ──────────────────────────────────────────
  const [sessionId, setSessionId] = useState("SESS_2026_001");
  const [decision, setDecision] = useState<"APPROUVE" | "REJETE">("APPROUVE");
  const [motif, setMotif] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // ── Clôture de Session State (Gap 3) ───────────────────────────────────────
  const [clotureSessionId, setClotureSessionId] = useState("SESS_2026_001");
  const [clotureAnimateurId, setClotureAnimateurId] = useState("ANIM_01");
  const [clotureLoading, setClotureLoading] = useState(false);
  const [clotureFeedback, setClotureFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handleValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) {
      setFeedback({ success: false, message: "Veuillez spécifier l'ID de la session." });
      return;
    }

    setLoading(true);
    setFeedback(null);

    const res = await validerHorsSession(sessionId, decision, motif);
    setLoading(false);

    if (res.success) {
      setFeedback({
        success: true,
        message:
          decision === "APPROUVE"
            ? `Session ${sessionId} approuvée et ouverte (OPEN) avec succès !`
            : `Session ${sessionId} rejetée et fermée (CLOSED).`,
      });
      if (decision === "REJETE") setMotif("");
    } else {
      setFeedback({
        success: false,
        message: res.message || "Erreur lors de la validation administrative.",
      });
    }
  };

  // Gap 3 — Clôture Session Handler
  const handleClotureSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clotureSessionId || !clotureAnimateurId) {
      setClotureFeedback({ success: false, message: "Veuillez renseigner l'ID de session et l'ID animateur." });
      return;
    }

    setClotureLoading(true);
    setClotureFeedback(null);

    const res = await cloturerSession(clotureSessionId, clotureAnimateurId);
    setClotureLoading(false);

    if (res.success) {
      setClotureFeedback({
        success: true,
        message: `Session ${clotureSessionId} clôturée avec succès. Rapport PDF généré dans Google Drive (CaliSync_Audios/Rapports).`,
      });
    } else {
      setClotureFeedback({
        success: false,
        message: res.message || "Erreur lors de la clôture de la session.",
      });
    }
  };

  const apiUrl = import.meta.env.VITE_API_URL || "";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ── Header Banner ────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -z-10" />

        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Administration & Modération
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Console Administrateur
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Validez des sessions, clôturez les calibrations et générez les rapports PDF.
          </p>
        </div>
      </div>

      {/* ── Validation Hors-Session Card ─────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-2 text-white font-bold text-base border-b border-slate-800 pb-4">
          <FileCheck className="w-5 h-5 text-amber-400" /> Arbitrage Administrateur — Sessions Hors-Session
        </div>

        <form onSubmit={handleValidation} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              ID Session à Traiter <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="ex: SESS_HORS_005"
              className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Décision Administrateur
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setDecision("APPROUVE")}
                className={`py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                  decision === "APPROUVE"
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10"
                    : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <CheckCircle2 className="w-5 h-5" /> Approuver (Passer en OPEN)
              </button>

              <button
                type="button"
                onClick={() => setDecision("REJETE")}
                className={`py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                  decision === "REJETE"
                    ? "bg-rose-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/10"
                    : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <XCircle className="w-5 h-5" /> Rejeter (Passer en CLOSED)
              </button>
            </div>
          </div>

          {decision === "REJETE" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Motif du Rejet (Facultatif)
              </label>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={3}
                placeholder="Renseignez la raison du refus..."
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          )}

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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all transform active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 text-base cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" /> Enregistrer la décision
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Clôture & Rapport PDF Card (Gap 3) ──────────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-2 text-white font-bold text-base border-b border-slate-800 pb-4">
          <FileLock2 className="w-5 h-5 text-indigo-400" /> Clôturer une Session & Générer le Rapport PDF
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-200 space-y-1">
            <p className="font-bold text-indigo-300">Cette action est irréversible.</p>
            <p className="text-indigo-300/80">
              Le rapport PDF sera généré automatiquement (points alignés, divergences, arbitrages)
              et sauvegardé dans Google Drive sous <code className="text-indigo-200 bg-indigo-500/20 px-1 rounded">CaliSync_Audios/Rapports</code>.
              Le statut de la session passera en <strong>CLOSED</strong>.
            </p>
          </div>
        </div>

        <form onSubmit={handleClotureSession} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                ID Session <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={clotureSessionId}
                onChange={(e) => setClotureSessionId(e.target.value)}
                placeholder="ex: SESS_2026_001"
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                ID Animateur <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={clotureAnimateurId}
                  onChange={(e) => setClotureAnimateurId(e.target.value)}
                  placeholder="ex: ANIM_01"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          {clotureFeedback && (
            <div
              className={`p-4 rounded-xl flex items-start gap-3 border ${
                clotureFeedback.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {clotureFeedback.success ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              )}
              <span className="text-sm font-medium">{clotureFeedback.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={clotureLoading}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 text-base cursor-pointer"
          >
            {clotureLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <FileLock2 className="w-5 h-5" /> Clôturer la session & Générer le PDF
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Backend GAS Status Card ──────────────────────────────────────────── */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Server className="w-4 h-4 text-indigo-400" /> Configuration du Backend Google Apps Script
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            VITE_API_URL
          </span>
        </div>

        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 truncate">
          {apiUrl || "Non configuré (Définissez VITE_API_URL dans le fichier .env)"}
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-400">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            Les requêtes sont envoyées directement vers Google Apps Script. Pour mettre à jour l'URL, modifiez la variable <code className="text-amber-300">VITE_API_URL</code> dans le fichier <code className="text-amber-300">.env</code>.
          </span>
        </div>
      </div>
    </div>
  );
};
