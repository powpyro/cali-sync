import React, { useEffect, useState } from "react";
import { getProfilEvaluateur, type ProfilEvaluateur } from "../lib/api";
import { User, Award, CheckCircle, Clock, AlertTriangle, ShieldCheck, Flame, RefreshCw } from "lucide-react";

interface RingProps {
  evaluateurId: string;
  setEvaluateurId: (id: string) => void;
}

export const Ring: React.FC<RingProps> = ({ evaluateurId, setEvaluateurId }) => {
  const [targetId, setTargetId] = useState(evaluateurId || "EVAL_01");
  const [profil, setProfil] = useState<ProfilEvaluateur | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfil = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const res = await getProfilEvaluateur(id);
    setLoading(false);

    if (res.success && res.data) {
      setProfil(res.data);
      setEvaluateurId(id);
    } else {
      setError(res.message || "Impossible de charger le profil de l'évaluateur.");
      setProfil(null);
    }
  };

  useEffect(() => {
    fetchProfil(targetId);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Panel */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Award className="w-3.5 h-3.5" /> Anneau de Calibration (Ring)
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Profil Évaluateur & Performance
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Consultez l'historique d'évaluation et le taux de régularité.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchProfil(targetId);
            }}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <div className="relative flex-1 sm:w-48">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="ex: EVAL_01"
                className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Rechercher
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="glass-card border-rose-500/30 p-6 rounded-2xl flex items-center gap-4 text-rose-300">
          <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-400" />
          <div>
            <div className="font-bold text-base">Erreur Profil</div>
            <div className="text-sm text-rose-300/80">{error}</div>
          </div>
        </div>
      )}

      {loading && (
        <div className="glass-card p-12 rounded-2xl flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Calcul des statistiques évaluateur depuis Google Sheets...</p>
        </div>
      )}

      {profil && (
        <>
          {/* Main User Identity Badge Card */}
          <div className="glass-card p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <User className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{profil.identifiant}</h2>
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Évaluateur Qualité Actif
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <div className="text-xs text-slate-400 font-medium">Badges</div>
                <div className="text-sm font-extrabold text-emerald-400 flex items-center gap-1 justify-center mt-0.5">
                  <Flame className="w-4 h-4 text-amber-400" /> Régulier
                </div>
              </div>
            </div>
          </div>

          {/* Stats 4-Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Évaluations Soumises */}
            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Critères Évalués</span>
                <CheckCircle className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-3xl font-extrabold text-white mt-3">
                {profil.nombre_total_evaluations_soumises}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Soumissions enregistrées
              </div>
            </div>

            {/* Sessions Participées */}
            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Sessions Complétées</span>
                <Award className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-3">
                {profil.nombre_sessions_participes}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Statut SOUMIS
              </div>
            </div>

            {/* Sessions Ratées */}
            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Sessions Ratées</span>
                <Clock className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-3xl font-extrabold text-rose-400 mt-3">
                {profil.nombre_sessions_ratees}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Délai dépassé (RATE)
              </div>
            </div>

            {/* Sessions Animées */}
            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Sessions Animées</span>
                <Flame className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-3xl font-extrabold text-purple-400 mt-3">
                {profil.nombre_sessions_animees}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Animateur / Gauge
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
