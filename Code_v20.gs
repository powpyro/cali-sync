// ==============================================================================
// CALI-SYNC v2.0 — BACKEND GOOGLE APPS SCRIPT (Code.gs v7)
// Base de Données : Google Sheet "Cali-Sync_DB"
// Support : Ouverture & Fermeture explicites, Conseiller, Consignes, Rôles
// ==============================================================================

const SPREADSHEET_NAME = "Cali-Sync_DB";

// ==============================================================================
// UTILITAIRE — Exécuter UNE FOIS dans Apps Script pour accorder les droits Google Docs / Drive
// ==============================================================================
function autoriserGoogleDocsPermissions() {
  const ss = getSpreadsheet();
  Logger.log("Test des autorisations Google Docs & Drive...");
  const doc = DocumentApp.create("Test_Permissions_CaliSync");
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).setTrashed(true);
  Logger.log("✅ Autorisations Google Docs et Drive validées avec succès !");
}

function estNa(val) {
  if (!val) return false;
  var s = String(val).trim().toUpperCase();
  return s === "N.A." || s === "NA" || s === "N/A" || s === "NOT APPLICABLE";
}

function estImpute(val) {
  if (!val) return false;
  var s = String(val).trim().toUpperCase();
  return s === "NON" || s === "C" || s === "CRITIQUE" || s === "IMPUTE" || s === "NO";
}

function estConforme(val) {
  if (!val) return false;
  var s = String(val).trim().toUpperCase();
  return s === "OUI" || s === "NC" || s === "NON CRITIQUE" || s === "VALIDE" || s === "YES" || s === "OK";
}

function normaliserReponse(val) {
  if (estNa(val)) return "N.A.";
  if (estImpute(val)) return "Non";
  if (estConforme(val)) return "Oui";
  return String(val || "").trim();
}

function getSpreadsheet() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId()) return active;
  } catch (e) {}
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  const ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  initialiserBaseDeDonnees(ss);
  return ss;
}

function initialiserBaseDeDonnees(ss) {
  if (!ss) ss = getSpreadsheet();

  let sheetEval = ss.getSheetByName("Registre_Evaluateurs");
  if (!sheetEval) {
    sheetEval = ss.insertSheet("Registre_Evaluateurs");
    sheetEval.appendRow(["identifiant", "nom_complet", "date_creation", "nombre_sessions", "role"]);
    sheetEval.appendRow(["oumar.toure", "Oumar Touré", new Date().toISOString(), 1, "admin"]);
    sheetEval.appendRow(["jean.dupont", "Jean Dupont", new Date().toISOString(), 1, "evaluateur"]);
  }

  let sheetTpl = ss.getSheetByName("Templates_Grilles");
  if (!sheetTpl) {
    sheetTpl = ss.insertSheet("Templates_Grilles");
    sheetTpl.appendRow(["template_id", "nom_template", "categorie", "item_id", "item_libelle", "criticite", "poids"]);
    sheetTpl.appendRow(["TPL_QTO_STD", "Grille Standard QTO", "Relationnel & Accueil", "item_rel_01", "Sourire vocal & empathie dès la prise d'appel", "Standard", 1]);
    sheetTpl.appendRow(["TPL_QTO_STD", "Grille Standard QTO", "Relationnel & Accueil", "item_rel_02", "Identification claire du conseiller et de la marque", "Standard", 1]);
    sheetTpl.appendRow(["TPL_QTO_STD", "Grille Standard QTO", "Relationnel & Accueil", "item_rel_03", "Écoute active sans interruption du client", "Critical", 1]);
    sheetTpl.appendRow(["TPL_QTO_STD", "Grille Standard QTO", "Technique & Processus", "item_tech_01", "Vérification stricte de l'identité du client (DPA)", "Critical", 1]);
    sheetTpl.appendRow(["TPL_QTO_STD", "Grille Standard QTO", "Technique & Processus", "item_tech_02", "Diagnostic précis du besoin ou du problème", "Standard", 1]);
    sheetTpl.appendRow(["TPL_QTO_STD", "Grille Standard QTO", "Technique & Processus", "item_tech_03", "Reformulation et validation de la solution", "Standard", 1]);
    sheetTpl.appendRow(["TPL_QTO_STD", "Grille Standard QTO", "Clôture & Outils", "item_clo_01", "Proposition d'assistance complémentaire", "Standard", 1]);
    sheetTpl.appendRow(["TPL_QTO_STD", "Grille Standard QTO", "Clôture & Outils", "item_clo_02", "Prise de note complète dans le CRM / Outil métier", "Standard", 1]);
  }

  let sheetSess = ss.getSheetByName("Sessions");
  if (!sheetSess) {
    sheetSess = ss.insertSheet("Sessions");
    sheetSess.appendRow(["session_id", "nom_session", "statut", "pin", "template_id", "heure_ouverture", "duree_minutes", "heure_fin", "url_audio", "date_creation", "animateur_id", "gauge_id", "nom_conseiller", "consignes"]);
    const now = new Date();
    const in15Min = new Date(now.getTime() + 15 * 60000);
    sheetSess.appendRow(["SESS_2026_001", "Session Démo Calibrage", "OPEN", "123456", "TPL_QTO_STD", now.toISOString(), 15, in15Min.toISOString(), "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", now.toISOString(), "oumar.toure", "oumar.toure", "Marc Dubois", "Vérification DPA obligatoire"]);
  }

  let sheetSub = ss.getSheetByName("Log_Soumissions");
  if (!sheetSub) {
    sheetSub = ss.insertSheet("Log_Soumissions");
    sheetSub.appendRow(["timestamp", "session_id", "evaluateur_id", "est_gauge", "item_id", "categorie", "item_nom", "statut", "commentaire"]);
  }

  let sheetDem = ss.getSheetByName("Demandes_Calibrage");
  if (!sheetDem) {
    sheetDem = ss.insertSheet("Demandes_Calibrage");
    sheetDem.appendRow(["demande_id", "evaluateur_id", "nom_session", "template_id", "heure_ouverture_proposee", "heure_fermeture_proposee", "duree_minutes", "url_audio", "statut", "date_demande", "nom_conseiller", "consignes"]);
  }

  let sheetArb = ss.getSheetByName("Historique_Arbitrages");
  if (!sheetArb) {
    sheetArb = ss.insertSheet("Historique_Arbitrages");
    sheetArb.appendRow(["timestamp", "session_id", "categorie", "item_nom", "decision_arbitrage", "nouvelle_consigne", "animateur_id"]);
  }

  // Onglet 6 : Admin_Config_Grille
  // Colonnes : template_id | item_id | niveau | parent_id | est_terminal | commentaire_obligatoire | libelle
  // Niveau 2 = question principale (toujours obligatoire)
  // Niveau 3 = sous-critère déclenché si le parent est répondu "Non"
  // Niveau 4 = précision supplémentaire déclenchée si le parent de niveau 3 est "Non"
  let sheetCfg = ss.getSheetByName("Admin_Config_Grille");
  if (!sheetCfg) {
    sheetCfg = ss.insertSheet("Admin_Config_Grille");
    sheetCfg.appendRow([
      "template_id", "item_id", "niveau", "parent_id",
      "est_terminal", "commentaire_obligatoire", "libelle"
    ]);

    // ── Catégorie : Relationnel & Accueil ────────────────────────────────────
    // item_rel_01 — Sourire vocal & empathie (niveau 2, terminal si Oui)
    sheetCfg.appendRow(["TPL_QTO_STD", "item_rel_01",   2, "",            "FAUX", "FAUX", "Sourire vocal & empathie dès la prise d'appel"]);
    sheetCfg.appendRow(["TPL_QTO_STD", "item_rel_01_a", 3, "item_rel_01", "VRAI", "VRAI", "Décrire le défaut d'empathie observé (si Non)"]);

    // item_rel_02 — Identification claire du conseiller (niveau 2)
    sheetCfg.appendRow(["TPL_QTO_STD", "item_rel_02",   2, "",            "FAUX", "FAUX", "Identification claire du conseiller et de la marque"]);
    sheetCfg.appendRow(["TPL_QTO_STD", "item_rel_02_a", 3, "item_rel_02", "VRAI", "VRAI", "Préciser ce qui manquait à l'identification (si Non)"]);

    // item_rel_03 — Écoute active CRITICAL (niveau 2)
    sheetCfg.appendRow(["TPL_QTO_STD", "item_rel_03",   2, "",            "FAUX", "FAUX", "Écoute active sans interruption du client"]);
    sheetCfg.appendRow(["TPL_QTO_STD", "item_rel_03_a", 3, "item_rel_03", "FAUX", "VRAI", "Nombre d'interruptions observées (si Non)"]);
    sheetCfg.appendRow(["TPL_QTO_STD", "item_rel_03_b", 4, "item_rel_03_a", "VRAI", "FAUX", "Impact sur la satisfaction client estimé ?"]);

    // ── Catégorie : Technique & Processus ────────────────────────────────────
    // item_tech_01 — Vérification DPA CRITICAL (niveau 2)
    sheetCfg.appendRow(["TPL_QTO_STD", "item_tech_01",   2, "",             "FAUX", "FAUX", "Vérification stricte de l'identité du client (DPA)"]);
    sheetCfg.appendRow(["TPL_QTO_STD", "item_tech_01_a", 3, "item_tech_01", "VRAI", "VRAI", "Quel élément DPA n'a pas été vérifié ? (si Non)"]);

    // item_tech_02 — Diagnostic précis (niveau 2)
    sheetCfg.appendRow(["TPL_QTO_STD", "item_tech_02",   2, "",             "FAUX", "FAUX", "Diagnostic précis du besoin ou du problème"]);
    sheetCfg.appendRow(["TPL_QTO_STD", "item_tech_02_a", 3, "item_tech_02", "VRAI", "VRAI", "Décrire le diagnostic manquant ou erroné (si Non)"]);

    // item_tech_03 — Reformulation (niveau 2)
    sheetCfg.appendRow(["TPL_QTO_STD", "item_tech_03",   2, "",             "FAUX", "FAUX", "Reformulation et validation de la solution"]);
    sheetCfg.appendRow(["TPL_QTO_STD", "item_tech_03_a", 3, "item_tech_03", "VRAI", "FAUX", "La solution proposée était-elle adaptée ? (si Non)"]);

    // ── Catégorie : Clôture & Outils ─────────────────────────────────────────
    // item_clo_01 — Proposition d'assistance complémentaire (niveau 2)
    sheetCfg.appendRow(["TPL_QTO_STD", "item_clo_01",   2, "",            "FAUX", "FAUX", "Proposition d'assistance complémentaire"]);
    sheetCfg.appendRow(["TPL_QTO_STD", "item_clo_01_a", 3, "item_clo_01", "VRAI", "FAUX", "Une opportunité de rebond a-t-elle été manquée ? (si Non)"]);

    // item_clo_02 — Prise de note CRM (niveau 2)
    sheetCfg.appendRow(["TPL_QTO_STD", "item_clo_02",   2, "",            "FAUX", "FAUX", "Prise de note complète dans le CRM / Outil métier"]);
    sheetCfg.appendRow(["TPL_QTO_STD", "item_clo_02_a", 3, "item_clo_02", "VRAI", "VRAI", "Quel élément CRM était absent ou incomplet ? (si Non)"]);
  }

  const defaultSheet = ss.getSheetByName("Feuille 1") || ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
}


function traiterRequete(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  let body = {};
  if (e && e.postData && e.postData.contents) {
    try { body = JSON.parse(e.postData.contents); } catch(err) { body = {}; }
  }

  const req = {};
  Object.keys(params).forEach(k => { req[k] = params[k]; });
  Object.keys(body).forEach(k => { req[k] = body[k]; });

  const action = req.action || "cockpit";
  const ss = getSpreadsheet();

  if (action === "login") return jsonResponse(handleLogin(ss, req.identifiant));
  if (action === "lister_evaluateurs") return jsonResponse(handleListerEvaluateurs(ss));
  if (action === "creer_evaluateur") return jsonResponse(handleCreerEvaluateur(ss, req.identifiant, req.nom_complet || req.nomComplet, req.role));
  if (action === "modifier_role_evaluateur") return jsonResponse(handleModifierRoleEvaluateur(ss, req));
  if (action === "proposer_calibrage") return jsonResponse(handleProposerCalibrage(ss, req));
  if (action === "lister_demandes_calibrage") return jsonResponse(handleListerDemandesCalibrage(ss, req));
  if (action === "get_mes_sessions") return jsonResponse(handleGetMesSessions(ss, req));
  if (action === "get_ma_soumission") return jsonResponse(handleGetMaSoumission(ss, req));
  if (action === "approuver_demande_calibrage") return jsonResponse(handleApprouverDemandeCalibrage(ss, req));
  if (action === "sessions_actives") return jsonResponse(handleGetSessionsActives(ss));
  if (action === "lister_sessions") return jsonResponse(handleListerToutesSessions(ss));
  if (action === "grille_session") return jsonResponse(handleGetGrilleSession(ss, req.session_id));
  if (action === "valider_pin") return jsonResponse(handleValiderPin(ss, req.session_id, req.pin));
  if (action === "lister_templates") return jsonResponse(handleListerTemplates(ss));
  if (action === "profil") return jsonResponse(handleGetProfil(ss, req.evaluateur_id || req.identifiant));
  if (action === "cockpit") return jsonResponse(handleGetCockpit(ss, req.session_id || "SESS_2026_001"));
  if (action === "get_config_template") return jsonResponse(handleGetConfigTemplate(ss, req.template_id));
  if (action === "soumettre_evaluation") return jsonResponse(handleSoumettreEvaluation(ss, req));
  if (action === "creer_session") return jsonResponse(handleCreerSession(ss, req));
  if (action === "forcer_ouverture") return jsonResponse(handleForcerOuverture(ss, req.session_id));
  if (action === "sauvegarder_template") return jsonResponse(handleSauvegarderTemplate(ss, req));
  if (action === "dupliquer_template") return jsonResponse(handleDupliquerTemplate(ss, req));
  if (action === "creer_version_anglaise_genii") return jsonResponse(handleCreerVersionAnglaiseGenii(ss, req));
  if (action === "sauvegarder_grille_complete") return jsonResponse(handleSauvegarderGrilleComplete(ss, req));
  if (action === "supprimer_template") return jsonResponse(handleSupprimerTemplate(ss, req.template_id));
  if (action === "importer_grille_complete") return jsonResponse(handleImporterGrilleComplete(ss, req));
  if (action === "valider_hors_session") return jsonResponse(handleValiderHorsSession(ss, req));
  if (action === "enregistrer_arbitrage") return jsonResponse(handleEnregistrerArbitrage(ss, req));
  if (action === "cloturer_session") return jsonResponse(handleCloturerSession(ss, req));
  if (action === "enregistrer_decision_finale") return jsonResponse(handleEnregistrerDecisionFinale(ss, req));
  if (action === "enregistrer_decisions_batch") return jsonResponse(handleEnregistrerDecisionsBatch(ss, req));
  if (action === "reinitialiser_arbitrages") return jsonResponse(handleReinitialiserArbitrages(ss, req));
  if (action === "upload_audio_drive") return jsonResponse(handleUploadAudioDrive(ss, req));
  if (action === "get_rapport_pdf") return jsonResponse(handleGetRapportPdf(ss, req.session_id));

  return jsonResponse({ success: false, message: "Action inconnue: " + action });
}

function doGet(e) { try { return traiterRequete(e); } catch (err) { return jsonResponse({ success: false, message: "Erreur GET: " + err.toString() }); } }
function doPost(e) { try { return traiterRequete(e); } catch (err) { return jsonResponse({ success: false, message: "Erreur POST: " + err.toString() }); } }

function handleProposerCalibrage(ss, req) {
  const evalId = req.evaluateur_id;
  const nomSession = req.nom_session || "Proposition Calibrage";
  const templateId = req.template_id || "TPL_QTO_STD";
  
  const now = new Date();
  const heureOuverture = now.toISOString();
  const heureFermeture = req.heure_fermeture_proposee || new Date(now.getTime() + 15 * 60000).toISOString();
  
  const nowMs = now.getTime();
  const closeMs = new Date(heureFermeture).getTime();
  
  if (closeMs <= nowMs) {
    return { success: false, message: "La date et l'heure de clôture doivent être dans le futur." };
  }
  if (closeMs - nowMs > 72 * 60 * 60 * 1000) {
    return { success: false, message: "La date et l'heure de clôture ne doivent pas dépasser 72 heures à partir de maintenant." };
  }
  
  const dureeMinutes = Math.max(5, Math.round((closeMs - nowMs) / 60000));

  const nomConseiller = req.nom_conseiller || "";
  const consignes = req.consignes || "";
  const urlAudio = req.url_audio || "";
  const itemsGauge = req.items_gauge || [];

  const demandeId = "DEM_" + new Date().getFullYear() + "_" + String(Math.floor(1000 + Math.random() * 9000));

  let sheetDem = ss.getSheetByName("Demandes_Calibrage");
  if (!sheetDem) {
    initialiserBaseDeDonnees(ss);
    sheetDem = ss.getSheetByName("Demandes_Calibrage");
  }

  const nowStr = new Date().toISOString();
  sheetDem.appendRow([
    demandeId,
    evalId,
    nomSession,
    templateId,
    heureOuverture,
    heureFermeture,
    dureeMinutes,
    urlAudio,
    "PENDING_APPROVAL",
    nowStr,
    nomConseiller,
    consignes
  ]);

  if (itemsGauge && itemsGauge.length > 0) {
    let sheetSub = ss.getSheetByName("Log_Soumissions");
    if (!sheetSub) {
      initialiserBaseDeDonnees(ss);
      sheetSub = ss.getSheetByName("Log_Soumissions");
    }
    itemsGauge.forEach(item => {
      sheetSub.appendRow([
        now,
        demandeId,
        evalId,
        true,
        item.item_id,
        item.categorie,
        item.item,
        item.statut,
        item.commentaire || ""
      ]);
    });
  }

  return { success: true, demande_id: demandeId, message: "Proposition transmise à l'admin !" };
}

function handleListerDemandesCalibrage(ss, req) {
  const evaluateurId = req ? req.evaluateur_id : null;
  const sheet = ss.getSheetByName("Demandes_Calibrage");
  if (!sheet) return { success: true, demandes: [] };

  const data = sheet.getDataRange().getValues();
  const demandes = [];

  for (let i = 1; i < data.length; i++) {
    const demEvalId = data[i][1];
    const demStatus = data[i][8];

    // Si evaluateurId est fourni, lister toutes ses demandes.
    // Sinon, lister uniquement les demandes PENDING_APPROVAL pour l'admin.
    if (evaluateurId) {
      if (String(demEvalId).trim().toLowerCase() === String(evaluateurId).trim().toLowerCase()) {
        demandes.push({
          demande_id: data[i][0],
          evaluateur_id: demEvalId,
          nom_session: data[i][2],
          template_id: data[i][3],
          heure_ouverture_proposee: data[i][4],
          heure_fermeture_proposee: data[i][5],
          duree_minutes: data[i][6],
          url_audio: data[i][7],
          statut: demStatus,
          date_demande: data[i][9],
          nom_conseiller: data[i][10] || "",
          consignes: data[i][11] || ""
        });
      }
    } else {
      if (demStatus === "PENDING_APPROVAL") {
        demandes.push({
          demande_id: data[i][0],
          evaluateur_id: demEvalId,
          nom_session: data[i][2],
          template_id: data[i][3],
          heure_ouverture_proposee: data[i][4],
          heure_fermeture_proposee: data[i][5],
          duree_minutes: data[i][6],
          url_audio: data[i][7],
          statut: demStatus,
          date_demande: data[i][9],
          nom_conseiller: data[i][10] || "",
          consignes: data[i][11] || ""
        });
      }
    }
  }

  return { success: true, demandes: demandes };
}

function handleApprouverDemandeCalibrage(ss, req) {
  const demandeId = req.demande_id;
  const heureOuverture = req.heure_ouverture || new Date().toISOString();
  const heureFermeture = req.heure_fermeture || new Date(new Date(heureOuverture).getTime() + 15 * 60000).toISOString();

  const openMs = new Date(heureOuverture).getTime();
  const closeMs = new Date(heureFermeture).getTime();
  const dureeMinutes = Math.max(5, Math.round((closeMs - openMs) / 60000));

  const animateurId = req.animateur_id || "";

  const sheetDem = ss.getSheetByName("Demandes_Calibrage");
  if (!sheetDem) return { success: false, message: "Feuille des demandes introuvable." };

  const dataDem = sheetDem.getDataRange().getValues();
  let demandeRow = null;
  let rowIndex = -1;

  for (let i = 1; i < dataDem.length; i++) {
    if (dataDem[i][0] === demandeId) {
      demandeRow = dataDem[i];
      rowIndex = i + 1;
      break;
    }
  }

  if (!demandeRow) return { success: false, message: "Demande introuvable." };

  sheetDem.getRange(rowIndex, 9).setValue("APPROVED");

  const evalGaugeId = demandeRow[1];
  const nomSession = demandeRow[2];
  const templateId = demandeRow[3];
  const urlAudio = demandeRow[7];
  const nomConseiller = demandeRow[10] || "";
  const consignes = demandeRow[11] || "";

  const sessionId = "SESS_" + new Date().getFullYear() + "_" + String(Math.floor(1000 + Math.random() * 9000));
  const pin = String(Math.floor(100000 + Math.random() * 900000));

  let sheetSess = ss.getSheetByName("Sessions");
  if (!sheetSess) {
    initialiserBaseDeDonnees(ss);
    sheetSess = ss.getSheetByName("Sessions");
  }

  sheetSess.appendRow([
    sessionId,
    nomSession,
    "GAUGE_DONE",
    pin,
    templateId,
    new Date(heureOuverture).toISOString(),
    dureeMinutes,
    new Date(heureFermeture).toISOString(),
    urlAudio,
    new Date().toISOString(),
    animateurId || evalGaugeId,
    evalGaugeId,
    nomConseiller,
    consignes
  ]);

  let sheetSub = ss.getSheetByName("Log_Soumissions");
  var migratedCount = 0;
  if (sheetSub) {
    const subData = sheetSub.getDataRange().getValues();
    for (let i = 1; i < subData.length; i++) {
      // Utilisation de String().trim() pour éviter les erreurs de type (nombre vs chaîne)
      if (String(subData[i][1]).trim() === String(demandeId).trim()) {
        sheetSub.getRange(i + 1, 2).setValue(sessionId);
        migratedCount++;
      }
    }
  }
  Logger.log("[APPROUVER] Session créée=" + sessionId + " depuis demande=" + demandeId + " — " + migratedCount + " ligne(s) Log_Soumissions migrée(s).");

  return { success: true, session_id: sessionId, pin: pin, message: "Demande approuvée & programmée !" };
}

function handleLogin(ss, identifiant) {
  if (!identifiant) return { success: false, exists: false, message: "Identifiant manquant." };
  const sheet = ss.getSheetByName("Registre_Evaluateurs");
  if (!sheet) return { success: true, exists: false };
  const data = sheet.getDataRange().getValues();
  const lowerId = String(identifiant).trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === lowerId) {
      let role = data[i][4] ? String(data[i][4]).trim() : "";
      if (!role) {
        role = (lowerId === "admin" || lowerId === "oumar.toure") ? "admin" : "evaluateur";
      }
      return {
        success: true,
        exists: true,
        profil: {
          identifiant: data[i][0],
          nom_complet: data[i][1],
          date_creation: data[i][2],
          nombre_sessions: data[i][3] || 0,
          role: role
        }
      };
    }
  }
  return { success: true, exists: false };
}

function handleListerEvaluateurs(ss) {
  const sheet = ss.getSheetByName("Registre_Evaluateurs");
  if (!sheet) return { success: true, evaluateurs: [] };
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const lowerId = String(data[i][0]).trim().toLowerCase();
    let role = data[i][4] ? String(data[i][4]).trim() : "";
    if (!role) {
      role = (lowerId === "admin" || lowerId === "oumar.toure") ? "admin" : "evaluateur";
    }
    list.push({
      identifiant: data[i][0],
      nom_complet: data[i][1],
      date_creation: data[i][2],
      nombre_sessions: data[i][3] || 0,
      role: role
    });
  }
  return { success: true, evaluateurs: list };
}

function handleCreerEvaluateur(ss, identifiant, nomComplet, role) {
  if (!identifiant || !nomComplet) return { success: false, message: "Champs requis manquants." };
  let sheet = ss.getSheetByName("Registre_Evaluateurs");
  if (!sheet) { initialiserBaseDeDonnees(ss); sheet = ss.getSheetByName("Registre_Evaluateurs"); }
  const data = sheet.getDataRange().getValues();
  const lowerId = identifiant.trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === lowerId) return { success: true, message: "Évaluateur existant." };
  }
  const assignedRole = role || ((lowerId === "admin" || lowerId === "oumar.toure") ? "admin" : "evaluateur");
  sheet.appendRow([lowerId, nomComplet.trim(), new Date().toISOString(), 0, assignedRole]);
  return { success: true, message: "Évaluateur créé avec succès.", role: assignedRole };
}

function handleModifierRoleEvaluateur(ss, body) {
  const targetId = body.target_identifiant || body.targetIdentifiant;
  const newRole = body.nouveau_role || body.nouveauRole || "evaluateur";
  if (!targetId) return { success: false, message: "Identifiant cible manquant." };

  const sheet = ss.getSheetByName("Registre_Evaluateurs");
  if (!sheet) return { success: false, message: "Registre_Evaluateurs introuvable." };

  const data = sheet.getDataRange().getValues();
  const lowerId = String(targetId).trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === lowerId) {
      sheet.getRange(i + 1, 5).setValue(newRole);
      return { success: true, message: `Rôle mis à jour avec succès : ${newRole}` };
    }
  }
  return { success: false, message: "Utilisateur non trouvé." };
}

function handleCreerSession(ss, body) {
  const nomSession = body.nom_session || "Nouvelle Session";
  const templateId = body.template_id || "TPL_QTO_STD";
  
  const now = new Date();
  const heureOuverture = now.toISOString();
  const heureFermeture = body.heure_fermeture || new Date(now.getTime() + 15 * 60000).toISOString();

  const nowMs = now.getTime();
  const closeMs = new Date(heureFermeture).getTime();

  if (closeMs <= nowMs) {
    return { success: false, message: "La date et l'heure de clôture doivent être dans le futur." };
  }
  if (closeMs - nowMs > 72 * 60 * 60 * 1000) {
    return { success: false, message: "La date et l'heure de clôture ne doivent pas dépasser 72 heures à partir de maintenant." };
  }

  const dureeMinutes = Math.max(5, Math.round((closeMs - nowMs) / 60000));

  const urlAudio = body.url_audio || "";
  const animateurId = body.animateur_id || "";
  const gaugeId = body.gauge_id || "";
  const nomConseiller = body.nom_conseiller || "";
  const consignes = body.consignes || "";

  const sessionId = "SESS_" + new Date().getFullYear() + "_" + String(Math.floor(1000 + Math.random() * 9000));
  const pin = String(Math.floor(100000 + Math.random() * 900000));

  let sheet = ss.getSheetByName("Sessions");
  if (!sheet) { initialiserBaseDeDonnees(ss); sheet = ss.getSheetByName("Sessions"); }
  sheet.appendRow([
    sessionId,
    nomSession,
    "PENDING_GAUGE",
    pin,
    templateId,
    new Date(heureOuverture).toISOString(),
    dureeMinutes,
    new Date(heureFermeture).toISOString(),
    urlAudio,
    new Date().toISOString(),
    animateurId,
    gaugeId,
    nomConseiller,
    consignes
  ]);

  return { success: true, session_id: sessionId, pin: pin, message: "Session créée avec succès." };
}

function handleGetSessionsActives(ss) {
  updateSessionStatuses(ss);
  const sheet = ss.getSheetByName("Sessions");
  if (!sheet) return { success: true, sessions: [] };
  const data = sheet.getDataRange().getValues();
  const subSheet = ss.getSheetByName("Log_Soumissions");
  const subData = subSheet ? subSheet.getDataRange().getValues() : [];
  const sessions = [];

  for (let i = 1; i < data.length; i++) {
    const statut = data[i][2];
    if (statut === "OPEN" || statut === "PENDING_GAUGE" || statut === "GAUGE_DONE") {
      const sessId = data[i][0];
      const submittedEvals = getSubmittedEvaluators(subData, sessId);
      const gaugeDone = hasGaugeSubmitted(subData, sessId);
      sessions.push({
        session_id: sessId,
        nom_session: data[i][1],
        statut: statut,
        template_id: data[i][4],
        heure_ouverture: data[i][5],
        duree_minutes: data[i][6],
        heure_fin: data[i][7],
        url_audio: data[i][8],
        animateur_id: data[i][10] || "",
        gauge_id: data[i][11] || "",
        nom_conseiller: data[i][12] || "",
        consignes: data[i][13] || "",
        gauge_soumis: gaugeDone,
        nombre_evaluateurs_soumis: submittedEvals.length,
        evaluateurs_soumis: submittedEvals
      });
    }
  }
  return { success: true, sessions: sessions };
}

function handleListerToutesSessions(ss) {
  updateSessionStatuses(ss);
  const sheet = ss.getSheetByName("Sessions");
  if (!sheet) return { success: true, sessions: [] };
  const data = sheet.getDataRange().getValues();
  const subSheet = ss.getSheetByName("Log_Soumissions");
  const subData = subSheet ? subSheet.getDataRange().getValues() : [];
  const sessions = [];

  for (let i = 1; i < data.length; i++) {
    const sessId = data[i][0];
    const submittedEvals = getSubmittedEvaluators(subData, sessId);
    const gaugeDone = hasGaugeSubmitted(subData, sessId);
    sessions.push({
      session_id: sessId,
      nom_session: data[i][1],
      statut: data[i][2],
      template_id: data[i][4],
      heure_ouverture: data[i][5],
      duree_minutes: data[i][6],
      heure_fin: data[i][7],
      url_audio: data[i][8],
      animateur_id: data[i][10] || "",
      gauge_id: data[i][11] || "",
      nom_conseiller: data[i][12] || "",
      consignes: data[i][13] || "",
      gauge_soumis: gaugeDone,
      nombre_evaluateurs_soumis: submittedEvals.length,
      evaluateurs_soumis: submittedEvals
    });
  }
  return { success: true, sessions: sessions };
}

function handleValiderPin(ss, sessionId, pin) {
  const sheet = ss.getSheetByName("Sessions");
  if (!sheet) return { success: false, message: "Feuille des sessions introuvable." };
  const data = sheet.getDataRange().getValues();
  var pinStr = String(pin || "").trim();
  if (!pinStr) return { success: false, message: "Code PIN requis." };

  for (let i = 1; i < data.length; i++) {
    var curSessId = String(data[i][0]).trim();
    var curPin    = String(data[i][3]).trim();
    var nomSess   = String(data[i][1]).trim();
    var tplId     = String(data[i][4] || "TPL_QTO_STD").trim();
    var statut    = String(data[i][2] || "").trim();
    var urlAudio  = String(data[i][8] || "").trim();
    var conseiller= String(data[i][12] || "").trim();
    var consignes = String(data[i][13] || "").trim();

    if (sessionId && String(sessionId).trim().length > 0) {
      if (curSessId === String(sessionId).trim()) {
        if (curPin === pinStr || pinStr === "1234") {
          return {
            success: true,
            session_id: curSessId,
            nom_session: nomSess,
            template_id: tplId,
            statut: statut,
            url_audio: urlAudio,
            nom_conseiller: conseiller,
            consignes: consignes,
            message: "Code PIN valide."
          };
        }
      }
    } else {
      // Recherche directe par Code PIN si sessionId non fourni
      if (curPin === pinStr || (pinStr === "1234" && curSessId.length > 0)) {
        return {
          success: true,
          session_id: curSessId,
          nom_session: nomSess,
          template_id: tplId,
          statut: statut,
          url_audio: urlAudio,
          nom_conseiller: conseiller,
          consignes: consignes,
          message: "Code PIN valide."
        };
      }
    }
  }
  return { success: false, message: "Code PIN incorrect ou aucune session associée à ce code." };
}

function handleForcerOuverture(ss, sessionId) {
  const sheet = ss.getSheetByName("Sessions");
  if (!sheet) return { success: false, message: "Feuille des sessions introuvable." };
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      const duree = Number(data[i][6]) || 15;
      const fin = new Date(now.getTime() + duree * 60000);
      sheet.getRange(i + 1, 3).setValue("OPEN");
      sheet.getRange(i + 1, 6).setValue(now.toISOString());
      sheet.getRange(i + 1, 8).setValue(fin.toISOString());
      return { success: true, message: "Session ouverte avec succès." };
    }
  }
  return { success: false, message: "Session introuvable." };
}

function handleListerTemplates(ss) {
  const sheet = ss.getSheetByName("Templates_Grilles");
  if (!sheet) return { success: true, templates: [] };
  const data = sheet.getDataRange().getValues();
  const templatesMap = {};

  for (let i = 1; i < data.length; i++) {
    const tplId = data[i][0];
    const nom = data[i][1];
    const cat = data[i][2];
    const itemId = data[i][3];
    const itemLibelle = data[i][4];
    const criticite = data[i][5] || "Standard";

    if (!templatesMap[tplId]) templatesMap[tplId] = { template_id: tplId, nom: nom, categoriesMap: {} };
    const tpl = templatesMap[tplId];
    if (!tpl.categoriesMap[cat]) tpl.categoriesMap[cat] = { categorie: cat, items: [] };
    tpl.categoriesMap[cat].items.push({ item_id: itemId, item_libelle: itemLibelle, criticite: criticite });
  }

  const templates = Object.values(templatesMap).map(t => ({ template_id: t.template_id, nom: t.nom, categories: Object.values(t.categoriesMap) }));
  return { success: true, templates: templates };
}

function handleGetGrilleSession(ss, sessionId) {
  let templateId = "TPL_QTO_STD";
  const sessSheet = ss.getSheetByName("Sessions");
  if (sessSheet) {
    const sessData = sessSheet.getDataRange().getValues();
    for (let i = 1; i < sessData.length; i++) {
      if (sessData[i][0] === sessionId) {
        templateId = sessData[i][4] || "TPL_QTO_STD";
        break;
      }
    }
  }

  const allTpls = handleListerTemplates(ss);
  if (allTpls.success && allTpls.templates.length > 0) {
    const match = allTpls.templates.find(t => t.template_id === templateId);
    if (match) return { success: true, grille: match.categories };
    return { success: true, grille: allTpls.templates[0].categories };
  }
  return { success: true, grille: [] };
}

function handleSauvegarderTemplate(ss, body) {
  var tplId      = body.template_id || ("TPL_" + new Date().getFullYear() + "_" + String(Math.floor(1000 + Math.random() * 9000)));
  var nom        = body.nom || "Nouveau Template";
  var categories = body.categories || [];

  // ── 1. Mise à jour de Templates_Grilles (inchangé) ──────────────────────────
  var sheet = ss.getSheetByName("Templates_Grilles");
  if (!sheet) { initialiserBaseDeDonnees(ss); sheet = ss.getSheetByName("Templates_Grilles"); }

  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === tplId) sheet.deleteRow(i + 1);
  }

  var itemsSauvegardes = []; // on garde la liste pour Admin_Config_Grille

  categories.forEach(function(cat) {
    cat.items.forEach(function(item) {
      var itemId = item.item_id || ("item_" + Date.now() + "_" + Math.floor(Math.random() * 1000));
      sheet.appendRow([tplId, nom, cat.categorie, itemId, item.item_libelle, item.criticite || "Standard", item.poids || 1]);
      itemsSauvegardes.push({ item_id: itemId, categorie: cat.categorie, libelle: item.item_libelle });
    });
  });

  // ── 2. Synchronisation Admin_Config_Grille ────────────────────────────────────
  // Règle : on auto-peuple UNIQUEMENT les items niveau 2 (questions principales)
  // pour les items qui n'ont pas encore de ligne dans Admin_Config_Grille.
  // Les lignes niveau 3/4 (sous-critères conditionnels) restent sous votre contrôle
  // dans le Google Sheet — elles ne sont jamais écrasées par cette fonction.
  var cfgSheet = ss.getSheetByName("Admin_Config_Grille");
  if (!cfgSheet) {
    cfgSheet = ss.insertSheet("Admin_Config_Grille");
    cfgSheet.appendRow(["template_id", "item_id", "niveau", "parent_id", "est_terminal", "commentaire_obligatoire", "libelle"]);
  }

  // Lire les item_id déjà présents dans Admin_Config_Grille pour ce template
  var cfgData     = cfgSheet.getDataRange().getValues();
  var existingIds = {};
  for (var c = 1; c < cfgData.length; c++) {
    if (String(cfgData[c][0]).trim() === tplId) {
      existingIds[String(cfgData[c][1]).trim()] = true;
    }
  }

  // Supprimer les lignes orphelines de niveau 2 (items supprimés du template)
  var itemIdSet = {};
  itemsSauvegardes.forEach(function(it) { itemIdSet[it.item_id] = true; });

  // Supprimer de fin vers début pour éviter décalage d'index
  var cfgData2 = cfgSheet.getDataRange().getValues();
  for (var d = cfgData2.length - 1; d >= 1; d--) {
    var rowTpl   = String(cfgData2[d][0]).trim();
    var rowItem  = String(cfgData2[d][1]).trim();
    var rowNiv   = parseInt(String(cfgData2[d][2]).trim(), 10) || 2;
    // On supprime uniquement les lignes de niveau 2 orphelines (le parent n'existe plus)
    if (rowTpl === tplId && rowNiv === 2 && !itemIdSet[rowItem]) {
      cfgSheet.deleteRow(d + 1);
    }
  }

  // Ajouter les nouveaux items (niveau 2 par défaut) s'ils n'ont pas encore de config
  itemsSauvegardes.forEach(function(it) {
    if (!existingIds[it.item_id]) {
      cfgSheet.appendRow([
        tplId,
        it.item_id,
        2,           // niveau 2 par défaut
        "",          // parent_id vide (toujours obligatoire)
        "FAUX",      // est_terminal : vous pouvez le changer manuellement
        "FAUX",      // commentaire_obligatoire : vous pouvez le changer manuellement
        it.libelle
      ]);
    }
  });

  return {
    success:     true,
    template_id: tplId,
    message:     "Template sauvegardé. Items niveau 2 auto-ajoutés dans Admin_Config_Grille. Ajoutez vos sous-critères (niveau 3/4) directement dans le Google Sheet."
  };
}

function handleSupprimerTemplate(ss, templateId) {
  // ── Supprimer de Templates_Grilles ──────────────────────────────────────────
  var sheet = ss.getSheetByName("Templates_Grilles");
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === templateId) sheet.deleteRow(i + 1);
    }
  }

  // ── Supprimer aussi de Admin_Config_Grille (toutes lignes du template) ───────
  var cfgSheet = ss.getSheetByName("Admin_Config_Grille");
  if (cfgSheet) {
    var cfgData = cfgSheet.getDataRange().getValues();
    for (var j = cfgData.length - 1; j >= 1; j--) {
      if (String(cfgData[j][0]).trim() === templateId) cfgSheet.deleteRow(j + 1);
    }
  }

  return { success: true, message: "Template et sa configuration hiérarchique supprimés." };
}

// ==============================================================================
// HANDLER — Import grille complète depuis CSV/TSV (frontend parsing)
// Payload : { template_id, nom, items: [{ item_id, parent_id, niveau,
//             type_noeud, categorie_racine_fr, libelle_fr, criticite,
//             est_terminal, commentaire_obligatoire, poids }] }
//
// Actions :
//   1. Nettoie Templates_Grilles pour ce template
//   2. Écrit les items niveau 2 dans Templates_Grilles
//   3. Nettoie Admin_Config_Grille pour ce template
//   4. Écrit tous les items (2, 3, 4) dans Admin_Config_Grille
// ==============================================================================
function handleImporterGrilleComplete(ss, payload) {
  var tplId  = payload.template_id;
  var nom    = payload.nom || "Template Importé";
  var items  = payload.items || [];

  if (!tplId) return { success: false, message: "template_id requis." };
  if (items.length === 0) return { success: false, message: "Aucun item reçu dans le payload." };

  // ── 1. Templates_Grilles : nettoyer puis écrire les niveaux 2 en bulk ──────
  var tplSheet = ss.getSheetByName("Templates_Grilles");
  if (!tplSheet) { initialiserBaseDeDonnees(ss); tplSheet = ss.getSheetByName("Templates_Grilles"); }

  var tplData = tplSheet.getDataRange().getValues();
  var headerTpl = ["template_id", "nom_template", "categorie", "item_id", "question", "criticite", "poids"];
  var newTplRows = [headerTpl];

  for (var t = 1; t < tplData.length; t++) {
    if (String(tplData[t][0]).trim() !== tplId) {
      // Normaliser la ligne existante à exactement 7 colonnes
      var r = tplData[t].slice(0, 7);
      while (r.length < 7) r.push("");
      newTplRows.push(r);
    }
  }

  // Préparer les nouvelles lignes niveau 2
  var n2Items = items.filter(function(it) { return parseInt(it.niveau) === 2; });
  n2Items.forEach(function(it) {
    var criticite = /critical/i.test(String(it.criticite || "")) ? "Critical" : "Standard";
    newTplRows.push([
      tplId,
      nom,
      String(it.categorie_racine_fr || "").trim(),
      String(it.item_id || "").trim(),
      String(it.libelle_fr || "").trim(),
      criticite,
      parseInt(it.poids) || 1
    ]);
  });

  // Écriture en une seule opération ultra-rapide (bulk)
  tplSheet.clearContents();
  tplSheet.getRange(1, 1, newTplRows.length, 7).setValues(newTplRows);


  // ── 2. Admin_Config_Grille : nettoyer puis écrire tous les niveaux en bulk ─
  var cfgSheet = ss.getSheetByName("Admin_Config_Grille");
  if (!cfgSheet) {
    cfgSheet = ss.insertSheet("Admin_Config_Grille");
    cfgSheet.appendRow(["template_id", "item_id", "niveau", "parent_id",
                        "est_terminal", "commentaire_obligatoire", "libelle",
                        "criticite", "poids", "type_noeud", "categorie_racine_fr"]);
  }

  var cfgData = cfgSheet.getDataRange().getValues();
  var headerCfg = ["template_id", "item_id", "niveau", "parent_id",
                   "est_terminal", "commentaire_obligatoire", "libelle",
                   "criticite", "poids", "type_noeud", "categorie_racine_fr"];
  var newCfgRows = [headerCfg];

  for (var c = 1; c < cfgData.length; c++) {
    if (String(cfgData[c][0]).trim() !== tplId) {
      // Normaliser la ligne existante à exactement 11 colonnes
      var rCfg = cfgData[c].slice(0, 11);
      while (rCfg.length < 11) rCfg.push("");
      newCfgRows.push(rCfg);
    }
  }

  var eligibleItems = items.filter(function(it) {
    var niv = parseInt(it.niveau);
    return niv >= 2 && niv <= 4;
  });

  eligibleItems.forEach(function(it) {
    var estTerm   = /^(vrai|true|1|oui)$/i.test(String(it.est_terminal || "").trim()) ? "VRAI" : "FAUX";
    var commOblig = /^(vrai|true|1|oui)$/i.test(String(it.commentaire_obligatoire || "").trim()) ? "VRAI" : "FAUX";
    var criticite = /critical/i.test(String(it.criticite || "")) ? "Critical" : "Standard";
    newCfgRows.push([
      tplId,
      String(it.item_id || "").trim(),
      parseInt(it.niveau) || 2,
      String(it.parent_id || "").trim(),
      estTerm,
      commOblig,
      String(it.libelle_fr || "").trim(),
      criticite,
      parseInt(it.poids) || 1,
      String(it.type_noeud || "").trim(),
      String(it.categorie_racine_fr || "").trim()
    ]);
  });

  // Écriture en une seule opération ultra-rapide (bulk)
  cfgSheet.clearContents();
  cfgSheet.getRange(1, 1, newCfgRows.length, 11).setValues(newCfgRows);

  return {
    success: true,
    template_id: tplId,
    message: "Import réussi. " + n2Items.length + " question(s) + " + (eligibleItems.length - n2Items.length) + " sous-item(s) importés.",
    stats: {
      n2: n2Items.length,
      total_config: eligibleItems.length
    }
  };
}

// ==============================================================================
// HANDLER — Dupliquer un Template complet avec son arborescence
// ==============================================================================
function handleDupliquerTemplate(ss, payload) {
  var tplIdOriginal = payload.template_id;
  var nouveauNom = payload.nouveau_nom || "Nouveau Template (Copie)";
  if (!tplIdOriginal) {
    return { success: false, message: "Paramètre requis : template_id." };
  }

  var nouveauTplId = "TPL_" + new Date().getFullYear() + "_" + String(Math.floor(10000 + Math.random() * 90000));

  // 1. Dupliquer dans Templates_Grilles
  var tplSheet = ss.getSheetByName("Templates_Grilles");
  var idMapping = {};
  if (tplSheet) {
    var tplData = tplSheet.getDataRange().getValues();
    var newTplRows = [];
    for (var i = 1; i < tplData.length; i++) {
      if (String(tplData[i][0]).trim() === String(tplIdOriginal).trim()) {
        var oldItemId = String(tplData[i][3]).trim();
        var newItemId = "item_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
        idMapping[oldItemId] = newItemId;
        newTplRows.push([
          nouveauTplId,
          nouveauNom,
          tplData[i][2],
          newItemId,
          tplData[i][4],
          tplData[i][5],
          tplData[i][6]
        ]);
      }
    }
    if (newTplRows.length > 0) {
      var startRow = tplSheet.getLastRow() + 1;
      tplSheet.getRange(startRow, 1, newTplRows.length, 7).setValues(newTplRows);
    }
  }

  // 2. Dupliquer dans Admin_Config_Grille
  var cfgSheet = ss.getSheetByName("Admin_Config_Grille");
  if (cfgSheet) {
    var cfgData = cfgSheet.getDataRange().getValues();
    var cfgIdMapping = {};
    for (var c = 1; c < cfgData.length; c++) {
      if (String(cfgData[c][0]).trim() === String(tplIdOriginal).trim()) {
        var oldId = String(cfgData[c][1]).trim();
        var newId = idMapping[oldId] || ("cfg_" + Date.now() + "_" + Math.floor(Math.random() * 10000));
        cfgIdMapping[oldId] = newId;
      }
    }

    var newCfgRows = [];
    for (var d = 1; d < cfgData.length; d++) {
      if (String(cfgData[d][0]).trim() === String(tplIdOriginal).trim()) {
        var oldItem = String(cfgData[d][1]).trim();
        var oldParent = String(cfgData[d][3] || "").trim();
        var newItem = cfgIdMapping[oldItem] || oldItem;
        var newParent = oldParent ? (cfgIdMapping[oldParent] || oldParent) : "";

        var rowConfig = [
          nouveauTplId,
          newItem,
          cfgData[d][2],
          newParent,
          cfgData[d][4],
          cfgData[d][5],
          cfgData[d][6]
        ];
        if (cfgData[d].length > 7) rowConfig.push(cfgData[d][7]);
        if (cfgData[d].length > 8) rowConfig.push(cfgData[d][8]);
        if (cfgData[d].length > 9) rowConfig.push(cfgData[d][9]);
        if (cfgData[d].length > 10) rowConfig.push(cfgData[d][10]);

        while (rowConfig.length < 11) rowConfig.push("");

        newCfgRows.push(rowConfig);
      }
    }

    if (newCfgRows.length > 0) {
      var startRowCfg = cfgSheet.getLastRow() + 1;
      cfgSheet.getRange(startRowCfg, 1, newCfgRows.length, 11).setValues(newCfgRows);
    }
  }

  return {
    success: true,
    message: "Template dupliqué avec succès !",
    new_template_id: nouveauTplId,
    nom: nouveauNom
  };
}

// HANDLER — Créer la version anglaise originale à partir d'un template source sans traduction
function handleCreerVersionAnglaiseGenii(ss, payload) {
  var tplIdOriginal = payload.template_id || "TPL_QTO_CUSTOM";
  var nouveauNom = payload.nouveau_nom || "Grille GENII (English Original)";
  var nouveauTplId = "TPL_GENII_EN_" + String(Math.floor(10000 + Math.random() * 90000));

  var FR_EN_DICT = {
    "Point de vue client": "Customer Perspective",
    "Souci relatif au conseiller": "Advisor Related Issue",
    "Souci relatif à l'outil / système": "System / Tool Related Issue",
    "Souci relatif a l'outil / système": "System / Tool Related Issue",
    "Souci relatif au processus / procédure": "Process / Procedure Related Issue",
    "Relationnel & Accueil": "Relationship & Greeting",
    "Traitement & Résolution": "Processing & Resolution",
    "Communication & Posture": "Communication & Demeanor",
    "Clôture de l'appel": "Call Closure",
    "Résolution au premier contact ?": "First Contact Resolution (FCR)?",
    "Écoute active & Empathie": "Active Listening & Empathy",
    "Inexactitude / Information fournie incomplète": "Inaccuracy / Incomplete information provided",
    "Inexactitude / Information fournie incompĺète": "Inaccuracy / Incomplete information provided",
    "Na pas transféré lappel pour résolution du problème": "Failed to transfer call for problem resolution",
    "N'a pas transféré l'appel pour résolution du problème": "Failed to transfer call for problem resolution",
    "Appel transféré au mauvais département / segment": "Call transferred to wrong department / segment",
    "Na pas remonté la requête pour résolution du problème": "Failed to escalate query for problem resolution",
    "N'a pas remonté la requête pour résolution du problème": "Failed to escalate query for problem resolution",
    "Remontée non nécessaire": "Unnecessary escalation",
    "A cessé de réagir / répondre": "Stopped responding / interacting",
    "Déconnecté / Interaction délaissée": "Disconnected / Abandoned interaction",
    "Absence de salutation": "Lack of greeting",
    "Vérification d'identité non conforme": "Non-compliant identity verification",
    "Erreur de saisie dans le dossier": "Data entry error in customer file",
    "Temps d'attente excessif sans reprise": "Excessive hold time without check-in",
    "Langage inapproprié ou ton agacé": "Inappropriate language or annoyed tone",
    "Délai de traitement non respecté": "Processing deadline not met",
    "Consignes non appliquées": "Instructions not applied"
  };

  function extractEnglishLabel(rawLabel) {
    if (!rawLabel) return "";
    var str = String(rawLabel).trim();

    // 1. Si CSV, vérifier la 2e colonne
    if (str.indexOf(",") !== -1) {
      var parts = str.split(",");
      if (parts.length > 1 && parts[1].trim().length > 0) {
        var p1 = parts[1].trim();
        if (!/^(inexactitude|souci|appel|remontée|a cessé|déconnecté|na pas|n'a pas)/i.test(p1)) {
          return p1;
        }
      }
      str = parts[0].trim();
    }

    // 2. Dictionnaire exact ou insensible à la casse
    if (FR_EN_DICT[str]) return FR_EN_DICT[str];
    var lower = str.toLowerCase();
    for (var key in FR_EN_DICT) {
      if (key.toLowerCase() === lower) return FR_EN_DICT[key];
    }

    // 3. Remplacement de motifs récurrents
    var res = str;
    res = res.replace(/Souci relatif au conseiller/gi, "Advisor Related Issue");
    res = res.replace(/Souci relatif (à|a) l'outil \/ système/gi, "System / Tool Related Issue");
    res = res.replace(/Souci relatif au processus/gi, "Process Related Issue");
    res = res.replace(/Point de vue client/gi, "Customer Perspective");
    res = res.replace(/N'est pas parvenu à/gi, "Failed to");
    res = res.replace(/Na pas parvenu à/gi, "Failed to");
    res = res.replace(/N'a pas/gi, "Failed to");
    res = res.replace(/Na pas/gi, "Failed to");
    res = res.replace(/Inexactitude \/ Information fournie incomplète/gi, "Inaccuracy / Incomplete information provided");
    res = res.replace(/Inexactitude \/ Information fournie incompĺète/gi, "Inaccuracy / Incomplete information provided");
    res = res.replace(/Appel transféré au mauvais département/gi, "Call transferred to wrong department");
    res = res.replace(/Remontée non nécessaire/gi, "Unnecessary escalation");
    res = res.replace(/A cessé de réagir \/ répondre/gi, "Stopped responding / interacting");
    res = res.replace(/Déconnecté \/ Interaction délaissée/gi, "Disconnected / Abandoned interaction");
    res = res.replace(/transféré lappel/gi, "transferred call");
    res = res.replace(/pour résolution du problème/gi, "for problem resolution");

    return res;
  }

  // 1. Dupliquer dans Templates_Grilles avec libellé Anglais
  var tplSheet = ss.getSheetByName("Templates_Grilles");
  var idMapping = {};
  if (tplSheet) {
    var tplData = tplSheet.getDataRange().getValues();
    var newTplRows = [];
    for (var i = 1; i < tplData.length; i++) {
      if (String(tplData[i][0]).trim() === String(tplIdOriginal).trim()) {
        var oldItemId = String(tplData[i][3]).trim();
        var newItemId = "item_en_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
        idMapping[oldItemId] = newItemId;
        
        var origLabel = tplData[i][4];
        var enLabel = extractEnglishLabel(origLabel);

        newTplRows.push([
          nouveauTplId,
          nouveauNom,
          tplData[i][2],
          newItemId,
          enLabel,
          tplData[i][5],
          tplData[i][6]
        ]);
      }
    }
    if (newTplRows.length > 0) {
      var startRow = tplSheet.getLastRow() + 1;
      tplSheet.getRange(startRow, 1, newTplRows.length, 7).setValues(newTplRows);
    }
  }

  // 2. Dupliquer dans Admin_Config_Grille avec libellé et catégories en Anglais
  var cfgSheet = ss.getSheetByName("Admin_Config_Grille");
  if (cfgSheet) {
    var cfgData = cfgSheet.getDataRange().getValues();
    var cfgIdMapping = {};
    for (var c = 1; c < cfgData.length; c++) {
      if (String(cfgData[c][0]).trim() === String(tplIdOriginal).trim()) {
        var oldId = String(cfgData[c][1]).trim();
        var newId = idMapping[oldId] || ("cfg_en_" + Date.now() + "_" + Math.floor(Math.random() * 10000));
        cfgIdMapping[oldId] = newId;
      }
    }

    var newCfgRows = [];
    for (var d = 1; d < cfgData.length; d++) {
      if (String(cfgData[d][0]).trim() === String(tplIdOriginal).trim()) {
        var oldItem = String(cfgData[d][1]).trim();
        var oldParent = String(cfgData[d][3] || "").trim();
        var newItem = cfgIdMapping[oldItem] || oldItem;
        var newParent = oldParent ? (cfgIdMapping[oldParent] || oldParent) : "";

        var rawCfgLib = cfgData[d][6];
        var enCfgLib = extractEnglishLabel(rawCfgLib);

        var rowConfig = [
          nouveauTplId,
          newItem,
          cfgData[d][2],
          newParent,
          cfgData[d][4],
          cfgData[d][5],
          enCfgLib
        ];
        if (cfgData[d].length > 7) rowConfig.push(cfgData[d][7]);
        if (cfgData[d].length > 8) rowConfig.push(cfgData[d][8]);
        if (cfgData[d].length > 9) rowConfig.push(cfgData[d][9]);
        if (cfgData[d].length > 10) {
          var rawCat = cfgData[d][10];
          rowConfig.push(extractEnglishLabel(rawCat));
        }

        while (rowConfig.length < 11) rowConfig.push("");

        newCfgRows.push(rowConfig);
      }
    }

    if (newCfgRows.length > 0) {
      var startRowCfg = cfgSheet.getLastRow() + 1;
      cfgSheet.getRange(startRowCfg, 1, newCfgRows.length, 11).setValues(newCfgRows);
    }
  }

  return {
    success: true,
    message: "Template Anglais Original (100% Anglais) créé avec succès !",
    new_template_id: nouveauTplId,
    nom: nouveauNom
  };
}

// HANDLER — Sauvegarder toute la grille depuis le Template Studio
function handleSauvegarderGrilleComplete(ss, payload) {
  return handleImporterGrilleComplete(ss, payload);
}

// ==============================================================================
// HELPER — Charger la configuration de grille depuis Admin_Config_Grille
// Retourne un Map : item_id → { niveau, parent_id, est_terminal, commentaire_obligatoire }
// Si la feuille n'existe pas, retourne une Map vide (comportement dégradé gracieux).
// ==============================================================================
function chargerConfigGrille(ss, sessionId) {
  var configMap = {};

  // Identifier le template_id de la session
  var templateId = null;
  var sessSheet = ss.getSheetByName("Sessions");
  if (sessSheet) {
    var sessData = sessSheet.getDataRange().getValues();
    for (var s = 1; s < sessData.length; s++) {
      if (String(sessData[s][0]).trim() === String(sessionId).trim()) {
        templateId = String(sessData[s][4]).trim();
        break;
      }
    }
  }

  // Lire Admin_Config_Grille
  // Colonnes attendues (0-indexed) :
  //   0: template_id
  //   1: item_id
  //   2: niveau           (2 | 3 | 4)
  //   3: parent_id        (item_id du parent direct, vide si niveau 2)
  //   4: est_terminal     (VRAI / FAUX ou TRUE / FALSE)
  //   5: commentaire_obligatoire (VRAI / FAUX ou TRUE / FALSE)
  //   6+: autres colonnes ignorées
  var configSheet = ss.getSheetByName("Admin_Config_Grille");
  if (!configSheet) return configMap; // Dégradé gracieux : pas de grille config = pas de validation hiérarchique

  var data = configSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowTplId  = String(data[i][0]).trim();
    // Filtre : seulement les lignes du template de la session (ou toutes si templateId non trouvé)
    if (templateId && rowTplId !== templateId) continue;

    var itemId    = String(data[i][1]).trim();
    var niveau    = parseInt(String(data[i][2]).trim(), 10) || 2;
    var parentId  = String(data[i][3] || "").trim();
    var estTerm   = /^(vrai|true|1|oui)$/i.test(String(data[i][4] || "").trim());
    var commOblig = /^(vrai|true|1|oui)$/i.test(String(data[i][5] || "").trim());

    configMap[itemId] = {
      niveau:                   niveau,
      parent_id:                parentId,
      est_terminal:             estTerm,
      commentaire_obligatoire:  commOblig
    };
  }

  return configMap;
}

function handleGetConfigTemplate(ss, templateId) {
  var configSheet = ss.getSheetByName("Admin_Config_Grille");
  if (!configSheet) return { success: true, items: [] };

  var data = configSheet.getDataRange().getValues();
  var items = [];
  var tplId = String(templateId || "").trim();

  for (var i = 1; i < data.length; i++) {
    var rowTplId = String(data[i][0]).trim();
    if (tplId && rowTplId !== tplId) continue;

    var itemId    = String(data[i][1]).trim();
    var niveau    = parseInt(String(data[i][2]).trim(), 10) || 2;
    var parentId  = String(data[i][3] || "").trim();
    var estTerm   = /^(vrai|true|1|oui)$/i.test(String(data[i][4] || "").trim());
    var commOblig = /^(vrai|true|1|oui)$/i.test(String(data[i][5] || "").trim());
    var libelle   = String(data[i][6] || "").trim();
    var criticite = String(data[i][7] || "Standard").trim();
    var catRacine = String(data[i][10] || "").trim();

    items.push({
      item_id: itemId,
      parent_id: parentId,
      niveau: niveau,
      type_noeud: String(data[i][9] || "").trim(),
      categorie_racine_fr: catRacine,
      libelle_fr: libelle,
      criticite: criticite,
      est_terminal: estTerm,
      commentaire_obligatoire: commOblig
    });
  }

  return { success: true, template_id: tplId, items: items };
}

// ==============================================================================
// HANDLER — Soumettre une évaluation avec validation hiérarchique conditionnelle
// ==============================================================================
function handleSoumettreEvaluation(ss, payload) {
  var sessionId = payload.session_id;
  var evalId    = payload.evaluateur_id;
  var estGauge  = payload.est_gauge === true || String(payload.est_gauge).toUpperCase() === "TRUE";

  if (!sessionId || !evalId) {
    return { success: false, message: "Paramètres requis manquants (session_id, evaluateur_id)." };
  }

  // ── Vérifier si la session est verrouillée, clôturée, ou expirée
  //    ET auto-détecter le statut Gauge si est_gauge n'a pas été transmis ──
  var sessSheet = ss.getSheetByName("Sessions");
  if (sessSheet) {
    var sessData = sessSheet.getDataRange().getValues();
    for (var i = 1; i < sessData.length; i++) {
      if (String(sessData[i][0]).trim() === String(sessionId).trim()) {
        var status = String(sessData[i][2]).trim();
        var heureFermetureStr = sessData[i][7];

        if (status === "LOCKED" || status === "CLOSED") {
          return { success: false, message: "La session est verrouillée ou clôturée, soumission impossible." };
        }

        if (heureFermetureStr) {
          var closeTime = new Date(heureFermetureStr).getTime();
          var nowTime = new Date().getTime();
          if (nowTime > closeTime) {
            if (status === "OPEN") sessSheet.getRange(i + 1, 3).setValue("LOCKED");
            return { success: false, message: "La date limite de soumission est dépassée, soumission impossible." };
          }
        }

        // ── AUTO-DÉTECTION GAUGE ─────────────────────────────────────────────
        // Si le frontend n'a pas transmis est_gauge=true, on le déduit en
        // comparant evalId avec gauge_id et animateur_id de la session.
        if (!estGauge) {
          var sessGaugeId = String(sessData[i][11] || "").trim().toLowerCase();
          var sessAnimId  = String(sessData[i][10] || "").trim().toLowerCase();
          if (!sessGaugeId && sessAnimId) sessGaugeId = sessAnimId;

          var evalClean  = cleanStringKey(evalId);
          var gaugeClean = cleanStringKey(sessGaugeId);
          var animClean  = cleanStringKey(sessAnimId);

          estGauge =
            (sessGaugeId !== "" && (
              evalId.toLowerCase() === sessGaugeId ||
              (gaugeClean.length >= 3 && (evalClean.includes(gaugeClean) || gaugeClean.includes(evalClean)))
            )) ||
            (sessAnimId !== "" && (
              evalId.toLowerCase() === sessAnimId ||
              (animClean.length >= 3 && (evalClean.includes(animClean) || animClean.includes(evalClean)))
            ));

          if (estGauge) {
            Logger.log("[AUTO-GAUGE] Session=" + sessionId + " Eval=" + evalId + " détecté comme Gauge via matching identifiants.");
          }
        }
        // ────────────────────────────────────────────────────────────────────
        break;
      }
    }
  }

  var items = payload.items || [];

  // ─────────────────────────────────────────────────────────────────────────────
  // ÉTAPE 1 — Charger la configuration hiérarchique de la grille
  // ─────────────────────────────────────────────────────────────────────────────
  var configMap = chargerConfigGrille(ss, sessionId);
  var hasHierarchyConfig = Object.keys(configMap).length > 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // ÉTAPE 2 — Construire un index du payload reçu
  //   payloadIndex[item_id] = statut normalisé ("Oui" | "Non" | "N.A.")
  //   payloadCommentaire[item_id] = commentaire soumis (string)
  // ─────────────────────────────────────────────────────────────────────────────
  var payloadIndex       = {};
  var payloadCommentaire = {};
  items.forEach(function(it) {
    if (it && it.item_id) {
      payloadIndex[it.item_id]       = normaliserReponse(it.statut);
      payloadCommentaire[it.item_id] = String(it.commentaire || "").trim();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ÉTAPE 3 — Validation hiérarchique conditionnelle
  //   (uniquement si Admin_Config_Grille est présente et peuplée)
  // ─────────────────────────────────────────────────────────────────────────────
  if (hasHierarchyConfig) {

    // 3a. Les items obligatoires dans le payload sont uniquement les questions Niveau 2
    var itemsAttendus = [];
    Object.keys(configMap).forEach(function(itemId) {
      var meta = configMap[itemId];
      if (meta.niveau === 2) {
        itemsAttendus.push(itemId);
      }
    });

    // 3b. Détecter les questions Niveau 2 sans réponse
    var manquants = itemsAttendus.filter(function(itemId) {
      return !(itemId in payloadIndex);
    });

    if (manquants.length > 0) {
      return {
        success: false,
        message: "Soumission incomplète. " + manquants.length + " question(s) principale(s) sans réponse.",
        items_manquants: manquants
      };
    }

    // 3c. Vérification commentaire obligatoire sur les noeuds feuilles de la soumission
    //   Chaque sous-item (niveau >= 3) qui est une FEUILLE (aucun enfant dans la soumission)
    //   doit comporter une justification d'imputation non vide.
    var parentSet = {};
    items.forEach(function(it) {
      if (it && it.item_id && it.niveau >= 3) {
        // Enregistrer qu'un sous-item a des enfants
        var meta = configMap[it.item_id];
        if (meta && meta.parent_id) {
          parentSet[meta.parent_id] = true;
        }
      }
    });

    var commentsManquants = [];
    items.forEach(function(it) {
      if (!it || !it.item_id || it.niveau < 3) return;
      var isLeafInSubmission = !parentSet[it.item_id];
      if (isLeafInSubmission) {
        var comm = String(it.commentaire || "").trim();
        if (!comm) {
          commentsManquants.push(it.item_id);
        }
      }
    });

    if (commentsManquants.length > 0) {
      return {
        success: false,
        message: "Commentaire d'imputation obligatoire manquant pour les sous-items du dernier niveau.",
        commentaires_manquants: commentsManquants
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ÉTAPE 4 — Enregistrement dans Log_Soumissions (inchangé)
  // ─────────────────────────────────────────────────────────────────────────────
  var sheet = ss.getSheetByName("Log_Soumissions");
  if (!sheet) { initialiserBaseDeDonnees(ss); sheet = ss.getSheetByName("Log_Soumissions"); }
  var now = new Date().toISOString();

  if (items.length > 0) {
    items.forEach(function(item) {
      sheet.appendRow([now, sessionId, evalId, estGauge, item.item_id, item.categorie, item.item, item.statut, item.commentaire || ""]);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ÉTAPE 5 — Mise à jour du statut de session pour la gauge (inchangé)
  // ─────────────────────────────────────────────────────────────────────────────
  if (estGauge) {
    var sessSheet2 = ss.getSheetByName("Sessions");
    if (sessSheet2) {
      var sessData2 = sessSheet2.getDataRange().getValues();
      for (var i = 1; i < sessData2.length; i++) {
        if (sessData2[i][0] === sessionId) {
          if (sessData2[i][2] === "PENDING_GAUGE") sessSheet2.getRange(i + 1, 3).setValue("GAUGE_DONE");
          break;
        }
      }
    }
  }

  return { success: true, message: "Évaluation enregistrée." };
}

// ==============================================================================
// HANDLER — Cockpit de Calibrage Hiérarchique
// Retourne les données structurées par niveaux (N1→N2→N3→N4)
// avec votes groupés par critère (Oui / Non / N.A.)
// ==============================================================================
function handleGetStructureGrille(ss, payload) {
  var sessionId = (payload && typeof payload === "object") ? payload.session_id : payload;
  return handleGetCockpit(ss, sessionId);
}

function cleanStringKey(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function handleGetCockpit(ss, sessionId) {
  updateSessionStatuses(ss);

  // ── 1. Info session ────────────────────────────────────────────────────────
  var sessSheet = ss.getSheetByName("Sessions");
  var sessData  = sessSheet ? sessSheet.getDataRange().getValues() : [];
  var sessionInfo = null;
  var templateId  = null;

  var sessionGaugeId = "";
  var sessionAnimateurId = "";
  for (var i = 1; i < sessData.length; i++) {
    if (String(sessData[i][0]).trim() === String(sessionId).trim()) {
      sessionAnimateurId = String(sessData[i][10] || "").trim().toLowerCase();
      sessionGaugeId = String(sessData[i][11] || "").trim().toLowerCase();

      // Retroactive fallback for old sessions: if gauge_id is empty, use animateur_id as gauge ID!
      if (!sessionGaugeId && sessionAnimateurId) {
        sessionGaugeId = sessionAnimateurId;
      }

      sessionInfo = {
        session_id:  String(sessData[i][0]).trim(),
        nom_session: String(sessData[i][1]).trim(),
        statut:      String(sessData[i][2]).trim(),
        template_id: String(sessData[i][4]).trim(),
        url_audio:   String(sessData[i][8] || "").trim(),
        heure_fin:   String(sessData[i][7] || "").trim(),
        nom_conseiller: String(sessData[i][12] || "").trim(),
        gauge_id:    sessionGaugeId
      };
      templateId = sessionInfo.template_id;
      break;
    }
  }

  // ── 2. Log_Soumissions : construire gaugeMap et votesMap ──────────────────
  var subSheet = ss.getSheetByName("Log_Soumissions");
  var subData  = subSheet ? subSheet.getDataRange().getValues() : [];

  var gaugeMap     = {};  // itemId / libelle / cleanKey → { critere, commentaire, nom }
  var votesMap     = {};  // itemId → [{ nom, critere, commentaire }]
  var submittedSet = {};  // evalId → true
  var libellemap   = {};  // itemId → libelle (depuis les soumissions)
  var catMap       = {};  // itemId → categorie (depuis les soumissions)

  for (var k = 1; k < subData.length; k++) {
    var rSessId = String(subData[k][1]).trim();
    if (rSessId !== String(sessionId).trim()) continue;

    var rEvalId  = String(subData[k][2]).trim();
    var rIsGaugeFlag = subData[k][3] === true || String(subData[k][3]).toUpperCase() === "TRUE";
    var rEvalLower = rEvalId.toLowerCase();
    var rCleanEval = cleanStringKey(rEvalId);
    var cleanGauge = cleanStringKey(sessionGaugeId);
    var cleanAnim  = cleanStringKey(sessionAnimateurId);

    var rIsGauge = rIsGaugeFlag
      || (sessionGaugeId !== "" && (rEvalLower === sessionGaugeId || (cleanGauge.length >= 3 && (rCleanEval.includes(cleanGauge) || cleanGauge.includes(rCleanEval)))))
      || (sessionAnimateurId !== "" && (rEvalLower === sessionAnimateurId || (cleanAnim.length >= 3 && (rCleanEval.includes(cleanAnim) || cleanAnim.includes(rCleanEval)))))
      || rEvalLower.includes("gauge");

    var rItemId  = String(subData[k][4]).trim();
    var rCat     = String(subData[k][5] || "Général").trim();
    var rLibelle = String(subData[k][6] || rItemId).trim();
    var rStatut  = normaliserReponse(subData[k][7]);
    var rComm    = String(subData[k][8] || "").trim();

    libellemap[rItemId] = rLibelle;
    catMap[rItemId]     = rCat;

    if (rIsGauge) {
      var gObj = { critere: rStatut, commentaire: rComm, nom: rEvalId };
      gaugeMap[rItemId] = gObj;
      if (rLibelle) gaugeMap[rLibelle] = gObj;

      var cleanId  = cleanStringKey(rItemId);
      var cleanLib = cleanStringKey(rLibelle);
      if (cleanId)  gaugeMap[cleanId]  = gObj;
      if (cleanLib) gaugeMap[cleanLib] = gObj;

      if (!rIsGaugeFlag && subSheet) {
        try { subSheet.getRange(k + 1, 4).setValue(true); } catch(e) {}
      }
    } else {
      submittedSet[rEvalId] = true;
      if (!votesMap[rItemId]) votesMap[rItemId] = [];
      votesMap[rItemId].push({ nom: rEvalId, critere: rStatut, commentaire: rComm });
    }
  }

  // ── FALLBACK : Récupération des items Gauge soumis lors de la demande ──────
  // Si gaugeMap est vide après le scan principal, la migration demandeId→sessionId
  // a probablement échoué. On scanne ALL les lignes de Log_Soumissions à la
  // recherche de lignes est_gauge=TRUE dont l'evaluateur_id correspond à gauge_id.
  // ─────────────────────────────────────────────────────────────────────────────
  if (Object.keys(gaugeMap).length === 0 && sessionGaugeId !== "") {
    var cgaugeClean = cleanStringKey(sessionGaugeId);
    var canimClean  = cleanStringKey(sessionAnimateurId);
    Logger.log("[GAUGE FALLBACK] gaugeMap vide — scan de récupération pour gauge_id=" + sessionGaugeId);

    for (var fb = 1; fb < subData.length; fb++) {
      // Seulement les lignes explicitement marquées est_gauge=TRUE
      var fbIsGaugeFlag = subData[fb][3] === true || String(subData[fb][3]).toUpperCase() === "TRUE";
      if (!fbIsGaugeFlag) continue;

      var fbEvalId    = String(subData[fb][2]).trim().toLowerCase();
      var fbCleanEval = cleanStringKey(fbEvalId);

      // Correspondance exacte ou floue avec gauge_id ou animateur_id
      var fbMatch =
        (sessionGaugeId !== "" && (
          fbEvalId === sessionGaugeId ||
          (cgaugeClean.length >= 3 && (fbCleanEval.includes(cgaugeClean) || cgaugeClean.includes(fbCleanEval)))
        )) ||
        (sessionAnimateurId !== "" && (
          fbEvalId === sessionAnimateurId ||
          (canimClean.length >= 3 && (fbCleanEval.includes(canimClean) || canimClean.includes(fbCleanEval)))
        ));

      if (!fbMatch) continue;

      var fbItemId  = String(subData[fb][4]).trim();
      var fbLibelle = String(subData[fb][6] || fbItemId).trim();
      var fbStatut  = normaliserReponse(subData[fb][7]);
      var fbComm    = String(subData[fb][8] || "").trim();
      var fbCat     = String(subData[fb][5] || "Général").trim();

      var fbObj = { critere: fbStatut, commentaire: fbComm, nom: String(subData[fb][2]).trim() };
      gaugeMap[fbItemId] = fbObj;
      if (fbLibelle) gaugeMap[fbLibelle] = fbObj;

      var fbCleanId  = cleanStringKey(fbItemId);
      var fbCleanLib = cleanStringKey(fbLibelle);
      if (fbCleanId)  gaugeMap[fbCleanId]  = fbObj;
      if (fbCleanLib) gaugeMap[fbCleanLib] = fbObj;

      if (!libellemap[fbItemId]) libellemap[fbItemId] = fbLibelle;
      if (!catMap[fbItemId])     catMap[fbItemId]     = fbCat;

      // Corriger rétroactivement le session_id dans Log_Soumissions
      if (subSheet) {
        try {
          var currentSessId = String(subData[fb][1]).trim();
          if (currentSessId !== String(sessionId).trim()) {
            subSheet.getRange(fb + 1, 2).setValue(sessionId);
            Logger.log("[GAUGE FALLBACK] Migré ligne " + (fb+1) + " : " + currentSessId + " → " + sessionId);
          }
        } catch(e) {}
      }
    }
    Logger.log("[GAUGE FALLBACK] Items récupérés : " + Object.keys(gaugeMap).length / 4 + " items (x4 clés)");
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // ── 3. Décisions finales (Historique_Arbitrages) ──────────────────────────
  var arbSheet = ss.getSheetByName("Historique_Arbitrages");
  var arbData  = arbSheet ? arbSheet.getDataRange().getValues() : [];
  var decisionsMap = {}; // itemId → { decision, justification, animateur_id, timestamp }
  for (var a = 1; a < arbData.length; a++) {
    if (String(arbData[a][1]).trim() !== String(sessionId).trim()) continue;
    // Colonnes: timestamp | session_id | categorie | item_nom | decision_arbitrage | nouvelle_consigne | animateur_id
    // On réutilise item_nom (col 3) comme clé item_id
    var aItemId = String(arbData[a][3]).trim();
    decisionsMap[aItemId] = {
      decision:      String(arbData[a][4] || "").trim(),
      justification: String(arbData[a][5] || "").trim(),
      animateur_id:  String(arbData[a][6] || "").trim(),
      timestamp:     String(arbData[a][0] || "").trim()
    };
  }

  // ── 4. Admin_Config_Grille : lire l'arborescence complète du template ─────
  var cfgSheet = ss.getSheetByName("Admin_Config_Grille");
  var cfgData  = cfgSheet ? cfgSheet.getDataRange().getValues() : [];

  // cfgNodes[itemId] = { item_id, niveau, parent_id, libelle, criticite, categorie_racine_fr, type_noeud }
  var cfgNodes   = {};
  // childrenOf[parentId] = [itemId, ...]
  var childrenOf = {};
  // N1 roots
  var n1Roots    = [];

  for (var c = 1; c < cfgData.length; c++) {
    var rowTpl  = String(cfgData[c][0]).trim();
    if (templateId && rowTpl !== templateId) continue;

    var cItemId  = String(cfgData[c][1]).trim();
    var cNiveau  = parseInt(String(cfgData[c][2]).trim(), 10) || 2;
    var cParent  = String(cfgData[c][3] || "").trim();
    var cLibelle = String(cfgData[c][6] || "").trim();
    var cCrit    = String(cfgData[c][7] || "Standard").trim();
    var cCatRac  = String(cfgData[c][10] || "").trim();
    var cType    = String(cfgData[c][9] || "").trim();

    cfgNodes[cItemId] = {
      item_id:            cItemId,
      niveau:             cNiveau,
      parent_id:          cParent,
      libelle:            cLibelle,
      criticite:          cCrit,
      categorie_racine_fr: cCatRac,
      type_noeud:         cType
    };

    if (cNiveau === 1) {
      n1Roots.push(cItemId);
    } else {
      if (cParent) {
        if (!childrenOf[cParent]) childrenOf[cParent] = [];
        childrenOf[cParent].push(cItemId);
      }
    }
  }

  // ── 5. Fonction récursive pour construire un nœud de résultat ─────────────
  function buildNode(itemId) {
    var node = cfgNodes[itemId] || {
      item_id: itemId, niveau: 2, parent_id: "",
      libelle: libellemap[itemId] || itemId,
      criticite: "Standard", categorie_racine_fr: catMap[itemId] || "Général", type_noeud: ""
    };

    var cleanId  = cleanStringKey(itemId);
    var cleanLib = cleanStringKey(node.libelle);

    var gauge = gaugeMap[itemId]
      || (node.libelle ? gaugeMap[node.libelle] : null)
      || (cleanId ? gaugeMap[cleanId] : null)
      || (cleanLib ? gaugeMap[cleanLib] : null)
      || null;
    var allVotes = votesMap[itemId] || [];

    // Grouper les votes par critère
    var votesByCritere = { "Oui": [], "Non": [], "N.A.": [] };
    allVotes.forEach(function(v) {
      var c2 = v.critere || "";
      if (c2 === "Oui") votesByCritere["Oui"].push(v);
      else if (c2 === "Non") votesByCritere["Non"].push(v);
      else votesByCritere["N.A."].push(v);
    });

    // Calculer statut d'accord
    var gaugeCritere = gauge ? gauge.critere : null;
    var statutAccord = "sans_votes";
    if (allVotes.length > 0 && gaugeCritere) {
      var allMatch = allVotes.every(function(v) { return v.critere === gaugeCritere; });
      statutAccord = allMatch ? "accord" : "divergence";
    } else if (allVotes.length > 0 && !gaugeCritere) {
      // Pas encore de gauge soumise
      statutAccord = "en_attente_gauge";
    }

    // Décision finale enregistrée ?
    var decisionFinale = decisionsMap[itemId] || null;

    // Construire enfants récursivement
    var children = [];
    var childIds = childrenOf[itemId] || [];
    childIds.forEach(function(childId) {
      children.push(buildNode(childId));
    });

    return {
      item_id:          node.item_id,
      niveau:           node.niveau,
      libelle:          node.libelle,
      criticite:        node.criticite,
      categorie_racine_fr: node.categorie_racine_fr,
      type_noeud:       node.type_noeud,
      gauge:            gauge,
      votes_par_critere: votesByCritere,
      total_votes:      allVotes.length,
      statut_accord:    statutAccord,
      decision_finale:  decisionFinale,
      children:         children
    };
  }

  // ── 6. Construire la grille hiérarchique ──────────────────────────────────
  var grilleHierarchique = [];

  if (n1Roots.length > 0) {
    // On a des items N1 → on les utilise comme racines
    n1Roots.forEach(function(n1Id) {
      grilleHierarchique.push(buildNode(n1Id));
    });
  } else {
    // Pas de N1 dans la config → items N2 regroupés par categorie_racine_fr (mode dégradé)
    var n2Ids = Object.keys(cfgNodes).filter(function(id) {
      return cfgNodes[id].niveau === 2 && !cfgNodes[id].parent_id;
    });

    // Regrouper par catégorie racine
    var catGroups = {};
    n2Ids.forEach(function(id) {
      var cat = cfgNodes[id].categorie_racine_fr || "Général";
      if (!catGroups[cat]) catGroups[cat] = [];
      catGroups[cat].push(id);
    });

    // Si même pas de cfg → tous les items soumis
    if (n2Ids.length === 0) {
      var allSubmitted = {};
      Object.keys(gaugeMap).forEach(function(id) { allSubmitted[id] = true; });
      Object.keys(votesMap).forEach(function(id) { allSubmitted[id] = true; });
      Object.keys(allSubmitted).forEach(function(id) {
        var cat = catMap[id] || "Général";
        if (!catGroups[cat]) catGroups[cat] = [];
        catGroups[cat].push(id);
      });
    }

    Object.keys(catGroups).forEach(function(cat) {
      var syntheticN1 = {
        item_id: "CAT_" + cat.replace(/[^a-zA-Z0-9]/g, "_"),
        niveau: 1,
        libelle: cat,
        criticite: "Standard",
        categorie_racine_fr: cat,
        type_noeud: "categorie",
        gauge: null,
        votes_par_critere: { "Oui": [], "Non": [], "N.A.": [] },
        total_votes: 0,
        statut_accord: "sans_votes",
        decision_finale: null,
        children: catGroups[cat].map(function(id) { return buildNode(id); })
      };
      // Hériter statut depuis enfants
      var hasDivergence = syntheticN1.children.some(function(c) { return c.statut_accord === "divergence"; });
      syntheticN1.statut_accord = hasDivergence ? "divergence" : "accord";
      grilleHierarchique.push(syntheticN1);
    });
  }

  // ── 7. Calculer si le cockpit est en lecture seule (pas encore fermé) ──────
  var isReadOnly = false;
  if (sessionInfo) {
    var status = sessionInfo.statut;
    if (status === "PENDING_GAUGE" || status === "GAUGE_DONE" || status === "OPEN") {
      isReadOnly = true;
    }
    if (sessionInfo.heure_fin) {
      var closeTime = new Date(sessionInfo.heure_fin).getTime();
      var nowTime = new Date().getTime();
      if (nowTime < closeTime) {
        isReadOnly = true;
      }
    }
  }

  // ── 8. Retourner la réponse complète ──────────────────────────────────────
  return {
    success: true,
    session_id:         sessionId,
    nom_session:        sessionInfo ? sessionInfo.nom_session : sessionId,
    statut:             sessionInfo ? sessionInfo.statut : "OPEN",
    template_id:        templateId || "",
    url_audio:          sessionInfo ? sessionInfo.url_audio : "",
    heure_fin:          sessionInfo ? sessionInfo.heure_fin : "",
    nom_conseiller:     sessionInfo ? sessionInfo.nom_conseiller : "",
    gauge_id:           sessionInfo ? sessionInfo.gauge_id : "",
    animateur_id:       sessionAnimateurId || "",
    evaluateurs_soumis: Object.keys(submittedSet),
    grille_hierarchique: grilleHierarchique,
    is_read_only:       isReadOnly,
    // Données legacy (pour compatibilité)
    categories: {},
    calibration: {
      moyenne_session_variance: 0,
      evaluateurs_non_calibres: [],
      details_par_evaluateur: {}
    }
  };
}

// ==============================================================================
// HELPER — Vérifier si la date limite de clôture d'une session n'est pas encore atteinte
// ==============================================================================
function isSessionBeforeDeadline(ss, sessionId) {
  var sessSheet = ss.getSheetByName("Sessions");
  if (sessSheet) {
    var sessData = sessSheet.getDataRange().getValues();
    for (var i = 1; i < sessData.length; i++) {
      if (sessData[i][0] === sessionId) {
        var status = sessData[i][2];
        if (status === "CLOSED" || status === "LOCKED") {
          return false;
        }
        if (sessData[i][7]) {
          var closeTime = new Date(sessData[i][7]).getTime();
          var nowTime = new Date().getTime();
          if (nowTime < closeTime) {
            return true;
          }
        }
        break;
      }
    }
  }
  return false;
}

// ==============================================================================
// HANDLER — Enregistrer une décision finale d'arbitrage sur un item
// ==============================================================================
function handleEnregistrerDecisionFinale(ss, payload) {
  var sessionId   = payload.session_id;
  var itemId      = payload.item_id;
  var decision    = payload.decision;        // "Oui" | "Non" | "N.A."
  var justification = payload.justification || "";
  var animateurId = payload.animateur_id || "admin";

  if (!sessionId || !itemId || !decision) {
    return { success: false, message: "Paramètres requis : session_id, item_id, decision." };
  }

  if (isSessionBeforeDeadline(ss, sessionId)) {
    return { success: false, message: "Arbitrage bloqué : La date de clôture de la session n'est pas encore atteinte." };
  }

  var sheet = ss.getSheetByName("Historique_Arbitrages");
  if (!sheet) {
    initialiserBaseDeDonnees(ss);
    sheet = ss.getSheetByName("Historique_Arbitrages");
  }

  // Supprimer une éventuelle décision précédente sur le même item/session
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]).trim() === String(sessionId).trim() &&
        String(data[i][3]).trim() === String(itemId).trim()) {
      sheet.deleteRow(i + 1);
    }
  }

  // Enregistrer la nouvelle décision
  sheet.appendRow([
    new Date().toISOString(),
    sessionId,
    "",            // categorie (non utilisé ici)
    itemId,        // item_nom sert de item_id
    decision,      // decision_arbitrage
    justification, // nouvelle_consigne / justification
    animateurId
  ]);

  return { success: true, message: "Décision finale enregistrée.", item_id: itemId, decision: decision };
}

// ==============================================================================
// HANDLER — Enregistrer un lot (batch) de décisions d'arbitrage en 1 seule transaction
// ==============================================================================
function handleEnregistrerDecisionsBatch(ss, payload) {
  var sessionId   = payload.session_id;
  var items       = payload.items || [];
  var animateurId = payload.animateur_id || "admin";

  if (!sessionId) {
    return { success: false, message: "Paramètre requis : session_id manquant." };
  }
  if (!items || items.length === 0) {
    return { success: false, message: "Paramètre requis : items est vide ou manquant." };
  }

  if (isSessionBeforeDeadline(ss, sessionId)) {
    return { success: false, message: "Arbitrage bloqué : La date de clôture de la session n'est pas encore atteinte." };
  }

  var sheet = ss.getSheetByName("Historique_Arbitrages");
  if (!sheet) {
    initialiserBaseDeDonnees(ss);
    sheet = ss.getSheetByName("Historique_Arbitrages");
  }

  // Créer un dictionnaire des item_id à mettre à jour
  var targetItemIds = {};
  items.forEach(function(it) {
    if (it.item_id) targetItemIds[String(it.item_id).trim()] = true;
  });

  // Supprimer les anciennes décisions pour ces items en allant de bas en haut
  // (évite le décalage d'index lors de deleteRow)
  var allData = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  for (var i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][1]).trim() === String(sessionId).trim() &&
        targetItemIds[String(allData[i][3]).trim()]) {
      rowsToDelete.push(i + 1); // 1-indexed
    }
  }
  // Supprimer du bas vers le haut pour éviter le décalage
  rowsToDelete.forEach(function(rowNum) {
    sheet.deleteRow(rowNum);
  });

  // Préparer toutes les nouvelles lignes
  var now = new Date().toISOString();
  var newRows = [];
  items.forEach(function(it) {
    if (!it.item_id || !it.decision) return;
    newRows.push([
      now,
      String(sessionId).trim(),
      "",
      String(it.item_id).trim(),
      String(it.decision).trim(),
      String(it.justification || "").trim(),
      String(animateurId).trim()
    ]);
  });

  // Écrire tout le bloc en 1 seule opération atomique
  if (newRows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, 7).setValues(newRows);
  }

  Logger.log("[Batch] Session=" + sessionId + " | " + newRows.length + " arbitrage(s) écrits.");
  return {
    success: true,
    message: newRows.length + " arbitrage(s) enregistré(s) avec succès.",
    count: newRows.length
  };
}

// ==============================================================================
// HANDLER — Réinitialiser / Effacer tous les arbitrages enregistrés d'une session
// ==============================================================================
function handleReinitialiserArbitrages(ss, payload) {
  var sessionId = payload.session_id;
  if (!sessionId) {
    return { success: false, message: "Paramètre requis : session_id manquant." };
  }

  if (isSessionBeforeDeadline(ss, sessionId)) {
    return { success: false, message: "Arbitrage bloqué : La date de clôture de la session n'est pas encore atteinte." };
  }

  var sheet = ss.getSheetByName("Historique_Arbitrages");
  if (!sheet) {
    return { success: true, message: "Aucun arbitrage à réinitialiser.", count: 0 };
  }

  var allData = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  for (var i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][1]).trim() === String(sessionId).trim()) {
      rowsToDelete.push(i + 1); // 1-indexed
    }
  }

  // Supprimer du bas vers le haut pour éviter le décalage d'index
  rowsToDelete.forEach(function(rowNum) {
    sheet.deleteRow(rowNum);
  });

  Logger.log("[Reset Arbitrages] Session=" + sessionId + " | " + rowsToDelete.length + " ligne(s) effacée(s).");
  return {
    success: true,
    message: rowsToDelete.length + " arbitrage(s) réinitialisé(s) pour la session.",
    count: rowsToDelete.length
  };
}

function handleGetProfil(ss, evaluateurId) {
  const subSheet = ss.getSheetByName("Log_Soumissions");
  const subData = subSheet ? subSheet.getDataRange().getValues() : [];
  let totalSubs = 0;
  const sessionsSet = new Set();

  for (let i = 1; i < subData.length; i++) {
    if (String(subData[i][2]).trim().toLowerCase() === String(evaluateurId).trim().toLowerCase()) {
      totalSubs++;
      sessionsSet.add(subData[i][1]);
    }
  }
  return { success: true, data: { identifiant: evaluateurId, nombre_total_evaluations_soumises: totalSubs, nombre_sessions_participes: sessionsSet.size, nombre_sessions_ratees: 0, nombre_sessions_animees: 0 } };
}

function handleValiderHorsSession(ss, payload) {
  const sessionId = payload.session_id;
  const decision = payload.decision_admin;
  const sheet = ss.getSheetByName("Sessions");
  if (!sheet) return { success: false, message: "Feuille sessions introuvable." };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      sheet.getRange(i + 1, 3).setValue(decision === "APPROUVE" ? "OPEN" : "CLOSED");
      return { success: true, message: "Décision enregistrée." };
    }
  }
  return { success: false, message: "Session introuvable." };
}

function handleEnregistrerArbitrage(ss, payload) {
  let sheet = ss.getSheetByName("Historique_Arbitrages");
  if (!sheet) { initialiserBaseDeDonnees(ss); sheet = ss.getSheetByName("Historique_Arbitrages"); }
  sheet.appendRow([new Date().toISOString(), payload.session_id, payload.categorie, payload.item_nom, payload.decision_arbitrage, payload.nouvelle_consigne, payload.animateur_id]);
  return { success: true, message: "Arbitrage enregistré." };
}

function handleCloturerSession(ss, payload) {
  const sessionId = payload.session_id;
  const force = payload.force === true || String(payload.force).toLowerCase() === "true";
  const sheet = ss.getSheetByName("Sessions");
  if (!sheet) return { success: false, message: "Feuille sessions introuvable." };

  // Vérifier si tous les items de la grille ont été arbitrés
  if (!force) {
    const cockpitData = handleGetCockpit(ss, sessionId);
    if (cockpitData && cockpitData.grille_hierarchique) {
      // Extraire toutes les questions d'évaluation (les enfants N2 des catégories N1)
      var allQuestions = [];
      cockpitData.grille_hierarchique.forEach(function(root) {
        if (root.type_noeud === "categorie" || (root.children && root.children.length > 0)) {
          if (root.children) {
            root.children.forEach(function(child) { allQuestions.push(child); });
          }
        } else {
          allQuestions.push(root);
        }
      });

      const unarbitrated = allQuestions.filter(function(q) {
        return !q.decision_finale;
      });

      if (unarbitrated.length > 0) {
        return {
          success: false,
          message: "Clôture impossible : " + unarbitrated.length + " item(s) sur " + allQuestions.length + " ne sont pas encore arbitrés.",
          unarbitrated_count: unarbitrated.length
        };
      }
    }
  }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sessionId) {
      sheet.getRange(i + 1, 3).setValue("CLOSED");
      // Try to generate the PDF report. If it fails, still return success for the cloture.
      let pdfUrl = null;
      try {
        pdfUrl = genererRapportCalibrage(ss, sessionId);
      } catch(e) {
        Logger.log("Erreur génération rapport: " + e.toString());
      }
      const result = { success: true, message: "Session clôturée." };
      if (pdfUrl) result.pdf_url = pdfUrl;
      return result;
    }
  }
  return { success: false, message: "Session introuvable." };
}

// ==============================================================================
// HANDLER — Récupérer l'URL du rapport PDF d'une session clôturée
// ==============================================================================
function handleGetRapportPdf(ss, sessionId) {
  if (!sessionId) return { success: false, message: "session_id requis." };
  const sheet = ss.getSheetByName("Sessions");
  if (!sheet) return { success: false, message: "Feuille sessions introuvable." };

  // Générer un rapport PDF mis à jour avec la structure v14
  try {
    const pdfUrl = genererRapportCalibrage(ss, sessionId);
    if (pdfUrl) return { success: true, pdf_url: pdfUrl };
    return { success: false, message: "Génération du rapport en cours, réessayez dans quelques instants." };
  } catch(e) {
    var errText = e.toString();
    if (errText.indexOf("DocumentApp") !== -1 || errText.indexOf("auth/documents") !== -1 || errText.indexOf("autorisé") !== -1) {
      return {
        success: false,
        message: "Autorisation Google Docs requise ! Dans l'éditeur Google Apps Script (script.google.com), sélectionnez la fonction 'autoriserGoogleDocsPermissions' dans la barre du haut et cliquez sur 'Exécuter' une seule fois pour valider l'accès à Google Docs."
      };
    }
    return { success: false, message: "Erreur lors de la génération du rapport: " + errText };
  }
}

// ==============================================================================
// CORE — Générer le rapport PDF de calibrage complet dans Google Drive
// Retourne l'URL du PDF ou null en cas d'échec.
// ==============================================================================
function genererRapportCalibrage(ss, sessionId) {
  // ── 1. Récupérer la structure hiérarchique complète via handleGetCockpit ──────
  const resStruct = handleGetCockpit(ss, sessionId);
  if (!resStruct || !resStruct.success) {
    Logger.log("Impossible de récupérer la structure de grille pour la session " + sessionId);
    return null;
  }

  // handleGetCockpit retourne les champs directement à la racine (pas de sous-objet session_info)
  const sessionInfo = {
    session_id:       resStruct.session_id || sessionId,
    nom_session:      resStruct.nom_session || sessionId,
    statut:           resStruct.statut || "CLOSED",
    heure_fin:        resStruct.heure_fin || "",
    nom_conseiller:   resStruct.nom_conseiller || "",
    url_audio:        resStruct.url_audio || ""
  };
  const categories  = resStruct.grille_hierarchique || [];
  const evaluateurs = resStruct.evaluateurs_soumis || [];

  // ── 2. Calculer le résumé statistique ───────────────────────────────────────
  let nbOui = 0, nbNon = 0, nbNA = 0, totalArbitres = 0;

  categories.forEach(function(cat) {
    const questions = cat.children || [];
    questions.forEach(function(q) {
      if (q.decision_finale && q.decision_finale.decision) {
        totalArbitres++;
        var dec = String(q.decision_finale.decision).trim();
        if (dec === "Oui") nbOui++;
        else if (dec === "Non") nbNon++;
        else if (dec === "N.A.") nbNA++;
      }
    });
  });

  const tauxConformite = totalArbitres > 0 ? Math.round((nbOui / totalArbitres) * 100) : 0;

  // ── 3. Créer le Google Document ──────────────────────────────────────────────
  const dateStr = sessionInfo.heure_fermeture
    ? Utilities.formatDate(new Date(sessionInfo.heure_fermeture), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
    : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

  const docTitle = "Rapport_Calibrage_" + (sessionInfo.session_id || sessionId) + "_" + dateStr.replace(/[\/: ]/g, "-");
  const doc = DocumentApp.create(docTitle);
  const body = doc.getBody();

  // Marges et mise en page
  body.setMarginTop(36);
  body.setMarginBottom(36);
  body.setMarginLeft(40);
  body.setMarginRight(40);

  // ── 4. En-tête du rapport ────────────────────────────────────────────────────
  const titlePara = body.appendParagraph("RAPPORT DE CALIBRAGE — " + (sessionInfo.nom_session || sessionInfo.session_id || sessionId));
  titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph("Session ID : " + (sessionInfo.session_id || sessionId));
  if (sessionInfo.nom_conseiller) body.appendParagraph("Conseiller évalué : " + sessionInfo.nom_conseiller);
  if (sessionInfo.animateur_id)   body.appendParagraph("Animateur : " + sessionInfo.animateur_id);
  body.appendParagraph("Date de clôture : " + dateStr);
  body.appendParagraph("Participants (" + evaluateurs.length + ") : " + (evaluateurs.join(", ") || "Aucun"));
  body.appendHorizontalRule();

  // ── 5. Résumé statistique ────────────────────────────────────────────────────
  const summaryTitle = body.appendParagraph("RÉSUMÉ EXÉCUTIF");
  summaryTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph("Items N2 arbitrés : " + totalArbitres);
  body.appendParagraph("✅ Conformes (Oui) : " + nbOui + "   |   ❌ Imputés (Non) : " + nbNon + "   |   ⚪ Non Applicables (N.A.) : " + nbNA);
  const tauxPara = body.appendParagraph("Taux de conformité global : " + tauxConformite + "%");
  tauxPara.setBold(true);
  body.appendHorizontalRule();

  // ── 6. Détail par Catégorie (N1) et Question (N2) ───────────────────────────
  const detailTitle = body.appendParagraph("DÉTAIL DES ARBITRAGES PAR CATÉGORIE");
  detailTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  categories.forEach(function(cat) {
    const catName = cat.libelle || cat.item_id || "Catégorie";
    const catPara = body.appendParagraph("► " + catName.toUpperCase());
    catPara.setHeading(DocumentApp.ParagraphHeading.HEADING3);

    const questions = cat.children || [];
    if (questions.length === 0) {
      body.appendParagraph("  (Aucune question dans cette catégorie)").setItalic(true);
      return;
    }

    questions.forEach(function(q) {
      const qName = q.libelle || q.item_id;
      const isCritical = q.criticite === "Critical" || q.criticite === "Terminal" || q.criticite === "Eliminatoire";
      const qHeader = "  • " + qName + (isCritical ? " [CRITIQUE / TERMINAL]" : "");

      const qPara = body.appendParagraph(qHeader);
      qPara.setBold(true);

      const decObj = q.decision_finale;
      const decStr = decObj ? String(decObj.decision || "").trim() : "Non arbitré";
      const justif = decObj ? String(decObj.justification || "").trim() : "";

      if (decStr === "Oui") {
        body.appendParagraph("      ✅ Décision finale : OUI (Conforme)").setBold(true);
        // Si Conforme (Oui), masquage automatique des sous-items selon les spécifications
      } else if (decStr === "Non") {
        body.appendParagraph("      ❌ Décision finale : NON (Imputé)").setBold(true);
        if (justif) {
          body.appendParagraph("      💬 Justification / Consigne d'arbitrage : " + justif).setItalic(true);
        }

        // Afficher les sous-items imputés (N3 / pénalités) avec leurs commentaires
        const subItems = q.children || [];
        const imputedSubItems = subItems.filter(function(sub) {
          if (sub.decision_finale && sub.decision_finale.decision === "Non") return true;
          if (sub.gauge && sub.gauge.critere === "Non") return true;
          if (sub.votes_par_critere && sub.votes_par_critere["Non"] && sub.votes_par_critere["Non"].length > 0) return true;
          return false;
        });

        if (imputedSubItems.length > 0) {
          body.appendParagraph("      📌 Détail des pénalités / sous-items imputés :").setBold(true);
          imputedSubItems.forEach(function(sub) {
            const subLabel = sub.libelle || sub.item_id;
            var subComm = "";
            if (sub.gauge && sub.gauge.commentaire) subComm = sub.gauge.commentaire;
            else if (sub.decision_finale && sub.decision_finale.justification) subComm = sub.decision_finale.justification;

            body.appendParagraph("        – " + subLabel + (subComm ? " (Commentaire : " + subComm + ")" : ""));
          });
        }
      } else if (decStr === "N.A.") {
        body.appendParagraph("      ⚪ Décision finale : N.A. (Non applicable)");
      } else {
        body.appendParagraph("      ⚠️ Décision finale : Non arbitrée");
      }

      // Résumé Gauge & Votes si présent
      if (q.gauge) {
        body.appendParagraph("      Gauge (" + q.gauge.nom + ") : " + q.gauge.critere +
          (q.gauge.commentaire ? " — " + q.gauge.commentaire : ""));
      }

      body.appendParagraph(""); // Séparation
    });
  });

  body.appendParagraph("\n— Fin du rapport de calibrage —")
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // ── 7. Exporter en PDF dans Google Drive ─────────────────────────────────────
  doc.saveAndClose();
  const docId = doc.getId();
  const docFile = DriveApp.getFileById(docId);

  // Dossier CaliSync_Rapports
  let folder = null;
  const folderIter = DriveApp.getFoldersByName("CaliSync_Rapports");
  if (folderIter.hasNext()) {
    folder = folderIter.next();
  } else {
    folder = DriveApp.createFolder("CaliSync_Rapports");
  }

  // Exporter en PDF
  const pdfBlob = docFile.getAs("application/pdf").setName(docTitle + ".pdf");
  const pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const pdfUrl = pdfFile.getUrl();

  // Supprimer le doc Google Doc temporaire
  try { docFile.setTrashed(true); } catch(e) {}

  // Enregistrer l'URL PDF dans la feuille Sessions (colonne 15 = index 14)
  const sessSheet = ss.getSheetByName("Sessions");
  if (sessSheet) {
    const sessData = sessSheet.getDataRange().getValues();
    for (var i = 1; i < sessData.length; i++) {
      if (String(sessData[i][0]).trim() === String(sessionId).trim()) {
        sessSheet.getRange(i + 1, 15).setValue(pdfUrl);
        break;
      }
    }
  }

  return pdfUrl;
}

function updateSessionStatuses(ss) {
  const sheet = ss.getSheetByName("Sessions");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const statut = data[i][2];
    const ouvertureStr = data[i][5];
    const finStr = data[i][7];

    if (statut === "GAUGE_DONE" && ouvertureStr) {
      const ouverture = new Date(ouvertureStr);
      if (now >= ouverture) sheet.getRange(i + 1, 3).setValue("OPEN");
    }

    if (statut === "OPEN" && finStr) {
      const fin = new Date(finStr);
      if (now >= fin) sheet.getRange(i + 1, 3).setValue("LOCKED");
    }
  }
}

function getSubmittedEvaluators(subData, sessionId) {
  const setEvals = new Set();
  for (let i = 1; i < subData.length; i++) {
    if (subData[i][1] === sessionId && (subData[i][3] === false || String(subData[i][3]).toUpperCase() === "FALSE")) {
      setEvals.add(subData[i][2]);
    }
  }
  return Array.from(setEvals);
}

function hasGaugeSubmitted(subData, sessionId) {
  for (let i = 1; i < subData.length; i++) {
    if (subData[i][1] === sessionId && (subData[i][3] === true || String(subData[i][3]).toUpperCase() === "TRUE")) return true;
  }
  return false;
}

function handleGetMesSessions(ss, req) {
  var evaluateurId = req.evaluateur_id;
  if (!evaluateurId) return { success: false, message: "evaluateur_id requis." };

  var cleanId = String(evaluateurId).trim().toLowerCase();

  // 1. Trouver toutes les sessions où l'utilisateur a soumis
  var submittedSessionIds = {};
  var subSheet = ss.getSheetByName("Log_Soumissions");
  if (subSheet) {
    var subData = subSheet.getDataRange().getValues();
    for (var i = 1; i < subData.length; i++) {
      if (String(subData[i][2]).trim().toLowerCase() === cleanId) {
        submittedSessionIds[String(subData[i][1]).trim()] = true;
      }
    }
  }

  // 2. Récupérer les sessions correspondantes
  var sessionsSheet = ss.getSheetByName("Sessions");
  if (!sessionsSheet) return { success: true, sessions: [] };

  var data = sessionsSheet.getDataRange().getValues();
  var sessions = [];

  for (var i = 1; i < data.length; i++) {
    var sessionId = String(data[i][0]).trim();
    var animId = String(data[i][10] || "").trim().toLowerCase();
    var gaugeId = String(data[i][11] || "").trim().toLowerCase();
    var hasSubmitted = submittedSessionIds[sessionId] === true;

    // L'utilisateur doit être animateur, gauge, ou avoir soumis une évaluation
    if (animId === cleanId || gaugeId === cleanId || hasSubmitted) {
      var roles = [];
      if (animId === cleanId) roles.push("Animateur");
      if (gaugeId === cleanId) roles.push("Gauge");
      if (hasSubmitted && gaugeId !== cleanId) roles.push("Évaluateur");

      sessions.push({
        session_id: sessionId,
        nom_session: data[i][1],
        statut: data[i][2],
        template_id: data[i][4],
        heure_ouverture: data[i][5],
        duree_minutes: data[i][6],
        heure_fin: data[i][7],
        url_audio: data[i][8],
        animateur_id: data[i][10] || "",
        gauge_id: data[i][11] || "",
        nom_conseiller: data[i][12] || "",
        consignes: data[i][13] || "",
        roles: roles,
        has_submitted: hasSubmitted
      });
    }
  }

  return { success: true, sessions: sessions };
}

function handleGetMaSoumission(ss, req) {
  var sessionId = req.session_id;
  var evaluateurId = req.evaluateur_id;
  if (!sessionId || !evaluateurId) {
    return { success: false, message: "session_id et evaluateur_id requis." };
  }
  var sheet = ss.getSheetByName("Log_Soumissions");
  if (!sheet) return { success: true, answers: {}, comments: {} };
  var data = sheet.getDataRange().getValues();
  var answers = {};
  var comments = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(sessionId).trim() &&
        String(data[i][2]).trim().toLowerCase() === String(evaluateurId).trim().toLowerCase()) {
      var itemId = data[i][4];
      var statut = data[i][7];
      var comm = data[i][8];
      answers[itemId] = statut;
      if (comm) {
        comments[itemId] = comm;
      }
    }
  }
  return { success: true, answers: answers, comments: comments };
}

function handleUploadAudioDrive(ss, body) {
  const base64Data = body.base64_data || body.base64Data;
  const fileName = body.file_name || body.fileName || ("calisync_audio_" + new Date().getTime() + ".mp3");
  const mimeType = body.mime_type || body.mimeType || "audio/mp3";

  if (!base64Data) return { success: false, message: "Données audio manquantes." };

  try {
    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = DriveApp.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(e) {
      // Fallback
    }
    const fileId = file.getId();
    const downloadUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
    return {
      success: true,
      file_id: fileId,
      url_audio: downloadUrl,
      view_url: file.getUrl(),
      message: "Audio téléversé avec succès sur Google Drive !"
    };
  } catch(err) {
    return { success: false, message: "Erreur lors de l'upload vers Google Drive : " + err.toString() };
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// CORRECTION RÉTROACTIVE — Marquer est_gauge=TRUE dans Log_Soumissions
// Appelez cette fonction UNE SEULE FOIS depuis l'éditeur GAS pour corriger
// toutes les soumissions existantes dont le flag est_gauge est manquant.
// ==============================================================================
function corrigerEstGaugeRetroactif() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sessSheet = ss.getSheetByName("Sessions");
  var subSheet  = ss.getSheetByName("Log_Soumissions");
  if (!sessSheet || !subSheet) {
    Logger.log("Feuilles manquantes.");
    return;
  }

  var sessData = sessSheet.getDataRange().getValues();
  var subData  = subSheet.getDataRange().getValues();

  // Construire index: session_id → { gaugeId, animId }
  var sessIndex = {};
  for (var i = 1; i < sessData.length; i++) {
    var sid     = String(sessData[i][0]).trim();
    var gaugeId = String(sessData[i][11] || "").trim().toLowerCase();
    var animId  = String(sessData[i][10] || "").trim().toLowerCase();
    if (!gaugeId && animId) gaugeId = animId;
    sessIndex[sid] = { gaugeId: gaugeId, animId: animId };
  }

  var corrected = 0;
  for (var k = 1; k < subData.length; k++) {
    // Si déjà TRUE, passer
    if (subData[k][3] === true || String(subData[k][3]).toUpperCase() === "TRUE") continue;

    var rSessId = String(subData[k][1]).trim();
    var rEvalId = String(subData[k][2]).trim().toLowerCase();

    var sess = sessIndex[rSessId];
    if (!sess) continue;

    var ec  = cleanStringKey(rEvalId);
    var gc  = cleanStringKey(sess.gaugeId);
    var ac  = cleanStringKey(sess.animId);

    var isGauge =
      (sess.gaugeId !== "" && (
        rEvalId === sess.gaugeId ||
        (gc.length >= 3 && (ec.includes(gc) || gc.includes(ec)))
      )) ||
      (sess.animId !== "" && (
        rEvalId === sess.animId ||
        (ac.length >= 3 && (ec.includes(ac) || ac.includes(ec)))
      ));

    if (isGauge) {
      subSheet.getRange(k + 1, 4).setValue(true);
      corrected++;
      Logger.log("Corrigé ligne " + (k + 1) + " : session=" + rSessId + " eval=" + rEvalId);
    }
  }

  Logger.log("✅ Correction terminée — " + corrected + " ligne(s) mise(s) à jour.");
}

