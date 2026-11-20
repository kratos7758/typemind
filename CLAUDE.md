# TypeMind

SaaS freemium d'apprentissage de la dactylographie, personnalisé par centres d'intérêt et adapté aux difficultés réelles. Spécification : `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DECISIONS.md`. Avancement : `progress.md`.

@AGENTS.md

Next.js 16 diffère de tes connaissances : lis `node_modules/next/dist/docs/` avant d'utiliser une API. `middleware.ts` → `proxy.ts` ; `cacheComponents` actif (sessions derrière `<Suspense>` + `connection()`).

## Commandes
- Prérequis : Docker Desktop lancé, puis `npx supabase start` (Mailpit : http://127.0.0.1:54324)
- `npm run dev` — serveur de dev
- `npm run typecheck` · `npm run lint` · `npm test` (unitaires) · `npm run test:integration` (RLS, base locale) · `npm run test:e2e` (Playwright)
- `npm run db:generate` — migration depuis le schéma Drizzle · `npm run db:reset` — réapplique toutes les migrations
- Après modification de `supabase/config.toml` : `npx supabase stop && npx supabase start`

## Règles non négociables
- Le moteur de frappe (`src/features/typing-engine`) est du TS pur : pas de React, pas de réseau, pas d'appel IA par frappe.
- L'algorithme décide, l'IA rédige. Jamais de statistique inventée ou produite par un LLM.
- Droits, abonnements et quotas vérifiés côté serveur. Secrets jamais côté client.
- Toute entrée externe validée par Zod. RLS sur toutes les tables.
- Aucune frappe brute stockée côté serveur ; agrégats uniquement.
- Pas de bouton sans action, pas de métrique codée en dur, pas d'intégration présentée comme fonctionnelle sans test.
- Ne jamais affaiblir un test pour le faire passer. Ne déclarer « testé » que ce qui a été exécuté.
- Aucun déploiement ni changement d'infra partagée sans accord explicite.

## Conventions
- Code et identifiants en anglais ; docs et UI en français + anglais (next-intl).
- TypeScript strict, pas de `any`. Composants réutilisables, états loading/empty/error/success.
- Toute décision structurante → nouvelle entrée dans `docs/DECISIONS.md`.
