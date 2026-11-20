# TypeMind — Architecture

> v0.1 — 2026-11-18

## 1. Principes

- **Monolithe modulaire** Next.js : un seul déploiement, domaines séparés dans `src/features/*`. Pas de microservices.
- **Le moteur de frappe est du TypeScript pur**, sans React, sans réseau. Testable unitairement.
- **Temps réel dans le navigateur, intelligence après la séance.** Aucun appel serveur/IA par frappe.
- **L'algorithme décide, l'IA rédige.** Les statistiques et choix pédagogiques sont déterministes ; le LLM ne produit que du texte et des explications, jamais de chiffres.
- **Le serveur fait foi** : authentification, abonnements, quotas, calcul final des statistiques.

## 2. Couches

```
Présentation   app/ (routes), components/ (UI, typing, dashboard)
Application    features/*/server  — server actions, route handlers, services
Intelligence   features/typing-engine (pur) · features/learning (règles) · features/ai (générateur)
Infrastructure lib/db (Drizzle), lib/supabase, lib/stripe, lib/ai/providers, lib/env
```

Règle de dépendance : présentation → application → intelligence/infrastructure. `typing-engine` et `learning/rules` n'importent **rien** de l'infrastructure.

## 3. Stack (versions vérifiées le 2026-11-18)

| Rôle | Choix |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| UI | Tailwind CSS 4, shadcn/ui, Lucide, Motion (avec parcimonie) |
| i18n | Dictionnaires natifs + `next/root-params` (fr, en) — ADR-011 |
| Données | Supabase Postgres (local Docker en dev), Drizzle ORM 0.45, drizzle-kit |
| Auth | Supabase Auth via `@supabase/ssr` |
| Validation | Zod 4 |
| IA | Adaptateur **OpenAI-compatible** configurable (Groq, OpenRouter, Gemini, Ollama…) + provider `none` |
| Paiement | Stripe Billing, Checkout, Customer Portal, webhooks signés et idempotents |
| Tests | Vitest, React Testing Library, Playwright |
| Plus tard | Upstash Redis (si besoin mesuré), Resend, Sentry, PostHog, Vercel |

## 4. Arborescence

```
typemind/
  CLAUDE.md  progress.md  .env.example
  docs/      PRD ARCHITECTURE DATABASE DECISIONS ROADMAP AI-SYSTEM SECURITY ADAPTIVE-LEARNING
  supabase/  config.toml, migrations/ (générées par drizzle-kit, préfixe supabase), seed.sql
  src/
    app/
      [locale]/(marketing)/   (auth)/   onboarding/   app/…   admin/…
      api/  stripe/webhook, ai/generate, sessions
    components/ ui/ typing/ dashboard/ analytics/ marketing/
    features/
      typing-engine/   core (machine d'état), stats, input (adaptateur DOM), layouts
      learning/        profil, règles adaptatives, sélection d'exercice
      ai/              générateur, prompts, schémas Zod, repli
      sessions/        persistance, file hors-ligne
      onboarding/ billing/ analytics/ auth/
    lib/ db/(schema, client) supabase/ stripe/ ai/providers/ env.ts
    i18n/  messages/{fr,en}.json
  content/  bibliothèque d'exercices (fr, en) + leçons débutant
  tests/ unit/ integration/ e2e/
```

## 5. Moteur de frappe

```
<textarea caché focusé> --beforeinput/input/composition--> InputAdapter
   --> TypingEngine (pur) : state {expected, typed[], cursor, keystrokes[]}
   --> subscribe() --> TypingView (rendu par caractère, mises à jour ciblées)
   --> fin de séance --> SessionSummary (agrégats) --> API /sessions
```

- Entrée : `beforeinput` (`insertText`, `deleteContentBackward`, `deleteWordBackward`) + `compositionend` pour IME/touches mortes ; repli sur `input` + diff si `beforeinput` absent. Jamais `keypress`/`keyCode`.
- Le moteur enregistre chaque frappe `{t, expected, actual, correct, corrected}` en mémoire ; seuls les **agrégats** quittent le navigateur (stats par touche/bigramme, timeline WPM échantillonnée).
- Rendu : `useSyncExternalStore` + composants caractère mémoïsés ; seul le caractère modifié et le curseur re-rendent.

**Formules (convention documentée) :**
- WPM net = (caractères corrects dans le texte final / 5) / minutes
- WPM brut = (toutes les frappes de caractères / 5) / minutes
- Précision = frappes correctes / frappes totales × 100 (une erreur corrigée reste une erreur de frappe)
- Erreurs non corrigées = caractères faux restants à la fin
- Régularité = 100 − coefficient de variation des intervalles inter-frappes (borné)

## 6. Flux de données après une séance

1. Le client envoie `SessionSummary` (Zod) à `POST /api/sessions` ; en cas d'échec → file `IndexedDB`, renvoi à la reconnexion (idempotence par `clientSessionId`).
2. Le serveur revalide la cohérence (durées, bornes), enregistre `typing_sessions` + `session_statistics`, met à jour `key_statistics` / `bigram_statistics` (moyennes mobiles exponentielles).
3. `learning` recalcule le profil et choisit la prochaine recommandation (règles déterministes).
4. Optionnel : l'IA formule l'explication en langage naturel à partir des chiffres fournis.

## 7. Accès aux données et RLS

- Lectures/écritures utilisateur : Drizzle dans une transaction qui fixe `role authenticated` + `request.jwt.claims` → **les politiques RLS s'appliquent aussi côté serveur** (ADR-004).
- Client « admin » (service role) réservé aux webhooks Stripe, compteurs de quota et administration, jamais exposé au navigateur.

## 8. IA

- `AIProvider` interface : `generateStructured(schema, prompt)` / `chat()`.
- Implémentations : `openai-compatible` (base URL + clé + modèle via env), `none`.
- Quotas : décrément atomique en SQL (`UPDATE usage_quotas SET used = used + 1 WHERE used < limit RETURNING`) **avant** l'appel ; remboursement si échec.
- Toute sortie validée par Zod ; si invalide/échec → exercice de la bibliothèque, signalé à l'utilisateur.

## 9. Environnements

- Dev : `npx supabase start` (Docker), Stripe en mode test, IA `none` par défaut.
- Prod (plus tard) : Vercel + projet Supabase cloud. Aucun déploiement sans approbation explicite.
