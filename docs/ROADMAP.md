# Roadmap MVP

Estimations indicatives. On ne passe pas à l'étape suivante si le cœur de la précédente est cassé.

## Phase 1 — Fondations
- [x] PRD, architecture, base de données, décisions
- [x] Scaffold Next.js 16 + TS strict + Tailwind 4 + ESLint + Vitest + Playwright (composants maison style shadcn, `cva`)
- [x] `CLAUDE.md`, `.env.example`, validation des variables d'env (Zod) — `.claude/rules` reporté (CLAUDE.md suffit pour l'instant)
- [x] Supabase local + schéma Drizzle MVP (18 tables) + RLS + trigger de création de profil + plans et claviers
- [x] i18n fr/en
- [x] Design system initial (tokens clair/sombre, Instrument Sans + JetBrains Mono, Button/Field/Input/Alert)
- [x] Auth : inscription, connexion, déconnexion, vérification e-mail, mot de passe oublié, routes protégées
- [ ] Bascule manuelle clair/sombre (le thème suit le système pour l'instant)

## Phase 2 — Produit d'apprentissage
- [x] **Typing engine** pur + tests exhaustifs (formules, Backspace, accents, touches mortes, IME)
- [x] Dispositions clavier (6) + clavier virtuel + doigt recommandé
- [x] Typing Studio (minuté / longueur, pause auto, restart, raccourcis)
- [x] Onboarding (6 étapes, détection du clavier) + test initial + niveau
- [x] Cours débutant (20 leçons par position physique), test de vitesse (15 s → 5 min), textes par intérêts, mode précision
- [x] Sauvegarde des séances (validation + recalcul serveur) + file hors ligne + résultats
- [x] Tableau de bord sur données réelles + première recommandation
- [x] Page Préférences — livrée en Phase 3
- [ ] Mode distraction-free / son : reporté

## Phase 3 — Intelligence
- [x] Stats par touche / bigramme (EWMA pondérée), profil d'apprentissage, tendances
- [x] Règles adaptatives configurables + recommandation expliquée + exercice ciblé
- [x] Bibliothèque de textes par centres d'intérêt (fr/en)
- [x] Générateur IA (adaptateur OpenAI-compatible) + quotas atomiques + remboursement — fournisseur à brancher
- [x] Analytics (courbes, carte de chaleur, touches lentes, bigrammes, records) + limite Free côté serveur
- [x] Page Préférences
- [ ] Brancher un fournisseur IA réel et valider la qualité des textes sur un échantillon

## Phase 4 — SaaS
- [x] Stripe Checkout, Customer Portal, webhooks signés / idempotents / ordonnés, droits serveur — clés à fournir
- [x] Script `npm run stripe:setup` (produit + prix par lookup key)
- [x] Page Tarifs (prix depuis la base), page Abonnement
- [x] Administration minimale (indicateurs agrégés, accès par `app_admins`, `npm run admin:grant`)
- [x] Export JSON et suppression de compte (avec résiliation Stripe)
- [ ] Activer Stripe Tax ou valider la fiscalité (TPS/TVH/TVQ)
- [ ] Courriels transactionnels (Resend) : bienvenue, reçu, échec de paiement

## Phase 5 — Bêta
- [x] Limitation de débit (Postgres) sur les routes sensibles
- [x] En-têtes de sécurité (CSP, HSTS, etc.)
- [x] Accessibilité : audit axe WCAG 2.1 AA (12 pages × 2 thèmes), lien d'évitement, contraste corrigé
- [x] Pages Confidentialité et Conditions (ébauches à valider par un juriste), pied de page, 404 et pages d'erreur traduites
- [x] E2E multi-navigateurs (Chromium, Firefox, WebKit) sur la frappe et les pages publiques
- [x] Test de fluidité : aucune tâche longue pendant la frappe
- [x] Guide de déploiement (docs/DEPLOYMENT.md)
- [ ] Déploiement (sur ton approbation)
- [ ] Validation juridique, responsable Loi 25, Sentry/PostHog
