import React, { useState, useEffect } from "react";
import {
  Award,
  X,
  Check,
  RefreshCw,
  CornerDownRight,
  Flame,
  MessageSquare,
} from "lucide-react";
import type { CockpitNode } from "../../lib/api";

export interface ArbitrageChainPayload {
  n1Id: string;
  n1Decision: "Oui" | "Non" | "N.A.";
  selectedN2Ids: string[];
  selectedN3Ids: string[];
  itemComments: Record<string, string>;
  justification: string;
}

interface ArbitrageDrawerProps {
  isOpen: boolean;
  node: CockpitNode | null;
  onClose: () => void;
  onSave: (payload: ArbitrageChainPayload) => Promise<void>;
}

export const ArbitrageDrawer: React.FC<ArbitrageDrawerProps> = ({
  isOpen,
  node,
  onClose,
  onSave,
}) => {
  const [decisionN1, setDecisionN1] = useState<"Oui" | "Non" | "N.A.">("Oui");
  const [selectedN2Ids, setSelectedN2Ids] = useState<string[]>([]);
  const [selectedN3Ids, setSelectedN3Ids] = useState<string[]>([]);
  const [itemComments, setItemComments] = useState<Record<string, string>>({});
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (node) {
      const defaultDec =
        (node.decision_finale?.decision as any) ||
        (node.gauge?.critere as any) ||
        "Oui";
      setDecisionN1(defaultDec);
      setJustification(node.decision_finale?.justification || "");

      const n2Children = node.children || [];
      const preselectedN2: string[] = [];
      const preselectedN3: string[] = [];
      const preComments: Record<string, string> = {};

      if (node.decision_finale?.justification) {
        preComments[node.item_id] = node.decision_finale.justification;
      }

      n2Children.forEach((c) => {
        const isImputedN2 =
          c.decision_finale?.decision === "Non" ||
          (c.votes_par_critere?.Non && c.votes_par_critere.Non.length > 0);
        if (isImputedN2) {
          preselectedN2.push(c.item_id);
          if (c.decision_finale?.justification) {
            preComments[c.item_id] = c.decision_finale.justification;
          }
        }

        if (c.children) {
          c.children.forEach((n3) => {
            const isImputedN3 =
              n3.decision_finale?.decision === "Non" ||
              (n3.votes_par_critere?.Non && n3.votes_par_critere.Non.length > 0);
            if (isImputedN3) {
              preselectedN3.push(n3.item_id);
              if (n3.decision_finale?.justification) {
                preComments[n3.item_id] = n3.decision_finale.justification;
              }
            }
          });
        }
      });

      // Fallback: if no N2 was pre-imputed but N2 children exist, select first N2 by default
      if (preselectedN2.length === 0 && n2Children.length > 0) {
        preselectedN2.push(n2Children[0].item_id);
        if (n2Children[0].children && n2Children[0].children.length > 0) {
          preselectedN3.push(n2Children[0].children[0].item_id);
        }
      }

      setSelectedN2Ids(preselectedN2);
      setSelectedN3Ids(preselectedN3);
      setItemComments(preComments);
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const n2Children = node.children || [];
  const activeN2Nodes = n2Children.filter((c) => selectedN2Ids.includes(c.item_id));

  const toggleN2Select = (n2Id: string) => {
    setSelectedN2Ids((prev) => {
      if (prev.includes(n2Id)) {
        // Unselecting N2: also clear its N3 children
        const n2Node = n2Children.find((c) => c.item_id === n2Id);
        if (n2Node?.children) {
          const n3ChildIds = n2Node.children.map((child) => child.item_id);
          setSelectedN3Ids((prevN3) => prevN3.filter((id) => !n3ChildIds.includes(id)));
        }
        return prev.filter((id) => id !== n2Id);
      } else {
        // Selecting N2: auto-select first N3 child if available
        const n2Node = n2Children.find((c) => c.item_id === n2Id);
        if (n2Node?.children && n2Node.children.length > 0) {
          const firstN3Id = n2Node.children[0].item_id;
          setSelectedN3Ids((prevN3) => (prevN3.includes(firstN3Id) ? prevN3 : [...prevN3, firstN3Id]));
        }
        return [...prev, n2Id];
      }
    });
  };

  const toggleN3Select = (n3Id: string) => {
    setSelectedN3Ids((prev) =>
      prev.includes(n3Id) ? prev.filter((id) => id !== n3Id) : [...prev, n3Id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload: ArbitrageChainPayload = {
      n1Id: node.item_id,
      n1Decision: decisionN1,
      selectedN2Ids: decisionN1 === "Non" ? selectedN2Ids : [],
      selectedN3Ids: decisionN1 === "Non" ? selectedN3Ids : [],
      itemComments: decisionN1 === "Non" ? itemComments : {},
      justification,
    };

    await onSave(payload);
    setIsSubmitting(false);
    onClose();
  };

  const cleanLibelle = (text: string) => {
    if (!text) return "";
    return text.split(",")[0].replace(/^["']+|["']+$/g, "").trim() || text;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col justify-between overflow-y-auto animate-slide-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Arbitrage Multi-Imputations Simultanées
              </div>
              <h3 className="text-base font-extrabold text-white leading-tight">
                Évaluation de Groupe en Live
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Target Item Context */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              <span>Item N1 • {node.categorie_racine_fr || "Question Principale"}</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] ${node.criticite === "Critical" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-slate-800 text-slate-300"}`}>
                {node.criticite}
              </span>
            </div>
            <p className="text-sm font-black text-white leading-snug">
              {cleanLibelle(node.libelle)}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} id="arbitrage-form" className="space-y-6">
            {/* STEP 1: ITEM N1 DECISION */}
            <div className="space-y-2.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 block">
                Étape 1 : Décision de Consensus sur l'Item N1 :
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "Oui", label: "Conforme (Oui)", color: "emerald" },
                  { value: "Non", label: "Imputé (Non)", color: "rose" },
                  { value: "N.A.", label: "Non Appl. (N.A.)", color: "slate" },
                ].map((opt) => {
                  const isSelected = decisionN1 === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDecisionN1(opt.value as any)}
                      className={`py-3.5 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                        isSelected
                          ? opt.color === "emerald"
                            ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/30"
                            : opt.color === "rose"
                            ? "bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/30"
                            : "bg-slate-700 text-white border-slate-500 shadow-lg"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4" />}
                      {opt.value}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: MOTIFS SELECTION N2 (Multi-Select Checkboxes with specific comments) */}
            {decisionN1 === "Non" && n2Children.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                    <Flame className="w-4 h-4 text-amber-400" />
                    Étape 2 : Cocher les Motifs d'Écart (Sous-Items N2) :
                  </div>
                  <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                    {selectedN2Ids.length} sélectionné(s)
                  </span>
                </div>

                <div className="space-y-3">
                  {n2Children.map((n2) => {
                    const isSelected = selectedN2Ids.includes(n2.item_id);
                    const votesNonGauge = n2.gauge?.critere === "Non";
                    const votesNonCohorte = n2.votes_par_critere?.Non?.length || 0;

                    return (
                      <div
                        key={n2.item_id}
                        className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10"
                            : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div
                          onClick={() => toggleN2Select(n2.item_id)}
                          className="flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleN2Select(n2.item_id);
                              }}
                              className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold leading-tight">
                              {cleanLibelle(n2.libelle)}
                            </span>
                          </div>

                          {/* Votes Indicator Badges */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {votesNonGauge && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Gauge: Non
                              </span>
                            )}
                            {votesNonCohorte > 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {votesNonCohorte} vote(s) Non
                              </span>
                            )}
                          </div>
                        </div>

                        {/* SPECIFIC COMMENT FIELD FOR THIS N2 MOTIF */}
                        {isSelected && (
                          <div
                            className="pt-2 border-t border-amber-500/30 space-y-1.5 animate-fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <label className="text-[11px] font-extrabold text-amber-300 flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                              Commentaire spécifique au motif :
                            </label>
                            <textarea
                              value={itemComments[n2.item_id] || ""}
                              onChange={(e) =>
                                setItemComments((prev) => ({
                                  ...prev,
                                  [n2.item_id]: e.target.value,
                                }))
                              }
                              placeholder={`Consigner la justification spécifique pour "${cleanLibelle(n2.libelle)}"...`}
                              rows={2}
                              className="w-full p-3 bg-slate-950/90 border border-amber-500/30 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all resize-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: PRECISION SELECTION N3 (Multi-Select Checkboxes with specific comments) */}
            {decisionN1 === "Non" && activeN2Nodes.length > 0 && (
              <div className="space-y-4 animate-fade-in">
                {activeN2Nodes.map((n2Node) => {
                  const n3Children = n2Node.children || [];
                  if (n3Children.length === 0) return null;

                  return (
                    <div
                      key={n2Node.item_id}
                      className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-300">
                          <CornerDownRight className="w-4 h-4 text-purple-400" />
                          Précisions N3 sous : <span className="text-white font-extrabold">{cleanLibelle(n2Node.libelle)}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {n3Children.map((n3) => {
                          const isSelected = selectedN3Ids.includes(n3.item_id);
                          const votesNonGauge = n3.gauge?.critere === "Non";
                          const votesNonCohorte = n3.votes_par_critere?.Non?.length || 0;

                          return (
                            <div
                              key={n3.item_id}
                              className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                                isSelected
                                  ? "bg-purple-500/20 border-purple-400 text-white shadow-md shadow-purple-500/10"
                                  : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700"
                              }`}
                            >
                              <div
                                onClick={() => toggleN3Select(n3.item_id)}
                                className="flex items-center justify-between gap-3 cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleN3Select(n3.item_id);
                                    }}
                                    className="w-4 h-4 rounded text-purple-500 bg-slate-900 border-slate-700 focus:ring-purple-500 cursor-pointer"
                                  />
                                  <span className="text-xs font-bold leading-tight">
                                    {cleanLibelle(n3.libelle)}
                                  </span>
                                </div>

                                {/* Votes Indicator Badges */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {votesNonGauge && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                      Gauge: Non
                                    </span>
                                  )}
                                  {votesNonCohorte > 0 && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      {votesNonCohorte} vote(s) Non
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* SPECIFIC COMMENT FIELD FOR THIS N3 PRECISION */}
                              {isSelected && (
                                <div
                                  className="pt-2 border-t border-purple-500/30 space-y-1.5 animate-fade-in"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label className="text-[11px] font-extrabold text-purple-300 flex items-center gap-1">
                                    <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                                    Commentaire spécifique à la précision :
                                  </label>
                                  <textarea
                                    value={itemComments[n3.item_id] || ""}
                                    onChange={(e) =>
                                      setItemComments((prev) => ({
                                        ...prev,
                                        [n3.item_id]: e.target.value,
                                      }))
                                    }
                                    placeholder={`Consigner la justification spécifique pour "${cleanLibelle(n3.libelle)}"...`}
                                    rows={2}
                                    className="w-full p-3 bg-slate-950/90 border border-purple-500/30 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-all resize-none"
                                  />
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
            )}

            {/* SYNTHÈSE GLOBALE DE GROUPE */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 block">
                Synthèse Générale de la Décision de Groupe (Remarque globale) :
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Consigner la synthèse globale validée lors du débat de calibrage..."
                rows={3}
                className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all resize-none"
              />
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/80 sticky bottom-0 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="arbitrage-form"
            disabled={isSubmitting}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
            Valider l'Arbitrage de Consensus
          </button>
        </div>
      </div>
    </div>
  );
};
