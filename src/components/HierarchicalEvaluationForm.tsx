import React, { useState, useMemo, useEffect } from "react";
import { postCalibration } from "../lib/api";
import { CountdownTimer } from "./CountdownTimer";
import { AudioPlayer } from "./AudioPlayer";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  MessageSquare,
  Sparkles,
  Lock,
  Send,
  AlertTriangle,
  Bookmark,
  ShieldCheck,
  Square,
  CheckSquare,
  CornerDownRight,
  ArrowLeft,
  PauseCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface HierarchicalItem {
  item_id: string;
  parent_id: string;
  niveau: number;               // 1 | 2 | 3 | 4
  type_noeud?: string;
  categorie_racine_fr: string;
  libelle_fr: string;
  criticite?: "Critical" | "Standard";
  est_terminal?: boolean;
  commentaire_obligatoire?: boolean;
}

export interface HierarchicalEvaluationFormProps {
  items: HierarchicalItem[];
  sessionId?: string;
  evaluateurId?: string;
  sessionLocked?: boolean;
  isGaugeMode?: boolean;
  callName?: string;
  audioUrl?: string;
  heureFin?: string;
  initialAnswers?: Record<string, string>;
  initialComments?: Record<string, string>;
  onSubmitPayload?: (items: Array<{ item_id: string; categorie: string; item: string; statut: string; commentaire?: string }>) => Promise<{ success: boolean; message?: string }>;
  onComplete?: () => void;
  onBack?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// TREE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

interface TreeN4 { item: HierarchicalItem }
interface TreeN3 { item: HierarchicalItem; children: TreeN4[] }
interface TreeN2 { item: HierarchicalItem; children: TreeN3[] }
interface TreeCategory { label: string; questions: TreeN2[] }

function buildTree(items: HierarchicalItem[]): TreeCategory[] {
  const n2 = items.filter((i) => i.niveau === 2);
  const n3 = items.filter((i) => i.niveau === 3);
  const n4 = items.filter((i) => i.niveau === 4);

  const catMap = new Map<string, TreeN2[]>();
  n2.forEach((q) => {
    if (!catMap.has(q.categorie_racine_fr)) catMap.set(q.categorie_racine_fr, []);
    catMap.get(q.categorie_racine_fr)!.push({
      item: q,
      children: n3
        .filter((s) => s.parent_id === q.item_id)
        .map((s) => ({
          item: s,
          children: n4.filter((ss) => ss.parent_id === s.item_id).map((ss) => ({ item: ss })),
        })),
    });
  });

  return Array.from(catMap.entries()).map(([label, questions]) => ({ label, questions }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCORDION REVEAL
// ─────────────────────────────────────────────────────────────────────────────

const Reveal: React.FC<{ open: boolean; children: React.ReactNode; indent?: boolean }> = ({
  open,
  children,
  indent = false,
}) => (
  <div
    style={{
      maxHeight: open ? "2400px" : "0px",
      opacity: open ? 1 : 0,
      overflow: "hidden",
      transition: "max-height 250ms ease-in-out, opacity 200ms ease-in-out",
      paddingLeft: indent ? "1.25rem" : undefined,
    }}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PILL CHOICE TYPE
// ─────────────────────────────────────────────────────────────────────────────

type PillChoice = "Oui" | "Non" | "N.A.";

// ─────────────────────────────────────────────────────────────────────────────
// COMMENT FIELD
// ─────────────────────────────────────────────────────────────────────────────

const CommentField: React.FC<{
  itemId: string;
  value: string;
  onChange: (v: string) => void;
  audioRef?: React.MutableRefObject<HTMLAudioElement | null>;
  lastPauseTimestamp?: string | null;
  placeholder?: string;
  disabled?: boolean;
}> = ({ itemId, value, onChange, audioRef, lastPauseTimestamp, placeholder, disabled = false }) => {
  const [bumping, setBumping] = useState(false);

  const insertTimestamp = (tsToInsert?: string) => {
    if (disabled) return;
    let ts = tsToInsert;
    if (!ts) {
      const cur = audioRef?.current?.currentTime || 0;
      ts = `[${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(Math.floor(cur % 60)).padStart(2, "0")}] `;
    } else {
      ts = `${ts} `;
    }
    setBumping(true);
    setTimeout(() => setBumping(false), 150);
    onChange(value ? `${value} ${ts}` : ts);
  };

  const empty = !value.trim();

  return (
    <div className="space-y-2 pt-2 border-t border-rose-200/60">
      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <label className={`font-bold flex items-center gap-1.5 ${empty && !disabled ? "text-rose-600 animate-pulse" : "text-slate-700"}`}>
          <MessageSquare className="w-3.5 h-3.5" />
          Commentaire obligatoire {empty && "*"}
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {lastPauseTimestamp && (
            <button
              type="button"
              onClick={() => insertTimestamp(lastPauseTimestamp)}
              disabled={disabled}
              className={`transition-all px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-[11px] font-extrabold flex items-center gap-1 shadow-xs animate-pulse ${
                disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-emerald-500/20 cursor-pointer"
              }`}
              title="Insérer le minutage capturé lors de la mise en pause"
            >
              <PauseCircle className="w-3.5 h-3.5 text-emerald-600" />
              Insérer pause {lastPauseTimestamp}
            </button>
          )}
          <button
            type="button"
            onClick={() => insertTimestamp()}
            disabled={disabled}
            style={{ transform: bumping ? "scale(0.92)" : "scale(1)" }}
            className={`transition-transform px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-bold flex items-center gap-1 ${
              disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-200 cursor-pointer"
            }`}
            title="Insérer le minutage actuel de l'audio"
          >
            <Clock className="w-3 h-3 text-slate-500" />
            Insérer minutage
          </button>
        </div>
      </div>
      <textarea
        id={`comment-${itemId}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        disabled={disabled}
        placeholder={placeholder ?? "Décrivez l'écart constaté et la justification..."}
        className={`w-full p-3 rounded-xl text-xs text-slate-900 border transition-all focus:outline-none ${
          disabled
            ? "bg-slate-50 border-slate-200 cursor-not-allowed text-slate-500"
            : empty
            ? "bg-white border-rose-400 ring-2 ring-rose-400/20 focus:ring-rose-500"
            : "bg-white border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        }`}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const HierarchicalEvaluationForm: React.FC<HierarchicalEvaluationFormProps> = ({
  items,
  sessionId = "SESS_2026_001",
  evaluateurId = "EVAL_01",
  sessionLocked = false,
  isGaugeMode = false,
  callName = "Appel Client #8492 - Réclamation Facturation",
  audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  heureFin,
  initialAnswers,
  initialComments,
  onSubmitPayload,
  onComplete,
  onBack,
}) => {
  const [timeIsUp, setTimeIsUp] = useState(false);
  const [lastPauseTimestamp, setLastPauseTimestamp] = useState<string | null>(null);
  const isFormDisabled = sessionLocked || timeIsUp;

  const tree = useMemo(() => buildTree(items), [items]);

  const initCats = useMemo(() => {
    const s = new Set<string>();
    tree.forEach((c) => s.add(c.label));
    return s;
  }, [tree]);

  const draftStorageKey = `CALISYNC_DRAFT_EVAL_${sessionId}_${evaluateurId}`;

  const savedDraft = useMemo(() => {
    if (initialAnswers) return null;
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return null;
  }, [sessionId, evaluateurId, initialAnswers, draftStorageKey]);

  const [openCategories, setOpenCategories] = useState<Set<string>>(initCats);
  const [answers, setAnswers] = useState<Record<string, PillChoice>>(() => {
    if (initialAnswers) {
      const n2Answers: Record<string, PillChoice> = {};
      items.filter(i => i.niveau === 2).forEach(i => {
        if (initialAnswers[i.item_id]) {
          n2Answers[i.item_id] = initialAnswers[i.item_id] as PillChoice;
        }
      });
      return n2Answers;
    }
    if (savedDraft?.answers) return savedDraft.answers;
    return {};
  });

  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (initialAnswers) {
      Object.entries(initialAnswers).forEach(([itemId, status]) => {
        const item = items.find(i => i.item_id === itemId);
        if (item && (item.niveau === 3 || item.niveau === 4) && status === "Non") {
          s.add(itemId);
        }
      });
    } else if (savedDraft?.selectedSubs) {
      savedDraft.selectedSubs.forEach((id: string) => s.add(id));
    }
    return s;
  });

  const [expandedN3, setExpandedN3] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (initialAnswers) {
      Object.entries(initialAnswers).forEach(([itemId, status]) => {
        const item = items.find(i => i.item_id === itemId);
        if (item && item.niveau === 4 && status === "Non") {
          s.add(item.parent_id);
        }
      });
    } else if (savedDraft?.selectedSubs) {
      savedDraft.selectedSubs.forEach((itemId: string) => {
        const item = items.find(i => i.item_id === itemId);
        if (item && item.niveau === 4) {
          s.add(item.parent_id);
        }
      });
    }
    return s;
  });

  const [comments, setComments] = useState<Record<string, string>>(() => {
    if (initialComments) return initialComments;
    if (savedDraft?.comments) return savedDraft.comments;
    return {};
  });

  // Auto-save draft changes to localStorage
  useEffect(() => {
    if (sessionLocked || initialAnswers) return;
    const hasData = Object.keys(answers).length > 0 || Object.keys(comments).length > 0 || selectedSubs.size > 0;
    if (hasData) {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          answers,
          comments,
          selectedSubs: Array.from(selectedSubs),
        })
      );
    }
  }, [answers, comments, selectedSubs, sessionLocked, initialAnswers, draftStorageKey]);
  const [springing, setSpringing] = useState<{ id: string; choice: PillChoice } | null>(null);
  const [lastInteracted, setLastInteracted] = useState<string | null>(null);
  const [isShakingSubmit, setIsShakingSubmit] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVictory, setShowVictory] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleCategory = (label: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const handleAnswer = (itemId: string, choice: PillChoice) => {
    if (isFormDisabled) return;
    setSpringing({ id: itemId, choice });
    setTimeout(() => setSpringing(null), 200);
    setLastInteracted(itemId);
    setTimeout(() => setLastInteracted(null), 650);
    setAnswers((prev) => ({ ...prev, [itemId]: choice }));

    if (choice !== "Non") {
      // clean sub-selections when switching away from Non
      items
        .filter((i) => i.parent_id === itemId)
        .forEach((sub) => {
          setSelectedSubs((prev) => { const n = new Set(prev); n.delete(sub.item_id); return n; });
          setExpandedN3((prev) => { const n = new Set(prev); n.delete(sub.item_id); return n; });
          items
            .filter((i) => i.parent_id === sub.item_id)
            .forEach((ss) => {
              setSelectedSubs((prev) => { const n = new Set(prev); n.delete(ss.item_id); return n; });
            });
        });
    }
  };

  const toggleSubItem = (itemId: string, isTerminalOrLeaf: boolean) => {
    if (isFormDisabled) return;
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        setExpandedN3((ep) => { const n = new Set(ep); n.delete(itemId); return n; });
        items.filter((i) => i.parent_id === itemId).forEach((ss) => next.delete(ss.item_id));
      } else {
        next.add(itemId);
        if (!isTerminalOrLeaf) {
          setExpandedN3((ep) => new Set([...ep, itemId]));
        }
      }
      return next;
    });
  };

  const toggleSubSubItem = (itemId: string) => {
    if (isFormDisabled) return;
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const allN2 = useMemo(() => tree.flatMap((c) => c.questions.map((q) => q.item.item_id)), [tree]);
  const totalN2 = allN2.length;
  const answeredN2 = allN2.filter((id) => !!answers[id]).length;
  const progressPct = totalN2 > 0 ? (answeredN2 / totalN2) * 100 : 0;

  const unratedN2 = allN2.filter((id) => !answers[id]);

  const isTerminalLeaf = (it: HierarchicalItem) => {
    if (it.niveau === 4) return true;
    if (it.est_terminal) return true;
    if (it.commentaire_obligatoire) return true;
    if (it.niveau === 3) {
      const hasN4 = items.some((child) => child.niveau === 4 && child.parent_id === it.item_id);
      return !hasN4;
    }
    return false;
  };

  const missingComments: string[] = [];
  items.forEach((it) => {
    if (it.niveau >= 3 && selectedSubs.has(it.item_id) && isTerminalLeaf(it)) {
      if (!comments[it.item_id]?.trim()) missingComments.push(it.item_id);
    }
  });

  const isFormValid = unratedN2.length === 0 && missingComments.length === 0;

  const buildPayload = () => {
    const payload: Array<{
      item_id: string; categorie: string; item: string;
      statut: string; commentaire: string; niveau: number;
    }> = [];

    tree.forEach((cat) => {
      cat.questions.forEach((q) => {
        const ans = answers[q.item.item_id];
        if (!ans) return;
        payload.push({
          item_id: q.item.item_id,
          categorie: cat.label,
          item: q.item.libelle_fr,
          statut: ans,
          commentaire: comments[q.item.item_id] || "",
          niveau: 2,
        });

        if (ans === "Non") {
          q.children.forEach((sub) => {
            if (!selectedSubs.has(sub.item.item_id)) return;
            payload.push({
              item_id: sub.item.item_id,
              categorie: cat.label,
              item: sub.item.libelle_fr,
              statut: "Non",
              commentaire: comments[sub.item.item_id] || "",
              niveau: 3,
            });
            sub.children.forEach((ss) => {
              if (!selectedSubs.has(ss.item.item_id)) return;
              payload.push({
                item_id: ss.item.item_id,
                categorie: cat.label,
                item: ss.item.libelle_fr,
                statut: "Non",
                commentaire: comments[ss.item.item_id] || "",
                niveau: 4,
              });
            });
          });
        }
      });
    });

    return payload;
  };

  const handleSubmit = async () => {
    if (isFormDisabled) {
      triggerToast(timeIsUp ? "Date limite dépassée — soumission impossible." : "Session verrouillée — soumission impossible.");
      setIsShakingSubmit(true);
      setTimeout(() => setIsShakingSubmit(false), 400);
      return;
    }
    if (!isFormValid) {
      setIsShakingSubmit(true);
      setTimeout(() => setIsShakingSubmit(false), 400);
      if (unratedN2.length > 0) {
        triggerToast(`${unratedN2.length} question(s) sans réponse.`);
        document.getElementById(`q-card-${unratedN2[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        triggerToast("Commentaire obligatoire manquant.");
        document.getElementById(`comment-${missingComments[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSubmitPayload) {
        const res = await onSubmitPayload(buildPayload());
        setIsSubmitting(false);
        if (res && res.success) {
          localStorage.removeItem(draftStorageKey);
          setShowVictory(true);
          setTimeout(() => { setShowVictory(false); onComplete?.(); }, 2200);
        } else {
          triggerToast(res?.message || "Erreur lors de la soumission.");
        }
      } else {
        const res = await postCalibration({
          session_id: sessionId,
          evaluateur_id: evaluateurId,
          est_gauge: isGaugeMode,
          items: buildPayload(),
        });
        setIsSubmitting(false);
        if (res.success) {
          localStorage.removeItem(draftStorageKey);
          setShowVictory(true);
          setTimeout(() => { setShowVictory(false); onComplete?.(); }, 2200);
        } else {
          triggerToast(res.message || "Erreur lors de la soumission.");
        }
      }
    } catch {
      setIsSubmitting(false);
      triggerToast("Erreur réseau. Réessayez.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-32">

      {isGaugeMode && (
        <div className="bg-indigo-900 text-indigo-100 px-4 py-2.5 text-xs font-extrabold flex items-center justify-center gap-2 border-b border-indigo-700 shadow-md">
          <ShieldCheck className="w-4 h-4 text-indigo-300 animate-pulse" />
          Mode référence — ces réponses serviront de Gauge pour cette session
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 flex items-center gap-3 animate-pop-in">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {showVictory && (
        <div className="fixed inset-0 z-50 bg-emerald-500 flex flex-col items-center justify-center text-white space-y-6 animate-pop-in">
          <div className="w-28 h-28 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-2xl">
            <CheckCircle2 className="w-16 h-16 stroke-[2.5]" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-extrabold tracking-tight">
              {isGaugeMode ? "Gauge Enregistré !" : "Grille Soumise !"}
            </h2>
            <p className="text-emerald-100 font-medium text-lg">
              {isGaugeMode
                ? "La réponse de référence a été enregistrée dans Cali-Sync."
                : "Toutes vos évaluations ont été transmises à Cali-Sync."}
            </p>
          </div>
        </div>
      )}

      {/* STICKY HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer flex items-center justify-center flex-shrink-0"
                title="Retour au tableau de bord (Brouillon sauvegardé)"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-extrabold text-base sm:text-lg text-slate-900 truncate max-w-xs sm:max-w-md">
                  {callName}
                </h1>
                {!sessionLocked ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Session en cours
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-600 text-xs font-bold flex-shrink-0">
                    <Lock className="w-3 h-3 text-slate-500" />
                    Verrouillée
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Session: <strong className="text-slate-700">{sessionId}</strong> • Évaluateur:{" "}
                <strong className="text-slate-700">{evaluateurId}</strong>
              </p>
            </div>
          </div>

          {audioUrl && (
            <div className="w-full sm:w-auto space-y-2">
              <AudioPlayer
                audioUrl={audioUrl}
                title={callName}
                floating={true}
                defaultPosition={{ x: Math.max(20, window.innerWidth - 380), y: 80 }}
                onPauseTimestamp={(ts) => setLastPauseTimestamp(ts)}
              />
              {lastPauseTimestamp && (
                <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center justify-between shadow-xs animate-fade-in">
                  <span className="flex items-center gap-1.5">
                    <PauseCircle className="w-4 h-4 text-emerald-600 animate-pulse flex-shrink-0" />
                    Pause capturée à <strong className="font-mono text-emerald-950">{lastPauseTimestamp}</strong>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                    Cliquez sur "Insérer pause" dans vos commentaires
                  </span>
                </div>
              )}
            </div>
          )}
          {heureFin && (
            <div className="w-full flex justify-end mt-2">
              <CountdownTimer
                closingDateStr={heureFin}
                onTimeout={() => setTimeIsUp(true)}
                warningThresholdMinutes={60}
              />
            </div>
          )}
        </div>
      </header>

      {/* BODY */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-6 space-y-6 flex-1">
        {tree.map((cat) => {
          const isOpen = openCategories.has(cat.label);
          const catAnswered = cat.questions.filter((q) => !!answers[q.item.item_id]).length;
          const catTotal = cat.questions.length;

          return (
            <section key={cat.label}>
              {/* NIVEAU 1 — Category */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.label)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all group cursor-pointer mb-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-extrabold text-sm uppercase tracking-wider text-slate-800 group-hover:text-emerald-700 transition-colors">
                    {cat.label}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    catAnswered === catTotal
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}>
                    {catAnswered}/{catTotal}
                  </span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform duration-250 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* NIVEAU 2 — Questions */}
              <Reveal open={isOpen}>
                <div className="space-y-3 pb-2">
                  {cat.questions.map((q) => {
                    const ans = answers[q.item.item_id];
                    const isOui = ans === "Oui";
                    const isNon = ans === "Non";
                    const isNA = ans === "N.A.";
                    const hasSubItems = q.children.length > 0;

                    const cardBg = isOui
                      ? "bg-emerald-50/60 border-emerald-200 shadow-sm shadow-emerald-500/5"
                      : isNon
                      ? "bg-rose-50/60 border-rose-200 shadow-sm shadow-rose-500/5"
                      : isNA
                      ? "bg-slate-100/80 border-slate-300"
                      : "bg-white border-slate-200";

                    const pillConfig = [
                      {
                        choice: "Oui" as PillChoice,
                        label: "Yes",
                        icon: <Check className="w-3.5 h-3.5 stroke-[3]" />,
                        active: "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20",
                        hover: "bg-white text-slate-600 border-slate-300 hover:border-emerald-500 hover:text-emerald-700",
                      },
                      {
                        choice: "Non" as PillChoice,
                        label: "No",
                        icon: <AlertTriangle className="w-3.5 h-3.5" />,
                        active: "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20",
                        hover: "bg-white text-slate-600 border-slate-300 hover:border-rose-500 hover:text-rose-700",
                      },
                      {
                        choice: "N.A." as PillChoice,
                        label: "N/A",
                        icon: <Bookmark className="w-3.5 h-3.5" />,
                        active: "bg-slate-700 text-white border-slate-700 shadow-md shadow-slate-700/20",
                        hover: "bg-white text-slate-600 border-slate-300 hover:border-slate-500 hover:text-slate-800",
                      },
                    ];

                    return (
                      <div
                        id={`q-card-${q.item.item_id}`}
                        key={q.item.item_id}
                        className={`rounded-2xl border transition-colors duration-300 overflow-hidden ${cardBg}`}
                      >
                        <div className="p-4 sm:p-5 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <div className="pt-0.5 flex-shrink-0">
                                {q.item.criticite === "Critical" ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                                    CRITICAL
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                    STD
                                  </span>
                                )}
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm sm:text-base text-slate-800 leading-snug">
                                    {q.item.libelle_fr}
                                  </span>
                                  {lastInteracted === q.item.item_id && (
                                    <Check className="w-5 h-5 text-emerald-600 animate-pop-in flex-shrink-0" />
                                  )}
                                </div>
                                {hasSubItems && isNon && (
                                  <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                                    <CornerDownRight className="w-3 h-3" />
                                    Sélectionnez le(s) motif(s) ci-dessous
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                              {pillConfig.map(({ choice, label, icon, active, hover }) => {
                                const isActive = ans === choice;
                                const isSpring = springing?.id === q.item.item_id && springing?.choice === choice;
                                return (
                                  <button
                                    key={choice}
                                    type="button"
                                    onClick={() => handleAnswer(q.item.item_id, choice)}
                                    style={{ transform: isSpring ? "scale(1.08)" : "scale(1)" }}
                                    className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 cursor-pointer flex items-center gap-1.5 border ${
                                      isActive ? active : hover
                                    }`}
                                  >
                                    {icon}
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* NIVEAU 3 — Sous-items (revealed when Non) */}
                        {hasSubItems && (
                          <Reveal open={isNon} indent>
                            <div className="pb-4 pr-4 space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-500 mb-2 flex items-center gap-1.5">
                                <CornerDownRight className="w-3.5 h-3.5" />
                                Motif(s) de l'écart — plusieurs choix possibles
                              </p>

                              {q.children.map((sub) => {
                                const isSelected = selectedSubs.has(sub.item.item_id);
                                const hasChildren = sub.children.length > 0;
                                const isTerminal = sub.item.est_terminal !== false;
                                const n3Expanded = expandedN3.has(sub.item.item_id);

                                return (
                                  <div key={sub.item.item_id}>
                                    <button
                                      type="button"
                                      onClick={() => toggleSubItem(sub.item.item_id, isTerminal || !hasChildren)}
                                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                                        isSelected
                                          ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20"
                                          : "bg-white border-slate-200 text-slate-700 hover:border-rose-300 hover:bg-rose-50/40"
                                      }`}
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="w-4 h-4 flex-shrink-0" />
                                      ) : (
                                        <Square className="w-4 h-4 flex-shrink-0 text-slate-400" />
                                      )}
                                      <span className="text-xs font-semibold leading-snug flex-1">{sub.item.libelle_fr}</span>
                                      {hasChildren && !isTerminal && (
                                        <ChevronDown
                                          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                                            isSelected && n3Expanded ? "rotate-180" : ""
                                          } ${isSelected ? "text-rose-200" : "text-slate-400"}`}
                                        />
                                      )}
                                    </button>

                                    {isSelected && isTerminalLeaf(sub.item) && (
                                      <div className="mt-2 ml-4 space-y-1">
                                        <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                                          * Commentaire d'imputation obligatoire (Dernier niveau)
                                        </p>
                                        <CommentField
                                          itemId={sub.item.item_id}
                                          value={comments[sub.item.item_id] || ""}
                                          onChange={(v) => setComments((p) => ({ ...p, [sub.item.item_id]: v }))}
                                          lastPauseTimestamp={lastPauseTimestamp}
                                          placeholder="Justification ou précision obligatoire de l'écart..."
                                          disabled={isFormDisabled}
                                        />
                                      </div>
                                    )}

                                    {/* NIVEAU 4 — Sous-sous-items */}
                                    {hasChildren && isSelected && (
                                      <Reveal open={n3Expanded} indent>
                                        <div className="pt-2 pb-1 pr-2 space-y-1.5">
                                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                                            <CornerDownRight className="w-3 h-3" />
                                            Précision supplémentaire
                                          </p>
                                          {sub.children.map((ss) => {
                                            const isSSSelected = selectedSubs.has(ss.item.item_id);
                                            return (
                                              <div key={ss.item.item_id}>
                                                <button
                                                  type="button"
                                                  onClick={() => toggleSubSubItem(ss.item.item_id)}
                                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                                                    isSSSelected
                                                      ? "bg-slate-700 border-slate-700 text-white shadow-md"
                                                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                                                  }`}
                                                >
                                                  {isSSSelected ? (
                                                    <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" />
                                                  ) : (
                                                    <Square className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                                                  )}
                                                  <span className="text-[11px] font-semibold leading-snug flex-1">
                                                    {ss.item.libelle_fr}
                                                  </span>
                                                </button>

                                                {isSSSelected && isTerminalLeaf(ss.item) && (
                                                  <div className="mt-2 ml-4 space-y-1">
                                                    <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                                                      * Commentaire d'imputation obligatoire (Dernier niveau)
                                                    </p>
                                                    <CommentField
                                                      itemId={ss.item.item_id}
                                                      value={comments[ss.item.item_id] || ""}
                                                      onChange={(v) => setComments((p) => ({ ...p, [ss.item.item_id]: v }))}
                                                      placeholder="Justification ou précision obligatoire de l'écart..."
                                                      disabled={isFormDisabled}
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </Reveal>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </Reveal>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Reveal>
            </section>
          );
        })}
      </main>

      {/* STICKY FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Progression :</span>
              <div className="flex items-baseline font-black text-lg text-slate-900">
                <span key={answeredN2} className="inline-block animate-pop-in">{answeredN2}</span>
                <span className="text-slate-400 font-medium text-sm">/{totalN2} questions</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isFormValid && (
                <span className="text-xs text-amber-600 font-semibold hidden sm:inline-block">
                  {unratedN2.length > 0
                    ? `${unratedN2.length} question(s) sans réponse`
                    : "Commentaires obligatoires manquants"}
                </span>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid || isSubmitting || isFormDisabled}
                className={`px-6 py-3 rounded-xl font-extrabold text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  isShakingSubmit ? "animate-shake" : ""
                } ${
                  isFormValid && !isFormDisabled
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 active:scale-95"
                    : "bg-slate-200 text-slate-400 border border-slate-300 opacity-60 cursor-not-allowed"
                }`}
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {isGaugeMode ? "Enregistrer Gauge" : "Soumettre"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HierarchicalEvaluationForm;
