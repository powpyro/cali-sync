# 🚀 Cali-Sync — Documentation de Présentation

## 📌 Executive Summary
**Cali-Sync** est une plateforme SaaS de nouvelle génération conçue spécifiquement pour **optimiser et automatiser le processus de calibration qualité**, en complément des outils de gestion d'évaluations existants (tels que l'application **Genii**).

En lieu et place des sessions de calibrage traditionnelles — où l'on déroule une grille vide item par item en débattant au fur et à mesure —, **Cali-Sync** permet aux évaluateurs d'évaluer l'appel au préalable, calcule automatiquement les réelles divergences vis-à-vis de l'évaluation étalon (**Gauge**), projette un **Cockpit Live** axé uniquement sur les points d'écart, et génère un **rapport PDF complet** dès la clôture de la session.

---

## 🔍 1. Contexte & Déroulement Actuel sur l'Application Genii

Dans l'organisation actuelle avec l'application **Genii** :
1. **Évaluation au fil de l'eau** : Les évaluateurs et responsables qualité effectuent leurs grilles d'audit régulières sur l'application Genii.
2. **Absence de visibilité préalable** : Lors d'un calibrage, l'évaluateur n'a pas de vue consolidée ni de visibilité comparative sur son évaluation par rapport à ses pairs avant la réunion.
3. **Déroulé linéaire pendant le débriefing** : La réunion de calibrage consiste aujourd'hui à ouvrir une **évaluation vide** et à la dérouler linéairement, item par item, en discutant et en cochant les réponses au fur et à mesure du débat.
4. **Absence de rapport post-calibrage** : Aucun rapport d'arbitrage ou compte-rendu consolidé n'est généré automatiquement à la fin de la session de calibration sur Genii.

---

## ⚠️ 2. La Problématique Existante (Les Frustrations Métier)

| Limite du Flux Actuel (sur Genii) | Impact Opérationnel & Organisationnel |
| :--- | :--- |
| **Passage en revue item par item** | Perte de temps considérable en réunion à repasser sur des dizaines d'items où tout le monde est d'accord. |
| **Absence de pré-évaluation individuelle** | Impossible d'analyser les résultats des évaluateurs à l'avance pour cibler la préparation du débriefing. |
| **Débat à chaud sur grille vide** | Risque d'influence mutuelle pendant la réunion plutôt qu'une confrontation objective des notations individuelles. |
| **Aucune traçabilité post-calibrage** | Pas de synthèse ni de rapport PDF d'audit produit à la clôture de la session pour capitaliser sur les arbitrages. |
| **Gestion audio déconnectée** | Écoute audio fragmentée sans synchronisation directe avec les commentaires et minutages d'écart. |

---

## 🎯 3. Le But de Cali-Sync & La Solution Apportée

**Cali-Sync** réinvente le calibrage en passant d'un débriefing linéaire passif à un **pilotage ciblé par les divergences**.

```
[ Genii / Application Source ] ➔ [ Pré-Évaluation Individuelle Cali-Sync ] ➔ [ Cockpit Live (Uniquement les Écarts) ] ➔ [ Rapport PDF & Bilan ]
```

### Les 4 étapes clés du flux Cali-Sync :
1. **Évaluation Individuelle Préalable** : Chaque évaluateur saisit sa grille sur Cali-Sync avant ou au début de la session, avec sauvegarde automatique en brouillon et lecteur audio intégré.
2. **Jauge de Référence (Gauge)** : L'évaluateur référent ou la direction qualité valide l'évaluation étalon.
3. **Cockpit Live (Projection des Divergences)** : L'animateur projette l'écran Cockpit qui **masque automatiquement les items 100% unanimes** et **met en lumière uniquement les divergences** à débattre.
4. **Clôture & Rapport PDF Instantané** : Dès la fin du calibrage, un rapport d'audit PDF complet est généré et stocké automatiquement sur Google Drive.

---

## 🛠️ 4. Matrice Comparative : Genii vs Cali-Sync

| Étape du Processus | Processus Actuel (Genii) | Solution Cali-Sync | Bénéfice Immédiat |
| :--- | :--- | :--- | :--- |
| **Préparation** | Grille vide ouverte en réunion | Pré-évaluation individuelle réalisée avant la réunion avec sauvegarde brouillon (`localStorage`) | Évaluation objective sans influence mutuelle |
| **Écoute Audio** | Lecteur externe ou séparé | **Lecteur Audio Intégré & Streaming Google Drive** (vitesse 1x..2x) avec insertion auto du minutage `[MM:SS]` dans les remarques | Minutage précis et écoute fluide pendant la notation |
| **Déroulement de Réunion** | Discussion linéaire item par item (181 critères) | **Cockpit Live de Divergence** : Focus exclusif sur les items en désaccord | **Gain de temps de 50% à 70%** en réunion |
| **Arbitrage** | Saisie manuelle à la volée pendant la réunion | Boutons d'arbitrage en 1 clic par l'animateur (**Yes / No / N.A.**) | Décision de consensus enregistrée en temps réel |
| **Fin de Session** | Aucun rapport généré | **Génération automatique du Rapport PDF** dans Google Drive | Compte-rendu d'audit prêt à l'export immédiat |
| **Droits & Accès** | Rôles fixes | **Gestion Dynamique des Rôles** (*Admin*, *Animateur*, *Évaluateur*, *Gauge*) et persistance de session | Flexibilité totale d'animation selon les sessions |

---

## 🎨 5. Ergonomie & Expérience Utilisateur

- **Interface Moderne & Épurée** : Thème sombre / clair au choix, cartes visuelles à fort contraste.
- **Zéro Perte de Données** : Saisie sécurisée avec persistance locale en cas de déconnexion ou rafraîchissement.
- **Visualisation Clair/Obscur des Accord** : Les items d'accord unanime s'affichent avec un badge vert discret tandis que les divergences clignotent avec un indicateur d'imputation.
