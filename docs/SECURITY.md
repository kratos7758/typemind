# Sécurité et confidentialité

> État au 2026-11-19. Chaque point renvoie au code ou au test qui le vérifie.

## Authentification et autorisation

| Mesure | Où | Vérifié par |
|---|---|---|
| Session Supabase, JWT **vérifié** (`getClaims`, jamais `getSession`) côté serveur | `features/auth/dal.ts` | E2E auth |
| Proxy = redirections optimistes seulement ; l'autorisation est refaite près des données | `src/proxy.ts`, DAL | E2E routes protégées |
| RLS sur toutes les tables ; requêtes utilisateur exécutées sous le rôle `authenticated` | `lib/db/client.ts` (`withUserDb`) | `rls.test.ts` |
| Données sensibles en **lecture seule** via la Data API (stats, abonnement, quotas, admin) | `schema/_shared.ts` (ADR-012) | `rls.test.ts` |
| Administration : table `app_admins` non modifiable depuis l'app, 404 sinon | `features/admin/metrics.ts` | E2E admin |
| Redirections après connexion limitées aux chemins internes | `safeNextPath` | `auth-schemas.test.ts` |
| Pas d'énumération de comptes (inscription / mot de passe oublié) | `features/auth/actions.ts` | E2E auth |

## Données et paiements

| Mesure | Où |
|---|---|
| Frappes jamais stockées : agrégats seulement ; le serveur recalcule et vérifie la plausibilité | `features/sessions/` (ADR-010, ADR-017) |
| Toute entrée externe validée par Zod (formulaires, API, sortie IA, webhooks) | partout |
| Webhooks Stripe signés, idempotents, ordonnés, transactionnels | `features/billing/webhook.ts` |
| Droits et quotas calculés côté serveur uniquement ; quota IA atomique | `entitlements.ts`, `quota.ts` |
| Limite d'historique Free appliquée dans la requête SQL | `getAnalyticsData` (ADR-019) |
| Clés (Supabase secret, Stripe, IA) uniquement côté serveur (`server-only`) | `lib/env.ts` |
| Journaux sans données personnelles ni texte de prompt | `ai_generations`, `console.error` |

## Droits des personnes (Loi 25, RGPD)

- **Accès / portabilité** : export JSON complet (`/api/account/export`), sans identifiants tiers.
- **Effacement** : suppression du compte après confirmation par courriel ; résiliation Stripe ; cascade en base.
- **Mineurs** : 14 ans et plus seulement (ADR-007) ; pas de date de naissance collectée.

## En place depuis la Phase 5

- Limitation de débit par utilisateur (Postgres, ADR-024) — `tests/integration/rate-limit.test.ts`.
- En-têtes : CSP, HSTS (HTTPS), nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy ; `X-Powered-By` retiré (ADR-025) — vérifiés en E2E sur 3 navigateurs.
- Accessibilité WCAG 2.1 AA vérifiée automatiquement (axe) sur 12 pages, thèmes clair et sombre.

## À faire avant le lancement public

- Revue OWASP manuelle ; limitation de débit par IP sur les formulaires d'authentification (en plus de celle de Supabase Auth).
- Modération des textes générés avant une ouverture large aux 14-17 ans.
- Politique de confidentialité et conditions d'utilisation **validées par un juriste** ; responsable de la protection des renseignements personnels désigné (Loi 25).
- Sauvegardes et procédure de restauration du projet Supabase de production.
