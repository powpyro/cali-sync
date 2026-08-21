import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CheckCircle2,
  Settings,
  BarChart3,
  Award,
  Table2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Lock,
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
      <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-amber-200 shadow-sm">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <p className="text-slate-600 text-sm font-semibold">
          Aucune évaluation soumise — le rapport de variances n'est pas encore disponible.
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

      <div className="space-y-6 font-sans">
        {/* ── HEADER CARD UNIFIÉ & COMPACT ────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Soumissions Closes • Arbitrage Disponible
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {nomSession || "Session de Calibrage"}
            </h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[#1dc4ff]" />
              Analyse des variances évaluateurs vs référence Gauge
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Configurer les seuils de variance et les couleurs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Seuils & Couleurs</span>
            </button>

            {onOpenCockpit && (
              <button
                onClick={onOpenCockpit}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md shadow-[#1dc4ff]/20"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Cockpit Arbitrage →</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 4 CARTES KPI HARMONISÉES ────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Évaluateurs */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Évaluateurs
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#1dc4ff]/10 text-[#009ae5] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {allEvalIds.length}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                soumission(s) reçue(s)
              </div>
            </div>
          </div>

          {/* 2. Variance Moyenne */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Variance Moyenne
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className={`text-2xl sm:text-3xl font-black ${avgCls.text}`}>
                {avgVariance}%
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${avgCls.badge}`}>
                  {avgVariance <= thresholds.greenMax
                    ? "Calibré"
                    : avgVariance <= thresholds.orangeMax
                    ? "À surveiller"
                    : "Forte variance"}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Top Divergent */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Top Divergent
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            {mostDivergent ? (
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight" title={cleanLibelle(mostDivergent.item.libelle)}>
                  {cleanLibelle(mostDivergent.item.libelle)}
                </div>
                <span className="inline-block px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black">
                  {mostDivergent.rate}% d'écart
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-400 font-medium">Aucun écart</div>
            )}
          </div>

          {/* 4. Top Consensus */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Top Consensus
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            {leastDivergent ? (
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight" title={cleanLibelle(leastDivergent.item.libelle)}>
                  {cleanLibelle(leastDivergent.item.libelle)}
                </div>
                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black">
                  {100 - leastDivergent.rate}% d'accord
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-400 font-medium">Aucun consensus</div>
            )}
          </div>
        </div>

        {/* ── BARRE DE LÉGENDE & SEUILS ÉPURÉE ─────────────────────────────── */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-600 flex-wrap gap-2 shadow-2xs">
          <div className="flex items-center gap-4 flex-wrap font-medium">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Légende :</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span>Calibré (≤ {thresholds.greenMax}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
              <span>À surveiller ({thresholds.greenMax + 1}–{thresholds.orangeMax}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0" />
              <span>Forte variance (&gt; {thresholds.orangeMax}%)</span>
            </div>
          </div>

          <button
            onClick={() => setShowConfig(true)}
            className="text-[11px] font-bold text-[#0077aa] hover:underline cursor-pointer flex items-center gap-1 ml-auto"
          >
            <Settings className="w-3 h-3" />
            Modifier les seuils
          </button>
        </div>

        {/* ── TABLEAU 1 : VARIANCES PAR ÉVALUATEUR ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1dc4ff]" />
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Variances par Évaluateur
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 font-semibold">
              {evalStats.length} évaluateur(s) classé(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                  <th className="px-5 py-3">Évaluateur</th>
                  <th className="px-4 py-3 text-center">Items Évalués</th>
                  <th className="px-4 py-3 text-center">Accords</th>
                  <th className="px-4 py-3 text-center">Écarts</th>
                  <th className="px-4 py-3 text-left">Taux de Variance</th>
                  <th className="px-4 py-3 text-center">Niveau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evalStats.map((stat) => {
                  const cls = getVarianceColorClasses(stat.tauxVariance, thresholds);
                  return (
                    <tr key={stat.evalId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          stat.tauxVariance <= thresholds.greenMax ? "bg-emerald-500" :
                          stat.tauxVariance <= thresholds.orangeMax ? "bg-amber-500" : "bg-rose-500"
                        }`} />
                        <span>{stat.evalId}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-700">
                        {stat.totalItems}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-600">
                        {stat.accords}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-rose-600">
                        {stat.ecarts}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 max-w-[200px]">
                          <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${cls.bar}`}
                              style={{ width: `${Math.min(stat.tauxVariance, 100)}%` }}
                            />
                          </div>
                          <span className={`font-mono font-extrabold text-xs w-10 text-right ${cls.text}`}>
                            {stat.tauxVariance}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${cls.badge}`}>
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

                {/* Moyenne Groupe */}
                <tr className="bg-slate-50/90 font-black border-t-2 border-slate-200">
                  <td className="px-5 py-3.5 text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                    <span>Moyenne Groupe</span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-400 font-mono">—</td>
                  <td className="px-4 py-3.5 text-center text-emerald-600 font-mono">
                    {Math.round(evalStats.reduce((a, b) => a + b.accords, 0) / evalStats.length)}
                  </td>
                  <td className="px-4 py-3.5 text-center text-rose-600 font-mono">
                    {Math.round(evalStats.reduce((a, b) => a + b.ecarts, 0) / evalStats.length)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3 max-w-[200px]">
                      <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${avgCls.bar}`}
                          style={{ width: `${Math.min(avgVariance, 100)}%` }}
                        />
                      </div>
                      <span className={`font-mono font-black text-xs w-10 text-right ${avgCls.text}`}>
                        {avgVariance}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-200 border border-slate-300 text-slate-700">
                      Moyenne
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── TABLEAU 2 : TABLEAU CROISÉ ITEMS × ÉVALUATEURS (ÉPURÉ) ───────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap bg-white">
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-[#1dc4ff]" />
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Tableau des Écarts par Item
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Category filter */}
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:outline-none focus:border-[#1dc4ff] cursor-pointer shadow-2xs"
              >
                <option value="__ALL__">Toutes catégories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <button
                onClick={() => setShowCrossTable((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                {showCrossTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showCrossTable ? "Réduire" : "Afficher"}
              </button>
            </div>
          </div>

          {showCrossTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                    <th className="px-5 py-3 text-left sticky left-0 bg-slate-50 z-10 min-w-[280px] border-r border-slate-200">
                      Item
                    </th>
                    <th className="px-4 py-3 text-center min-w-[90px] border-r border-slate-100">
                      🎯 Gauge
                    </th>
                    {allEvalIds.map((evalId) => (
                      <th key={evalId} className="px-4 py-3 text-center min-w-[100px] border-r border-slate-100">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="truncate max-w-[90px] font-bold text-slate-800">{evalId.split(".")[0]}</span>
                          {evalStats.find((e) => e.evalId === evalId) && (() => {
                            const stat = evalStats.find((e) => e.evalId === evalId)!;
                            const cls = getVarianceColorClasses(stat.tauxVariance, thresholds);
                            return (
                              <span className={`px-1.5 py-0.5 rounded border font-mono font-black text-[9px] ${cls.badge}`}>
                                {stat.tauxVariance}%
                              </span>
                            );
                          })()}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center font-black text-rose-600 min-w-[80px]">
                      Écarts
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => {
                    const ecartTotal = Object.values(item.votesByCritere).filter(
                      (v) => item.gaugeCritere && v !== item.gaugeCritere
                    ).length;
                    const totalVoters = Object.keys(item.votesByCritere).length;
                    const isN2 = item.niveau === 2;

                    return (
                      <tr
                        key={item.item_id || idx}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isN2 ? "bg-white font-semibold" : "bg-slate-50/40 text-slate-600"
                        } ${ecartTotal > 0 ? "bg-rose-50/30" : ""}`}
                      >
                        {/* Item column (Clean white/transparent background with subtle right border) */}
                        <td className="px-5 py-2.5 sticky left-0 bg-white z-10 border-r border-slate-200">
                          <div className="flex items-center gap-2">
                            {!isN2 && (
                              <span className="text-slate-400 font-mono text-[11px] pl-3">└─</span>
                            )}
                            <span className={`text-slate-900 leading-snug line-clamp-2 ${isN2 ? "font-bold text-xs" : "font-normal text-[11px]"}`}>
                              {cleanLibelle(item.libelle)}
                            </span>
                          </div>
                        </td>

                        {/* Gauge Reference Column */}
                        <td className="px-4 py-2.5 text-center border-r border-slate-100">
                          {item.gaugeCritere ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black border ${
                              item.gaugeCritere === "Oui"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : item.gaugeCritere === "Non"
                                ? "bg-rose-50 border-rose-200 text-rose-800"
                                : "bg-slate-100 border-slate-200 text-slate-700"
                            }`}>
                              {item.gaugeCritere}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs font-mono">—</span>
                          )}
                        </td>

                        {/* Evaluator Votes Columns */}
                        {allEvalIds.map((evalId) => {
                          const vote = item.votesByCritere[evalId];
                          if (!vote) {
                            return (
                              <td key={evalId} className="px-4 py-2.5 text-center border-r border-slate-100">
                                <span className="text-slate-300 text-xs font-mono">—</span>
                              </td>
                            );
                          }
                          const isAccord = item.gaugeCritere
                            ? vote === item.gaugeCritere
                            : null;

                          return (
                            <td key={evalId} className="px-4 py-2.5 text-center border-r border-slate-100">
                              <div className="inline-flex items-center gap-1">
                                {isAccord === true && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px]">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    {vote}
                                  </span>
                                )}
                                {isAccord === false && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 font-black text-[10px] shadow-2xs">
                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                    {vote}
                                  </span>
                                )}
                                {isAccord === null && (
                                  <span className="text-slate-600 font-medium text-[11px]">{vote}</span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Total Ecarts for this Item */}
                        <td className="px-4 py-2.5 text-center">
                          {ecartTotal > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 border border-rose-300 text-rose-800 shadow-2xs">
                              {ecartTotal}/{totalVoters}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
