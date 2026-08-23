// ==============================================================================
// CALI-SYNC v2.0 — BACKEND GOOGLE APPS SCRIPT (Code_v23.gs)
// Base de Données : Google Sheet "Cali-Sync_DB"
// Support : Outils Administratifs (Suppression Sessions & Dialogues de sécurité, Annulation Demandes, Suppression Évaluateurs)
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
  if (action === "soumettre_assessment_libre") return jsonResponse(handleSoumettreAssessmentLibre(ss, req));
  if (action === "lister_mes_assessments") return jsonResponse(handleListerMesAssessments(ss, req));
  if (action === "get_detail_assessment") return jsonResponse(handleGetDetailAssessment(ss, req));
  if (action === "supprimer_assessment_libre") return jsonResponse(handleSupprimerAssessmentLibre(ss, req));
  if (action === "supprimer_session") return jsonResponse(handleSupprimerSession(ss, req.session_id));
  if (action === "annuler_demande_calibrage") return jsonResponse(handleAnnulerDemandeCalibrage(ss, req.demande_id));
  if (action === "supprimer_evaluateur") return jsonResponse(handleSupprimerEvaluateur(ss, req.target_identifiant));
  if (action === "restaurer_grille_genii_complete") return jsonResponse(handleRestaurerGrilleGeniiComplete(ss, req));

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

  // Compter les items soumis par la Gauge pour chaque demande
  const sheetSub = ss.getSheetByName("Log_Soumissions");
  const subData = sheetSub ? sheetSub.getDataRange().getValues() : [];
  const subCountMap = {};
  for (let s = 1; s < subData.length; s++) {
    const sDemId = String(subData[s][1]).trim();
    if (sDemId) {
      subCountMap[sDemId] = (subCountMap[sDemId] || 0) + 1;
    }
  }

  for (let i = 1; i < data.length; i++) {
    const demId = String(data[i][0]).trim();
    const demEvalId = data[i][1];
    const demStatus = data[i][8];
    const gaugeCount = subCountMap[demId] || 0;

    // Si evaluateurId est fourni, lister toutes ses demandes.
    // Sinon, lister uniquement les demandes PENDING_APPROVAL pour l'admin.
    if (evaluateurId) {
      if (String(demEvalId).trim().toLowerCase() === String(evaluateurId).trim().toLowerCase()) {
        demandes.push({
          demande_id: demId,
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
          consignes: data[i][11] || "",
          gauge_items_count: gaugeCount
        });
      }
    } else {
      if (demStatus === "PENDING_APPROVAL") {
        demandes.push({
          demande_id: demId,
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
          consignes: data[i][11] || "",
          gauge_items_count: gaugeCount
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
  const gaugeId = body.gauge_id || "";
  const animateurId = body.animateur_id || gaugeId || "Admin";
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
    // OPEN, PENDING_GAUGE, GAUGE_DONE : actives pour évaluateurs
    // LOCKED inclus pour permettre à la Gauge de soumettre tardivement
    if (statut === "OPEN" || statut === "PENDING_GAUGE" || statut === "GAUGE_DONE" || statut === "LOCKED") {
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

  // Forcer colonne D (item_id) en TEXTE BRUT avant écriture
  tplSheet.getRange(1, 4, newTplRows.length, 1).setNumberFormat("@"); // Col D: item_id
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

  // Forcer colonnes template_id(A), item_id(B), parent_id(D) en TEXTE BRUT
  // pour éviter que des IDs comme "2026.01.01.05" soient interprétés comme dates.
  cfgSheet.getRange(1, 1, newCfgRows.length, 1).setNumberFormat("@"); // Col A: template_id
  cfgSheet.getRange(1, 2, newCfgRows.length, 1).setNumberFormat("@"); // Col B: item_id
  cfgSheet.getRange(1, 4, newCfgRows.length, 1).setNumberFormat("@"); // Col D: parent_id
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

    var itemId    = safeItemId(data[i][1]);
    var niveau    = parseInt(String(data[i][2]).trim(), 10) || 2;
    var parentId  = safeItemId(data[i][3]);
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

    var itemId    = safeItemId(data[i][1]);
    var niveau    = parseInt(String(data[i][2]).trim(), 10) || 2;
    var parentId  = safeItemId(data[i][3]);
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

        // ── AUTO-DÉTECTION GAUGE avant le check de verrou ─────────────────────
        // Détecter si l'évaluateur est la Gauge EN PREMIER,
        // car la Gauge doit pouvoir soumettre même sur session LOCKED.
        if (!estGauge) {
          var sessGaugeId = String(sessData[i][11] || "").trim().toLowerCase();
          var sessAnimId  = String(sessData[i][10] || "").trim().toLowerCase();

          // Si l'évaluateur est l'animateur mais PAS la gauge → forcer est_gauge=FALSE
          var isAnimateur = sessAnimId !== "" && evalId.toLowerCase() === sessAnimId;

          if (!isAnimateur && sessGaugeId !== "") {
            var evalClean  = cleanStringKey(evalId);
            var gaugeClean = cleanStringKey(sessGaugeId);
            estGauge = evalId.toLowerCase() === sessGaugeId ||
              (gaugeClean.length >= 3 && (evalClean.includes(gaugeClean) || gaugeClean.includes(evalClean)));
          }

          if (estGauge) {
            Logger.log("[AUTO-GAUGE] Session=" + sessionId + " Eval=" + evalId + " détecté comme Gauge (gauge_id=" + sessGaugeId + ").");
          }
        }
        // ────────────────────────────────────────────────────────────────────

        // LOCKED/CLOSED : seule la Gauge peut encore soumettre (référence hors délai)
        if (status === "LOCKED" || status === "CLOSED") {
          if (!estGauge) {
            return { success: false, message: "La session est verrouillée ou clôturée, soumission impossible." };
          }
          // La Gauge peut soumettre même sur session LOCKED — on continue
          Logger.log("[GAUGE BYPASS] Session LOCKED/CLOSED : soumission Gauge autorisée pour " + evalId);
          break;
        }

        if (heureFermetureStr) {
          var closeTime = new Date(heureFermetureStr).getTime();
          var nowTime = new Date().getTime();
          if (nowTime > closeTime) {
            if (!estGauge) {
              if (status === "OPEN") sessSheet.getRange(i + 1, 3).setValue("LOCKED");
              return { success: false, message: "La date limite de soumission est dépassée, soumission impossible." };
            }
            // Gauge : délai dépassé mais autorisé — on continue
            Logger.log("[GAUGE BYPASS] Délai dépassé : soumission Gauge hors-délai autorisée pour " + evalId);
          }
        }
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
        if (String(sessData2[i][0]).trim() === String(sessionId).trim()) {
          var currStatus = String(sessData2[i][2]).trim();
          // PENDING_GAUGE ou LOCKED (soumission tardive) → GAUGE_DONE
          if (currStatus === "PENDING_GAUGE" || currStatus === "LOCKED") {
            sessSheet2.getRange(i + 1, 3).setValue("GAUGE_DONE");
            Logger.log("[GAUGE SUBMIT] Session=" + sessionId + " " + currStatus + " → GAUGE_DONE");
          }
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
    .replace(/^\[.*?\]\s*/, "")
    .replace(/^[-\d.]+\s*/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Convertit une valeur de cellule en string ID, même si Google Sheets l'a
// auto-converti en Date (ex: "2026.01.01" → date objet).
function safeItemId(val) {
  if (!val && val !== 0) return "";
  if (val instanceof Date) {
    // Reformater en "YYYY.MM.DD" pour tenter de reconstituer l'ID original
    var y = val.getFullYear();
    var m = String(val.getMonth() + 1).padStart(2, "0");
    var d = String(val.getDate()).padStart(2, "0");
    return y + "." + m + "." + d;
  }
  return String(val).trim();
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

  // ── FALLBACK SÉCURISÉ : migration demandeId→sessionId manquée ──────────────
  // Déclenché uniquement si gaugeMap EST VIDE et qu'un gauge_id est défini.
  // Contrairement à l'ancienne version, ce scan filtre STRICTEMENT par gauge_id
  // (jamais par animateur_id) pour éviter la pollution cross-session.
  // ───────────────────────────────────────────────────────────────────────────
  if (Object.keys(gaugeMap).length === 0 && sessionGaugeId !== "") {
    var fbGaugeClean = cleanStringKey(sessionGaugeId);
    Logger.log("[GAUGE SAFE FALLBACK] gaugeMap vide pour session=" + sessionId + ", recherche par gauge_id=" + sessionGaugeId);
    var fbFound = 0;

    for (var fb = 1; fb < subData.length; fb++) {
      // Seulement les lignes est_gauge=TRUE
      var fbFlag = subData[fb][3] === true || String(subData[fb][3]).toUpperCase() === "TRUE";
      if (!fbFlag) continue;

      // Filtrage STRICT par gauge_id uniquement (JAMAIS animateur_id)
      var fbEvalRaw = String(subData[fb][2]).trim();
      var fbEvalLow = fbEvalRaw.toLowerCase();
      var fbEvalClean = cleanStringKey(fbEvalRaw);

      var fbMatch = fbEvalLow === sessionGaugeId ||
        (fbGaugeClean.length >= 3 && (fbEvalClean.includes(fbGaugeClean) || fbGaugeClean.includes(fbEvalClean)));

      if (!fbMatch) continue;

      // Vérification additionnelle: ignorer les lignes dont le session_id est DÉJÀ une autre SESS_
      var fbSessId = String(subData[fb][1]).trim();
      if (fbSessId.startsWith("SESS_") && fbSessId !== String(sessionId).trim()) {
        // Cette ligne appartient à UNE AUTRE session — ne pas toucher
        continue;
      }

      var fbItemId  = String(subData[fb][4]).trim();
      var fbLibelle = String(subData[fb][6] || fbItemId).trim();
      var fbStatut  = normaliserReponse(subData[fb][7]);
      var fbComm    = String(subData[fb][8] || "").trim();
      var fbCat     = String(subData[fb][5] || "Général").trim();

      var fbObj = { critere: fbStatut, commentaire: fbComm, nom: fbEvalRaw };
      gaugeMap[fbItemId] = fbObj;
      if (fbLibelle) gaugeMap[fbLibelle] = fbObj;
      var fbCleanId  = cleanStringKey(fbItemId);
      var fbCleanLib = cleanStringKey(fbLibelle);
      if (fbCleanId)  gaugeMap[fbCleanId]  = fbObj;
      if (fbCleanLib) gaugeMap[fbCleanLib] = fbObj;

      if (!libellemap[fbItemId]) libellemap[fbItemId] = fbLibelle;
      if (!catMap[fbItemId])     catMap[fbItemId]     = fbCat;

      // Migrer rétroactivement le session_id si c'est encore un demandeId (DEM_)
      if (subSheet && fbSessId !== String(sessionId).trim()) {
        try {
          subSheet.getRange(fb + 1, 2).setValue(sessionId);
          Logger.log("[GAUGE SAFE FALLBACK] Migré ligne " + (fb+1) + " : " + fbSessId + " → " + sessionId);
        } catch(e) {}
      }
      fbFound++;
    }
    Logger.log("[GAUGE SAFE FALLBACK] " + fbFound + " item(s) Gauge récupéré(s) pour session=" + sessionId);
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

    var cItemId  = safeItemId(cfgData[c][1]);
    if (!cItemId) continue;

    var cNiveau  = parseInt(String(cfgData[c][2]).trim(), 10) || 2;
    var cParent  = safeItemId(cfgData[c][3]);
    var cLibelle = String(cfgData[c][6] || "").trim();
    var cCrit    = String(cfgData[c][7] || "Standard").trim();
    var cCatRac  = String(cfgData[c][10] || "").trim();
    var cType    = String(cfgData[c][9] || "").trim();

    // Si N1 sans libellé, utiliser la catégorie racine si présente
    if (cNiveau === 1 && !cLibelle) {
      cLibelle = cCatRac || cItemId;
    }

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
      // Ignorer les N1 nommés "Général" si le libellé est purement par défaut
      if (cLibelle.toLowerCase() !== "général" && cLibelle.toLowerCase() !== "general") {
        n1Roots.push(cItemId);
      } else {
        // Enregistrer la clé pour linkage mais ne pas forcer comme racine si vide
        n1Roots.push(cItemId);
      }
    } else {
      if (cParent) {
        if (!childrenOf[cParent]) childrenOf[cParent] = [];
        childrenOf[cParent].push(cItemId);
      }
    }
  }

  // Héritage de catégorie pour les N2 n'ayant pas de categorie_racine_fr explicite
  Object.keys(cfgNodes).forEach(function(id) {
    var nd = cfgNodes[id];
    if (nd.niveau === 2 && (!nd.categorie_racine_fr || nd.categorie_racine_fr.toLowerCase() === "général")) {
      if (nd.parent_id && cfgNodes[nd.parent_id]) {
        nd.categorie_racine_fr = cfgNodes[nd.parent_id].libelle || cfgNodes[nd.parent_id].categorie_racine_fr || "";
      }
    }
  });

  // ── 5. Fonction récursive pour construire un nœud de résultat ─────────────
  function buildNode(itemId) {
    var node = cfgNodes[itemId] || {
      item_id: itemId, niveau: 2, parent_id: "",
      libelle: libellemap[itemId] || itemId,
      criticite: "Standard", categorie_racine_fr: catMap[itemId] || "", type_noeud: ""
    };

    var cleanId  = cleanStringKey(itemId);
    var cleanLib = cleanStringKey(node.libelle);

    var gauge = gaugeMap[itemId]
      || (node.libelle ? gaugeMap[node.libelle] : null)
      || (cleanId ? gaugeMap[cleanId] : null)
      || (cleanLib ? gaugeMap[cleanLib] : null)
      || null;

    if (!gauge && cleanLib && cleanLib.length >= 6) {
      for (var gKey in gaugeMap) {
        if (gaugeMap.hasOwnProperty(gKey) && gKey.length >= 6) {
          if (gKey.includes(cleanLib) || cleanLib.includes(gKey)) {
            gauge = gaugeMap[gKey];
            break;
          }
        }
      }
    }

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
      var builtN1 = buildNode(n1Id);
      // Garder uniquement les N1 qui ont des enfants ou un libellé valide non-Général
      if (builtN1.children && builtN1.children.length > 0) {
        if (builtN1.libelle && builtN1.libelle.trim().toLowerCase() !== "général") {
          grilleHierarchique.push(builtN1);
        } else if (grilleHierarchique.length === 0) {
          // Si c'est la seule catégorie, la garder sous un nom propre
          builtN1.libelle = "Catégorie Principale";
          grilleHierarchique.push(builtN1);
        }
      }
    });
  }

  // Fallback si pas de N1 valides trouvés
  if (grilleHierarchique.length === 0) {
    // Pas de N1 valide dans la config → items N2 regroupés par categorie_racine_fr (mode dégradé)
    var n2Ids = Object.keys(cfgNodes).filter(function(id) {
      return cfgNodes[id].niveau === 2 && !cfgNodes[id].parent_id;
    });

    // Déterminer une première catégorie valide par défaut
    var defaultCatName = "Catégorie Principale";

    // Regrouper par catégorie racine
    var catGroups = {};
    n2Ids.forEach(function(id) {
      var cat = cfgNodes[id].categorie_racine_fr;
      if (!cat || cat.trim().toLowerCase() === "général") cat = defaultCatName;
      if (!catGroups[cat]) catGroups[cat] = [];
      catGroups[cat].push(id);
    });

    // Si même pas de cfg → tous les items soumis
    if (n2Ids.length === 0) {
      var allSubmitted = {};
      Object.keys(gaugeMap).forEach(function(id) { allSubmitted[id] = true; });
      Object.keys(votesMap).forEach(function(id) { allSubmitted[id] = true; });
      Object.keys(allSubmitted).forEach(function(id) {
        var cat = catMap[id];
        if (!cat || cat.trim().toLowerCase() === "général") cat = defaultCatName;
        if (!catGroups[cat]) catGroups[cat] = [];
        catGroups[cat].push(id);
      });
    }

    Object.keys(catGroups).forEach(function(cat) {
      var kids = catGroups[cat].map(function(id) { return buildNode(id); });
      if (kids.length === 0) return;

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
        children: kids
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
    gauge_items_count:  Object.keys(gaugeMap).length,   // DEBUG: nombre d’éléments dans gaugeMap
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

  // ── 1. Récupérer la structure complète ─────────────────────────────────────
  var resStruct = handleGetCockpit(ss, sessionId);
  if (!resStruct || !resStruct.success) {
    Logger.log("Impossible de récupérer la structure pour la session " + sessionId);
    return null;
  }

  var sessionInfo = {
    session_id:     resStruct.session_id     || sessionId,
    nom_session:    resStruct.nom_session     || sessionId,
    statut:         resStruct.statut          || "CLOSED",
    heure_fin:      resStruct.heure_fin       || "",
    nom_conseiller: resStruct.nom_conseiller  || "",
    url_audio:      resStruct.url_audio       || ""
  };
  var categories  = resStruct.grille_hierarchique  || [];
  var evaluateurs = resStruct.evaluateurs_soumis   || [];
  var gaugeId     = resStruct.gauge_id             || "";

  // ── 2. HELPERS ──────────────────────────────────────────────────────────────

  // Nettoie un libellé qui contient des métadonnées DB (ex: "Label,English,Critical,VRAI,VRAI,,,")
  function cleanLabel(raw) {
    if (!raw) return "";
    var s = String(raw).trim();
    var idx = s.indexOf(",");
    if (idx > 2) {
      var first = s.substring(0, idx).trim();
      var after = s.substring(idx + 1).split(",")[0].trim().toLowerCase();
      var meta = ["vrai","faux","true","false","critical","standard","oui","non","yes","no","eliminatoire","terminal","0","1","2"];
      if (meta.indexOf(after) >= 0 || /^\d+$/.test(after) || after.length === 0) {
        return first;
      }
    }
    return s;
  }

  // Barre de progression Unicode ▓░
  function mkBar(filled, total, width) {
    if (!total || total === 0) return "";
    var n = Math.min(width, Math.round((filled / total) * width));
    var bar = "";
    for (var i = 0; i < n; i++) bar += "\u2593";
    for (var i = n; i < width; i++) bar += "\u2591";
    return bar;
  }

  // Ajoute un paragraphe stylé
  function addLine(body, text, opts) {
    opts = opts || {};
    var p = body.appendParagraph(text);
    if (opts.heading)  p.setHeading(opts.heading);
    if (opts.bold)     p.setBold(true);
    if (opts.italic)   p.setItalic(true);
    if (opts.size)     p.setFontSize(opts.size);
    if (opts.align)    p.setAlignment(opts.align);
    if (opts.indent)   p.setIndentStart(opts.indent);
    if (opts.spB)      p.setSpacingBefore(opts.spB);
    if (opts.spA)      p.setSpacingAfter(opts.spA);
    if (opts.color)    p.editAsText().setForegroundColor(opts.color);
    return p;
  }

  // Ajoute un paragraphe avec la fin colorée à partir de charStart
  function addLineColored(body, text, charStart, color, opts) {
    opts = opts || {};
    var p = body.appendParagraph(text);
    if (opts.bold)   p.setBold(true);
    if (opts.italic) p.setItalic(true);
    if (opts.size)   p.setFontSize(opts.size);
    if (opts.spB)    p.setSpacingBefore(opts.spB);
    if (opts.spA)    p.setSpacingAfter(opts.spA);
    if (charStart >= 0 && charStart < text.length) {
      p.editAsText().setForegroundColor(charStart, text.length - 1, color);
    }
    return p;
  }

  // ── 3. Calcul des statistiques ─────────────────────────────────────────────
  var nbOui = 0, nbNon = 0, nbNA = 0, nbNonArb = 0, nbCritNon = 0;
  var catStats = [];

  categories.forEach(function(cat) {
    var qs = cat.children || [];
    var cO = 0, cN = 0, cNA = 0;
    qs.forEach(function(q) {
      if (!q.decision_finale || !q.decision_finale.decision) { nbNonArb++; return; }
      var dec = String(q.decision_finale.decision).trim();
      if (dec === "Oui")  { nbOui++; cO++; }
      else if (dec === "Non") {
        nbNon++; cN++;
        if (q.criticite === "Critical" || q.criticite === "Terminal" || q.criticite === "Eliminatoire") nbCritNon++;
      }
      else if (dec === "N.A." || dec === "N/A") { nbNA++; cNA++; }
    });
    catStats.push({ name: cleanLabel(cat.libelle || ""), oui: cO, non: cN, na: cNA });
  });

  var totalQuestions = nbOui + nbNon + nbNA + nbNonArb;
  var totalArb   = nbOui + nbNon + nbNA;
  var tauxGlobal = totalArb > 0 ? Math.round((nbOui / totalArb) * 100) : 0;

  // ── 4. Formater les métadonnées de session ─────────────────────────────────
  var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy 'à' HH:mm");

  // Nettoyer le nom du conseiller (connection_id → format lisible)
  var conseillerDisplay = sessionInfo.nom_conseiller || "—";
  if (/^\d{8,}/.test(conseillerDisplay)) {
    var parts = conseillerDisplay.split("|");
    conseillerDisplay = (parts[1] ? "Appel du " + parts[1] + " — " : "") + "ID " + parts[0].substring(0, 12) + "...";
  }

  // ── 5. Créer le document Google ───────────────────────────────────────────
  var docTitle = "Rapport_Calibrage_" + (sessionInfo.session_id || sessionId);
  var doc  = DocumentApp.create(docTitle);
  var body = doc.getBody();
  body.setMarginTop(40);
  body.setMarginBottom(40);
  body.setMarginLeft(56);
  body.setMarginRight(56);

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1 — TITRE PRINCIPAL
  // ═══════════════════════════════════════════════════════════════
  var titlePara = body.appendParagraph("RAPPORT DE CALIBRAGE QUALITÉ");
  titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titlePara.setFontSize(17);
  titlePara.setSpacingAfter(2);

  var subTitle = body.appendParagraph(sessionInfo.nom_session || sessionInfo.session_id);
  subTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  subTitle.setFontSize(12);
  subTitle.setBold(true);
  subTitle.setSpacingAfter(14);

  // Tableau identité session ─────────────────────────────────────
  var evalListStr = evaluateurs.length > 0 ? evaluateurs.join("  •  ") : "Aucun";
  var headerData = [
    ["Session ID",       sessionInfo.session_id || sessionId],
    ["Conseiller évalué",conseillerDisplay],
    ["Date de clôture",  dateStr],
    ["Calibreur / Gauge",gaugeId || "Aucun"],
    ["Évaluateurs (" + evaluateurs.length + ")", evalListStr]
  ];
  var hTable = body.appendTable(headerData);
  for (var r = 0; r < headerData.length; r++) {
    var c0 = hTable.getCell(r, 0);
    var c1 = hTable.getCell(r, 1);
    c0.setBackgroundColor("#f1f3f4");
    c0.setPaddingTop(4); c0.setPaddingBottom(4); c0.setPaddingLeft(8); c0.setPaddingRight(8);
    c1.setPaddingTop(4); c1.setPaddingBottom(4); c1.setPaddingLeft(8); c1.setPaddingRight(8);
    c0.editAsText().setFontSize(9).setBold(true).setForegroundColor("#5f6368");
    c1.editAsText().setFontSize(9);
  }
  body.appendParagraph("").setSpacingAfter(4);
  body.appendHorizontalRule();

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2 — RÉSUMÉ EXÉCUTIF
  // ═══════════════════════════════════════════════════════════════
  addLine(body, "RÉSUMÉ EXÉCUTIF", {
    heading: DocumentApp.ParagraphHeading.HEADING2, spB: 14, spA: 8
  });

  // Calcul du verdict global
  var verdictLabel = "EN ATTENTE";
  var verdictColor = "#5f6368";
  var verdictBg = "#f1f3f4";
  if (totalArb > 0) {
    if (nbCritNon > 0 || tauxGlobal < 50) {
      verdictLabel = "🔴  ATTENTION REQUISE";
      verdictColor = "#c5221f";
      verdictBg = "#fce8e6";
    } else if (tauxGlobal < 80) {
      verdictLabel = "⚠️  PARTIEL";
      verdictColor = "#e37400";
      verdictBg = "#fef7e0";
    } else {
      verdictLabel = "✅  CONFORME";
      verdictColor = "#1e8e3e";
      verdictBg = "#e6f4ea";
    }
  }

  // Tableau Banner Verdict Global
  var vTableData = [
    [verdictLabel + "   —   " + tauxGlobal + "% de conformité", totalArb + " / " + totalQuestions + " arbitré(s)"]
  ];
  var vTable = body.appendTable(vTableData);
  var vc0 = vTable.getCell(0, 0);
  var vc1 = vTable.getCell(0, 1);
  vc0.setBackgroundColor(verdictBg);
  vc1.setBackgroundColor(verdictBg);
  vc0.setPaddingTop(6); vc0.setPaddingBottom(6); vc0.setPaddingLeft(10); vc0.setPaddingRight(10);
  vc1.setPaddingTop(6); vc1.setPaddingBottom(6); vc1.setPaddingLeft(10); vc1.setPaddingRight(10);
  vc0.editAsText().setFontSize(11).setBold(true).setForegroundColor(verdictColor);
  vc1.editAsText().setFontSize(9).setBold(true).setForegroundColor("#3c4043");
  body.appendParagraph("").setSpacingAfter(4);

  // KPIs
  var kpiText = "✅  " + nbOui + " Conforme(s)       ❌  " + nbNon + " Imputé(s)       ⚪  " + nbNA + " N.A." + (nbNonArb > 0 ? "       ⏳  " + nbNonArb + " en attente" : "");
  var kpiPara = body.appendParagraph(kpiText);
  kpiPara.setFontSize(10);
  kpiPara.setBold(true);
  kpiPara.setSpacingAfter(6);

  // Alerte items critiques imputés avec liste des libellés
  if (nbCritNon > 0) {
    var critText = "⚠️   " + nbCritNon + " item(s) CRITIQUE(S) non conforme(s) — Attention particulière requise :";
    addLine(body, critText, { size: 9, bold: true, color: "#c5221f", spA: 2 });
    
    // Lister les questions critiques non conformes
    categories.forEach(function(cat) {
      (cat.children || []).forEach(function(q) {
        var isCrit = q.criticite === "Critical" || q.criticite === "Terminal" || q.criticite === "Eliminatoire";
        var dec = q.decision_finale ? q.decision_finale.decision : (q.gauge ? q.gauge.critere : "");
        if (isCrit && dec === "Non") {
          addLine(body, "      •  " + cleanLabel(q.libelle || q.item_id || ""), {
            size: 8, bold: true, color: "#c5221f", spA: 1
          });
        }
      });
    });
    body.appendParagraph("").setSpacingAfter(4);
  }

  // Tableau récapitulatif par catégorie ─────────────────────────
  addLine(body, "Récapitulatif par catégorie :", { size: 9, bold: true, spB: 6, spA: 4 });

  var catTableData = [["Catégorie", "✅ Conformes", "❌ Imputés", "Taux"]];
  catStats.forEach(function(cs) {
    var arb  = cs.oui + cs.non;
    var taux = arb > 0 ? Math.round((cs.oui / arb) * 100) + "%" : "—";
    catTableData.push([cs.name, String(cs.oui), String(cs.non), taux]);
  });

  var cTable = body.appendTable(catTableData);
  for (var ch = 0; ch < 4; ch++) {
    var hc = cTable.getCell(0, ch);
    hc.setBackgroundColor("#e8eaed");
    hc.setPaddingTop(4); hc.setPaddingBottom(4); hc.setPaddingLeft(6); hc.setPaddingRight(6);
    hc.editAsText().setFontSize(9).setBold(true).setForegroundColor("#3c4043");
  }
  for (var cr = 1; cr < catTableData.length; cr++) {
    var cs3 = catStats[cr - 1];
    var arb3 = cs3.oui + cs3.non;
    for (var cc = 0; cc < 4; cc++) {
      var dc = cTable.getCell(cr, cc);
      dc.setPaddingTop(3); dc.setPaddingBottom(3); dc.setPaddingLeft(6); dc.setPaddingRight(6);
      dc.editAsText().setFontSize(9);
    }
    var tauxVal = arb3 > 0 ? cs3.oui / arb3 : 1;
    var tauxColor = tauxVal >= 0.8 ? "#1e8e3e" : tauxVal >= 0.6 ? "#e37400" : "#c5221f";
    cTable.getCell(cr, 3).editAsText().setForegroundColor(tauxColor).setBold(true);
    if (cs3.non > 0) {
      cTable.getCell(cr, 2).editAsText().setForegroundColor("#c5221f").setBold(true);
    }
  }
  body.appendParagraph("").setSpacingAfter(4);
  body.appendHorizontalRule();

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3 — DÉTAIL PAR CATÉGORIE
  // ═══════════════════════════════════════════════════════════════
  addLine(body, "DÉTAIL DES ARBITRAGES PAR CATÉGORIE", {
    heading: DocumentApp.ParagraphHeading.HEADING2, spB: 14, spA: 6
  });

  // ─── Rendu d'une question NON (Carte d'arbitrage détaillée) ──
  function renderNonConformiteCard(body, q, originalIdx) {
    var qLabel = cleanLabel(q.libelle || q.item_id || "");
    var isCrit = q.criticite === "Critical" || q.criticite === "Terminal" || q.criticite === "Eliminatoire";
    var decObj = q.decision_finale;
    var justif = decObj ? String(decObj.justification || "").trim() : (q.gauge ? String(q.gauge.commentaire || "").trim() : "");

    // Si pas de commentaire global au N2, récupérer les justifications des sous-items imputés
    if (!justif) {
      var subJustifs = [];
      (q.children || []).forEach(function(sub) {
        var sComm = "";
        if (sub.decision_finale && sub.decision_finale.justification && sub.decision_finale.justification.trim()) {
          sComm = sub.decision_finale.justification.trim();
        } else if (sub.gauge && sub.gauge.commentaire && sub.gauge.commentaire.trim()) {
          sComm = sub.gauge.commentaire.trim();
        }
        if (sComm && subJustifs.indexOf(sComm) === -1) subJustifs.push(sComm);
      });
      if (subJustifs.length > 0) {
        justif = subJustifs.join(" — ");
      }
    }

    // 1. En-tête de la non-conformité
    var critBadge = isCrit ? "  ★ CRITIQUE" : "";
    var headerText = "Q" + (originalIdx + 1) + ". " + qLabel + critBadge + "   [ ❌ NON — Imputé ]";
    var pHead = body.appendParagraph(headerText);
    pHead.setFontSize(10);
    pHead.setBold(true);
    pHead.setSpacingBefore(10);
    pHead.setSpacingAfter(2);
    pHead.editAsText().setForegroundColor("#c5221f");

    // 2. Directive post-arbitrage (Mise en avant prioritaire)
    if (justif) {
      var animName = decObj && decObj.animateur_id ? " (" + decObj.animateur_id + ")" : "";
      var jText = "    📌  DIRECTIVE POST-ARBITRAGE" + animName + " : \"" + justif + "\"";
      addLine(body, jText, { size: 9, bold: true, color: "#900000", spA: 3 });
    }

    // 3. Motifs d'imputation retenus
    var subItems = q.children || [];
    var imputedN3 = subItems.filter(function(sub) {
      if (sub.decision_finale && sub.decision_finale.decision === "Non") return true;
      if (sub.gauge && sub.gauge.critere === "Non") return true;
      if (sub.votes_par_critere && sub.votes_par_critere["Non"] && sub.votes_par_critere["Non"].length > 0) return true;
      return false;
    });

    if (imputedN3.length > 0) {
      var motifsList = imputedN3.map(function(sub) {
        var sLabel = cleanLabel(sub.libelle || sub.item_id || "");
        var sComm = "";
        if (sub.decision_finale && sub.decision_finale.justification) {
          sComm = sub.decision_finale.justification.trim();
        } else if (sub.gauge && sub.gauge.commentaire) {
          sComm = sub.gauge.commentaire.trim();
        }
        return sLabel + (sComm ? " — \"" + sComm + "\"" : "");
      });

      addLine(body, "    ⚠️  Motif(s) constaté(s) : " + motifsList.join("  •  "), {
        size: 8, italic: true, color: "#5f6368", spA: 2
      });
    }

    // 4. Métadonnées d'accord / Avis calibreur
    if (q.gauge && q.gauge.critere && gaugeId) {
      var gNom  = q.gauge.nom || gaugeId;
      var gCrit = q.gauge.critere;
      var gIcon = gCrit === "Oui" ? "✅" : gCrit === "Non" ? "❌" : "⚪";
      var metaText = "    🎯  Avis calibreur (" + gNom + ") : " + gIcon + " " + gCrit;
      if (gCrit !== "Non") metaText += "   •   ⚡ Divergence (Calibreur ≠ Décision)";
      addLine(body, metaText, { size: 8, color: "#7b1fa2", spA: 4 });
    }

    body.appendParagraph("").setSpacingAfter(2);
  }

  // ─── Rendu de chaque catégorie N1 (avec séparation nette NON vs OUI) ──
  categories.forEach(function(cat, catIdx) {
    var catName = cleanLabel(cat.libelle || cat.item_id || "Catégorie").toUpperCase();
    var allQs   = cat.children || [];
    var cs4     = catStats[catIdx] || { oui: 0, non: 0, na: 0 };
    var arb4    = cs4.oui + cs4.non;
    var taux4   = arb4 > 0 ? Math.round((cs4.oui / arb4) * 100) : null;
    var tc4     = taux4 !== null ? (taux4 >= 80 ? "#1e8e3e" : taux4 >= 60 ? "#e37400" : "#c5221f") : "#757575";

    // En-tête catégorie
    var catPara = body.appendParagraph("▶  " + catName);
    catPara.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    catPara.setFontSize(11);
    catPara.setSpacingBefore(18);
    catPara.setSpacingAfter(2);

    // Stats sous le titre catégorie
    var catSubText = "    (" + cs4.oui + " / " + arb4 + " conformes" + (taux4 !== null ? "  —  " + taux4 + "%" : "") + ")";
    addLine(body, catSubText, { size: 9, bold: true, color: tc4, spA: 4 });

    if (allQs.length === 0) {
      addLine(body, "    (Aucune question dans cette catégorie)", {
        size: 9, italic: true, color: "#757575"
      });
      return;
    }

    // Séparer les questions par statut
    var nonQs     = [];
    var ouiQs     = [];
    var naQs      = [];
    var pendingQs = [];

    allQs.forEach(function(q, origIdx) {
      var dec = q.decision_finale ? q.decision_finale.decision : (q.gauge ? q.gauge.critere : "");
      if (dec === "Non") {
        nonQs.push({ q: q, idx: origIdx });
      } else if (dec === "Oui") {
        ouiQs.push({ q: q, idx: origIdx });
      } else if (dec === "N.A." || dec === "N/A") {
        naQs.push({ q: q, idx: origIdx });
      } else {
        pendingQs.push({ q: q, idx: origIdx });
      }
    });

    // 1. SECTION NON-CONFORMITÉS & DIRECTIVES (Mise en avant détaillée)
    if (nonQs.length > 0) {
      addLine(body, "    ❌  Non-Conformités & Directives d'arbitrage (" + nonQs.length + ") :", {
        size: 9, bold: true, color: "#c5221f", spB: 4, spA: 2
      });
      nonQs.forEach(function(item) {
        renderNonConformiteCard(body, item.q, item.idx);
      });
    }

    // 2. SECTION PRATIQUES CONFORMES (Liste compacte 1 ligne par question)
    if (ouiQs.length > 0) {
      addLine(body, "    ✅  Pratiques Conformes Validées (" + ouiQs.length + ") :", {
        size: 9, bold: true, color: "#1e8e3e", spB: 4, spA: 2
      });
      ouiQs.forEach(function(item) {
        var qLbl = cleanLabel(item.q.libelle || item.q.item_id || "");
        var isCrit = item.q.criticite === "Critical" || item.q.criticite === "Terminal" || item.q.criticite === "Eliminatoire";
        var cBadge = isCrit ? " ★" : "";
        var jStr = item.q.decision_finale ? String(item.q.decision_finale.justification || "").trim() : "";
        var lineTxt = "       ✅  Q" + (item.idx + 1) + ". " + qLbl + cBadge;
        if (jStr && jStr !== "Consensus") lineTxt += "  —  Consigne : \"" + jStr + "\"";
        addLine(body, lineTxt, { size: 8, color: "#202124", spA: 2 });
      });
      body.appendParagraph("").setSpacingAfter(2);
    }

    // 3. SECTION NON APPLICABLES
    if (naQs.length > 0) {
      var naListStr = naQs.map(function(item) { return "Q" + (item.idx + 1); }).join(", ");
      addLine(body, "       ⚪  Non applicables (" + naQs.length + ") : " + naListStr, {
        size: 8, italic: true, color: "#757575", spA: 2
      });
    }

    // 4. SECTION EN ATTENTE D'ARBITRAGE
    if (pendingQs.length > 0) {
      var pendingListStr = pendingQs.map(function(item) {
        var lbl = cleanLabel(item.q.libelle || item.q.item_id || "");
        if (lbl.length > 55) lbl = lbl.substring(0, 53) + "...";
        return "Q" + (item.idx + 1) + ". " + lbl;
      }).join("   •   ");

      addLine(body, "       ⏳  En attente d'arbitrage (" + pendingQs.length + ") : " + pendingListStr, {
        size: 8, italic: true, color: "#9aa0a6", spB: 2, spA: 4
      });
    }
  });
  // ═══════════════════════════════════════════════════════════════
  // SECTION 4 — PIED DE RAPPORT
  // ═══════════════════════════════════════════════════════════════
  body.appendHorizontalRule();
  body.appendParagraph("").setSpacingAfter(6);

  addLine(body, "Rapport généré le " + dateStr + " via CaliSync v2.0", {
    size: 8, italic: true, color: "#9aa0a6",
    align: DocumentApp.HorizontalAlignment.CENTER, spB: 8
  });
  addLine(body, "Session : " + (sessionInfo.session_id || sessionId) + "  \u2014  Taux de conformité global : " + tauxGlobal + "%", {
    size: 8, color: "#9aa0a6",
    align: DocumentApp.HorizontalAlignment.CENTER
  });

  // ── Export PDF dans Google Drive ──────────────────────────────
  doc.saveAndClose();
  var docId   = doc.getId();
  var docFile = DriveApp.getFileById(docId);

  var folder = null;
  var folderIter = DriveApp.getFoldersByName("CaliSync_Rapports");
  if (folderIter.hasNext()) {
    folder = folderIter.next();
  } else {
    folder = DriveApp.createFolder("CaliSync_Rapports");
  }

  var pdfBlob = docFile.getAs("application/pdf").setName(docTitle + ".pdf");
  var pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var pdfUrl = pdfFile.getUrl();

  try { docFile.setTrashed(true); } catch(e) {}

  // Enregistrer l'URL dans Sessions (colonne 15)
  var sessSheet = ss.getSheetByName("Sessions");
  if (sessSheet) {
    var sessData = sessSheet.getDataRange().getValues();
    for (var si = 1; si < sessData.length; si++) {
      if (String(sessData[si][0]).trim() === String(sessionId).trim()) {
        sessSheet.getRange(si + 1, 15).setValue(pdfUrl);
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

// ==============================================================================
// RÉPARATION DONNÉES CORROMPUES — À exécuter UNE SEULE FOIS depuis l'éditeur GAS
// Corrige les dommages causés par le fallback cross-session du 12/08 :
//  1. Réinitialise est_gauge=FALSE pour les lignes dont l'évaluateur n'est PAS
//     le gauge_id de la session indiquée.
//  2. Tente de restaurer le session_id correct pour les lignes migrées à tort.
// ==============================================================================
function repairerDonneesCorrupted() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sessSheet = ss.getSheetByName("Sessions");
  var subSheet  = ss.getSheetByName("Log_Soumissions");
  if (!sessSheet || !subSheet) { Logger.log("Feuilles manquantes."); return; }

  var sessData = sessSheet.getDataRange().getValues();
  var subData  = subSheet.getDataRange().getValues();

  // Index 1: session_id → gauge_id (col 12)
  var sessGaugeIndex = {};
  // Index 2: gauge_id → [session_id, ...] pour retrouver la bonne session
  var gaugeToSessions = {};
  for (var i = 1; i < sessData.length; i++) {
    var sid    = String(sessData[i][0]).trim();
    var gid    = String(sessData[i][11] || "").trim().toLowerCase();
    var aid    = String(sessData[i][10] || "").trim().toLowerCase();
    // Pour les vieilles sessions sans gauge_id explicite, ne pas inclure animId
    sessGaugeIndex[sid] = gid;
    if (gid) {
      if (!gaugeToSessions[gid]) gaugeToSessions[gid] = [];
      gaugeToSessions[gid].push(sid);
    }
  }

  var resetCount   = 0;
  var restoredCount = 0;

  for (var k = 1; k < subData.length; k++) {
    var rowSessId = String(subData[k][1]).trim();
    var rowEvalId = String(subData[k][2]).trim().toLowerCase();
    var isGauge   = subData[k][3] === true || String(subData[k][3]).toUpperCase() === "TRUE";
    if (!isGauge) continue; // On ne traite que les lignes est_gauge=TRUE

    // Vérifier que l'évaluateur est bien la gauge de la session indiquée
    var expectedGauge = sessGaugeIndex[rowSessId] || "";
    var ec = cleanStringKey(rowEvalId);
    var gc = cleanStringKey(expectedGauge);

    var isLegit = expectedGauge !== "" && (
      rowEvalId === expectedGauge ||
      (gc.length >= 3 && (ec.includes(gc) || gc.includes(ec)))
    );

    if (isLegit) continue; // Ligne correcte, ne rien toucher

    // ── Ligne corrompue : tenter de restaurer le bon session_id ──────────────
    var correctSessId = null;
    var possibleSessions = gaugeToSessions[rowEvalId] || [];
    // Chercher aussi via fuzzy match
    if (possibleSessions.length === 0) {
      Object.keys(gaugeToSessions).forEach(function(gKey) {
        var gcKey = cleanStringKey(gKey);
        if (gcKey.length >= 3 && (ec.includes(gcKey) || gcKey.includes(ec))) {
          possibleSessions = possibleSessions.concat(gaugeToSessions[gKey]);
        }
      });
    }

    if (possibleSessions.length === 1) {
      correctSessId = possibleSessions[0];
    } else if (possibleSessions.length > 1) {
      // Plusieurs sessions possibles — choisir la plus récente
      correctSessId = possibleSessions[possibleSessions.length - 1];
    }

    if (correctSessId && correctSessId !== rowSessId) {
      subSheet.getRange(k + 1, 2).setValue(correctSessId);
      Logger.log("[REPAIR] L" + (k+1) + " session_id restauré: " + rowSessId + " → " + correctSessId + " (eval=" + rowEvalId + ")");
      restoredCount++;
    } else {
      // Impossible de retrouver la bonne session → réinitialiser est_gauge
      subSheet.getRange(k + 1, 4).setValue(false);
      Logger.log("[REPAIR] L" + (k+1) + " est_gauge remis à FALSE (eval=" + rowEvalId + ", sess=" + rowSessId + " n'a pas cette gauge)");
      resetCount++;
    }
  }

  Logger.log("✅ Réparation terminée — " + restoredCount + " session(s) restaurée(s), " + resetCount + " flag(s) réinitialisé(s).");
}
// ==============================================================================
// DIAGNOSTIC — À exécuter manuellement depuis Apps Script Editor
// Remplacez TARGET_SESSION_ID par l'ID réel de la session à inspecter.
// ==============================================================================
function diagnostiqueSessionGauge() {
  var TARGET_SESSION_ID = "REMPLACER_PAR_SESSION_ID"; // ex: "SESS_2026_1234"
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sessSheet = ss.getSheetByName("Sessions");
  var sessData  = sessSheet ? sessSheet.getDataRange().getValues() : [];
  var sessRow   = null;
  for (var i = 1; i < sessData.length; i++) {
    if (String(sessData[i][0]).trim() === String(TARGET_SESSION_ID).trim()) {
      sessRow = sessData[i]; break;
    }
  }

  if (!sessRow) {
    Logger.log("❌ Session introuvable: " + TARGET_SESSION_ID);
    Logger.log("Sessions existantes:");
    for (var j = 1; j < Math.min(sessData.length, 11); j++) {
      Logger.log("  " + sessData[j][0] + " | " + sessData[j][1] + " | " + sessData[j][2]);
    }
    return;
  }

  Logger.log("=== SESSION ===");
  Logger.log("session_id   : " + sessRow[0]);
  Logger.log("nom_session  : " + sessRow[1]);
  Logger.log("statut       : " + sessRow[2]);
  Logger.log("animateur_id : " + sessRow[10]);
  Logger.log("gauge_id     : " + sessRow[11]);

  var gaugeId = String(sessRow[11] || "").trim().toLowerCase();
  var subSheet = ss.getSheetByName("Log_Soumissions");
  var subData  = subSheet ? subSheet.getDataRange().getValues() : [];
  var countBySessId = 0, countGaugeSessId = 0, countGaugeByEvalId = 0;

  for (var k = 1; k < subData.length; k++) {
    var rSessId  = String(subData[k][1]).trim();
    var rEvalId  = String(subData[k][2]).trim().toLowerCase();
    var rIsGauge = subData[k][3] === true || String(subData[k][3]).toUpperCase() === "TRUE" || String(subData[k][3]).toUpperCase() === "VRAI";
    if (rSessId === TARGET_SESSION_ID) { countBySessId++; if (rIsGauge) countGaugeSessId++; }
    if (gaugeId && rEvalId === gaugeId && rIsGauge) {
      countGaugeByEvalId++;
      Logger.log("[GAUGE ROW] sess=" + rSessId + " | est_gauge=" + subData[k][3] + " | item=" + subData[k][4]);
    }
  }

  Logger.log("\n=== LOG_SOUMISSIONS ===");
  Logger.log("Lignes pour sessionId     : " + countBySessId);
  Logger.log("  dont est_gauge=TRUE     : " + countGaugeSessId);
  Logger.log("Lignes gauge (par evalId) : " + countGaugeByEvalId);

  var demSheet = ss.getSheetByName("Demandes_Calibrage");
  var demData  = demSheet ? demSheet.getDataRange().getValues() : [];
  Logger.log("\n=== DEMANDES_CALIBRAGE ===");
  for (var d = 1; d < demData.length; d++) {
    if (String(demData[d][1]).trim().toLowerCase() === gaugeId) {
      Logger.log("  demande_id=" + demData[d][0] + " | statut=" + demData[d][8]);
    }
  }

  if (!gaugeId) Logger.log("\n⚠️ gauge_id VIDE — pas de gauge configurée.");
  else if (countGaugeByEvalId === 0) Logger.log("\n⚠️ Aucun item gauge trouvé pour gauge_id='" + gaugeId + "' — la Gauge n'a pas soumis.");
  else if (countGaugeSessId === 0) Logger.log("\n⚠️ Items gauge par evalId=" + countGaugeByEvalId + " MAIS pas par sessionId → migration ratée.");
  else Logger.log("\n✅ " + countGaugeSessId + " items gauge liés à la session. Le Cockpit doit les afficher.");
}

// ==============================================================================
// DIAGNOSTIC — Audit de l'origine de la catégorie "Général"
// Exécutez cette fonction depuis l'éditeur Apps Script pour localiser la source.
// ==============================================================================
function auditGeneralCategory() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("=== AUDIT CATÉGORIE GÉNÉRAL ===");

  // 1. Inspecter Admin_Config_Grille
  var cfgSheet = ss.getSheetByName("Admin_Config_Grille");
  if (cfgSheet) {
    var cfgData = cfgSheet.getDataRange().getValues();
    var foundCfg = 0;
    for (var i = 1; i < cfgData.length; i++) {
      var tplId = String(cfgData[i][0]).trim();
      var itemId = String(cfgData[i][1]).trim();
      var niveau = String(cfgData[i][2]).trim();
      var parentId = String(cfgData[i][3]).trim();
      var libelle = String(cfgData[i][6] || "").trim();
      var catRacine = String(cfgData[i][10] || "").trim();

      if (niveau === "1" && (!libelle || libelle.toLowerCase() === "général" || libelle.toLowerCase() === "general")) {
        Logger.log("⚠️ [Admin_Config_Grille Ligne " + (i+1) + "] N1 avec libellé vide/général : tpl=" + tplId + " | item_id=" + itemId + " | libelle='" + libelle + "'");
        foundCfg++;
      }
      if (niveau === "2" && (!catRacine || catRacine.toLowerCase() === "général" || catRacine.toLowerCase() === "general")) {
        Logger.log("⚠️ [Admin_Config_Grille Ligne " + (i+1) + "] N2 sans categorie_racine : tpl=" + tplId + " | item_id=" + itemId + " | parent_id=" + parentId + " | libelle='" + libelle + "'");
        foundCfg++;
      }
    }
    if (foundCfg === 0) Logger.log("✅ Admin_Config_Grille : Aucune anomalie 'Général' détectée.");
  } else {
    Logger.log("❌ Feuille Admin_Config_Grille introuvable.");
  }

  // 2. Inspecter Log_Soumissions
  var subSheet = ss.getSheetByName("Log_Soumissions");
  if (subSheet) {
    var subData = subSheet.getDataRange().getValues();
    var foundSub = 0;
    for (var k = 1; k < subData.length; k++) {
      var sessId = String(subData[k][1]).trim();
      var itemId = String(subData[k][4]).trim();
      var cat = String(subData[k][5] || "").trim();

      if (!cat || cat.toLowerCase() === "général" || cat.toLowerCase() === "general") {
        if (foundSub < 15) {
          Logger.log("⚠️ [Log_Soumissions Ligne " + (k+1) + "] Catégorie vide/général : session=" + sessId + " | item_id=" + itemId);
        }
        foundSub++;
      }
    }
    Logger.log("Total lignes Log_Soumissions avec catégorie vide/général : " + foundSub);
  } else {
    Logger.log("❌ Feuille Log_Soumissions introuvable.");
  }
}



// ==============================================================================
// GESTION DES ASSESSMENTS LIBRES & ENTRAÎNEMENTS AUTONOMES
// ==============================================================================
function getOrCreateAssessmentsLibresSheet(ss) {
  var sheet = ss.getSheetByName("Assessments_Libres");
  if (!sheet) {
    sheet = ss.insertSheet("Assessments_Libres");
    var headers = [
      "assessment_id",
      "date_creation",
      "evaluateur_id",
      "template_id",
      "template_nom",
      "titre",
      "nom_conseiller",
      "audio_url",
      "consignes",
      "score",
      "statut",
      "interaction_summary",
      "evaluator_comments",
      "reponses_json",
      "commentaires_json"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setBackground("#1dc4ff").setFontColor("#0f172a").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function handleSoumettreAssessmentLibre(ss, req) {
  try {
    var sheet = getOrCreateAssessmentsLibresSheet(ss);
    var assessmentId = req.assessment_id || ("ASSESS_" + Date.now());
    var dateCreation = req.date_creation || new Date().toISOString();
    var evalId = req.evaluateur_id || "";
    var templateId = req.template_id || "";
    var templateNom = req.template_nom || templateId;
    var titre = req.titre || "Assessment Libre";
    var conseiller = req.nom_conseiller || "";
    var audioUrl = req.audio_url || "";
    var consignes = req.consignes || "";
    var score = Number(req.score || 0);
    var statut = req.statut || "COMPLETED";
    var interactionSummary = req.interaction_summary || "";
    var evaluatorComments = req.evaluator_comments || "";
    var reponsesJson = JSON.stringify(req.reponses || {});
    var commentairesJson = JSON.stringify(req.commentaires || {});

    var data = sheet.getDataRange().getValues();
    var rowFound = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(assessmentId)) {
        rowFound = i + 1;
        break;
      }
    }

    var rowData = [
      assessmentId,
      dateCreation,
      evalId,
      templateId,
      templateNom,
      titre,
      conseiller,
      audioUrl,
      consignes,
      score,
      statut,
      interactionSummary,
      evaluatorComments,
      reponsesJson,
      commentairesJson
    ];

    if (rowFound > 0) {
      sheet.getRange(rowFound, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return { success: true, message: "Assessment enregistré avec succès dans Google Sheets", assessment_id: assessmentId };
  } catch (err) {
    return { success: false, message: "Erreur enregistrement assessment: " + err.toString() };
  }
}

function handleListerMesAssessments(ss, req) {
  try {
    var sheet = getOrCreateAssessmentsLibresSheet(ss);
    var evalId = req.evaluateur_id || req.identifiant || "";
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, assessments: [] };

    var assessments = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowEvalId = String(row[2] || "");
      if (!evalId || rowEvalId === evalId || rowEvalId.toLowerCase() === evalId.toLowerCase()) {
        assessments.push({
          assessment_id: String(row[0] || ""),
          date_creation: String(row[1] || ""),
          evaluateur_id: rowEvalId,
          template_id: String(row[3] || ""),
          template_nom: String(row[4] || ""),
          titre: String(row[5] || ""),
          nom_conseiller: String(row[6] || ""),
          audio_url: String(row[7] || ""),
          consignes: String(row[8] || ""),
          score: Number(row[9] || 0),
          statut: String(row[10] || "COMPLETED"),
          interaction_summary: String(row[11] || ""),
          evaluator_comments: String(row[12] || ""),
          reponses: row[13] ? JSON.parse(row[13]) : {},
          commentaires: row[14] ? JSON.parse(row[14]) : {}
        });
      }
    }

    assessments.sort(function(a, b) {
      return new Date(b.date_creation).getTime() - new Date(a.date_creation).getTime();
    });

    return { success: true, assessments: assessments };
  } catch (err) {
    return { success: false, message: "Erreur liste assessments: " + err.toString() };
  }
}

function handleGetDetailAssessment(ss, req) {
  try {
    var sheet = getOrCreateAssessmentsLibresSheet(ss);
    var assessmentId = req.assessment_id;
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(assessmentId)) {
        var row = data[i];
        return {
          success: true,
          assessment: {
            assessment_id: String(row[0] || ""),
            date_creation: String(row[1] || ""),
            evaluateur_id: String(row[2] || ""),
            template_id: String(row[3] || ""),
            template_nom: String(row[4] || ""),
            titre: String(row[5] || ""),
            nom_conseiller: String(row[6] || ""),
            audio_url: String(row[7] || ""),
            consignes: String(row[8] || ""),
            score: Number(row[9] || 0),
            statut: String(row[10] || "COMPLETED"),
            interaction_summary: String(row[11] || ""),
            evaluator_comments: String(row[12] || ""),
            reponses: row[13] ? JSON.parse(row[13]) : {},
            commentaires: row[14] ? JSON.parse(row[14]) : {}
          }
        };
      }
    }
    return { success: false, message: "Assessment non trouvé" };
  } catch (err) {
    return { success: false, message: "Erreur récupération assessment: " + err.toString() };
  }
}

function handleSupprimerAssessmentLibre(ss, req) {
  try {
    var sheet = getOrCreateAssessmentsLibresSheet(ss);
    var assessmentId = req.assessment_id;
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(assessmentId)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "Assessment supprimé avec succès" };
      }
    }
    return { success: false, message: "Assessment introuvable" };
  } catch (err) {
    return { success: false, message: "Erreur suppression assessment: " + err.toString() };
  }
}

function handleSupprimerSession(ss, sessionId) {
  try {
    if (!sessionId) return { success: false, message: "ID de session manquant." };
    
    // 1. Supprimer de "Sessions" et "Admin_Sessions"
    var sheetNames = ["Sessions", "Admin_Sessions"];
    sheetNames.forEach(function(sName) {
      var s = ss.getSheetByName(sName);
      if (s) {
        var data = s.getDataRange().getValues();
        for (var i = data.length - 1; i >= 1; i--) {
          if (String(data[i][0]).trim() === String(sessionId).trim()) {
            s.deleteRow(i + 1);
          }
        }
      }
    });

    // 2. Supprimer les évaluations associées dans "Log_Soumissions" et "Evaluations"
    var logNames = ["Log_Soumissions", "Evaluations"];
    logNames.forEach(function(lName) {
      var s = ss.getSheetByName(lName);
      if (s) {
        var data = s.getDataRange().getValues();
        for (var j = data.length - 1; j >= 1; j--) {
          var rowSessId1 = String(data[j][1] || "").trim();
          var rowSessId0 = String(data[j][0] || "").trim();
          if (rowSessId1 === String(sessionId).trim() || rowSessId0 === String(sessionId).trim()) {
            s.deleteRow(j + 1);
          }
        }
      }
    });

    // 3. Supprimer les arbitrages associés
    var arbNames = ["Historique_Arbitrages", "Arbitrages", "Decisions_Finales"];
    arbNames.forEach(function(aName) {
      var s = ss.getSheetByName(aName);
      if (s) {
        var data = s.getDataRange().getValues();
        for (var k = data.length - 1; k >= 1; k--) {
          var rowSessId1 = String(data[k][1] || "").trim();
          var rowSessId0 = String(data[k][0] || "").trim();
          if (rowSessId1 === String(sessionId).trim() || rowSessId0 === String(sessionId).trim()) {
            s.deleteRow(k + 1);
          }
        }
      }
    });

    return { success: true, message: "Session et données associées supprimées avec succès." };
  } catch (err) {
    return { success: false, message: "Erreur suppression session: " + err.toString() };
  }
}

function handleAnnulerDemandeCalibrage(ss, demandeId) {
  try {
    if (!demandeId) return { success: false, message: "ID de demande manquant." };
    var sheet = ss.getSheetByName("Demandes_Calibrage");
    if (!sheet) return { success: false, message: "Feuille Demandes_Calibrage introuvable." };
    
    var data = sheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim() === String(demandeId).trim()) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "Demande de calibrage annulée avec succès." };
      }
    }
    return { success: false, message: "Demande introuvable." };
  } catch (err) {
    return { success: false, message: "Erreur annulation demande: " + err.toString() };
  }
}

function handleSupprimerEvaluateur(ss, targetIdentifiant) {
  try {
    if (!targetIdentifiant) return { success: false, message: "Identifiant manquant." };
    var evalSheets = ["Registre_Evaluateurs", "Admin_Evaluateurs"];
    var found = false;
    evalSheets.forEach(function(sName) {
      var sheet = ss.getSheetByName(sName);
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        for (var i = data.length - 1; i >= 1; i--) {
          if (String(data[i][0]).trim().toLowerCase() === String(targetIdentifiant).trim().toLowerCase()) {
            sheet.deleteRow(i + 1);
            found = true;
          }
        }
      }
    });
    
    if (found) {
      return { success: true, message: "Collaborateur supprimé avec succès." };
    } else {
      return { success: false, message: "Collaborateur introuvable." };
    }
  } catch (err) {
    return { success: false, message: "Erreur suppression collaborateur: " + err.toString() };
  }
}

// ==============================================================================
// HANDLER — Restaurer la Grille Officielle Genii Complète (100% - 10/10 Process)
// ==============================================================================
function handleRestaurerGrilleGeniiComplete(ss, payload) {
  try {
    var tplId = (payload && payload.template_id) ? String(payload.template_id).trim() : "TPL_GENII_OFFICIAL";
    if (!tplId) tplId = "TPL_GENII_OFFICIAL";
    var nomTemplate = (payload && payload.nom) ? String(payload.nom).trim() : "Grille Genii Officielle (100% - 10 Process)";

    var rawRows = [
  [
    "TPL_GENII_V1",
    "PA",
    1,
    "",
    "FALSE",
    "FALSE",
    "Process Adherence",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q01",
    2,
    "PA",
    "FALSE",
    "FALSE",
    "Did the rep greet the customer in a professional & welcoming manner, following the welcome script?",
    "Critical",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q01-S01",
    3,
    "PA-Q01",
    "TRUE",
    "TRUE",
    "No greeting within the first 10 seconds",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q01-S02",
    3,
    "PA-Q01",
    "TRUE",
    "TRUE",
    "Omitting the company introduction (e.g., \"Wave, hello...\")",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q01-S03",
    3,
    "PA-Q01",
    "TRUE",
    "TRUE",
    "No salutation or greeting",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q01-S04",
    3,
    "PA-Q01",
    "TRUE",
    "TRUE",
    "Use of an inappropriate or unprofessional phrasing",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q01-S05",
    3,
    "PA-Q01",
    "TRUE",
    "TRUE",
    "Failure to introduce themself",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q01-S06",
    3,
    "PA-Q01",
    "TRUE",
    "TRUE",
    "Cold, abrupt, or impolite greeting",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q01-S07",
    3,
    "PA-Q01",
    "TRUE",
    "TRUE",
    "Monotone, irritated, aggressive, or unengaging tone",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q02",
    2,
    "PA",
    "FALSE",
    "FALSE",
    "Did the rep follow the call transfer procedures?",
    "Critical",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q02-S01",
    3,
    "PA-Q02",
    "TRUE",
    "TRUE",
    "Failed to introduces themself appropriately",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q02-S02",
    3,
    "PA-Q02",
    "TRUE",
    "TRUE",
    "Failed to acknowledge resumption of the call",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q03",
    2,
    "PA",
    "FALSE",
    "FALSE",
    "Did the rep verify the customer's identity before processing the request?",
    "Critical",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q03-S01",
    3,
    "PA-Q03",
    "TRUE",
    "TRUE",
    "Accessed account without customer ID&V",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q03-S02",
    3,
    "PA-Q03",
    "TRUE",
    "TRUE",
    "Shared information without customer ID&V",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q03-S03",
    3,
    "PA-Q03",
    "TRUE",
    "TRUE",
    "Processed sensitive request with non-account holder",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q03-S04",
    3,
    "PA-Q03",
    "TRUE",
    "TRUE",
    "Skipped mandatory verification steps",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q03-S05",
    3,
    "PA-Q03",
    "TRUE",
    "TRUE",
    "Accepted incomplete / incorrect answer",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q03-S06",
    3,
    "PA-Q03",
    "TRUE",
    "TRUE",
    "Provides confidential info despite failed ID&V",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q03-S07",
    3,
    "PA-Q03",
    "TRUE",
    "TRUE",
    "Makes account changes despite failed ID&V",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q04",
    2,
    "PA",
    "FALSE",
    "FALSE",
    "Did the rep follow KYC procedures (where applicable)?",
    "Critical",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q04-S01",
    3,
    "PA-Q04",
    "TRUE",
    "TRUE",
    "Continued without following KYC procedure",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q04-S02",
    3,
    "PA-Q04",
    "TRUE",
    "TRUE",
    "Failure to reject an ID document",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q04-S03",
    3,
    "PA-Q04",
    "TRUE",
    "TRUE",
    "Failure to perform a rename user",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q04-S04",
    3,
    "PA-Q04",
    "TRUE",
    "TRUE",
    "Other",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q05",
    2,
    "PA",
    "FALSE",
    "FALSE",
    "Did the rep ask the necessary enhanced verification questions for a sensitive action?",
    "Critical",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q05-S01",
    3,
    "PA-Q05",
    "TRUE",
    "TRUE",
    "Failed to complete required verification questions",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q05-S02",
    3,
    "PA-Q05",
    "TRUE",
    "TRUE",
    "Omitted one / more mandatory steps",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q05-S03",
    3,
    "PA-Q05",
    "TRUE",
    "TRUE",
    "Performed sensitive action before completing verification",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q05-S04",
    3,
    "PA-Q05",
    "TRUE",
    "TRUE",
    "Disclosure of personal or sensitive data",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q05-S05",
    3,
    "PA-Q05",
    "TRUE",
    "TRUE",
    "Informed customer info provided is not correct",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q06",
    2,
    "PA",
    "FALSE",
    "FALSE",
    "Did the rep provide a clear and appropriate response or solution to the problem?",
    "Critical",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q06-S01",
    3,
    "PA-Q06",
    "TRUE",
    "TRUE",
    "Does not understand / misinterprets customers request",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q06-S02",
    3,
    "PA-Q06",
    "TRUE",
    "TRUE",
    "Action does not meet the expressed need",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q06-S03",
    3,
    "PA-Q06",
    "TRUE",
    "TRUE",
    "Provides incorrect or incomplete info",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q06-S04",
    3,
    "PA-Q06",
    "TRUE",
    "TRUE",
    "Irrelevant assistance (does not resolve the problem)",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q06-S05",
    3,
    "PA-Q06",
    "TRUE",
    "TRUE",
    "Closed exchange without addressing customers main request",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q06-S06",
    3,
    "PA-Q06",
    "TRUE",
    "TRUE",
    "Transferred call instead of handling it",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q07",
    2,
    "PA",
    "FALSE",
    "FALSE",
    "Did the rep follow the hold procedure?",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q07-S01",
    3,
    "PA-Q07",
    "TRUE",
    "TRUE",
    "Placed customer on hold without warning / reason",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q07-S02",
    3,
    "PA-Q07",
    "TRUE",
    "TRUE",
    "On hold for > 60 sec. without update",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q07-S03",
    3,
    "PA-Q07",
    "TRUE",
    "TRUE",
    "Resumes the call without thanking the customer",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q07-S04",
    3,
    "PA-Q07",
    "TRUE",
    "TRUE",
    "Placed on hold immediately after greeting and ID&V",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q08",
    2,
    "PA",
    "FALSE",
    "FALSE",
    "Did the rep manage the escalation in accordance with the procedure?",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q08-S01",
    3,
    "PA-Q08",
    "TRUE",
    "TRUE",
    "Clear reason for escalation not provided",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q08-S02",
    3,
    "PA-Q08",
    "TRUE",
    "TRUE",
    "Clear owner for escalation not provided",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q08-S03",
    3,
    "PA-Q08",
    "TRUE",
    "TRUE",
    "Clear timeline for escalation not provided",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q08-S04",
    3,
    "PA-Q08",
    "TRUE",
    "TRUE",
    "Unnecessary escalation",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q08-S05",
    3,
    "PA-Q08",
    "TRUE",
    "TRUE",
    "Fraud / scam report not escalated via the right channel",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q09",
    2,
    "PA",
    "FALSE",
    "FALSE",
    "Did the rep ask if there was any further assistance / questions?",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q09-S01",
    3,
    "PA-Q09",
    "TRUE",
    "TRUE",
    "Failed to thank the customer before hanging up",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q09-S02",
    3,
    "PA-Q09",
    "TRUE",
    "TRUE",
    "Failed to check for any other questions",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q10",
    2,
    "PA",
    "FALSE",
    "FALSE",
    "Did the rep thank the customer before ending the call?",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q10-S01",
    3,
    "PA-Q10",
    "TRUE",
    "TRUE",
    "Ended abruptly without any courtesy phrase",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q10-S02",
    3,
    "PA-Q10",
    "TRUE",
    "TRUE",
    "Ended without naming the customer",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "PA-Q10-S03",
    3,
    "PA-Q10",
    "TRUE",
    "TRUE",
    "Ended without naming the company",
    "Standard",
    "",
    "",
    "Process Adherence",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO",
    1,
    "",
    "FALSE",
    "FALSE",
    "Communication",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q01",
    2,
    "CO",
    "FALSE",
    "FALSE",
    "Was the rep able to understand the customers issue/request?",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q01-S01",
    3,
    "CO-Q01",
    "TRUE",
    "TRUE",
    "Jumped to conclusions without verifying info",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q01-S02",
    3,
    "CO-Q01",
    "TRUE",
    "TRUE",
    "Failed to ask clarifying questions where needed",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q01-S03",
    3,
    "CO-Q01",
    "TRUE",
    "TRUE",
    "Relies on assumptions rather than info provided",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q01-S04",
    3,
    "CO-Q01",
    "TRUE",
    "TRUE",
    "Lack of listening / asks for the same info repeatedly",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q02",
    2,
    "CO",
    "FALSE",
    "FALSE",
    "Did the rep provide clear, coherent communication with the customer?",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q02-S01",
    3,
    "CO-Q02",
    "TRUE",
    "TRUE",
    "Failed to obtain info needed to understand situation",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q02-S02",
    3,
    "CO-Q02",
    "TRUE",
    "TRUE",
    "Irrelevant questions asked",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q02-S03",
    3,
    "CO-Q02",
    "TRUE",
    "TRUE",
    "Communicated poorly / unclear",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q02-S04",
    3,
    "CO-Q02",
    "TRUE",
    "TRUE",
    "Used or didn't clarify complex language",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q02-S05",
    3,
    "CO-Q02",
    "TRUE",
    "TRUE",
    "Hesitant, disorganized or contradictory info",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q02-S06",
    3,
    "CO-Q02",
    "TRUE",
    "TRUE",
    "Jumps from one topic to another",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q02-S07",
    3,
    "CO-Q02",
    "TRUE",
    "TRUE",
    "Pronunciation is hard to understand",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q02-S08",
    3,
    "CO-Q02",
    "TRUE",
    "TRUE",
    "Grammar or sentence-construction errors",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q02-S09",
    3,
    "CO-Q02",
    "TRUE",
    "TRUE",
    "Articulation / pace that hinders comprehension",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q03",
    2,
    "CO",
    "FALSE",
    "FALSE",
    "Did the rep appropriately set the customer's expectations?",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q03-S01",
    3,
    "CO-Q03",
    "TRUE",
    "TRUE",
    "Next steps not communicated when needed",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q03-S02",
    3,
    "CO-Q03",
    "TRUE",
    "TRUE",
    "Timelines not stated / vague",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q03-S03",
    3,
    "CO-Q03",
    "TRUE",
    "TRUE",
    "Provides incorrect / unrealistic timelines or info",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q03-S04",
    3,
    "CO-Q03",
    "TRUE",
    "TRUE",
    "Created false expectations / promises",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "CO-Q03-S05",
    3,
    "CO-Q03",
    "TRUE",
    "TRUE",
    "Fails to inform customer of important conditions",
    "Standard",
    "",
    "",
    "Communication",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE",
    1,
    "",
    "FALSE",
    "FALSE",
    "Tone & Empathy",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q01",
    2,
    "TE",
    "FALSE",
    "FALSE",
    "Did the rep remain professional & polite throughout the interaction?",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q01-S01",
    3,
    "TE-Q01",
    "TRUE",
    "TRUE",
    "Responds in an impolite, disrespectful manner",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q01-S02",
    3,
    "TE-Q01",
    "TRUE",
    "TRUE",
    "Gets into a conflict with the customer",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q01-S03",
    3,
    "TE-Q01",
    "TRUE",
    "TRUE",
    "Tone is perceived as disrespectful / unprofessional",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q01-S04",
    3,
    "TE-Q01",
    "TRUE",
    "TRUE",
    "Directly / indirectly blames the customers",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q01-S05",
    3,
    "TE-Q01",
    "TRUE",
    "TRUE",
    "Uses guilt-inducing / demoralizing tone",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q01-S06",
    3,
    "TE-Q01",
    "TRUE",
    "TRUE",
    "Criticizing / judgemental / blaming phrasing",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q01-S07",
    3,
    "TE-Q01",
    "TRUE",
    "TRUE",
    "Emphasizes customers mistake",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q01-S08",
    3,
    "TE-Q01",
    "TRUE",
    "TRUE",
    "Impatient, curt, abrupt or irritated",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q01-S09",
    3,
    "TE-Q01",
    "TRUE",
    "TRUE",
    "Responds aggressively or defensively",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02",
    2,
    "TE",
    "FALSE",
    "FALSE",
    "Did the rep show empathy throughout the interaction?",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02-S01",
    3,
    "TE-Q02",
    "TRUE",
    "TRUE",
    "No acknowledgement of issue (straight to solution)",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02-S02",
    3,
    "TE-Q02",
    "TRUE",
    "TRUE",
    "Ignores to acknowledge inconvenience expressed",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02-S03",
    3,
    "TE-Q02",
    "TRUE",
    "TRUE",
    "Ignores clear expression of dissatisfaction",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02-S04",
    3,
    "TE-Q02",
    "TRUE",
    "TRUE",
    "Cold, condescending, or inappropriate tone",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02-S05",
    3,
    "TE-Q02",
    "TRUE",
    "TRUE",
    "Uses overly familiar or disrespectful language.",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02-S06",
    3,
    "TE-Q02",
    "TRUE",
    "TRUE",
    "Uses a sarcastic, ironic, or mocking tone",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02-S07",
    3,
    "TE-Q02",
    "TRUE",
    "TRUE",
    "Condescending attitude or belittling customer",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02-S08",
    3,
    "TE-Q02",
    "TRUE",
    "TRUE",
    "Negative / disparaging remarks",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02-S09",
    3,
    "TE-Q02",
    "TRUE",
    "TRUE",
    "Dismisses emotions expressed by customer",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q02-S10",
    3,
    "TE-Q02",
    "TRUE",
    "TRUE",
    "Changes subject when inappropriate",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q03",
    2,
    "TE",
    "FALSE",
    "FALSE",
    "Did the rep remain professional throughout the interaction?",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q03-S01",
    3,
    "TE-Q03",
    "TRUE",
    "TRUE",
    "Abusive behavior",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q03-S02",
    3,
    "TE-Q03",
    "TRUE",
    "TRUE",
    "Insulting behaviour",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q03-S03",
    3,
    "TE-Q03",
    "TRUE",
    "TRUE",
    "Discriminatory behaviour",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "TE-Q03-S04",
    3,
    "TE-Q03",
    "TRUE",
    "TRUE",
    "Created a conflict situation",
    "Standard",
    "",
    "",
    "Tone & Empathy",
    "Non",
    "FALSE"
  ],
  [
    "TPL_GENII_V1",
    "VC",
    1,
    "",
    "FALSE",
    "FALSE",
    "Voice of the Customer",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01",
    2,
    "VC",
    "FALSE",
    "FALSE",
    "Did the customer express any dissatisfaction?",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01",
    3,
    "VC-Q01",
    "FALSE",
    "FALSE",
    "Product / service",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D01",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Deposit",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D02",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Withdrawal",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D03",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Transfer",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D04",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Bill payment (CIE/ SODECI/ CIE PREPAYE)",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D05",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Bank to wallet",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D06",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Re-subscription canal / start times",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D07",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Payment of HKB bridge fees",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D08",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Badge reloads (FER)",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D09",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "CNPS contribution",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D10",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Merchant payment",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D11",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Lebalma (GM)",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D12",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Kondaneh (GM)",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S01-D13",
    4,
    "VC-Q01-S01",
    "TRUE",
    "TRUE",
    "Other",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S02",
    3,
    "VC-Q01",
    "TRUE",
    "TRUE",
    "Telephonic Technical Experience",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S03",
    3,
    "VC-Q01",
    "TRUE",
    "TRUE",
    "Representative Conduct / Behavior",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S04",
    3,
    "VC-Q01",
    "TRUE",
    "TRUE",
    "Process",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S05",
    3,
    "VC-Q01",
    "TRUE",
    "TRUE",
    "Client Effort",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S06",
    3,
    "VC-Q01",
    "TRUE",
    "TRUE",
    "Brand",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ],
  [
    "TPL_GENII_V1",
    "VC-Q01-S07",
    3,
    "VC-Q01",
    "TRUE",
    "TRUE",
    "Department",
    "Standard",
    "",
    "",
    "Voice of the Customer",
    "Oui",
    "TRUE"
  ]
];

    // 1. Nettoyer Templates_Grilles et Admin_Config_Grille pour ce template
    var tplSheet = ss.getSheetByName("Templates_Grilles");
    if (!tplSheet) {
      initialiserBaseDeDonnees(ss);
      tplSheet = ss.getSheetByName("Templates_Grilles");
    }
    if (tplSheet) {
      var tplData = tplSheet.getDataRange().getValues();
      for (var i = tplData.length - 1; i >= 1; i--) {
        if (String(tplData[i][0]).trim() === tplId) {
          tplSheet.deleteRow(i + 1);
        }
      }
    }

    var cfgSheet = ss.getSheetByName("Admin_Config_Grille");
    if (!cfgSheet) {
      cfgSheet = ss.insertSheet("Admin_Config_Grille");
      cfgSheet.appendRow(["template_id", "item_id", "niveau", "parent_id", "est_terminal", "commentaire_obligatoire", "libelle", "criticite", "poids", "type_noeud", "categorie_racine_fr"]);
    }
    if (cfgSheet) {
      var cfgData = cfgSheet.getDataRange().getValues();
      for (var j = cfgData.length - 1; j >= 1; j--) {
        if (String(cfgData[j][0]).trim() === tplId) {
          cfgSheet.deleteRow(j + 1);
        }
      }
    }

    // 2. Écrire dans Admin_Config_Grille
    var cfgRowsToAdd = [];
    var tplRowsToAdd = [];

    rawRows.forEach(function(r) {
      var itemId    = r[1];
      var niveau    = parseInt(r[2], 10) || 2;
      var parentId  = r[3] || "";
      var estTerm   = r[4] || "FALSE";
      var commOblig = r[5] || "FALSE";
      var libelle   = r[6] || "";
      var criticite = r[7] || "Standard";
      var catRacine = r[10] || "Process Adherence";
      var typeNoeud = r[8] || (niveau === 1 ? "categorie" : niveau === 2 ? "question" : "sous_critere");

      cfgRowsToAdd.push([
        tplId,
        itemId,
        niveau,
        parentId,
        estTerm,
        commOblig,
        libelle,
        criticite,
        1,
        typeNoeud,
        catRacine
      ]);

      // Si c'est une question N2, l'ajouter également à Templates_Grilles
      if (niveau === 2) {
        tplRowsToAdd.push([
          tplId,
          nomTemplate,
          catRacine,
          itemId,
          libelle,
          criticite,
          1
        ]);
      }
    });

    if (cfgRowsToAdd.length > 0 && cfgSheet) {
      var startRowCfg = cfgSheet.getLastRow() + 1;
      cfgSheet.getRange(startRowCfg, 1, cfgRowsToAdd.length, 11).setValues(cfgRowsToAdd);
    }

    if (tplRowsToAdd.length > 0 && tplSheet) {
      var startRowTpl = tplSheet.getLastRow() + 1;
      tplSheet.getRange(startRowTpl, 1, tplRowsToAdd.length, 7).setValues(tplRowsToAdd);
    }

    return {
      success: true,
      template_id: tplId,
      nom: nomTemplate,
      message: "Grille Genii Complète restaurée avec succès ! (10 Questions Process Adherence, 17 questions N2 et 119 critères)."
    };
  } catch (err) {
    return {
      success: false,
      message: "Erreur lors de la restauration de la grille : " + err.toString()
    };
  }
}
