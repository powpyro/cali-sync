# 🚀 Cali-Sync — Documentation de Présentation

## 📌 Executive Summary
**Cali-Sync** est une plateforme SaaS de nouvelle génération dédiée à la **calibration qualité**, au **contrôle de conformité** et à l'**alignement des évaluations** au sein des centres de relation client et directions qualité.

Conçu pour remplacer les tableurs Excel manuels et les processus déclaratifs fragmentés, **Cali-Sync** centralise le flux d'évaluation, synchronise l'écoute audio en direct, calcule instantanément la divergence entre les évaluations et offre une console de projection live (**Cockpit**) pour arbitrer les écarts en temps réel.

---

## 🔍 1. Contexte & Enjeux Industriels

Dans les centres de contacts (Service Client, Support Technique, Vente à Distance), la qualité de la relation client repose sur des **grilles d'évaluation** (telles que la grille GENII) comportant jusqu'à 181 critères précis.

Pour garantir l'équité des évaluations et éliminer la subjectivité entre les différents managers ou évaluateurs qualité, les entreprises organisent des **sessions de calibration (ou de calibrage)** :
1. Plusieurs évaluateurs écoutent **le même enregistrement d'appel**.
2. Chaque évaluateur note l'appel indépendamment sur la grille de référence.
3. Un évaluateur référent (**Évaluateur Gauge**) établit la note étalon.
4. Une réunion de débriefing réunit l'équipe pour aligner les notations et arbitrer les écarts.

---

## ⚠️ 2. La Problématique Existante (Les Frustrations Métier)

Sans un outil spécialisé comme **Cali-Sync**, le processus de calibration se heurte à des verrous majeurs :

| Problème / Douleur Métier | Impact Opérationnel |
| :--- | :--- |
| **Silos de données & Fichiers Excel** | Multiplicité des versions de fichiers Excel, erreurs de formules, ressaisies manuelles fastidieuses. |
| **Perte de temps en réunion** | Les débriefings durent des heures à débattre d'items où tout le monde est d'accord, faute de lisibilité instantanée sur les réelles divergences. |
| **Subjectivité & Dérive des critères** | Absence de vision comparative immédiate entre la réponse d'un évaluateur et la référence (Gauge). |
| **Gestion audio complexe** | Difficulté à synchroniser l'écoute audio et le minutage précis des écarts ou fautes de conformité. |
| **Absence de suivi temporel & Délais dépassés** | Évaluations rendues en retard, absence de verrouillage automatique après les dates limites (ex: 72h max). |
| **Perte de données lors de la saisie** | Rafraîchissements de page ou déconnexions accidentelles provoquant la perte de grilles longues. |

---

## 🎯 3. Le But de l'Application & la Solution Cali-Sync

**Cali-Sync** a été développé avec un objectif clair : **Digitaliser, automatiser et fluidifier 100% du cycle de calibration qualité.**

### Les piliers de la solution :
- **Vérité Unique** : Une base de données centralisée (Google Sheets + Apps Script + Frontend React PWA).
- **Consensus Visuel Instantané** : Un écran de projection **Cockpit Live** qui isole automatiquement les items divergents et cache les items unanimes.
- **Rigueur Opérationnelle** : Verrouillage automatique selon les délais, persistance des brouillons et traçabilité absolue.

---

## 🛠️ 4. Matrice Fonctionnalités vs Problèmes Résolus

| Problématique | Fonctionnalité Cali-Sync | Bénéfice Apporté |
| :--- | :--- | :--- |
| **Gestion des Grilles complexes (181 items N1..N4)** | **Formulaire d'Évaluation Hiérarchique 4 Niveaux** | Navigation fluide par catégories, boutons instantanés **Yes / No / N.A.**, champ de commentaire d'imputation obligatoire pour chaque écart. |
| **Écoute Audio éclatée ou difficile** | **Lecteur Audio Intégré & Streaming Google Drive** | Player HTML5 intégré avec conversion directe des liens Google Drive, vitesse modifiable (1x à 2x), et insertion automatique du timestamp `[MM:SS]` dans les commentaires. |
| **Débats interminables en débriefing** | **Cockpit Live & Showdown d'Arbitrage** | Projection en direct identifiant 100% d'accord unanime vs divergences. Arbitrage en 1 clic par l'animateur. |
| **Perte de saisie en cas de coupure/retour** | **Persistance Locale des Brouillons (`localStorage`)** | Sauvegarde en temps réel. Cliquer sur "Retour" ou rafraîchir la page n'efface jamais le travail entamé. |
| **Problème de sécurité / Accès non contrôlés** | **Authentification Dynamique & Gestion des Rôles** | Connexion épurée sans PIN hardcodé. Rôles dynamiques (*Admin*, *Animateur*, *Évaluateur*, *Gauge*) modifiables en 1 clic. |
| **Absence de persistance après rafraîchissement** | **Persistance de Session Utilisateur** | La session reste active au rafraîchissement (`F5` / `Cmd+R`) avec un bouton **Déconnexion** explicite. |
| **Création lourde de nouvelles grilles** | **Studio de Templates & Grille GENII** | Création, duplication en 0.2s, version anglaise 100% traduite, réordonnancement par flèches ⬆️/⬇️ et suppression de grilles. |
| **Rapports et synthèse post-session** | **Génération PDF Automatique Google Drive & KPI Admin** | Rapport PDF d'audit exportable en 1 clic et tableau de bord KPI d'administration. |

---

## 🎨 5. Ergonomie & Design System (Expérience Utilisateur Premium)

Cali-Sync intègre un **Design System modernisé** :
- **Mode Sombre (Dark Mode) & Mode Clair High-Contrast** : Commutation instantanée avec persistance du choix.
- **Micro-animations & Retours Visuels** : Boutons teintés, badges d'état couleur (Teal, Emerald, Rose, Amber), animations de confettis lors des arbitrages réussis.
- **Responsive & Accessible** : Conçu pour fonctionner aussi bien sur ordinateurs de bureau, tablettes que sur écrans de projection en salle de réunion.

---

## 📈 6. ROI & Valeur Ajoutée pour l'Entreprise

1. **Gain de Temps Débriefing : -50%**
   Les réunions de calibration se concentrent uniquement sur les vraies divergences mises en évidence par le Cockpit.
2. **Homogénéité de la Notation : +100%**
   Élimination de la subjectivité grâce à la confrontation directe avec la jauge étalon.
3. **Zéro Perte de Données**
   Sauvegarde automatique locale et hébergement cloud sécurisé.
4. **Prise en Main Immédiate**
   Interface intuitive ne nécessitant aucune formation préalable pour les évaluateurs.
