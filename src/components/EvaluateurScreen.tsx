import React, { useEffect, useState } from "react";
import {
  getConfigTemplate,
  getSessionsActives,
  getSessionData,
  listerToutesSessions,
  type SessionInfo,
} from "../lib/api";
import {
  HierarchicalEvaluationForm,
  type HierarchicalItem,
} from "./HierarchicalEvaluationForm";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export interface EvaluateurScreenProps {
  sessionId?: string;
  evaluateurId?: string;
  sessionLocked?: boolean;
  isGaugeMode?: boolean;
  callName?: string;
  audioUrl?: string;
  onComplete?: () => void;
}

export const EvaluateurScreen: React.FC<EvaluateurScreenProps> = ({
  sessionId = "SESS_2026_001",
  evaluateurId = "EVAL_01",
  sessionLocked = false,
  isGaugeMode = false,
  callName,
  audioUrl,
  onComplete,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [items, setItems] = useState<HierarchicalItem[]>([]);

  const loadSessionAndGrid = async () => {
    setLoading(true);
    setError(null);

    try {
      let tplId = "TPL_QTO_STD";
      let resolvedInfo: SessionInfo | null = null;

      // 1. Level 1 Resolution: Try active sessions list
      const activeRes = await getSessionsActives();
      if (activeRes && activeRes.success && Array.isArray(activeRes.sessions)) {
        const found = activeRes.sessions.find((s) => String(s.session_id).trim() === String(sessionId).trim());
        if (found) {
          resolvedInfo = found;
        }
      }

      // 2. Level 2 Resolution: Fallback to getSessionData / cockpit endpoint (works regardless of session status)
      if (!resolvedInfo) {
        const cockpitRes = await getSessionData(sessionId);
        if (cockpitRes && cockpitRes.success && cockpitRes.template_id) {
          resolvedInfo = {
            session_id: sessionId,
            nom_session: cockpitRes.nom_session || sessionId,
            statut: cockpitRes.statut || "OPEN",
            template_id: cockpitRes.template_id,
            heure_ouverture: cockpitRes.heure_ouverture || "",
            heure_fin: cockpitRes.heure_fin || "",
            duree_minutes: cockpitRes.duree_minutes || 15,
            url_audio: cockpitRes.url_audio || "",
            nom_conseiller: cockpitRes.nom_conseiller || "",
            gauge_soumis: false,
            nombre_evaluateurs_soumis: cockpitRes.evaluateurs_soumis?.length || 0,
          };
        }
      }

      // 3. Level 3 Resolution: Fallback to listerToutesSessions
      if (!resolvedInfo) {
        const allRes = await listerToutesSessions();
        if (allRes && allRes.success && Array.isArray(allRes.sessions)) {
          const foundAll = allRes.sessions.find((s) => String(s.session_id).trim() === String(sessionId).trim());
          if (foundAll) {
            resolvedInfo = foundAll;
          }
        }
      }

      if (resolvedInfo) {
        setSessionInfo(resolvedInfo);
        tplId = resolvedInfo.template_id || "TPL_QTO_STD";
      }

      // 4. Fetch full 4-level items from Admin_Config_Grille for the session's template_id
      const configRes = await getConfigTemplate(tplId);

      if (configRes && configRes.success && Array.isArray(configRes.items) && configRes.items.length > 0) {
        const mappedItems: HierarchicalItem[] = configRes.items.map((it: any) => ({
          item_id: String(it.item_id),
          parent_id: String(it.parent_id || ""),
          niveau: Number(it.niveau) || 2,
          type_noeud: it.type_noeud || "standard",
          categorie_racine_fr: it.categorie_racine_fr || "Général",
          libelle_fr: it.libelle_fr || it.item_libelle || "",
          criticite: it.criticite === "Critical" ? "Critical" : "Standard",
          est_terminal: it.est_terminal === true || String(it.est_terminal).toLowerCase() === "true" || String(it.est_terminal).toLowerCase() === "vrai",
          commentaire_obligatoire: it.commentaire_obligatoire === true || String(it.commentaire_obligatoire).toLowerCase() === "true" || String(it.commentaire_obligatoire).toLowerCase() === "vrai",
        }));
        setItems(mappedItems);
      } else {
        // Fallback default items if template has no config
        setItems([
          { item_id: "item_rel_01", parent_id: "", niveau: 2, categorie_racine_fr: "Relationnel & Accueil", libelle_fr: "Sourire vocal & empathie dès la prise d'appel", criticite: "Standard", est_terminal: true },
          { item_id: "item_rel_02", parent_id: "", niveau: 2, categorie_racine_fr: "Relationnel & Accueil", libelle_fr: "Identification claire du conseiller et de la marque", criticite: "Standard", est_terminal: true },
          { item_id: "item_rel_03", parent_id: "", niveau: 2, categorie_racine_fr: "Relationnel & Accueil", libelle_fr: "Écoute active sans interruption du client", criticite: "Critical", est_terminal: true },
          { item_id: "item_tech_01", parent_id: "", niveau: 2, categorie_racine_fr: "Technique & Processus", libelle_fr: "Vérification stricte de l'identité du client (DPA)", criticite: "Critical", est_terminal: true },
          { item_id: "item_tech_02", parent_id: "", niveau: 2, categorie_racine_fr: "Technique & Processus", libelle_fr: "Diagnostic précis du besoin ou du problème", criticite: "Standard", est_terminal: true },
          { item_id: "item_tech_03", parent_id: "", niveau: 2, categorie_racine_fr: "Technique & Processus", libelle_fr: "Reformulation et validation de la solution", criticite: "Standard", est_terminal: true },
          { item_id: "item_clo_01", parent_id: "", niveau: 2, categorie_racine_fr: "Clôture & Outils", libelle_fr: "Proposition d'assistance complémentaire", criticite: "Standard", est_terminal: true },
          { item_id: "item_clo_02", parent_id: "", niveau: 2, categorie_racine_fr: "Clôture & Outils", libelle_fr: "Prise de note complète dans le CRM / Outil métier", criticite: "Standard", est_terminal: true },
        ]);
      }
    } catch (err) {
      setError("Erreur lors du chargement de la grille d'évaluation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionAndGrid();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
        <p className="text-slate-300 font-medium text-sm">Chargement de la grille d'évaluation Genii…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl max-w-md text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <p className="text-white text-sm font-semibold">{error}</p>
          <button
            onClick={loadSessionAndGrid}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 mx-auto cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <HierarchicalEvaluationForm
      items={items}
      sessionId={sessionId}
      evaluateurId={evaluateurId}
      sessionLocked={sessionLocked}
      isGaugeMode={isGaugeMode}
      callName={sessionInfo ? `${sessionInfo.nom_session}${sessionInfo.nom_conseiller ? ` — Conseiller : ${sessionInfo.nom_conseiller}` : ""}` : callName}
      audioUrl={sessionInfo?.url_audio || audioUrl}
      onComplete={onComplete}
    />
  );
};

export default EvaluateurScreen;
