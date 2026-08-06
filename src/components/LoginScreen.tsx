import React, { useState } from "react";
import { loginEvaluateur, creerEvaluateur } from "../lib/api";
import {
  Sparkles,
  User,
  UserPlus,
  ArrowRight,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";

export type LoginRole = "evaluateur" | "gauge" | "admin" | "cockpit";

export interface LoginResult {
  identifiant: string;
  nomComplet: string;
  role: LoginRole;
  gaugeSessionId?: string;
}

interface LoginScreenProps {
  onLogin: (result: LoginResult) => void;
}

const ADMIN_PIN = "0607";

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  // Steps: "identify" → "create_profile" → "admin_pin"
  const [step, setStep] = useState<"identify" | "create_profile" | "admin_pin">("identify");

  // Identity state
  const [identifiant, setIdentifiant] = useState("");
  const [nomComplet, setNomComplet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin PIN state
  const [adminPin, setAdminPin] = useState("");
  const [adminPinError, setAdminPinError] = useState(false);
  const [adminPinShake, setAdminPinShake] = useState(false);

  // ── Step 1: Check if identifiant exists ─────────────────────────────────────
  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifiant.trim().toLowerCase().replace(/\s+/g, ".");
    if (!cleanId) {
      setError("Veuillez saisir un identifiant.");
      return;
    }
    setIdentifiant(cleanId);
    setLoading(true);
    setError(null);

    const res = await loginEvaluateur(cleanId);
    setLoading(false);

    if (res.success && res.exists && res.profil) {
      setNomComplet(res.profil.nom_complet);
      // Directly log in as evaluateur simple!
      onLogin({ identifiant: cleanId, nomComplet: res.profil.nom_complet, role: "evaluateur" });
    } else if (res.success && !res.exists) {
      setStep("create_profile");
    } else {
      setError(res.message || "Erreur de connexion au serveur.");
    }
  };

  // ── Step 2: Create new evaluateur profile ───────────────────────────────────
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomComplet.trim()) {
      setError("Veuillez saisir votre nom complet.");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await creerEvaluateur(identifiant, nomComplet.trim());
    setLoading(false);

    if (res.success) {
      // Profile created: directly log in as evaluateur simple
      onLogin({ identifiant, nomComplet: nomComplet.trim(), role: "evaluateur" });
    } else {
      setError(res.message || "Erreur lors de la création du profil.");
    }
  };

  // ── Step Admin PIN ──────────────────────────────────────────────────────────
  const handleAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === ADMIN_PIN) {
      onLogin({ identifiant: identifiant || "admin", nomComplet: nomComplet || "Administrateur", role: "admin" });
    } else {
      setAdminPinError(true);
      setAdminPinShake(true);
      setAdminPin("");
      setTimeout(() => setAdminPinShake(false), 400);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md space-y-8">
        {/* ── App Branding ──────────────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-500 p-0.5 shadow-xl shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-3">
              Cali-Sync
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                v2.0
              </span>
            </h1>
            <p className="text-sm text-slate-400 font-medium mt-1">
              Studio de Calibration Qualité Live
            </p>
          </div>
        </div>

        {/* ── Step: Identify ────────────────────────────────────────────────── */}
        {step === "identify" && (
          <div className="glass-card rounded-2xl p-8 space-y-6 animate-pop-in">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-extrabold text-white">Identification Évaluateur</h2>
              <p className="text-sm text-slate-400">
                Saisissez votre identifiant unique (ex: <span className="text-emerald-400 font-semibold">prenom.nom</span>)
              </p>
            </div>

            <form onSubmit={handleIdentify} className="space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  value={identifiant}
                  onChange={(e) => {
                    setIdentifiant(e.target.value);
                    setError(null);
                  }}
                  placeholder="prenom.nom"
                  autoFocus
                  className="w-full pl-12 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-base font-medium"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose-400 text-sm font-medium p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !identifiant.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5" /> Accéder aux sessions
                  </>
                )}
              </button>
            </form>

            {/* Link to Admin / Animateur Access */}
            <div className="pt-4 border-t border-slate-800 text-center">
              <button
                onClick={() => setStep("admin_pin")}
                className="text-xs text-slate-500 hover:text-amber-400 font-semibold transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" /> Accès Admin / Animateur
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Create Profile ──────────────────────────────────────────── */}
        {step === "create_profile" && (
          <div className="glass-card rounded-2xl p-8 space-y-6 animate-pop-in">
            <div className="text-center space-y-1">
              <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                <UserPlus className="w-6 h-6 text-indigo-400" />
              </div>
              <h2 className="text-xl font-extrabold text-white">Nouveau Profil</h2>
              <p className="text-sm text-slate-400">
                Identifiant <span className="text-emerald-400 font-bold">{identifiant}</span> n'existe pas encore.
                <br />Créez votre profil pour commencer.
              </p>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Nom complet <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={nomComplet}
                  onChange={(e) => {
                    setNomComplet(e.target.value);
                    setError(null);
                  }}
                  placeholder="ex: Oumar Touré"
                  autoFocus
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose-400 text-sm font-medium p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep("identify"); setError(null); }}
                  className="px-5 py-3 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl transition-all hover:bg-slate-700 cursor-pointer"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={loading || !nomComplet.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> Enregistrer & Continuer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step: Admin PIN ──────────────────────────────────────────────── */}
        {step === "admin_pin" && (
          <div className={`glass-card rounded-2xl p-8 space-y-6 animate-pop-in ${adminPinShake ? "animate-shake" : ""}`}>
            <div className="text-center space-y-1">
              <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-xl font-extrabold text-white">Accès Admin / Animateur</h2>
              <p className="text-sm text-slate-400">
                Saisissez le code secret administrateur.
              </p>
            </div>

            <form onSubmit={handleAdminPin} className="space-y-4">
              <input
                type="password"
                value={adminPin}
                onChange={(e) => {
                  setAdminPin(e.target.value);
                  setAdminPinError(false);
                }}
                placeholder="Code secret admin"
                autoFocus
                className={`w-full text-center text-2xl font-black tracking-widest px-4 py-3.5 rounded-xl bg-slate-900/80 border transition-all focus:outline-none ${
                  adminPinError
                    ? "border-rose-500 text-rose-400 focus:ring-2 focus:ring-rose-500/30"
                    : "border-slate-700 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                }`}
              />

              {adminPinError && (
                <p className="text-xs text-rose-400 font-semibold text-center">
                  Code secret incorrect. Réessayez.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep("identify"); setAdminPin(""); setAdminPinError(false); }}
                  className="px-5 py-3 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl transition-all hover:bg-slate-700 cursor-pointer"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={!adminPin}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Shield className="w-4 h-4" /> Accéder à la console
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
