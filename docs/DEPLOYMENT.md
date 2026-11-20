# Déploiement (bêta)

> Rien n'est déployé automatiquement. Chaque étape ci-dessous est à faire par toi (ou avec moi, sur ton accord explicite).
> Cible recommandée : **Vercel** (application) + **Supabase cloud** (base, auth). Région proche du Québec si disponible (ex. `ca-central-1` côté Supabase).

## 1. Supabase (production)

1. Créer un projet Supabase (mot de passe de base fort, région choisie).
2. Relier le dépôt : `npx supabase link --project-ref <ref>`.
3. Appliquer les migrations : `npx supabase db push` (crée tables, RLS, trigger, plans et claviers).
4. Auth → URL Configuration : *Site URL* = `https://<ton-domaine>` ; *Redirect URLs* = `https://<ton-domaine>/**`.
5. Auth → Email : activer la confirmation ; configurer un **SMTP** réel (Resend, Postmark…) — l'envoi intégré de Supabase est limité.
6. Auth → mot de passe : longueur minimale **10** (comme en local, `supabase/config.toml`).
7. Activer les sauvegardes (plan payant pour la restauration à un instant donné).

## 2. Vercel

1. Importer le dépôt GitHub (racine : `typemind/`).
2. Variables d'environnement (Production) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé publishable |
| `SUPABASE_SECRET_KEY` | clé secrète (**jamais** exposée au navigateur) |
| `DATABASE_URL` | chaîne de connexion **pooler** (mode transaction, port 6543) |
| `NEXT_PUBLIC_SITE_URL` | `https://<ton-domaine>` (active HSTS et `upgrade-insecure-requests`) |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | voir AI-SYSTEM.md (ou `AI_PROVIDER=none`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | voir BILLING.md (mode test pour la bêta) |

3. Déployer. Le build **n'a pas besoin de la base** (ADR-022).

## 3. Stripe

1. `npm run stripe:setup` avec la clé de l'environnement visé.
2. Dashboard → Webhooks → endpoint `https://<ton-domaine>/api/stripe/webhook`, événements : `checkout.session.completed`, `customer.subscription.*`. Copier le secret dans `STRIPE_WEBHOOK_SECRET`.
3. Configurer le Customer Portal ; activer Stripe Tax (ou valider la fiscalité).

## 4. Administration

`DATABASE_URL=<prod> npm run admin:grant -- toi@exemple.com`

## 5. Vérifications après déploiement

- [ ] Inscription → courriel reçu → confirmation → onboarding → test de niveau.
- [ ] Séance enregistrée et visible au tableau de bord.
- [ ] En-têtes : `curl -I https://<domaine>/fr` montre CSP, HSTS, nosniff.
- [ ] Paiement test (carte 4242…) → webhook reçu (200) → formule Pro affichée.
- [ ] Export JSON et suppression d'un compte de test.
- [ ] Page admin accessible à toi seul.

## 6. Avant d'ouvrir au public (hors bêta fermée)

- Validation juridique des pages Confidentialité et Conditions ; désignation du responsable Loi 25 ; évaluation des facteurs relatifs à la vie privée (transferts hors Québec).
- Suivi des erreurs (Sentry) et des usages (PostHog) — non intégrés pour l'instant.
- Modération des textes IA si ouverture large aux 14-17 ans.
