# TypeMind — Product Requirements Document (MVP)

> Statut : brouillon v0.1 — 2026-11-18 — à valider par le fondateur.
> Source : « Conception SaaS dactylographie IA.pdf ».

## 1. Vision

**TypeMind — Learn typing. Your way.**
Une plateforme qui apprend à taper vite, juste et sans regarder le clavier, en faisant travailler l'utilisateur sur des contenus qui l'intéressent, et en adaptant chaque séance à ses difficultés réelles.

Ce qu'on vend n'est pas « on a de l'IA » mais : *TypeMind apprend comment tu tapes, ce que tu aimes et ce que tu veux accomplir, puis adapte chaque séance.*

## 2. Problèmes utilisateurs ciblés par le MVP

| # | Problème | Réponse MVP |
|---|----------|-------------|
| 01 | Exercices répétitifs | Textes par centres d'intérêt (bibliothèque + IA) |
| 02 | Pas de vraie personnalisation | Profil d'apprentissage mis à jour après chaque séance |
| 03 | Motivation qui s'effrite | Objectif quotidien, série (streak), progrès expliqués |
| 04 | Progression incompréhensible | Résultats détaillés + recommandation concrète |
| 05 | Vitesse au détriment de la précision | WPM net, règles « précision d'abord » |
| 07 | Claviers mal gérés | Dispositions déclaratives (US, UK, FR AZERTY, CA-FR CSA, CMS, DE QWERTZ), touches mortes |
| 08 | Erreurs mal expliquées | Touche attendue vs tapée, touches/bigrammes faibles |
| 12 | Perte de continuité | Compte, historique persistant, sauvegarde résistante aux coupures réseau |

Hors MVP : 06-transfert réel (simulateurs pro → V2), 11-mobile (desktop-first assumé).

## 3. Public

Cible déclarée : tous. **Optimisation du lancement : étudiants, adultes, professionnels (≥ 14 ans).**
Les comptes enfants (< 14 ans) exigent un consentement parental (Loi 25 Québec, COPPA, RGPD) et une expérience dédiée : **reportés en V2** (voir DECISIONS.md, ADR-007).

## 4. Parcours MVP

Landing → inscription → onboarding (langue, clavier, expérience, objectifs, intérêts, durée quotidienne) → test de niveau → profil d'apprentissage → séance recommandée → Typing Studio → résultats + recommandation → retour le lendemain.

**Le parcours entier doit fonctionner sans IA** (quota épuisé, fournisseur absent ou en panne).

## 5. Périmètre fonctionnel MVP

| Module | Contenu MVP |
|---|---|
| A. Site marketing | `/`, `/pricing`, `/faq`, `/privacy`, `/terms` ; démo de frappe interactive |
| B. Auth | Inscription, connexion, déconnexion, vérification e-mail, mot de passe oublié (Supabase Auth) |
| C. Onboarding | Assistant multi-étapes, modifiable ensuite dans les paramètres |
| D. Test initial | ~60 s, WPM net/brut, précision, caractères difficiles, niveau provisoire ; second test proposé si résultat peu fiable |
| E. Typing engine | Moteur pur TS, coloration par caractère, Backspace, ponctuation, accents, touches mortes, IME, minuté / longueur fixe, pause, restart, clavier virtuel + doigt recommandé |
| F. Modes | 1. Cours débutant · 2. Pratique adaptative · 3. Textes IA · 4. Test de vitesse (15/30/60/120/300 s) · 5. Précision |
| G. Générateur IA | Sortie JSON validée Zod, fournisseur interchangeable, repli sur bibliothèque |
| H. Moteur adaptatif | Statistiques par touche/bigramme, règles configurables et testées |
| J. Dashboard | Valeurs réelles uniquement : WPM, précision, niveau, objectif du jour, série, activité, touches faibles, séances récentes, exercice recommandé |
| K. Analytics (essentiel) | Historique WPM/précision, heatmap clavier, touches et bigrammes faibles, records |
| M. Freemium | Free / Pro / Pro annuel, quotas IA serveur, Stripe Checkout + Portal + webhooks |

**V2 :** AI Coach conversationnel, trigrammes, modes pro & programmation, pratique libre (texte collé), gamification (XP, badges), comptes enfants, admin étendue.
**V3 :** écoles/entreprises, multijoueur, classements, certifications, API publique.

## 6. Offres (hypothèses à tester)

| Plan | Prix | Contenu |
|---|---|---|
| Free | 0 $ CAD | Cours, tests, pratique adaptative, stats de base, historique 7 jours, 3 générations IA / mois |
| Pro | 9,99 $ CAD / mois | Générations IA (quota élevé, configurable), coach (V2), stats avancées, historique illimité |
| Pro annuel | 79,99 $ CAD / an | Idem Pro |
| Business / Éducation | Sur devis | V3 |

Prix et quotas stockés en base, jamais codés en dur. Droits vérifiés côté serveur uniquement.

## 7. Critères d'acceptation MVP

1. Un utilisateur crée son compte et vérifie son e-mail.
2. Il choisit son clavier et ses intérêts.
3. Il passe un test initial et reçoit un niveau + profil.
4. Il effectue une séance sans latence perceptible (< 16 ms de traitement par frappe).
5. Erreurs corrigées / non corrigées correctement comptabilisées (tests unitaires).
6. Les statistiques sont sauvegardées, y compris après une coupure réseau (file locale + reprise).
7. Il génère un texte IA personnalisé (si fournisseur configuré), sinon reçoit un texte de la bibliothèque, clairement indiqué.
8. Il reçoit une recommandation justifiée par ses résultats réels.
9. Le quota gratuit est respecté même sous requêtes simultanées.
10. Il peut souscrire à Pro (Stripe test mode) et gérer son abonnement.
11. Un utilisateur ne peut lire aucune donnée d'un autre (tests RLS).

## 8. KPI

Activation (1er test terminé) · First value (1re séance personnalisée) · Rétention D1/D7/D30 · WAU/MAU · Conversion free→paid · MRR · Coût IA / utilisateur actif · Churn.
Objectifs 90 jours (hypothèses) : 100 bêta-testeurs, 40 % activation, 25 % D7, 5 % conversion Pro.

## 9. Non-objectifs

Application mobile native, détection des doigts par caméra, réseau social, IA vocale, appels IA par frappe, stockage du texte tapé brut au-delà du nécessaire.
