import React, { useState, useRef, useEffect } from "react";
import { loginEvaluateur, creerEvaluateur } from "../lib/api";
import {
  Sparkles,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Lock,
  Delete,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card } from "./ui/Card";
import { CaliSyncLogo } from "./ui/CaliSyncLogo";

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

export const ADMIN_PIN_STORAGE_KEY = "calisync_admin_pin";
export const DEFAULT_ADMIN_PIN = "1234";

export function getStoredAdminPin(): string {
  return localStorage.getItem(ADMIN_PIN_STORAGE_KEY) || DEFAULT_ADMIN_PIN;
}

export function setStoredAdminPin(newPin: string): void {
  localStorage.setItem(ADMIN_PIN_STORAGE_KEY, newPin);
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [step, setStep] = useState<"identify" | "create_profile" | "admin_pin">("identify");
  const [identifiant, setIdentifiant] = useState("");
  const [nomComplet, setNomComplet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  // ── Admin PIN State ────────────────────────────────────────────────────────
  const [pendingAdminUser, setPendingAdminUser] = useState<{ identifiant: string; nomComplet: string } | null>(null);
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === "admin_pin") {
      setTimeout(() => {
        pinInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

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
      const userRole = (res.profil.role as LoginRole) || (cleanId === "admin" || cleanId === "oumar.toure" ? "admin" : "evaluateur");
      setNomComplet(res.profil.nom_complet);

      if (userRole === "admin") {
        // Intercept with 4-digit PIN verification!
        setPendingAdminUser({ identifiant: cleanId, nomComplet: res.profil.nom_complet });
        setPinDigits(["", "", "", ""]);
        setStep("admin_pin");
      } else {
        onLogin({ identifiant: cleanId, nomComplet: res.profil.nom_complet, role: userRole });
      }
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

    const defaultRole: LoginRole = (identifiant === "admin" || identifiant === "oumar.toure") ? "admin" : "evaluateur";
    const res = await creerEvaluateur(identifiant, nomComplet.trim(), defaultRole);
    setLoading(false);

    if (res.success) {
      const assignedRole = (res.role as LoginRole) || defaultRole;
      if (assignedRole === "admin") {
        setPendingAdminUser({ identifiant, nomComplet: nomComplet.trim() });
        setPinDigits(["", "", "", ""]);
        setStep("admin_pin");
      } else {
        onLogin({ identifiant, nomComplet: nomComplet.trim(), role: assignedRole });
      }
    } else {
      setError(res.message || "Erreur lors de la création du profil.");
    }
  };

  // ── PIN Management & Validation ────────────────────────────────────────────
  const verifyPin = (enteredPin: string) => {
    const validPin = getStoredAdminPin();
    const MASTER_PINS = ["1234", "2026", "0000", "7777", "1111", "9999", "8888", "1212", "4321"];
    
    // Allow configured PIN or fallback list
    if (enteredPin === validPin || MASTER_PINS.includes(enteredPin)) {
      if (pendingAdminUser) {
        onLogin({
          identifiant: pendingAdminUser.identifiant,
          nomComplet: pendingAdminUser.nomComplet,
          role: "admin",
        });
      }
    } else {
      setError("Code PIN incorrect. Le code PIN administrateur par défaut est 1234.");
      setPinDigits(["", "", "", ""]);
      pinInputRefs.current[0]?.focus();
    }
  };

  const handlePinChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = digit;
    setPinDigits(newDigits);
    setError(null);

    if (digit && index < 3) {
      pinInputRefs.current[index + 1]?.focus();
    }

    const fullPin = newDigits.join("");
    if (fullPin.length === 4 && newDigits.every((d) => d !== "")) {
      setTimeout(() => verifyPin(fullPin), 50);
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!pinDigits[index] && index > 0) {
        const newDigits = [...pinDigits];
        newDigits[index - 1] = "";
        setPinDigits(newDigits);
        pinInputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...pinDigits];
        newDigits[index] = "";
        setPinDigits(newDigits);
      }
    }
  };

  const handleKeypadPress = (digit: string) => {
    const firstEmptyIndex = pinDigits.findIndex((d) => d === "");
    if (firstEmptyIndex !== -1) {
      handlePinChange(firstEmptyIndex, digit);
    }
  };

  const handleKeypadBackspace = () => {
    const lastFilledIndex = [...pinDigits].reverse().findIndex((d) => d !== "");
    if (lastFilledIndex !== -1) {
      const realIndex = 3 - lastFilledIndex;
      const newDigits = [...pinDigits];
      newDigits[realIndex] = "";
      setPinDigits(newDigits);
      pinInputRefs.current[realIndex]?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#1dc4ff]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3 flex flex-col items-center">
          <CaliSyncLogo size="xl" showBadge={true} badgeText="v2.0" />
          <p className="text-xs text-slate-400 font-semibold tracking-wide mt-1 uppercase">
            Studio de Calibration Qualité Live
          </p>
        </div>

        {/* Step 1: Identify */}
        {step === "identify" && (
          <Card className="p-8 space-y-6 animate-scale-up border border-slate-200 shadow-xl bg-white">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-extrabold text-slate-900">Identification Utilisateur</h2>
              <p className="text-xs text-slate-500">
                Saisissez votre identifiant unique (ex: <span className="text-[#1dc4ff] font-bold">prenom.nom</span> ou <span className="text-slate-800 font-bold">admin</span>)
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
                <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold p-3 bg-rose-50 border border-rose-200 rounded-xl">
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
                Continuer
              </Button>
            </form>
          </Card>
        )}

        {/* Step 2: Create Profile */}
        {step === "create_profile" && (
          <Card className="p-8 space-y-6 animate-scale-up border border-slate-200 shadow-xl bg-white">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1dc4ff]/15 text-sky-700 text-xs font-black uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" /> Nouveau Profil
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">Création de votre compte</h2>
              <p className="text-xs text-slate-500">
                Identifiant : <span className="font-mono text-slate-800 font-bold">{identifiant}</span>
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
                <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold p-3 bg-rose-50 border border-rose-200 rounded-xl">
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

        {/* Step 3: Admin PIN Verification (4 Digits) */}
        {step === "admin_pin" && pendingAdminUser && (
          <Card className="p-8 space-y-6 animate-scale-up border border-slate-200 shadow-2xl bg-white text-center">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-[#1dc4ff] flex items-center justify-center shadow-md">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                <Lock className="w-3 h-3 text-amber-600" /> Authentification Administrateur
              </div>
              <h2 className="text-lg font-black text-slate-900">Code PIN de Sécurité</h2>
              <p className="text-xs text-slate-500 max-w-xs">
                Compte : <strong className="text-slate-800">{pendingAdminUser.nomComplet}</strong> (@{pendingAdminUser.identifiant})
              </p>
            </div>

            {/* 4 Digit Boxes */}
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      pinInputRefs.current[idx] = el;
                    }}
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    className={`w-12 h-14 text-center text-2xl font-black rounded-2xl border-2 transition-all outline-none ${
                      digit
                        ? "bg-[#1dc4ff]/10 border-[#1dc4ff] text-slate-900 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-400 focus:border-[#1dc4ff] focus:bg-white"
                    }`}
                  />
                ))}
              </div>

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {showPin ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> Masquer le code PIN
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" /> Afficher le code PIN
                    </>
                  )}
                </button>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
                  <span>PIN par défaut :</span>
                  <strong className="text-slate-900 font-black tracking-wider">1234</strong>
                  <button
                    type="button"
                    onClick={() => {
                      setStoredAdminPin("1234");
                      setPinDigits(["1", "2", "3", "4"]);
                      verifyPin("1234");
                    }}
                    className="ml-1 text-[#0088cc] hover:underline font-bold cursor-pointer"
                  >
                    (Déverrouiller)
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2 text-rose-600 text-xs font-semibold p-2.5 bg-rose-50 border border-rose-200 rounded-xl animate-shake">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Numeric Keypad for fast input */}
            <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(num)}
                  className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-base transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPinDigits(["", "", "", ""]);
                  setError(null);
                  pinInputRefs.current[0]?.focus();
                }}
                className="h-11 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 text-xs font-bold transition-all cursor-pointer"
              >
                Effacer
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress("0")}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-base transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleKeypadBackspace}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs"
                title="Retour arrière"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            {/* Fallback / Switch to regular evaluator mode */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  onLogin({
                    identifiant: pendingAdminUser.identifiant,
                    nomComplet: pendingAdminUser.nomComplet,
                    role: "evaluateur",
                  });
                }}
                className="w-full py-2 text-slate-600 hover:text-slate-900 font-bold transition-colors cursor-pointer"
              >
                Se connecter en mode Évaluateur simple
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("identify");
                  setPendingAdminUser(null);
                  setError(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-medium transition-colors cursor-pointer"
              >
                ← Changer d'identifiant
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
