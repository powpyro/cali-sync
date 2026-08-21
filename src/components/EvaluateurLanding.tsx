import React, { useEffect, useState, useCallback } from "react";
import {
  getSessionsActives,
  listerTemplates,
  proposerCalibrage,
  getConfigTemplate,
  getMesSessions,
  listerDemandesCalibrage,
  getRapportPdf,
  uploadAudioDrive,
  listerMesAssessments,
  soumettreAssessmentLibre,
  supprimerAssessmentLibre,
  type SessionInfo,
  type Template,
  type AssessmentLibreInfo,
} from "../lib/api";
import { HierarchicalEvaluationForm, type HierarchicalItem } from "./HierarchicalEvaluationForm";
import { AssessmentViewerModal } from "./AssessmentViewerModal";
import { AssessmentReportModal } from "./AssessmentReportModal";
import { CaliSyncLogo } from "./ui/CaliSyncLogo";
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
  Headphones,
  Trash2,
  Play,
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
  const [activeTab, setActiveTab] = useState<"actives" | "mes_sessions" | "mes_assessments" | "mes_demandes">("actives");
  const [mySessions, setMySessions] = useState<any[]>([]);
  const [myDemands, setMyDemands] = useState<any[]>([]);
  const [myAssessments, setMyAssessments] = useState<AssessmentLibreInfo[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Active Running Assessment State (supports both new & correction modes)
  const [runningAssessment, setRunningAssessment] = useState<{
    assessmentId?: string;
    templateId: string;
    templateNom: string;
    items: HierarchicalItem[];
    title: string;
    conseiller: string;
    audioUrl: string;
    consignes: string;
    initialAnswers?: Record<string, string>;
    initialComments?: Record<string, string>;
    initialInteractionSummary?: string;
    initialEvaluatorComments?: string;
    initialCorrectorName?: string;
    isCorrection?: boolean;
  } | null>(null);

  // Assessment Viewer Modal State
  const [selectedAssessmentToView, setSelectedAssessmentToView] = useState<AssessmentLibreInfo | null>(null);

  // Assessment Report Modal State
  const [selectedAssessmentForReport, setSelectedAssessmentForReport] = useState<AssessmentLibreInfo | null>(null);

  // New Assessment Modal State
  const [showNewAssessmentModal, setShowNewAssessmentModal] = useState(false);
  const [assTitle, setAssTitle] = useState("");
  const [assTemplate, setAssTemplate] = useState("");
  const [assConseiller, setAssConseiller] = useState("");
  const [assAudio, setAssAudio] = useState("");
  const [assAudioTab, setAssAudioTab] = useState<"file" | "link">("link");
  const [assAudioUploading, setAssAudioUploading] = useState(false);
  const [assConsignes, setAssConsignes] = useState("");
  const [assStarting, setAssStarting] = useState(false);
  const [assFeedback, setAssFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const fetchAssessments = useCallback(async () => {
    setLoadingAssessments(true);
    try {
      const res = await listerMesAssessments(identifiant);
      if (res.success && Array.isArray(res.assessments)) {
        setMyAssessments(res.assessments);
      }
    } catch (e) {
      console.error("Error fetching assessments:", e);
    } finally {
      setLoadingAssessments(false);
    }
  }, [identifiant]);

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
    fetchAssessments();
  }, [fetchHistory, fetchAssessments]);

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
  const [activePresetMinutes, setActivePresetMinutes] = useState<number | null>(60);

  const applyCloseDatePresetMinutes = useCallback((minutesToAdd: number) => {
    const target = new Date(Date.now() + minutesToAdd * 60 * 1000);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    const hh = String(target.getHours()).padStart(2, "0");
    const min = String(target.getMinutes()).padStart(2, "0");
    setPropCloseDate(`${yyyy}-${mm}-${dd}`);
    setPropCloseTime(`${hh}:${min}`);
  }, []);

  // Initialize default 60 min preset on mount
  useEffect(() => {
    applyCloseDatePresetMinutes(60);
  }, [applyCloseDatePresetMinutes]);

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

  const handleAssAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setAssFeedback({ success: false, message: "Fichier audio trop volumineux (max 20 Mo)." });
      return;
    }

    setAssAudioUploading(true);
    setAssFeedback({ success: true, message: "Téléversement de l'audio en cours..." });

    const reader = new FileReader();
    reader.onload = async () => {
      const resultStr = reader.result as string;
      const base64Data = resultStr.split(",")[1] || resultStr;
      const res = await uploadAudioDrive(base64Data, file.name, file.type || "audio/mp3");
      setAssAudioUploading(false);
      if (res && res.success && (res as any).url_audio) {
        setAssAudio((res as any).url_audio);
        setAssFeedback({ success: true, message: "Audio téléversé avec succès sur Google Drive !" });
      } else {
        setAssFeedback({ success: false, message: res?.message || "Erreur lors du téléversement audio." });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStartAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assTemplate) {
      setAssFeedback({ success: false, message: "Veuillez sélectionner une grille / template." });
      return;
    }
    const finalTitle = assTitle.trim() || `Assessment Libre — ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`;
    setAssStarting(true);
    setAssFeedback(null);

    try {
      const res = await getConfigTemplate(assTemplate);
      if (res.success && Array.isArray(res.items) && res.items.length > 0) {
        const foundTpl = templates.find((t) => t.template_id === assTemplate);
        setShowNewAssessmentModal(false);
        setRunningAssessment({
          templateId: assTemplate,
          templateNom: foundTpl?.nom || assTemplate,
          items: res.items,
          title: finalTitle,
          conseiller: assConseiller.trim(),
          audioUrl: assAudio.trim(),
          consignes: assConsignes.trim(),
        });
      } else {
        setAssFeedback({ success: false, message: "Impossible de charger la grille de ce template." });
      }
    } catch (e) {
      setAssFeedback({ success: false, message: "Erreur lors du chargement de la grille." });
    } finally {
      setAssStarting(false);
    }
  };

  const handleEditAssessment = async (assessment: AssessmentLibreInfo) => {
    try {
      const res = await getConfigTemplate(assessment.template_id);
      if (res.success && Array.isArray(res.items) && res.items.length > 0) {
        const foundTpl = templates.find((t) => t.template_id === assessment.template_id);
        setSelectedAssessmentToView(null);
        setRunningAssessment({
          assessmentId: assessment.assessment_id,
          templateId: assessment.template_id,
          templateNom: assessment.template_nom || foundTpl?.nom || assessment.template_id,
          items: res.items,
          title: assessment.titre,
          conseiller: assessment.nom_conseiller || "",
          audioUrl: assessment.audio_url || "",
          consignes: assessment.consignes || "",
          initialAnswers: assessment.reponses || {},
          initialComments: assessment.commentaires || {},
          initialInteractionSummary: assessment.interaction_summary || "",
          initialEvaluatorComments: assessment.evaluator_comments || "",
          initialCorrectorName: assessment.correcteur_nom || nomComplet || identifiant,
          isCorrection: true,
        });
      } else {
        alert("Impossible de charger la grille pour cet assessment.");
      }
    } catch (e) {
      console.error("Erreur lors de l'ouverture de la correction:", e);
      alert("Erreur lors de l'ouverture de la correction.");
    }
  };

  const handleSaveAssessment = async (payload: {
    answers: Record<string, string>;
    comments: Record<string, string>;
    score: number;
    interactionSummary: string;
    evaluatorComments: string;
    correctorName?: string;
  }) => {
    if (!runningAssessment) return;
    const isUpdate = !!runningAssessment.assessmentId;
    const assessmentId = runningAssessment.assessmentId || `ASSESS_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const savedAssessment: AssessmentLibreInfo = {
      assessment_id: assessmentId,
      evaluateur_id: identifiant,
      template_id: runningAssessment.templateId,
      template_nom: runningAssessment.templateNom,
      titre: runningAssessment.title,
      nom_conseiller: runningAssessment.conseiller,
      audio_url: runningAssessment.audioUrl,
      consignes: runningAssessment.consignes,
      score: payload.score,
      statut: "COMPLETED",
      date_creation: isUpdate
        ? (myAssessments.find((a) => a.assessment_id === assessmentId)?.date_creation || new Date().toISOString())
        : new Date().toISOString(),
      date_modification: isUpdate ? new Date().toISOString() : undefined,
      is_corrected: isUpdate,
      correcteur_nom: payload.correctorName || (isUpdate ? (nomComplet || identifiant) : undefined),
      interaction_summary: payload.interactionSummary,
      evaluator_comments: payload.evaluatorComments,
      reponses: payload.answers,
      commentaires: payload.comments,
    };

    await soumettreAssessmentLibre(savedAssessment);
    setMyAssessments((prev) => {
      if (isUpdate) {
        return prev.map((a) => (a.assessment_id === assessmentId ? savedAssessment : a));
      }
      return [savedAssessment, ...prev];
    });
    setRunningAssessment(null);
    setActiveTab("mes_assessments");

    if (isUpdate) {
      // Auto-open corrected report directly so the evaluator can review and print immediately
      setSelectedAssessmentForReport(savedAssessment);
    }
  };

  const handleDeleteAssessment = async (assessmentId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet assessment de votre historique ?")) return;
    await supprimerAssessmentLibre(assessmentId);
    setMyAssessments((prev) => prev.filter((a) => a.assessment_id !== assessmentId));
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
      // La Gauge voit TOUTES ses sessions (y compris LOCKED) afin de pouvoir
      // encore soumettre son évaluation de référence si elle ne l'a pas encore fait.
      const isMySession =
        !s.gauge_id && !s.animateur_id
          ? true // fallback pour sessions legacy
          : s.gauge_id?.toLowerCase() === identifiant.toLowerCase() ||
            s.animateur_id?.toLowerCase() === identifiant.toLowerCase();
      // Exclure CLOSED uniquement (session définitivement clôturée)
      return isMySession && s.statut !== "CLOSED";
    }
    // Les évaluateurs normaux voient uniquement les sessions OPEN
    // + sessions où ils ont déjà soumis (lecture seule)
    const alreadySubmitted = s.evaluateurs_soumis?.includes(identifiant);
    return s.statut === "OPEN" || (alreadySubmitted && s.statut !== "PENDING_GAUGE");
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
      <HierarchicalEvaluationForm
        items={proposalItems}
        isGaugeMode={true}
        sessionId={`PROP_${Date.now().toString().slice(-6)}`}
        evaluateurId={identifiant}
        callName={propTitle ? `${propTitle}${propConseiller ? ` — Conseiller : ${propConseiller}` : ""}` : (propConseiller || "Proposition de Calibrage")}
        audioUrl={propAudio}
        onSubmitPayload={handleFinalProposalSubmit}
        onBack={() => {
          setShowProposalGaugePage(false);
          setShowProposalModal(true);
        }}
        onComplete={() => {
          setShowProposalGaugePage(false);
          setPropTitle("");
          setPropConseiller("");
          setPropAudio("");
          setPropConsignes("");
          fetchSessions();
        }}
      />
    );
  }

  if (runningAssessment) {
    return (
      <HierarchicalEvaluationForm
        items={runningAssessment.items}
        isAssessmentMode={true}
        sessionId={`ASSESS_${runningAssessment.templateId}`}
        callName={runningAssessment.title}
        audioUrl={runningAssessment.audioUrl}
        evaluateurId={identifiant}
        initialAnswers={runningAssessment.initialAnswers}
        initialComments={runningAssessment.initialComments}
        initialInteractionSummary={runningAssessment.initialInteractionSummary}
        initialEvaluatorComments={runningAssessment.initialEvaluatorComments}
        initialCorrectorName={runningAssessment.initialCorrectorName}
        onAssessmentSubmit={handleSaveAssessment}
        onBack={() => setRunningAssessment(null)}
        onComplete={() => {
          setRunningAssessment(null);
          fetchAssessments();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Logo & User Identity */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors cursor-pointer flex-shrink-0"
              title="Retour à l'accueil"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <CaliSyncLogo size="md" showText={true} showBadge={true} badgeText="v2.0" />

            <div className="h-6 w-px bg-slate-200 hidden md:block" />

            <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-2xl">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#1dc4ff] to-[#0088cc] text-slate-950 font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                {nomComplet ? nomComplet.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 truncate">
                  <span className="truncate">{nomComplet}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex-shrink-0 ${
                      role === "gauge"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-[#1dc4ff]/10 text-[#0077aa] border border-[#1dc4ff]/20"
                    }`}
                  >
                    {role === "gauge" ? "Gauge" : "Évaluateur"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {identifiant}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions Bar */}
          <div className="flex items-center gap-2 flex-nowrap flex-shrink-0">
            <button
              onClick={() => {
                setAssFeedback(null);
                setShowNewAssessmentModal(true);
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 text-[#1dc4ff]" />
              <span className="hidden lg:inline">Nouvel Assessment Libre</span>
              <span className="lg:hidden hidden sm:inline">Assessment Libre</span>
              <span className="sm:hidden">Assessment</span>
            </button>

            <button
              onClick={() => setShowProposalModal(true)}
              className="px-3.5 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 text-xs font-black rounded-xl transition-all shadow-md shadow-[#1dc4ff]/20 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden lg:inline">Proposer un Calibrage</span>
              <span className="lg:hidden hidden sm:inline">Proposer</span>
              <span className="sm:hidden">+ Calibrage</span>
            </button>

            <button
              onClick={handleRefreshAll}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
              title="Actualiser"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={onBack}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap flex-shrink-0"
              title="Se déconnecter de l'application"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {error && (
            <div className="glass-card border-rose-500/30 p-5 rounded-2xl flex items-center gap-3 text-rose-300">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}
          {/* TABS SYSTEM */}
          <div className="flex border-b border-slate-200 gap-1 pb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab("actives")}
              className={`px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "actives"
                  ? "border-[#1dc4ff] text-[#009ae5] font-black"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              <Activity className="w-4.5 h-4.5" />
              Sessions Actives ({visibleSessions.length})
            </button>
            <button
              onClick={() => setActiveTab("mes_assessments")}
              className={`px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "mes_assessments"
                  ? "border-[#1dc4ff] text-[#009ae5] font-black"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              <FileText className="w-4.5 h-4.5" />
              Mes Assessments Libres ({myAssessments.length})
            </button>
            <button
              onClick={() => setActiveTab("mes_sessions")}
              className={`px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "mes_sessions"
                  ? "border-[#1dc4ff] text-[#009ae5] font-black"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              <CheckCircle2 className="w-4.5 h-4.5" />
              Mes Sessions ({mySessions.length})
            </button>
            <button
              onClick={() => setActiveTab("mes_demandes")}
              className={`px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === "mes_demandes"
                  ? "border-[#1dc4ff] text-[#009ae5] font-black"
                  : "border-transparent text-slate-400 hover:text-slate-700"
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
                <div className="bg-white border border-slate-200 p-16 rounded-2xl flex flex-col items-center justify-center space-y-4 shadow-sm">
                  <Loader2 className="w-10 h-10 text-[#1dc4ff] animate-spin" />
                  <p className="text-slate-500 text-sm font-medium">Chargement des sessions…</p>
                </div>
              )}

              {!loading && visibleSessions.length === 0 && (
                <div className="bg-white border border-slate-200 p-16 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <Inbox className="w-8 h-8 text-slate-400" />
                  </div>
                  <div className="max-w-md space-y-2">
                    <h3 className="text-lg font-bold text-slate-900">Aucune session ouverte actuellement</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Aucun calibrage n'est ouvert aux évaluateurs pour l'instant.
                      <br />
                      Vous pouvez <strong className="text-[#1dc4ff]">proposer un calibrage</strong> ci-dessus ou revenir dès qu'une session sera ouverte !
                    </p>
                  </div>
                  <button
                    onClick={() => setShowProposalModal(true)}
                    className="mt-2 px-5 py-2.5 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-md shadow-[#1dc4ff]/20 flex items-center gap-2 cursor-pointer"
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
                    className={`bg-white border rounded-2xl p-6 sm:p-8 space-y-5 transition-all shadow-sm ${
                      alreadySubmitted
                        ? "opacity-80 border-slate-200"
                        : isUrgent
                        ? "border-rose-300 shadow-rose-500/5 ring-2 ring-rose-200"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-extrabold text-slate-900">
                            {session.nom_session || session.session_id}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              session.statut === "OPEN"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : session.statut === "PENDING_GAUGE"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : session.statut === "LOCKED"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : session.statut === "GAUGE_DONE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {session.statut === "OPEN"
                              ? "En cours"
                              : session.statut === "PENDING_GAUGE"
                              ? "Attente Gauge"
                              : session.statut === "LOCKED"
                              ? "Soumissions closes"
                              : session.statut === "GAUGE_DONE"
                              ? "Gauge ✓"
                              : session.statut}
                          </span>

                          {alreadySubmitted && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Déjà soumis
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          ID: {session.session_id}
                        </div>
                      </div>

                      {session.statut === "OPEN" && countdownSec > 0 && (
                        <div
                          className={`flex items-center gap-2 px-5 py-3 rounded-2xl border ${
                            isUrgent
                              ? "bg-rose-50 border-rose-200 text-rose-700"
                              : "bg-slate-50 border-slate-200 text-slate-900"
                          }`}
                        >
                          <Clock className={`w-5 h-5 ${isUrgent ? "text-rose-600 animate-pulse" : "text-slate-400"}`} />
                          <span className={`font-black text-2xl tabular-nums tracking-tight ${isUrgent ? "text-rose-700" : "text-slate-900"}`}>
                            {formatCountdown(countdownSec)}
                          </span>
                        </div>
                      )}

                      {session.statut === "PENDING_GAUGE" && (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                          <Lock className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-bold text-amber-700">Code PIN requis</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Users className="w-4 h-4" />
                        <span className="font-bold text-slate-900">{session.nombre_evaluateurs_soumis}</span>
                        <span className="text-xs">soumission(s)</span>
                      </div>
                      {session.duree_minutes && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs">{session.duree_minutes} min</span>
                        </div>
                      )}
                      {session.gauge_soumis && (
                        <div className="flex items-center gap-1.5 text-emerald-600">
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
                            className={`w-full py-3.5 text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                              session.statut === "LOCKED"
                                ? "bg-amber-500 hover:bg-amber-400 shadow-amber-500/20"
                                : "bg-[#1dc4ff] hover:bg-[#009ae5] shadow-[#1dc4ff]/20"
                            }`}
                          >
                            <FileText className="w-4.5 h-4.5" />
                            {session.statut === "LOCKED" ? "⏰ Soumettre la Gauge hors délai" : "✏️ Remplir l'évaluation Gauge"}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onOpenCockpit?.(session.session_id)}
                              className="w-full py-3.5 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-md shadow-[#1dc4ff]/20 flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Sparkles className="w-4.5 h-4.5" /> 🚀 Accéder au Cockpit Live
                            </button>
                            {session.statut !== "CLOSED" && (
                              <button
                                onClick={() => handleEditGauge(session)}
                                disabled={fetchingConfigItems}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                {fetchingConfigItems ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <FileText className="w-4 h-4 text-slate-500" />
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
                        className="w-full py-3.5 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-md shadow-[#1dc4ff]/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ArrowRight className="w-4.5 h-4.5" /> 🟢 Commencer l'évaluation
                      </button>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {session.statut === "OPEN" ? (
                          <button
                            onClick={() => handleSessionClick(session)}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <FileText className="w-4 h-4" /> ✏️ Modifier mon évaluation (Avant Clôture)
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSessionClick(session)}
                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 👁️ Consulter mon évaluation (Lecture seule)
                          </button>
                        )}
                        <button
                          onClick={() => onOpenCockpit?.(session.session_id)}
                          className="w-full py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-[#1dc4ff]" /> 🚀 Suivre le Cockpit Live
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: MES ASSESSMENTS LIBRES */}
          {activeTab === "mes_assessments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#1dc4ff]" /> Mes Évaluations Libres & Entraînements
                  </h3>
                  <p className="text-xs text-slate-500">
                    Auto-évaluation, audits unitaires et exercices pratiques sans animateur.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAssFeedback(null);
                    setShowNewAssessmentModal(true);
                  }}
                  className="px-4 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black text-xs rounded-xl shadow-md shadow-[#1dc4ff]/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Nouvel Assessment
                </button>
              </div>

              {loadingAssessments && myAssessments.length === 0 ? (
                <div className="bg-white border border-slate-200 p-12 rounded-2xl flex flex-col items-center justify-center space-y-4 shadow-sm">
                  <Loader2 className="w-10 h-10 text-[#1dc4ff] animate-spin" />
                  <p className="text-slate-500 text-sm font-medium">Chargement de vos assessments…</p>
                </div>
              ) : myAssessments.length === 0 ? (
                <div className="bg-white border border-slate-200 p-12 rounded-2xl text-center space-y-4 shadow-sm">
                  <Inbox className="w-12 h-12 text-slate-400 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-base font-extrabold text-slate-800">Aucun assessment enregistré</h4>
                    <p className="text-slate-500 text-xs max-w-md mx-auto">
                      Vous n'avez pas encore réalisé d'évaluation libre. Démarrez un exercice pour vous entraîner sur une grille.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAssFeedback(null);
                      setShowNewAssessmentModal(true);
                    }}
                    className="px-4 py-2.5 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black text-xs rounded-xl shadow-md shadow-[#1dc4ff]/20 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Démarrer un premier assessment
                  </button>
                </div>
              ) : (
                myAssessments.map((ass) => {
                  return (
                    <div
                      key={ass.assessment_id}
                      className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4 hover:border-slate-300 transition-all shadow-sm group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-base font-black text-slate-900">{ass.titre}</h3>
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#1dc4ff]/10 text-[#0077aa] border border-[#1dc4ff]/20">
                              {ass.template_nom || ass.template_id}
                            </span>
                            {ass.audio_url && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                <Headphones className="w-3 h-3 text-[#1dc4ff]" /> Audio
                              </span>
                            )}
                            {ass.is_corrected && (
                              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Grille Corrigée
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                            {ass.nom_conseiller && (
                              <span>
                                ID Appel / Conseiller :{" "}
                                <strong className="font-mono text-slate-800">{ass.nom_conseiller}</strong>
                              </span>
                            )}
                            <span>
                              Enregistré le :{" "}
                              <strong className="text-slate-800">
                                {new Date(ass.date_creation).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </strong>
                            </span>
                            {ass.date_modification && (
                              <span className="text-emerald-700 font-medium">
                                (Dernière correction : {new Date(ass.date_modification).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})
                              </span>
                            )}
                            {ass.correcteur_nom && (
                              <span className="text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                Correcteur : <strong className="text-emerald-950">{ass.correcteur_nom}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {ass.interaction_summary && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 italic line-clamp-2">
                          "{ass.interaction_summary}"
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 flex-wrap">
                        <button
                          onClick={() => handleDeleteAssessment(ass.assessment_id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer mr-auto"
                          title="Supprimer cet assessment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* Bouton contextuel : Voir la correction si l'évaluation a été corrigée */}
                        {ass.is_corrected ? (
                          <button
                            onClick={() => setSelectedAssessmentForReport(ass)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Consulter la grille d'évaluation corrigée et l'imprimer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Voir la correction</span>
                          </button>
                        ) : null}

                        <button
                          onClick={() => setSelectedAssessmentToView(ass)}
                          className="px-4 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black text-xs rounded-xl shadow-md shadow-[#1dc4ff]/20 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> 👁️ Consulter la Grille
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: MES SESSIONS */}
          {activeTab === "mes_sessions" && (
            <div className="space-y-4">
              {loadingHistory && mySessions.length === 0 ? (
                <div className="bg-white border border-slate-200 p-12 rounded-2xl flex flex-col items-center justify-center space-y-4 shadow-sm">
                  <Loader2 className="w-10 h-10 text-[#1dc4ff] animate-spin" />
                  <p className="text-slate-500 text-sm font-medium">Chargement de votre historique…</p>
                </div>
              ) : mySessions.length === 0 ? (
                <div className="bg-white border border-slate-200 p-12 rounded-2xl text-center space-y-4 shadow-sm">
                  <Inbox className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-slate-500 text-sm">Vous n'avez participé à aucune session de calibrage pour le moment.</p>
                </div>
              ) : (
                mySessions.map((sess) => (
                  <div key={sess.session_id} className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4 hover:border-slate-300 transition-all shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-slate-900">{sess.nom_session}</h3>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            sess.statut === "CLOSED" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                            sess.statut === "LOCKED" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}>
                            {sess.statut === "CLOSED" ? "Clôturée" : sess.statut === "LOCKED" ? "Arbitrage" : "En cours"}
                          </span>
                        </div>
                        {sess.nom_conseiller && (
                          <p className="text-xs text-slate-500 mt-1">Connection ID : <span className="text-slate-900 font-mono">{sess.nom_conseiller}</span></p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sess.roles.map((r: string) => (
                          <span key={r} className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                            r === "Animateur" ? "bg-[#1dc4ff]/10 text-[#009ae5] border-[#1dc4ff]/30" :
                            r === "Gauge" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => onOpenCockpit?.(sess.session_id)}
                        className="px-4 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> 📊 Cockpit Live
                      </button>
                      {sess.roles.includes("Évaluateur") && (
                        <button
                          onClick={() => onOpenSubmission?.(sess.session_id)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-slate-600" /> 👁️ Consulter ma soumission
                        </button>
                      )}
                      {sess.statut === "CLOSED" && (
                        <button
                          onClick={() => handleDownloadPdf(sess.session_id)}
                          className="px-4 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
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
                <div className="bg-white border border-slate-200 p-12 rounded-2xl flex flex-col items-center justify-center space-y-4 shadow-sm">
                  <Loader2 className="w-10 h-10 text-[#1dc4ff] animate-spin" />
                  <p className="text-slate-500 text-sm font-medium">Chargement de vos demandes…</p>
                </div>
              ) : myDemands.length === 0 ? (
                <div className="bg-white border border-slate-200 p-12 rounded-2xl text-center space-y-4 shadow-sm">
                  <Inbox className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="text-slate-500 text-sm">Vous n'avez proposé aucune demande de calibrage.</p>
                </div>
              ) : (
                myDemands.map((dem) => (
                  <div key={dem.demande_id} className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4 hover:border-slate-300 transition-all shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-slate-900">{dem.nom_session}</h3>
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                            dem.statut === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            dem.statut === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            {dem.statut === "PENDING_APPROVAL" ? "En attente" : dem.statut === "APPROVED" ? "Approuvée" : "Rejetée"}
                          </span>
                        </div>
                        {dem.nom_conseiller && (
                          <p className="text-xs text-slate-500 mt-1">Connection ID : <span className="text-slate-900 font-mono">{dem.nom_conseiller}</span></p>
                        )}
                        {dem.date_demande && (
                          <p className="text-[10px] text-slate-400 mt-1">Demandée le : {new Date(dem.date_demande).toLocaleString()}</p>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl space-y-0.5">
                        <p>Template : <span className="text-slate-900 font-bold">{dem.template_id}</span></p>
                        <p>Durée : <span className="text-slate-900 font-bold">{dem.duree_minutes} mins</span></p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden my-auto">
            {/* Header & Step Tracker */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1dc4ff]/15 border border-[#1dc4ff]/30 flex items-center justify-center text-[#009ae5] flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-[#1dc4ff]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                      Proposer un Calibrage
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#1dc4ff]/10 text-[#0077aa] border border-[#1dc4ff]/20">
                      Étape 1 / 2
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Informations générales & support d'appel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProposalModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleProceedToGaugeStep} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {proposalFeedback && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold shadow-xs ${
                    proposalFeedback.success
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border border-rose-200 text-rose-800"
                  }`}
                >
                  {proposalFeedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span>{proposalFeedback.message}</span>
                </div>
              )}

              {/* CARD 1: INFORMATIONS SESSION & GRILLE */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Titre du Calibrage <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
                          const selectedTpl = templates.find((t) => t.template_id === propTemplate);
                          setPropTitle(`Calibrage ${selectedTpl?.nom || "Qualité"} — ${today}`);
                        }}
                        className="text-[10px] font-bold text-[#0077aa] hover:text-[#1dc4ff] transition-colors cursor-pointer flex items-center gap-0.5"
                      >
                        <Sparkles className="w-2.5 h-2.5" /> Auto-remplir
                      </button>
                    </div>
                    <input
                      type="text"
                      value={propTitle}
                      onChange={(e) => setPropTitle(e.target.value)}
                      placeholder="ex: Calibrage Équipe Vente N1"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Template de Grille <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={propTemplate}
                      onChange={(e) => setPropTemplate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-medium"
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-[#1dc4ff]" />
                      Connection ID (ID de Communication)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const dd = String(now.getDate()).padStart(2, "0");
                        const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
                        const mmm = months[now.getMonth()];
                        const yyyy = now.getFullYear();
                        const hh = String(now.getHours()).padStart(2, "0");
                        const min = String(now.getMinutes()).padStart(2, "0");
                        setPropConseiller(`221770000000|${dd}${mmm}${yyyy}|${hh}h${min}`);
                      }}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      Insérer format exemple
                    </button>
                  </div>
                  <input
                    type="text"
                    value={propConseiller}
                    onChange={(e) => setPropConseiller(e.target.value)}
                    placeholder="ex: 221770680391|07Aoû2026|10h44"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-mono font-medium"
                  />
                </div>
              </div>

              {/* CARD 2 : SUPPORT AUDIO */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5 text-[#1dc4ff]" /> Support Audio de l'Appel
                  </span>

                  {/* Sub-tabs Selector */}
                  <div className="flex items-center p-0.5 bg-slate-200/70 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPropAudioTab("link")}
                      className={`py-0.5 px-2 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        propAudioTab === "link"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Link className="w-2.5 h-2.5" /> Lien Drive / Web
                    </button>
                    <button
                      type="button"
                      onClick={() => setPropAudioTab("file")}
                      className={`py-0.5 px-2 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        propAudioTab === "file"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Upload className="w-2.5 h-2.5" /> Fichier local
                    </button>
                  </div>
                </div>

                {propAudioTab === "link" ? (
                  <div className="space-y-1">
                    <div className="relative">
                      <input
                        type="url"
                        value={propAudio}
                        onChange={(e) => setPropAudio(e.target.value)}
                        placeholder="Collez le lien Google Drive ou URL de l'audio..."
                        className="w-full pl-3 pr-16 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 text-xs font-medium"
                      />
                      {navigator.clipboard && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              if (text) setPropAudio(text.trim());
                            } catch (_) {}
                          }}
                          className="absolute right-1 top-1 bottom-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          Coller
                        </button>
                      )}
                    </div>
                    {propAudio && (
                      <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">Lien audio configuré</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {propAudio ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-emerald-800">Fichier audio importé</div>
                            <div className="text-[10px] text-slate-600 font-mono truncate">{propAudio}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPropAudio("")}
                          className="text-xs text-rose-600 hover:underline font-bold ml-2 flex-shrink-0 cursor-pointer"
                        >
                          Changer
                        </button>
                      </div>
                    ) : (
                      <label className="border border-dashed border-slate-300 hover:border-[#1dc4ff] hover:bg-[#1dc4ff]/5 rounded-xl p-2.5 cursor-pointer text-center transition-all flex items-center justify-center gap-2 group bg-white">
                        <Upload className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1dc4ff] transition-colors" />
                        <span className="text-xs font-bold text-slate-700">
                          {propAudioUploading ? "Importation vers Drive..." : "Sélectionner un fichier audio (MP3, WAV, M4A)"}
                        </span>
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
              </div>

              {/* CARD 3 : DÉLAI DE CLÔTURE */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#1dc4ff]" /> Clôture de la session <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">
                    Max 72h de délai
                  </span>
                </div>

                {/* Presets Grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "15 min", minutes: 15 },
                    { label: "30 min", minutes: 30 },
                    { label: "1 heure", minutes: 60 },
                    { label: "24 heures", minutes: 24 * 60 },
                  ].map((p) => {
                    const isSelected = activePresetMinutes === p.minutes;
                    return (
                      <button
                        key={p.minutes}
                        type="button"
                        onClick={() => {
                          setActivePresetMinutes(p.minutes);
                          applyCloseDatePresetMinutes(p.minutes);
                        }}
                        className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                          isSelected
                            ? "bg-[#1dc4ff] text-slate-950 border-[#1dc4ff] font-black shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <Zap className={`w-2.5 h-2.5 ${isSelected ? "text-slate-950" : "text-amber-500"}`} />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                      Date
                    </label>
                    <input
                      type="date"
                      value={propCloseDate}
                      onChange={(e) => {
                        setPropCloseDate(e.target.value);
                        setActivePresetMinutes(null);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#1dc4ff] text-xs font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                      Heure
                    </label>
                    <input
                      type="time"
                      value={propCloseTime}
                      onChange={(e) => {
                        setPropCloseTime(e.target.value);
                        setActivePresetMinutes(null);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#1dc4ff] text-xs font-medium"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* CARD 4 : CONSIGNES */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-slate-400" />
                  Notes / Consignes (facultatif)
                </label>
                <input
                  type="text"
                  value={propConsignes}
                  onChange={(e) => setPropConsignes(e.target.value)}
                  placeholder="ex: Porter une attention particulière sur la vérification d'identité (DPA)."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] transition-all text-xs font-medium"
                />
              </div>

              {/* FOOTER ACTIONS (Sticky at bottom of form) */}
              <div className="flex gap-2.5 pt-3 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setShowProposalModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={fetchingConfigItems}
                  className="flex-1 py-2.5 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md shadow-[#1dc4ff]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {fetchingConfigItems ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Étape 2 : Évaluation Gauge</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL : NOUVEL ASSESSMENT LIBRE / AUTO-ÉVALUATION ─────────────── */}
      {showNewAssessmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-xl shadow-2xl p-6 sm:p-7 space-y-5 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1dc4ff]/10 border border-[#1dc4ff]/20 flex items-center justify-center text-[#009ae5] flex-shrink-0">
                  <FileText className="w-5 h-5 text-[#1dc4ff]" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    Nouvel Assessment Libre
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Évaluation simple & entraînement autonome sur la grille de votre choix
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewAssessmentModal(false)}
                className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {assFeedback && (
              <div
                className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
                  assFeedback.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {assFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span>{assFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleStartAssessment} className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* CARD 1 : TEMPLATE & TITRE */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Grille / Template d'évaluation *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Requis</span>
                  </label>
                  <select
                    value={assTemplate}
                    onChange={(e) => setAssTemplate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-bold"
                    required
                  >
                    <option value="" disabled>Sélectionnez la grille...</option>
                    {templates.map((t) => (
                      <option key={t.template_id} value={t.template_id}>
                        {t.nom} ({t.template_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Titre / Nom de l'Assessment
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const dateStr = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                        setAssTitle(`Assessment Libre — ${dateStr}`);
                      }}
                      className="text-[10px] text-[#0088cc] hover:text-[#005588] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-[#1dc4ff]" /> Auto-nommer
                    </button>
                  </div>
                  <input
                    type="text"
                    value={assTitle}
                    onChange={(e) => setAssTitle(e.target.value)}
                    placeholder="ex: Entraînement Qualité — Appel Réclamation"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-medium"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      ID Appel / Réf Conseiller (facultatif)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const day = now.getDate().toString().padStart(2, "0");
                        const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
                        const m = months[now.getMonth()];
                        const y = now.getFullYear();
                        const h = now.getHours().toString().padStart(2, "0");
                        const min = now.getMinutes().toString().padStart(2, "0");
                        setAssConseiller(`22177${Math.floor(1000000 + Math.random() * 9000000)}|${day}${m}${y}|${h}h${min}`);
                      }}
                      className="text-[10px] text-[#0088cc] hover:text-[#005588] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-amber-500" /> Insérer format exemple
                    </button>
                  </div>
                  <input
                    type="text"
                    value={assConseiller}
                    onChange={(e) => setAssConseiller(e.target.value)}
                    placeholder="ex: 221770000000|21Aoû2026|10h44"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 transition-all text-xs font-mono font-medium"
                  />
                </div>
              </div>

              {/* CARD 2 : SUPPORT AUDIO */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5 text-[#1dc4ff]" /> Support Audio (Optionnel)
                  </span>

                  <div className="flex items-center p-0.5 bg-slate-200/70 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setAssAudioTab("link")}
                      className={`py-1 px-2.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        assAudioTab === "link"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Link className="w-3 h-3" /> Lien Web / Drive
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssAudioTab("file")}
                      className={`py-1 px-2.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        assAudioTab === "file"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Upload className="w-3 h-3" /> Fichier local
                    </button>
                  </div>
                </div>

                {assAudioTab === "link" ? (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <input
                        type="url"
                        value={assAudio}
                        onChange={(e) => setAssAudio(e.target.value)}
                        placeholder="Collez le lien Google Drive ou URL de l'audio..."
                        className="w-full pl-3.5 pr-20 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] focus:ring-2 focus:ring-[#1dc4ff]/20 text-xs font-medium"
                      />
                      {navigator.clipboard && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              if (text) setAssAudio(text.trim());
                            } catch (_) {}
                          }}
                          className="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          Coller
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {assAudio ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-emerald-800">Fichier audio importé</div>
                            <div className="text-[10px] text-slate-600 font-mono truncate">{assAudio}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAssAudio("")}
                          className="text-xs text-rose-600 hover:underline font-bold ml-2 flex-shrink-0 cursor-pointer"
                        >
                          Changer
                        </button>
                      </div>
                    ) : (
                      <label className="border border-dashed border-slate-300 hover:border-[#1dc4ff] hover:bg-[#1dc4ff]/5 rounded-xl p-3 cursor-pointer text-center transition-all flex items-center justify-center gap-2 group bg-white">
                        <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#1dc4ff] transition-colors" />
                        <span className="text-xs font-bold text-slate-700">
                          {assAudioUploading ? "Importation en cours..." : "Sélectionner un fichier audio (MP3, WAV, M4A)"}
                        </span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleAssAudioFileUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* CARD 3 : NOTES / OBJECTIF */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Notes / Objectif de l'entraînement (facultatif)
                </label>
                <textarea
                  rows={2}
                  value={assConsignes}
                  onChange={(e) => setAssConsignes(e.target.value)}
                  placeholder="ex: Focus sur la posture et la résolution au premier contact (FCR)."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1dc4ff] transition-all text-xs font-medium resize-none"
                />
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewAssessmentModal(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={assStarting || !assTemplate}
                  className="flex-1 py-3 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md shadow-[#1dc4ff]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {assStarting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>🟢 Démarrer l'Évaluation Libre</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL : CONSULTATION ASSESSMENT VIEWER ──────────────────────── */}
      {selectedAssessmentToView && (
        <AssessmentViewerModal
          assessment={selectedAssessmentToView}
          onClose={() => setSelectedAssessmentToView(null)}
          onEdit={handleEditAssessment}
          onOpenReport={(ass) => setSelectedAssessmentForReport(ass)}
        />
      )}

      {/* ── MODAL : RAPPORT DE CORRECTION & DÉBRIEFING ───────────────────── */}
      {selectedAssessmentForReport && (
        <AssessmentReportModal
          assessment={selectedAssessmentForReport}
          onClose={() => setSelectedAssessmentForReport(null)}
          onEdit={handleEditAssessment}
        />
      )}
    </div>
  );
};

export default EvaluateurLanding;
