import React, { useState, useMemo } from "react";
import {
  X,
  Printer,
  Copy,
  Check,
  Tag,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FileText,
  User,
  UserCheck,
  ShieldCheck,
  MessageSquare,
  Pin,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { CaliSyncLogo } from "./ui/CaliSyncLogo";
import type { CockpitNode, SessionDataResponse } from "../lib/api";

interface ArbitrageReportModalProps {
  sessionData: SessionDataResponse;
  onClose: () => void;
}

interface TreeN4 {
  node: CockpitNode;
}

interface TreeN3 {
  node: CockpitNode;
  children: TreeN4[];
}

interface TreeN2 {
  node: CockpitNode;
  children: TreeN3[];
}

interface TreeCategory {
  label: string;
  questions: TreeN2[];
}

function buildReportTree(nodes: CockpitNode[]): TreeCategory[] {
  if (!nodes || !Array.isArray(nodes)) return [];
  const catMap = new Map<string, TreeN2[]>();
  nodes.forEach((n2) => {
    const cat = (n2.categorie_racine_fr || "Critères Généraux").trim();
    if (!catMap.has(cat)) catMap.set(cat, []);
    const n3Children: TreeN3[] = (n2.children || []).map((n3) => ({
      node: n3,
      children: (n3.children || []).map((n4) => ({ node: n4 })),
    }));
    catMap.get(cat)!.push({ node: n2, children: n3Children });
  });
  return Array.from(catMap.entries()).map(([label, questions]) => ({ label, questions }));
}

function getDecisionStatus(q: TreeN2): "Non" | "Oui" | "NA" | "pending" {
  const decision = q.node.decision_finale?.decision || q.node.gauge?.critere;
  if (decision === "Oui") return "Oui";
  if (decision === "Non") return "Non";
  if (decision === "N.A." || decision === "N/A") return "NA";
  return "pending";
}

const STATUS_ORDER: Record<string, number> = { Non: 0, Oui: 1, NA: 2, pending: 3 };

export const ArbitrageReportModal: React.FC<ArbitrageReportModalProps> = ({
  sessionData,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const tree = useMemo(() => buildReportTree(sessionData.grille_hierarchique || []), [sessionData.grille_hierarchique]);

  const stats = useMemo(() => {
    let totalQuestions = 0, conformes = 0, nonConformes = 0, na = 0, sansDecision = 0, alertesCritiques = 0;
    const critiquesNonConformes: string[] = [];
    tree.forEach((cat) => {
      cat.questions.forEach((q) => {
        totalQuestions++;
        const decision = q.node.decision_finale?.decision || q.node.gauge?.critere;
        if (decision === "Oui") { conformes++; }
        else if (decision === "Non") {
          nonConformes++;
          if (q.node.criticite === "Critical") { alertesCritiques++; critiquesNonConformes.push(q.node.libelle); }
        } else if (decision === "N.A." || decision === "N/A") { na++; }
        else { sansDecision++; }
      });
    });
    const arbitres = conformes + nonConformes + na;
    const tauxConformite = arbitres > 0 ? Math.round((conformes / arbitres) * 100) : null;
    let verdict = { label: "EN ATTENTE", color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-300" };
    if (tauxConformite !== null) {
      if (alertesCritiques > 0 || tauxConformite < 50) verdict = { label: "ATTENTION REQUISE", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-300" };
      else if (tauxConformite < 80) verdict = { label: "PARTIEL", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300" };
      else verdict = { label: "CONFORME", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300" };
    }
    return { totalQuestions, conformes, nonConformes, na, sansDecision, alertesCritiques, critiquesNonConformes, arbitres, tauxConformite, verdict };
  }, [tree]);

  const handleCopyText = () => {
    let t = `RAPPORT D'ARBITRAGE — CALISYNC\n`;
    t += `Session : ${sessionData.nom_session || sessionData.session_id}\n`;
    if (sessionData.nom_conseiller) t += `Conseiller : ${sessionData.nom_conseiller}\n`;
    if (sessionData.animateur_id) t += `Calibreur : ${sessionData.animateur_id}\n\n`;
    t += `VERDICT : ${stats.verdict.label}\n`;
    t += `${stats.conformes} Conformes | ${stats.nonConformes} Imputés | ${stats.na} N.A. | ${stats.sansDecision} en attente\n\n`;
    tree.forEach((cat) => {
      const sorted = [...cat.questions].sort((a, b) => STATUS_ORDER[getDecisionStatus(a)] - STATUS_ORDER[getDecisionStatus(b)]);
      t += `▶ ${cat.label.toUpperCase()}\n`;
      sorted.filter((q) => getDecisionStatus(q) !== "pending").forEach((q, idx) => {
        const dec = q.node.decision_finale?.decision || q.node.gauge?.critere || "";
        const justif = q.node.decision_finale?.justification || q.node.gauge?.commentaire;
        const crit = q.node.criticite === "Critical" ? " ★ CRITIQUE" : "";
        t += `  ${idx + 1}. ${q.node.libelle}${crit} → ${dec.toUpperCase()}\n`;
        if (justif) t += `     📌 Directive : "${justif}"\n`;
        q.children.forEach((n3) => {
          const n3Dec = n3.node.decision_finale?.decision || n3.node.gauge?.critere;
          if (n3Dec === "Non") t += `     • ${n3.node.libelle}\n`;
        });
      });
      const pending = sorted.filter((q) => getDecisionStatus(q) === "pending");
      if (pending.length > 0) t += `  ⏳ En attente (${pending.length}) : ${pending.map((q) => q.node.libelle).join(" · ")}\n`;
      t += `\n`;
    });
    navigator.clipboard.writeText(t);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedDate = (() => {
    const d = sessionData.heure_fin || sessionData.heure_ouverture;
    if (!d) return new Date().toLocaleDateString("fr-FR");
    return new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" } as Intl.DateTimeFormatOptions);
  })();

  const verdictEmoji = stats.verdict.label === "CONFORME" ? "✅" : stats.verdict.label === "PARTIEL" ? "⚠️" : stats.verdict.label === "ATTENTION REQUISE" ? "🔴" : "⏳";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden my-auto print:max-h-none print:m-0 print:border-none print:shadow-none print:rounded-none">

        {/* TOOLBAR */}
        <header className="p-4 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between gap-3 flex-shrink-0 print:hidden border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1dc4ff]/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#1dc4ff]" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight flex items-center gap-2">
                Rapport d'Arbitrage
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1dc4ff]/20 text-[#1dc4ff] font-extrabold">PDF A4</span>
              </h2>
              <p className="text-xs text-slate-400">Décisions et consignes d'arbitrage officielles</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyText} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span className="hidden sm:inline">{copied ? "Copié !" : "Copier"}</span>
            </button>
            <button onClick={() => window.print()} className="px-4 py-2 rounded-xl bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5">
              <Printer className="w-4 h-4" />
              <span>Imprimer / PDF</span>
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* A4 SHEET */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-50/50 print:p-6 print:bg-white print:overflow-visible">
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0">

            {/* HEADER */}
            <div className="text-center border-b border-slate-200 pb-5 space-y-1.5">
              <div className="flex justify-center mb-3 print:mb-2">
                <CaliSyncLogo size="sm" showText={true} />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                Rapport de Calibrage Qualité
              </h1>
              <p className="text-sm font-semibold text-slate-500">{sessionData.nom_session || "Session de Calibrage"}</p>
            </div>

            {/* METADATA TABLE */}
            <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
              <tbody>
                {[
                  { icon: <Tag className="w-3 h-3 text-[#1dc4ff]" />, label: "Session ID", value: sessionData.session_id },
                  { icon: <UserCheck className="w-3 h-3 text-[#1dc4ff]" />, label: "Conseiller évalué", value: sessionData.nom_conseiller || "—" },
                  { icon: <FileText className="w-3 h-3 text-[#1dc4ff]" />, label: "Date de clôture", value: formattedDate },
                  { icon: <User className="w-3 h-3 text-[#1dc4ff]" />, label: "Calibreur / Gauge", value: sessionData.animateur_id || "—" },
                  ...((sessionData.evaluateurs_invites && sessionData.evaluateurs_invites.length > 0)
                    ? [{ icon: <User className="w-3 h-3 text-[#1dc4ff]" />, label: `Évaluateurs (${sessionData.evaluateurs_invites.length})`, value: sessionData.evaluateurs_invites.map((e) => e.nom_complet || e.identifiant).join(" · ") }]
                    : []),
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                    <td className="py-2 px-3 font-bold text-slate-500 w-44">
                      <span className="flex items-center gap-1.5">{row.icon}{row.label}</span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-200" />

            {/* EXECUTIVE SUMMARY */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Résumé Exécutif</h2>

              {/* Verdict banner */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${stats.verdict.bg} ${stats.verdict.border}`}>
                <span className="text-2xl">{verdictEmoji}</span>
                <div className="flex-1">
                  <div className={`text-sm font-black tracking-wide ${stats.verdict.color}`}>{stats.verdict.label}</div>
                  <div className="text-xs text-slate-600 font-medium">
                    {stats.tauxConformite !== null
                      ? `${stats.tauxConformite}% de conformité · ${stats.arbitres} arbitré${stats.arbitres > 1 ? "s" : ""} sur ${stats.totalQuestions}`
                      : "Aucun item arbitré pour l'instant"}
                  </div>
                </div>
                {stats.tauxConformite !== null && (
                  <div className="flex items-center gap-2">
                    <div className="w-28 h-2.5 bg-white/80 border border-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${stats.tauxConformite >= 80 ? "bg-emerald-500" : stats.tauxConformite >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${stats.tauxConformite}%` }} />
                    </div>
                    <span className={`text-sm font-black ${stats.verdict.color}`}>{stats.tauxConformite}%</span>
                  </div>
                )}
              </div>

              {/* Score pills */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{stats.conformes} Conforme{stats.conformes !== 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-black">
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />{stats.nonConformes} Imputé{stats.nonConformes !== 1 ? "s" : ""}
                </span>
                {stats.na > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold">
                    <MinusCircle className="w-3.5 h-3.5 text-slate-400" />{stats.na} N.A.
                  </span>
                )}
                {stats.sansDecision > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />{stats.sansDecision} en attente
                  </span>
                )}
              </div>

              {/* Critical items alert */}
              {stats.alertesCritiques > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-rose-700">
                    <AlertTriangle className="w-4 h-4" />
                    {stats.alertesCritiques} item{stats.alertesCritiques > 1 ? "s" : ""} CRITIQUE{stats.alertesCritiques > 1 ? "S" : ""} non conforme{stats.alertesCritiques > 1 ? "s" : ""} — Attention particulière requise
                  </div>
                  <ul className="space-y-0.5 pl-6">
                    {stats.critiquesNonConformes.map((label, i) => (
                      <li key={i} className="text-[11px] text-rose-700 font-medium list-disc">{label}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Per-category table */}
              {tree.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200 print:break-inside-avoid">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left py-2 px-3 font-black text-slate-600 uppercase tracking-wider">Catégorie</th>
                        <th className="text-center py-2 px-3 font-black text-emerald-700 uppercase tracking-wider">✅ Conformes</th>
                        <th className="text-center py-2 px-3 font-black text-rose-700 uppercase tracking-wider">❌ Imputés</th>
                        <th className="text-center py-2 px-3 font-black text-slate-500 uppercase tracking-wider">Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tree.map((cat, i) => {
                        const cc = cat.questions.filter((q) => getDecisionStatus(q) === "Oui").length;
                        const cn = cat.questions.filter((q) => getDecisionStatus(q) === "Non").length;
                        const ca = cc + cn;
                        const ct = ca > 0 ? Math.round((cc / ca) * 100) : null;
                        return (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                            <td className="py-2 px-3 font-semibold text-slate-700">{cat.label}</td>
                            <td className="py-2 px-3 text-center font-bold text-emerald-700">{cc}</td>
                            <td className={`py-2 px-3 text-center font-bold ${cn > 0 ? "text-rose-700" : "text-slate-400"}`}>{cn}</td>
                            <td className={`py-2 px-3 text-center font-black ${ct === null ? "text-slate-400" : ct >= 80 ? "text-emerald-600" : ct >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                              {ct !== null ? `${ct}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200" />

            {/* OPTIONAL CONTEXT */}
            {(sessionData.gauge_interaction_summary || sessionData.gauge_evaluator_comments) && (
              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                {sessionData.gauge_interaction_summary && (
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1">
                      <FileText className="w-3.5 h-3.5 text-[#1dc4ff]" /> Résumé d'Interaction
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line pl-5">{sessionData.gauge_interaction_summary}</p>
                  </div>
                )}
                {sessionData.gauge_evaluator_comments && (
                  <div className="pt-2 border-t border-slate-200">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1">
                      <MessageSquare className="w-3.5 h-3.5 text-[#1dc4ff]" /> Synthèse & Axes de Progrès
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line pl-5">{sessionData.gauge_evaluator_comments}</p>
                  </div>
                )}
              </div>
            )}

            {/* DETAILED GRID */}
            <div className="space-y-7 pt-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">
                Détail des Arbitrages par Catégorie
              </h2>

              {tree.map((cat, catIdx) => {
                const imputed = cat.questions.filter((q) => getDecisionStatus(q) === "Non");
                const conformes = cat.questions.filter((q) => getDecisionStatus(q) === "Oui");
                const naList = cat.questions.filter((q) => getDecisionStatus(q) === "NA");
                const pending = cat.questions.filter((q) => getDecisionStatus(q) === "pending");

                const cc = conformes.length;
                const cn = imputed.length;
                const ca = cc + cn;
                const ct = ca > 0 ? Math.round((cc / ca) * 100) : null;

                return (
                  <div key={catIdx} className="space-y-4 print:break-inside-avoid">
                    {/* Category header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white rounded-xl shadow-sm">
                      <span className="text-xs font-black uppercase tracking-wider">▶ {cat.label}</span>
                      <span className="text-[11px] font-bold text-slate-300">
                        {ct !== null ? `${cc} / ${ca} conformes — ${ct}%` : `${cat.questions.length} question(s)`}
                      </span>
                    </div>

                    {/* 1. NON-CONFORMITÉS & ARBITRAGES (Carte détaillée) */}
                    {imputed.length > 0 && (
                      <div className="space-y-3 pl-1 sm:pl-2">
                        <div className="text-[11px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5 pt-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Non-Conformités & Directives d'arbitrage ({imputed.length})
                        </div>
                        {imputed.map((q) => {
                          let justification = q.node.decision_finale?.justification || q.node.gauge?.commentaire;
                          if (!justification) {
                            const subJustifs = q.children
                              .map((c) => c.node.decision_finale?.justification || c.node.gauge?.commentaire)
                              .filter(Boolean) as string[];
                            if (subJustifs.length > 0) {
                              justification = Array.from(new Set(subJustifs)).join(" — ");
                            }
                          }
                          const animateur = q.node.decision_finale?.animateur_id;
                          const isCritical = q.node.criticite === "Critical";
                          const originalIdx = cat.questions.indexOf(q);
                          const gaugeCrit = q.node.gauge?.critere;
                          const gaugeNom = q.node.gauge?.nom;
                          const hasDivergence = gaugeCrit && gaugeCrit !== "Non";

                          return (
                            <div
                              key={q.node.item_id || originalIdx}
                              className="rounded-xl border border-rose-300 bg-rose-50/20 shadow-sm overflow-hidden print:break-inside-avoid"
                            >
                              <div className="flex">
                                <div className="w-1.5 bg-rose-500 flex-shrink-0" />
                                <div className="flex-1 p-3.5 space-y-2.5">
                                  {/* Top header row */}
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                      <span className="font-mono text-xs font-black text-rose-600 pt-0.5 flex-shrink-0">
                                        Q{originalIdx + 1}.
                                      </span>
                                      <div className="space-y-1">
                                        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                                          {q.node.libelle}
                                        </p>
                                        {isCritical && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider">
                                            ★ CRITIQUE
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 text-xs font-black whitespace-nowrap shadow-xs">
                                      <XCircle className="w-4 h-4 text-rose-600" />
                                      NON — Imputé
                                    </span>
                                  </div>

                                  {/* Directive post-arbitrage — PROMINENT HIGHLIGHT */}
                                  {justification && (
                                    <div className="p-3 bg-white border border-rose-200 rounded-lg shadow-xs space-y-1">
                                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-700">
                                        <Pin className="w-3.5 h-3.5 text-rose-600" />
                                        Directive post-arbitrage{animateur ? ` (${animateur})` : ""} :
                                      </div>
                                      <p className="text-xs font-bold text-rose-950 leading-relaxed pl-5">
                                        « {justification} »
                                      </p>
                                    </div>
                                  )}

                                  {/* Motifs d'imputation retenus */}
                                  {q.children.some(
                                    (n3) => (n3.node.decision_finale?.decision || n3.node.gauge?.critere) === "Non"
                                  ) && (
                                    <div className="p-2.5 bg-rose-50/70 border border-rose-200/80 rounded-lg space-y-1.5">
                                      <div className="text-[10px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                                        Motifs d'imputation constatés :
                                      </div>
                                      <div className="space-y-1 pl-2">
                                        {q.children.map((n3, n3i) => {
                                          const n3Dec = n3.node.decision_finale?.decision || n3.node.gauge?.critere;
                                          if (n3Dec !== "Non") return null;
                                          const n3Justif =
                                            n3.node.decision_finale?.justification || n3.node.gauge?.commentaire;
                                          return (
                                            <div
                                              key={n3.node.item_id || n3i}
                                              className="text-xs text-slate-800 flex items-start gap-1.5"
                                            >
                                              <span className="text-rose-500 font-black flex-shrink-0">•</span>
                                              <span>
                                                <strong className="font-semibold text-rose-950">{n3.node.libelle}</strong>
                                                {n3Justif && (
                                                  <span className="text-slate-600 italic"> — « {n3Justif} »</span>
                                                )}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Bottom metadata footer */}
                                  {gaugeCrit && (
                                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-600 border-t border-rose-100">
                                      <span>
                                        🎯 Avis Calibreur ({gaugeNom || "Gauge"}) :{" "}
                                        <strong className={gaugeCrit === "Non" ? "text-rose-600" : "text-emerald-600"}>
                                          {gaugeCrit === "Oui" ? "✅ Oui" : gaugeCrit === "Non" ? "❌ Non" : "⚪ N.A."}
                                        </strong>
                                      </span>
                                      {hasDivergence && (
                                        <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                          ⚡ Divergence (Calibreur ≠ Décision finale)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 2. ITEMS CONFORMES (Liste compacte & épurée) */}
                    {conformes.length > 0 && (
                      <div className="space-y-1.5 pl-1 sm:pl-2">
                        <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 pt-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Pratiques Conformes Validées ({conformes.length})
                        </div>
                        <div className="divide-y divide-emerald-100 bg-white border border-emerald-200 rounded-xl overflow-hidden shadow-xs">
                          {conformes.map((q) => {
                            const originalIdx = cat.questions.indexOf(q);
                            const isCritical = q.node.criticite === "Critical";
                            const justif = q.node.decision_finale?.justification;
                            const gaugeCrit = q.node.gauge?.critere;

                            return (
                              <div
                                key={q.node.item_id || originalIdx}
                                className="px-3.5 py-2 flex items-center justify-between gap-3 hover:bg-emerald-50/40 transition-colors"
                              >
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-slate-400">
                                      Q{originalIdx + 1}.
                                    </span>
                                    <span className="text-xs font-semibold text-slate-800">
                                      {q.node.libelle}
                                    </span>
                                    {isCritical && (
                                      <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[9px] font-black uppercase tracking-wider">
                                        ★ Critique
                                      </span>
                                    )}
                                  </div>
                                  {justif && justif !== "Consensus" && (
                                    <p className="text-[11px] text-emerald-800 pl-6 italic">
                                      ↳ Consigne : « {justif} »
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {gaugeCrit && gaugeCrit !== "Oui" && (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                                      Calibreur: {gaugeCrit}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-black">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Conforme
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 3. NON APPLICABLE (Liste compacte) */}
                    {naList.length > 0 && (
                      <div className="pl-1 sm:pl-2">
                        <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-600">
                          <span className="font-medium">
                            ⚪ Non applicables ({naList.length}) :{" "}
                            {naList.map((q) => `Q${cat.questions.indexOf(q) + 1}`).join(", ")}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-slate-400">N.A.</span>
                        </div>
                      </div>
                    )}

                    {/* 4. EN ATTENTE D'ARBITRAGE */}
                    {pending.length > 0 && (
                      <div className="mx-1 px-3.5 py-2 bg-amber-50/60 border border-dashed border-amber-300 rounded-xl">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-800 mb-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          En attente d'arbitrage ({pending.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {pending.map((q) => {
                            const idx = cat.questions.indexOf(q);
                            return (
                              <span
                                key={q.node.item_id || idx}
                                className="inline-flex items-center text-[11px] text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded font-medium"
                              >
                                Q{idx + 1}. {q.node.libelle.length > 50 ? q.node.libelle.slice(0, 48) + "…" : q.node.libelle}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* FOOTER */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
              <div className="flex items-center gap-2">
                <CaliSyncLogo size="sm" showText={false} />
                <span>Rapport généré via <strong className="text-slate-600">CaliSync v2.0</strong></span>
              </div>
              <div className="font-mono text-center">
                Session : {sessionData.session_id} — Taux global : {stats.tauxConformite !== null ? `${stats.tauxConformite}%` : "N/A"}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
