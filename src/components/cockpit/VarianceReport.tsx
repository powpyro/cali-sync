import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Settings,
  BarChart3,
  Target,
  Award,
  Table2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { type CockpitNode } from "../../lib/api";
import {
  loadVarianceThresholds,
  getVarianceColorClasses,
  type VarianceThresholds,
} from "../../hooks/useVarianceConfig";
import { VarianceConfigPanel } from "./VarianceConfigPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FlatItem {
  item_id: string;
  libelle: string;
  niveau: number;
  categorie: string;
  gaugeCritere: string | null;
  votesByCritere: Record<string, string>; // evalId → critere
}

interface EvalStats {
  evalId: string;
  totalItems: number;
  accords: number;
  ecarts: number;
  tauxVariance: number; // 0-100
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cleanLibelle(s: string): string {
  return s.replace(/^\[.*?\]\s*/, "").replace(/^[-\d.]+\s*/, "").trim();
}

function flattenNodes(nodes: CockpitNode[], categorie = ""): FlatItem[] {
  const result: FlatItem[] = [];
  for (const n of nodes) {
    const cat = n.categorie_racine_fr || categorie;
    if (n.niveau !== 1) {
      // Collect all votes into a flat map evalId → critere
      const votesByCritere: Record<string, string> = {};
      const allVotes = [
        ...(n.votes_par_critere?.Oui || []),
        ...(n.votes_par_critere?.Non || []),
        ...(n.votes_par_critere?.["N.A."] || []),
      ];
      for (const v of allVotes) {
        if (v.nom) votesByCritere[v.nom] = v.critere;
      }
      result.push({
        item_id: n.item_id,
        libelle: n.libelle,
        niveau: n.niveau,
        categorie: cat,
        gaugeCritere: n.gauge?.critere ?? null,
        votesByCritere,
      });
    }
    if (n.children && n.children.length > 0) {
      result.push(...flattenNodes(n.children, cat));
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface VarianceReportProps {
  grille: CockpitNode[];
  nomSession?: string;
  onOpenCockpit?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function VarianceReport({ grille, nomSession, onOpenCockpit }: VarianceReportProps) {
  const [thresholds, setThresholds] = useState<VarianceThresholds>(() => loadVarianceThresholds());
  const [showConfig, setShowConfig] = useState(false);
  const [showCrossTable, setShowCrossTable] = useState(true);
  const [catFilter, setCatFilter] = useState<string>("__ALL__");

  // ── 1. Flatten all non-N1 nodes ─────────────────────────────────────────
  const flatItems = useMemo(() => flattenNodes(grille), [grille]);

  // ── 2. Collect all unique evaluator IDs ─────────────────────────────────
  const allEvalIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of flatItems) {
      Object.keys(item.votesByCritere).forEach((id) => set.add(id));
    }
    return Array.from(set).sort();
  }, [flatItems]);

  // ── 3. Compute per-evaluator stats ───────────────────────────────────────
  const evalStats: EvalStats[] = useMemo(() => {
    return allEvalIds.map((evalId) => {
      let total = 0;
      let accords = 0;
      let ecarts = 0;
      for (const item of flatItems) {
        if (item.gaugeCritere === null) continue; // skip items without gauge
        const vote = item.votesByCritere[evalId];
        if (vote === undefined) continue; // eval didn't vote on this item
        total++;
        if (vote === item.gaugeCritere) accords++;
        else ecarts++;
      }
      const tauxVariance = total > 0 ? Math.round((ecarts / total) * 100) : 0;
      return { evalId, totalItems: total, accords, ecarts, tauxVariance };
    });
  }, [allEvalIds, flatItems]);

  // ── 4. Average variance ────────────────────────────────────────────────
  const avgVariance = useMemo(() => {
    if (evalStats.length === 0) return 0;
    const sum = evalStats.reduce((acc, e) => acc + e.tauxVariance, 0);
    return Math.round(sum / evalStats.length);
  }, [evalStats]);

  // ── 5. Most/least divergent items ─────────────────────────────────────
  const itemDivergenceRates = useMemo(() => {
    return flatItems
      .filter((item) => item.gaugeCritere !== null)
      .map((item) => {
        const voterCount = Object.keys(item.votesByCritere).length;
        if (voterCount === 0) return { item, rate: 0 };
        const ecartCount = Object.values(item.votesByCritere).filter(
          (v) => v !== item.gaugeCritere
        ).length;
        return { item, rate: Math.round((ecartCount / voterCount) * 100) };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [flatItems]);

  const mostDivergent = itemDivergenceRates[0] ?? null;
  const leastDivergent = itemDivergenceRates[itemDivergenceRates.length - 1] ?? null;

  // ── 6. Categories for filter ───────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = new Set(flatItems.map((i) => i.categorie).filter(Boolean));
    return Array.from(cats);
  }, [flatItems]);

  // ── 7. Filtered items for cross table ─────────────────────────────────
  const filteredItems = useMemo(() => {
    if (catFilter === "__ALL__") return flatItems;
    return flatItems.filter((i) => i.categorie === catFilter);
  }, [flatItems, catFilter]);

  const avgCls = getVarianceColorClasses(avgVariance, thresholds);

  if (allEvalIds.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-12 text-center space-y-4 border border-amber-500/20">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <p className="text-slate-300 text-sm font-medium">
          Aucune évaluation soumise — le rapport de variances n'est pas disponible.
        </p>
      </div>
    );
  }

  return (
    <>
      {showConfig && (
        <VarianceConfigPanel
          thresholds={thresholds}
          onSave={(t) => { setThresholds(t); setShowConfig(false); }}
          onClose={() => setShowConfig(false)}
        />
      )}

      <div className="space-y-6">
        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div className="glass-card rounded-3xl overflow-hidden border border-amber-500/30 shadow-2xl">
          <div className="h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
          <div className="p-6 flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Rapport de Variances — Post Soumissions
                </span>
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">
                {nomSession || "Session de Calibrage"}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Analyse des écarts évaluateurs vs référence Gauge
              </p>
            </div>
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              Config Couleurs
            </button>
          </div>
        </div>

        {/* ── KPI GLOBAUX ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Participants */}
          <div className="glass-card rounded-2xl p-4 border border-slate-700/50 space-y-1 text-center">
            <Users className="w-5 h-5 text-indigo-400 mx-auto" />
            <div className="text-2xl font-black text-white">{allEvalIds.length}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Évaluateurs</div>
          </div>

          {/* Variance moyenne */}
          <div className={`glass-card rounded-2xl p-4 border space-y-1 text-center ${avgCls.badge}`}>
            <TrendingUp className={`w-5 h-5 mx-auto ${avgCls.text}`} />
            <div className={`text-2xl font-black ${avgCls.text}`}>{avgVariance}%</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Variance Moy.</div>
          </div>

          {/* Most divergent */}
          {mostDivergent && (
            <div className="glass-card rounded-2xl p-4 border border-rose-500/20 space-y-1 text-center">
              <TrendingDown className="w-5 h-5 text-rose-400 mx-auto" />
              <div className="text-sm font-black text-white leading-tight line-clamp-2">
                {cleanLibelle(mostDivergent.item.libelle).substring(0, 30)}…
              </div>
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                +Divergent ({mostDivergent.rate}%)
              </div>
            </div>
          )}

          {/* Least divergent */}
          {leastDivergent && leastDivergent.rate < (mostDivergent?.rate ?? 101) && (
            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20 space-y-1 text-center">
              <Award className="w-5 h-5 text-emerald-400 mx-auto" />
              <div className="text-sm font-black text-white leading-tight line-clamp-2">
                {cleanLibelle(leastDivergent.item.libelle).substring(0, 30)}…
              </div>
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                +Consensuel ({leastDivergent.rate}%)
              </div>
            </div>
          )}
        </div>

        {/* ── LÉGENDE COULEURS ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Légende :</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            Calibré (≤ {thresholds.greenMax}%)
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            À surveiller ({thresholds.greenMax + 1}–{thresholds.orangeMax}%)
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            Forte variance (&gt; {thresholds.orangeMax}%)
          </span>
          <button
            onClick={() => setShowConfig(true)}
            className="ml-auto text-[10px] text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
          >
            Modifier les seuils
          </button>
        </div>

        {/* ── TABLEAU VARIANCES PAR ÉVALUATEUR ─────────────────────────── */}
        <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Variances par Évaluateur
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="px-5 py-3 text-left font-black text-slate-400 uppercase tracking-wider">Évaluateur</th>
                  <th className="px-4 py-3 text-center font-black text-slate-400 uppercase tracking-wider">Items évalués</th>
                  <th className="px-4 py-3 text-center font-black text-emerald-400 uppercase tracking-wider">Accords</th>
                  <th className="px-4 py-3 text-center font-black text-rose-400 uppercase tracking-wider">Écarts</th>
                  <th className="px-6 py-3 text-center font-black text-slate-400 uppercase tracking-wider">Taux de Variance</th>
                  <th className="px-4 py-3 text-center font-black text-slate-400 uppercase tracking-wider">Niveau</th>
                </tr>
              </thead>
              <tbody>
                {evalStats.map((stat, idx) => {
                  const cls = getVarianceColorClasses(stat.tauxVariance, thresholds);
                  const barWidth = Math.max(2, stat.tauxVariance);
                  return (
                    <tr
                      key={stat.evalId}
                      className={`border-b border-slate-800/60 transition-colors hover:bg-slate-800/30 ${idx % 2 === 0 ? "bg-slate-900/20" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                          <span className="font-bold text-white">{stat.evalId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-300">{stat.totalItems}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-black text-emerald-400">{stat.accords}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="font-black text-rose-400">{stat.ecarts}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${cls.bar}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className={`font-black text-sm w-12 text-right ${cls.text}`}>
                            {stat.tauxVariance}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black ${cls.badge}`}>
                          {stat.tauxVariance <= thresholds.greenMax
                            ? "Calibré"
                            : stat.tauxVariance <= thresholds.orangeMax
                            ? "À surveiller"
                            : "Forte variance"}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Ligne moyenne */}
                <tr className="border-t-2 border-slate-700 bg-slate-900/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${avgCls.dot}`} />
                      <span className="font-black text-white">Moyenne Groupe</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center font-bold text-slate-300">—</td>
                  <td className="px-4 py-3.5 text-center font-black text-emerald-400">
                    {evalStats.length > 0 ? Math.round(evalStats.reduce((a, e) => a + e.accords, 0) / evalStats.length) : 0}
                  </td>
                  <td className="px-4 py-3.5 text-center font-black text-rose-400">
                    {evalStats.length > 0 ? Math.round(evalStats.reduce((a, e) => a + e.ecarts, 0) / evalStats.length) : 0}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${avgCls.bar}`}
                          style={{ width: `${Math.max(2, avgVariance)}%` }}
                        />
                      </div>
                      <span className={`font-black text-sm w-12 text-right ${avgCls.text}`}>
                        {avgVariance}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black ${avgCls.badge}`}>
                      Groupe
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── TABLEAU CROISÉ ITEMS × ÉVALUATEURS ───────────────────────── */}
        <div className="glass-card rounded-3xl border border-slate-700/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Tableau des Écarts par Item
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category filter */}
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="text-xs font-bold bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="__ALL__">Toutes catégories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                onClick={() => setShowCrossTable((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                {showCrossTable
                  ? <ChevronUp className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />}
                {showCrossTable ? "Réduire" : "Afficher"}
              </button>
            </div>
          </div>

          {showCrossTable && (
            <div className="overflow-x-auto">
              <table className="text-[11px] min-w-max w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="px-4 py-3 text-left font-black text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-900 z-10 min-w-[220px]">
                      Item
                    </th>
                    <th className="px-3 py-3 text-center font-black text-indigo-300 uppercase tracking-wider min-w-[80px]">
                      🎯 Gauge
                    </th>
                    {allEvalIds.map((evalId) => (
                      <th key={evalId} className="px-3 py-3 text-center font-bold text-slate-400 min-w-[80px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="truncate max-w-[70px]">{evalId.split(".")[0]}</span>
                          {evalStats.find((e) => e.evalId === evalId) && (() => {
                            const stat = evalStats.find((e) => e.evalId === evalId)!;
                            const cls = getVarianceColorClasses(stat.tauxVariance, thresholds);
                            return (
                              <span className={`px-1.5 py-0.5 rounded-md border font-black text-[9px] ${cls.badge}`}>
                                {stat.tauxVariance}%
                              </span>
                            );
                          })()}
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center font-black text-rose-400 uppercase tracking-wider min-w-[70px]">
                      Écarts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const ecartTotal = Object.values(item.votesByCritere).filter(
                      (v) => item.gaugeCritere && v !== item.gaugeCritere
                    ).length;
                    const totalVoters = Object.keys(item.votesByCritere).length;
                    const ecartRate = totalVoters > 0
                      ? Math.round((ecartTotal / totalVoters) * 100)
                      : 0;
                    const rowCls = ecartRate > thresholds.orangeMax
                      ? "bg-rose-500/5"
                      : ecartRate > thresholds.greenMax
                      ? "bg-amber-500/5"
                      : "";

                    return (
                      <tr
                        key={item.item_id}
                        className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${rowCls} ${idx % 2 === 0 ? "bg-slate-900/10" : ""}`}
                      >
                        {/* Item name */}
                        <td className="px-4 py-2.5 sticky left-0 bg-inherit z-10">
                          <div className="flex items-center gap-1.5">
                            {item.niveau > 2 && (
                              <span className="text-slate-600 text-[10px]">└</span>
                            )}
                            <span className="font-medium text-slate-200 line-clamp-2 max-w-[200px]">
                              {cleanLibelle(item.libelle)}
                            </span>
                          </div>
                        </td>

                        {/* Gauge reference */}
                        <td className="px-3 py-2.5 text-center">
                          {item.gaugeCritere ? (
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                              item.gaugeCritere === "Oui"
                                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                                : item.gaugeCritere === "Non"
                                ? "bg-rose-500/20 border-rose-500/30 text-rose-300"
                                : "bg-slate-500/20 border-slate-500/30 text-slate-300"
                            }`}>
                              {item.gaugeCritere}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[10px]">—</span>
                          )}
                        </td>

                        {/* One cell per evaluator */}
                        {allEvalIds.map((evalId) => {
                          const vote = item.votesByCritere[evalId];
                          if (!vote) {
                            return (
                              <td key={evalId} className="px-3 py-2.5 text-center">
                                <MinusCircle className="w-4 h-4 text-slate-700 mx-auto" />
                              </td>
                            );
                          }
                          const isAccord = item.gaugeCritere
                            ? vote === item.gaugeCritere
                            : null;
                          return (
                            <td key={evalId} className="px-3 py-2.5 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                {isAccord === true && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                )}
                                {isAccord === false && (
                                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                                )}
                                {isAccord === null && (
                                  <span className="text-slate-400 text-[10px] font-bold">{vote}</span>
                                )}
                                <span className={`text-[9px] font-bold ${
                                  isAccord === true ? "text-emerald-400" :
                                  isAccord === false ? "text-rose-400" :
                                  "text-slate-400"
                                }`}>
                                  {vote}
                                </span>
                              </div>
                            </td>
                          );
                        })}

                        {/* Ecart count for this item */}
                        <td className="px-3 py-2.5 text-center">
                          {ecartTotal > 0 ? (
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                              ecartRate > thresholds.orangeMax
                                ? "bg-rose-500/20 border-rose-500/30 text-rose-300"
                                : ecartRate > thresholds.greenMax
                                ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
                                : "bg-slate-700 border-slate-600 text-slate-300"
                            }`}>
                              {ecartTotal}/{totalVoters}
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[10px] font-black">✓ 0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend for icons */}
          <div className="px-6 py-3 border-t border-slate-800 flex flex-wrap items-center gap-4 text-[10px] text-slate-500 font-bold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Accord avec Gauge
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-rose-400" /> Écart vs Gauge
            </span>
            <span className="flex items-center gap-1.5">
              <MinusCircle className="w-3 h-3 text-slate-600" /> Non évalué
            </span>
          </div>
        </div>

        {/* ── BOUTON COCKPIT ARBITRAGE ──────────────────────────────────── */}
        {onOpenCockpit && (
          <div className="flex justify-center pt-2">
            <button
              onClick={onOpenCockpit}
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm transition-all shadow-xl shadow-indigo-600/25 cursor-pointer"
            >
              <Target className="w-4 h-4" />
              Accéder au Cockpit d'Arbitrage
            </button>
          </div>
        )}
      </div>
    </>
  );
}
