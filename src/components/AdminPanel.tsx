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
  uploadAudioDrive,
  getApiUrl,
  setApiUrl,
  type SessionInfo,
  type Template,
  type ProfilEvaluateur,
  type DemandeCalibrageInfo,
} from "../lib/api";
import { TemplateStudioModal } from "./TemplateStudioModal";
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
  Music,
  RotateCcw,
  Trash2,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "./ui/ThemeToggle";

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
  const [_demandesLoading, setDemandesLoading] = useState(true);
  void _demandesLoading;
  const [actionFeedback, setActionFeedback] = useState<{ success: boolean; message: string } | null>(null);

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

  const [newSessionAudio, setNewSessionAudio] = useState("");
  const [audioUploading, setAudioUploading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [apiConnectionError, setApiConnectionError] = useState<string | null>(null);
  const [editableApiUrl, setEditableApiUrl] = useState(getApiUrl());
  const [studioTemplate, setStudioTemplate] = useState<Template | null>(null);

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

  // ── Approve Calibration Proposal ────────────────────────────────────────────
  const handleApproveProposal = async (demande: DemandeCalibrageInfo) => {
    setActionLoadingId(demande.demande_id);
    const res = await approuverDemandeCalibrage(
      demande.demande_id,
      demande.heure_ouverture_proposee,
      demande.heure_fermeture_proposee,
      identifiant
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
              <p style="color: #cbd5e1; margin-bottom: 12px;">${errMsg}</p>
              <p style="font-size: 11px; color: #94a3b8;">Veuillez vous assurer d'avoir copié le code de <strong>Code_v17.gs</strong> dans Apps Script et exécuté la fonction <code>autoriserGoogleDocsPermissions</code> une fois.</p>
            </div>
          `;
        }
        setActionFeedback({ success: false, message: errMsg });
      }
    } catch {
      if (targetWindow) {
        targetWindow.document.body.innerHTML = `
          <div class="card" style="border-color: #f43f5e;">
            <h2 style="color: #f43f5e;">⚠️ Erreur Réseau</h2>
            <p style="color: #cbd5e1;">Impossible de contacter Google Apps Script.</p>
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
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="font-extrabold text-white text-base flex items-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-amber-400" />
                Console Administration
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Admin : <span className="text-amber-400 font-bold">{nomComplet}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onBack}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-sm font-bold rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
              <span>Déconnexion</span>
            </button>
            <button
              onClick={() => {
                fetchSessions();
                fetchDemandes();
              }}
              disabled={sessionsLoading}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 font-bold hover:bg-slate-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${sessionsLoading ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Action Feedback Toast */}
      {apiConnectionError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs sm:text-sm">
              <div className="font-bold text-rose-300">⚠️ Erreur de connexion avec Google Apps Script</div>
              <div>{apiConnectionError}</div>
              <div className="text-slate-300 font-normal">
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
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {actionFeedback.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{actionFeedback.message}</span>
            </div>
          )}

          {/* ── KPI Metric Cards Dashboard ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Sessions Total</span>
                <Activity className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-black text-white">{sessions.length}</div>
              <p className="text-[11px] text-slate-500 font-medium">Historique complet</p>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Sessions Actives</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400">
                {sessions.filter((s) => s.statut === "OPEN" || s.statut === "GAUGE_DONE" || s.statut === "PENDING_GAUGE").length}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">En cours d'évaluation</p>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Demandes Attente</span>
                <Inbox className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400">{demandes.length}</div>
              <p className="text-[11px] text-slate-500 font-medium">À valider par l'admin</p>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Évaluateurs & Templates</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-indigo-400">
                {evaluateurs.length} <span className="text-xs font-normal text-slate-400">/ {templates.length} tpl</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Profils & Grilles</p>
            </div>
          </div>

          {/* ── Section 0: Demandes de Calibrage en Attente ──────────────────── */}
          {demandes.length > 0 && (
            <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 border-teal-500/30 shadow-lg shadow-teal-500/5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <Inbox className="w-5 h-5 text-teal-400" /> Demandes de Calibrage en Attente
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  {demandes.length} demande(s)
                </span>
              </div>

              <div className="space-y-4">
                {demandes.map((d) => (
                  <div
                    key={d.demande_id}
                    className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-extrabold text-white text-base">{d.nom_session}</div>
                        <div className="text-xs text-slate-400">
                          Demandeur : <strong className="text-teal-400">{d.evaluateur_id}</strong>
                          {d.nom_conseiller && ` • Conseiller : ${d.nom_conseiller}`}
                          {` • Template : ${d.template_id}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-teal-400" />
                        <span>
                          Plage :{" "}
                          <strong className="text-white">
                            {new Date(d.heure_ouverture_proposee).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                            {" ➔ "}
                            {new Date(d.heure_fermeture_proposee).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {d.consignes && (
                      <div className="text-xs text-slate-300 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800 italic">
                        "{d.consignes}"
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                      <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" /> Jauge de référence pré-remplie ✓
                      </span>

                      <button
                        onClick={() => handleApproveProposal(d)}
                        disabled={actionLoadingId === d.demande_id}
                        className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
                ))}
              </div>
            </section>
          )}

          {/* ── Section 1: Créer une session ─────────────────────────────────── */}
          <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Plus className="w-5 h-5 text-emerald-400" /> Nouvelle Session de Calibrage
              </div>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                {showCreateForm ? "Masquer" : "Créer"}
              </button>
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreateSession} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Nom de la session <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      placeholder="ex: Calibrage Qualité S32"
                      className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Template de grille <span className="text-rose-400">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={newSessionTemplate}
                        onChange={(e) => setNewSessionTemplate(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        required
                      >
                        <option value="">Sélectionner…</option>
                        {templates.map((t) => (
                          <option key={t.template_id} value={t.template_id}>
                            {t.nom}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={onOpenTemplateManager}
                        className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
                        title="Gérer les templates"
                      >
                        <Layers className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Conseiller & Audio */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Connection ID (ID de Communication)
                    </label>
                    <input
                      type="text"
                      value={newSessionConseiller}
                      onChange={(e) => setNewSessionConseiller(e.target.value)}
                      placeholder="ex: 221770680391|07Aoû2026|10h44"
                      className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-xs font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Format recommandé : <span className="font-mono text-slate-300">Numéro|Date|Heure</span> (ex: 221770680391|07Aoû2026|10h44)
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-emerald-400" />
                        Fichier Audio / Lien Google Drive
                      </span>
                      {audioUploading && (
                        <span className="text-[11px] text-teal-400 font-bold animate-pulse flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Upload Drive...
                        </span>
                      )}
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={newSessionAudio}
                          onChange={(e) => setNewSessionAudio(e.target.value)}
                          placeholder="Coller lien Google Drive ou URL .mp3"
                          className="flex-1 px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-xs"
                        />
                        <label className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0">
                          📁 Importer
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleAudioFileUpload}
                            className="hidden"
                            disabled={audioUploading}
                          />
                        </label>
                      </div>
                      {newSessionAudio && (
                        <div className="text-[11px] text-emerald-400 font-medium truncate flex items-center gap-1">
                          ✓ Audio prêt : <span className="font-mono text-slate-300 truncate">{newSessionAudio}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Animateur & Gauge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                      Animateur de la session (Projections Cockpit)
                    </label>
                    <select
                      value={newSessionAnimateur}
                      onChange={(e) => setNewSessionAnimateur(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors"
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-indigo-400" />
                      Évaluateur Gauge (Référence)
                    </label>
                    <select
                      value={newSessionGauge}
                      onChange={(e) => setNewSessionGauge(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
                </div>

                {/* Date & Heure de Fermeture uniquement */}
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Date & Heure de Fermeture (Clôture)
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full flex items-center gap-1">
                        ⏱ Max 72h de délai
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={newSessionCloseDate}
                        onChange={(e) => setNewSessionCloseDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500 text-xs"
                        required
                      />
                      <input
                        type="time"
                        value={newSessionCloseTime}
                        onChange={(e) => setNewSessionCloseTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500 text-xs"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      La session sera active dès sa création et se verrouillera automatiquement à l'heure indiquée.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Consignes / Notes complémentaires (facultatif)
                  </label>
                  <textarea
                    rows={2}
                    value={newSessionConsignes}
                    onChange={(e) => setNewSessionConsignes(e.target.value)}
                    placeholder="ex: Vérification stricte des éléments de sécurité DPA."
                    className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={createLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-50"
                >
                  {createLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" /> Créer la session
                    </>
                  )}
                </button>
              </form>
            )}
          </section>

          {/* ── Section 2: Sessions en cours ──────────────────────────────────── */}
          <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Clock className="w-5 h-5 text-purple-400" /> Sessions en Cours
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                {sessions.length} session(s)
              </span>
            </div>

            {sessionsLoading && sessions.length === 0 && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
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
                  className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {session.nom_session || session.session_id}
                        </span>
                        {getStatusBadge(session.statut)}
                        {session.gauge_soumis && (
                          <span className="text-xs text-emerald-400 font-bold">✓ Gauge</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        ID: {session.session_id} • Template: {session.template_id}
                        {session.animateur_id && ` • Animateur: ${session.animateur_id}`}
                        {session.gauge_id && ` • Gauge: ${session.gauge_id}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-bold text-white">{session.nombre_evaluateurs_soumis}</span> soumis
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(session.statut === "PENDING_GAUGE" || session.statut === "GAUGE_DONE") && (
                      <button
                        onClick={() => handleForceOpen(session.session_id)}
                        disabled={actionLoadingId === session.session_id}
                        className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-lg hover:bg-emerald-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
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
                          onClick={() => onOpenCockpit(session.session_id)}
                          className="px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-bold rounded-lg hover:bg-purple-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3 h-3" /> Cockpit Live
                        </button>
                        <button
                          onClick={() => handleResetArbitrages(session.session_id)}
                          disabled={actionLoadingId === session.session_id}
                          className="px-3 py-1.5 bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-lg hover:bg-amber-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          title="Effacer tous les arbitrages enregistrés pour cette session"
                        >
                          {actionLoadingId === session.session_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3 text-amber-400" />
                          )}
                          Réinitialiser Arbitrages
                        </button>
                        <button
                          onClick={() => handleCloseSession(session.session_id)}
                          disabled={actionLoadingId === session.session_id}
                          className="px-3 py-1.5 bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-lg hover:bg-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {actionLoadingId === session.session_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FileLock2 className="w-3 h-3" />
                          )}
                          Clôturer & PDF
                        </button>
                      </>
                    )}

                    {session.statut === "CLOSED" && (
                      <>
                        <button
                          onClick={() => handleDownloadPdfForSession(session.session_id)}
                          disabled={actionLoadingId === session.session_id}
                          className="px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold rounded-lg hover:bg-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          title="Ouvrir ou Générer le Rapport PDF de cette session"
                        >
                          {actionLoadingId === session.session_id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                          ) : (
                            <FileText className="w-3 h-3 text-indigo-400" />
                          )}
                          Rapport PDF 📄
                        </button>

                        <button
                          onClick={() => onOpenCockpit(session.session_id)}
                          className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                          title="Consulter le cockpit archivé en lecture seule"
                        >
                          <ExternalLink className="w-3 h-3 text-slate-400" /> Consulter Cockpit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 3: Gestion Templates ─────────────────────────────────── */}
          <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Layers className="w-5 h-5 text-teal-400" /> Templates de Grilles
              </div>
              <button
                onClick={onOpenTemplateManager}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-teal-600/20"
              >
                <Layers className="w-3.5 h-3.5" /> Gérer
              </button>
            </div>

            {templatesLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
              </div>
            )}

            {!templatesLoading && templates.length === 0 && (
              <div className="text-center py-6 text-slate-500 text-sm">
                Aucun template. Cliquez sur "Gérer" pour en créer un.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templates.map((t) => (
                <div
                  key={t.template_id}
                  className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{t.nom}</span>
                    <span className="text-xs text-slate-500 font-mono">{t.template_id}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {t.categories.length} catégorie(s) •{" "}
                    {t.categories.reduce((acc, c) => acc + c.items.length, 0)} items
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setStudioTemplate(t)}
                      className="flex-1 py-2 px-3 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      ✏️ Éditer avec le Studio
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(t.template_id, t.nom)}
                      disabled={actionLoadingId === t.template_id}
                      className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Supprimer définitivement ce template"
                    >
                      {actionLoadingId === t.template_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 4: Gestion des Utilisateurs & Rôles ─────────────────── */}
          <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Users className="w-5 h-5 text-indigo-400" /> Registre des Utilisateurs & Rôles
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                {evaluateurs.length} utilisateur(s)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {evaluateurs.map((user) => {
                const currentRole = user.role || (user.identifiant === "admin" || user.identifiant === "oumar.toure" ? "admin" : "evaluateur");
                return (
                  <div key={user.identifiant} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-extrabold text-white text-sm">{user.nom_complet}</div>
                        <div className="text-xs text-slate-400 font-mono">@{user.identifiant}</div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                        currentRole === "admin" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                        currentRole === "animateur" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" :
                        "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      }`}>
                        {currentRole.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                      <span>Sessions : <strong className="text-white">{user.nombre_sessions || 0}</strong></span>
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
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
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

          {/* ── Backend Config ────────────────────────────────────────────────── */}
          <section className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Server className="w-4 h-4 text-indigo-400" /> Backend Google Apps Script (Web App Endpoint)
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
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
                  className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
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
      </main>

      {studioTemplate && (
        <TemplateStudioModal
          template={studioTemplate}
          onClose={() => setStudioTemplate(null)}
          onSaved={() => fetchTemplates()}
        />
      )}
    </div>
  );
};

export default AdminPanel;
