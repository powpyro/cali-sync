import React, { useEffect, useState, useRef } from "react";
import {
  getSessionData,
  enregistrerDecisionsBatch,
  cloturerSession,
  getRapportPdf,
  type SessionDataResponse,
  type CockpitNode,
  type CockpitVote,
} from "../lib/api";
import { ArbitrageDrawer } from "./cockpit/ArbitrageDrawer";
import { VarianceReport } from "./cockpit/VarianceReport";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Coffee,
  BellRing,
  ArrowLeft,
  Users,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  Lock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  MinusCircle,
  Award,
  CornerDownRight,
  HelpCircle,
  Flame,
  Zap,
  Eye,
  EyeOff,
  Layers,
  CheckCircle,
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";

export interface ImputedSubItemInfo {
  node: CockpitNode;
  imputationCount: number;
  voterNames: string[];
}

export interface TreeImputationSummary {
  totalImputations: number;
  countN2: number;
  countN3: number;
  imputedItems: ImputedSubItemInfo[];
}

const getTreeImputationSummary = (rootNode: CockpitNode): TreeImputationSummary => {
  const summary: TreeImputationSummary = {
    totalImputations: 0,
    countN2: 0,
    countN3: 0,
    imputedItems: [],
  };

  const hasImputedChild = (node: CockpitNode): boolean => {
    if (!node.children || node.children.length === 0) return false;
    return node.children.some((child) => {
      const childVotes = child.votes_par_critere?.Non || [];
      return childVotes.length > 0 || hasImputedChild(child);
    });
  };

  const traverse = (node: CockpitNode) => {
    if (!node) return;

    const votesNon = node.votes_par_critere?.Non || [];

    // Only count as distinct leaf imputation if this node has Non votes AND no deeper child has Non votes
    if (votesNon.length > 0 && !hasImputedChild(node)) {
      summary.totalImputations += votesNon.length;
      if (node.niveau === 3) summary.countN2 += votesNon.length;
      if (node.niveau === 4) summary.countN3 += votesNon.length;

      summary.imputedItems.push({
        node,
        imputationCount: votesNon.length,
        voterNames: votesNon.map((v) => v.nom),
      });
    }

    if (node.children && node.children.length > 0) {
      node.children.forEach(traverse);
    }
  };

  if (rootNode.children && rootNode.children.length > 0) {
    rootNode.children.forEach(traverse);
  }

  return summary;
};

const nodeMatchesFilter = (node: CockpitNode, filter: "all" | "divergence" | "imputation" | "accord"): boolean => {
  if (filter === "all") return true;

  const votesNon = node.votes_par_critere?.Non || [];
  const hasNonVotes = votesNon.length > 0;
  const isDivergent = node.statut_accord === "divergence";
  const isAccord = node.statut_accord === "accord";

  if (filter === "divergence" && isDivergent) return true;
  if (filter === "imputation" && hasNonVotes) return true;
  if (filter === "accord" && isAccord && !hasNonVotes) return true;

  if (node.children && node.children.length > 0) {
    return node.children.some((child) => nodeMatchesFilter(child, filter));
  }

  return false;
};

export interface EvaluatorUser {
  id: string;
  nom: string;
  statut: "INVITE" | "SOUMIS" | "RATE" | "ANIME";
  justSubmitted?: boolean;
}

export interface CockpitScreenProps {
  sessionId?: string;
  onSeekAudio?: (seconds: number) => void;
  onBack?: () => void;
  initialSecondsLeft?: number;
}

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  rot: number;
  color: string;
}

// Evaluator Vote Badge with Hovercard Tooltip
interface EvaluatorVoteBadgeProps {
  vote: CockpitVote;
  critere: "Oui" | "Non" | "N.A." | string;
  parseTimestamps: (text: string) => React.ReactNode;
}

const EvaluatorVoteBadge: React.FC<EvaluatorVoteBadgeProps> = ({
  vote,
  critere,
  parseTimestamps,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const isNon = critere === "Non";
  const isOui = critere === "Oui";

  return (
    <div
      className="relative inline-block w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Evaluator Box Pill */}
      <div
        className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between shadow-xs hover:shadow-xl hover:-translate-y-0.5 ${
          isOui
            ? "bg-slate-900/90 border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/40"
            : isNon
            ? "bg-slate-900/90 border-rose-500/30 hover:border-rose-400 hover:bg-rose-950/40"
            : "bg-slate-900/90 border-slate-700 hover:border-slate-500 hover:bg-slate-800"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full font-black text-[11px] flex items-center justify-center shadow-md ${
              isOui
                ? "bg-emerald-500 text-slate-950"
                : isNon
                ? "bg-rose-500 text-white"
                : "bg-slate-700 text-slate-200"
            }`}
          >
            {getInitials(vote.nom)}
          </div>
          <span className="font-extrabold text-sm text-white tracking-wide">
            {vote.nom}
          </span>
        </div>

        {vote.commentaire ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
            💬 Justification
          </span>
        ) : (
          <span className="text-[10px] font-bold text-slate-400">
            Survoler ℹ️
          </span>
        )}
      </div>

      {/* ULTRA-STYLISH HOVER POPUP CARD */}
      {isHovered && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 sm:w-96 bg-slate-950/95 backdrop-blur-2xl border border-indigo-500/50 text-white shadow-2xl rounded-3xl p-5 space-y-3.5 pointer-events-auto animate-pop-in ring-1 ring-indigo-500/30">
          {/* Pointer Triangle Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-950/95" />

          {/* Header with Avatar & Status */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shadow-lg ${
                  isOui
                    ? "bg-emerald-500 text-slate-950 shadow-emerald-500/30"
                    : isNon
                    ? "bg-rose-500 text-white shadow-rose-500/30"
                    : "bg-slate-700 text-slate-200"
                }`}
              >
                {getInitials(vote.nom)}
              </div>
              <div>
                <div className="font-black text-sm text-white leading-snug">
                  {vote.nom}
                </div>
                <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                  Fiche d'Évaluation
                </div>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-md ${
                isOui
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : isNon
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-slate-800 text-slate-300 border border-slate-700"
              }`}
            >
              Répondu "{critere}"
            </span>
          </div>

          {/* Comment / Justification Section */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              💬 Justification & Extrait Horodaté :
            </div>

            {vote.commentaire ? (
              <div className="text-xs text-slate-100 font-medium leading-relaxed bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 shadow-inner">
                "{parseTimestamps(vote.commentaire)}"
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic p-3 bg-slate-900/50 rounded-2xl border border-slate-800/50">
                Aucun commentaire saisi pour cette réponse.
              </div>
            )}
          </div>

          {/* Footer Hint */}
          <div className="text-[10px] text-slate-400 font-extrabold tracking-wider text-right border-t border-slate-800/80 pt-2 flex items-center justify-end gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Clic sur un horodatage pour écouter l'extrait audio
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to clean raw CSV text in item labels
const cleanLibelle = (text: string): string => {
  if (!text) return "";
  // Split on comma to strip raw CSV columns if present
  const firstPart = text.split(",")[0].trim();
  return firstPart.replace(/^["']+|["']+$/g, "") || text;
};

export const CockpitScreen: React.FC<CockpitScreenProps> = ({
  sessionId,
  onSeekAudio,
  onBack,
  initialSecondsLeft = 180,
}) => {
  // Session Data State
  const [data, setData] = useState<SessionDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evaluators Waiting Room State
  const [evaluators, setEvaluators] = useState<EvaluatorUser[]>([]);
  const prevStatusesRef = useRef<Record<string, string>>({});

  // Timer State
  const [secondsLeft, setSecondsLeft] = useState(initialSecondsLeft);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const handleStartTimer = () => {
    if (secondsLeft === 0) setSecondsLeft(initialSecondsLeft);
    setIsTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setSecondsLeft(initialSecondsLeft);
  };

  // Audio Player State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Navigation State
  const [activeN1Index, setActiveN1Index] = useState(0);
  const [activeN2Index, setActiveN2Index] = useState(0);

  // Live Focus Filter State ('all' | 'divergence' | 'imputation' | 'accord')
  const [filterMode, setFilterMode] = useState<"all" | "divergence" | "imputation" | "accord">("all");

  // Sub-items drill-down toggle state
  const [expandedSubItems, setExpandedSubItems] = useState<Record<string, boolean>>({});
  const [isCascadeView, setIsCascadeView] = useState(true);
  const [compactParentView, setCompactParentView] = useState<Record<string, boolean>>({});

  const jumpToItem = (targetId: string) => {
    // Collect all ancestor IDs to ensure all parent branches are expanded
    const ancestorsToExpand: Record<string, boolean> = { [targetId]: true };
    const uncompactTargets: Record<string, boolean> = { [targetId]: false };

    const collectAncestors = (node: CockpitNode, path: string[] = []): boolean => {
      if (node.item_id === targetId) {
        path.forEach((id) => {
          ancestorsToExpand[id] = true;
          uncompactTargets[id] = false;
        });
        return true;
      }
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          if (collectAncestors(child, [...path, node.item_id])) {
            return true;
          }
        }
      }
      return false;
    };

    if (currentN2) {
      collectAncestors(currentN2);
    }

    // Update expanded sub-items state for all ancestors and target
    setExpandedSubItems((prev) => ({
      ...prev,
      ...ancestorsToExpand,
    }));

    // Ensure target item body is unfolded (not in compact mode)
    setCompactParentView((prev) => ({
      ...prev,
      ...uncompactTargets,
    }));

    // Scroll to target element once rendered
    setTimeout(() => {
      const el = document.getElementById(`item-card-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-4", "ring-amber-400", "scale-[1.02]", "transition-all", "duration-300");
        setTimeout(() => {
          el.classList.remove("ring-4", "ring-amber-400", "scale-[1.02]");
        }, 3000);
      }
    }, 200);
  };

  // Contextual Arbitrage Panel State
  const [selectedArbitrageNode, setSelectedArbitrageNode] = useState<CockpitNode | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Session closure state
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showClosedCockpit, setShowClosedCockpit] = useState(false);
  // LOCKED: toggle between Variance Report and Cockpit arbitrage
  const [showLockedCockpit, setShowLockedCockpit] = useState(false);

  // Confetti Animation Particles
  const [confettis, setConfettis] = useState<ConfettiParticle[]>([]);
  const greenItemsRef = useRef<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 1. Fetch / Poll session data
  const fetchSession = async (isInitialLoad = false) => {
    if (!sessionId) return;
    // Only show the full loading state on the very first load (no existing data)
    if (isInitialLoad || !data) setLoading(true);
    try {
      const res = await getSessionData(sessionId);
      setLoading(false);

      if (res && res.success) {
        setData(res);
        setError(null);

        if (res.heure_fin) {
          const fin = new Date(res.heure_fin).getTime();
          const remaining = Math.max(0, Math.floor((fin - Date.now()) / 1000));
          setSecondsLeft(remaining);
        }

        if (res.evaluateurs_soumis) {
          const submittedIds = res.evaluateurs_soumis;
          setEvaluators(
            submittedIds.map((id) => {
              const wasSubmitted = prevStatusesRef.current[id] === "SOUMIS";
              if (!wasSubmitted) prevStatusesRef.current[id] = "SOUMIS";
              return {
                id,
                nom: id.replace(".", " "),
                statut: "SOUMIS",
                justSubmitted: !wasSubmitted,
              };
            })
          );
        }
      } else {
        // If data already exists (polling failure), keep existing data visible and show a discreet toast
        if (data) {
          setLoading(false);
          showToast("⚠️ Actualisation échouée. Affichage des dernières données connues.");
        } else {
          // Initial load failure — show error screen
          setError(res?.message || "Impossible de charger les données du Cockpit.");
          setData(null);
        }
      }
    } catch {
      setLoading(false);
      if (data) {
        showToast("⚠️ Connexion interrompue. Affichage des dernières données connues.");
      } else {
        setError("Erreur de connexion au serveur.");
      }
    }
  };

  useEffect(() => {
    fetchSession(true); // initial load — shows splashscreen if no data
    if (!sessionId) return;
    // LOCKED and CLOSED sessions: no new submissions possible — polling is useless and disruptive
    if (data?.statut === "CLOSED" || data?.statut === "LOCKED") return;
    const pollInterval = setInterval(() => fetchSession(false), 12000); // background poll — never clears existing data
    return () => clearInterval(pollInterval);
  }, [sessionId, data?.statut]);

  useEffect(() => {
    if (evaluators.length === 0) return;
    const timer = setTimeout(() => {
      setEvaluators((prev) => prev.map((e) => ({ ...e, justSubmitted: false })));
    }, 800);
    return () => clearTimeout(timer);
  }, [evaluators]);

  useEffect(() => {
    if (!isTimerRunning || secondsLeft <= 0) return;
    const timerInterval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [isTimerRunning, secondsLeft]);

  const handleSeek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
    if (onSeekAudio) onSeekAudio(seconds);
  };

  const triggerConfetti = () => {
    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"];
    const particles: ConfettiParticle[] = [];

    for (let i = 0; i < 24; i++) {
      const tx = (Math.random() - 0.5) * 260;
      const ty = -120 - Math.random() * 160;
      const rot = Math.random() * 720;
      particles.push({
        id: Date.now() + i,
        x: 0,
        y: 0,
        tx,
        ty,
        rot,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    setConfettis(particles);
    setTimeout(() => setConfettis([]), 950);
  };

  useEffect(() => {
    if (!data?.grille_hierarchique) return;
    const checkTreeForGreen = (nodes: CockpitNode[]) => {
      nodes.forEach((node) => {
        if (node.statut_accord === "accord" && !greenItemsRef.current.has(node.item_id)) {
          greenItemsRef.current.add(node.item_id);
          triggerConfetti();
        }
        if (node.children && node.children.length > 0) {
          checkTreeForGreen(node.children);
        }
      });
    };
    checkTreeForGreen(data.grille_hierarchique);
  }, [data]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const parseTimestampsInText = (text: string) => {
    const regex = /(\[?\b([0-5]?\d):([0-5]\d)\b\]?)/g;
    const elements = [];
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        elements.push(text.substring(lastIdx, match.index));
      }
      const rawTime = match[1];
      const mins = parseInt(match[2], 10);
      const secs = parseInt(match[3], 10);
      const totalSecs = mins * 60 + secs;

      elements.push(
        <button
          key={match.index}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSeek(totalSecs);
          }}
          className="font-mono font-black text-indigo-400 underline hover:text-indigo-200 cursor-pointer px-2 py-0.5 rounded-md bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/50 transition-all mx-1 text-xs inline-flex items-center gap-1 shadow-xs"
          title={`Réécouter à ${rawTime}`}
        >
          <Play className="w-2.5 h-2.5 fill-indigo-400" /> {rawTime}
        </button>
      );
      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      elements.push(text.substring(lastIdx));
    }

    return elements;
  };

  // Open Arbitrage Drawer for a given node
  const openArbitrageModal = (node: CockpitNode) => {
    setSelectedArbitrageNode(node);
  };



  // Close Session
  const handleCloseSessionClick = async () => {
    if (!sessionId) return;

    // Verify all N1 items are arbitrated before allowing closure
    const allN1 = data?.grille_hierarchique || [];
    const unarbitratedN1 = allN1.filter((n1) => !n1.decision_finale);

    if (unarbitratedN1.length > 0) {
      alert(
        `⚠️ Clôture impossible :\n\n${unarbitratedN1.length} item(s) sur ${allN1.length} n'ont pas encore été arbitrés.\n\nVeuillez valider l'arbitrage de l'ensemble des items avant de procéder à la clôture afin de garantir un rapport complet.`
      );
      showToast(`⚠️ ${unarbitratedN1.length} item(s) non arbitré(s) restant(s).`);
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir clôturer définitivement cette session de calibrage ? Tous les items ont été arbitrés avec succès.")) return;

    setIsClosingSession(true);
    try {
      const res = await cloturerSession(sessionId, "admin");
      setIsClosingSession(false);
      if (res && res.success) {
        // Save PDF URL if returned immediately by GAS
        if ((res as any).pdf_url) setPdfUrl((res as any).pdf_url);
        showToast("✅ Session clôturée avec succès. Chargement du rapport...");
        // Delay fetch to let GAS finish writing CLOSED status
        setTimeout(() => fetchSession(false), 1800);
      } else {
        showToast(res?.message || "Erreur lors de la clôture.");
      }
    } catch {
      setIsClosingSession(false);
      showToast("Erreur réseau.");
    }
  };

  // Fetch PDF URL separately if not returned on cloture
  const handleFetchPdf = async () => {
    if (!sessionId) return;
    setPdfLoading(true);
    try {
      const res = await getRapportPdf(sessionId);
      if (res && res.success && (res as any).pdf_url) {
        setPdfUrl((res as any).pdf_url);
        window.open((res as any).pdf_url, "_blank");
      } else {
        showToast("Rapport PDF en cours de génération, veuillez réessayer dans quelques instants.");
      }
    } catch {
      showToast("Erreur lors de la récupération du rapport PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const sessionStatut = data?.statut;
  const isReadOnly = sessionStatut === "CLOSED";

  // ── LOADING SPLASHSCREEN ──────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 font-sans pb-16">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Retour au menu
          </button>
        )}
        <div className="glass-card rounded-3xl p-16 text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-teal-500/20 border border-indigo-500/30 flex items-center justify-center shadow-xl">
            <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            <h2 className="text-xl font-black text-white tracking-tight">Connexion au serveur Genii...</h2>
            <p className="text-slate-400 text-sm font-medium">Chargement de la session en cours. Merci de patienter.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── ÉCRAN VIDE (pas de session trouvée, pas de chargement en cours) ──────
  if (!sessionId || (!loading && !data)) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 font-sans pb-16">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Retour au menu
          </button>
        )}

        <div className="glass-card rounded-3xl p-12 text-center space-y-6 relative overflow-hidden">
          <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-purple-500/20 via-indigo-500/20 to-teal-500/20 border border-purple-500/30 flex items-center justify-center shadow-xl animate-bounce-gentle">
            <Coffee className="w-12 h-12 text-purple-400" />
          </div>

          <div className="space-y-3 max-w-md mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <BellRing className="w-3.5 h-3.5 text-purple-400" /> Cockpit Live ☕
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Aucun calibrage en cours !
            </h2>

            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              Le Cockpit Live est au repos. Prenez un café ☕ !<br />
              Dès qu'une session démarrera, les résultats s'afficheront en direct sur cet écran de projection.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium max-w-sm mx-auto flex items-center gap-2 justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="pt-4 flex justify-center">
            <button
              onClick={() => fetchSession(true)}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Vérifier à nouveau
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ÉCRAN DE BLOCAGE : PENDING_GAUGE ─────────────────────────────────────
  if (sessionStatut === "PENDING_GAUGE") {
    return (
      <div className="max-w-4xl mx-auto space-y-8 font-sans pb-16">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Retour au menu
          </button>
        )}
        <div className="glass-card rounded-3xl p-14 text-center space-y-6 border border-yellow-500/20">
          <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-yellow-500/20 via-amber-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center shadow-xl">
            <span className="text-5xl">⏳</span>
          </div>
          <div className="space-y-3 max-w-md mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs font-black uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-yellow-400" /> En Attente de la Gauge
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {data?.nom_session || "Session de calibrage"}
            </h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              La session est ouverte mais <strong className="text-yellow-300">l'évaluateur Gauge n'a pas encore soumis son évaluation</strong>.<br />
              Le Cockpit sera disponible dès que la Gauge aura évalué tous les items.
            </p>
          </div>
          <button onClick={() => fetchSession(true)} disabled={loading} className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-extrabold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 mx-auto">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>
      </div>
    );
  }

  // ── ÉCRAN DE BLOCAGE : GAUGE_DONE ────────────────────────────────────────
  if (sessionStatut === "GAUGE_DONE") {
    return (
      <div className="max-w-4xl mx-auto space-y-8 font-sans pb-16">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Retour au menu
          </button>
        )}
        <div className="glass-card rounded-3xl p-14 text-center space-y-6 border border-teal-500/20">
          <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-teal-500/20 via-emerald-500/20 to-cyan-500/20 border border-teal-500/30 flex items-center justify-center shadow-xl">
            <span className="text-5xl">⚙️</span>
          </div>
          <div className="space-y-3 max-w-md mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-black uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5 text-teal-400" /> Gauge Soumise — En Attente d'Ouverture
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {data?.nom_session || "Session de calibrage"}
            </h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              La Gauge a finalisé son évaluation. <strong className="text-teal-300">Les soumissions des évaluateurs ne sont pas encore ouvertes</strong>.<br />
              Le Cockpit Live s'activera automatiquement dès l'heure d'ouverture.
            </p>
            {data?.heure_fin && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                Ouverture prévue : {new Date(data.heure_fin).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
          <button onClick={() => fetchSession(true)} disabled={loading} className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 mx-auto">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>
      </div>
    );
  }

  // ── ÉCRAN LOCKED : RAPPORT DE VARIANCES POST-SOUMISSIONS ─────────────────
  if (sessionStatut === "LOCKED" && !showLockedCockpit) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 font-sans pb-16">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Retour au menu
          </button>
        )}

        {/* Status banner */}
        <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <div>
              <div className="text-xs font-black text-amber-300 uppercase tracking-wider">
                Soumissions Closes — Arbitrage disponible
              </div>
              <div className="text-sm font-black text-white">{data?.nom_session}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSession(false)}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </button>
            <button
              onClick={() => setShowLockedCockpit(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <Lock className="w-3.5 h-3.5" />
              Cockpit Arbitrage →
            </button>
          </div>
        </div>

        {/* Variance Report */}
        <VarianceReport
          grille={data?.grille_hierarchique || []}
          nomSession={data?.nom_session}
          onOpenCockpit={() => setShowLockedCockpit(true)}
        />
      </div>
    );
  }

  // ── ÉCRAN DÉDIÉ : SESSION CLÔTURÉE ──────────────────────────────────────────
  if (sessionStatut === "CLOSED" && !showClosedCockpit) {
    // Compute summary stats from the grille
    const allN1 = data?.grille_hierarchique || [];
    let totalItems = 0;
    let arbitratedItems = 0;
    let conformeItems = 0;
    let imputeItems = 0;
    const walkNodes = (nodes: CockpitNode[]) => {
      nodes.forEach((n) => {
        if (n.niveau !== 1) {
          totalItems++;
          if (n.decision_finale) {
            arbitratedItems++;
            if (n.decision_finale.decision === "Oui") conformeItems++;
            if (n.decision_finale.decision === "Non") imputeItems++;
          }
        }
        if (n.children && n.children.length > 0) walkNodes(n.children);
      });
    };
    walkNodes(allN1);
    const tauxConformite = totalItems > 0 ? Math.round((conformeItems / totalItems) * 100) : null;

    return (
      <div className="max-w-4xl mx-auto space-y-6 font-sans pb-16">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Retour au menu
          </button>
        )}

        {/* CLOSED Header Card */}
        <div className="glass-card rounded-3xl overflow-hidden border border-slate-700/50 shadow-2xl">
          {/* Top gradient banner */}
          <div className="h-2 bg-gradient-to-r from-slate-600 via-indigo-600 to-purple-600" />

          <div className="p-8 space-y-6">
            {/* Session badge + title */}
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-700/80 border border-slate-600 text-slate-300 text-xs font-black uppercase tracking-wider">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Session Archivée — Clôturée
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {data?.nom_session || "Session de calibrage"}
                </h1>
                {data?.nom_conseiller && (
                  <p className="text-slate-400 text-sm font-medium">
                    Conseiller évalué : <span className="text-white font-bold">{data.nom_conseiller}</span>
                  </p>
                )}
              </div>
              <div className="text-right space-y-1">
                {data?.heure_fin && (
                  <div className="text-xs text-slate-400 font-medium">
                    Clôturée le {new Date(data.heure_fin).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                )}
              </div>
            </div>

            {/* Summary Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-1">
                <div className="text-2xl font-black text-white">{totalItems}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items Total</div>
              </div>
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center space-y-1">
                <div className="text-2xl font-black text-indigo-300">{arbitratedItems}</div>
                <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Arbitrés</div>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                <div className="text-2xl font-black text-emerald-300">{conformeItems}</div>
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Conformes</div>
              </div>
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-1">
                <div className="text-2xl font-black text-rose-300">{imputeItems}</div>
                <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Imputés</div>
              </div>
            </div>

            {/* Taux de conformité bar */}
            {tauxConformite !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">Taux de conformité global</span>
                  <span className={`font-black text-base ${tauxConformite >= 70 ? "text-emerald-400" : tauxConformite >= 50 ? "text-amber-400" : "text-rose-400"}`}>
                    {tauxConformite}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${tauxConformite >= 70 ? "bg-emerald-500" : tauxConformite >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${tauxConformite}%` }}
                  />
                </div>
              </div>
            )}

            {/* Evaluators count */}
            {(data?.evaluateurs_soumis?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 text-sm">
                <Users className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="font-medium"><span className="font-black text-white">{data!.evaluateurs_soumis!.length}</span> évaluateur(s) ont participé à cette session</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Card */}
        <div className="glass-card rounded-3xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Actions disponibles
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {/* PDF Download */}
            <button
              onClick={() => pdfUrl ? window.open(pdfUrl, "_blank") : handleFetchPdf()}
              disabled={pdfLoading}
              className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 hover:border-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer disabled:opacity-50 group"
            >
              {pdfLoading ? (
                <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin flex-shrink-0" />
              ) : (
                <FileText className="w-6 h-6 text-indigo-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
              )}
              <div className="text-left">
                <div className="text-sm font-black text-white">
                  {pdfUrl ? "Ouvrir le Rapport PDF" : pdfLoading ? "Génération en cours..." : "Télécharger le Rapport PDF"}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Rapport complet du calibrage avec les arbitrages
                </div>
              </div>
              {pdfUrl && <ExternalLink className="w-4 h-4 text-indigo-400 ml-auto flex-shrink-0" />}
              {!pdfUrl && !pdfLoading && <Download className="w-4 h-4 text-indigo-400 ml-auto flex-shrink-0" />}
            </button>

            {/* Read-only Cockpit */}
            <button
              onClick={() => setShowClosedCockpit(true)}
              className="flex items-center gap-3 p-4 rounded-2xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 transition-all cursor-pointer group"
            >
              <Eye className="w-6 h-6 text-slate-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <div className="text-sm font-black text-white">Consulter le Cockpit</div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Lecture seule — tous les arbitrages validés
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 ml-auto flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Hierarchical Grid extraction
  const n1Roots = data?.grille_hierarchique || [];
  const currentN1 = n1Roots[activeN1Index] || null;
  const rawN2List = currentN1?.children || [];
  const currentN2List = rawN2List.filter((n2) => nodeMatchesFilter(n2, filterMode));
  const currentN2 = currentN2List[activeN2Index] || null;

  // Counts for Live Focus Bar in current N1 category
  const countAll = rawN2List.length;
  const countDivergences = rawN2List.filter((n2) => nodeMatchesFilter(n2, "divergence")).length;
  const countImputations = rawN2List.filter((n2) => nodeMatchesFilter(n2, "imputation")).length;
  const countAccords = rawN2List.filter((n2) => nodeMatchesFilter(n2, "accord")).length;

  // Global Navigation Counters
  let totalN2Count = 0;
  let currentGlobalN2Index = 0;
  n1Roots.forEach((n1, n1Idx) => {
    (n1.children || []).forEach((_, n2Idx) => {
      totalN2Count++;
      if (n1Idx < activeN1Index || (n1Idx === activeN1Index && n2Idx <= activeN2Index)) {
        currentGlobalN2Index++;
      }
    });
  });

  const handleNextItem = () => {
    if (activeN2Index < currentN2List.length - 1) {
      setActiveN2Index((prev) => prev + 1);
    } else if (activeN1Index < n1Roots.length - 1) {
      setActiveN1Index((prev) => prev + 1);
      setActiveN2Index(0);
    }
  };

  const handlePrevItem = () => {
    if (activeN2Index > 0) {
      setActiveN2Index((prev) => prev - 1);
    } else if (activeN1Index > 0) {
      const prevN1 = n1Roots[activeN1Index - 1];
      setActiveN1Index((prev) => prev - 1);
      setActiveN2Index(Math.max(0, (prevN1?.children?.length || 1) - 1));
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER SINGLE ITEM CARD (SHOWDOWN / ARENA DESIGN)
  // ─────────────────────────────────────────────────────────────────────────────
  const renderItemCard = (node: CockpitNode, isSubItem = false) => {
    const labelClean = cleanLibelle(node.libelle);
    const votesOui = node.votes_par_critere?.Oui || [];
    const votesNon = node.votes_par_critere?.Non || [];
    const votesNA = node.votes_par_critere?.["N.A."] || [];

    const isAccord = node.statut_accord === "accord";
    const isDivergence = node.statut_accord === "divergence";

    const gaugeCritere = node.gauge?.critere || "N/A";
    const gaugeComment = node.gauge?.commentaire || "";
    const hasGaugeVote = node.gauge?.critere && node.gauge.critere !== "N/A" && node.gauge.critere !== "";

    const treeSummary = getTreeImputationSummary(node);
    const isImputedHere = votesNon.length > 0;

    // Determine evaluator majority criteria
    const totalVotes = votesOui.length + votesNon.length + votesNA.length;
    let majorityCritere = "N/A";
    let majorityPercent = 0;
    if (totalVotes > 0) {
      if (votesOui.length >= votesNon.length && votesOui.length >= votesNA.length) {
        majorityCritere = "Oui";
        majorityPercent = Math.round((votesOui.length / totalVotes) * 100);
      } else if (votesNon.length >= votesOui.length && votesNon.length >= votesNA.length) {
        majorityCritere = "Non";
        majorityPercent = Math.round((votesNon.length / totalVotes) * 100);
      } else {
        majorityCritere = "N.A.";
        majorityPercent = Math.round((votesNA.length / totalVotes) * 100);
      }
    }

    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedSubItems[node.item_id] ?? isDivergence;
    
    // Auto-compact 0-vote sub-items by default to reduce visual clutter
    const isParentCompact = compactParentView[node.item_id] ?? (isSubItem && totalVotes === 0);

    // Check if parent N2 is validated Oui
    const isParentN2Oui =
      (currentN2?.statut_accord === "accord" &&
        (currentN2.votes_par_critere?.Oui?.length || 0) >=
          (currentN2.votes_par_critere?.Non?.length || 0)) ||
      currentN2?.decision_finale?.decision === "Oui";

    return (
      <div
        key={node.item_id}
        id={`item-card-${node.item_id}`}
        className={`rounded-3xl border transition-all duration-300 overflow-hidden ${
          isSubItem
            ? "bg-slate-900/90 border-slate-800 ml-4 sm:ml-8 mt-4 shadow-lg"
            : isImputedHere || treeSummary.totalImputations > 0
            ? "bg-slate-900/95 border-amber-500/60 shadow-2xl shadow-amber-950/40"
            : isAccord
            ? "bg-slate-900/95 border-emerald-500/50 shadow-2xl shadow-emerald-900/20"
            : isDivergence
            ? "bg-slate-900/95 border-rose-500/60 shadow-2xl shadow-rose-900/20"
            : "bg-slate-900/90 border-slate-800 shadow-xl"
        }`}
      >
        {/* ANCESTOR BREADCRUMB PATH & ANIMATOR COMPACT TOGGLE (FOR SUB-ITEMS N3/N4) */}
        {isSubItem && (
          <div className="bg-slate-950/80 px-6 py-2.5 border-b border-slate-800 flex items-center justify-between text-[11px] font-extrabold text-slate-400 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-500 uppercase font-black">Arborescence Parent :</span>
              <span className="text-indigo-300 font-bold">N1: {cleanLibelle(currentN1?.libelle || "")}</span>
              <span className="text-slate-600">➔</span>
              <span className="text-emerald-300 font-bold">N2: {cleanLibelle(currentN2?.libelle || "")}</span>
              <span className="text-slate-600">➔</span>
              <span className="text-amber-300 font-black">N{node.niveau}: {labelClean}</span>
            </div>

            <button
              type="button"
              onClick={() => setCompactParentView((prev) => ({ ...prev, [node.item_id]: !isParentCompact }))}
              className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer text-[10px] uppercase font-black shadow-xs"
            >
              {isParentCompact ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
              {isParentCompact ? "👁️ Vue Complète" : "👁️ Vue Focus"}
            </button>
          </div>
        )}

        {/* ITEM CARD HEADER */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base flex-shrink-0 mt-0.5 shadow-lg ${
                  isImputedHere || treeSummary.totalImputations > 0
                    ? "bg-amber-500 text-slate-950 shadow-amber-500/30"
                    : isAccord
                    ? "bg-emerald-500 text-slate-950 shadow-emerald-500/30"
                    : isDivergence
                    ? "bg-rose-500 text-white shadow-rose-500/30"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {isImputedHere || treeSummary.totalImputations > 0 ? (
                  <Flame className="w-7 h-7 text-slate-950 animate-bounce" />
                ) : isAccord ? (
                  <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                ) : isDivergence ? (
                  <Flame className="w-7 h-7 animate-pulse" />
                ) : (
                  <HelpCircle className="w-7 h-7" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-black border ${
                      node.niveau === 2
                        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                        : node.niveau === 3
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-purple-500/20 text-purple-300 border-purple-500/30"
                    }`}
                  >
                    {node.niveau === 2
                      ? "Item N1 — Question Principale"
                      : node.niveau === 3
                      ? "Sous-Item N2 — Motif └─"
                      : "Précision N3 — Comportement └─►"}
                  </span>

                  {isImputedHere && (
                    <span className="px-3 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 animate-pulse flex items-center gap-1 shadow-md shadow-amber-500/20">
                      <Flame className="w-3.5 h-3.5 fill-slate-950" /> 🔥 IMPUTÉ ({votesNon.length} vote{votesNon.length > 1 ? "s" : ""})
                    </span>
                  )}

                  {node.criticite === "Critical" && (
                    <span className="px-3 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> CRITIQUE
                    </span>
                  )}

                  {node.decision_finale ? (
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-black border flex items-center gap-1.5 shadow-sm ${
                        node.decision_finale.decision === "Oui"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : node.decision_finale.decision === "Non"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : "bg-slate-700/80 text-slate-300 border-slate-600"
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      ARBITRÉ : {node.decision_finale.decision === "Oui" ? "CONFORME (OUI)" : node.decision_finale.decision === "Non" ? "IMPUTÉ (NON)" : "NON APPLICABLE (N.A.)"}
                    </span>
                  ) : (
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-extrabold border ${
                        isAccord
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : isDivergence
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : isSubItem && isParentN2Oui && totalVotes === 0
                          ? "bg-slate-800/80 text-slate-400 border-slate-700/80"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {isAccord
                        ? "100% ACCORD UNANIME"
                        : isDivergence
                        ? "DIVERGENCE — DÉBAT EN LIVE"
                        : isSubItem && isParentN2Oui && totalVotes === 0
                        ? "NON REQUIS (Parent Validé Oui)"
                        : "EN ATTENTE VOTES"}
                    </span>
                  )}
                </div>

                <h3 className="font-black text-xl sm:text-2xl text-white leading-snug tracking-tight">
                  {labelClean}
                </h3>
              </div>
            </div>

            {/* Decision Status Badge or Action Button */}
            <div className="flex items-center gap-3">
              {node.decision_finale ? (
                <button
                  type="button"
                  onClick={() => !isReadOnly && openArbitrageModal(node)}
                  className={`px-4 py-2.5 rounded-2xl flex items-center gap-2.5 flex-shrink-0 shadow-md border transition-all ${
                    node.decision_finale.decision === "Oui"
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                      : node.decision_finale.decision === "Non"
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                      : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                  } ${!isReadOnly ? "cursor-pointer group" : ""}`}
                  title={!isReadOnly ? "Cliquer pour modifier l'arbitrage de cet item" : undefined}
                >
                  <Award className="w-5 h-5 flex-shrink-0 text-amber-400" />
                  <div className="text-left">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      Arbitrage Validé {!isReadOnly && <span className="text-[9px] underline font-normal">(Modifier)</span>}
                    </div>
                    <div className="text-xs font-black text-white">
                      Critère : {node.decision_finale.decision} {node.decision_finale.justification && `("${node.decision_finale.justification}")`}
                    </div>
                  </div>
                </button>
              ) : isReadOnly || isSubItem ? null : totalVotes === 0 && !node.gauge?.critere ? (
                <button
                  type="button"
                  disabled
                  className="px-4 py-2.5 bg-slate-800/80 text-slate-500 font-black text-xs rounded-2xl border border-slate-700/50 opacity-40 cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                  title="Aucun vote évaluateur soumis sur cet item"
                >
                  <Award className="w-4 h-4 text-slate-500" />
                  Arbitrage Inactif (0 Vote)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openArbitrageModal(node)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer flex-shrink-0"
                >
                  <Award className="w-4 h-4" />
                  ⚡ Arbitrer cet Item
                </button>
              )}
            </div>
          </div>
        </div>

        {/* NODE BODY (REPLIABLE SI 0 VOTE EN MODE COMPACT) */}
        {isParentCompact ? (
          <div
            onClick={() => setCompactParentView((prev) => ({ ...prev, [node.item_id]: false }))}
            className="p-4 bg-slate-950/70 border-t border-slate-800/80 text-xs font-extrabold text-slate-400 hover:bg-slate-900 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-400 border border-slate-700">
                N{node.niveau}
              </span>
              <span className="text-slate-300 font-bold group-hover:text-white transition-colors">
                {labelClean}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">(0 vote évaluateur — Replié)</span>
            </div>

            <div className="flex items-center gap-1.5 text-indigo-400 font-black text-[11px] group-hover:text-indigo-300">
              <span>Déployer pour examiner</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* IMPUTATION RADAR DASHBOARD (Only at N2 if sub-imputations exist) */}
            {node.niveau === 2 && treeSummary.totalImputations > 0 && (
              <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-500/50 shadow-xl space-y-3 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/30 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                    <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
                    RADAR D'IMPUTATIONS DÉTECTÉES ({treeSummary.totalImputations} au total)
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {treeSummary.countN2 > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Sous-Items N2: {treeSummary.countN2} motif(s)
                      </span>
                    )}
                    {treeSummary.countN3 > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Précisions N3: {treeSummary.countN3} précision(s)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {treeSummary.imputedItems.map((item) => (
                    <button
                      key={item.node.item_id}
                      type="button"
                      onClick={() => jumpToItem(item.node.item_id)}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/60 hover:border-amber-300 text-xs font-black text-amber-200 transition-all shadow-md flex items-center gap-2.5 cursor-pointer group"
                      title={`Accéder directement au ${item.node.niveau === 3 ? "Sous-Item N2" : "Précision N3"}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>[{item.node.niveau === 3 ? "Sous-Item N2" : "Précision N3"}] {cleanLibelle(item.node.libelle)}</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black shadow-xs">
                        {item.imputationCount} {item.imputationCount > 1 ? "imputations" : "imputation"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          <div className={hasGaugeVote ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "grid grid-cols-1 gap-6"}>
            {/* LEFT SHOWDOWN CARD: GAUGE */}
            {hasGaugeVote && (
              <div className="rounded-3xl p-5 bg-gradient-to-br from-indigo-950/90 via-slate-900 to-indigo-950/80 border border-indigo-500/40 shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between border-b border-indigo-500/30 pb-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-300">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" /> ÉVALUATEUR GAUGE
                  </div>
                  <span
                    className={`px-4 py-1.5 rounded-xl text-sm font-black uppercase tracking-wide shadow-md ${
                      gaugeCritere === "Oui"
                        ? "bg-emerald-500 text-slate-950"
                        : gaugeCritere === "Non"
                        ? "bg-rose-500 text-white"
                        : "bg-slate-700 text-slate-200"
                    }`}
                  >
                    {gaugeCritere}
                  </span>
                </div>

                {gaugeComment ? (
                  <div className="text-xs text-indigo-100 font-medium leading-relaxed bg-indigo-950/60 p-3.5 rounded-2xl border border-indigo-800/50">
                    "{parseTimestampsInText(gaugeComment)}"
                  </div>
                ) : (
                  <div className="text-xs text-indigo-400/70 italic p-2">
                    Aucun commentaire saisi par la Gauge.
                  </div>
                )}
              </div>
            )}

            {/* RIGHT SHOWDOWN CARD: EVALUATORS MAJORITY */}
            <div className="rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-700/80 shadow-xl space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
                  <Users className="w-5 h-5 text-teal-400" /> COHORTE ÉVALUATEURS
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">Majorité :</span>
                  <span
                    className={`px-4 py-1.5 rounded-xl text-sm font-black uppercase tracking-wide shadow-md ${
                      majorityCritere === "Oui"
                        ? "bg-emerald-500 text-slate-950"
                        : majorityCritere === "Non"
                        ? "bg-rose-500 text-white"
                        : "bg-slate-700 text-slate-200"
                    }`}
                  >
                    {majorityCritere} {totalVotes > 0 && `(${majorityPercent}%)`}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-400 font-medium">
                {totalVotes} évaluateur(s) ont voté sur cet item.
              </div>
            </div>
          </div>

          {/* VOTE GROUPS (ONLY RENDER CRITERIA THAT HAVE > 0 VOTES TO ELIMINATE CLUTTER) */}
          <div className="space-y-4">
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Détail des Répartitions par Critère :
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* OUI GROUP (Only if > 0 votes) */}
              {votesOui.length > 0 && (
                <div className="rounded-2xl p-4 bg-emerald-950/40 border border-emerald-500/40 space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
                    <span className="font-black text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" /> Répondu "Oui"
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-slate-950">
                      {votesOui.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {votesOui.map((v, idx) => (
                      <EvaluatorVoteBadge
                        key={idx}
                        vote={v}
                        critere="Oui"
                        parseTimestamps={parseTimestampsInText}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* NON GROUP (Only if > 0 votes) */}
              {votesNon.length > 0 && (
                <div className="rounded-2xl p-4 bg-rose-950/40 border border-rose-500/40 space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-rose-500/30 pb-2">
                    <span className="font-black text-xs uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <X className="w-4 h-4 text-rose-400" /> Répondu "Non"
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white">
                      {votesNon.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {votesNon.map((v, idx) => (
                      <EvaluatorVoteBadge
                        key={idx}
                        vote={v}
                        critere="Non"
                        parseTimestamps={parseTimestampsInText}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* N.A. GROUP (Only if > 0 votes) */}
              {votesNA.length > 0 && (
                <div className="rounded-2xl p-4 bg-slate-900/80 border border-slate-700 space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="font-black text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <MinusCircle className="w-4 h-4 text-slate-400" /> Répondu "N.A."
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-700 text-white">
                      {votesNA.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {votesNA.map((v, idx) => (
                      <EvaluatorVoteBadge
                        key={idx}
                        vote={v}
                        critere="N.A."
                        parseTimestamps={parseTimestampsInText}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SUB-ITEMS DRILL DOWN (N3 / N4 CASCADE TREE) */}
          {hasChildren && (
            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() =>
                  setExpandedSubItems((prev) => ({
                    ...prev,
                    [node.item_id]: !isExpanded,
                  }))
                }
                className="flex items-center gap-2 text-xs font-black text-indigo-400 hover:text-indigo-200 transition-colors cursor-pointer py-1"
              >
                <CornerDownRight className="w-4 h-4 text-indigo-400" />
                {isExpanded
                  ? `Masquer l'arborescence cascade (${node.children.length} ${node.niveau === 2 ? "Sous-Item(s) N2" : "Précision(s) N3"})`
                  : `Déployer l'arborescence cascade (${node.children.length} ${node.niveau === 2 ? "Sous-Item(s) N2" : "Précision(s) N3"})`}
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isExpanded && (
                <div
                  className={
                    isCascadeView
                      ? "relative border-l-2 border-indigo-500/40 pl-4 sm:pl-8 space-y-6 pt-4 ml-2 sm:ml-4"
                      : "space-y-4 pt-3"
                  }
                >
                  {node.children
                    .filter((child) => {
                      if (filterMode === "all") return true;
                      const childVotesNon = child.votes_par_critere?.Non || [];
                      if (filterMode === "divergence") return child.statut_accord === "divergence";
                      if (filterMode === "imputation") return childVotesNon.length > 0;
                      if (filterMode === "accord") return child.statut_accord === "accord";
                      return true;
                    })
                    .map((child) => (
                    <div key={child.item_id} className="relative">
                      {isCascadeView && (
                        <>
                          {/* Horizontal Branch Arm */}
                          <div className="absolute -left-4 sm:-left-8 top-8 w-4 sm:w-8 h-0.5 bg-indigo-500/40" />
                          {/* Junction Node Badge */}
                          <div className="absolute -left-6 sm:-left-10 top-6 w-5 h-5 rounded-full bg-slate-950 border-2 border-indigo-400 flex items-center justify-center text-[10px] font-black text-indigo-300 shadow-md">
                            {child.niveau}
                          </div>
                        </>
                      )}
                      {renderItemCard(child, true)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans pb-24 relative overflow-hidden">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 flex items-center gap-3 animate-pop-in">
          <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
          <span className="text-sm font-extrabold">{toastMsg}</span>
        </div>
      )}

      {/* Confetti Overlay */}
      {confettis.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          {confettis.map((c) => (
            <div
              key={c.id}
              className="absolute w-3.5 h-3.5 rounded-xs animate-confetti"
              style={{
                backgroundColor: c.color,
                //@ts-expect-error CSS variable passing
                "--tx": `${c.tx}px`,
                "--ty": `${c.ty}px`,
                "--rot": `${c.rot}deg`,
              }}
            />
          ))}
        </div>
      )}

      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Retour au menu
        </button>
      )}

      {/* 1. TOP HEADER & STUDIO BAR */}
      <section className="bg-slate-900/90 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Cockpit Live Arena
              </div>
              {/* SESSION STATUS BADGE */}
              {sessionStatut === "OPEN" && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-black uppercase tracking-wider animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  🔴 EN LIVE
                </div>
              )}
              {sessionStatut === "LOCKED" && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-wider">
                  <Lock className="w-3 h-3 text-amber-400" />
                  SOUMISSIONS CLOSES — ARBITRAGE EN COURS
                </div>
              )}
              {n1Roots.length > 0 && n1Roots.every((n) => !!n.decision_finale) && !isReadOnly && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wider">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  100% ARBITRÉ — PRÊT POUR CLÔTURE
                </div>
              )}
              {sessionStatut === "CLOSED" && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/80 text-slate-300 border border-slate-600 text-xs font-black uppercase tracking-wider">
                  <CheckCircle className="w-3 h-3 text-slate-400" />
                  SESSION ARCHIVÉE
                </div>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {data?.nom_session || "Session Live"}
              {data?.nom_conseiller && (
                <span className="text-slate-400 font-medium text-lg block sm:inline sm:ml-2">
                  — Conseiller : {data.nom_conseiller}
                </span>
              )}
            </h1>
            {isReadOnly && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-bold">
                👁️ MODE LECTURE SEULE — Session archivée. Aucune modification possible.
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Soumis :</span>
              <span className="font-black text-xl text-white">{evaluators.length}</span>
            </div>

            {isReadOnly && (
              <button
                type="button"
                onClick={() => setShowClosedCockpit(false)}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-extrabold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour au résumé
              </button>
            )}

            {sessionStatut === "LOCKED" && (
              <button
                type="button"
                onClick={() => setShowLockedCockpit(false)}
                className="px-4 py-2.5 bg-amber-600/30 hover:bg-amber-600/40 border border-amber-500/30 text-amber-200 font-extrabold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Rapport de Variances
              </button>
            )}

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleCloseSessionClick}
                disabled={isClosingSession}
                className={`px-4 py-2.5 font-extrabold text-xs rounded-2xl transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                  n1Roots.length > 0 && n1Roots.every((n) => !!n.decision_finale)
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-2 ring-rose-400/80 animate-pulse"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                }`}
                title={
                  n1Roots.length > 0 && n1Roots.every((n) => !!n.decision_finale)
                    ? "Tous les items sont arbitrés — Prêt pour la clôture !"
                    : "Il reste des items à arbitrer avant la clôture"
                }
              >
                {isClosingSession ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                Clôturer Session {n1Roots.length > 0 && n1Roots.every((n) => !!n.decision_finale) && "✅"}
              </button>
            )}
          </div>
        </div>


        {/* Audio Player Bar */}
        {data?.url_audio && (
          <div className="p-4 rounded-2xl bg-slate-950 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800 shadow-md">
            <audio
              ref={audioRef}
              src={data.url_audio}
              onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
              onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
              onEnded={() => setIsPlaying(false)}
            />

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  if (audioRef.current) {
                    if (isPlaying) {
                      audioRef.current.pause();
                      setIsPlaying(false);
                    } else {
                      audioRef.current.play().catch(() => {});
                      setIsPlaying(true);
                    }
                  }
                }}
                className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-md cursor-pointer transition-all flex-shrink-0"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-slate-950" /> : <Play className="w-5 h-5 fill-slate-950" />}
              </button>

              <div className="space-y-0.5">
                <div className="text-xs font-black flex items-center gap-1.5 text-slate-200">
                  <Volume2 className="w-4 h-4 text-emerald-400" /> Extrait Audio de l'Appel
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>
            </div>

            <div className="w-full sm:w-72 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurrentTime(val);
                  if (audioRef.current) audioRef.current.currentTime = val;
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Avatars Grid */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {evaluators.length === 0 ? (
            <div className="text-xs text-slate-400 italic">
              En attente des soumissions des évaluateurs…
            </div>
          ) : (
            evaluators.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-xs">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
                  {getInitials(ev.nom)}
                </div>
                <span className="text-xs font-extrabold text-slate-200">{ev.nom.split(" ")[0]}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 2. TIMER & PROGRESS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col items-center justify-center text-center space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-400" /> Chronomètre Débat Live
          </div>
          <div
            className={`tabular-timer font-black text-5xl tracking-tight ${
              secondsLeft <= 10 && secondsLeft > 0
                ? "text-rose-500 animate-timer-warning"
                : "text-white"
            }`}
          >
            {formatTime(secondsLeft)}
          </div>

          {/* Timer Control Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {!isTimerRunning ? (
              <button
                type="button"
                onClick={handleStartTimer}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                {secondsLeft === 0 ? "▶ Démarrer le Débat (3 min)" : "▶ Reprendre Débat"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePauseTimer}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5 fill-slate-950" />
                ⏸ Pause Débat
              </button>
            )}

            <button
              type="button"
              onClick={handleResetTimer}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
              title="Réinitialiser le chrono à 3:00"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 🔄 3:00
            </button>
          </div>
        </div>

        <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col justify-center space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Progression Équipes / Items (N2)
            </span>
            <span className="text-xs font-black text-emerald-400">
              Item {currentGlobalN2Index} sur {totalN2Count}
            </span>
          </div>

          <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 shadow-md shadow-emerald-500/20"
              style={{
                width: `${totalN2Count > 0 ? (currentGlobalN2Index / totalN2Count) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* 3. ITEM-BY-ITEM NAVIGATION & MAIN CALIBRATION SECTION */}
      {n1Roots.length > 0 && (
        <section className="space-y-6">
          {/* N1 BREADCRUMB / TABS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {n1Roots.map((n1, idx) => {
              const isN1Active = idx === activeN1Index;
              const hasDivergenceInN1 = (n1.children || []).some(
                (child) => child.statut_accord === "divergence"
              );

              return (
                <button
                  key={n1.item_id}
                  type="button"
                  onClick={() => {
                    setActiveN1Index(idx);
                    setActiveN2Index(0);
                  }}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 flex-shrink-0 ${
                    isN1Active
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                      : "bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {hasDivergenceInN1 ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  )}
                  {cleanLibelle(n1.libelle)}
                </button>
              );
            })}
          </div>

          {/* LIVE FOCUS BAR (FILTRES DYNAMIQUES DU COCKPIT) */}
          <div className="flex items-center gap-2 overflow-x-auto p-2 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm scrollbar-none">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-2 flex-shrink-0">
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Focus Live :
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterMode("all");
                setActiveN2Index(0);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex-shrink-0 ${
                filterMode === "all"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Tous les items ({countAll})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode("divergence");
                setActiveN2Index(0);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                filterMode === "divergence"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                  : "bg-slate-950 text-amber-400 hover:bg-amber-500/10 border border-slate-800"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" /> 🔥 Divergences ({countDivergences})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode("imputation");
                setActiveN2Index(0);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                filterMode === "imputation"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                  : "bg-slate-950 text-rose-400 hover:bg-rose-500/10 border border-slate-800"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> 🎯 Imputations N2/N3 ({countImputations})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode("accord");
                setActiveN2Index(0);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                filterMode === "accord"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                  : "bg-slate-950 text-emerald-400 hover:bg-emerald-500/10 border border-slate-800"
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> 🟢 Accords ({countAccords})
            </button>
          </div>

          {/* ITEM NAVIGATION CONTROLS */}
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md">
            <button
              type="button"
              onClick={handlePrevItem}
              disabled={activeN1Index === 0 && activeN2Index === 0}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" /> Item Précédent
            </button>

            <div className="flex items-center gap-4">
              <div className="text-center hidden sm:block">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Catégorie : {cleanLibelle(currentN1?.libelle || "")}
                </span>
                <div className="text-sm font-black text-white">
                  Item N1 : {activeN2Index + 1} / {currentN2List.length}
                </div>
              </div>

              {/* Cascade Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsCascadeView(!isCascadeView)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isCascadeView
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
                title="Activer/Désactiver l'arborescence graphique avec lignes de connexion"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-indigo-400" />
                {isCascadeView ? "Mode Cascade 🌿" : "Mode Focus 🎯"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleNextItem}
              disabled={
                activeN1Index === n1Roots.length - 1 &&
                activeN2Index === currentN2List.length - 1
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-30"
            >
              Item Suivant <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* CURRENT N2 QUESTION CARD */}
          {currentN2 ? (
            renderItemCard(currentN2)
          ) : (
            <div className="p-10 bg-slate-900 rounded-3xl border border-slate-800 text-center space-y-4 shadow-xl">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="text-base font-black text-white">Aucun item correspondant</h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Aucun item ne correspond au filtre{" "}
                  <strong className="text-indigo-300">
                    "{filterMode === "divergence" ? "Divergences" : filterMode === "imputation" ? "Imputations N3/N4" : filterMode === "accord" ? "Accords" : filterMode}"
                  </strong>{" "}
                  dans la catégorie <strong className="text-white">{cleanLibelle(currentN1?.libelle || "")}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterMode("all");
                  setActiveN2Index(0);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-md shadow-indigo-600/20"
              >
                Réinitialiser le filtre (Voir tous les items)
              </button>
            </div>
          )}
        </section>
      )}

      {/* CONTEXTUAL ARBITRAGE DRAWER */}
      <ArbitrageDrawer
        isOpen={!!selectedArbitrageNode}
        node={selectedArbitrageNode}
        onClose={() => setSelectedArbitrageNode(null)}
        onSave={async (payload) => {
          if (!selectedArbitrageNode || !sessionId) return;

          const requests: Array<{ itemId: string; decision: "Oui" | "Non" | "N.A." }> = [];

          // 1. Record N1 Item decision
          requests.push({ itemId: payload.n1Id, decision: payload.n1Decision });

          if (payload.n1Decision === "Non") {
            const n2Children = selectedArbitrageNode.children || [];
            n2Children.forEach((n2) => {
              const isN2Imputed = payload.selectedN2Ids.includes(n2.item_id);
              requests.push({ itemId: n2.item_id, decision: isN2Imputed ? "Non" : "Oui" });

              if (n2.children && n2.children.length > 0) {
                n2.children.forEach((n3) => {
                  const isN3Imputed = isN2Imputed && payload.selectedN3Ids.includes(n3.item_id);
                  requests.push({ itemId: n3.item_id, decision: isN3Imputed ? "Non" : "Oui" });
                });
              }
            });
          } else if (payload.n1Decision === "Oui" || payload.n1Decision === "N.A.") {
            // Auto-resolve all children to Oui / N.A.
            const resolveChildren = (node: CockpitNode) => {
              if (node.children && node.children.length > 0) {
                node.children.forEach((child) => {
                  requests.push({ itemId: child.item_id, decision: payload.n1Decision });
                  resolveChildren(child);
                });
              }
            };
            resolveChildren(selectedArbitrageNode);
          }

          // 2. Optimistically update local React state immediately for instant feedback
          setData((prevData) => {
            if (!prevData || !prevData.grille_hierarchique) return prevData;
            const updateNodes = (nodes: CockpitNode[]): CockpitNode[] => {
              return nodes.map((n) => {
                const match = requests.find((r) => r.itemId === n.item_id);
                let updated = n;
                if (match) {
                  const specComm = payload.itemComments[n.item_id]?.trim();
                  const finalJust = specComm || payload.justification;
                  updated = {
                    ...n,
                    decision_finale: {
                      decision: match.decision,
                      justification: finalJust,
                      animateur_id: "admin",
                      timestamp: new Date().toISOString(),
                    },
                  };
                }
                if (updated.children && updated.children.length > 0) {
                  updated = {
                    ...updated,
                    children: updateNodes(updated.children),
                  };
                }
                return updated;
              });
            };
            return {
              ...prevData,
              grille_hierarchique: updateNodes(prevData.grille_hierarchique),
            };
          });

          showToast(
            `Arbitrage multi-imputations enregistré (${requests.length} niveau(x) mis à jour) !`
          );
          setSelectedArbitrageNode(null);

          try {
            const batchItems = requests.map((r) => {
              const specificComment = payload.itemComments[r.itemId]?.trim();
              const finalJustification = specificComment || payload.justification;
              return {
                itemId: r.itemId,
                decision: r.decision,
                justification: finalJustification,
              };
            });

            await enregistrerDecisionsBatch(sessionId, batchItems, "admin");
            // Delay background sync to allow Google Apps Script to finish writing to Google Sheets
            setTimeout(() => fetchSession(false), 1500);
          } catch {
            showToast("Erreur réseau lors de la sauvegarde d'arbitrage.");
          }
        }}
      />
    </div>
  );
};

export default CockpitScreen;
