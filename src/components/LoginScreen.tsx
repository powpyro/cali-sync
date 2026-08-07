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
  Lock,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Input } from "./ui/Input";
import { Card } from "./ui/Card";
import { ThemeToggle } from "./ui/ThemeToggle";

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
  const [step, setStep] = useState<"identify" | "create_profile" | "admin_pin">("identify");
  const [identifiant, setIdentifiant] = useState("");
  const [nomComplet, setNomComplet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adminPin, setAdminPin] = useState("");
  const [adminPinError, setAdminPinError] = useState(false);
  const [adminPinShake, setAdminPinShake] = useState(false);

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
      onLogin({ identifiant: cleanId, nomComplet: res.profil.nom_complet, role: "evaluateur" });
    } else if (res.success && !res.exists) {
      setStep("create_profile");
    } else {
      setError(res.message || "Erreur de connexion au serveur.");
    }
  };

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
      onLogin({ identifiant, nomComplet: nomComplet.trim(), role: "evaluateur" });
    } else {
      setError(res.message || "Erreur lors de la création du profil.");
    }
  };

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
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-slate-950">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      {/* Background ambient lighting */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 via-emerald-500 to-indigo-500 p-0.5 shadow-2xl shadow-teal-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-teal-400" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-3">
              CaliSync
              <Badge variant="success" size="sm">
                v2.0
              </Badge>
            </h1>
            <p className="text-xs text-slate-400 font-semibold tracking-wide mt-1 uppercase">
              Studio de Calibration Qualité Live
            </p>
          </div>
        </div>

        {/* Step: Identify */}
        {step === "identify" && (
          <Card className="p-8 space-y-6 animate-scale-up border border-slate-800">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-extrabold text-white">Identification Évaluateur</h2>
              <p className="text-xs text-slate-400">
                Saisissez votre identifiant unique (ex: <span className="text-teal-400 font-semibold">prenom.nom</span>)
              </p>
            </div>

            <form onSubmit={handleIdentify} className="space-y-4">
              <Input
                type="text"
                value={identifiant}
                onChange={(e) => {
                  setIdentifiant(e.target.value);
                  setError(null);
                }}
                placeholder="prenom.nom"
                autoFocus
                icon={<User className="w-4 h-4 text-slate-400" />}
              />

              {error && (
                <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={!identifiant.trim()}
                icon={<ArrowRight className="w-4 h-4" />}
                className="w-full"
              >
                Accéder aux sessions
              </Button>
            </form>

            <div className="pt-4 border-t border-slate-800/80 text-center">
              <button
                onClick={() => setStep("admin_pin")}
                className="text-xs text-slate-500 hover:text-amber-400 font-semibold transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" /> Accès Admin / Animateur
              </button>
            </div>
          </Card>
        )}

        {/* Step: Create Profile */}
        {step === "create_profile" && (
          <Card className="p-8 space-y-6 animate-scale-up border border-slate-800">
            <div className="text-center space-y-1">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                <UserPlus className="w-6 h-6 text-indigo-400" />
              </div>
              <h2 className="text-lg font-extrabold text-white">Nouveau Profil</h2>
              <p className="text-xs text-slate-400">
                Identifiant <span className="text-teal-400 font-bold">{identifiant}</span> non inscrit.
                <br />Créez votre profil pour commencer.
              </p>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-4">
              <Input
                label="Nom complet *"
                type="text"
                value={nomComplet}
                onChange={(e) => {
                  setNomComplet(e.target.value);
                  setError(null);
                }}
                placeholder="ex: Oumar Touré"
                autoFocus
              />

              {error && (
                <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setStep("identify");
                    setError(null);
                  }}
                >
                  Retour
                </Button>
                <Button
                  type="submit"
                  variant="indigo"
                  size="md"
                  loading={loading}
                  disabled={!nomComplet.trim()}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  className="flex-1"
                >
                  Enregistrer & Continuer
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Step: Admin PIN */}
        {step === "admin_pin" && (
          <Card
            className={`p-8 space-y-6 animate-scale-up border border-slate-800 ${
              adminPinShake ? "animate-shake" : ""
            }`}
          >
            <div className="text-center space-y-1">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                <Shield className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-lg font-extrabold text-white">Console Administration</h2>
              <p className="text-xs text-slate-400">Saisissez le code secret administrateur.</p>
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
                className={`w-full text-center text-2xl font-black tracking-widest px-4 py-3.5 rounded-xl bg-slate-950 border transition-all focus:outline-none ${
                  adminPinError
                    ? "border-rose-500 text-rose-400 focus:ring-2 focus:ring-rose-500/30"
                    : "border-slate-800 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                }`}
              />

              {adminPinError && (
                <p className="text-xs text-rose-400 font-semibold text-center">
                  Code secret incorrect. Réessayez.
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setStep("identify");
                    setAdminPin("");
                    setAdminPinError(false);
                  }}
                >
                  Retour
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!adminPin}
                  icon={<Shield className="w-4 h-4" />}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 border-amber-500/30 shadow-amber-600/20"
                >
                  Accéder à la console
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
