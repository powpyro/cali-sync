import React from "react";
import { Gavel, Construction, ArrowLeft } from "lucide-react";
import { CaliSyncLogo } from "./ui/CaliSyncLogo";

interface RingDisputeProps {
  onBack: () => void;
}

export const RingDispute: React.FC<RingDisputeProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <CaliSyncLogo size="sm" showText={false} variant="dark" />
          <div className="font-extrabold text-white text-base flex items-center gap-2">
            <Gavel className="w-4.5 h-4.5 text-[#1dc4ff]" />
            Mode Dispute — Arbitrage
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="glass-card rounded-2xl p-12 max-w-lg text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Construction className="w-10 h-10 text-indigo-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-white">
              Fonctionnalité à implémenter
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
              Le mode <span className="text-indigo-400 font-bold">Dispute & Arbitrage</span> sera 
              disponible après la validation complète du flux de calibrage normal. 
              Il permettra de confronter les avis divergents entre évaluateurs et 
              de trancher avec l'aide de la synthèse IA.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
              <Construction className="w-3.5 h-3.5" />
              En développement
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RingDispute;
