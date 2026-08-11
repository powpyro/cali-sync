import React, { useEffect, useState, useCallback } from "react";
import {
  getSessionsActives,
  validerPin,
  listerTemplates,
  proposerCalibrage,
  getConfigTemplate,
  getMesSessions,
  listerDemandesCalibrage,
  getRapportPdf,
  uploadAudioDrive,
  type SessionInfo,
  type Template,
} from "../lib/api";
import { HierarchicalEvaluationForm, type HierarchicalItem } from "./HierarchicalEvaluationForm";
import { ThemeToggle } from "./ui/ThemeToggle";
import {
  Activity,
  Clock,
  CheckCircle2,
  Users,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Inbox,
  Lock,
  Bookmark,
  Shield,
  ArrowLeft,
  Plus,
  Sparkles,
  UserCheck,
  FileText,
  LogOut,
  Upload,
  Link,
  Zap,
  Check,
  X,
  Layers,
  Headphones,
} from "lucide-react";

interface EvaluateurLandingProps {
  identifiant: string;
  nomComplet: string;
  role: "evaluateur" | "gauge";
  onSelectSession: (sessionId: string, isGauge: boolean) => void;
  onOpenCockpit?: (sessionId: string) => void;
  onOpenSubmission?: (sessionId: string) => void;
  onBack: () => void;
}

export const EvaluateurLanding: React.FC<EvaluateurLandingProps> = ({
  identifiant,
  nomComplet,
  role,
  onSelectSession,
  onOpenCockpit,
  onOpenSubmission,
  onBack,
}) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<"actives" | "mes_sessions" | "mes_demandes">("actives");
  const [mySessions, setMySessions] = useState<any[]>([]);
  const [myDemands, setMyDemands] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [sessRes, demRes] = await Promise.all([
        getMesSessions(identifiant),
        listerDemandesCalibrage(identifiant)
      ]);
      if (sessRes.success) setMySessions(sessRes.sessions || []);
      if (demRes.success) setMyDemands(demRes.demandes || []);
    } catch (e) {
      console.error("Error fetching history:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [identifiant]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Gauge PIN modal state
  const [pinModalSession, setPinModalSession] = useState<string | null>(null);
  const [showDirectPinModal, setShowDirectPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinShake, setPinShake] = useState(false);

  // Proposal Modal State
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [propTitle, setPropTitle] = useState("");
  const [propTemplate, setPropTemplate] = useState("");
  const [propConseiller, setPropConseiller] = useState("");
  const [propAudio, setPropAudio] = useState("");
  const [propAudioTab, setPropAudioTab] = useState<"file" | "link">("file");
  const [propAudioUploading, setPropAudioUploading] = useState(false);
  const [propConsignes, setPropConsignes] = useState("");
  const [propCloseDate, setPropCloseDate] = useState("");
  const [propCloseTime, setPropCloseTime] = useState("");

  const applyCloseDatePresetMinutes = (minutesToAdd: number) => {
    const target = new Date(Date.now() + minutesToAdd * 60 * 1000);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    const hh = String(target.getHours()).padStart(2, "0");
    const min = String(target.getMinutes()).padStart(2, "0");
    setPropCloseDate(`${yyyy}-${mm}-${dd}`);
    setPropCloseTime(`${hh}:${min}`);
  };

  const [proposalFeedback, setProposalFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handlePropAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setProposalFeedback({ success: false, message: "Fichier audio trop volumineux (max 20 Mo)." });
      return;
    }

    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|ogg|aac|flac)$/i)) {
      setProposalFeedback({ success: false, message: "Format audio non supporté (utilisez MP3, WAV, M4A, OGG)." });
      return;
    }

    setPropAudioUploading(true);
    setProposalFeedback({ success: true, message: "Téléversement de l'audio vers Google Drive en cours..." });

    const reader = new FileReader();
    reader.onload = async () => {
      const resultStr = reader.result as string;
      const base64Data = resultStr.split(",")[1] || resultStr;
      const res = await uploadAudioDrive(base64Data, file.name, file.type || "audio/mp3");
      setPropAudioUploading(false);
      if (res && res.success && (res as any).url_audio) {
        setPropAudio((res as any).url_audio);
        setProposalFeedback({ success: true, message: "Audio téléversé avec succès sur Google Drive !" });
      } else {
        setProposalFeedback({ success: false, message: res?.message || "Erreur lors de l'upload audio vers Google Drive." });
      }
    };
    reader.onerror = () => {
      setPropAudioUploading(false);
      setProposalFeedback({ success: false, message: "Impossible de lire le fichier sur votre appareil." });
    };
    reader.readAsDataURL(file);
  };

  // 2-Step Proposal: Dedicated Full-Page Gauge state
  const [showProposalGaugePage, setShowProposalGaugePage] = useState(false);
  const [proposalItems, setProposalItems] = useState<HierarchicalItem[]>([]);
  const [fetchingConfigItems, setFetchingConfigItems] = useState(false);

  // Countdown ticks
  const [, setTick] = useState(0);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    const res = await getSessionsActives();
    setLoading(false);

    if (res && res.success && Array.isArray(res.sessions)) {
      setSessions(res.sessions);
    } else {
      setSessions([]);
      if (!res?.success) setError(res?.message || "Impossible de charger les sessions.");
    }
  };

  const handleRefreshAll = async () => {
    await Promise.all([fetchSessions(), fetchHistory()]);
  };

  const handleDownloadPdf = async (sessId: string) => {
    try {
      const res = await getRapportPdf(sessId);
      if (res && res.success && (res as any).pdf_url) {
        window.open((res as any).pdf_url, "_blank");
      } else {
        alert("Le rapport PDF n'est pas encore disponible pour cette session.");
      }
    } catch (e) {
      alert("Erreur lors de la récupération du rapport.");
    }
  };

  const fetchTemplates = async () => {
    const res = await listerTemplates();
    if (res && res.success && Array.isArray(res.templates)) {
      setTemplates(res.templates);
      if (res.templates.length > 0 && !propTemplate) {
        setPropTemplate(res.templates[0].template_id);
      }
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchTemplates();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const getCountdownSeconds = (session: SessionInfo): number => {
    if (!session.heure_fin) return 0;
    const fin = new Date(session.heure_fin).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((fin - now) / 1000));
  };

  const formatCountdown = (totalSecs: number): string => {
    if (totalSecs <= 0) return "00:00";
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const visibleSessions = (sessions || []).filter((s) => {
    if (!s) return false;
    if (role === "gauge") {
      // Gauge / Animateur strictly sees only their own created/assigned sessions
      const isMySession =
        !s.gauge_id && !s.animateur_id
          ? true // fallback for legacy sessions
          : s.gauge_id?.toLowerCase() === identifiant.toLowerCase() ||
            s.animateur_id?.toLowerCase() === identifiant.toLowerCase();
      return isMySession;
    }
    // Normal evaluators see OPEN sessions OR sessions they already submitted to (for consultation)
    const alreadySubmitted = s.evaluateurs_soumis?.includes(identifiant);
    return s.statut === "OPEN" || alreadySubmitted;
  });

  const handleSessionClick = (session: SessionInfo) => {
    if (role === "gauge") {
      onSelectSession(session.session_id, true);
    } else {
      const alreadySubmitted = session.evaluateurs_soumis?.includes(identifiant);
      if (alreadySubmitted && session.statut !== "OPEN") {
        onOpenSubmission?.(session.session_id);
      } else {
        onSelectSession(session.session_id, false);
      }
    }
  };

  const handlePinValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    setPinLoading(true);
    const res = await validerPin(pinModalSession, pin);
    setPinLoading(false);

    if (res.success) {
      const targetSessionId = (res.session_id as string) || pinModalSession || "";
      setPinModalSession(null);
      setShowDirectPinModal(false);
      setPin("");
      onSelectSession(targetSessionId, role === "gauge");
    } else {
      setPinError(true);
      setPinShake(true);
      setPin("");
      setTimeout(() => setPinShake(false), 400);
    }
  };

  // Step 1 -> Step 2: Validate metadata and load full 4-level hierarchy for selected template
  const handleProceedToGaugeStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propTitle || !propTemplate || !propCloseDate || !propCloseTime) {
      setProposalFeedback({ success: false, message: "Veuillez remplir le titre, le template et la date/heure de clôture." });
      return;
    }

    const now = new Date();
    const heureFermeture = `${propCloseDate}T${propCloseTime}:00`;

    const nowMs = now.getTime();
    const closeTimeMs = new Date(heureFermeture).getTime();

    if (closeTimeMs <= nowMs) {
      setProposalFeedback({ success: false, message: "La date et l'heure de clôture doivent être dans le futur." });
      return;
    }

    if (closeTimeMs - nowMs > 72 * 60 * 60 * 1000) {
      setProposalFeedback({ success: false, message: "La date et l'heure de clôture ne doivent pas dépasser 72 heures à partir de maintenant." });
      return;
    }

    setFetchingConfigItems(true);
    setProposalFeedback(null);

    // Fetch full 4-level hierarchy from Admin_Config_Grille for the selected template
    const configRes = await getConfigTemplate(propTemplate);
    setFetchingConfigItems(false);

    let itemsForGauge: HierarchicalItem[] = [];

    if (configRes && configRes.success && Array.isArray(configRes.items) && configRes.items.length > 0) {
      itemsForGauge = configRes.items.map((it: any) => ({
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
    } else {
      // Fallback to standard N2 mapping if template config has no N3/N4 items
      const selectedTpl = templates.find((t) => t.template_id === propTemplate);
      if (selectedTpl) {
        itemsForGauge = selectedTpl.categories.flatMap((cat) =>
          cat.items.map((it) => ({
            item_id: it.item_id,
            parent_id: "",
            niveau: 2,
            type_noeud: "standard",
            categorie_racine_fr: cat.categorie,
            libelle_fr: it.item_libelle,
            criticite: it.criticite === "Critical" ? "Critical" : "Standard",
            est_terminal: true,
            commentaire_obligatoire: false,
          }))
        );
      }
    }

    if (itemsForGauge.length === 0) {
      setProposalFeedback({ success: false, message: "Aucun critère trouvé pour le template sélectionné." });
      return;
    }

    setProposalItems(itemsForGauge);
    setShowProposalModal(false);
    setShowProposalGaugePage(true);
  };

  // Gauge Edition: Edit existing reference Gauge before session closure
  const handleEditGauge = async (session: SessionInfo) => {
    setPropTitle(session.nom_session);
    setPropConseiller(session.nom_conseiller || "");
    setPropAudio(session.url_audio || "");
    setPropConsignes(session.consignes || "");

    setFetchingConfigItems(true);
    const configRes = await getConfigTemplate(session.template_id);
    setFetchingConfigItems(false);

    let itemsForGauge: HierarchicalItem[] = [];

    if (configRes && configRes.success && Array.isArray(configRes.items) && configRes.items.length > 0) {
      itemsForGauge = configRes.items.map((it: any) => ({
        item_id: String(it.item_id),
        parent_id: String(it.parent_id || ""),
        niveau: Number(it.niveau) || 2,
        type_noeud: it.type_noeud || "standard",
        categorie_racine_fr: it.categorie_racine_fr || "Général",
        libelle_fr: it.libelle_fr || it.item_libelle || "",
        criticite: it.criticite === "Critical" ? "Critical" : "Standard",
        est_terminal: it.est_terminal === true || String(it.est_terminal).toLowerCase() === "true",
        commentaire_obligatoire: it.commentaire_obligatoire === true || String(it.commentaire_obligatoire).toLowerCase() === "true",
      }));
    } else {
      const selectedTpl = templates.find((t) => t.template_id === session.template_id);
      if (selectedTpl) {
        itemsForGauge = selectedTpl.categories.flatMap((cat) =>
          cat.items.map((it) => ({
            item_id: it.item_id,
            parent_id: "",
            niveau: 2,
            type_noeud: "standard",
            categorie_racine_fr: cat.categorie,
            libelle_fr: it.item_libelle,
            criticite: it.criticite === "Critical" ? "Critical" : "Standard",
            est_terminal: true,
            commentaire_obligatoire: false,
          }))
        );
      }
    }

    if (itemsForGauge.length > 0) {
      setProposalItems(itemsForGauge);
      setShowProposalGaugePage(true);
    }
  };

  // Step 2: Final submission with full 4-level gauge payload
  const handleFinalProposalSubmit = async (evaluatedItems: Array<{ item_id: string; categorie: string; item: string; statut: string; commentaire?: string }>) => {
    const now = new Date();
    const heureOuverture = now.toISOString();
    const heureFermeture = `${propCloseDate}T${propCloseTime}:00`;
    const nowMs = now.getTime();
    const closeTimeMs = new Date(heureFermeture).getTime();
    const durationMinutes = Math.max(5, Math.round((closeTimeMs - nowMs) / 60000));

    const res = await proposerCalibrage({
      evaluateur_id: identifiant,
      nom_session: propTitle,
      template_id: propTemplate,
      heure_ouverture_proposee: heureOuverture,
      heure_fermeture_proposee: heureFermeture,
      duree_minutes: durationMinutes,
      nom_conseiller: propConseiller,
      consignes: propConsignes,
      url_audio: propAudio,
      items_gauge: evaluatedItems,
    });

    if (res.success) {
      setTimeout(() => {
        setShowProposalGaugePage(false);
        setPropTitle("");
        setPropConseiller("");
        setPropAudio("");
        setPropConsignes("");
        fetchSessions();
      }, 2000);
      return { success: true, message: "Proposition transmise avec succès à l'Administrateur !" };
    } else {
      return { success: false, message: res.message || "Erreur lors de l'envoi de la proposition." };
    }
  };

  if (showProposalGaugePage) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowProposalGaugePage(false);
                  setShowProposalModal(true);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Modifier les infos du calibrage
              </button>
              <div>
                <h1 className="text-base font-black text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-teal-400" /> Évaluation Gauge de Référence
                </h1>
                <p className="text-xs text-slate-400">
                  Session : <span className="text-teal-400 font-bold">{propTitle}</span>
                  {propConseiller && <> • Conseiller : <span className="text-white font-medium">{propConseiller}</span></>}
                </p>
              </div>
            </div>
            <div className="text-xs px-3.5 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 font-extrabold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              Étape 2 / 2 — Grille Hiérarchique 4 Niveaux
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6">
          <HierarchicalEvaluationForm
            items={proposalItems}
            isGaugeMode={true}
            callName={propConseiller}
            audioUrl={propAudio}
            onSubmitPayload={handleFinalProposalSubmit}
            onComplete={() => {
              setShowProposalGaugePage(false);
              setPropTitle("");
              setPropConseiller("");
              setPropAudio("");
              setPropConsignes("");
              fetchSessions();
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="font-extrabold text-white text-base flex items-center gap-2">
                {role === "gauge" ? (
                  <>
                    <Bookmark className="w-4 h-4 text-indigo-400" />
                    Sessions en attente de Gauge
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Sessions de Calibrage Ouvertes
                  </>
                )}
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Connecté : <span className="text-emerald-400 font-bold">{nomComplet}</span> ({identifiant})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {role === "gauge" && (
              <button
                onClick={() => {
                  setPinModalSession(null);
                  setPin("");
                  setPinError(false);
                  setShowDirectPinModal(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-indigo-200" /> Saisir Code / PIN Cockpit
              </button>
            )}
            <button
              onClick={() => setShowProposalModal(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-teal-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Proposer un Calibrage
            </button>
            <ThemeToggle />
            <button
              onClick={onBack}
              className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-extrabold rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer"
              title="Se déconnecter de l'application"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
            <button
              onClick={handleRefreshAll}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {error && (
            <div className="glass-card border-rose-500/30 p-5 rounded-2xl flex items-center gap-3 text-rose-300">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
          {/* TABS SYSTEM */}
          <div className="flex border-b border-slate-800 gap-1 pb-px">
            <button
              onClick={() => setActiveTab("actives")}
              className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === "actives"
                  ? "border-emerald-500 text-white font-extrabold"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-4.5 h-4.5" />
              Sessions Actives ({visibleSessions.length})
            </button>
            <button
              onClick={() => setActiveTab("mes_sessions")}
              className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === "mes_sessions"
                  ? "border-emerald-500 text-white font-extrabold"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-4.5 h-4.5" />
              Mes Sessions ({mySessions.length})
            </button>
            <button
              onClick={() => setActiveTab("mes_demandes")}
              className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeTab === "mes_demandes"
                  ? "border-emerald-500 text-white font-extrabold"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Inbox className="w-4.5 h-4.5" />
              Mes Demandes ({myDemands.length})
            </button>
          </div>

          {/* TAB 1: SESSIONS ACTIVES */}
          {activeTab === "actives" && (
            <div className="space-y-6">
              {loading && sessions.length === 0 && (
                <div className="glass-card p-16 rounded-2xl flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                  <p className="text-slate-400 text-sm font-medium">Chargement des sessions…</p>
                </div>
              )}

              {!loading && visibleSessions.length === 0 && (
                <div className="glass-card p-16 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Inbox className="w-8 h-8 text-slate-500" />
                  </div>
                  <div className="max-w-md space-y-2">
                    <h3 className="text-lg font-bold text-white">Aucune session ouverte actuellement</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Aucun calibrage n'est ouvert aux évaluateurs pour l'instant.
                      <br />
                      Vous pouvez <strong className="text-teal-400">proposer un calibrage</strong> ci-dessus ou revenir dès qu'une session sera ouverte !
                    </p>
                  </div>
                  <button
                    onClick={() => setShowProposalModal(true)}
                    className="mt-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Demander un calibrage
                  </button>
                </div>
              )}

              {visibleSessions.map((session) => {
                const countdownSec = getCountdownSeconds(session);
                const alreadySubmitted = session.evaluateurs_soumis?.includes(identifiant);
                const isUrgent = countdownSec > 0 && countdownSec <= 120;

                return (
                  <div
                    key={session.session_id}
                    className={`glass-card rounded-2xl p-6 sm:p-8 space-y-5 transition-all ${
                      alreadySubmitted
                        ? "opacity-70 border-emerald-500/30"
                        : isUrgent
                        ? "border-rose-500/40 shadow-lg shadow-rose-500/5"
                        : "hover:border-slate-600"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-extrabold text-white">
                            {session.nom_session || session.session_id}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              session.statut === "OPEN"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : session.statut === "PENDING_GAUGE"
                                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {session.statut === "OPEN"
                              ? "En cours"
                              : session.statut === "PENDING_GAUGE"
                              ? "Attente Gauge"
                              : session.statut}
                          </span>

                          {alreadySubmitted && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Déjà soumis
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                          ID: {session.session_id}
                        </div>
                      </div>

                      {session.statut === "OPEN" && countdownSec > 0 && (
                        <div
                          className={`flex items-center gap-2 px-5 py-3 rounded-2xl border ${
                            isUrgent
                              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                              : "bg-slate-900/60 border-slate-700 text-white"
                          }`}
                        >
                          <Clock className={`w-5 h-5 ${isUrgent ? "text-rose-400 animate-pulse" : "text-slate-400"}`} />
                          <span className={`font-black text-2xl tabular-nums tracking-tight ${isUrgent ? "text-rose-400" : ""}`}>
                            {formatCountdown(countdownSec)}
                          </span>
                        </div>
                      )}

                      {session.statut === "PENDING_GAUGE" && (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                          <Lock className="w-4 h-4 text-indigo-400" />
                          <span className="text-xs font-bold text-indigo-300">Code PIN requis</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Users className="w-4 h-4" />
                        <span className="font-bold text-white">{session.nombre_evaluateurs_soumis}</span>
                        <span className="text-xs">soumission(s)</span>
                      </div>
                      {session.duree_minutes && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs">{session.duree_minutes} min</span>
                        </div>
                      )}
                      {session.gauge_soumis && (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <Shield className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">Gauge ✓</span>
                        </div>
                      )}
                    </div>

                    {role === "gauge" ? (
                      <div className="space-y-2 pt-2">
                        {!session.gauge_soumis ? (
                          <button
                            onClick={() => onSelectSession(session.session_id, true)}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <FileText className="w-4.5 h-4.5" /> ✏️ Remplir l'évaluation Gauge
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onOpenCockpit?.(session.session_id)}
                              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Sparkles className="w-4.5 h-4.5" /> 🚀 Accéder au Cockpit Live
                            </button>
                            {session.statut !== "CLOSED" && (
                              <button
                                onClick={() => handleEditGauge(session)}
                                disabled={fetchingConfigItems}
                                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-500/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                {fetchingConfigItems ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <FileText className="w-4 h-4 text-indigo-400" />
                                )}
                                ✏️ Consulter / Modifier la Gauge de référence
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ) : !alreadySubmitted ? (
                      <button
                        onClick={() => handleSessionClick(session)}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ArrowRight className="w-4.5 h-4.5" /> 🟢 Commencer l'évaluation
                      </button>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {session.statut === "OPEN" ? (
                          <button
                            onClick={() => handleSessionClick(session)}
                            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <FileText className="w-4 h-4" /> ✏️ Modifier mon évaluation (Avant Clôture)
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSessionClick(session)}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 👁️ Consulter mon évaluation (Lecture seule)
                          </button>
                        )}
                        <button
                          onClick={() => onOpenCockpit?.(session.session_id)}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" /> 🚀 Suivre le Cockpit Live
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: MES SESSIONS */}
          {activeTab === "mes_sessions" && (
            <div className="space-y-4">
              {loadingHistory && mySessions.length === 0 ? (
                <div className="glass-card p-12 rounded-2xl flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                  <p className="text-slate-400 text-sm font-medium">Chargement de votre historique…</p>
                </div>
              ) : mySessions.length === 0 ? (
                <div className="glass-card p-12 rounded-2xl text-center space-y-4">
                  <Inbox className="w-12 h-12 text-slate-500 mx-auto" />
                  <p className="text-slate-400 text-sm">Vous n'avez participé à aucune session de calibrage pour le moment.</p>
                </div>
              ) : (
                mySessions.map((sess) => (
                  <div key={sess.session_id} className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 hover:border-slate-700 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-white">{sess.nom_session}</h3>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            sess.statut === "CLOSED" ? "bg-slate-800 text-slate-400 border border-slate-700" :
                            sess.statut === "LOCKED" ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" :
                            "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          }`}>
                            {sess.statut === "CLOSED" ? "Clôturée" : sess.statut === "LOCKED" ? "Arbitrage" : "En cours"}
                          </span>
                        </div>
                        {sess.nom_conseiller && (
                          <p className="text-xs text-slate-400 mt-1">Conseiller : <span className="text-slate-200">{sess.nom_conseiller}</span></p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sess.roles.map((r: string) => (
                          <span key={r} className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                            r === "Animateur" ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" :
                            r === "Gauge" ? "bg-purple-500/10 text-purple-300 border-purple-500/20" :
                            "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          }`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-2 border-t border-slate-900">
                      <button
                        onClick={() => onOpenCockpit?.(sess.session_id)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> 📊 Cockpit Live
                      </button>
                      {sess.roles.includes("Évaluateur") && (
                        <button
                          onClick={() => onOpenSubmission?.(sess.session_id)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> 👁️ Consulter ma soumission
                        </button>
                      )}
                      {sess.statut === "CLOSED" && (
                        <button
                          onClick={() => handleDownloadPdf(sess.session_id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/10"
                        >
                          <FileText className="w-3.5 h-3.5" /> 📄 Rapport PDF
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: MES DEMANDES */}
          {activeTab === "mes_demandes" && (
            <div className="space-y-4">
              {loadingHistory && myDemands.length === 0 ? (
                <div className="glass-card p-12 rounded-2xl flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                  <p className="text-slate-400 text-sm font-medium">Chargement de vos demandes…</p>
                </div>
              ) : myDemands.length === 0 ? (
                <div className="glass-card p-12 rounded-2xl text-center space-y-4">
                  <Inbox className="w-12 h-12 text-slate-500 mx-auto" />
                  <p className="text-slate-400 text-sm">Vous n'avez proposé aucune demande de calibrage.</p>
                </div>
              ) : (
                myDemands.map((dem) => (
                  <div key={dem.demande_id} className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 hover:border-slate-700 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-white">{dem.nom_session}</h3>
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                            dem.statut === "PENDING_APPROVAL" ? "bg-amber-500/10 text-amber-300 border-amber-500/20" :
                            dem.statut === "APPROVED" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" :
                            "bg-rose-500/10 text-rose-300 border-rose-500/20"
                          }`}>
                            {dem.statut === "PENDING_APPROVAL" ? "En attente" : dem.statut === "APPROVED" ? "Approuvée" : "Rejetée"}
                          </span>
                        </div>
                        {dem.nom_conseiller && (
                          <p className="text-xs text-slate-400 mt-1">Conseiller : <span className="text-slate-200">{dem.nom_conseiller}</span></p>
                        )}
                        {dem.date_demande && (
                          <p className="text-[10px] text-slate-500 mt-1">Demandée le : {new Date(dem.date_demande).toLocaleString()}</p>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl space-y-0.5">
                        <p>Template : <span className="text-white font-bold">{dem.template_id}</span></p>
                        <p>Durée : <span className="text-white font-bold">{dem.duree_minutes} mins</span></p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Proposal Modal (Étape 1 : Saisie des informations de la session) ── */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl space-y-6 my-8 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header & Step Tracker */}
            <div className="border-b border-slate-800 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-white font-black text-lg">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white leading-tight">Proposer un Calibrage</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Configurez les détails avant la notation Gauge de référence</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProposalModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Visual Step Progress Indicator Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-teal-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                    Étape 1 sur 2 : Informations de la Session
                  </span>
                  <span className="text-slate-500 font-mono">50% Complété</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 w-1/2 rounded-full transition-all duration-300" />
                </div>
              </div>
            </div>

            <form onSubmit={handleProceedToGaugeStep} className="space-y-5">
              {proposalFeedback && (
                <div
                  className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold shadow-md ${
                    proposalFeedback.success
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                  }`}
                >
                  {proposalFeedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span>{proposalFeedback.message}</span>
                </div>
              )}

              {/* SECTION 1 : Paramètres généraux */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Titre du Calibrage <span className="text-rose-400">*</span></span>
                    </label>
                    <input
                      type="text"
                      value={propTitle}
                      onChange={(e) => setPropTitle(e.target.value)}
                      placeholder="ex: Calibrage Équipe Vente N1"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-teal-400" />
                      <span>Template de Grille <span className="text-rose-400">*</span></span>
                    </label>
                    <select
                      value={propTemplate}
                      onChange={(e) => setPropTemplate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-xs"
                      required
                    >
                      {templates.map((t) => (
                        <option key={t.template_id} value={t.template_id}>
                          {t.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                    Nom du Conseiller / Représentant Évalué
                  </label>
                  <input
                    type="text"
                    value={propConseiller}
                    onChange={(e) => setPropConseiller(e.target.value)}
                    placeholder="ex: Paul Martin (Conseiller Service Client)"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-xs"
                  />
                </div>
              </div>

              {/* SECTION 2 : Fichier Audio / Lien Drive (Tabs UX) */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5 text-teal-400" /> Support Audio de la Session
                  </label>
                  {propAudioUploading && (
                    <span className="text-[11px] text-teal-400 font-bold animate-pulse flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Importation vers Drive...
                    </span>
                  )}
                </div>

                {/* Sub-tabs Selector */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPropAudioTab("file")}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      propAudioTab === "file"
                        ? "bg-teal-600 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" /> Fichier de l'appareil
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropAudioTab("link")}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      propAudioTab === "link"
                        ? "bg-teal-600 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Link className="w-3.5 h-3.5" /> Lien Google Drive / Web
                  </button>
                </div>

                {/* Tab 1: File Dropzone */}
                {propAudioTab === "file" && (
                  <div className="space-y-2">
                    {propAudio ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-emerald-300">Fichier audio chargé avec succès !</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">{propAudio}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPropAudio("")}
                          className="text-[11px] text-rose-400 hover:underline font-bold ml-2 flex-shrink-0"
                        >
                          Changer
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-700/80 hover:border-teal-500 hover:bg-teal-500/5 rounded-2xl p-4 cursor-pointer text-center space-y-1 transition-all block group">
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-teal-400 group-hover:scale-110 transition-all mx-auto" />
                        <div className="text-xs font-bold text-slate-200">
                          {propAudioUploading ? "Importation en cours..." : "Cliquez pour parcourir et importer un audio"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Formats supportés : MP3, WAV, M4A, OGG (Taille max : 20 Mo)
                        </div>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handlePropAudioFileUpload}
                          className="hidden"
                          disabled={propAudioUploading}
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* Tab 2: URL Input */}
                {propAudioTab === "link" && (
                  <div className="space-y-1.5">
                    <input
                      type="url"
                      value={propAudio}
                      onChange={(e) => setPropAudio(e.target.value)}
                      placeholder="Collez le lien public Google Drive ou l'URL du fichier audio .mp3"
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-xs"
                    />
                    {propAudio && (
                      <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Lien enregistré : <span className="font-mono text-slate-300 truncate">{propAudio}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 3 : Date & Heure de Clôture avec Raccourcis Rapides (Presets) */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Date & Heure de Fermeture (Clôture) <span className="text-rose-400">*</span>
                  </div>
                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full flex items-center gap-1">
                    ⏱ Max 72h de délai
                  </span>
                </div>

                {/* Quick Presets (15 min, 30 min, 60 min, 24h) */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Définition rapide du délai en 1-clic :
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => applyCloseDatePresetMinutes(15)}
                      className="py-2 px-2 bg-slate-900 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/50 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Zap className="w-3 h-3 text-rose-400" /> Dans 15 min
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCloseDatePresetMinutes(30)}
                      className="py-2 px-2 bg-slate-900 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/50 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Zap className="w-3 h-3 text-rose-400" /> Dans 30 min
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCloseDatePresetMinutes(60)}
                      className="py-2 px-2 bg-slate-900 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/50 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Zap className="w-3 h-3 text-rose-400" /> Dans 60 min
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCloseDatePresetMinutes(24 * 60)}
                      className="py-2 px-2 bg-slate-900 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/50 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Zap className="w-3 h-3 text-rose-400" /> Dans 24h
                    </button>
                  </div>
                </div>

                {/* Date & Time Input Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      📅 Date de Clôture
                    </label>
                    <input
                      type="date"
                      value={propCloseDate}
                      onChange={(e) => setPropCloseDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/90 hover:border-slate-600 rounded-xl text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-xs font-medium transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      🕒 Heure de Clôture
                    </label>
                    <input
                      type="time"
                      value={propCloseTime}
                      onChange={(e) => setPropCloseTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/90 hover:border-slate-600 rounded-xl text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-xs font-medium transition-all"
                      required
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  La session débutera dès validation par l'Administrateur et se fermera automatiquement à l'heure indiquée.
                </p>
              </div>

              {/* SECTION 4 : Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Notes / Consignes complémentaires (facultatif)
                </label>
                <textarea
                  rows={2}
                  value={propConsignes}
                  onChange={(e) => setPropConsignes(e.target.value)}
                  placeholder="ex: Porter une attention particulière sur la vérification d'identité (DPA)."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-xs"
                />
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowProposalModal(false)}
                  className="px-5 py-3 bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs rounded-2xl hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={fetchingConfigItems}
                  className="flex-1 py-3.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 hover:from-teal-400 hover:to-emerald-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-teal-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.01]"
                >
                  {fetchingConfigItems ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Étape 2 : Évaluation Gauge de Référence</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Gauge PIN Modal (Direct or Specific Session) ────────────────────── */}
      {(pinModalSession || showDirectPinModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className={`bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-6 ${pinShake ? "animate-shake" : ""}`}
          >
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                <Lock className="w-7 h-7 text-indigo-400" />
              </div>
              <h2 className="text-xl font-extrabold text-white">Code PIN de Session</h2>
              <p className="text-sm text-slate-400">
                {pinModalSession ? (
                  <>
                    Saisissez le PIN fourni par l'administrateur pour la session
                    <br />
                    <span className="text-indigo-400 font-bold">{pinModalSession}</span>
                  </>
                ) : (
                  <>Saisissez le code PIN transmis par l'administrateur pour ouvrir directement votre session d'évaluation Gauge.</>
                )}
              </p>
            </div>

            <form onSubmit={handlePinValidation} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ""));
                  setPinError(false);
                }}
                placeholder="••••••"
                autoFocus
                className={`w-full text-center text-3xl font-black tracking-[0.5em] px-4 py-3 rounded-xl bg-slate-800 border transition-all focus:outline-none ${
                  pinError
                    ? "border-rose-500 text-rose-400"
                    : "border-slate-600 text-white focus:border-indigo-500"
                }`}
              />

              {pinError && (
                <p className="text-xs text-rose-400 font-semibold text-center">
                  Code PIN incorrect ou aucune session trouvée. Vérifiez auprès de l'admin.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPinModalSession(null);
                    setShowDirectPinModal(false);
                    setPin("");
                  }}
                  className="px-5 py-3 bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pinLoading || pin.length < 4}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pinLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4" /> Accéder à l'Évaluation Gauge
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluateurLanding;
