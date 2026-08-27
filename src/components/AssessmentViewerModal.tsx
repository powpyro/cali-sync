import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileText,
  Printer,
  ChevronDown,
  Tag,
  Headphones,
  Calendar,
  User,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Edit3,
  Check,
} from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import { CaliSyncLogo } from "./ui/CaliSyncLogo";
import { getConfigTemplate, type AssessmentLibreInfo } from "../lib/api";

interface AssessmentViewerModalProps {
  assessment: AssessmentLibreInfo;
  onClose: () => void;
  onEdit?: (assessment: AssessmentLibreInfo) => void;
  onOpenReport?: (assessment: AssessmentLibreInfo) => void;
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

export const AssessmentViewerModal: React.FC<AssessmentViewerModalProps> = ({
  assessment,
  onClose,
  onEdit,
  onOpenReport,
}) => {
  const [templateItems, setTemplateItems] = useState<any[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"stepped" | "all">("stepped");

  useEffect(() => {
    let isMounted = true;
    const fetchTemplate = async () => {
      setLoadingTemplate(true);
      try {
        const res = await getConfigTemplate(assessment.template_id);
        if (isMounted && res.success && Array.isArray(res.items)) {
          setTemplateItems(res.items);
          // Expand all categories by default
          const cats = new Set<string>();
          res.items.forEach((it: any) => {
            const cat = (it.categorie_racine_fr || it.categorie || "Critères Généraux").trim();
            cats.add(cat);
          });
          setOpenCategories(cats);
        }
      } catch (e) {
        console.error("Erreur chargement template assessment", e);
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

  const toggleCategory = (catLabel: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catLabel)) next.delete(catLabel);
      else next.add(catLabel);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-fade-in font-sans print:static print:p-0 print:bg-white print:overflow-visible print:block print:w-full">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden my-auto print:max-h-none print:m-0 print:border-none print:shadow-none print:rounded-none print:w-full print:block print:overflow-visible">
        {/* ── HEADER ── */}
        <header className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 flex-shrink-0 print:border-b-2 print:border-slate-900 print:bg-white print:p-0 print:pb-4">
          <div className="flex items-center gap-3">
            <CaliSyncLogo size="sm" showText={false} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {assessment.titre}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1dc4ff]/10 text-[#0077aa] border border-[#1dc4ff]/20 print:border-slate-300 print:text-slate-800">
                  Assessment Libre
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {assessment.template_nom || assessment.template_id}
                </span>
                {assessment.is_corrected && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 print:bg-emerald-100 print:border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Grille Corrigée
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Évaluateur : <strong className="text-slate-800">{assessment.evaluateur_id}</strong>
                </span>
                {assessment.nom_conseiller && (
                  <span className="flex items-center gap-1">
                    ID Appel / Conseiller : <strong className="font-mono text-slate-800">{assessment.nom_conseiller}</strong>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(assessment.date_creation).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {assessment.correcteur_nom && (
                  <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 print:bg-emerald-100">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    Correcteur : <strong className="text-emerald-950">{assessment.correcteur_nom}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
            {onOpenReport && (
              <button
                onClick={() => {
                  onClose();
                  onOpenReport(assessment);
                }}
                className="px-3.5 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black rounded-xl text-xs shadow-md shadow-[#1dc4ff]/20 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Consulter le rapport officiel de débriefing et l'imprimer en PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{assessment.is_corrected ? "Rapport Corrigé & PDF" : "Rapport Qualité & PDF"}</span>
              </button>
            )}

            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(assessment);
                }}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                title="Modifier ou corriger cette évaluation"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#1dc4ff]" />
                <span className="hidden sm:inline">Corriger</span>
              </button>
            )}

            <button
              onClick={() => {
                if (onOpenReport) {
                  onClose();
                  onOpenReport(assessment);
                } else {
                  window.print();
                }
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Générer et imprimer le rapport PDF officiel"
            >
              <Printer className="w-3.5 h-3.5 text-[#1dc4ff]" />
              <span className="hidden sm:inline">Imprimer / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── SCROLLABLE BODY ── */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50 print:p-0 print:space-y-4 print:bg-white print:overflow-visible print:h-auto">
          {/* Audio Player if provided (Hidden in Print) */}
          {assessment.audio_url && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                <Headphones className="w-4 h-4 text-[#1dc4ff]" /> Support Audio Enregistré
              </div>
              <AudioPlayer audioUrl={assessment.audio_url} floating={false} compact={false} />
            </div>
          )}

          {/* Interaction Summary / Comments */}
          {(assessment.interaction_summary || assessment.evaluator_comments || assessment.consignes) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
              {assessment.interaction_summary && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1 shadow-xs print:border-slate-300">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#1dc4ff] print:text-slate-700" /> Résumé de l'Interaction
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed italic whitespace-pre-wrap">
                    &ldquo;{assessment.interaction_summary}&rdquo;
                  </p>
                </div>
              )}

              {assessment.evaluator_comments && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1 shadow-xs print:border-slate-300">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-500 print:text-slate-700" /> Synthèse &amp; Axes de Progrès
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed italic whitespace-pre-wrap">
                    &ldquo;{assessment.evaluator_comments}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Detailed Items Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#1dc4ff] print:text-slate-800" /> Grille d'Évaluation &amp; Justifications ({assessment.template_nom || assessment.template_id})
              </h3>

              {tree.length > 1 && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold print:hidden">
                  <button
                    type="button"
                    onClick={() => setViewMode("stepped")}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      viewMode === "stepped"
                        ? "bg-white text-slate-950 shadow-xs font-black"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Par section
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("all")}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      viewMode === "all"
                        ? "bg-white text-slate-950 shadow-xs font-black"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Tout afficher
                  </button>
                </div>
              )}
            </div>

            {/* Category Navigation Pills (Hidden in Print) */}
            {!loadingTemplate && tree.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth print:hidden">
                {tree.map((cat, idx) => {
                  const evaluatedCount = cat.questions.filter((q) => !!reponsesMap[q.item.item_id]).length;
                  const totalQuestions = cat.questions.length;
                  const isDone = evaluatedCount === totalQuestions && totalQuestions > 0;
                  const isActive = viewMode === "stepped" && activeCategoryIndex === idx;

                  return (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => {
                        setActiveCategoryIndex(idx);
                        if (viewMode === "all") {
                          document.getElementById(`view-cat-section-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer flex-shrink-0 border ${
                        isActive
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : isDone
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span>{idx + 1}. {cat.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isActive
                          ? "bg-white/20 text-white"
                          : isDone
                          ? "bg-emerald-200/60 text-emerald-900"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {evaluatedCount}/{totalQuestions}
                      </span>
                      {isDone && <Check className="w-3 h-3 text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
            )}

            {loadingTemplate ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium bg-white rounded-2xl border border-slate-200">
                Chargement de la grille...
              </div>
            ) : tree.length > 0 ? (
              tree.map((cat, catIdx) => {
                const isSectionActiveOnScreen = viewMode === "all" || activeCategoryIndex === catIdx;
                const isOpen = viewMode === "stepped" ? true : openCategories.has(cat.label);
                const evaluatedCount = cat.questions.filter((q) => !!reponsesMap[q.item.item_id]).length;
                const totalQuestions = cat.questions.length;

                return (
                  <div
                    key={cat.label}
                    id={`view-cat-section-${catIdx}`}
                    className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs print:border-slate-300 print:shadow-none print:break-inside-avoid print:mb-4 ${
                      isSectionActiveOnScreen ? "block" : "hidden print:block"
                    }`}
                  >
                    {/* Category Header */}
                    <button
                      type="button"
                      onClick={() => viewMode !== "stepped" && toggleCategory(cat.label)}
                      className={`w-full px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between hover:bg-slate-100 transition-colors text-left print:bg-slate-100 print:border-slate-300 ${
                        viewMode !== "stepped" ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-xl bg-[#1dc4ff]/10 border border-[#1dc4ff]/30 flex items-center justify-center flex-shrink-0 print:border-slate-300">
                          <Sparkles className="w-3.5 h-3.5 text-[#009ae5] print:text-slate-800" />
                        </div>
                        <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wider text-slate-900">
                          Section {catIdx + 1}/{tree.length} : {cat.label}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          evaluatedCount === totalQuestions
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 print:bg-emerald-100 print:border-emerald-300"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {evaluatedCount}/{totalQuestions} évalué(s)
                        </span>
                      </div>
                      {viewMode !== "stepped" && (
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 print:hidden ${isOpen ? "rotate-180" : ""}`}
                        />
                      )}
                    </button>

                    {/* Questions List (Always visible in print) */}
                    <div className={`p-4 sm:p-5 space-y-4 divide-y divide-slate-100 ${isOpen ? "block" : "hidden print:block"}`}>
                      {cat.questions.map((q, idx) => {
                        const ans = reponsesMap[q.item.item_id];
                        const comment = commentairesMap[q.item.item_id];
                        const isCritical = q.item.criticite === "Critical";

                        const isOui = ans === "Oui";
                        const isNon = ans === "Non";
                        const isNA = ans === "N.A.";

                        // Collect only the deepest imputed leaves (sub-items with answer or comment)
                        const imputedLeaves = getImputedLeaves(q, reponsesMap, commentairesMap);

                        return (
                          <div key={q.item.item_id} className={`space-y-3 print:break-inside-avoid ${idx > 0 ? "pt-4" : ""}`}>
                            {/* Main Question Card */}
                            <div
                              className={`p-4 rounded-2xl border transition-all print:border-slate-200 ${
                                isOui
                                  ? "bg-emerald-50/40 border-emerald-200 print:bg-emerald-50/20"
                                  : isNon
                                  ? "bg-rose-50/40 border-rose-200 print:bg-rose-50/20"
                                  : isNA
                                  ? "bg-slate-50 border-slate-200"
                                  : "bg-white border-slate-200"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                                      {q.item.libelle_fr || q.item.libelle || q.item.item_id}
                                    </span>
                                    {isCritical && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 print:bg-rose-100 print:border-rose-300">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Critique
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    Réf : {q.item.item_id}
                                  </div>
                                </div>

                                {/* Answer Pill */}
                                <div className="flex-shrink-0">
                                  {isOui && (
                                    <span className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500 text-white shadow-xs flex items-center gap-1.5 print:bg-emerald-100 print:text-emerald-800 print:border print:border-emerald-300">
                                      <CheckCircle2 className="w-4 h-4" /> OUI / CONFORME
                                    </span>
                                  )}
                                  {isNon && (
                                    <span className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-500 text-white shadow-xs flex items-center gap-1.5 print:bg-rose-100 print:text-rose-800 print:border print:border-rose-300">
                                      <XCircle className="w-4 h-4" /> NON / NON CONFORME
                                    </span>
                                  )}
                                  {isNA && (
                                    <span className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1.5 print:bg-slate-100 print:text-slate-600">
                                      <MinusCircle className="w-4 h-4" /> NON APPLICABLE
                                    </span>
                                  )}
                                  {!ans && (
                                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200">
                                      Non évalué
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Justification Comment on N2 Question */}
                              {comment && (
                                <div className="mt-3 pt-3 border-t border-slate-200/80">
                                  <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5 print:text-slate-700">
                                    <MessageSquare className="w-3.5 h-3.5 text-[#009ae5] print:text-slate-700" />
                                    Commentaire / Justification de l'évaluateur :
                                  </div>
                                  <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-slate-200 font-medium whitespace-pre-wrap leading-relaxed print:bg-slate-50 print:border-slate-200">
                                    &ldquo;{comment}&rdquo;
                                  </p>
                                </div>
                              )}

                              {/* Deepest Imputed Sub-Items / Motifs (Only displayed if imputed) */}
                              {imputedLeaves.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 print:text-slate-600 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                    Motif(s) / Point(s) imputé(s) :
                                  </div>
                                  <div className="space-y-2 pl-2 border-l-2 border-rose-300 print:border-slate-300">
                                    {imputedLeaves.map((leaf) => {
                                      const isLeafNon = leaf.rep === "Non";

                                      return (
                                        <div
                                          key={leaf.item.item_id}
                                          className={`text-xs p-3 rounded-xl border flex flex-col gap-1.5 print:border-slate-200 print:break-inside-avoid ${
                                            isLeafNon
                                              ? "bg-rose-50/60 border-rose-200 text-rose-950"
                                              : "bg-slate-50 border-slate-200 text-slate-800"
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-0.5">
                                              {leaf.parentItem && (
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                  {leaf.parentItem.libelle_fr || leaf.parentItem.libelle}
                                                </div>
                                              )}
                                              <span className="font-bold text-slate-900 leading-snug">
                                                &bull; {leaf.item.libelle_fr || leaf.item.libelle || leaf.item.item_id}
                                              </span>
                                            </div>
                                            {leaf.rep && (
                                              <span
                                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded flex-shrink-0 border ${
                                                  isLeafNon
                                                    ? "bg-rose-100 text-rose-700 border-rose-200"
                                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                                }`}
                                              >
                                                {leaf.rep}
                                              </span>
                                            )}
                                          </div>

                                          {leaf.comm && (
                                            <div className="mt-1 bg-white/90 border border-rose-100 rounded-lg p-2 text-[11px] text-slate-800 font-medium italic">
                                              &ldquo;{leaf.comm}&rdquo;
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              // Fallback raw answers list
              <div className="bg-white rounded-2xl border border-slate-200 p-4 divide-y divide-slate-100">
                {Object.entries(reponsesMap).map(([itemId, rep]) => (
                  <div key={itemId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-800">{itemId}</span>
                    <span className="font-bold">{rep}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER (Hidden in Print) ── */}
        <footer className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-shrink-0 flex-wrap print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(assessment);
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <Edit3 className="w-4 h-4 text-[#1dc4ff]" />
                {assessment.is_corrected ? "Modifier à nouveau" : "Corriger cette évaluation"}
              </button>
            )}

            {onOpenReport && (
              <button
                onClick={() => {
                  onClose();
                  onOpenReport(assessment);
                }}
                className="px-4 py-2.5 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black text-xs rounded-xl shadow-md shadow-[#1dc4ff]/20 flex items-center gap-2 cursor-pointer transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>{assessment.is_corrected ? "Voir la correction & Imprimer" : "Voir le rapport & Imprimer"}</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Fermer la consultation
          </button>
        </footer>
      </div>
    </div>
  );
};
