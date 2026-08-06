import React, { useState, useEffect } from "react";
import {
  Award,
  X,
  Check,
  RefreshCw,
  CornerDownRight,
  Flame,
} from "lucide-react";
import type { CockpitNode } from "../../lib/api";

export interface ArbitrageChainPayload {
  n1Id: string;
  n1Decision: "Oui" | "Non" | "N.A.";
  n2Id?: string;
  n2Decision?: "Oui" | "Non" | "N.A.";
  n3Id?: string;
  n3Decision?: "Oui" | "Non" | "N.A.";
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
  const [selectedN2Id, setSelectedN2Id] = useState<string | null>(null);
  const [selectedN3Id, setSelectedN3Id] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (node) {
      // Set default N1 decision
      const defaultDec =
        (node.decision_finale?.decision as any) ||
        (node.gauge?.critere as any) ||
        "Oui";
      setDecisionN1(defaultDec);
      setJustification(node.decision_finale?.justification || "");

      // Pre-select first child N2 if exists
      const n2Children = node.children || [];
      if (n2Children.length > 0) {
        // Try to find N2 with Non votes or existing decision
        const imputedN2 = n2Children.find(
          (c) =>
            c.decision_finale?.decision === "Non" ||
            (c.votes_par_critere?.Non && c.votes_par_critere.Non.length > 0)
        );
        const targetN2 = imputedN2 || n2Children[0];
        setSelectedN2Id(targetN2.item_id);

        // Pre-select N3 under targetN2
        const n3Children = targetN2.children || [];
        if (n3Children.length > 0) {
          const imputedN3 = n3Children.find(
            (c) =>
              c.decision_finale?.decision === "Non" ||
              (c.votes_par_critere?.Non && c.votes_par_critere.Non.length > 0)
          );
          setSelectedN3Id((imputedN3 || n3Children[0]).item_id);
        } else {
          setSelectedN3Id(null);
        }
      } else {
        setSelectedN2Id(null);
        setSelectedN3Id(null);
      }
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const n2Children = node.children || [];
  const selectedN2Node = n2Children.find((c) => c.item_id === selectedN2Id) || null;
  const n3Children = selectedN2Node?.children || [];

  const handleN2Select = (n2Item: CockpitNode) => {
    setSelectedN2Id(n2Item.item_id);
    const children = n2Item.children || [];
    if (children.length > 0) {
      const imputedN3 = children.find(
        (c) =>
          c.decision_finale?.decision === "Non" ||
          (c.votes_par_critere?.Non && c.votes_par_critere.Non.length > 0)
      );
      setSelectedN3Id((imputedN3 || children[0]).item_id);
    } else {
      setSelectedN3Id(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload: ArbitrageChainPayload = {
      n1Id: node.item_id,
      n1Decision: decisionN1,
      n2Id: decisionN1 === "Non" && selectedN2Id ? selectedN2Id : undefined,
      n2Decision: decisionN1 === "Non" && selectedN2Id ? "Non" : undefined,
      n3Id: decisionN1 === "Non" && selectedN3Id ? selectedN3Id : undefined,
      n3Decision: decisionN1 === "Non" && selectedN3Id ? "Non" : undefined,
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
                Arbitrage de Consensus Guidé
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

            {/* STEP 2: MOTIF SELECTION N2 (Conditional if N1 = "Non" and has N2 children) */}
            {decisionN1 === "Non" && n2Children.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Étape 2 : Sélectionner le Motif d'Écart (Sous-Item N2) :
                </div>

                <div className="space-y-2">
                  {n2Children.map((n2) => {
                    const isSelected = selectedN2Id === n2.item_id;
                    const votesNonGauge = n2.gauge?.critere === "Non";
                    const votesNonCohorte = n2.votes_par_critere?.Non?.length || 0;

                    return (
                      <div
                        key={n2.item_id}
                        onClick={() => handleN2Select(n2)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10"
                            : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="n2-motif"
                            checked={isSelected}
                            onChange={() => handleN2Select(n2)}
                            className="w-4 h-4 text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-500 cursor-pointer"
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
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: PRECISION SELECTION N3 (Conditional if selected N2 has N3 children) */}
            {decisionN1 === "Non" && selectedN2Node && n3Children.length > 0 && (
              <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-300">
                  <CornerDownRight className="w-4 h-4 text-purple-400" />
                  Étape 3 : Précision Comportementale Terminale (N3) :
                </div>

                <div className="space-y-2">
                  {n3Children.map((n3) => {
                    const isSelected = selectedN3Id === n3.item_id;
                    const votesNonGauge = n3.gauge?.critere === "Non";
                    const votesNonCohorte = n3.votes_par_critere?.Non?.length || 0;

                    return (
                      <div
                        key={n3.item_id}
                        onClick={() => setSelectedN3Id(n3.item_id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-purple-500/20 border-purple-400 text-white shadow-md shadow-purple-500/10"
                            : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="n3-precision"
                            checked={isSelected}
                            onChange={() => setSelectedN3Id(n3.item_id)}
                            className="w-4 h-4 text-purple-500 bg-slate-900 border-slate-700 focus:ring-purple-500 cursor-pointer"
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
                    );
                  })}
                </div>
              </div>
            )}

            {/* JUSTIFICATION */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 block">
                Consigne / Synthèse de la Décision de Groupe :
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Consigner les motifs ou remarques validées lors du débat de calibrage..."
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
