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
  AlertTriangle,
  FileText,
  Sparkles,
  User,
  UserCheck,
  ShieldCheck,
  MessageSquare,
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
    if (!catMap.has(cat)) {
      catMap.set(cat, []);
    }

    const n3Children: TreeN3[] = (n2.children || []).map((n3) => ({
      node: n3,
      children: (n3.children || []).map((n4) => ({ node: n4 })),
    }));

    catMap.get(cat)!.push({
      node: n2,
      children: n3Children,
    });
  });

  return Array.from(catMap.entries()).map(([label, questions]) => ({
    label,
    questions,
  }));
}

export const ArbitrageReportModal: React.FC<ArbitrageReportModalProps> = ({
  sessionData,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const tree = useMemo(() => {
    return buildReportTree(sessionData.grille_hierarchique || []);
  }, [sessionData.grille_hierarchique]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalQuestions = 0;
    let conformes = 0;
    let nonConformes = 0;
    let na = 0;
    let sansDecision = 0;
    let alertesCritiques = 0;

    tree.forEach((cat) => {
      cat.questions.forEach((q) => {
        totalQuestions++;
        const decision = q.node.decision_finale?.decision || q.node.gauge?.critere;
        if (decision === "Oui") {
          conformes++;
        } else if (decision === "Non") {
          nonConformes++;
          if (q.node.criticite === "Critical") {
            alertesCritiques++;
          }
        } else if (decision === "N.A." || decision === "N/A") {
          na++;
        } else {
          sansDecision++;
        }
      });
    });

    return {
      totalQuestions,
      conformes,
      nonConformes,
      na,
      sansDecision,
      alertesCritiques,
    };
  }, [tree]);

  const handleCopyText = () => {
    let reportText = `📋 RAPPORT D'ARBITRAGE DU CALIBRAGE — CALISYNC\n`;
    reportText += `Session : ${sessionData.nom_session || sessionData.session_id}\n`;
    if (sessionData.nom_conseiller) reportText += `ID Appel / Conseiller : ${sessionData.nom_conseiller}\n`;
    if (sessionData.template_id) reportText += `Template de Grille : ${sessionData.template_id}\n`;
    if (sessionData.animateur_id) reportText += `Animateur / Arbitre : ${sessionData.animateur_id}\n`;
    reportText += `Date : ${sessionData.heure_ouverture ? new Date(sessionData.heure_ouverture).toLocaleString("fr-FR") : new Date().toLocaleDateString("fr-FR")}\n\n`;

    reportText += `📊 BILAN D'ARBITRAGE : ${stats.conformes} Conformes (Oui) | ${stats.nonConformes} Non Conformes (Non) | ${stats.na} N/A\n`;
    if (stats.alertesCritiques > 0) {
      reportText += `⚠️ Alertes Critiques Non Conformes : ${stats.alertesCritiques}\n`;
    }
    reportText += `\n`;

    if (sessionData.gauge_interaction_summary) {
      reportText += `📝 RÉSUMÉ D'INTERACTION :\n${sessionData.gauge_interaction_summary}\n\n`;
    }
    if (sessionData.gauge_evaluator_comments) {
      reportText += `💡 SYNTHÈSE & COMMENTAIRES :\n${sessionData.gauge_evaluator_comments}\n\n`;
    }

    reportText += `🔍 DÉTAIL DES CRITÈRES ARBITRÉS :\n`;
    tree.forEach((cat) => {
      reportText += `\n[ ${cat.label.toUpperCase()} ]\n`;
      cat.questions.forEach((q, idx) => {
        const dec = q.node.decision_finale?.decision || q.node.gauge?.critere || "Non arbitré";
        const justif = q.node.decision_finale?.justification || q.node.gauge?.commentaire;
        reportText += `${idx + 1}. ${q.node.libelle} : [ ${dec.toUpperCase()} ]${q.node.criticite === "Critical" ? " (CRITIQUE)" : ""}\n`;
        if (justif) {
          reportText += `   └─ Consigne / Justification : "${justif}"\n`;
        }

        // Sub-items imputed
        q.children.forEach((n3) => {
          const n3Dec = n3.node.decision_finale?.decision || n3.node.gauge?.critere;
          const n3Justif = n3.node.decision_finale?.justification || n3.node.gauge?.commentaire;
          if (n3Dec === "Non" || n3Justif) {
            reportText += `      • Imputation : ${n3.node.libelle}${n3Justif ? ` ("${n3Justif}")` : ""}\n`;
          }
        });
      });
    });

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedDate = sessionData.heure_ouverture
    ? new Date(sessionData.heure_ouverture).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden my-auto print:max-h-none print:m-0 print:border-none print:shadow-none print:rounded-none">
        
        {/* ── TOOLBAR (Hidden in Print) ── */}
        <header className="p-4 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between gap-3 flex-shrink-0 print:hidden border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1dc4ff]/20 text-[#1dc4ff] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Rapport d'Arbitrage — Grille Officielle</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#1dc4ff]/20 text-[#1dc4ff] font-extrabold">
                  PDF A4 Ready
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Synthèse officielle des décisions et consignes d'arbitrage validées
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Copier le texte complet pour partage"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span className="hidden sm:inline">{copied ? "Copié !" : "Copier Texte"}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-[#1dc4ff]/20"
              title="Imprimer ou enregistrer au format PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / Télécharger en PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── PRINTABLE A4 REPORT SHEET ── */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-50/50 print:p-6 print:bg-white print:overflow-visible">
          <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0">
            
            {/* 1. DOCUMENT HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CaliSyncLogo size="sm" showText={true} />
                </div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight pt-1">
                  RAPPORT D'ARBITRAGE DU CALIBRAGE
                </h1>
                <p className="text-xs text-slate-500 font-semibold">
                  Grille d'évaluation & décisions finales validées
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-right space-y-0.5 flex-shrink-0">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Session ID
                </div>
                <div className="font-mono text-xs font-black text-slate-800">
                  {sessionData.session_id}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {formattedDate}
                </div>
              </div>
            </div>

            {/* 2. METADATA INFO CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50/80 border border-slate-200/70 p-3 rounded-xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3 text-[#1dc4ff]" /> Session
                </div>
                <div className="text-xs font-bold text-slate-800 truncate mt-0.5" title={sessionData.nom_session}>
                  {sessionData.nom_session || "Calibrage Qualité"}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/70 p-3 rounded-xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-[#1dc4ff]" /> Conseiller / Réf
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 truncate mt-0.5" title={sessionData.nom_conseiller}>
                  {sessionData.nom_conseiller || "Non renseigné"}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/70 p-3 rounded-xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3 text-[#1dc4ff]" /> Animateur
                </div>
                <div className="text-xs font-bold text-slate-800 truncate mt-0.5" title={sessionData.animateur_id}>
                  {sessionData.animateur_id || "Animateur"}
                </div>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/70 p-3 rounded-xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3 text-[#1dc4ff]" /> Grille
                </div>
                <div className="text-xs font-bold text-slate-800 truncate mt-0.5" title={sessionData.template_id}>
                  {sessionData.template_id || "Grille Standard"}
                </div>
              </div>
            </div>

            {/* 3. SYNTHESIS KPI BANNER */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap print:bg-slate-900 print:text-white">
              <div className="space-y-0.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[#1dc4ff]">
                  Bilan d'Arbitrage
                </div>
                <div className="text-sm sm:text-base font-extrabold">
                  {stats.totalQuestions} Questions Évaluées
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-6 flex-wrap font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-emerald-400">{stats.conformes}</div>
                    <div className="text-[10px] text-slate-400">Conformes</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-rose-400">{stats.nonConformes}</div>
                    <div className="text-[10px] text-slate-400">Non-Conformes</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-slate-300">{stats.na}</div>
                    <div className="text-[10px] text-slate-400">N/A</div>
                  </div>
                </div>

                {stats.alertesCritiques > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/20 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>{stats.alertesCritiques} Alerte(s) Critique(s)</span>
                  </div>
                )}
              </div>
            </div>

            {/* 4. OPTIONAL CONTEXT & SUMMARY (IF ANY) */}
            {(sessionData.gauge_interaction_summary || sessionData.gauge_evaluator_comments) && (
              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                {sessionData.gauge_interaction_summary && (
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1">
                      <FileText className="w-3.5 h-3.5 text-[#1dc4ff]" /> Résumé d'Interaction
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line pl-5 font-normal">
                      {sessionData.gauge_interaction_summary}
                    </p>
                  </div>
                )}
                {sessionData.gauge_evaluator_comments && (
                  <div className="pt-2 border-t border-slate-200">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1">
                      <MessageSquare className="w-3.5 h-3.5 text-[#1dc4ff]" /> Synthèse d'Évaluation & Axes de Progrès
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line pl-5 font-normal">
                      {sessionData.gauge_evaluator_comments}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 5. DETAILED EVALUATION GRID WITH ARBITRATION DECISIONS & COMMENTS */}
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1dc4ff]" />
                  Détail de la Grille & Décisions d'Arbitrage
                </h2>
                <span className="text-[11px] font-bold text-slate-500">
                  {tree.length} section(s)
                </span>
              </div>

              {tree.map((cat, catIdx) => (
                <div key={catIdx} className="space-y-3 print:break-inside-avoid">
                  {/* Category Header */}
                  <div className="px-3.5 py-2 bg-slate-100/90 border border-slate-200/80 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      {cat.label}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {cat.questions.length} question(s)
                    </span>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-3 pl-1 sm:pl-2">
                    {cat.questions.map((q, qIdx) => {
                      const decision = q.node.decision_finale?.decision || q.node.gauge?.critere || "Non arbitré";
                      const justification = q.node.decision_finale?.justification || q.node.gauge?.commentaire;
                      const animateur = q.node.decision_finale?.animateur_id;

                      const isOui = decision === "Oui";
                      const isNon = decision === "Non";
                      const isNa = decision === "N.A." || decision === "N/A";
                      const isCritical = q.node.criticite === "Critical";

                      return (
                        <div
                          key={q.node.item_id || qIdx}
                          className={`rounded-xl border p-3.5 space-y-2.5 transition-all print:break-inside-avoid ${
                            isNon
                              ? "bg-rose-50/40 border-rose-200/80"
                              : isOui
                              ? "bg-white border-slate-200/80"
                              : "bg-slate-50/50 border-slate-200/60"
                          }`}
                        >
                          {/* Question Title & Final Decision Badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-extrabold text-slate-400">
                                  Q{qIdx + 1}.
                                </span>
                                <span className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                                  {q.node.libelle}
                                </span>
                                {isCritical && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider">
                                    Critique
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Decision Badge */}
                            <div className="flex-shrink-0">
                              {isOui && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-black">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Conforme (Oui)
                                </span>
                              )}
                              {isNon && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100/90 border border-rose-300 text-rose-800 text-xs font-black">
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  Non Conforme (Non)
                                </span>
                              )}
                              {isNa && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold">
                                  <MinusCircle className="w-3.5 h-3.5 text-slate-400" />
                                  N/A
                                </span>
                              )}
                              {!isOui && !isNon && !isNa && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold">
                                  En attente
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Justification / Consigne d'arbitrage */}
                          {justification && (
                            <div className="bg-white border border-slate-200/90 rounded-lg p-2.5 text-xs text-slate-700 space-y-1 shadow-2xs">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                <span className="flex items-center gap-1 text-[#0077aa]">
                                  <MessageSquare className="w-3 h-3 text-[#1dc4ff]" />
                                  Consigne & Décision d'Arbitrage :
                                </span>
                                {animateur && <span className="font-normal text-slate-500">Par {animateur}</span>}
                              </div>
                              <p className="text-slate-800 font-medium leading-relaxed italic pl-1">
                                "{justification}"
                              </p>
                            </div>
                          )}

                          {/* Sub-items (N3/N4) Imputations if any */}
                          {q.children.length > 0 && (
                            <div className="space-y-1.5 pl-4 border-l-2 border-slate-200 pt-1">
                              {q.children.map((n3, n3Idx) => {
                                const n3Dec = n3.node.decision_finale?.decision || n3.node.gauge?.critere;
                                const n3Justif = n3.node.decision_finale?.justification || n3.node.gauge?.commentaire;
                                const isImputed = n3Dec === "Non";

                                return (
                                  <div
                                    key={n3.node.item_id || n3Idx}
                                    className={`text-xs p-2 rounded-lg flex items-start justify-between gap-2 ${
                                      isImputed
                                        ? "bg-rose-100/50 border border-rose-200 text-rose-900 font-bold"
                                        : "bg-slate-50 text-slate-600 font-normal"
                                    }`}
                                  >
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${isImputed ? "bg-rose-500" : "bg-slate-300"}`} />
                                        <span>{n3.node.libelle}</span>
                                      </div>
                                      {n3Justif && (
                                        <p className="text-[11px] text-slate-600 font-normal italic pl-3">
                                          Remarque : "{n3Justif}"
                                        </p>
                                      )}
                                    </div>
                                    {isImputed && (
                                      <span className="text-[10px] text-rose-700 bg-rose-200/80 px-1.5 py-0.5 rounded font-black flex-shrink-0">
                                        Imputé
                                      </span>
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
                </div>
              ))}
            </div>

            {/* 6. DOCUMENT FOOTER / OFFICIAL SIGN-OFF */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
              <div className="flex items-center gap-2 font-medium">
                <CaliSyncLogo size="sm" showText={false} />
                <span>Document d'arbitrage généré par <strong>CaliSync</strong></span>
              </div>
              <div className="font-mono text-[11px]">
                Validation officielle du calibrage • {new Date().toLocaleDateString("fr-FR")}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
