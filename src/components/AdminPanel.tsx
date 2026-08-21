import React, { useEffect, useState } from "react";
import {
  creerSession,
  listerToutesSessions,
  listerTemplates,
  listerEvaluateurs,
  listerDemandesCalibrage,
  approuverDemandeCalibrage,
  forcerOuverture,
  cloturerSession,
  reinitialiserArbitrages,
  getRapportPdf,
  supprimerTemplate,
  modifierRoleEvaluateur,
  supprimerSession,
  annulerDemandeCalibrage,
  supprimerEvaluateur,
  restaurerGrilleGeniiComplete,
  uploadAudioDrive,
  getApiUrl,
  setApiUrl,
  getSessionData,
  type SessionInfo,
  type Template,
  type ProfilEvaluateur,
  type DemandeCalibrageInfo,
  type SessionDataResponse,
} from "../lib/api";
import { TemplateStudioModal } from "./TemplateStudioModal";
import { ArbitrageReportModal } from "./ArbitrageReportModal";
import { CaliSyncLogo } from "./ui/CaliSyncLogo";
import {
  ShieldCheck,
  Activity,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Server,
  Info,
  Loader2,
  RefreshCw,
  Play,
  FileLock2,
  ArrowLeft,
  Users,
  Layers,
  ExternalLink,
  UserCheck,
  Award,
  Inbox,
  Calendar,
  FileText,
  RotateCcw,
  Trash2,
  LogOut,
  Sparkles,
  Zap,
  Check,
  Link,
  Upload,
  Headphones,
  Settings,
  AlertTriangle,
  Ban,
  X,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { getStoredAdminPin, setStoredAdminPin } from "./LoginScreen";

interface AdminPanelProps {
  identifiant: string;
  nomComplet: string;
  onBack: () => void;
  onOpenTemplateManager: () => void;
  onOpenCockpit: (sessionId: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  identifiant,
  nomComplet,
  onBack,
  onOpenTemplateManager,
  onOpenCockpit,
}) => {
  // ── Sessions & Proposals State ───────────────────────────────────────────────
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [demandes, setDemandes] = useState<DemandeCalibrageInfo[]>([]);
  const [demandesLoading, setDemandesLoading] = useState(true);
  void demandesLoading;
  const [actionFeedback, setActionFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<SessionInfo | null>(null);
  const [confirmKeyword, setConfirmKeyword] = useState("");

  // ── Tab System State ────────────────────────────────────────────────────────
  type AdminTab = "sessions" | "demandes" | "nouvelle_session" | "grilles" | "utilisateurs" | "systeme";
  const [activeTab, setActiveTab] = useState<AdminTab>("sessions");

  // ── Templates & Evaluators State ────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [evaluateurs, setEvaluateurs] = useState<ProfilEvaluateur[]>([]);

  // ── Create Session Form State ───────────────────────────────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionTemplate, setNewSessionTemplate] = useState("");
  const [newSessionAnimateur, setNewSessionAnimateur] = useState(identifiant);
  const [newSessionGauge, setNewSessionGauge] = useState(identifiant);
  const [newSessionConseiller, setNewSessionConseiller] = useState("");
  const [newSessionConsignes, setNewSessionConsignes] = useState("");

  const [newSessionCloseDate, setNewSessionCloseDate] = useState("");
  const [newSessionCloseTime, setNewSessionCloseTime] = useState("");
  const [adminPresetMinutes, setAdminPresetMinutes] = useState<number | null>(60);
  const [adminAudioTab, setAdminAudioTab] = useState<"link" | "file">("link");

  const applyAdminCloseDatePresetMinutes = (minutesToAdd: number) => {
    const target = new Date(Date.now() + minutesToAdd * 60 * 1000);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    const hh = String(target.getHours()).padStart(2, "0");
    const min = String(target.getMinutes()).padStart(2, "0");
    setNewSessionCloseDate(`${yyyy}-${mm}-${dd}`);
    setNewSessionCloseTime(`${hh}:${min}`);
  };

  useEffect(() => {
    applyAdminCloseDatePresetMinutes(60);
  }, []);

  const [newSessionAudio, setNewSessionAudio] = useState("");
  const [audioUploading, setAudioUploading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [apiConnectionError, setApiConnectionError] = useState<string | null>(null);
  const [editableApiUrl, setEditableApiUrl] = useState(getApiUrl());
  const [studioTemplate, setStudioTemplate] = useState<Template | null>(null);
  const [adminPinInput, setAdminPinInput] = useState(getStoredAdminPin());
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [selectedReportSessionData, setSelectedReportSessionData] = useState<SessionDataResponse | null>(null);
  const [loadingReportSessionId, setLoadingReportSessionId] = useState<string | null>(null);

  const handleOpenArbitrageGridReport = async (sessionId: string) => {
    setLoadingReportSessionId(sessionId);
    try {
      const res = await getSessionData(sessionId);
      if (res && res.success) {
        setSelectedReportSessionData(res);
      } else {
        setActionFeedback({ success: false, message: res?.message || "Impossible de charger les données d'arbitrage de cette session." });
      }
    } catch {
      setActionFeedback({ success: false, message: "Erreur réseau lors du chargement de la session." });
    } finally {
      setLoadingReportSessionId(null);
    }
  };

  const handleSaveAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = adminPinInput.trim().replace(/\D/g, "");
    if (cleanPin.length !== 4) {
      setActionFeedback({ success: false, message: "Le code PIN Administrateur doit comporter exactement 4 chiffres." });
      return;
    }
    setStoredAdminPin(cleanPin);
    setAdminPinInput(cleanPin);
    setActionFeedback({ success: true, message: `Code PIN Administrateur mis à jour avec succès : ${cleanPin}` });
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|ogg|aac|flac)$/i)) {
      setActionFeedback({ success: false, message: "Format audio non supporté (utilisez MP3, WAV, M4A, OGG)." });
      return;
    }

    setAudioUploading(true);
    setActionFeedback({ success: true, message: "Téléversement de l'audio vers Google Drive en cours..." });

    const reader = new FileReader();
    reader.onload = async () => {
      const resultStr = reader.result as string;
      const base64Data = resultStr.split(",")[1] || resultStr;
      const res = await uploadAudioDrive(base64Data, file.name, file.type);
      setAudioUploading(false);
      if (res && res.success && (res as any).url_audio) {
        setNewSessionAudio((res as any).url_audio);
        setActionFeedback({ success: true, message: "Audio téléversé avec succès sur Google Drive !" });
      } else {
        setActionFeedback({ success: false, message: res?.message || "Erreur lors de l'upload audio vers Google Drive." });
      }
    };
    reader.readAsDataURL(file);
  };

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const fetchSessions = async () => {
    setSessionsLoading(true);
    const res = await listerToutesSessions();
    setSessionsLoading(false);
    if (res && res.success && Array.isArray(res.sessions)) {
      setSessions(res.sessions);
      setApiConnectionError(null);
    } else {
      setSessions([]);
      if (res && !res.success && res.message) {
        setApiConnectionError(res.message);
      }
    }
  };

  const fetchDemandes = async () => {
    setDemandesLoading(true);
    const res = await listerDemandesCalibrage();
    setDemandesLoading(false);
    if (res && res.success && Array.isArray(res.demandes)) setDemandes(res.demandes);
    else setDemandes([]);
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    const res = await listerTemplates();
    setTemplatesLoading(false);
    if (res && res.success && Array.isArray(res.templates)) {
      setTemplates(res.templates);
      setApiConnectionError(null);
      if (res.templates.length > 0 && !newSessionTemplate) {
        setNewSessionTemplate(res.templates[0].template_id);
      }
    } else {
      setTemplates([]);
      if (res && !res.success && res.message && !apiConnectionError) {
        setApiConnectionError(res.message);
      }
    }
  };

  const fetchEvaluateurs = async () => {
    const res = await listerEvaluateurs();
    if (res && res.success && Array.isArray(res.evaluateurs)) {
      setEvaluateurs(res.evaluateurs);
    } else setEvaluateurs([]);
  };

  useEffect(() => {
    fetchSessions();
    fetchDemandes();
    fetchTemplates();
    fetchEvaluateurs();
    const interval = setInterval(() => {
      fetchSessions();
      fetchDemandes();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Create Session Handler ──────────────────────────────────────────────────
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName || !newSessionTemplate || !newSessionCloseDate || !newSessionCloseTime) {
      setActionFeedback({ success: false, message: "Veuillez remplir le nom de la session, le template et la date/heure de clôture." });
      return;
    }

    const now = new Date();
    const heureOuverture = now.toISOString();
    const heureFermeture = `${newSessionCloseDate}T${newSessionCloseTime}:00`;

    const nowMs = now.getTime();
    const closeMs = new Date(heureFermeture).getTime();

    if (closeMs <= nowMs) {
      setActionFeedback({ success: false, message: "La date et l'heure de clôture doivent être dans le futur." });
      return;
    }

    if (closeMs - nowMs > 72 * 60 * 60 * 1000) {
      setActionFeedback({ success: false, message: "La date et l'heure de clôture ne doivent pas dépasser 72 heures à partir de maintenant." });
      return;
    }

    setCreateLoading(true);
    setActionFeedback(null);

    const res = await creerSession(
      newSessionName,
      newSessionTemplate,
      heureOuverture,
      heureFermeture,
      newSessionAnimateur,
      newSessionGauge,
      newSessionConseiller,
      newSessionConsignes,
      newSessionAudio
    );

    setCreateLoading(false);

    if (res.success) {
      setActionFeedback({
        success: true,
        message: `Session "${newSessionName}" créée avec succès !`,
      });
      fetchSessions();
    } else {
      setActionFeedback({
        success: false,
        message: res.message || "Erreur lors de la création de la session.",
      });
    }
  };

  const handleApproveProposal = async (demande: DemandeCalibrageInfo) => {
    if (!demande.gauge_items_count || demande.gauge_items_count === 0) {
      const confirmLaunch = window.confirm(
        `⚠️ Attention : Aucun item de référence Gauge n'a été enregistré pour la demande "${demande.nom_session}".\n\nSouhaitez-vous quand même approuver et programmer cette session ?`
      );
      if (!confirmLaunch) return;
    }

    setActionLoadingId(demande.demande_id);
    const res = await approuverDemandeCalibrage(
      demande.demande_id,
      demande.heure_ouverture_proposee,
      demande.heure_fermeture_proposee,
      demande.evaluateur_id || identifiant
    );
    setActionLoadingId(null);

    if (res.success) {
      setActionFeedback({
        success: true,
        message: `Demande "${demande.nom_session}" approuvée & programmée avec succès !`,
      });
      fetchSessions();
      fetchDemandes();
    } else {
      setActionFeedback({ success: false, message: res.message || "Erreur lors de l'approbation." });
    }
  };

  // ── Cancel / Reject Calibration Request ────────────────────────────────────
  const handleCancelDemande = async (demande: DemandeCalibrageInfo) => {
    if (!window.confirm(`Voulez-vous vraiment annuler la demande de calibrage "${demande.nom_session}" de ${demande.evaluateur_id} ?`)) {
      return;
    }
    // Optimistic UI update
    setDemandes((prev) => prev.filter((d) => d.demande_id !== demande.demande_id));
    setActionLoadingId(demande.demande_id);
    const res = await annulerDemandeCalibrage(demande.demande_id);
    setActionLoadingId(null);
    if (res.success) {
      setActionFeedback({ success: true, message: `Demande "${demande.nom_session}" annulée avec succès.` });
      fetchDemandes();
    } else {
      setActionFeedback({ success: false, message: res.message || "Erreur lors de l'annulation de la demande." });
      fetchDemandes();
    }
  };

  // ── Delete Session Handler (with security dialog for ongoing sessions) ─────
  const handleDeleteSessionRequest = (session: SessionInfo) => {
    const isOngoing = session.statut === "OPEN" || session.statut === "PENDING_GAUGE" || session.statut === "GAUGE_DONE";
    if (isOngoing) {
      setSessionToDelete(session);
      setConfirmKeyword("");
    } else {
      if (window.confirm(`Confirmez-vous la suppression définitive de la session archivée "${session.nom_session || session.session_id}" ?\n\nCette action effacera toutes les évaluations, notes et données associées.`)) {
        executeDeleteSession(session.session_id, session.nom_session || session.session_id);
      }
    }
  };

  const executeDeleteSession = async (sessionId: string, sessionName: string) => {
    // Optimistic UI update: Remove session immediately from state and close modal
    setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    setSessionToDelete(null);
    setConfirmKeyword("");
    setActionLoadingId(sessionId);

    const res = await supprimerSession(sessionId);
    setActionLoadingId(null);
    if (res.success) {
      setActionFeedback({ success: true, message: `Session "${sessionName}" supprimée définitivement.` });
      fetchSessions();
    } else {
      setActionFeedback({ success: false, message: res.message || "Erreur lors de la suppression de la session." });
      fetchSessions();
    }
  };

  // ── Delete Evaluator / User ────────────────────────────────────────────────
  const handleDeleteEvaluateur = async (user: ProfilEvaluateur) => {
    if (user.identifiant === identifiant) {
      alert("Action impossible : Vous ne pouvez pas supprimer votre propre compte administrateur actuellement connecté.");
      return;
    }
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.nom_complet}" (@${user.identifiant}) ?\n\nCette action retirera ses accès à l'application.`)) {
      return;
    }
    // Optimistic UI update
    setEvaluateurs((prev) => prev.filter((e) => e.identifiant !== user.identifiant));
    setActionLoadingId(user.identifiant);
    const res = await supprimerEvaluateur(user.identifiant);
    setActionLoadingId(null);
    if (res.success) {
      setActionFeedback({ success: true, message: `Utilisateur @${user.identifiant} (${user.nom_complet}) supprimé.` });
      fetchEvaluateurs();
    } else {
      setActionFeedback({ success: false, message: res.message || "Erreur lors de la suppression de l'utilisateur." });
      fetchEvaluateurs();
    }
  };

  // ── Force Open Session ──────────────────────────────────────────────────────
  const handleForceOpen = async (sessionId: string) => {
    setActionLoadingId(sessionId);
    const res = await forcerOuverture(sessionId);
    setActionLoadingId(null);

    if (res.success) {
      setActionFeedback({ success: true, message: `Session ${sessionId} ouverte manuellement.` });
      fetchSessions();
    } else {
      setActionFeedback({ success: false, message: res.message || "Erreur." });
    }
  };

  const handleDeleteTemplate = async (templateId: string, templateNom: string) => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement le template "${templateNom}" (${templateId}) ?\nCette action est irréversible.`
      )
    ) {
      return;
    }
    setActionLoadingId(templateId);
    try {
      const res = await supprimerTemplate(templateId);
      if (res.success) {
        setActionFeedback({ success: true, message: `Template "${templateNom}" supprimé avec succès.` });
        fetchTemplates();
      } else {
        setActionFeedback({ success: false, message: res.message || "Erreur lors de la suppression." });
      }
    } catch (e) {
      setActionFeedback({ success: false, message: "Erreur lors de la suppression du template." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRestoreGeniiOfficial = async () => {
    if (
      !window.confirm(
        "Restaurer la Grille Officielle Genii Complète (100% - 10/10 Questions Process Adherence) ?\n\nCette action va créer ou mettre à jour le template officiel avec les 4 catégories, 10 questions de Process, et 73 sous-critères."
      )
    ) {
      return;
    }
    setActionLoadingId("restore_genii_official");
    try {
      const res = await restaurerGrilleGeniiComplete();
      if (res.success) {
        setActionFeedback({ success: true, message: res.message || "Grille Genii Complète restaurée avec succès !" });
        fetchTemplates();
      } else {
        setActionFeedback({ success: false, message: res.message || "Erreur lors de la restauration." });
      }
    } catch {
      setActionFeedback({ success: false, message: "Erreur lors de la restauration de la grille." });
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Close Session ───────────────────────────────────────────────────────────
  const handleCloseSession = async (sessionId: string) => {
    setActionLoadingId(sessionId);
    const res = await cloturerSession(sessionId, identifiant);
    setActionLoadingId(null);

    if (res.success) {
      setActionFeedback({ success: true, message: `Session ${sessionId} clôturée. Rapport PDF généré.` });
      fetchSessions();
    } else {
      setActionFeedback({ success: false, message: res.message || "Erreur." });
    }
  };

  // ── Reset Arbitrages ────────────────────────────────────────────────────────
  const handleResetArbitrages = async (sessionId: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir réinitialiser TOUS les arbitrages enregistrés pour la session ${sessionId} ?\n\nCette action va effacer les décisions d'arbitrage actuelles pour vous permettre de recommencer l'arbitrage.`)) return;

    setActionLoadingId(sessionId);
    const res = await reinitialiserArbitrages(sessionId);
    setActionLoadingId(null);

    if (res.success) {
      setActionFeedback({ success: true, message: res.message || `Arbitrages de la session ${sessionId} réinitialisés.` });
      fetchSessions();
    } else {
      setActionFeedback({ success: false, message: res.message || "Erreur lors de la réinitialisation." });
    }
  };

  const handleDownloadPdfForSession = async (sessionId: string) => {
    setActionLoadingId(sessionId);
    const targetWindow = window.open("", "_blank");
    if (targetWindow) {
      targetWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Génération du Rapport PDF — CaliSync</title>
            <meta charset="utf-8">
            <style>
              body { background-color: #0b0f19; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { background: #1e293b; padding: 40px; border-radius: 24px; border: 1px solid #334155; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
              .spinner { border: 4px solid #334155; border-top: 4px solid #6366f1; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px auto; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              h2 { color: #f8fafc; font-size: 20px; margin-bottom: 8px; font-weight: 800; }
              p { color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="spinner"></div>
              <h2>📄 Génération du Rapport PDF en cours</h2>
              <p>Le document est en cours de création et d'export dans Google Drive pour la session ${sessionId}.<br>Redirection automatique dans quelques secondes...</p>
            </div>
          </body>
        </html>
      `);
    }

    try {
      const res = await getRapportPdf(sessionId);
      if (res && res.success && (res as any).pdf_url) {
        const url = (res as any).pdf_url;
        if (targetWindow) {
          targetWindow.location.href = url;
        } else {
          window.open(url, "_blank");
        }
        setActionFeedback({ success: true, message: `Rapport PDF ouvert dans un nouvel onglet pour la session ${sessionId}.` });
      } else {
        const errMsg = res?.message || "Erreur lors de la génération du rapport PDF.";
        if (targetWindow) {
          targetWindow.document.body.innerHTML = `
            <div class="card" style="border-color: #f43f5e;">
              <h2 style="color: #f43f5e;">⚠️ Rapport PDF Indisponible</h2>
            <div class="card" style="border-color: #fda4af;">
              <h2 style="color: #e11d48;">⚠️ Rapport PDF Indisponible</h2>
              <p style="color: #475569; margin-bottom: 12px;">${errMsg}</p>
              <p style="font-size: 11px; color: #94a3b8;">Veuillez vous assurer d'avoir copié le code de <strong>Code_v17.gs</strong> dans Apps Script et exécuté la fonction <code>autoriserGoogleDocsPermissions</code> une fois.</p>
            </div>
          `;
        }
        setActionFeedback({ success: false, message: errMsg });
      }
    } catch {
      if (targetWindow) {
        targetWindow.document.body.innerHTML = `
          <div class="card" style="border-color: #fda4af;">
            <h2 style="color: #e11d48;">⚠️ Erreur Réseau</h2>
            <p style="color: #475569;">Impossible de contacter Google Apps Script.</p>
          </div>
        `;
      }
      setActionFeedback({ success: false, message: "Erreur lors de la récupération du rapport PDF." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setApiUrl(editableApiUrl);
    setApiConnectionError(null);
    setActionFeedback({ success: true, message: "URL API mise à jour ! Test de connexion en cours..." });
    fetchSessions();
    fetchTemplates();
    fetchDemandes();
    fetchEvaluateurs();
  };

  const getStatusBadge = (statut: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      PENDING_GAUGE: { bg: "bg-indigo-500/10 border-indigo-500/30", text: "text-indigo-400", label: "Attente Gauge" },
      GAUGE_DONE: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400", label: "Gauge OK" },
      OPEN: { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400", label: "Ouverte" },
      LOCKED: { bg: "bg-rose-500/10 border-rose-500/30", text: "text-rose-400", label: "Verrouillée" },
      CLOSED: { bg: "bg-slate-800 border-slate-700", text: "text-slate-400", label: "Clôturée" },
    };
    const s = map[statut] || map["CLOSED"];
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors cursor-pointer flex-shrink-0"
              title="Retour à l'accueil"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <CaliSyncLogo size="md" showText={true} showBadge={true} badgeText="Admin" />

            <div className="h-6 w-px bg-slate-200 hidden md:block" />

            <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-2xl">
              <div className="w-7 h-7 rounded-xl bg-slate-900 text-[#1dc4ff] font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 truncate">
                  <span>Console Administration</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium truncate">
                  Admin : <strong className="text-slate-800">{nomComplet}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-nowrap flex-shrink-0">
            <button
              onClick={() => {
                setShowCreateForm(true);
                setActiveTab("nouvelle_session");
              }}
              className="px-3.5 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 text-xs font-black rounded-xl transition-all shadow-md shadow-[#1dc4ff]/20 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Créer Session</span>
            </button>

            <button
              onClick={() => {
                fetchSessions();
                fetchDemandes();
              }}
              disabled={sessionsLoading}
              className="p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs text-slate-700 font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 flex-shrink-0"
              title="Actualiser"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>

            <button
              onClick={onBack}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap flex-shrink-0"
              title="Se déconnecter"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Action Feedback Toast */}
      {apiConnectionError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs sm:text-sm">
              <div className="font-bold text-rose-700">⚠️ Erreur de connexion avec Google Apps Script</div>
              <div>{apiConnectionError}</div>
              <div className="text-slate-600 font-normal">
                L'URL Web App configurée retourne une erreur HTML (ex: "Page introuvable"). Cela se produit lorsque le script Google Apps Script n'est pas déployé en <strong>Application Web</strong> ou si une nouvelle URL a été générée.
                Veuillez vérifier votre déploiement dans Apps Script (<em>Exécuter en tant que : Moi</em>, <em>Accès : Tout le monde</em>) et saisir la nouvelle URL au bas de cette page.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Feedback Toast */}
          {actionFeedback && (
            <div
              className={`p-4 rounded-xl flex items-center gap-3 border ${
                actionFeedback.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              {actionFeedback.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{actionFeedback.message}</span>
            </div>
          )}

          {/* ── KPI Metric Cards Dashboard ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Sessions Total</span>
                <Activity className="w-4 h-4 text-[#1dc4ff]" />
              </div>
              <div className="text-2xl font-black text-slate-900">{sessions.length}</div>
              <p className="text-[11px] text-slate-500 font-medium">Historique complet</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Sessions Actives</span>
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600">
                {sessions.filter((s) => s.statut === "OPEN" || s.statut === "GAUGE_DONE" || s.statut === "PENDING_GAUGE").length}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">En cours d'évaluation</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Demandes Attente</span>
                <Inbox className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600">{demandes.length}</div>
              <p className="text-[11px] text-slate-500 font-medium">À valider par l'admin</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Évaluateurs & Templates</span>
                <Users className="w-4 h-4 text-[#1dc4ff]" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {evaluateurs.length} <span className="text-xs font-normal text-slate-500">/ {templates.length} tpl</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Profils & Grilles</p>
            </div>
          </div>

          {/* ── TABS SYSTEM ── */}
          <div className="flex border-b border-slate-200 gap-1 pb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab("sessions")}
              className={`px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "sessions"
                  ? "border-[#1dc4ff] text-[#009ae5] font-black"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              <Activity className="w-4.5 h-4.5" />
              Sessions & Supervision ({sessions.length})
            </button>

            {demandes.length > 0 && (
              <button
                onClick={() => setActiveTab("demandes")}
                className={`px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeTab === "demandes"
                    ? "border-amber-500 text-amber-600 font-black"
                    : "border-transparent text-amber-500 hover:text-amber-700"
                }`}
              >
                <Inbox className="w-4.5 h-4.5" />
                Demandes en attente
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                  {demandes.length}
                </span>
              </button>
            )}

            <button
              onClick={() => {
                setShowCreateForm(true);
                setActiveTab("nouvelle_session");
              }}
              className={`px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "nouvelle_session"
                  ? "border-[#1dc4ff] text-[#009ae5] font-black"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              <Plus className="w-4.5 h-4.5" />
              Créer une Session
            </button>

            <button
              onClick={() => setActiveTab("grilles")}
              className={`px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "grilles"
                  ? "border-[#1dc4ff] text-[#009ae5] font-black"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              <Layers className="w-4.5 h-4.5" />
              Grilles d'Évaluation ({templates.length})
            </button>

            <button
              onClick={() => setActiveTab("utilisateurs")}
              className={`px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "utilisateurs"
                  ? "border-[#1dc4ff] text-[#009ae5] font-black"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              <Users className="w-4.5 h-4.5" />
              Évaluateurs & Rôles ({evaluateurs.length})
            </button>

            <button
              onClick={() => setActiveTab("systeme")}
              className={`px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "systeme"
                  ? "border-[#1dc4ff] text-[#009ae5] font-black"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              <Settings className="w-4.5 h-4.5" />
              Paramètres & API
            </button>
          </div>

          {/* ── Section 0: Demandes de Calibrage en Attente ──────────────────── */}
          {demandes.length > 0 && (activeTab === "demandes" || activeTab === "sessions") && (
            <section className="bg-white rounded-2xl p-6 sm:p-8 space-y-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <Inbox className="w-5 h-5 text-[#1dc4ff]" /> Demandes de Calibrage en Attente
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#1dc4ff]/10 text-[#009ae5] border border-[#1dc4ff]/30">
                  {demandes.length} demande(s)
                </span>
              </div>

              <div className="space-y-4">
                {demandes.map((d) => (
                  <div
                    key={d.demande_id}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-extrabold text-slate-900 text-base">{d.nom_session}</div>
                        <div className="text-xs text-slate-500">
                          Demandeur : <strong className="text-[#1dc4ff]">{d.evaluateur_id}</strong>
                          {d.nom_conseiller && ` • Conseiller : ${d.nom_conseiller}`}
                          {` • Template : ${d.template_id}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-[#1dc4ff]" />
                        <span>
                          Plage :{" "}
                          <strong className="text-slate-900">
                            {new Date(d.heure_ouverture_proposee).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                            {" ➔ "}
                            {new Date(d.heure_fermeture_proposee).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {d.consignes && (
                      <div className="text-xs text-slate-600 bg-slate-100 p-2.5 rounded-xl border border-slate-200 italic">
                        "{d.consignes}"
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        {d.gauge_items_count && d.gauge_items_count > 0 ? (
                          <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs">
                            <Award className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Jauge Gauge : {d.gauge_items_count} item(s) pré-rempli(s) ✓</span>
                          </span>
                        ) : (
                          <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Jauge Gauge : 0 item (Non pré-remplie)</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCancelDemande(d)}
                          disabled={actionLoadingId === d.demande_id}
                          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" /> Annuler la demande
                        </button>

                        <button
                          onClick={() => handleApproveProposal(d)}
                          disabled={actionLoadingId === d.demande_id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {actionLoadingId === d.demande_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" /> Valider & Programmer
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Section 1: Créer une session ─────────────────────────────────── */}
          {activeTab === "nouvelle_session" && (
            <section className="bg-white rounded-3xl p-6 sm:p-7 space-y-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1dc4ff]/10 border border-[#1dc4ff]/20 flex items-center justify-center text-[#009ae5] flex-shrink-0">
                  <Plus className="w-5 h-5 text-[#1dc4ff]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    Nouvelle Session de Calibrage
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Configurez et lancez une nouvelle session en direct
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#1dc4ff]/20"
              >
                <Plus className="w-3.5 h-3.5" />
                {showCreateForm ? "Masquer le formulaire" : "Ouvrir le formulaire"}
              </button>
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreateSession} className="space-y-4 pt-1">
                {/* CARD 1: INFORMATIONS SESSION & TEMPLATE */}
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Nom de la session <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
                            const selectedTpl = templates.find((t) => t.template_id === newSessionTemplate);
                            setNewSessionName(`Calibrage ${selectedTpl?.nom || "Qualité"} — ${today}`);
                          }}
                          className="text-[10px] font-bold text-[#0077aa] hover:text-[#1dc4ff] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> Auto-nommer
                        </button>
                      </div>
                      <input
                        type="text"
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        placeholder="ex: Calibrage Qualité S32"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-medium"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Template de grille <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={onOpenTemplateManager}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Layers className="w-3 h-3 text-[#1dc4ff]" /> Gérer les templates
                        </button>
                      </div>
                      <select
                        value={newSessionTemplate}
                        onChange={(e) => setNewSessionTemplate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-medium"
                        required
                      >
                        <option value="">Sélectionner un template…</option>
                        {templates.map((t) => (
                          <option key={t.template_id} value={t.template_id}>
                            {t.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#1dc4ff]" />
                        Connection ID (ID de Communication)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const dd = String(now.getDate()).padStart(2, "0");
                          const mmm = now.toLocaleDateString("fr-FR", { month: "short" });
                          const yyyy = now.getFullYear();
                          const hh = String(now.getHours()).padStart(2, "0");
                          const min = String(now.getMinutes()).padStart(2, "0");
                          setNewSessionConseiller(`221770000000|${dd}${mmm}${yyyy}|${hh}h${min}`);
                        }}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        Insérer format exemple
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newSessionConseiller}
                      onChange={(e) => setNewSessionConseiller(e.target.value)}
                      placeholder="ex: 221770680391|07Aoû2026|10h44"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-mono font-medium"
                    />
                  </div>
                </div>

                {/* CARD 2: SUPPORT AUDIO */}
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Headphones className="w-3.5 h-3.5 text-[#1dc4ff]" /> Support Audio de la Session
                    </span>

                    {/* Sub-tabs Selector */}
                    <div className="flex items-center p-0.5 bg-slate-200/70 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setAdminAudioTab("link")}
                        className={`py-1 px-2.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          adminAudioTab === "link"
                            ? "bg-white text-slate-900 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Link className="w-3 h-3" /> Lien Drive / Web
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminAudioTab("file")}
                        className={`py-1 px-2.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          adminAudioTab === "file"
                            ? "bg-white text-slate-900 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <Upload className="w-3 h-3" /> Fichier local
                      </button>
                    </div>
                  </div>

                  {adminAudioTab === "link" ? (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <input
                          type="url"
                          value={newSessionAudio}
                          onChange={(e) => setNewSessionAudio(e.target.value)}
                          placeholder="Collez le lien Google Drive ou l'URL .mp3 de l'audio..."
                          className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 text-xs font-medium"
                        />
                        {navigator.clipboard && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const text = await navigator.clipboard.readText();
                                if (text) setNewSessionAudio(text.trim());
                              } catch (_) {}
                            }}
                            className="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            Coller
                          </button>
                        )}
                      </div>
                      {newSessionAudio && (
                        <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5 pt-0.5">
                          <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          <span className="truncate">Lien configuré : {newSessionAudio}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {newSessionAudio ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-emerald-800">Fichier audio importé</div>
                              <div className="text-[10px] text-slate-600 font-mono truncate">{newSessionAudio}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewSessionAudio("")}
                            className="text-xs text-rose-600 hover:underline font-bold ml-2 flex-shrink-0 cursor-pointer"
                          >
                            Changer
                          </button>
                        </div>
                      ) : (
                        <label className="border border-dashed border-slate-300 hover:border-[#1dc4ff] hover:bg-[#1dc4ff]/5 rounded-xl p-3 cursor-pointer text-center transition-all flex items-center justify-center gap-2 group bg-white">
                          <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#1dc4ff] transition-colors" />
                          <span className="text-xs font-bold text-slate-700">
                            {audioUploading ? "Importation vers Drive..." : "Sélectionner un fichier audio (MP3, WAV, M4A)"}
                          </span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleAudioFileUpload}
                            className="hidden"
                            disabled={audioUploading}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {/* CARD 3: ANIMATEUR & GAUGE */}
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-[#1dc4ff]" />
                          Évaluateur Gauge (Référence)
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">Définit l'animateur par défaut</span>
                      </label>
                      <select
                        value={newSessionGauge}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewSessionGauge(val);
                          setNewSessionAnimateur(val);
                        }}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-medium"
                      >
                        <option value={identifiant}>Moi ({nomComplet})</option>
                        {evaluateurs
                          .filter((ev) => ev.identifiant !== identifiant)
                          .map((ev) => (
                            <option key={ev.identifiant} value={ev.identifiant}>
                              {ev.nom_complet} ({ev.identifiant})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-[#1dc4ff]" />
                          Animateur (Arbitre Cockpit)
                        </span>
                        <span className="text-[10px] text-[#0077aa] font-bold">Gauge par défaut</span>
                      </label>
                      <select
                        value={newSessionAnimateur}
                        onChange={(e) => setNewSessionAnimateur(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-medium"
                      >
                        {newSessionGauge && newSessionGauge !== identifiant && (
                          <option value={newSessionGauge}>
                            Gauge ({newSessionGauge}) [Par défaut]
                          </option>
                        )}
                        <option value={identifiant}>Moi — Admin ({nomComplet})</option>
                        {evaluateurs
                          .filter((ev) => ev.identifiant !== identifiant && ev.identifiant !== newSessionGauge)
                          .map((ev) => (
                            <option key={ev.identifiant} value={ev.identifiant}>
                              {ev.nom_complet} ({ev.identifiant})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* CARD 4: DÉLAI DE CLÔTURE */}
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#1dc4ff]" /> Clôture de la session <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-slate-500">
                      Max 72h de délai
                    </span>
                  </div>

                  {/* Presets Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Dans 15 min", minutes: 15 },
                      { label: "Dans 30 min", minutes: 30 },
                      { label: "Dans 1h", minutes: 60 },
                      { label: "Dans 24h", minutes: 24 * 60 },
                    ].map((p) => {
                      const isSelected = adminPresetMinutes === p.minutes;
                      return (
                        <button
                          key={p.minutes}
                          type="button"
                          onClick={() => {
                            setAdminPresetMinutes(p.minutes);
                            applyAdminCloseDatePresetMinutes(p.minutes);
                          }}
                          className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                            isSelected
                              ? "bg-[#1dc4ff] text-slate-950 border-[#1dc4ff] font-black shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <Zap className={`w-3 h-3 ${isSelected ? "text-slate-950" : "text-amber-500"}`} />
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Date de Clôture
                      </label>
                      <input
                        type="date"
                        value={newSessionCloseDate}
                        onChange={(e) => {
                          setNewSessionCloseDate(e.target.value);
                          setAdminPresetMinutes(null);
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#1dc4ff] text-xs font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Heure de Clôture
                      </label>
                      <input
                        type="time"
                        value={newSessionCloseTime}
                        onChange={(e) => {
                          setNewSessionCloseTime(e.target.value);
                          setAdminPresetMinutes(null);
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#1dc4ff] text-xs font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* CARD 5: CONSIGNES */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Consignes / Notes complémentaires (facultatif)
                  </label>
                  <textarea
                    rows={2}
                    value={newSessionConsignes}
                    onChange={(e) => setNewSessionConsignes(e.target.value)}
                    placeholder="ex: Vérification stricte des éléments de sécurité DPA."
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] transition-all text-xs font-medium resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="w-full py-3.5 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black rounded-xl shadow-md shadow-[#1dc4ff]/20 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
                  >
                    {createLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5" /> Créer & Lancer la Session
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </section>
          )}

          {/* ── Section 2: Sessions en cours ──────────────────────────────────── */}
          {activeTab === "sessions" && (
          <section className="bg-white rounded-2xl p-6 sm:p-8 space-y-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Clock className="w-5 h-5 text-[#1dc4ff]" /> Sessions en Cours
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {sessions.length} session(s)
              </span>
            </div>

            {sessionsLoading && sessions.length === 0 && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-8 h-8 text-[#1dc4ff] animate-spin" />
              </div>
            )}

            {sessions.length === 0 && !sessionsLoading && (
              <div className="text-center py-10 text-slate-500 text-sm">
                Aucune session créée. Utilisez le formulaire ci-dessus.
              </div>
            )}

            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.session_id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {session.nom_session || session.session_id}
                        </span>
                        {getStatusBadge(session.statut)}
                        {session.gauge_soumis && (
                          <span className="text-xs text-emerald-600 font-bold">✓ Gauge</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        ID: <strong className="font-mono text-slate-700">{session.session_id}</strong> • Template: <strong className="text-slate-700">{session.template_id}</strong>
                        {session.animateur_id && ` • Animateur: ${session.animateur_id}`}
                        {session.gauge_id && ` • Gauge: ${session.gauge_id}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-bold text-slate-900">{session.nombre_evaluateurs_soumis}</span> soumis
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    {(session.statut === "PENDING_GAUGE" || session.statut === "GAUGE_DONE") && (
                      <button
                        onClick={() => handleForceOpen(session.session_id)}
                        disabled={actionLoadingId === session.session_id}
                        className="px-3 py-1.5 bg-[#1dc4ff]/10 border border-[#1dc4ff]/30 text-[#009ae5] text-xs font-bold rounded-lg hover:bg-[#1dc4ff]/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoadingId === session.session_id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        Forcer l'ouverture
                      </button>
                    )}

                    {(session.statut === "OPEN" || session.statut === "LOCKED") && (
                      <>
                        <button
                          onClick={() => onOpenCockpit && onOpenCockpit(session.session_id)}
                          className="px-3 py-1.5 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Activity className="w-3.5 h-3.5" /> Cockpit Live
                        </button>
                        <button
                          onClick={() => handleResetArbitrages(session.session_id)}
                          disabled={actionLoadingId === session.session_id}
                          className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-xl hover:bg-amber-100 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          title="Effacer tous les arbitrages enregistrés pour cette session"
                        >
                          {actionLoadingId === session.session_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          Réinitialiser Arbitrages
                        </button>
                        <button
                          onClick={() => handleCloseSession(session.session_id)}
                          disabled={actionLoadingId === session.session_id}
                          className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl hover:bg-rose-100 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {actionLoadingId === session.session_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileLock2 className="w-3.5 h-3.5" />
                          )}
                          Clôturer
                        </button>
                      </>
                    )}

                    {session.statut === "CLOSED" && (
                      <>
                        <button
                          onClick={() => handleOpenArbitrageGridReport(session.session_id)}
                          disabled={loadingReportSessionId === session.session_id}
                          className="px-3 py-1.5 bg-[#1dc4ff]/15 border border-[#1dc4ff]/30 text-[#0077aa] text-xs font-black rounded-xl hover:bg-[#1dc4ff]/25 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                          title="Ouvrir la Grille d'Arbitrage au format PDF A4 (Instantané)"
                        >
                          {loadingReportSessionId === session.session_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0077aa]" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-[#0077aa]" />
                          )}
                          Grille Arbitrage PDF 📄
                        </button>

                        <button
                          onClick={() => handleDownloadPdfForSession(session.session_id)}
                          disabled={actionLoadingId === session.session_id}
                          className="px-3 py-1.5 bg-[#0f172a] text-white text-xs font-bold rounded-xl hover:bg-[#1e293b] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                          title="Ouvrir ou Générer le Rapport PDF de cette session (Google Drive)"
                        >
                          {actionLoadingId === session.session_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                          Rapport Complet (Drive)
                        </button>

                        <button
                          onClick={() => onOpenCockpit && onOpenCockpit(session.session_id)}
                          className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                          title="Consulter le cockpit archivé en lecture seule"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" /> Consulter Cockpit
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDeleteSessionRequest(session)}
                      disabled={actionLoadingId === session.session_id}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition-all cursor-pointer disabled:opacity-50 ml-auto"
                      title="Supprimer définitivement cette session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          {/* ── Section 3: Gestion Templates ─────────────────────────────────── */}
          {activeTab === "grilles" && (
          <section className="bg-white rounded-2xl p-6 sm:p-8 space-y-6 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Layers className="w-5 h-5 text-[#1dc4ff]" /> Templates de Grilles d'Évaluation
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRestoreGeniiOfficial}
                  disabled={actionLoadingId === "restore_genii_official"}
                  className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Restaurer la grille officielle Genii avec toutes les 10 questions de Process Adherence"
                >
                  {actionLoadingId === "restore_genii_official" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  ⚡ Restaurer Grille Genii Complète (10/10 Process)
                </button>
                <button
                  onClick={onOpenTemplateManager}
                  className="px-4 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#1dc4ff]/20"
                >
                  <Layers className="w-3.5 h-3.5" /> Studio de Grilles
                </button>
              </div>
            </div>

            {templatesLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 text-[#1dc4ff] animate-spin" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => {
                const totalQuestions = (t.categories || []).reduce((acc, c) => acc + (c.items?.length || 0), 0);
                const hasProcess = (t.categories || []).some(c => c.categorie.toLowerCase().includes("process"));
                return (
                <div key={t.template_id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-extrabold text-slate-900 text-sm">{t.nom}</div>
                      <div className="text-xs text-slate-500 font-mono">{t.template_id}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 flex-wrap">
                    <span className="bg-slate-200/80 px-2 py-0.5 rounded-md">
                      {(t.categories || []).length} catégorie(s)
                    </span>
                    <span className="bg-slate-200/80 px-2 py-0.5 rounded-md">
                      {totalQuestions} question(s)
                    </span>
                    {hasProcess && (
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md text-[10px]">
                        ✓ Process Adherence
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => setStudioTemplate(t)}
                      className="text-[#009ae5] hover:text-[#0077aa] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Configurer
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.template_id, t.nom)}
                      disabled={actionLoadingId === t.template_id}
                      className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </section>
          )}

          {/* ── Section 4: Utilisateurs & Rôles ──────────────────────────────── */}
          {activeTab === "utilisateurs" && (
          <section className="bg-white rounded-2xl p-6 sm:p-8 space-y-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Users className="w-5 h-5 text-[#1dc4ff]" /> Registre des Utilisateurs & Rôles
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {evaluateurs.length} utilisateur(s)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {evaluateurs.map((user) => {
                const currentRole = user.role || (user.identifiant === "admin" || user.identifiant === "oumar.toure" ? "admin" : "evaluateur");
                return (
                  <div key={user.identifiant} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-extrabold text-slate-900 text-sm">{user.nom_complet}</div>
                        <div className="text-xs text-slate-500 font-mono">@{user.identifiant}</div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                        currentRole === "admin" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        currentRole === "animateur" ? "bg-[#1dc4ff]/10 text-[#009ae5] border-[#1dc4ff]/30" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {currentRole.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span>Sessions : <strong className="text-slate-900">{user.nombre_sessions || 0}</strong></span>
                        {user.identifiant !== identifiant && (
                          <button
                            type="button"
                            onClick={() => handleDeleteEvaluateur(user)}
                            disabled={actionLoadingId === user.identifiant}
                            className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title={`Supprimer ${user.nom_complet}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <select
                        value={currentRole}
                        onChange={async (e) => {
                          const newRole = e.target.value as "evaluateur" | "animateur" | "admin";
                          setActionLoadingId(user.identifiant);
                          const res = await modifierRoleEvaluateur(user.identifiant, newRole);
                          setActionLoadingId(null);
                          if (res.success) {
                            setActionFeedback({ success: true, message: `Rôle de ${user.nom_complet} mis à jour : ${newRole}` });
                            fetchEvaluateurs();
                          } else {
                            setActionFeedback({ success: false, message: res.message || "Erreur lors du changement de rôle." });
                          }
                        }}
                        disabled={actionLoadingId === user.identifiant}
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-[#1dc4ff] cursor-pointer disabled:opacity-50"
                      >
                        <option value="evaluateur">Évaluateur</option>
                        <option value="animateur">Animateur</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {/* ── Section 5: Configuration Système & Sécurité ──────────────────────── */}
          {activeTab === "systeme" && (
          <div className="space-y-6">
            {/* Card 1: Admin PIN Security */}
            <section className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-[#1dc4ff]" /> Code PIN Administrateur (Sécurité d'accès)
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  4 Chiffres
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Ce code PIN à 4 chiffres est exigé lors de la connexion pour toute personne accédant aux fonctions Administrateur. (Code par défaut : <strong className="font-mono text-slate-800">1234</strong>).
              </p>

              <form onSubmit={handleSaveAdminPin} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  <div className="relative flex-1 w-full">
                    <input
                      type={showAdminPin ? "text" : "password"}
                      maxLength={4}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={adminPinInput}
                      onChange={(e) => setAdminPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3.5 pr-11 py-2.5 text-base font-black font-mono tracking-widest text-slate-900 focus:bg-white focus:outline-none focus:border-[#1dc4ff] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPin(!showAdminPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors cursor-pointer"
                      title={showAdminPin ? "Masquer le code PIN" : "Afficher le code PIN"}
                    >
                      {showAdminPin ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2.5 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md flex-shrink-0"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Enregistrer le PIN
                  </button>
                </div>
              </form>
            </section>

            {/* Card 2: Google Apps Script Backend URL */}
            <section className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Server className="w-4 h-4 text-[#1dc4ff]" /> Backend Google Apps Script (Web App Endpoint)
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  VITE_API_URL
                </span>
              </div>

              <form onSubmit={handleSaveApiUrl} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editableApiUrl}
                    onChange={(e) => setEditableApiUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-700 focus:outline-none focus:border-[#1dc4ff] transition-colors"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Tester & Appliquer
                  </button>
                </div>
              </form>

              <div className="flex items-start gap-2 text-xs text-slate-400">
                <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Collez l'URL de votre déploiement Web App Google Apps Script (se terminant par <code className="text-amber-300">/exec</code>). Assurez-vous d'avoir réglé <strong>Qui a accès</strong> sur <strong>Tout le monde</strong> lors du déploiement.
                </span>
              </div>
            </section>
          </div>
          )}
        </div>
      </main>

      {studioTemplate && (
        <TemplateStudioModal
          template={studioTemplate}
          onClose={() => setStudioTemplate(null)}
          onSaved={() => fetchTemplates()}
        />
      )}

      {/* ── SECURITY CONFIRMATION MODAL (For Active / Ongoing Sessions) ── */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-rose-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSessionToDelete(null);
                  setConfirmKeyword("");
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                Supprimer une Session en Cours ?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Attention : La session <strong className="text-slate-900 font-bold">"{sessionToDelete.nom_session || sessionToDelete.session_id}"</strong> est actuellement en cours avec le statut <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-black text-[10px]">{sessionToDelete.statut}</span>.
              </p>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-700">
                <AlertTriangle className="w-3.5 h-3.5" /> Conséquences irréversibles :
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                <li>Toutes les évaluations en cours de vos collaborateurs seront détruites.</li>
                <li>La jauge et les arbitrages associés seront effacés.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Pour confirmer, veuillez saisir le mot <span className="text-rose-600 font-black tracking-wider uppercase font-mono">SUPPRIMER</span> ci-dessous :
              </label>
              <input
                type="text"
                value={confirmKeyword}
                onChange={(e) => setConfirmKeyword(e.target.value)}
                placeholder="SUPPRIMER"
                className="w-full px-3.5 py-2.5 bg-white border border-rose-300 rounded-xl text-slate-900 font-mono text-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSessionToDelete(null);
                  setConfirmKeyword("");
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={confirmKeyword !== "SUPPRIMER" || actionLoadingId === sessionToDelete.session_id}
                onClick={() => executeDeleteSession(sessionToDelete.session_id, sessionToDelete.nom_session || sessionToDelete.session_id)}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoadingId === sessionToDelete.session_id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Confirmer la destruction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARBITRAGE GRID PDF REPORT MODAL */}
      {selectedReportSessionData && (
        <ArbitrageReportModal
          sessionData={selectedReportSessionData}
          onClose={() => setSelectedReportSessionData(null)}
        />
      )}
    </div>
  );
};

export default AdminPanel;
