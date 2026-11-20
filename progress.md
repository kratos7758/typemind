# Avancement

## 2026-11-20 — Phase 5 terminée (prêt pour une bêta)

**Livré**
- Limitation de débit par utilisateur, stockée dans Postgres (exacte sous concurrence).
- En-têtes de sécurité (CSP sans nonce, HSTS en HTTPS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy).
- Accessibilité : audit axe sans violation sur 12 pages en thème clair et sombre ; lien « Aller au contenu » ; contraste du texte à taper corrigé.
- Pages Confidentialité et Conditions (ébauches fidèles au fonctionnement réel, marquées « à valider par un juriste »), pied de page, pages d'erreur et 404 traduites.
- Tests multi-navigateurs (Chromium, Firefox, WebKit) : frappe avec accents, correction, pause, redémarrage, collage bloqué, en-têtes.
- Test de fluidité : aucune tâche longue (> 50 ms) pendant 250 frappes.
- Guide de déploiement Vercel + Supabase + Stripe (rien n'a été déployé).

**Tests exécutés (tous verts)** : typecheck · lint · 188 unitaires · 38 intégration · 28 E2E (Chromium + Firefox + WebKit, build de production, 2 workers).

**Bugs trouvés et corrigés** : contraste insuffisant du texte à taper (2,76:1) · navigation mobile (phase 4) · aucun bug de saisie spécifique à Firefox ou WebKit.

**Points ouverts** : déploiement (sur ton accord) ; validation juridique ; fournisseur IA ; clés Stripe ; Sentry/PostHog ; claviers canadiens à faire valider par des natifs.

## 2026-11-19 — Phase 4 terminée (SaaS)

**Livré**
- Stripe complet mais **sans clés** : Checkout (client créé une fois, idempotency key, un seul abonnement actif), Customer Portal, webhook signé / idempotent / ordonné / transactionnel, droits Pro côté serveur (past_due = période de grâce).
- `npm run stripe:setup` (produit + prix depuis la base, lookup keys, refuse les clés live).
- Page Tarifs publique (prix CAD depuis la base, FAQ), page Abonnement (formule, renouvellement, usage IA, portail) avec messages honnêtes si Stripe n'est pas configuré.
- Mes données : export JSON, suppression de compte confirmée par courriel (résiliation Stripe + cascade).
- Administration en lecture seule (comptes, actifs, MRR estimé, retards de paiement, usage et coût IA) ; 404 pour les non-admins ; `npm run admin:grant`.
- Page 404 traduite ; libellés de formules traduits ; navigation mobile défilante.
- Docs : BILLING.md, SECURITY.md, ADR-021 à 023.

**Tests exécutés** : typecheck · lint · 188 unitaires · 34 intégration (dont webhooks signés et stripe-mock) · 15 E2E (build de production) — voir le résultat final ci-dessous.

**Bugs trouvés et corrigés** : build dépendant de la base (page Tarifs) · nom de formule en anglais sur l'interface française · navigation mobile qui débordait · explication redondante pour le test de niveau.

**Points ouverts** : fournir les clés Stripe de test puis tester un vrai paiement de bout en bout (carte 4242) ; fiscalité (Stripe Tax) ; courriels transactionnels ; limitation de débit ; validation juridique des pages légales.

**Prochaine étape : Phase 5** — bêta : rate limiting, en-têtes de sécurité, accessibilité, pages légales, Firefox/WebKit, déploiement (sur approbation).

## 2026-11-19 — Phase 3 terminée (intelligence)

**Livré**
- Recommandations expliquées par les données (précision basse, touches faibles, plateau, intérêts) ; tendances de vitesse et de précision.
- Pratique ciblée sur les touches et bigrammes faibles.
- Génération IA complète mais **sans fournisseur branché** : adaptateur OpenAI-compatible, prompt, validation stricte, quota atomique (Free 3/mois), remboursement, journal des coûts, exercices privés, carte UI honnête (IA désactivée / quota atteint / échec + repli bibliothèque).
- Page Statistiques : records, courbes vitesse/précision (survol + clavier + tableau), carte de chaleur du clavier, touches lentes, bigrammes difficiles ; historique Free limité à 7 jours **côté serveur**.
- Page Préférences (langue, clavier, intérêts, objectif quotidien, objectif de vitesse, clavier virtuel).

**Tests exécutés (tous verts)** : typecheck · lint · 184 unitaires · 21 intégration (dont IA contre un faux serveur HTTP local et quota sous concurrence) · 10 E2E (build de production).

**Bugs trouvés et corrigés** : tests de vitesse enregistrés comme « abandonnés » · texte d'aide de la carte de chaleur faux en thème sombre · graduations de l'axe de précision non rondes · bigrammes à 0 % listés comme « difficiles » · couleur de ligne hors plage en thème sombre (validateur).

**Points ouverts** : choisir et brancher un fournisseur IA (docs/AI-SYSTEM.md §1) puis valider la qualité sur un échantillon ; modération des textes générés avant une ouverture large aux 14-17 ans ; texte français sur clavier anglais (accents non tapables) à traiter.

**Prochaine étape : Phase 4** — Stripe (Checkout, Portal, webhooks), page tarifs, droits Pro, administration minimale, export et suppression de compte.

## 2026-11-19 — Phase 2 terminée (produit d'apprentissage)

**Livré**
- Moteur de frappe pur TS (`src/features/typing-engine`) : machine d'état, minuté/texte, pause, arrêt sur erreur, Ctrl+Retour arrière, équivalents typographiques, NFC.
- Adaptateur de saisie `beforeinput` + composition (touches mortes, IME), anti-collage.
- 6 dispositions clavier par position physique, séquences de frappe (Shift opposé, AltGr, touches mortes), clavier virtuel coloré par doigt.
- Typing Studio : rendu par mots mémoïsés, défilement sur 3 lignes, stats en direct isolées, pause automatique à la perte de focus.
- Contenu : 24 textes originaux (12 sujets × fr/en), mots courants, 20 leçons générées par disposition, test de niveau fixe par langue.
- Onboarding 6 étapes (+ détection du clavier), test de niveau, hub d'entraînement, tableau de bord réel, recommandation.
- API `/api/sessions` : validation de plausibilité, recalcul serveur, agrégats par touche/bigramme, profil d'apprentissage, idempotence, file hors ligne.
- Nombres localisés (« 99,5 % »), thème sombre retouché après revue visuelle.

**Tests exécutés (tous verts)** : typecheck · lint · 147 unitaires · 16 intégration · 7 E2E (build de production), dont touche morte via IME Chromium et séance hors ligne renvoyée.

**Bugs trouvés et corrigés** : redirection en cascade mémorisée par le routeur (ADR-015) · `usePathname` bloquant le pré-rendu (visible seulement en build de production) · détection de clavier écrasant le choix de l'utilisateur · Pause annulée par la perte de focus · durée minutée dépassant la limite · « É » et « œ » impossibles à taper en AZERTY (ADR-016) · expert recommandé vers la leçon 1.

**Points ouverts** : validation des claviers canadiens par des natifs ; page Préférences ; tests E2E Firefox/WebKit ; contenus plus nombreux.

**Prochaine étape : Phase 3** — exercices ciblant les touches faibles, génération IA (fournisseur gratuit à choisir), analytics (historique, heatmap), page Préférences.

## 2026-11-18 — Phase 1 terminée (fondations)

**Livré**
- Documents : PRD, ARCHITECTURE, DATABASE, DECISIONS (ADR-001 → 014), ROADMAP, CLAUDE.md.
- Next.js 16.4 (App Router, `cacheComponents`, `proxy.ts`), TypeScript strict, Tailwind 4.
- Supabase local (Docker) : 18 tables, RLS sur toutes, trigger d'inscription, plans Free/Pro/Pro annuel, 6 dispositions clavier.
- Drizzle : schéma = source de vérité, migrations dans `supabase/migrations`, `withUserDb` (RLS appliquée côté serveur) et `adminDb`.
- i18n fr/en (URL `/fr`, `/en`, négociation Accept-Language).
- Auth complète : inscription (tranche d'âge 14+, CGU), confirmation e-mail, connexion, déconnexion, mot de passe oublié/réinitialisation, routes protégées, protection contre les redirections ouvertes et l'énumération de comptes.
- Landing minimale et tableau de bord (données réelles uniquement).

**Tests exécutés (tous verts)**
- `npm run typecheck` · `npm run lint` (0 erreur, 0 avertissement)
- `npm test` — 27 tests unitaires (validation, redirections sûres, i18n, parité des traductions)
- `npm run test:integration` — 11 tests RLS sur la vraie base locale
- `npm run test:e2e` — 4 scénarios Playwright, dont le parcours complet inscription → e-mail → app → réinitialisation
- `npm run build` — OK

**Bugs trouvés et corrigés grâce aux tests**
- Variables d'env vides (`AI_BASE_URL=`) rejetées → l'app ne démarrait pas sans IA.
- Formulaire de connexion qui effaçait la saisie lors du streaming (fallback Suspense avec champs).
- `Date.now()` pendant le pré-rendu de `/app` (validation JWT) → `connection()`.

**Points ouverts**
- `npm audit` : 4 vulnérabilités modérées dans esbuild via `drizzle-kit` (outil de dev uniquement, non exposé). À surveiller ; le correctif proposé casserait drizzle-kit.
- Bascule clair/sombre manuelle, pages légales, tarifs : plus tard.
- Pour démarrer : Docker Desktop lancé → `npx supabase start` → `npm run dev`. E-mails de test : http://127.0.0.1:54324 (Mailpit).

**Prochaine étape : Phase 2** — moteur de frappe pur + tests, dispositions clavier, Typing Studio, onboarding, test initial.
