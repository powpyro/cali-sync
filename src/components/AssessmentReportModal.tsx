import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Printer,
  Copy,
  Check,
  Edit3,
  Calendar,
  User,
  Tag,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  FileText,
  Sparkles,
  Headphones,
  UserCheck,
} from "lucide-react";
import { CaliSyncLogo } from "./ui/CaliSyncLogo";
import { getConfigTemplate, type AssessmentLibreInfo } from "../lib/api";

interface AssessmentReportModalProps {
  assessment: AssessmentLibreInfo;
  onClose: () => void;
  onEdit?: (assessment: AssessmentLibreInfo) => void;
}

interface TreeN4 {
  item: any;
}

interface TreeN3 {
  item: any;
  children: TreeN4[];
}

interface TreeN2 {
  item: any;
  children: TreeN3[];
}

interface TreeCategory {
  label: string;
  questions: TreeN2[];
}

function buildTreeFromItems(items: any[]): TreeCategory[] {
  const n2 = items.filter((it) => it.niveau === 2 || it.niveau === "2");
  const n3 = items.filter((it) => it.niveau === 3 || it.niveau === "3");
  const n4 = items.filter((it) => it.niveau === 4 || it.niveau === "4");

  const catMap = new Map<string, TreeN2[]>();

  n2.forEach((q) => {
    const catRacine = (q.categorie_racine_fr || q.categorie || "Critères Généraux").trim();
    if (!catMap.has(catRacine)) {
      catMap.set(catRacine, []);
    }
    catMap.get(catRacine)!.push({
      item: q,
      children: n3
        .filter((s) => s.parent_id === q.item_id)
        .map((s) => ({
          item: s,
          children: n4.filter((ss) => ss.parent_id === s.item_id).map((ss) => ({ item: ss })),
        })),
    });
  });

  return Array.from(catMap.entries()).map(([label, questions]) => ({
    label,
    questions,
  }));
}

interface ImputedLeaf {
  item: any;
  parentItem?: any;
  rep?: string;
  comm?: string;
  level: number;
}

function getImputedLeaves(
  q: TreeN2,
  reponsesMap: Record<string, string>,
  commentairesMap: Record<string, string>
): ImputedLeaf[] {
  const leaves: ImputedLeaf[] = [];

  q.children.forEach((n3) => {
    const hasN4 = n3.children && n3.children.length > 0;
    if (hasN4) {
      let hasImputedN4 = false;
      n3.children.forEach((n4) => {
        const rep4 = reponsesMap[n4.item.item_id];
        const comm4 = commentairesMap[n4.item.item_id];
        if (rep4 || comm4) {
          hasImputedN4 = true;
          leaves.push({
            item: n4.item,
            parentItem: n3.item,
            rep: rep4,
            comm: comm4,
            level: 4,
          });
        }
      });

      if (!hasImputedN4) {
        const rep3 = reponsesMap[n3.item.item_id];
        const comm3 = commentairesMap[n3.item.item_id];
        if (rep3 || comm3) {
          leaves.push({
            item: n3.item,
            rep: rep3,
            comm: comm3,
            level: 3,
          });
        }
      }
    } else {
      const rep3 = reponsesMap[n3.item.item_id];
      const comm3 = commentairesMap[n3.item.item_id];
      if (rep3 || comm3) {
        leaves.push({
          item: n3.item,
          rep: rep3,
          comm: comm3,
          level: 3,
        });
      }
    }
  });

  return leaves;
}

export const AssessmentReportModal: React.FC<AssessmentReportModalProps> = ({
  assessment,
  onClose,
  onEdit,
}) => {
  const [templateItems, setTemplateItems] = useState<any[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchTemplate = async () => {
      setLoadingTemplate(true);
      try {
        const res = await getConfigTemplate(assessment.template_id);
        if (isMounted && res.success && Array.isArray(res.items)) {
          setTemplateItems(res.items);
        }
      } catch (e) {
        console.error("Erreur chargement template rapport:", e);
      } finally {
        if (isMounted) setLoadingTemplate(false);
      }
    };
    fetchTemplate();
    return () => {
      isMounted = false;
    };
  }, [assessment.template_id]);

  const tree = useMemo(() => buildTreeFromItems(templateItems), [templateItems]);

  const reponsesMap = useMemo<Record<string, string>>(() => {
    if (!assessment.reponses) return {};
    if (typeof assessment.reponses === "string") {
      try {
        return JSON.parse(assessment.reponses);
      } catch {
        return {};
      }
    }
    return assessment.reponses;
  }, [assessment.reponses]);

  const commentairesMap = useMemo<Record<string, string>>(() => {
    if (!assessment.commentaires) return {};
    if (typeof assessment.commentaires === "string") {
      try {
        return JSON.parse(assessment.commentaires);
      } catch {
        return {};
      }
    }
    return assessment.commentaires;
  }, [assessment.commentaires]);

  // Statistics calculation
  const stats = useMemo(() => {
    let conformes = 0;
    let nonConformes = 0;
    let na = 0;
    let critiquesNonConformes = 0;

    tree.forEach((cat) => {
      cat.questions.forEach((q) => {
        const rep = reponsesMap[q.item.item_id];
        if (rep === "Oui") conformes++;
        else if (rep === "Non") {
          nonConformes++;
          if (q.item.criticite === "Critical") critiquesNonConformes++;
        } else if (rep === "N.A.") {
          na++;
        }
      });
    });

    const totalEvalues = conformes + nonConformes + na;
    return {
      conformes,
      nonConformes,
      na,
      critiquesNonConformes,
      totalEvalues,
    };
  }, [tree, reponsesMap]);

  const handleCopyText = () => {
    let reportText = `📋 RAPPORT DE DÉBRIEFING QUALITÉ — CALISYNC\n`;
    reportText += `Titre : ${assessment.titre}\n`;
    reportText += `Évaluateur : ${assessment.evaluateur_id}\n`;
    if (assessment.correcteur_nom) reportText += `Correcteur / Auditeur : ${assessment.correcteur_nom}\n`;
    if (assessment.nom_conseiller) reportText += `ID Appel / Conseiller : ${assessment.nom_conseiller}\n`;
    reportText += `Grille : ${assessment.template_nom || assessment.template_id}\n`;
    reportText += `Date : ${new Date(assessment.date_creation).toLocaleString("fr-FR")}\n\n`;

    reportText += `📊 BILAN : Conformes: ${stats.conformes} | Non-Conformes: ${stats.nonConformes} | N.A.: ${stats.na}\n`;
    if (stats.critiquesNonConformes > 0) {
      reportText += `⚠️ Alertes Critiques : ${stats.critiquesNonConformes}\n`;
    }
    reportText += `\n`;

    if (assessment.interaction_summary) {
      reportText += `📝 RÉSUMÉ D'INTERACTION :\n${assessment.interaction_summary}\n\n`;
    }
    if (assessment.evaluator_comments) {
      reportText += `💡 SYNTHÈSE & AXES DE PROGRÈS :\n${assessment.evaluator_comments}\n\n`;
    }

    reportText += `🔍 DÉTAIL DES CRITÈRES :\n`;
    tree.forEach((cat) => {
      reportText += `\n[ ${cat.label} ]\n`;
      cat.questions.forEach((q) => {
        const rep = reponsesMap[q.item.item_id] || "Non évalué";
        const comm = commentairesMap[q.item.item_id];
        reportText += `• ${q.item.libelle_fr || q.item.libelle} : ${rep.toUpperCase()}\n`;
        if (comm) reportText += `  └─ Commentaire : "${comm}"\n`;
      });
    });

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-fade-in font-sans print:static print:p-0 print:bg-white print:overflow-visible print:block print:w-full">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden my-auto print:max-h-none print:m-0 print:border-none print:shadow-none print:rounded-none print:w-full print:block print:overflow-visible">
        {/* ── TOOLBAR (Hidden in Print) ── */}
        <header className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3 flex-shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1dc4ff]/20 text-[#1dc4ff] flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Rapport de Correction & Débriefing</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1dc4ff]/20 text-[#1dc4ff] font-bold">
                  PDF Ready
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Document de synthèse prêt pour le coaching et l'archivage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(assessment);
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Corriger l'évaluation"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#1dc4ff]" />
                <span className="hidden sm:inline">Corriger</span>
              </button>
            )}

            <button
              onClick={handleCopyText}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Copier le texte du compte-rendu"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 hidden sm:inline">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copier le texte</span>
                </>
              )}
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 rounded-xl text-xs font-black shadow-md shadow-[#1dc4ff]/20 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Imprimer ou enregistrer en PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── PRINTABLE REPORT BODY ── */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 bg-white print:p-0 print:space-y-4 print:overflow-visible print:h-auto">
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CaliSyncLogo size="md" showText={true} showBadge={false} />
                <span className="h-5 w-px bg-slate-300 mx-1 hidden sm:inline" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  {assessment.is_corrected ? "Grille d'Évaluation Corrigée" : "Rapport Qualité & Coaching"}
                </span>
                {assessment.is_corrected && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Version Corrigée
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight pt-1">
                {assessment.titre}
              </h1>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-500 space-y-0.5">
              <div>
                Réf : <strong className="font-mono text-slate-800">{assessment.assessment_id}</strong>
              </div>
              <div>
                Date création :{" "}
                <strong className="text-slate-800">
                  {new Date(assessment.date_creation).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </div>
              {assessment.date_modification && (
                <div className="text-emerald-700 font-bold">
                  Dernière correction :{" "}
                  {new Date(assessment.date_modification).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <User className="w-3 h-3" /> Évaluateur
              </div>
              <div className="text-xs font-extrabold text-slate-900 truncate mt-0.5">
                {assessment.evaluateur_id}
              </div>
            </div>

            {assessment.correcteur_nom ? (
              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Correcteur / Auditeur
                </div>
                <div className="text-xs font-extrabold text-emerald-950 truncate mt-0.5">
                  {assessment.correcteur_nom}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Grille
                </div>
                <div className="text-xs font-extrabold text-slate-900 truncate mt-0.5">
                  {assessment.template_nom || assessment.template_id}
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Headphones className="w-3 h-3" /> ID Appel / Conseiller
              </div>
              <div className="text-xs font-mono font-bold text-slate-900 truncate mt-0.5">
                {assessment.nom_conseiller || "Non renseigné"}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Statut
              </div>
              <div className="text-xs font-extrabold text-emerald-700 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {assessment.is_corrected ? "Grille Corrigée" : "Évaluation Validée"}
              </div>
            </div>
          </div>

          {/* Key Metrics / Visual Scoreboard */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-around gap-4 shadow-sm print:bg-slate-100 print:text-slate-900 print:border print:border-slate-300">
            <div className="text-center">
              <div className="text-2xl font-black">{stats.totalEvalues}</div>
              <div className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600">Critères Évalués</div>
            </div>
            <div className="h-8 w-px bg-slate-800 print:bg-slate-300 hidden sm:block" />
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400 print:text-emerald-700 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-5 h-5" /> {stats.conformes}
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600">Conformes</div>
            </div>
            <div className="h-8 w-px bg-slate-800 print:bg-slate-300 hidden sm:block" />
            <div className="text-center">
              <div className="text-2xl font-black text-rose-400 print:text-rose-700 flex items-center justify-center gap-1">
                <XCircle className="w-5 h-5" /> {stats.nonConformes}
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600">Non Conformes</div>
            </div>
            <div className="h-8 w-px bg-slate-800 print:bg-slate-300 hidden sm:block" />
            <div className="text-center">
              <div className="text-2xl font-black text-slate-300 print:text-slate-700 flex items-center justify-center gap-1">
                <MinusCircle className="w-5 h-5" /> {stats.na}
              </div>
              <div className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600">Non Applicables</div>
            </div>
            {stats.critiquesNonConformes > 0 && (
              <>
                <div className="h-8 w-px bg-slate-800 print:bg-slate-300 hidden sm:block" />
                <div className="text-center">
                  <div className="text-2xl font-black text-amber-400 print:text-rose-600 flex items-center justify-center gap-1 animate-pulse">
                    <AlertTriangle className="w-5 h-5" /> {stats.critiquesNonConformes}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-600">Alerte Critique</div>
                </div>
              </>
            )}
          </div>

          {/* Interaction Summary & Evaluator Feedback */}
          {(assessment.interaction_summary || assessment.evaluator_comments) && (
            <div className="space-y-3">
              {assessment.interaction_summary && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1">
                    <FileText className="w-3.5 h-3.5 text-[#009ae5]" /> Résumé de l'Interaction
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed italic whitespace-pre-wrap">
                    &ldquo;{assessment.interaction_summary}&rdquo;
                  </p>
                </div>
              )}

              {assessment.evaluator_comments && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200">
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Synthèse &amp; Recommandations de Débriefing
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                    {assessment.evaluator_comments}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Detailed Criteria Table by Category */}
          <div className="space-y-5 pt-2">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 border-b-2 border-slate-900 pb-2.5 flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#009ae5]" />
              <span className="text-slate-900">Grille Complète des Critères &amp; Remarques</span>
            </h2>

            {loadingTemplate ? (
              <div className="p-6 text-center text-xs text-slate-400">Chargement de la grille...</div>
            ) : tree.length > 0 ? (
              <div className="space-y-6">
                {tree.map((cat) => {
                  const conformesCat = cat.questions.filter((q) => reponsesMap[q.item.item_id] === "Oui").length;
                  const nonConformesCat = cat.questions.filter((q) => reponsesMap[q.item.item_id] === "Non").length;
                  const nasCat = cat.questions.filter((q) => reponsesMap[q.item.item_id] === "N.A.").length;

                  return (
                    <div key={cat.label} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm print:break-inside-avoid">
                      {/* Category Header */}
                      <div className="bg-slate-900 px-4 py-3 flex items-center justify-between print:bg-slate-100 print:border-b print:border-slate-300">
                        <span className="text-xs font-black uppercase tracking-widest text-white print:text-slate-900">
                          {cat.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {conformesCat > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 print:bg-emerald-100 print:text-emerald-800 border border-emerald-500/30 print:border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> {conformesCat}
                            </span>
                          )}
                          {nonConformesCat > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 print:bg-rose-100 print:text-rose-800 border border-rose-500/30 print:border-rose-300 flex items-center gap-1">
                              <X className="w-3 h-3" /> {nonConformesCat}
                            </span>
                          )}
                          {nasCat > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/30 text-slate-300 print:bg-slate-100 print:text-slate-600 border border-slate-600 print:border-slate-300">
                              N.A. {nasCat}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 print:text-slate-500 font-medium">
                            {cat.questions.length} critère(s)
                          </span>
                        </div>
                      </div>

                      {/* Questions */}
                      <div className="divide-y divide-slate-100">
                        {cat.questions.map((q) => {
                          const rep = reponsesMap[q.item.item_id];
                          const comm = commentairesMap[q.item.item_id];
                          const isCritical = q.item.criticite === "Critical";
                          const isNon = rep === "Non";
                          const isOui = rep === "Oui";
                          const isNA = rep === "N.A.";

                          // Collect only the deepest imputed leaves (sub-items with answer or comment)
                          const imputedLeaves = getImputedLeaves(q, reponsesMap, commentairesMap);

                          return (
                            <div
                              key={q.item.item_id}
                              className={`p-3.5 sm:p-4 space-y-2.5 print:break-inside-avoid ${
                                isNon ? "bg-rose-50/30" : isOui ? "bg-emerald-50/20" : ""
                              }`}
                            >
                              {/* ── Question Row ── */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900 leading-snug">
                                      {q.item.libelle_fr || q.item.libelle}
                                    </span>
                                    {isCritical && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5 flex-shrink-0">
                                        <AlertTriangle className="w-2.5 h-2.5" /> Critique
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                    Réf : {q.item.item_id}
                                  </div>
                                </div>

                                <div className="flex-shrink-0">
                                  {isOui && (
                                    <span className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5" /> Conforme
                                    </span>
                                  )}
                                  {isNon && (
                                    <span className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                                      <X className="w-3.5 h-3.5" /> Non Conforme
                                    </span>
                                  )}
                                  {isNA && (
                                    <span className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                                      <MinusCircle className="w-3.5 h-3.5" /> N.A.
                                    </span>
                                  )}
                                  {!rep && (
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-200">
                                      Non évalué
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* ── Evaluator Comment on N2 ── */}
                              {comm && (
                                <div className="flex items-start gap-2 bg-blue-50/60 border border-blue-200 rounded-xl px-3 py-2 print:bg-slate-50 print:border-slate-200">
                                  <FileText className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5 print:text-slate-500" />
                                  <div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-blue-600 print:text-slate-500 mb-0.5">
                                      Justification / Commentaire évaluateur
                                    </div>
                                    <p className="text-[11px] text-slate-800 font-medium leading-relaxed italic">
                                      &ldquo;{comm}&rdquo;
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* ── Deepest Imputed Sub-Items / Motifs (Only if imputed) ── */}
                              {imputedLeaves.length > 0 && (
                                <div className="ml-3 sm:ml-5 space-y-1.5 border-l-2 border-rose-300 pl-3">
                                  <div className="text-[9px] font-black uppercase tracking-widest text-rose-600 print:text-slate-500 mb-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Motif(s) / Point(s) de non-conformité imputé(s)
                                  </div>
                                  {imputedLeaves.map((leaf) => {
                                    const isLeafNon = leaf.rep === "Non";

                                    return (
                                      <div
                                        key={leaf.item.item_id}
                                        className={`rounded-lg border px-3 py-2 text-xs print:break-inside-avoid ${
                                          isLeafNon
                                            ? "bg-rose-50 border-rose-200"
                                            : "bg-slate-50 border-slate-200"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="space-y-0.5">
                                            {leaf.parentItem && (
                                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                {leaf.parentItem.libelle_fr || leaf.parentItem.libelle}
                                              </div>
                                            )}
                                            <span className="font-semibold text-slate-800 leading-snug">
                                              &bull; {leaf.item.libelle_fr || leaf.item.libelle}
                                            </span>
                                          </div>
                                          {leaf.rep && (
                                            <span
                                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded flex-shrink-0 border ${
                                                isLeafNon
                                                  ? "bg-rose-100 text-rose-700 border-rose-300"
                                                  : "bg-slate-100 text-slate-600 border-slate-300"
                                              }`}
                                            >
                                              {leaf.rep}
                                            </span>
                                          )}
                                        </div>
                                        {leaf.comm && (
                                          <p className="text-[10px] text-slate-600 italic mt-1 leading-relaxed">
                                            &ldquo;{leaf.comm}&rdquo;
                                          </p>
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
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600">
                Grille simplifiée enregistrée.
              </div>
            )}
          </div>

          {/* Footer Signatures Area (Print friendly) */}
          <div className="border-t border-slate-200 pt-6 mt-6 grid grid-cols-2 gap-8 text-xs text-slate-500">
            <div>
              <div className="font-bold text-slate-800 mb-8">
                {assessment.correcteur_nom
                  ? `Signature du Correcteur / Auditeur (${assessment.correcteur_nom}) :`
                  : "Signature de l'Évaluateur :"}
              </div>
              <div className="border-b border-dashed border-slate-300 w-48" />
            </div>
            <div>
              <div className="font-bold text-slate-800 mb-8">Visa / Débriefing du Conseiller :</div>
              <div className="border-b border-dashed border-slate-300 w-48" />
            </div>
          </div>
        </div>

        {/* ── FOOTER (Hidden in Print) ── */}
        <footer className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-shrink-0 print:hidden">
          <div className="text-xs text-slate-500 font-medium">
            Document généré automatiquement via <strong className="text-slate-800">CaliSync v2.0</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black text-xs rounded-xl shadow-md shadow-[#1dc4ff]/20 transition-all cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

