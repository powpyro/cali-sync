import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  getSessionData,
  enregistrerDecisionsBatch,
  cloturerSession,
  reinitialiserArbitrages,
  getRapportPdf,
  type SessionDataResponse,
  type CockpitNode,
  type CockpitVote,
} from "../lib/api";
import { ArbitrageDrawer } from "./cockpit/ArbitrageDrawer";
import { VarianceReport } from "./cockpit/VarianceReport";
import { AudioPlayer } from "./AudioPlayer";
import { CaliSyncLogo } from "./ui/CaliSyncLogo";
import { ArbitrageReportModal } from "./ArbitrageReportModal";
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
  Lock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  MinusCircle,
  Award,
  RotateCcw,
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
  MessageSquare,
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

const nodeMatchesFilter = (node: CockpitNode, filter: "all" | "imputation" | "accord"): boolean => {
  if (filter === "all") return true;

  const votesNon = node.votes_par_critere?.Non || [];
  const hasNonVotes = votesNon.length > 0;
  const isAccord = node.statut_accord === "accord";

  if (filter === "imputation" && hasNonVotes) return true;
  if (filter === "accord" && isAccord) return true;

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
  userRole?: string;
  userIdentifiant?: string;
  onSeekAudio?: (seconds: number) => void;
  onBack?: () => void;
  readOnly?: boolean;
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
  node?: CockpitNode;
  parseTimestamps: (text: string) => React.ReactNode;
}

const getEvaluatorCommentsForNode = (
  vote: CockpitVote,
  node?: CockpitNode
): Array<{ itemLibelle?: string; comment: string }> => {
  const results: Array<{ itemLibelle?: string; comment: string }> = [];
  const evaluatorName = (vote.nom || "").trim().toLowerCase();

  // 1. Direct comment on vote object
  const directComment = (
    vote.commentaire ||
    (vote as any).comment ||
    (vote as any).justification ||
    (vote as any).remarque ||
    ""
  ).trim();

  if (directComment) {
    results.push({ comment: directComment });
  }

  // 2. Search recursively in node's children sub-items for comments by this evaluator
  if (node && node.children && node.children.length > 0) {
    const collectFromSubtree = (n: CockpitNode) => {
      const allSubVotes: CockpitVote[] = [
        ...(n.votes_par_critere?.Oui || []),
        ...(n.votes_par_critere?.Non || []),
        ...(n.votes_par_critere?.["N.A."] || []),
      ];

      allSubVotes.forEach((subVote) => {
        const subEvalName = (subVote.nom || "").trim().toLowerCase();
        if (subEvalName === evaluatorName && evaluatorName.length > 0) {
          const subComm = (
            subVote.commentaire ||
            (subVote as any).comment ||
            (subVote as any).justification ||
            ""
          ).trim();

          if (subComm && !results.some((r) => r.comment === subComm)) {
            const cleanName = n.libelle.replace(/^\[.*?\]\s*/, "").replace(/^[-\d.]+\s*/, "");
            results.push({
              itemLibelle: `[N${n.niveau}] ${cleanName}`,
              comment: subComm,
            });
          }
        }
      });

      if (n.children && n.children.length > 0) {
        n.children.forEach(collectFromSubtree);
      }
    };

    node.children.forEach(collectFromSubtree);
  }

  return results;
};

const EvaluatorVoteBadge: React.FC<EvaluatorVoteBadgeProps> = ({
  vote,
  critere,
  node,
  parseTimestamps,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const commentsList = useMemo(() => getEvaluatorCommentsForNode(vote, node), [vote, node]);
  const hasComments = commentsList.length > 0;

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
      onMouseEnter={() => {
        if (hasComments) setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Evaluator Box Pill */}
      <div
        className={`p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between shadow-xs ${
          hasComments ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "cursor-default"
        } ${
          isOui
            ? "bg-white border-emerald-200 hover:border-emerald-400"
            : isNon
            ? "bg-white border-rose-200 hover:border-rose-400"
            : "bg-white border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full font-black text-[11px] flex items-center justify-center ${
              isOui
                ? "bg-emerald-500 text-white"
                : isNon
                ? "bg-rose-500 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {getInitials(vote.nom)}
          </div>
          <span className="font-extrabold text-sm text-slate-800 tracking-wide">
            {vote.nom}
          </span>
        </div>

        {hasComments && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#1dc4ff]/10 text-[#0077aa] border border-[#1dc4ff]/30 flex items-center gap-1">
            💬 {commentsList.length > 1 ? `(${commentsList.length})` : ""}
          </span>
        )}
      </div>

      {/* HOVER POPUP CARD (ONLY WHEN COMMENTS EXIST) */}
      {isHovered && hasComments && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 sm:w-96 bg-white border border-slate-200 text-slate-800 shadow-2xl rounded-2xl p-5 space-y-3.5 pointer-events-auto animate-pop-in">
          {/* Pointer Triangle Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white" />

          {/* Header with Avatar & Status */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                  isOui
                    ? "bg-emerald-500 text-white"
                    : isNon
                    ? "bg-rose-500 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {getInitials(vote.nom)}
              </div>
              <div>
                <div className="font-black text-sm text-slate-900 leading-snug">
                  {vote.nom}
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Fiche d'Évaluation
                </div>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                isOui
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : isNon
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              Répondu "{critere}"
            </span>
          </div>

          {/* Comment / Justification Section */}
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#0077aa] flex items-center gap-1.5">
              💬 Justification & Extrait Horodaté ({commentsList.length}) :
            </div>

            {hasComments ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {commentsList.map((c: { itemLibelle?: string; comment: string }, i: number) => (
                  <div
                    key={i}
                    className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1"
                  >
                    {c.itemLibelle && (
                      <div className="text-[10px] font-bold text-slate-500 font-mono">
                        {c.itemLibelle}
                      </div>
                    )}
                    <div>"{parseTimestamps(c.comment)}"</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                Aucun commentaire saisi pour cette réponse.
              </div>
            )}
          </div>

          {/* Footer Hint */}
          <div className="text-[10px] text-slate-500 font-bold tracking-wider text-right border-t border-slate-100 pt-2 flex items-center justify-end gap-1">
            <Sparkles className="w-3 h-3 text-[#1dc4ff]" /> Clic sur un horodatage pour écouter l'extrait audio
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
  userRole,
  userIdentifiant,
  onSeekAudio,
  onBack,
  readOnly = false,
}) => {
  // Session Data State
  const [data, setData] = useState<SessionDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user has permission to arbitrate (Admin, Animateur, Gauge, or session assigned ID)
  const canArbitrate = useMemo(() => {
    const role = (userRole || data?.user_role || "").toLowerCase();
    const isElevatedRole = role === "admin" || role === "animateur" || role === "gauge" || role === "cockpit";
    const isAssignedUser =
      !!userIdentifiant &&
      ((data?.gauge_id && userIdentifiant.toLowerCase() === data.gauge_id.toLowerCase()) ||
       (data?.animateur_id && userIdentifiant.toLowerCase() === data.animateur_id.toLowerCase()));
    return isElevatedRole || isAssignedUser;
  }, [userRole, data?.user_role, data?.gauge_id, data?.animateur_id, userIdentifiant]);

  // If user is a simple evaluator (not canArbitrate), force read-only mode
  const effectiveReadOnly = readOnly || data?.is_read_only === true || !canArbitrate;

  // Evaluators Waiting Room State
  const [evaluators, setEvaluators] = useState<EvaluatorUser[]>([]);
  const prevStatusesRef = useRef<Record<string, string>>({});

  // Navigation State
  const [activeN1Index, setActiveN1Index] = useState(0);
  const [activeN2Index, setActiveN2Index] = useState(0);

  // Live Focus Filter State ('all' | 'imputation' | 'accord')
  const [filterMode, setFilterMode] = useState<"all" | "imputation" | "accord">("all");

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
  const [showArbitrageReportModal, setShowArbitrageReportModal] = useState(false);
  // LOCKED: toggle between Variance Report and Cockpit arbitrage
  const [showLockedCockpit, setShowLockedCockpit] = useState(false);
  // Track locally which N1 items have been arbitrated in this session
  // (used to decouple closure check from stale GAS fetchSession response)
  const [localArbitratedN1Ids, setLocalArbitratedN1Ids] = useState<Set<string>>(new Set());

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

        // ── DEBUG: Log gauge detection data to browser console ──────────────
        console.group("🔍 [CaliSync Cockpit] Gauge Debug");
        console.log("gauge_id from backend:", res.gauge_id || "(VIDE)");
        console.log("animateur_id from backend:", (res as any).animateur_id || "(VIDE)");
        console.log("gauge_items_count (GAS):", (res as any).gauge_items_count ?? "N/A");
        console.log("evaluateurs_soumis:", res.evaluateurs_soumis);
        const firstN1 = res.grille_hierarchique?.[0];
        const firstN2 = firstN1?.children?.[0] ?? firstN1;
        if (firstN2) {
          console.log("Premier nœud N2 — item_id:", firstN2.item_id);
          console.log("Premier nœud N2 — node.gauge:", firstN2.gauge);
          console.log("Premier nœud N2 — total_votes:", firstN2.total_votes);
        }
        console.log("🔑 INTERPRÉTATION:");
        console.log("  gauge_id VIDE → gauge jamais configurée dans Sessions");
        console.log("  gauge_items_count=0 → gaugeMap vide (items pas trouvés en DB)");
        console.log("  gauge_items_count>0 mais node.gauge=null → ID mismatch entre gaugeMap et cfgNodes");
        console.groupEnd();
        // ────────────────────────────────────────────────────────────────────

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

  const handleSeek = (seconds: number) => {
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
          className="font-mono font-black text-[#0077aa] underline hover:text-[#1dc4ff] cursor-pointer px-2 py-0.5 rounded-md bg-[#1dc4ff]/10 hover:bg-[#1dc4ff]/20 border border-[#1dc4ff]/30 transition-all mx-1 text-xs inline-flex items-center gap-1"
          title={`Réécouter à ${rawTime}`}
        >
          <Play className="w-2.5 h-2.5 fill-[#0077aa]" /> {rawTime}
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
    if (effectiveReadOnly) {
      showToast("🔒 Mode lecture seule — Arbitrage indisponible.");
      return;
    }
    setSelectedArbitrageNode(node);
  };



  // Helper: Extract actual evaluable question nodes (children of category roots)
  const getEvaluableQuestions = (grille: CockpitNode[] = []): CockpitNode[] => {
    const items: CockpitNode[] = [];
    grille.forEach((root) => {
      if (root.type_noeud === "categorie" || (root.children && root.children.length > 0)) {
        root.children?.forEach((child) => items.push(child));
      } else {
        items.push(root);
      }
    });
    return items;
  };

  // Close Session
  const handleCloseSessionClick = async () => {
    if (!sessionId) return;
    if (effectiveReadOnly) {
      showToast("🔒 Mode lecture seule — Clôture impossible.");
      return;
    }

    // Verify all evaluable questions (N2 nodes) are arbitrated before allowing closure
    const allQuestions = getEvaluableQuestions(data?.grille_hierarchique || []);
    const unarbitratedQuestions = allQuestions.filter(
      (q) => !q.decision_finale && !localArbitratedN1Ids.has(q.item_id)
    );

    if (unarbitratedQuestions.length > 0) {
      const names = unarbitratedQuestions
        .map((q) => `• ${q.libelle.replace(/^\[.*?\]\s*/, "").replace(/^[-\d.]+\s*/, "").substring(0, 60)}`)
        .join("\n");
      alert(
        `⚠️ Clôture impossible :\n\n${unarbitratedQuestions.length} item(s) sur ${allQuestions.length} n'ont pas encore été arbitrés :\n\n${names}\n\nVeuillez valider l'arbitrage de l'ensemble des items avant de procéder à la clôture afin de garantir un rapport complet.`
      );
      showToast(`⚠️ ${unarbitratedQuestions.length} item(s) non arbitré(s) restant(s).`);
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir clôturer définitivement cette session de calibrage ? Tous les items ont été arbitrés avec succès.")) return;

    setIsClosingSession(true);
    try {
      // Pass force = true since frontend has already strictly validated that 100% of questions are arbitrated
      const res = await cloturerSession(sessionId, "admin", true);
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

  // Reset Arbitrages in Cockpit
  const handleResetArbitragesInCockpit = async () => {
    if (!sessionId) return;
    if (effectiveReadOnly) {
      showToast("🔒 Mode lecture seule — Réinitialisation impossible.");
      return;
    }
    if (
      !window.confirm(
        "Êtes-vous sûr de vouloir réinitialiser TOUS les arbitrages enregistrés pour cette session ?\n\nTous les arbitrages actuels seront effacés pour vous permettre de tout recommencer."
      )
    )
      return;

    try {
      const res = await reinitialiserArbitrages(sessionId);
      if (res && res.success) {
        setLocalArbitratedN1Ids(new Set());
        showToast("🔄 Arbitrages réinitialisés avec succès !");
        fetchSession(true);
      } else {
        showToast(res?.message || "Erreur lors de la réinitialisation.");
      }
    } catch {
      showToast("Erreur réseau.");
    }
  };

  // Auto-fetch PDF URL when session is CLOSED and pdfUrl is not yet set
  useEffect(() => {
    if (sessionId && data?.statut === "CLOSED" && !pdfUrl && !pdfLoading) {
      getRapportPdf(sessionId).then((res) => {
        if (res && res.success && (res as any).pdf_url) {
          setPdfUrl((res as any).pdf_url);
        }
      });
    }
  }, [sessionId, data?.statut]);

  // Fetch PDF URL separately with popup blocker bypass
  const handleFetchPdf = async () => {
    if (!sessionId) return;
    setPdfLoading(true);

    // Open target window synchronously and render a nice dark loading page
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
              <p>Le document est en cours de création et d'export dans Google Drive.<br>Redirection automatique dans quelques secondes...</p>
            </div>
          </body>
        </html>
      `);
    }

    try {
      const res = await getRapportPdf(sessionId);
      if (res && res.success && (res as any).pdf_url) {
        const url = (res as any).pdf_url;
        setPdfUrl(url);
        if (targetWindow) {
          targetWindow.location.href = url;
        } else {
          window.open(url, "_blank");
        }
        showToast("✅ Rapport PDF chargé avec succès !");
      } else {
        const errMsg = res?.message || "Erreur lors de la génération du rapport PDF.";
        if (targetWindow) {
          targetWindow.document.body.innerHTML = `
            <div class="card" style="border-color: #f43f5e;">
              <h2 style="color: #f43f5e;">⚠️ Rapport PDF Indisponible</h2>
              <p style="color: #cbd5e1; margin-bottom: 12px;">${errMsg}</p>
              <p style="font-size: 11px; color: #94a3b8;">Assurez-vous d'avoir copié <strong>Code_v17.gs</strong> dans Apps Script et d'avoir exécuté la fonction <code>autoriserGoogleDocsPermissions</code> une fois.</p>
            </div>
          `;
        }
        showToast(`⚠️ ${errMsg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion.";
      if (targetWindow) {
        targetWindow.document.body.innerHTML = `
          <div class="card" style="border-color: #f43f5e;">
            <h2 style="color: #f43f5e;">⚠️ Erreur Réseau</h2>
            <p style="color: #cbd5e1;">${msg}</p>
          </div>
        `;
      }
      showToast("Erreur lors de la récupération du rapport PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const sessionStatut = data?.statut;
  const isClosed = sessionStatut === "CLOSED";
  const isLiveReadOnly = effectiveReadOnly && sessionStatut !== "CLOSED";
  const isReadOnly = isClosed || isLiveReadOnly;

  // ── LOADING SPLASHSCREEN ──────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 font-sans pb-16">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Retour au menu
          </button>
        )}
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-6 shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#1dc4ff]/10 border border-[#1dc4ff]/20 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-[#1dc4ff] animate-spin" />
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Connexion au serveur...</h2>
            <p className="text-slate-500 text-sm font-medium">Chargement de la session en cours. Merci de patienter.</p>
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

        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-6 shadow-sm">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-[#1dc4ff]/10 border border-[#1dc4ff]/20 flex items-center justify-center">
            <Coffee className="w-10 h-10 text-[#1dc4ff]" />
          </div>

          <div className="space-y-3 max-w-md mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1dc4ff]/10 border border-[#1dc4ff]/20 text-[#0077aa] text-xs font-bold uppercase tracking-wider">
              <BellRing className="w-3.5 h-3.5 text-[#1dc4ff]" /> Cockpit Live ☕
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Aucun calibrage en cours !
            </h2>

            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Le Cockpit Live est au repos. Prenez un café ☕ !<br />
              Dès qu'une session démarrera, les résultats s'afficheront en direct sur cet écran de projection.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium max-w-sm mx-auto flex items-center gap-2 justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="pt-4 flex justify-center">
            <button
              onClick={() => fetchSession(true)}
              disabled={loading}
              className="px-6 py-3 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-md shadow-[#1dc4ff]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
        <div className="bg-white border border-amber-200 rounded-2xl p-14 text-center space-y-6 shadow-sm">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>
          <div className="space-y-3 max-w-md mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> En Attente de la Gauge
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {data?.nom_session || "Session de calibrage"}
            </h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              La session est ouverte mais <strong className="text-amber-700">l'évaluateur Gauge n'a pas encore soumis son évaluation</strong>.<br />
              Le Cockpit sera disponible dès que la Gauge aura évalué tous les items.
            </p>
          </div>
          <button onClick={() => fetchSession(true)} disabled={loading} className="px-6 py-3 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-extrabold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 mx-auto">
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
        <div className="bg-white border border-[#1dc4ff]/30 rounded-2xl p-14 text-center space-y-6 shadow-sm">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-[#1dc4ff]/10 border border-[#1dc4ff]/20 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#1dc4ff]" />
          </div>
          <div className="space-y-3 max-w-md mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1dc4ff]/10 border border-[#1dc4ff]/20 text-[#0077aa] text-xs font-black uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5 text-[#1dc4ff]" /> Gauge Soumise — En Attente d'Ouverture
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {data?.nom_session || "Session de calibrage"}
            </h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              La Gauge a finalisé son évaluation. <strong className="text-slate-700">Les soumissions des évaluateurs ne sont pas encore ouvertes</strong>.<br />
              Le Cockpit Live s'activera automatiquement dès l'heure d'ouverture.
            </p>
            {data?.heure_fin && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-[#1dc4ff]" />
                Ouverture prévue : {new Date(data.heure_fin).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
          <button onClick={() => fetchSession(true)} disabled={loading} className="px-6 py-3 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-extrabold text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 mx-auto">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>
      </div>
    );
  }

  // ── ÉCRAN LOCKED : RAPPORT DE VARIANCES POST-SOUMISSIONS ─────────────────
  if (sessionStatut === "LOCKED" && !showLockedCockpit) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 font-sans pb-16">
        <div className="flex items-center justify-between">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-xs font-bold cursor-pointer">
              <ArrowLeft className="w-4 h-4" /> Retour au menu
            </button>
          )}

          <button
            onClick={() => fetchSession(false)}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-2xs ml-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#1dc4ff]" : "text-slate-400"}`} />
            <span>Actualiser</span>
          </button>
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
        <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
          {/* Top gradient banner */}
          <div className="h-2 bg-[#1dc4ff]" />

          <div className="p-8 space-y-6">
            {/* Session badge + title */}
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-wider">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Session Archivée — Clôturée
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {data?.nom_session || "Session de calibrage"}
                </h1>
                {data?.nom_conseiller && (
                  <p className="text-slate-500 text-sm font-medium">
                    Conseiller évalué : <span className="text-slate-900 font-bold">{data.nom_conseiller}</span>
                  </p>
                )}
              </div>
              <div className="text-right space-y-1">
                {data?.heure_fin && (
                  <div className="text-xs text-slate-500 font-medium">
                    Clôturée le {new Date(data.heure_fin).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                )}
              </div>
            </div>

            {/* Summary Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <div className="text-2xl font-black text-slate-900">{totalItems}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Items Total</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#1dc4ff]/10 border border-[#1dc4ff]/20 text-center space-y-1">
                <div className="text-2xl font-black text-[#0077aa]">{arbitratedItems}</div>
                <div className="text-[10px] font-bold text-[#0077aa] uppercase tracking-wider">Arbitrés</div>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                <div className="text-2xl font-black text-emerald-700">{conformeItems}</div>
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Conformes</div>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-1">
                <div className="text-2xl font-black text-rose-700">{imputeItems}</div>
                <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Imputés</div>
              </div>
            </div>

            {/* Taux de conformité bar */}
            {tauxConformite !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500 uppercase tracking-wider">Taux de conformité global</span>
                  <span className={`font-black text-base ${tauxConformite >= 70 ? "text-emerald-600" : tauxConformite >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                    {tauxConformite}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${tauxConformite >= 70 ? "bg-emerald-500" : tauxConformite >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${tauxConformite}%` }}
                  />
                </div>
              </div>
            )}

            {/* Evaluators count */}
            {(data?.evaluateurs_soumis?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm">
                <Users className="w-4 h-4 text-[#1dc4ff] flex-shrink-0" />
                <span className="font-medium"><span className="font-black text-slate-900">{data!.evaluateurs_soumis!.length}</span> évaluateur(s) ont participé à cette session</span>
              </div>
            )}

            {/* ── GAUGE SESSION OVERVIEW ── */}
            {(data?.gauge_interaction_summary || data?.gauge_evaluator_comments) && (
              <div className="p-5 rounded-2xl bg-white border border-[#1dc4ff]/30 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0077aa]">
                    <FileText className="w-4 h-4 text-[#1dc4ff]" />
                    Gauge Session Overview
                  </div>
                  {data.gauge_id && (
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-[#1dc4ff]/10 text-[#0077aa] border border-[#1dc4ff]/20">
                      Gauge : {data.gauge_id}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.gauge_interaction_summary && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="text-[11px] font-extrabold text-[#0077aa] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#1dc4ff]" />
                        Interaction Summary
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                        {data.gauge_interaction_summary}
                      </p>
                    </div>
                  )}

                  {data.gauge_evaluator_comments && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-[#1dc4ff]" />
                        Evaluator Comments
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                        {data.gauge_evaluator_comments}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-4 shadow-sm">
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1dc4ff]" />
            Actions disponibles
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {/* Direct Grille PDF Report Modal Button (Primary) */}
            <button
              onClick={() => setShowArbitrageReportModal(true)}
              className="flex items-center gap-3 p-4 rounded-2xl bg-[#1dc4ff]/15 border border-[#1dc4ff]/40 hover:border-[#1dc4ff] hover:bg-[#1dc4ff]/25 transition-all cursor-pointer group shadow-sm text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#1dc4ff] text-slate-950 flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-sm font-black text-slate-900 flex items-center gap-1.5 truncate">
                  Grille PDF
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#1dc4ff] text-slate-950 font-black">
                    A4
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium truncate">
                  Items notés & commentaires
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#0077aa] ml-auto flex-shrink-0" />
            </button>

            {/* Secondary Google Drive PDF Link */}
            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all cursor-pointer group shadow-xs text-left"
              >
                <FileText className="w-6 h-6 text-slate-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div className="text-left min-w-0">
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-1 truncate">
                    Rapport Complet <ExternalLink className="w-3 h-3 text-slate-400" />
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium truncate">
                    Google Drive
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 ml-auto flex-shrink-0" />
              </a>
            ) : (
              <button
                onClick={handleFetchPdf}
                disabled={pdfLoading}
                className="flex items-center gap-3 p-4 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all cursor-pointer disabled:opacity-50 group text-left"
              >
                {pdfLoading ? (
                  <RefreshCw className="w-6 h-6 text-[#009ae5] animate-spin flex-shrink-0" />
                ) : (
                  <FileText className="w-6 h-6 text-slate-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
                )}
                <div className="text-left min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate">
                    {pdfLoading ? "Génération..." : "Rapport Complet"}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium truncate">
                    Google Drive
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 ml-auto flex-shrink-0" />
              </button>
            )}

            {/* Read-only Cockpit */}
            <button
              onClick={() => setShowClosedCockpit(true)}
              className="flex items-center gap-3 p-4 rounded-2xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 transition-all cursor-pointer group text-left"
            >
              <Eye className="w-6 h-6 text-slate-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <div className="text-left min-w-0">
                <div className="text-sm font-black text-white truncate">Cockpit</div>
                <div className="text-[11px] text-slate-400 font-medium truncate">
                  Lecture seule
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
  const allEvaluableQuestions = getEvaluableQuestions(n1Roots);
  const allQuestionsArbitrated =
    allEvaluableQuestions.length > 0 &&
    allEvaluableQuestions.every(
      (q) => !!q.decision_finale || localArbitratedN1Ids.has(q.item_id)
    );
  const currentN1 = n1Roots[activeN1Index] || null;
  const rawN2List = currentN1?.children || [];
  const currentN2List = rawN2List.filter((n2) => nodeMatchesFilter(n2, filterMode));
  const currentN2 = currentN2List[activeN2Index] || null;

  // Counts for Live Focus Bar in current N1 category
  const countAll = rawN2List.length;
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

    // Dynamic Gauge Extraction with Retroactive Fallback
    let gaugeCritere = node.gauge?.critere || "N/A";
    let gaugeComment = node.gauge?.commentaire || "";
    let gaugeNom = node.gauge?.nom || "";
    let hasGaugeVote = !!(node.gauge?.critere && node.gauge.critere !== "N/A" && node.gauge.critere !== "");

    let votesOui = [...(node.votes_par_critere?.Oui || [])];
    let votesNon = [...(node.votes_par_critere?.Non || [])];
    let votesNA = [...(node.votes_par_critere?.["N.A."] || [])];

    const gaugeIdLower = (
      (data?.gauge_id || "") ||
      (data?.animateur_id || "")
    ).trim().toLowerCase();

    // Retroactive Fallback: Search votes array if node.gauge wasn't populated by backend
    if (!hasGaugeVote) {
      const cleanStringKey = (str: string) =>
        str
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "")
          .trim();

      const gaugeClean = cleanStringKey(gaugeIdLower);

      const isGaugeMatch = (nom: string) => {
        if (!nom) return false;
        const n = nom.trim().toLowerCase();
        const cleanN = cleanStringKey(n);

        if (gaugeClean && cleanN) {
          if (n === gaugeIdLower || cleanN === gaugeClean) return true;
          // Substring / partial match (e.g., "diarra" matching "diarra.diallo" or "diallo.diarra")
          if (
            gaugeClean.length >= 3 &&
            (cleanN.includes(gaugeClean) || gaugeClean.includes(cleanN))
          ) {
            return true;
          }
        }
        return n.includes("gauge") || n === "gauge" || n.includes("admin");
      };

      const ouiIdx = votesOui.findIndex((v) => isGaugeMatch(v.nom));
      const nonIdx = votesNon.findIndex((v) => isGaugeMatch(v.nom));
      const naIdx = votesNA.findIndex((v) => isGaugeMatch(v.nom));

      if (ouiIdx !== -1) {
        const gVote = votesOui.splice(ouiIdx, 1)[0];
        gaugeCritere = "Oui";
        gaugeComment = gVote.commentaire || "";
        gaugeNom = gVote.nom;
        hasGaugeVote = true;
      } else if (nonIdx !== -1) {
        const gVote = votesNon.splice(nonIdx, 1)[0];
        gaugeCritere = "Non";
        gaugeComment = gVote.commentaire || "";
        gaugeNom = gVote.nom;
        hasGaugeVote = true;
      } else if (naIdx !== -1) {
        const gVote = votesNA.splice(naIdx, 1)[0];
        gaugeCritere = "N.A.";
        gaugeComment = gVote.commentaire || "";
        gaugeNom = gVote.nom;
        hasGaugeVote = true;
      }
    }

    // Si le commentaire Gauge au niveau N2 est vide, remonter récursivement les commentaires
    // de TOUS les descendants (N3, N4…). Le champ de commentaire n'est affiché dans le formulaire
    // que pour les feuilles terminales (N4 ou N3 sans enfants), donc le commentaire réel
    // est souvent stocké au niveau N4, pas N3.
    if (!gaugeComment && hasGaugeVote) {
      const collectGaugeCommentsDeep = (n: CockpitNode): string[] => {
        const acc: string[] = [];
        if (n.gauge?.commentaire?.trim()) {
          acc.push(`[${cleanLibelle(n.libelle)}] ${n.gauge.commentaire.trim()}`);
        }
        if (n.children) {
          (n.children as CockpitNode[]).forEach(c => acc.push(...collectGaugeCommentsDeep(c)));
        }
        return acc;
      };
      const deepComments = (node.children as CockpitNode[] || []).flatMap(collectGaugeCommentsDeep);
      if (deepComments.length > 0) {
        gaugeComment = deepComments.join("\n");
      }
    }

    const isAccord = node.statut_accord === "accord" || (hasGaugeVote && (
      (gaugeCritere === "Oui" && votesNon.length === 0) ||
      (gaugeCritere === "Non" && votesOui.length === 0)
    ));
    const isDivergence = node.statut_accord === "divergence" || (hasGaugeVote && (
      (gaugeCritere === "Oui" && votesNon.length > 0) ||
      (gaugeCritere === "Non" && votesOui.length > 0)
    ));

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
            ? "bg-white border-slate-200 ml-4 sm:ml-8 mt-4 shadow-sm"
            : isImputedHere || treeSummary.totalImputations > 0
            ? "bg-white border-amber-300 shadow-md ring-1 ring-amber-200"
            : isAccord
            ? "bg-white border-emerald-300 shadow-sm ring-1 ring-emerald-100"
            : isDivergence
            ? "bg-white border-rose-300 shadow-sm ring-1 ring-rose-100"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        {/* ANCESTOR BREADCRUMB PATH & ANIMATOR COMPACT TOGGLE (FOR SUB-ITEMS N3/N4) */}
        {isSubItem && (
          <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-extrabold text-slate-500 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Layers className="w-3.5 h-3.5 text-[#1dc4ff]" />
              <span className="text-slate-400 uppercase font-black">Arborescence Parent :</span>
              <span className="text-slate-700 font-bold">N1: {cleanLibelle(currentN1?.libelle || "")}</span>
              <span className="text-slate-400">➔</span>
              <span className="text-slate-700 font-bold">N2: {cleanLibelle(currentN2?.libelle || "")}</span>
              <span className="text-slate-400">➔</span>
              <span className="text-slate-900 font-black">N{node.niveau}: {labelClean}</span>
            </div>

            <button
              type="button"
              onClick={() => setCompactParentView((prev) => ({ ...prev, [node.item_id]: !isParentCompact }))}
              className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer text-[10px] uppercase font-black shadow-xs"
            >
              {isParentCompact ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-amber-600" />}
              {isParentCompact ? "👁️ Vue Complète" : "👁️ Vue Focus"}
            </button>
          </div>
        )}

        {/* ITEM CARD HEADER */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base flex-shrink-0 mt-0.5 shadow-sm ${
                  isImputedHere || treeSummary.totalImputations > 0
                    ? "bg-amber-500 text-slate-950 shadow-amber-500/20"
                    : isAccord
                    ? "bg-emerald-500 text-white shadow-emerald-500/20"
                    : isDivergence
                    ? "bg-rose-500 text-white shadow-rose-500/20"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
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
                        ? "bg-[#1dc4ff]/10 text-[#0077aa] border-[#1dc4ff]/30"
                        : node.niveau === 3
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {node.niveau === 2
                      ? "Item N1 — Question Principale"
                      : node.niveau === 3
                      ? "Sous-Item N2 — Motif └─"
                      : "Précision N3 — Comportement └─►"}
                  </span>

                  {isImputedHere && (
                    <span className="px-3 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 animate-pulse flex items-center gap-1 shadow-sm">
                      <Flame className="w-3.5 h-3.5 fill-slate-950" /> 🔥 IMPUTÉ ({votesNon.length} vote{votesNon.length > 1 ? "s" : ""})
                    </span>
                  )}

                  {node.criticite === "Critical" && (
                    <span className="px-3 py-0.5 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 animate-pulse flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> CRITIQUE
                    </span>
                  )}

                  {node.decision_finale ? (
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-black border flex items-center gap-1.5 shadow-xs ${
                        node.decision_finale.decision === "Oui"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : node.decision_finale.decision === "Non"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      ARBITRÉ : {node.decision_finale.decision === "Oui" ? "CONFORME (OUI)" : node.decision_finale.decision === "Non" ? "IMPUTÉ (NON)" : "NON APPLICABLE (N.A.)"}
                    </span>
                  ) : (
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-extrabold border ${
                        isAccord
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : isDivergence
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : isSubItem && isParentN2Oui && totalVotes === 0
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
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

                <h3 className="font-black text-xl sm:text-2xl text-slate-900 leading-snug tracking-tight">
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
                  className={`px-4 py-2.5 rounded-2xl flex items-center gap-2.5 flex-shrink-0 shadow-sm border transition-all ${
                    node.decision_finale.decision === "Oui"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                      : node.decision_finale.decision === "Non"
                      ? "bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100"
                      : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                  } ${!isReadOnly ? "cursor-pointer group" : ""}`}
                  title={!isReadOnly ? "Cliquer pour modifier l'arbitrage de cet item" : undefined}
                >
                  <Award className="w-5 h-5 flex-shrink-0 text-amber-600" />
                  <div className="text-left">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1">
                      Arbitrage Validé {!isReadOnly && <span className="text-[9px] underline font-normal">(Modifier)</span>}
                    </div>
                    <div className="text-xs font-black text-slate-900">
                      Critère : {node.decision_finale.decision} {node.decision_finale.justification && `("${node.decision_finale.justification}")`}
                    </div>
                  </div>
                </button>
              ) : isReadOnly || isSubItem ? null : totalVotes === 0 && !node.gauge?.critere ? (
                <button
                  type="button"
                  disabled
                  className="px-4 py-2.5 bg-slate-100 text-slate-400 font-black text-xs rounded-2xl border border-slate-200 opacity-60 cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                  title="Aucun vote évaluateur soumis sur cet item"
                >
                  <Award className="w-4 h-4 text-slate-400" />
                  Arbitrage Inactif (0 Vote)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openArbitrageModal(node)}
                  className="px-4 py-2.5 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black text-xs rounded-2xl transition-all shadow-md shadow-[#1dc4ff]/20 flex items-center gap-2 cursor-pointer flex-shrink-0"
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
            className="p-4 bg-slate-50 border-t border-slate-100 text-xs font-extrabold text-slate-500 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white text-slate-600 border border-slate-200">
                N{node.niveau}
              </span>
              <span className="text-slate-700 font-bold group-hover:text-slate-900 transition-colors">
                {labelClean}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">(0 vote évaluateur — Replié)</span>
            </div>

            <div className="flex items-center gap-1.5 text-[#0077aa] font-black text-[11px] group-hover:text-[#1dc4ff]">
              <span>Déployer pour examiner</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* IMPUTATION RADAR DASHBOARD (Only at N2 if sub-imputations exist) */}
            {node.niveau === 2 && treeSummary.totalImputations > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs space-y-3 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-800">
                    <Flame className="w-4 h-4 text-amber-600 animate-bounce" />
                    RADAR D'IMPUTATIONS DÉTECTÉES ({treeSummary.totalImputations} au total)
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {treeSummary.countN2 > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                        Sous-Items N2: {treeSummary.countN2} motif(s)
                      </span>
                    )}
                    {treeSummary.countN3 > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200">
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
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-100/50 border border-amber-300 text-xs font-black text-amber-900 transition-all shadow-xs flex items-center gap-2.5 cursor-pointer group"
                      title={`Accéder directement au ${item.node.niveau === 3 ? "Sous-Item N2" : "Précision N3"}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
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
              <div className="rounded-3xl p-5 bg-slate-50 border border-slate-200 shadow-xs space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                    <ShieldCheck className="w-5 h-5 text-[#1dc4ff]" /> ÉVALUATEUR GAUGE {gaugeNom && <span className="text-slate-500 font-mono text-[11px] font-semibold lowercase">({gaugeNom})</span>}
                  </div>
                  <span
                    className={`px-4 py-1.5 rounded-xl text-sm font-black uppercase tracking-wide shadow-xs ${
                      gaugeCritere === "Oui"
                        ? "bg-emerald-500 text-white"
                        : gaugeCritere === "Non"
                        ? "bg-rose-500 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {gaugeCritere}
                  </span>
                </div>

                {gaugeComment && (
                  <div className="text-xs text-slate-700 font-medium leading-relaxed bg-white p-3.5 rounded-2xl border border-slate-200 whitespace-pre-line">
                    &ldquo;{parseTimestampsInText(gaugeComment)}&rdquo;
                  </div>
                )}
              </div>
            )}

            {/* RIGHT SHOWDOWN CARD: EVALUATORS MAJORITY */}
            <div className="rounded-3xl p-5 bg-slate-50 border border-slate-200 shadow-xs space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                  <Users className="w-5 h-5 text-[#1dc4ff]" /> COHORTE ÉVALUATEURS
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Majorité :</span>
                  <span
                    className={`px-4 py-1.5 rounded-xl text-sm font-black uppercase tracking-wide shadow-xs ${
                      majorityCritere === "Oui"
                        ? "bg-emerald-500 text-white"
                        : majorityCritere === "Non"
                        ? "bg-rose-500 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {majorityCritere} {totalVotes > 0 && `(${majorityPercent}%)`}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                {totalVotes} évaluateur(s) ont voté sur cet item.
              </div>
            </div>
          </div>

          {/* VOTE GROUPS (ONLY RENDER CRITERIA THAT HAVE > 0 VOTES TO ELIMINATE CLUTTER) */}
          <div className="space-y-4">
            <div className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Détail des Répartitions par Critère :
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* OUI GROUP (Only if > 0 votes) */}
              {votesOui.length > 0 && (
                <div className="rounded-2xl p-4 bg-emerald-50 border border-emerald-200 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <span className="font-black text-xs uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> Répondu "Oui"
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white">
                      {votesOui.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {votesOui.map((v, idx) => (
                      <EvaluatorVoteBadge
                        key={idx}
                        vote={v}
                        critere="Oui"
                        node={node}
                        parseTimestamps={parseTimestampsInText}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* NON GROUP (Only if > 0 votes) */}
              {votesNon.length > 0 && (
                <div className="rounded-2xl p-4 bg-rose-50 border border-rose-200 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                    <span className="font-black text-xs uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                      <X className="w-4 h-4 text-rose-600" /> Répondu "Non"
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white">
                      {votesNon.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {votesNon.map((v, idx) => (
                      <EvaluatorVoteBadge
                        key={idx}
                        vote={v}
                        critere="Non"
                        node={node}
                        parseTimestamps={parseTimestampsInText}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* N.A. GROUP (Only if > 0 votes) */}
              {votesNA.length > 0 && (
                <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-black text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <MinusCircle className="w-4 h-4 text-slate-500" /> Répondu "N.A."
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-600 text-white">
                      {votesNA.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {votesNA.map((v, idx) => (
                      <EvaluatorVoteBadge
                        key={idx}
                        vote={v}
                        critere="N.A."
                        node={node}
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
            <div className="pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() =>
                  setExpandedSubItems((prev) => ({
                    ...prev,
                    [node.item_id]: !isExpanded,
                  }))
                }
                className="flex items-center gap-2 text-xs font-black text-[#0077aa] hover:text-[#1dc4ff] transition-colors cursor-pointer py-1"
              >
                <CornerDownRight className="w-4 h-4 text-[#1dc4ff]" />
                {isExpanded
                  ? `Masquer l'arborescence cascade (${node.children.length} ${node.niveau === 2 ? "Sous-Item(s) N2" : "Précision(s) N3"})`
                  : `Déployer l'arborescence cascade (${node.children.length} ${node.niveau === 2 ? "Sous-Item(s) N2" : "Précision(s) N3"})`}
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isExpanded && (
                <div
                  className={
                    isCascadeView
                      ? "relative border-l-2 border-[#1dc4ff]/40 pl-4 sm:pl-8 space-y-6 pt-4 ml-2 sm:ml-4"
                      : "space-y-4 pt-3"
                  }
                >
                  {node.children
                    .filter((child) => {
                      if (filterMode === "all") return true;
                      const childVotesNon = child.votes_par_critere?.Non || [];
                      if (filterMode === "imputation") return childVotesNon.length > 0;
                      if (filterMode === "accord") return child.statut_accord === "accord";
                      return true;
                    })
                    .map((child) => (
                    <div key={child.item_id} className="relative">
                      {isCascadeView && (
                        <>
                          {/* Horizontal Branch Arm */}
                          <div className="absolute -left-4 sm:-left-8 top-8 w-4 sm:w-8 h-0.5 bg-[#1dc4ff]/40" />
                          {/* Junction Node Badge */}
                          <div className="absolute -left-6 sm:-left-10 top-6 w-5 h-5 rounded-full bg-white border-2 border-[#1dc4ff] flex items-center justify-center text-[10px] font-black text-[#0077aa] shadow-xs">
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
      <section className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <CaliSyncLogo size="sm" showText={false} />
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1dc4ff]/10 border border-[#1dc4ff]/20 text-[#0077aa] text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#1dc4ff]" /> Cockpit Live
              </div>
              {/* SESSION STATUS BADGE */}
              {sessionStatut === "OPEN" && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  EN LIVE
                </div>
              )}
              {sessionStatut === "LOCKED" && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-black uppercase tracking-wider">
                  <Lock className="w-3 h-3 text-amber-500" />
                  ARBITRAGE EN COURS
                </div>
              )}
              {allQuestionsArbitrated && !isReadOnly && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black uppercase tracking-wider">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  100% ARBITRÉ — PRÊT POUR CLÔTURE
                </div>
              )}
              {sessionStatut === "CLOSED" && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-black uppercase tracking-wider">
                  <CheckCircle className="w-3 h-3 text-slate-400" />
                  SESSION ARCHIVÉE
                </div>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {data?.nom_session || "Session Live"}
              {data?.nom_conseiller && (
                <span className="text-slate-500 font-medium text-base block sm:inline sm:ml-2">
                  — ID : <span className="font-mono text-slate-700">{data.nom_conseiller}</span>
                </span>
              )}
            </h1>
            {isClosed && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold">
                👁️ MODE LECTURE SEULE — Session archivée.
              </div>
            )}
            {!canArbitrate && (
              <div className="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1dc4ff]/10 border border-[#1dc4ff]/20 text-[#0077aa] text-xs font-bold">
                🔒 MODE CONSULTATION — L'arbitrage est réservé à l'Animateur, au Gauge et à l'Admin.
              </div>
            )}
            {isLiveReadOnly && canArbitrate && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                🔒 MODE LECTURE SEULE — Arbitrage disponible après la clôture.
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
              <Users className="w-4 h-4 text-[#1dc4ff]" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Soumis :</span>
              <span className="font-black text-xl text-slate-900">{evaluators.length}</span>
            </div>

            {isClosed && (
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

            <button
              type="button"
              onClick={() => setShowArbitrageReportModal(true)}
              className="px-3.5 py-2.5 bg-[#1dc4ff]/15 hover:bg-[#1dc4ff]/25 border border-[#1dc4ff]/30 text-[#1dc4ff] font-extrabold text-xs rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Visualiser et imprimer la grille d'arbitrage au format PDF A4"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Grille PDF</span>
            </button>

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleResetArbitragesInCockpit}
                className="px-3.5 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-extrabold text-xs rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="Effacer tous les arbitrages enregistrés pour cette session afin de recommencer à zéro"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                Réinitialiser Arbitrages
              </button>
            )}

            {!isReadOnly && (
              <button
                type="button"
                onClick={handleCloseSessionClick}
                disabled={isClosingSession}
                className={`px-4 py-2.5 font-extrabold text-xs rounded-2xl transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                  allQuestionsArbitrated
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 ring-2 ring-rose-400/80 animate-pulse"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                }`}
                title={
                  allQuestionsArbitrated
                    ? "Tous les items sont arbitrés — Prêt pour la clôture !"
                    : "Il reste des items à arbitrer avant la clôture"
                }
              >
                {isClosingSession ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                Clôturer Session {allQuestionsArbitrated && "✅"}
              </button>
            )}
          </div>
        </div>

        {/* ── GAUGE SESSION OVERVIEW (LIVE COCKPIT) ── */}
        {(data?.gauge_interaction_summary || data?.gauge_evaluator_comments) && (
          <div className="bg-white border border-[#1dc4ff]/20 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#1dc4ff]/10 text-[#1dc4ff]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Gauge Session Overview
                  </h2>
                  <p className="text-[11px] font-medium text-slate-500">
                    Synthèse d'interaction et remarques soumises par la Gauge
                  </p>
                </div>
              </div>
              {data.gauge_id && (
                <span className="text-xs font-black px-3 py-1 rounded-full bg-[#1dc4ff]/10 text-[#0077aa] border border-[#1dc4ff]/20">
                  Gauge : {data.gauge_id}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.gauge_interaction_summary && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-xs font-bold text-[#0077aa] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#1dc4ff]" />
                    Interaction Summary
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                    {data.gauge_interaction_summary}
                  </p>
                </div>
              )}

              {data.gauge_evaluator_comments && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-xs font-bold text-[#0077aa] uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#1dc4ff]" />
                    Evaluator Comments
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                    {data.gauge_evaluator_comments}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}




        {/* Integrated Audio Player (Google Drive & Standard) */}
        {data?.url_audio && (
          <AudioPlayer
            audioUrl={data.url_audio}
            title={`Enregistrement audio — ${data.nom_session}${data.nom_conseiller ? ` (${data.nom_conseiller})` : ""}`}
            floating={false}
            compact={false}
          />
        )}

        {/* Avatars Grid */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {evaluators.length === 0 ? (
            <div className="text-xs text-slate-500 italic">
              En attente des soumissions des évaluateurs…
            </div>
          ) : (
            evaluators.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-[#1dc4ff] text-slate-950 font-black text-[10px] flex items-center justify-center">
                  {getInitials(ev.nom)}
                </div>
                <span className="text-xs font-extrabold text-slate-700">{ev.nom.split(" ")[0]}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 2. PROGRESSION */}
      <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Progression Équipes / Items
          </span>
          <span className="text-xs font-black text-[#0077aa]">
            {currentGlobalN2Index} / {totalN2Count}
          </span>
        </div>

        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1dc4ff] rounded-full transition-all duration-300"
            style={{
              width: `${totalN2Count > 0 ? (currentGlobalN2Index / totalN2Count) * 100 : 0}%`,
            }}
          />
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
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 flex-shrink-0 ${
                    isN1Active
                      ? "bg-[#1dc4ff] text-slate-950 shadow-md shadow-[#1dc4ff]/20"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-[#1dc4ff]/40 hover:text-slate-900"
                  }`}
                >
                  {hasDivergenceInN1 ? (
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                  {cleanLibelle(n1.libelle)}
                </button>
              );
            })}
          </div>

          {/* LIVE FOCUS BAR (FILTRES DYNAMIQUES DU COCKPIT) */}
          <div className="flex items-center gap-2 overflow-x-auto p-1.5 bg-slate-100 rounded-xl border border-slate-200 shadow-sm scrollbar-none">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 px-2 flex-shrink-0">
              <Layers className="w-3.5 h-3.5 text-slate-400" /> Focus :
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterMode("all");
                setActiveN2Index(0);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
                filterMode === "all"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
              }`}
            >
              Tous ({countAll})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode("imputation");
                setActiveN2Index(0);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                filterMode === "imputation"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-rose-500 hover:bg-white/60"
              }`}
            >
              ⚡ Divergences ({countImputations})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode("accord");
                setActiveN2Index(0);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                filterMode === "accord"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-emerald-600 hover:bg-white/60"
              }`}
            >
              ✅ Accords ({countAccords})
            </button>
          </div>

          {/* ITEM NAVIGATION CONTROLS */}
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <button
              type="button"
              onClick={handlePrevItem}
              disabled={activeN1Index === 0 && activeN2Index === 0}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" /> Item Précédent
            </button>

            <div className="flex items-center gap-4">
              <div className="text-center hidden sm:block">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Catégorie : {cleanLibelle(currentN1?.libelle || "")}
                </span>
                <div className="text-sm font-black text-slate-900">
                  Item N1 : {activeN2Index + 1} / {currentN2List.length}
                </div>
              </div>

              {/* Cascade Mode Toggle */}
              <button
                type="button"
                onClick={() => setIsCascadeView(!isCascadeView)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isCascadeView
                    ? "bg-[#1dc4ff]/10 text-[#0077aa] border-[#1dc4ff]/30 shadow-xs"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
                title="Activer/Désactiver l'arborescence graphique avec lignes de connexion"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-[#1dc4ff]" />
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
              className="px-4 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black text-xs rounded-xl transition-all shadow-md shadow-[#1dc4ff]/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-30"
            >
              Item Suivant <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* CURRENT N2 QUESTION CARD */}
          {currentN2 ? (
            renderItemCard(currentN2)
          ) : (
            <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="text-base font-black text-slate-900">Aucun item correspondant</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Aucun item ne correspond au filtre{" "}
                  <strong className="text-[#0077aa]">
                    "{filterMode === "imputation" ? "Imputations N3/N4" : filterMode === "accord" ? "Accords" : filterMode}"
                  </strong>{" "}
                  dans la catégorie <strong className="text-slate-900">{cleanLibelle(currentN1?.libelle || "")}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterMode("all");
                  setActiveN2Index(0);
                }}
                className="px-4 py-2 bg-[#1dc4ff] hover:bg-[#009ae5] text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-md shadow-[#1dc4ff]/20"
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

            const batchResult = await enregistrerDecisionsBatch(sessionId, batchItems, "admin");

            if (!batchResult?.success) {
              // Rollback optimistic update if backend reports failure
              console.error("[Arbitrage] Batch échoué:", batchResult?.message);
              showToast(`⚠️ Erreur d'enregistrement : ${batchResult?.message || "Réponse invalide du serveur"}`);
              // Force full re-fetch to restore true server state
              fetchSession(true);
              return;
            }

            console.log(`[Arbitrage] Batch OK: ${batchResult.count} items écrits dans Sheets`);
            // Track N1 arbitration locally so closure check doesn't depend on stale fetchSession response
            setLocalArbitratedN1Ids((prev) => {
              const next = new Set(prev);
              next.add(payload.n1Id);
              return next;
            });
            // Delay background sync to allow Google Apps Script to finish writing to Google Sheets
            setTimeout(() => fetchSession(false), 3000);
          } catch (err) {
            console.error("[Arbitrage] Erreur réseau batch:", err);
            showToast("⚠️ Erreur réseau lors de la sauvegarde d'arbitrage. Vérifiez votre connexion et réessayez.");
            // Rollback optimistic update — force re-fetch
            fetchSession(true);
          }
        }}
      />

      {/* ARBITRAGE GRID PDF REPORT MODAL */}
      {showArbitrageReportModal && data && (
        <ArbitrageReportModal
          sessionData={data}
          onClose={() => setShowArbitrageReportModal(false)}
        />
      )}
    </div>
  );
};

export default CockpitScreen;
