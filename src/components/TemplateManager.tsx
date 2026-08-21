import React, { useEffect, useState } from "react";
import {
  listerTemplates,
  sauvegarderTemplate,
  supprimerTemplate,
  importerGrilleComplete,
  type Template,
  type TemplateCategory,
  type TemplateItem,
  type ImportItem,
} from "../lib/api";
import { CaliSyncLogo } from "./ui/CaliSyncLogo";
import {
  ArrowLeft,
  Layers,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Upload,
  FileUp,
  FileText,
  X,
} from "lucide-react";

interface TemplateManagerProps {
  onBack: () => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ onBack }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Edit state
  const [editing, setEditing] = useState<Template | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategories, setEditCategories] = useState<TemplateCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<number, boolean>>({});

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTemplateId, setImportTemplateId] = useState("TPL_QTO_CUSTOM");
  const [importTemplateName, setImportTemplateName] = useState("Grille Importée Genii");
  const [importRawText, setImportRawText] = useState("");
  const [importParsedItems, setImportParsedItems] = useState<ImportItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    const res = await listerTemplates();
    setLoading(false);
    if (res.success) setTemplates(res.templates || []);
    else setTemplates([]);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const clearFeedback = () => setTimeout(() => setFeedback(null), 4000);

  // Helper: CSV / TSV line splitter respecting quotes
  const splitLine = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ""));
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ""));
    return result;
  };

  // ── TSV / CSV Parsing logic ──────────────────────────────────────────────────
  const parseImportText = (text: string) => {
    setImportRawText(text);
    setModalFeedback(null);
    if (!text.trim()) {
      setImportParsedItems([]);
      return;
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      setImportParsedItems([]);
      return;
    }

    const headerLine = lines[0];
    const delimiter = headerLine.includes("\t") ? "\t" : headerLine.includes(";") ? ";" : ",";
    const headers = splitLine(headerLine, delimiter).map((h) => h.toLowerCase());

    const getColIndex = (names: string[]) => headers.findIndex((h) => names.includes(h));

    const idxItemId = getColIndex(["item_id", "id"]);
    const idxParentId = getColIndex(["parent_id", "parent"]);
    const idxNiveau = getColIndex(["niveau", "level"]);
    const idxTypeNoeud = getColIndex(["type_noeud", "type"]);
    const idxCat = getColIndex(["categorie_racine_fr", "categorie", "category"]);
    const idxLib = getColIndex(["libelle_fr", "libelle", "label"]);
    const idxCrit = getColIndex(["criticite", "criticality"]);
    const idxTerm = getColIndex(["est_terminal", "terminal"]);
    const idxComm = getColIndex(["commentaire_obligatoire", "comment_required"]);
    const idxPoids = getColIndex(["poids", "weight"]);

    const parsed: ImportItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = splitLine(lines[i], delimiter);
      if (parts.length < 2) continue;

      const item_id = idxItemId >= 0 ? parts[idxItemId] : parts[0] || "";
      const parent_id = idxParentId >= 0 ? parts[idxParentId] : parts[1] || "";
      const niveauRaw = idxNiveau >= 0 ? parts[idxNiveau] : parts[2] || "2";
      const niveauParsed = parseInt(niveauRaw, 10);
      const niveau = isNaN(niveauParsed) ? 2 : niveauParsed;

      const type_noeud = idxTypeNoeud >= 0 ? parts[idxTypeNoeud] : parts[3] || "";
      const categorie_racine_fr = idxCat >= 0 ? parts[idxCat] : parts[4] || "";
      const libelle_fr = idxLib >= 0 ? parts[idxLib] : parts[5] || "";
      const criticite = idxCrit >= 0 ? parts[idxCrit] : parts[7] || "";
      const est_terminal_str = idxTerm >= 0 ? parts[idxTerm] : parts[8] || "FAUX";
      const comm_oblig_str = idxComm >= 0 ? parts[idxComm] : parts[9] || "FAUX";
      const poidsRaw = idxPoids >= 0 ? parts[idxPoids] : parts[10] || "1";

      if (!item_id && !libelle_fr) continue;

      const est_terminal = /^(vrai|true|1|oui)$/i.test(est_terminal_str);
      const commentaire_obligatoire = /^(vrai|true|1|oui)$/i.test(comm_oblig_str);
      const poids = parseInt(poidsRaw, 10) || 1;

      parsed.push({
        item_id,
        parent_id,
        niveau,
        type_noeud,
        categorie_racine_fr,
        libelle_fr,
        criticite,
        est_terminal,
        commentaire_obligatoire,
        poids,
      });
    }

    setImportParsedItems(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      parseImportText(text);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    setModalFeedback(null);
    if (!importTemplateId.trim()) {
      setModalFeedback({ success: false, message: "Veuillez spécifier un ID de Template (ex: TPL_QTO_CUSTOM)." });
      return;
    }
    if (importParsedItems.length === 0) {
      setModalFeedback({ success: false, message: "Aucun item valide trouvé dans le fichier importé." });
      return;
    }

    setImporting(true);
    try {
      const res = await importerGrilleComplete(importTemplateId, importTemplateName, importParsedItems);
      setImporting(false);
      if (res.success) {
        setModalFeedback({ success: true, message: res.message || "Grille hiérarchique importée avec succès !" });
        setTimeout(() => {
          setShowImportModal(false);
          setImportRawText("");
          setImportParsedItems([]);
          setModalFeedback(null);
          fetchTemplates();
        }, 1200);
      } else {
        setModalFeedback({ success: false, message: res.message || "Erreur lors de l'import backend." });
      }
    } catch (err) {
      setImporting(false);
      setModalFeedback({
        success: false,
        message: err instanceof Error ? err.message : "Erreur réseau lors de l'envoi au backend.",
      });
    }
  };

  // ── New Template ────────────────────────────────────────────────────────────
  const handleNewTemplate = () => {
    const newTemplate: Template = {
      template_id: "",
      nom: "Nouveau Template",
      categories: [
        {
          categorie: "Catégorie 1",
          items: [
            { item_id: "item_001", item_libelle: "Critère d'évaluation", criticite: "Standard" },
          ],
        },
      ],
    };
    setEditing(newTemplate);
    setEditName(newTemplate.nom);
    setEditCategories(JSON.parse(JSON.stringify(newTemplate.categories)));
    setExpandedCats({ 0: true });
  };

  // ── Edit Existing ───────────────────────────────────────────────────────────
  const handleEditTemplate = (template: Template) => {
    setEditing(template);
    setEditName(template.nom);
    setEditCategories(JSON.parse(JSON.stringify(template.categories)));
    const expanded: Record<number, boolean> = {};
    template.categories.forEach((_, i) => { expanded[i] = true; });
    setExpandedCats(expanded);
  };

  // ── Duplicate ───────────────────────────────────────────────────────────────
  const handleDuplicate = (template: Template) => {
    const dup: Template = {
      template_id: "",
      nom: `${template.nom} (copie)`,
      categories: JSON.parse(JSON.stringify(template.categories)),
    };
    setEditing(dup);
    setEditName(dup.nom);
    setEditCategories(dup.categories);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (templateId: string) => {
    if (!confirm("Supprimer ce template définitivement ?")) return;
    const res = await supprimerTemplate(templateId);
    if (res.success) {
      setFeedback({ success: true, message: "Template supprimé." });
      fetchTemplates();
    } else {
      setFeedback({ success: false, message: res.message || "Erreur." });
    }
    clearFeedback();
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editName.trim()) {
      setFeedback({ success: false, message: "Le nom du template est obligatoire." });
      clearFeedback();
      return;
    }

    // Validate: at least 1 category with 1 item
    const validCats = editCategories.filter((c) => c.items.length > 0);
    if (validCats.length === 0) {
      setFeedback({ success: false, message: "Le template doit contenir au moins une catégorie avec un item." });
      clearFeedback();
      return;
    }

    setSaving(true);
    const res = await sauvegarderTemplate(
      editName.trim(),
      editCategories,
      editing?.template_id || undefined
    );
    setSaving(false);

    if (res.success) {
      setFeedback({ success: true, message: `Template "${editName}" sauvegardé avec succès !` });
      setEditing(null);
      fetchTemplates();
    } else {
      setFeedback({ success: false, message: res.message || "Erreur lors de la sauvegarde." });
    }
    clearFeedback();
  };

  // ── Category Helpers ────────────────────────────────────────────────────────
  const addCategory = () => {
    const newCat: TemplateCategory = {
      categorie: `Catégorie ${editCategories.length + 1}`,
      items: [{ item_id: `item_${Date.now()}`, item_libelle: "", criticite: "Standard" }],
    };
    setEditCategories([...editCategories, newCat]);
    setExpandedCats({ ...expandedCats, [editCategories.length]: true });
  };

  const updateCategoryName = (catIdx: number, name: string) => {
    const updated = [...editCategories];
    updated[catIdx] = { ...updated[catIdx], categorie: name };
    setEditCategories(updated);
  };

  const removeCategory = (catIdx: number) => {
    setEditCategories(editCategories.filter((_, i) => i !== catIdx));
  };

  // ── Item Helpers ────────────────────────────────────────────────────────────
  const addItem = (catIdx: number) => {
    const updated = [...editCategories];
    const newItem: TemplateItem = {
      item_id: `item_${Date.now()}_${catIdx}`,
      item_libelle: "",
      criticite: "Standard",
    };
    updated[catIdx] = {
      ...updated[catIdx],
      items: [...updated[catIdx].items, newItem],
    };
    setEditCategories(updated);
  };

  const updateItem = (catIdx: number, itemIdx: number, field: keyof TemplateItem, value: string) => {
    const updated = [...editCategories];
    const items = [...updated[catIdx].items];
    items[itemIdx] = { ...items[itemIdx], [field]: value };
    updated[catIdx] = { ...updated[catIdx], items };
    setEditCategories(updated);
  };

  const removeItem = (catIdx: number, itemIdx: number) => {
    const updated = [...editCategories];
    updated[catIdx] = {
      ...updated[catIdx],
      items: updated[catIdx].items.filter((_, i) => i !== itemIdx),
    };
    setEditCategories(updated);
  };

  const toggleCatExpand = (idx: number) => {
    setExpandedCats({ ...expandedCats, [idx]: !expandedCats[idx] });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={editing ? () => setEditing(null) : onBack}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <CaliSyncLogo size="sm" showText={false} variant="dark" />
            <div>
              <div className="font-extrabold text-white text-base flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-[#1dc4ff]" />
                {editing ? "Éditeur de Template" : "Gestion des Templates"}
              </div>
              <div className="text-xs text-slate-400 font-medium">
                {editing ? `Modification : ${editName}` : `${(templates || []).length} template(s) disponible(s)`}
              </div>
            </div>
          </div>

          {!editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
              >
                <FileUp className="w-3.5 h-3.5" /> Importer Grille CSV/TSV
              </button>
              <button
                onClick={handleNewTemplate}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-teal-600/20"
              >
                <Plus className="w-3.5 h-3.5" /> Nouveau Template
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Feedback */}
          {feedback && (
            <div
              className={`p-4 rounded-xl flex items-center gap-3 border ${
                feedback.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {feedback.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{feedback.message}</span>
            </div>
          )}

          {/* ── Template List View ──────────────────────────────────────────── */}
          {!editing && (
            <>
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                </div>
              )}

              {!loading && templates.length === 0 && (
                <div className="glass-card p-16 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                  <Layers className="w-12 h-12 text-slate-600" />
                  <h3 className="text-lg font-bold text-white">Aucun template</h3>
                  <p className="text-sm text-slate-400">Créez votre premier template de grille d'évaluation.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.map((t) => (
                  <div key={t.template_id} className="glass-card rounded-2xl p-6 space-y-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-teal-400" />
                        <h3 className="font-bold text-white text-base">{t.nom}</h3>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {t.categories.length} catégorie(s) • {t.categories.reduce((a, c) => a + c.items.length, 0)} items
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditTemplate(t)}
                        className="flex-1 px-3 py-2 bg-teal-600/20 border border-teal-500/30 text-teal-300 text-xs font-bold rounded-lg hover:bg-teal-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Edit3 className="w-3 h-3" /> Modifier
                      </button>
                      <button
                        onClick={() => handleDuplicate(t)}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Copy className="w-3 h-3" /> Dupliquer
                      </button>
                      <button
                        onClick={() => handleDelete(t.template_id)}
                        className="px-3 py-2 bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-lg hover:bg-rose-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Template Editor View ────────────────────────────────────────── */}
          {editing && (
            <div className="space-y-6">
              {/* Template Name */}
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Nom du template <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-lg font-bold focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              {/* Categories */}
              {editCategories.map((cat, catIdx) => (
                <div key={catIdx} className="glass-card rounded-2xl overflow-hidden">
                  {/* Category Header */}
                  <div
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-800/30 transition-colors"
                    onClick={() => toggleCatExpand(catIdx)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="text"
                        value={cat.categorie}
                        onChange={(e) => updateCategoryName(catIdx, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent text-white font-bold text-base focus:outline-none focus:border-b focus:border-teal-500 border-b border-transparent transition-colors flex-1"
                      />
                      <span className="text-xs text-slate-500 font-medium flex-shrink-0">
                        {cat.items.length} item(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeCategory(catIdx); }}
                        className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {expandedCats[catIdx] ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  {expandedCats[catIdx] && (
                    <div className="px-5 pb-5 space-y-2 border-t border-slate-800">
                      {cat.items.map((item, itemIdx) => (
                        <div
                          key={item.item_id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800"
                        >
                          <input
                            type="text"
                            value={item.item_libelle}
                            onChange={(e) => updateItem(catIdx, itemIdx, "item_libelle", e.target.value)}
                            placeholder="Libellé du critère..."
                            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-600"
                          />
                          <select
                            value={item.criticite}
                            onChange={(e) => updateItem(catIdx, itemIdx, "criticite", e.target.value)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                              item.criticite === "Critical"
                                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                : "bg-slate-800 border-slate-700 text-slate-300"
                            }`}
                          >
                            <option value="Standard">Standard</option>
                            <option value="Critical">Critical</option>
                          </select>
                          <button
                            onClick={() => removeItem(catIdx, itemIdx)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      <button
                        onClick={() => addItem(catIdx)}
                        className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-teal-400 hover:border-teal-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Ajouter un item
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Add Category */}
              <button
                onClick={addCategory}
                className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-700 text-slate-500 hover:text-teal-400 hover:border-teal-500/30 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Ajouter une catégorie
              </button>

              {/* Save Bar */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => setEditing(null)}
                  className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white font-extrabold rounded-xl shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" /> Sauvegarder le template
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── MODAL IMPORT CSV / TSV ────────────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-pop-in my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-lg">Importer une Grille d'Évaluation</h3>
                  <p className="text-xs text-slate-400">
                    Importez la structure 4 niveaux depuis un fichier Excel/CSV/TSV
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inputs template meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ID du Template *</label>
                <input
                  type="text"
                  value={importTemplateId}
                  onChange={(e) => setImportTemplateId(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                  placeholder="ex: TPL_QTO_CUSTOM"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nom du Template</label>
                <input
                  type="text"
                  value={importTemplateName}
                  onChange={(e) => setImportTemplateName(e.target.value)}
                  placeholder="ex: Grille Genii 4 Niveaux"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Upload Zone */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                Fichier de données (déposez ou collez le contenu TSV/CSV)
              </label>
              <div className="flex items-center gap-3">
                <label className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-2 transition-all">
                  <Upload className="w-4 h-4 text-indigo-400" /> Choisir un fichier (.tsv / .csv / .txt)
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {importParsedItems.length > 0 && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> {importParsedItems.length} items détectés
                  </span>
                )}
              </div>

              <textarea
                rows={6}
                value={importRawText}
                onChange={(e) => parseImportText(e.target.value)}
                placeholder="Copiez-collez ici le contenu tabulé de votre fichier Excel..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Preview breakdown */}
            {importParsedItems.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Aperçu de la structure détectée :</span>
                  <span className="text-indigo-400 font-mono">
                    N2: {importParsedItems.filter((i) => i.niveau === 2).length} | N3:{" "}
                    {importParsedItems.filter((i) => i.niveau === 3).length} | N4:{" "}
                    {importParsedItems.filter((i) => i.niveau === 4).length}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-400 border-t border-slate-800 pt-2">
                  {importParsedItems.slice(0, 10).map((it, idx) => (
                    <div key={idx} className="truncate">
                      <span className="text-indigo-400 font-bold">N{it.niveau}</span> [{it.item_id}] (Parent:{" "}
                      {it.parent_id || "aucun"}) - <span className="text-slate-200">{it.libelle_fr}</span>
                    </div>
                  ))}
                  {importParsedItems.length > 10 && (
                    <div className="text-slate-500 italic">
                      ... et {importParsedItems.length - 10} autres éléments.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* In-Modal Feedback Banner */}
            {modalFeedback && (
              <div
                className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 border animate-pop-in ${
                  modalFeedback.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                {modalFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )}
                <span>{modalFeedback.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importing || importParsedItems.length === 0}
                className={`px-6 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                  importParsedItems.length > 0 && !importing
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 active:scale-95"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" /> Enregistrement en cours...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" /> Enregistrer la grille complète
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManager;
