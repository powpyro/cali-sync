import React, { useEffect, useState } from "react";
import { getSessionData, type SessionDataResponse } from "../lib/api";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  Volume2,
  Award,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CockpitProps {
  sessionId: string;
  setSessionId: (id: string) => void;
}

export const Cockpit: React.FC<CockpitProps> = ({ sessionId, setSessionId }) => {
  const [inputSessionId, setInputSessionId] = useState(sessionId || "SESS_2026_001");
  const [data, setData] = useState<SessionDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const loadData = async (targetId: string) => {
    if (!targetId) return;
    setLoading(true);
    setError(null);

    const res = await getSessionData(targetId);
    setLoading(false);

    if (res.success) {
      setData(res);
      setSessionId(targetId);
      // Auto expand all categories
      if (res.categories) {
        const initialExpand: Record<string, boolean> = {};
        Object.keys(res.categories).forEach((cat) => {
          initialExpand[cat] = true;
        });
        setExpandedCategories(initialExpand);
      }
    } else {
      setError(res.message || "Impossible de charger la session.");
      setData(null);
    }
  };

  useEffect(() => {
    loadData(inputSessionId);
  }, []);

  const toggleCategory = (catName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Search Header Bar */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Activity className="w-3.5 h-3.5" /> Cockpit de Calibration
          </div>
          <h1 className="text-2xl font-extrabold text-white">Analyse des Écarts & Variance</h1>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadData(inputSessionId);
          }}
          className="flex items-center gap-2 w-full md:w-auto"
        >
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={inputSessionId}
              onChange={(e) => setInputSessionId(e.target.value)}
              placeholder="Session ID..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Charger
          </button>
        </form>
      </div>

      {error && (
        <div className="glass-card border-rose-500/30 p-6 rounded-2xl flex items-center gap-4 text-rose-300">
          <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-400" />
          <div>
            <div className="font-bold text-base">Erreur de chargement</div>
            <div className="text-sm text-rose-300/80">{error}</div>
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="glass-card p-12 rounded-2xl flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Chargement des données de calibration depuis Google Sheets...</p>
        </div>
      )}

      {data && (
        <>
          {/* Top KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Variance Moyenne */}
            <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Variance Moyenne Session
              </div>
              <div className="text-3xl font-extrabold text-white mt-2 flex items-baseline gap-2">
                {data.calibration?.moyenne_session_variance ?? 0}%
                <span className="text-xs font-normal text-slate-400">du Gauge</span>
              </div>
              <div className="mt-2 text-xs flex items-center gap-1.5">
                {(data.calibration?.moyenne_session_variance ?? 0) <= 5 ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Conforme (&le; 5%)
                  </span>
                ) : (
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Hors seuil (&gt; 5%)
                  </span>
                )}
              </div>
            </div>

            {/* Évaluateurs Non Calibrés */}
            <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Évaluateurs Hors Seuil
              </div>
              <div className="text-3xl font-extrabold text-white mt-2 flex items-baseline gap-2">
                {data.calibration?.evaluateurs_non_calibres?.length ?? 0}
                <span className="text-xs font-normal text-slate-400">évaluateurs</span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Variance individuelle &gt; seuil max
              </div>
            </div>

            {/* Diagnostic d'Écart Critique (Pass/Fail) */}
            <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Alerte Diagnostic Critique
              </div>
              <div className="mt-2">
                {data.calibration?.ecart_critique_notes?.ecartCritique ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-extrabold">
                    <AlertTriangle className="w-3.5 h-3.5" /> DIVERGENCE CRITIQUE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-extrabold">
                    <CheckCircle className="w-3.5 h-3.5" /> VERDICTS ALIGNÉS
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Divergence sur item critique
              </div>
            </div>

            {/* Statut Session & Type */}
            <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Statut de la Session
              </div>
              <div className="text-lg font-bold text-white mt-2">
                {data.session_type || "ALIGNEMENT"}
              </div>
              <div className="mt-1">
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {data.statut || "OPEN"}
                </span>
              </div>
            </div>
          </div>

          {/* Audio Player Bar if url_audio exists */}
          {data.url_audio && (
            <div className="glass-panel p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-400">Enregistrement Audio de Calibration</div>
                  <div className="text-sm font-semibold text-white truncate max-w-md">{data.url_audio}</div>
                </div>
              </div>
              <a
                href={data.url_audio}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl border border-slate-700 transition-colors"
              >
                Écouter l'Audio
              </a>
            </div>
          )}

          {/* Items Prioritaires (> 5% Divergence) */}
          {data.items_prioritaires && data.items_prioritaires.length > 0 && (
            <div className="glass-card p-6 rounded-2xl border-purple-500/30 space-y-4">
              <div className="flex items-center gap-2 text-purple-400 font-extrabold text-sm uppercase tracking-wider">
                <Zap className="w-4 h-4" /> Critères à Forte Divergence (Priorité Cockpit &gt; 5%)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.items_prioritaires.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs text-purple-400 font-medium">{item.categorie}</div>
                      <div className="text-sm font-bold text-white mt-0.5">{item.item_nom}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Gauge : <span className="font-semibold text-slate-200">{item.note_gauge}</span> ({item.nombre_votes} votes)
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        {item.taux_divergence}% div.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories & Items Breakdown */}
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" /> Détail par Catégorie & Critère
            </h2>

            {data.categories &&
              Object.entries(data.categories).map(([catName, catData]) => {
                const isExpanded = expandedCategories[catName] !== false;
                const prioriteCat = catData?.prioriteAffichage || "aucun";

                // Filter out non-item properties
                const itemKeys = Object.keys(catData).filter(
                  (k) => k !== "prioriteAffichage" && typeof catData[k] === "object"
                );

                return (
                  <div key={catName} className="glass-panel rounded-2xl overflow-hidden border-slate-800">
                    {/* Category Header Bar */}
                    <button
                      onClick={() => toggleCategory(catName)}
                      className="w-full p-5 flex items-center justify-between bg-slate-900/60 hover:bg-slate-900/90 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-base text-white">{catName}</span>
                        {prioriteCat === "critique" && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            PRIORITÉ CRITIQUE
                          </span>
                        )}
                        {prioriteCat === "standard" && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Écarts Standard
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <span>{itemKeys.length} critères</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {/* Category Items List */}
                    {isExpanded && (
                      <div className="p-5 space-y-4 divide-y divide-slate-800/60">
                        {itemKeys.map((itemName) => {
                          const itemObj = catData[itemName] as any;
                          if (!itemObj) return null;

                          const isRed = itemObj.statut_calibrage === "rouge";

                          return (
                            <div key={itemName} className="pt-4 first:pt-0 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                      isRed ? "bg-rose-500 shadow-md shadow-rose-500/50" : "bg-emerald-500 shadow-md shadow-emerald-500/50"
                                    }`}
                                  />
                                  <span className="font-bold text-sm text-slate-100">{itemName}</span>

                                  {itemObj.criticite === "Critical" && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-950 text-rose-400 border border-rose-800">
                                      CRITICAL
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-slate-400">
                                    Gauge : <strong className="text-indigo-300 font-semibold">{itemObj.note_gauge}</strong>
                                  </span>

                                  <span
                                    className={`px-2.5 py-0.5 rounded-full font-bold border ${
                                      isRed
                                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    }`}
                                  >
                                    {isRed ? `${itemObj.taux_divergence}% d'écart` : "Aligné"}
                                  </span>
                                </div>
                              </div>

                              {/* Evaluators Votes */}
                              {itemObj.votes && itemObj.votes.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                                  {itemObj.votes.map((vote: any, vIdx: number) => (
                                    <div
                                      key={vIdx}
                                      className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                                    >
                                      <div className="truncate">
                                        <span className="font-semibold text-slate-300 block truncate">{vote.nom}</span>
                                        {vote.commentaire && (
                                          <span className="text-[11px] text-slate-500 truncate block italic">
                                            "{vote.commentaire}"
                                          </span>
                                        )}
                                      </div>

                                      <span
                                        className={`px-2 py-0.5 rounded font-black text-[11px] ${
                                          vote.note === "Oui" || vote.note === "C"
                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                            : vote.note === "Non" || vote.note === "NC"
                                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                            : "bg-slate-700/50 text-slate-300"
                                        }`}
                                      >
                                        {vote.note}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 italic pl-5">Aucun vote enregistré pour l'instant.</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
};
