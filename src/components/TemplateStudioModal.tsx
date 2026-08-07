import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Copy,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  Settings2,
  FileSpreadsheet,
  HelpCircle,
  ShieldAlert,
  ChevronRight
} from "lucide-react";
import { getConfigTemplate, dupliquerTemplate, sauvegarderGrilleComplete, type Template } from "../lib/api";

export interface FlatGridItem {
  item_id: string;
  niveau: number;
  parent_id: string;
  est_terminal: boolean;
  commentaire_obligatoire: boolean;
  libelle: string;
  criticite: "Standard" | "Critical";
  categorie_racine_fr?: string;
}

interface TemplateStudioModalProps {
  template: Template;
  onClose: () => void;
  onSaved: () => void;
}

export const TemplateStudioModal: React.FC<TemplateStudioModalProps> = ({
  template,
  onClose,
  onSaved,
}) => {
  const [templateName, setTemplateName] = useState(template.nom || "Nouveau Template");
  const [items, setItems] = useState<FlatGridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Active view: 'editor' | 'preview'
  const [viewMode, setViewMode] = useState<"editor" | "preview">("editor");

  // State for interactive preview
  const [previewValues, setPreviewValues] = useState<Record<string, "Oui" | "Non" | "N.A.">>({});
  const [previewComments, setPreviewComments] = useState<Record<string, string>>({});

  useEffect(() => {
    loadConfig();
  }, [template.template_id]);

  const loadConfig = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await getConfigTemplate(template.template_id);
      if (res && res.success && Array.isArray(res.items)) {
        const mapped: FlatGridItem[] = res.items.map((it: any) => ({
          item_id: it.item_id || `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          niveau: parseInt(it.niveau, 10) || 2,
          parent_id: it.parent_id || "",
          est_terminal: it.est_terminal === true || String(it.est_terminal).toUpperCase() === "VRAI",
          commentaire_obligatoire:
            it.commentaire_obligatoire === true || String(it.commentaire_obligatoire).toUpperCase() === "VRAI",
          libelle: it.libelle_fr || it.libelle || "",
          criticite: it.criticite === "Critical" ? "Critical" : "Standard",
          categorie_racine_fr: it.categorie_racine_fr || "Général",
        }));
        setItems(mapped);
      } else {
        setItems([
          {
            item_id: "cat_1",
            niveau: 1,
            parent_id: "",
            est_terminal: false,
            commentaire_obligatoire: false,
            libelle: "Relationnel & Accueil",
            criticite: "Standard",
            categorie_racine_fr: "Relationnel & Accueil",
          },
          {
            item_id: "item_1",
            niveau: 2,
            parent_id: "cat_1",
            est_terminal: true,
            commentaire_obligatoire: true,
            libelle: "Sourire vocal & empathie dès la prise d'appel",
            criticite: "Standard",
            categorie_racine_fr: "Relationnel & Accueil",
          },
        ]);
      }
    } catch (e) {
      setFeedback({ success: false, message: "Erreur lors du chargement du template." });
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!window.confirm(`Dupliquer le template "${templateName}" ?`)) return;
    setDuplicating(true);
    try {
      const res = await dupliquerTemplate(template.template_id, `${templateName} (Copie)`);
      if (res.success) {
        setFeedback({ success: true, message: "Template dupliqué avec succès !" });
        setTimeout(() => {
          onSaved();
          onClose();
        }, 1200);
      } else {
        setFeedback({ success: false, message: res.message || "Erreur de duplication." });
      }
    } catch (e) {
      setFeedback({ success: false, message: "Erreur lors de la duplication." });
    } finally {
      setDuplicating(false);
    }
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      setFeedback({ success: false, message: "Le nom du template ne peut pas être vide." });
      return;
    }
    setSaving(true);
    setFeedback(null);

    const payloadItems = items.map((it) => ({
      item_id: it.item_id,
      niveau: it.niveau,
      parent_id: it.parent_id,
      est_terminal: it.est_terminal ? "VRAI" : "FAUX",
      commentaire_obligatoire: it.commentaire_obligatoire ? "VRAI" : "FAUX",
      libelle_fr: it.libelle,
      criticite: it.criticite,
      categorie_racine_fr: it.categorie_racine_fr || "Général",
    }));

    try {
      const res = await sauvegarderGrilleComplete(template.template_id, templateName, payloadItems);
      if (res.success) {
        setFeedback({ success: true, message: "Grille et règles d'imputation enregistrées !" });
        setTimeout(() => {
          onSaved();
        }, 1000);
      } else {
        setFeedback({ success: false, message: res.message || "Erreur d'enregistrement." });
      }
    } catch (e) {
      setFeedback({ success: false, message: "Erreur lors de la sauvegarde." });
    } finally {
      setSaving(false);
    }
  };

  const addItem = (niveau: number, parentId: string = "", categorieName: string = "Général") => {
    const newId = `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newItem: FlatGridItem = {
      item_id: newId,
      niveau,
      parent_id: parentId,
      est_terminal: niveau === 2,
      commentaire_obligatoire: true,
      libelle: niveau === 1 ? "Nouvelle Catégorie" : niveau === 2 ? "Nouvel Item d'Évaluation" : "Nouveau sous-critère d'écart",
      criticite: "Standard",
      categorie_racine_fr: categorieName,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const deleteItem = (itemId: string) => {
    const getDescendants = (id: string): string[] => {
      const children = items.filter((it) => it.parent_id === id);
      let desc: string[] = [];
      children.forEach((c) => {
        desc.push(c.item_id);
        desc = desc.concat(getDescendants(c.item_id));
      });
      return desc;
    };

    const toDelete = new Set([itemId, ...getDescendants(itemId)]);
    setItems((prev) => prev.filter((it) => !toDelete.has(it.item_id)));
  };

  const updateItem = (itemId: string, updates: Partial<FlatGridItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.item_id === itemId ? { ...it, ...updates } : it))
    );
  };

  const explicitCategories = items.filter((it) => it.niveau === 1);

  let displayCategories: { item_id: string; libelle: string; isExplicit: boolean }[] = [];

  if (explicitCategories.length > 0) {
    displayCategories = explicitCategories.map((c) => ({
      item_id: c.item_id,
      libelle: c.libelle,
      isExplicit: true,
    }));
  } else {
    const catSet = new Set<string>();
    items.forEach((it) => {
      const catName = it.categorie_racine_fr || "Général";
      catSet.add(catName);
    });
    if (catSet.size === 0 && items.length > 0) {
      catSet.add("Général");
    }
    displayCategories = Array.from(catSet).map((catName) => ({
      item_id: `cat_v_${catName.replace(/[^a-zA-Z0-9]/g, "_")}`,
      libelle: catName,
      isExplicit: false,
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl shadow-2xl space-y-6 my-6 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/10 border border-teal-500/20 rounded-2xl text-teal-400">
              <Settings2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                Studio de Template — {template.template_id}
              </h2>
              <p className="text-xs text-slate-400">
                Éditeur d'arborescence, criticité et règles d'imputation spécifiques
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode("editor")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "editor"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" /> Éditeur
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "preview"
                    ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Aperçu Interactif
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="px-6">
            <div
              className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold ${
                feedback.success
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
              }`}
            >
              {feedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          </div>
        )}

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Nom du Template
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="ex: Grille GENII V2 - Relation Client"
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-teal-500 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDuplicate}
                  disabled={duplicating || loading}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Dupliquer ce template"
                >
                  {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4 text-teal-400" />}
                  Dupliquer Template
                </button>
                <button
                  type="button"
                  onClick={() => addItem(1)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <Plus className="w-4 h-4" /> Ajouter une Catégorie (N1)
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
              <p className="text-xs font-semibold">Chargement de la structure du template...</p>
            </div>
          ) : viewMode === "editor" ? (
            <div className="space-y-6">
              {displayCategories.length === 0 ? (
                <div className="glass-card p-12 text-center rounded-2xl space-y-4 border border-slate-800">
                  <FileSpreadsheet className="w-10 h-10 text-slate-500 mx-auto" />
                  <p className="text-slate-400 text-xs font-medium">Aucune catégorie dans ce template.</p>
                  <button
                    onClick={() => addItem(1)}
                    className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl"
                  >
                    + Créer une catégorie
                  </button>
                </div>
              ) : (
                displayCategories.map((cat) => {
                  const n2Items = items.filter(
                    (it) =>
                      it.niveau === 2 &&
                      (it.parent_id === cat.item_id || (it.categorie_racine_fr || "Général") === cat.libelle)
                  );

                  return (
                    <div key={cat.item_id} className="glass-card rounded-2xl border border-slate-800 p-5 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/30 text-[10px] font-black uppercase">
                            N1 — Catégorie
                          </span>
                          <input
                            type="text"
                            value={cat.libelle}
                            onChange={(e) => updateItem(cat.item_id, { libelle: e.target.value })}
                            className="bg-transparent font-black text-white text-base focus:outline-none border-b border-transparent focus:border-teal-500 flex-1 px-1"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => addItem(2, cat.item_id, cat.libelle)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Item N2
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(cat.item_id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                            title="Supprimer cette catégorie"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 pl-2 sm:pl-4">
                        {n2Items.map((n2) => {
                          const n3Items = items.filter((it) => it.parent_id === n2.item_id);

                          return (
                            <div
                              key={n2.item_id}
                              className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="flex items-start gap-2 flex-1">
                                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase mt-1">
                                    N2 Item
                                  </span>
                                  <div className="flex-1 space-y-2">
                                    <textarea
                                      rows={2}
                                      value={n2.libelle}
                                      onChange={(e) => updateItem(n2.item_id, { libelle: e.target.value })}
                                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 font-bold text-white text-xs focus:outline-none focus:border-teal-500"
                                      placeholder="Libellé de la question d'évaluation principale..."
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => addItem(3, n2.item_id, cat.libelle)}
                                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-500/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Motif Écart N3
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteItem(n2.item_id)}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                                    title="Supprimer cet item N2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-900 text-xs">
                                <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                                  <span className="font-semibold text-slate-400 flex items-center gap-1">
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Criticité
                                  </span>
                                  <select
                                    value={n2.criticite}
                                    onChange={(e) => updateItem(n2.item_id, { criticite: e.target.value as any })}
                                    className={`px-2 py-1 rounded-lg font-bold text-[11px] border focus:outline-none ${
                                      n2.criticite === "Critical"
                                        ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                                        : "bg-slate-800 text-slate-300 border-slate-700"
                                    }`}
                                  >
                                    <option value="Standard">Standard</option>
                                    <option value="Critical">Critical (KO)</option>
                                  </select>
                                </div>

                                <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                                  <span className="font-semibold text-slate-400 flex items-center gap-1" title="Si VRAI, cocher 'Oui' clôture l'item sans sous-questions">
                                    <HelpCircle className="w-3.5 h-3.5 text-teal-400" /> Clôture "Oui" (Terminal)
                                  </span>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={n2.est_terminal}
                                      onChange={(e) => updateItem(n2.item_id, { est_terminal: e.target.checked })}
                                      className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                                  </label>
                                </div>

                                <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                                  <span className="font-semibold text-slate-400 flex items-center gap-1" title="Si VRAI, cocher 'Non' oblige à saisir un commentaire">
                                    💬 Com. Obligatoire sur "Non"
                                  </span>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={n2.commentaire_obligatoire}
                                      onChange={(e) => updateItem(n2.item_id, { commentaire_obligatoire: e.target.checked })}
                                      className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                  </label>
                                </div>
                              </div>

                              {n3Items.length > 0 && (
                                <div className="space-y-3 pl-3 sm:pl-6 border-l-2 border-slate-800 mt-3 pt-3">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                    <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                                    Motifs d'écart & Précisions (Déclenchés si "Non")
                                  </div>

                                  {n3Items.map((n3) => {
                                    const n4Items = items.filter((it) => it.parent_id === n3.item_id);

                                    return (
                                      <div key={n3.item_id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex items-start gap-2 flex-1">
                                            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[9px] font-black uppercase mt-1">
                                              N3 Motif
                                            </span>
                                            <input
                                              type="text"
                                              value={n3.libelle}
                                              onChange={(e) => updateItem(n3.item_id, { libelle: e.target.value })}
                                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-semibold text-white text-xs focus:outline-none focus:border-purple-500"
                                              placeholder="Préciser le motif d'écart N3..."
                                            />
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => addItem(4, n3.item_id, cat.libelle)}
                                              className="px-2 py-1 bg-slate-800 text-purple-300 text-[10px] font-bold rounded-lg border border-purple-500/30 hover:bg-slate-700"
                                            >
                                              + N4
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => deleteItem(n3.item_id)}
                                              className="p-1 text-slate-500 hover:text-rose-400 rounded"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {n4Items.length > 0 && (
                                          <div className="space-y-2 pl-4 border-l border-purple-500/20 pt-2">
                                            {n4Items.map((n4) => (
                                              <div key={n4.item_id} className="flex items-center justify-between gap-2">
                                                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[9px] font-black">
                                                  N4 Précision
                                                </span>
                                                <input
                                                  type="text"
                                                  value={n4.libelle}
                                                  onChange={(e) => updateItem(n4.item_id, { libelle: e.target.value })}
                                                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-medium text-white text-[11px] focus:outline-none focus:border-rose-500"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => deleteItem(n4.item_id)}
                                                  className="p-1 text-slate-500 hover:text-rose-400"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center gap-3 text-xs text-teal-300">
                <Eye className="w-4 h-4 flex-shrink-0" />
                <span>
                  <strong>Mode Aperçu Interactif :</strong> Testez en temps réel la réaction du formulaire d'évaluation avec vos règles d'imputation.
                </span>
              </div>

              {displayCategories.map((cat) => {
                const n2Items = items.filter(
                  (it) =>
                    it.niveau === 2 &&
                    (it.parent_id === cat.item_id || (it.categorie_racine_fr || "Général") === cat.libelle)
                );

                return (
                  <div key={cat.item_id} className="glass-card rounded-2xl border border-slate-800 p-6 space-y-4">
                    <h3 className="text-base font-black text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                      {cat.libelle}
                    </h3>

                    <div className="space-y-4">
                      {n2Items.map((n2) => {
                        const val = previewValues[n2.item_id];
                        const isNon = val === "Non";
                        const n3Items = items.filter((it) => it.parent_id === n2.item_id);

                        return (
                          <div key={n2.item_id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-xs">{n2.libelle}</span>
                                  {n2.criticite === "Critical" && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      CRITICAL
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                                {(["Oui", "Non", "N.A."] as const).map((choice) => (
                                  <button
                                    key={choice}
                                    type="button"
                                    onClick={() =>
                                      setPreviewValues((prev) => ({ ...prev, [n2.item_id]: choice }))
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                      val === choice
                                        ? choice === "Oui"
                                          ? "bg-emerald-600 text-white"
                                          : choice === "Non"
                                          ? "bg-rose-600 text-white"
                                          : "bg-slate-700 text-white"
                                        : "text-slate-400 hover:text-white"
                                    }`}
                                  >
                                    {choice}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {isNon && (
                              <div className="space-y-2 pt-2 border-t border-slate-900">
                                <label className="block text-[11px] font-bold text-rose-400">
                                  💬 Commentaire explicatif {n2.commentaire_obligatoire ? "(OBLIGATOIRE)" : "(Facultatif)"}
                                </label>
                                <textarea
                                  rows={2}
                                  value={previewComments[n2.item_id] || ""}
                                  onChange={(e) =>
                                    setPreviewComments((prev) => ({ ...prev, [n2.item_id]: e.target.value }))
                                  }
                                  placeholder="Décrivez l'écart constaté..."
                                  className={`w-full p-2.5 bg-slate-900 border rounded-xl text-xs text-white focus:outline-none ${
                                    n2.commentaire_obligatoire && !previewComments[n2.item_id]
                                      ? "border-rose-500/50"
                                      : "border-slate-800"
                                  }`}
                                />
                              </div>
                            )}

                            {isNon && n3Items.length > 0 && (
                              <div className="pl-4 border-l-2 border-rose-500/30 space-y-3 pt-2">
                                <p className="text-[11px] font-bold text-slate-300">
                                  Précisez les motifs de l'imputation :
                                </p>
                                {n3Items.map((n3) => {
                                  const n3Val = previewValues[n3.item_id];
                                  return (
                                    <div key={n3.item_id} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-slate-200">{n3.libelle}</span>
                                        <div className="flex items-center gap-1.5">
                                          {(["Oui", "Non", "N.A."] as const).map((choice) => (
                                            <button
                                              key={choice}
                                              type="button"
                                              onClick={() =>
                                                setPreviewValues((prev) => ({ ...prev, [n3.item_id]: choice }))
                                              }
                                              className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold ${
                                                n3Val === choice
                                                  ? choice === "Oui"
                                                    ? "bg-emerald-600 text-white"
                                                    : choice === "Non"
                                                    ? "bg-rose-600 text-white"
                                                    : "bg-slate-700 text-white"
                                                  : "bg-slate-950 text-slate-400"
                                              }`}
                                            >
                                              {choice}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Total d'éléments : <span className="text-white font-bold">{items.length}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer la Grille & Règles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
