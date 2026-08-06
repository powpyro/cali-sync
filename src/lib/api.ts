// src/lib/api.ts
// Client API vers le backend Google Apps Script (Cali-Sync_DB)

let customApiUrl: string | null = typeof localStorage !== "undefined" ? localStorage.getItem("CALISYNC_CUSTOM_API_URL") : null;

export function getApiUrl(): string {
  return customApiUrl || import.meta.env.VITE_API_URL || "";
}

export function setApiUrl(url: string) {
  customApiUrl = url.trim();
  if (typeof localStorage !== "undefined") {
    if (customApiUrl) {
      localStorage.setItem("CALISYNC_CUSTOM_API_URL", customApiUrl);
    } else {
      localStorage.removeItem("CALISYNC_CUSTOM_API_URL");
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES — Types de données
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiResponse {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

// ── Evaluateur / Login ────────────────────────────────────────────────────────

export interface ProfilEvaluateur {
  identifiant: string;
  nom_complet: string;
  date_creation?: string;
  nombre_sessions?: number;
  nombre_total_evaluations_soumises?: number;
  nombre_sessions_participes?: number;
  nombre_sessions_ratees?: number;
  nombre_sessions_animees?: number;
}

export interface LoginResponse {
  success: boolean;
  exists: boolean;
  profil?: ProfilEvaluateur;
  message?: string;
}

export interface ListerEvaluateursResponse {
  success: boolean;
  evaluateurs: ProfilEvaluateur[];
  message?: string;
}

// ── Demandes de Calibrage ──────────────────────────────────────────────────────

export interface DemandeCalibrageInfo {
  demande_id: string;
  evaluateur_id: string;
  nom_evaluateur?: string;
  nom_session: string;
  template_id: string;
  heure_ouverture_proposee: string;
  heure_fermeture_proposee: string;
  duree_minutes: number;
  nom_conseiller?: string;
  consignes?: string;
  url_audio?: string;
  statut: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  date_demande: string;
  items_gauge?: Array<{
    item_id: string;
    categorie: string;
    item: string;
    statut: string;
    commentaire?: string;
  }>;
}

export interface DemandesListResponse {
  success: boolean;
  demandes: DemandeCalibrageInfo[];
  message?: string;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export type SessionStatut =
  | "PENDING_GAUGE"
  | "GAUGE_DONE"
  | "OPEN"
  | "LOCKED"
  | "CLOSED";

export interface SessionInfo {
  session_id: string;
  nom_session: string;
  statut: SessionStatut;
  template_id: string;
  animateur_id?: string;
  gauge_id?: string;
  heure_ouverture: string;
  heure_fin?: string;
  duree_minutes: number;
  nom_conseiller?: string;
  consignes?: string;
  url_audio?: string;
  gauge_soumis: boolean;
  nombre_evaluateurs_soumis: number;
  evaluateurs_soumis?: string[];
}

export interface SessionsActivesResponse {
  success: boolean;
  sessions: SessionInfo[];
  message?: string;
}

export interface CreerSessionResponse {
  success: boolean;
  session_id?: string;
  pin?: string;
  message?: string;
}

// ── Calibration / Evaluation ──────────────────────────────────────────────────

export interface VotePayload {
  evaluateur_id: string;
  nom?: string;
  note: string;
  commentaire?: string;
}

export interface ItemData {
  item_id: string;
  note_gauge: string;
  statut_calibrage: "vert" | "rouge";
  taux_divergence: number;
  seuil_variance_max: number;
  criticite?: "Critical" | "Standard";
  poids?: number;
  votes: VotePayload[];
}

export interface CategoryData {
  prioriteAffichage?: "critique" | "standard" | "aucun";
  [key: string]: ItemData | "critique" | "standard" | "aucun" | undefined;
}

export interface ItemPrioritaire {
  categorie: string;
  item_nom: string;
  item_id: string;
  taux_divergence: number;
  note_gauge: string;
  nombre_votes: number;
  criticite?: string;
}

export interface EvaluatorCalibrationDetail {
  conforme: boolean;
  variance: number;
  accuracy: number;
  items_compares: number;
  seuil_utilise: number;
  note_finale?: number;
  motif_echec?: string;
}

export interface CalibrationStats {
  moyenne_session_variance: number;
  evaluateurs_non_calibres: Array<{
    evaluateur_id: string;
    variance: number;
    accuracy: number;
  }>;
  details_par_evaluateur: Record<string, EvaluatorCalibrationDetail>;
  ecart_critique_notes?: {
    ecartCritique: boolean;
    aEchoueCritical: boolean;
    aReussiCritical: boolean;
  };
}

export interface CockpitVote {
  nom: string;
  critere: "Oui" | "Non" | "N.A." | string;
  commentaire: string;
}

export interface CockpitGauge {
  critere: "Oui" | "Non" | "N.A." | string;
  commentaire: string;
  nom: string;
}

export interface DecisionFinale {
  decision: "Oui" | "Non" | "N.A." | string;
  justification: string;
  animateur_id: string;
  timestamp: string;
}

export interface CockpitNode {
  item_id: string;
  niveau: number;
  libelle: string;
  criticite: "Critical" | "Standard";
  categorie_racine_fr: string;
  type_noeud: string;
  gauge: CockpitGauge | null;
  votes_par_critere: { Oui: CockpitVote[]; Non: CockpitVote[]; "N.A.": CockpitVote[] };
  total_votes: number;
  statut_accord: "accord" | "divergence" | "sans_votes" | "en_attente_gauge";
  decision_finale: DecisionFinale | null;
  children: CockpitNode[];
}

export interface SessionDataResponse {
  success: boolean;
  message?: string;
  session_id?: string;
  nom_session?: string;
  session_type?: "ALIGNEMENT" | "DISPUTE" | "HORS_SESSION";
  statut?: SessionStatut;
  url_audio?: string;
  heure_ouverture?: string;
  heure_fin?: string;
  duree_minutes?: number;
  countdown_restant_secondes?: number;
  calibration?: CalibrationStats;
  items_prioritaires?: ItemPrioritaire[];
  categories?: Record<string, CategoryData>;
  evaluateurs_soumis?: string[];
  evaluateurs_invites?: Array<{ identifiant: string; nom_complet: string; statut: string }>;
  // Nouveaux champs cockpit hiérarchique
  template_id?: string;
  nom_conseiller?: string;
  grille_hierarchique?: CockpitNode[];
}

// ── Templates ─────────────────────────────────────────────────────────────────

export interface TemplateItem {
  item_id: string;
  item_libelle: string;
  criticite: "Critical" | "Standard";
  poids?: number;
}

export interface TemplateCategory {
  categorie: string;
  items: TemplateItem[];
}

export interface Template {
  template_id: string;
  nom: string;
  categories: TemplateCategory[];
}

export interface TemplatesListResponse {
  success: boolean;
  templates?: Template[];   // optional: API may return undefined if sheet is empty
  message?: string;
}

export interface GrilleSessionResponse {
  success: boolean;
  grille: TemplateCategory[];
  message?: string;
}

// ── Calibration Payload ──────────────────────────────────────────────────────

export interface CalibrationPayload {
  session_id: string;
  evaluateur_id: string;
  categorie?: string;
  item?: string;
  statut?: string;
  commentaire?: string;
  est_gauge?: boolean;
  items?: Array<{
    item_id: string;
    categorie: string;
    item: string;
    statut: string;
    commentaire?: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER POST / GET HYBRIDE (CONTOURNEMENT DU 302 REDIRECT GAS)
// ═══════════════════════════════════════════════════════════════════════════════

async function callGAS(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<ApiResponse> {
  const isPostAction = [
    "importer_grille_complete",
    "soumettre_evaluation",
    "sauvegarder_template",
    "enregistrer_decision_finale",
    "enregistrer_decisions_batch",  // ← CRITIQUE: payload complexe (array items), doit passer en POST
  ].includes(action);

  const queryParams = new URLSearchParams({
    action,
    ...Object.entries(payload).reduce((acc, [k, v]) => {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        acc[k] = String(v);
      }
      return acc;
    }, {} as Record<string, string>),
  });

  const apiUrl = getApiUrl();
  const urlWithParams = `${apiUrl}?${queryParams.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s — Apps Script cold start can take 15-25s

  try {
    if (!isPostAction) {
      // Direct GET for simple read/query actions
      const response = await fetch(urlWithParams, { method: "GET", redirect: "follow", signal: controller.signal });
      clearTimeout(timeoutId);
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Réponse non-JSON du serveur (HTTP ${response.status}). Vérifiez le déploiement Web App.`);
      }
    } else {
      // POST for heavy payload submission
      const response = await fetch(urlWithParams, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...payload }),
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Réponse non-JSON du serveur (HTTP ${response.status}). Vérifiez le déploiement Web App.`);
      }
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        message: "Le serveur Apps Script met trop de temps à répondre (Délai dépassé). Veuillez cliquer à nouveau.",
      };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : "Erreur de connexion avec Google Apps Script.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS CLIENT API
// ═══════════════════════════════════════════════════════════════════════════════

export async function loginEvaluateur(identifiant: string): Promise<LoginResponse> {
  return callGAS("login", { identifiant }) as unknown as Promise<LoginResponse>;
}

export async function listerEvaluateurs(): Promise<ListerEvaluateursResponse> {
  return callGAS("lister_evaluateurs") as unknown as Promise<ListerEvaluateursResponse>;
}

export async function creerEvaluateur(identifiant: string, nomComplet: string): Promise<ApiResponse> {
  return callGAS("creer_evaluateur", { identifiant, nom_complet: nomComplet });
}

export async function proposerCalibrage(payload: {
  evaluateur_id: string;
  nom_session: string;
  template_id: string;
  heure_ouverture_proposee: string;
  heure_fermeture_proposee: string;
  duree_minutes?: number;
  nom_conseiller?: string;
  consignes?: string;
  url_audio?: string;
  items_gauge: Array<{
    item_id: string;
    categorie: string;
    item: string;
    statut: string;
    commentaire?: string;
  }>;
}): Promise<ApiResponse> {
  return callGAS("proposer_calibrage", payload as unknown as Record<string, unknown>);
}

export async function listerDemandesCalibrage(): Promise<DemandesListResponse> {
  return callGAS("lister_demandes_calibrage") as unknown as Promise<DemandesListResponse>;
}

export async function approuverDemandeCalibrage(
  demandeId: string,
  heureOuverture: string,
  heureFermeture: string,
  animateurId?: string
): Promise<CreerSessionResponse> {
  return callGAS("approuver_demande_calibrage", {
    demande_id: demandeId,
    heure_ouverture: heureOuverture,
    heure_fermeture: heureFermeture,
    animateur_id: animateurId || "",
  }) as unknown as Promise<CreerSessionResponse>;
}

export async function getSessionsActives(): Promise<SessionsActivesResponse> {
  return callGAS("sessions_actives") as unknown as Promise<SessionsActivesResponse>;
}

export async function getGrilleSession(sessionId: string): Promise<GrilleSessionResponse> {
  return callGAS("grille_session", { session_id: sessionId }) as unknown as Promise<GrilleSessionResponse>;
}

export async function getSessionData(sessionId: string): Promise<SessionDataResponse> {
  return callGAS("cockpit", { session_id: sessionId }) as unknown as Promise<SessionDataResponse>;
}

export async function getProfilEvaluateur(evaluateurId: string): Promise<{ success: boolean; data?: ProfilEvaluateur; message?: string }> {
  return callGAS("profil", { evaluateur_id: evaluateurId }) as unknown as Promise<{ success: boolean; data?: ProfilEvaluateur; message?: string }>;
}

export async function validerPin(sessionId: string | null, pin: string): Promise<ApiResponse> {
  return callGAS("valider_pin", { session_id: sessionId || "", pin });
}

export async function getConfigTemplate(templateId: string): Promise<{ success: boolean; items?: any[]; message?: string }> {
  return callGAS("get_config_template", { template_id: templateId }) as unknown as Promise<{ success: boolean; items?: any[]; message?: string }>;
}

export async function listerTemplates(): Promise<TemplatesListResponse> {
  const res = await callGAS("lister_templates") as unknown as TemplatesListResponse;
  // Ensure templates is always an array even if backend returns undefined/null
  return { ...res, templates: res.templates || [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Import grille complète depuis CSV/TSV
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportItem {
  item_id:                 string;
  parent_id:               string;
  niveau:                  number;  // 2 | 3 | 4
  type_noeud:              string;
  categorie_racine_fr:     string;
  libelle_fr:              string;
  criticite:               string;  // "Critical" | "Standard" | ""
  est_terminal:            boolean;
  commentaire_obligatoire: boolean;
  poids:                   number;
}

export interface ImportGrilleResponse {
  success:     boolean;
  template_id?: string;
  message?:    string;
  stats?: { n2: number; total_config: number };
}

export async function importerGrilleComplete(
  templateId: string,
  nom: string,
  items: ImportItem[]
): Promise<ImportGrilleResponse> {
  return callGAS("importer_grille_complete", {
    template_id: templateId,
    nom,
    items,
  }) as unknown as Promise<ImportGrilleResponse>;
}

export async function listerToutesSessions(): Promise<SessionsActivesResponse> {
  return callGAS("lister_sessions") as unknown as Promise<SessionsActivesResponse>;
}

export async function postCalibration(payload: CalibrationPayload): Promise<ApiResponse> {
  return callGAS("soumettre_evaluation", payload as unknown as Record<string, unknown>);
}

export async function creerSession(
  nomSession: string,
  templateId: string,
  heureOuverture: string,
  heureFermeture: string,
  animateurId?: string,
  gaugeId?: string,
  nomConseiller?: string,
  consignes?: string,
  urlAudio?: string
): Promise<CreerSessionResponse> {
  return callGAS("creer_session", {
    nom_session: nomSession,
    template_id: templateId,
    heure_ouverture: heureOuverture,
    heure_fermeture: heureFermeture,
    animateur_id: animateurId || "",
    gauge_id: gaugeId || "",
    nom_conseiller: nomConseiller || "",
    consignes: consignes || "",
    url_audio: urlAudio || "",
  }) as unknown as Promise<CreerSessionResponse>;
}

export async function sauvegarderTemplate(
  nom: string,
  categories: TemplateCategory[],
  templateId?: string
): Promise<ApiResponse> {
  return callGAS("sauvegarder_template", {
    template_id: templateId || "",
    nom,
    categories,
  });
}

export async function supprimerTemplate(templateId: string): Promise<ApiResponse> {
  return callGAS("supprimer_template", { template_id: templateId });
}

export async function forcerOuverture(sessionId: string): Promise<ApiResponse> {
  return callGAS("forcer_ouverture", { session_id: sessionId });
}

export async function validerHorsSession(
  sessionId: string,
  decision: "APPROUVE" | "REJETE",
  motif?: string
): Promise<ApiResponse> {
  return callGAS("valider_hors_session", {
    session_id: sessionId,
    decision_admin: decision,
    motif: motif || "",
  });
}

export async function enregistrerArbitrage(
  sessionId: string,
  categorie: string,
  itemNom: string,
  decisionArbitrage: "QTO" | "TL",
  nouvelleConsigne: string,
  animateurId: string
): Promise<ApiResponse> {
  return callGAS("enregistrer_arbitrage", {
    session_id: sessionId,
    categorie,
    item_nom: itemNom,
    decision_arbitrage: decisionArbitrage,
    nouvelle_consigne: nouvelleConsigne,
    animateur_id: animateurId,
  });
}

export async function cloturerSession(sessionId: string, animateurId: string, force = false): Promise<ApiResponse> {
  return callGAS("cloturer_session", {
    session_id: sessionId,
    animateur_id: animateurId,
    force,
  });
}

export async function enregistrerDecisionFinale(
  sessionId: string,
  itemId: string,
  decision: "Oui" | "Non" | "N.A.",
  justification: string,
  animateurId: string
): Promise<ApiResponse> {
  return callGAS("enregistrer_decision_finale", {
    session_id: sessionId,
    item_id: itemId,
    decision,
    justification,
    animateur_id: animateurId,
  });
}

export async function getRapportPdf(sessionId: string): Promise<ApiResponse> {
  return callGAS("get_rapport_pdf", {
    session_id: sessionId,
  });
}

export async function enregistrerDecisionsBatch(
  sessionId: string,
  items: Array<{ itemId: string; decision: "Oui" | "Non" | "N.A."; justification: string }>,
  animateurId: string
): Promise<ApiResponse> {
  return callGAS("enregistrer_decisions_batch", {
    session_id: sessionId,
    items: items.map((it) => ({
      item_id: it.itemId,
      decision: it.decision,
      justification: it.justification,
    })),
    animateur_id: animateurId,
  });
}

export async function reinitialiserArbitrages(sessionId: string): Promise<ApiResponse> {
  return callGAS("reinitialiser_arbitrages", {
    session_id: sessionId,
  });
}

