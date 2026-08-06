import { useState, useCallback } from "react";
import { LoginScreen, type LoginResult } from "./components/LoginScreen";
import { EvaluateurLanding } from "./components/EvaluateurLanding";
import { EvaluateurScreen } from "./components/EvaluateurScreen";
import { CockpitScreen } from "./components/CockpitScreen";
import { AdminPanel } from "./components/AdminPanel";
import { TemplateManager } from "./components/TemplateManager";
import { RingDispute } from "./components/RingDispute";



type AppScreen =
  | "login"
  | "evaluateur_landing"
  | "gauge_landing"
  | "evaluateur_screen"
  | "cockpit_screen"
  | "admin_panel"
  | "template_manager"
  | "dispute_placeholder";

export function App() {
  // Auth state
  const [screen, setScreen] = useState<AppScreen>("login");
  const [user, setUser] = useState<LoginResult | null>(null);

  // Session context
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isGaugeMode, setIsGaugeMode] = useState(false);

  // ── Login Handler ───────────────────────────────────────────────────────────
  const handleLogin = useCallback((result: LoginResult) => {
    setUser(result);

    switch (result.role) {
      case "evaluateur":
        setScreen("evaluateur_landing");
        break;
      case "gauge":
        setScreen("gauge_landing");
        break;
      case "cockpit":
        setScreen("cockpit_screen");
        setActiveSessionId(null);
        break;
      case "admin":
        setScreen("admin_panel");
        break;
    }
  }, []);

  // ── Back to role selection / Login ─────────────────────────────────────────
  const handleBackToLogin = useCallback(() => {
    setUser(null);
    setScreen("login");
    setActiveSessionId(null);
    setIsGaugeMode(false);
  }, []);

  // ── Select session from landing ─────────────────────────────────────────────
  const handleSelectSession = useCallback((sessionId: string, gauge: boolean) => {
    setActiveSessionId(sessionId);
    setIsGaugeMode(gauge);
    setScreen("evaluateur_screen");
  }, []);

  // ── Evaluation complete ─────────────────────────────────────────────────────
  const handleEvaluationComplete = useCallback(() => {
    if (isGaugeMode) {
      // Gauge done: back to gauge landing to see updated status
      setScreen("gauge_landing");
    } else {
      // Normal evaluator: back to evaluator landing (Cockpit access restricted)
      setScreen("evaluateur_landing");
    }
  }, [isGaugeMode]);

  // ── Admin navigations ───────────────────────────────────────────────────────
  const handleOpenTemplateManager = useCallback(() => {
    setScreen("template_manager");
  }, []);

  const handleOpenCockpitFromAdmin = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setScreen("cockpit_screen");
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* ── Login Screen ──────────────────────────────────────────────────── */}
      {screen === "login" && (
        <LoginScreen onLogin={handleLogin} />
      )}

      {/* ── Evaluateur Landing ────────────────────────────────────────────── */}
      {screen === "evaluateur_landing" && user && (
        <EvaluateurLanding
          identifiant={user.identifiant}
          nomComplet={user.nomComplet}
          role="evaluateur"
          onSelectSession={handleSelectSession}
          onBack={handleBackToLogin}
        />
      )}

      {/* ── Gauge Landing ─────────────────────────────────────────────────── */}
      {screen === "gauge_landing" && user && (
        <EvaluateurLanding
          identifiant={user.identifiant}
          nomComplet={user.nomComplet}
          role="gauge"
          onSelectSession={handleSelectSession}
          onBack={handleBackToLogin}
        />
      )}

      {/* ── Evaluateur Screen (normal or gauge) ───────────────────────────── */}
      {screen === "evaluateur_screen" && user && activeSessionId && (
        <EvaluateurScreen
          sessionId={activeSessionId}
          evaluateurId={user.identifiant}
          isGaugeMode={isGaugeMode}
          onComplete={handleEvaluationComplete}
        />
      )}

      {/* ── Cockpit Screen ────────────────────────────────────────────────── */}
      {screen === "cockpit_screen" && (
        <div className="p-4 sm:p-8">
          <CockpitScreen
            sessionId={activeSessionId || undefined}
            onBack={() => setScreen(user?.role === "admin" ? "admin_panel" : "evaluateur_landing")}
            onSeekAudio={(sec) => console.log("Audio seek:", sec)}
          />
        </div>
      )}

      {/* ── Admin Panel ───────────────────────────────────────────────────── */}
      {screen === "admin_panel" && user && (
        <AdminPanel
          identifiant={user.identifiant}
          nomComplet={user.nomComplet}
          onBack={handleBackToLogin}
          onOpenTemplateManager={handleOpenTemplateManager}
          onOpenCockpit={handleOpenCockpitFromAdmin}
        />
      )}

      {/* ── Template Manager ──────────────────────────────────────────────── */}
      {screen === "template_manager" && (
        <TemplateManager
          onBack={() => setScreen("admin_panel")}
        />
      )}

      {/* ── Dispute Placeholder ───────────────────────────────────────────── */}
      {screen === "dispute_placeholder" && (
        <RingDispute
          onBack={handleBackToLogin}
        />
      )}
    </div>
  );
}

export default App;
