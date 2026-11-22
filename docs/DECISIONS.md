# Journal des décisions techniques (ADR)

Format : contexte → décision → conséquences. Toutes les décisions ci-dessous ont été validées par le fondateur le 2026-11-18.

## ADR-001 — Monolithe modulaire Next.js · Acceptée
Un seul déploiement, domaines dans `src/features`. Microservices exclus jusqu'à preuve d'un besoin.

## ADR-002 — Fournisseur IA gratuit et interchangeable · Acceptée (2026-11-18)
Le fondateur veut démarrer avec un fournisseur gratuit, non choisi. → Adaptateur unique **OpenAI-compatible** (la plupart des offres gratuites l'exposent : Groq, OpenRouter, Google Gemini, Ollama local) configuré par `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`. Provider `none` par défaut : l'app fonctionne avec la bibliothèque de textes. Aucune réponse IA n'est jamais simulée.

## ADR-003 — Supabase local via Docker en développement · Acceptée (2026-11-18)
`npx supabase start`. Pas de compte requis pour démarrer ; migrations et RLS testées localement.

## ADR-004 — Drizzle avec RLS appliquée côté serveur · Acceptée (2026-11-18)
Drizzle se connecte avec un rôle qui contourne la RLS. Pour ne pas reposer uniquement sur des `WHERE user_id = ?`, chaque requête utilisateur s'exécute dans une transaction qui fait `set local role authenticated` + `set_config('request.jwt.claims', …)`. Le client service-role est limité aux webhooks, quotas et admin.

## ADR-005 — Drizzle comme source de vérité du schéma · Acceptée (2026-11-18)
`drizzle-kit generate` avec `migrations.prefix = "supabase"` écrit dans `supabase/migrations/`. Les politiques RLS sont déclarées avec `pgPolicy` dans le schéma Drizzle.

## ADR-006 — Quotas en SQL atomique, Redis différé · Acceptée (2026-11-18)
Un `UPDATE … WHERE used < limit RETURNING` suffit à empêcher le contournement par requêtes simultanées. Upstash Redis ajouté seulement pour le rate limiting quand on déploiera.

## ADR-007 — Pas de comptes < 14 ans dans le MVP · Acceptée (2026-11-18)
La Loi 25 exige le consentement parental sous 14 ans ; COPPA/RGPD imposent des contraintes similaires. Une expérience enfant mal faite est un risque juridique. → MVP : déclaration de tranche d'âge (14-17 / 18+), pas de date de naissance. Mode enfant + consentement parental en V2. *Modifie « public : tous dès le lancement » — validé par le fondateur.*

## ADR-008 — Convention WPM / précision · Acceptée (2026-11-18)
Voir ARCHITECTURE §5. WPM net basé sur les caractères corrects du texte final ; précision basée sur les frappes (les erreurs corrigées comptent). Toutes les comparaisons se font par mode et par difficulté comparables.

## ADR-009 — Saisie via `beforeinput` sur textarea caché · Acceptée (2026-11-18)
Gère IME, touches mortes (AZERTY `^`, `¨`), mobile, sans `keyCode` déprécié. Repli `input` + diff. Tests Playwright sur Chromium, Firefox, WebKit.

## ADR-010 — Pas d'événements de frappe bruts stockés · Acceptée
Confidentialité (Loi 25 / RGPD) et coût : seuls les agrégats sont envoyés au serveur.

## ADR-011 — i18n : dictionnaires natifs Next.js, fr + en · Acceptée (révisée 2026-11-18)
Locale dans l'URL (`/fr`, `/en`), lue via `next/root-params`. Dictionnaires JSON typés (`src/i18n/messages`), un test garantit que fr et en ont les mêmes clés. Contenu pédagogique séparé des traductions UI (`content/`).
*Révision :* next-intl prévu initialement, abandonné car sa compatibilité avec `cacheComponents` (activé par défaut dans Next 16) n'est pas documentée, alors que le mécanisme natif l'est. Une dépendance de moins. Les Server Actions n'ayant pas accès aux root params, la locale y est transmise par champ caché et validée par Zod.

## ADR-012 — Tables en lecture seule pour l'utilisateur · Acceptée (2026-11-18)
Supabase expose les tables via la Data API : toute politique d'écriture permet à un utilisateur d'écrire directement, sans passer par notre code. → Politique `ownerReadOnly` pour profils, statistiques, profils d'apprentissage, abonnements, quotas, générations IA ; écriture par le serveur uniquement (`adminDb`, identité tirée d'un JWT vérifié). `ownerReadWrite` seulement pour les données librement modifiables : préférences et centres d'intérêt. Les rôles admin sont dans une table dédiée `app_admins` (aucune colonne `role` modifiable). Couvert par `tests/integration/rls.test.ts`.

## ADR-013 — Next.js 16 : `cacheComponents` conservé · Acceptée (2026-11-18)
Activé par défaut par le scaffold. Conséquences : toute lecture de session est placée derrière `<Suspense>` et précédée de `connection()` (la validation du JWT dépend de l'heure) ; le fallback d'un formulaire streamé ne doit jamais contenir de champs (sinon la saisie est effacée au remplacement — bug trouvé par les tests E2E). `middleware.ts` s'appelle désormais `proxy.ts` (runtime Node).

## ADR-014 — Dispositions clavier définies dans le code · Acceptée (2026-11-18)
Les définitions (touches, doigts, touches mortes) sont des données TypeScript versionnées, utilisées par le moteur côté client. La table `keyboard_layouts` ne sert qu'à l'intégrité référentielle et à activer/désactiver une disposition. Les leçons sont définies par **position physique** (`KeyboardEvent.code`) : un seul cours pour tous les claviers. ⚠ Les niveaux AltGr des claviers canadiens restent à faire valider par des utilisateurs natifs.

## ADR-015 — Pas de `partialPrefetching`, pas de redirection en cascade · Acceptée (2026-11-19)
Bug trouvé en E2E : après l'onboarding, le lien « Tableau de bord » renvoyait encore vers l'onboarding. Cause : la connexion redirigeait vers `/app`, qui redirigeait à son tour pendant le streaming ; le routeur client a mémorisé ce résultat pour `/app`. Correctifs : (1) l'action de connexion envoie directement au bon endroit (onboarding ou app) ; (2) `partialPrefetching` désactivé (il préchargeait du contenu dynamique par utilisateur) ; (3) `refresh()` après l'onboarding et `router.refresh()` après chaque séance enregistrée. Les tests E2E tournent sur un **build de production** (le mode dev masquait des erreurs de pré-rendu).

## ADR-016 — Caractères impossibles à taper · Acceptée (2026-11-19)
Typographie conservée à l'affichage mais équivalents clavier acceptés : ’ → ', « » “ ” → ", espaces insécables → espace, tirets longs → -, majuscules accentuées → majuscule simple (pas de É sur l'AZERTY français standard). Les ligatures œ/æ sont écrites oe/ae dans les textes (aucun clavier standard ne les produit). Le clavier virtuel montre le caractère exact quand la disposition le permet (ex. É en CSA), sinon aucune indication plutôt qu'une indication fausse.

## ADR-017 — Séances : agrégats seulement, recalcul serveur, file hors ligne · Acceptée (2026-11-19)
Le navigateur envoie un résumé (comptes, stats par touche/bigramme, courbe ≤ 1 point/s) — jamais les frappes. Le serveur valide la plausibilité (≤ 25 frappes/s, cohérence des comptes, horodatages) et **recalcule** WPM et précision. Idempotence par `clientSessionId`. En cas d'échec réseau, la séance est gardée dans `localStorage` (et non IndexedDB comme prévu : charge utile petite, API plus simple) et renvoyée au retour de la connexion.

## ADR-018 — Génération IA : quota d'abord, validation stricte, remboursement · Acceptée (2026-11-19)
Le quota est consommé atomiquement AVANT l'appel (protège des requêtes simultanées) et remboursé en cas d'échec (l'utilisateur ne paie pas nos erreurs). La sortie du modèle est validée (schéma, langue, longueur, lettres tapables sur SON clavier) ; une seule nouvelle tentative. Les textes générés sont des exercices privés (RLS). Pas de SDK : un `fetch` typé compatible OpenAI. Détails : docs/AI-SYSTEM.md.

## ADR-019 — Limites de plan appliquées dans la requête · Acceptée (2026-11-19)
L'historique Free (7 jours) est appliqué dans `getAnalyticsData` (clause SQL), pas dans l'interface : un client modifié ne peut pas obtenir plus. Plafond global de 90 jours pour l'analytique. Les agrégats par touche restent complets (ils servent l'apprentissage).

## ADR-020 — Graphiques sans bibliothèque, couleurs validées · Acceptée (2026-11-19)
Deux graphiques en courbe SVG faits main (une série chacun, jamais de double axe) et une carte de chaleur du clavier. Couleurs passées au validateur dataviz : ligne `#007d5f` / `#35a888` (sombre), gamme ordinale bleue à 4 paliers choisie séparément pour chaque thème. Survol + clavier + tableau de données pour l'accessibilité.

## ADR-021 — Stripe : le webhook fait foi · Acceptée (2026-11-19)
Les droits ne changent qu'à la réception d'un webhook signé, jamais sur la page de retour du paiement. Idempotence (`stripe_events` dans la même transaction), ordre (`stripe_updated_at`), prix identifiés par lookup key (aucun identifiant de prix dans le code ni l'environnement). `past_due` garde l'accès pendant les relances ; tout statut inconnu = aucun accès. Détails : docs/BILLING.md.

## ADR-022 — Aucune dépendance à la base au moment du build · Acceptée (2026-11-19)
Bug révélé quand la base locale était arrêtée : la page Tarifs lisait les prix pendant le pré-rendu. Les prix sont désormais lus à la requête (`connection()` + `"use cache"`, durée « hours »), la structure de la page restant statique. Vérifié : `npm run build` réussit base arrêtée.

## ADR-023 — Tests de facturation sans paiement réel · Acceptée (2026-11-19)
Webhooks : événements signés localement avec `Stripe.webhooks.generateTestHeaderString` (vraie vérification de signature, y compris sur la vraie route en E2E avec un secret propre aux tests). Appels API : `stripe-mock` (serveur officiel, Docker) — valide la forme de nos requêtes, ne représente jamais un paiement.

## ADR-024 — Limitation de débit dans Postgres · Acceptée (2026-11-20)
Fenêtre fixe, un upsert atomique par appel (`rate_limits`), exact sous concurrence (testé : 20 requêtes simultanées, limite 5 → 5 acceptées). Pas de service supplémentaire ; Upstash Redis reste possible si la charge l'exige. Limites : séances 30/min, IA 6/min, export 5/h, paiement 10/min, par utilisateur. Le client remet en file une séance refusée (429).

## ADR-025 — CSP sans nonce · Acceptée (2026-11-20)
Les nonces imposeraient le rendu dynamique de toutes les pages (incompatible avec les pages statiques). CSP stricte sur tout le reste (`default-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`) avec `'unsafe-inline'` pour les scripts, requis par Next.js dans ce mode. Risque limité : aucun HTML fourni par les utilisateurs n'est rendu. HSTS et `upgrade-insecure-requests` seulement en HTTPS. Option future : SRI (expérimental dans Next 16).

## ADR-026 — Contraste « texte discret » relevé · Acceptée (2026-11-20)
L'audit axe a révélé `--fg-subtle` à 2,76:1 (clair) et 3,45:1 (sombre), utilisé notamment pour le texte restant à taper. Corrigé : texte à taper en `--fg-muted`, `--fg-subtle` relevé au-dessus de 4,5:1. L'audit (12 pages × 2 thèmes) fait partie des tests E2E.

## ADR-027 — Commencer sans compte : utilisateurs anonymes Supabase · Acceptée (2026-11-21)
Demande produit : « Commencer gratuitement » ne doit pas exiger de compte. Choix : `signInAnonymously()` de Supabase plutôt qu'un mode 100 % navigateur. L'invité est un vrai utilisateur (`is_anonymous` dans le JWT) : RLS, séances, statistiques et apprentissage adaptatif fonctionnent sans code dupliqué. Pour sauvegarder, la page d'inscription convertit l'invité (`updateUser({ email, password })`, envoyés ensemble car Supabase refuse un mot de passe sur un anonyme sans e-mail) : **même identifiant, progression conservée** (testé en E2E jusqu'à la reconnexion).
Restrictions vérifiées côté serveur : pas de génération IA (403, coût), pas d'abonnement (e-mail nécessaire). La progression n'existe que dans ce navigateur tant qu'il n'y a pas de compte (bandeau permanent). Le bouton indique l'âge minimal (14 ans) et renvoie aux conditions.
Risques : création massive d'anonymes (limite Supabase : 30/h par IP ; ajouter un CAPTCHA Turnstile si abus) ; comptes invités abandonnés à purger (tâche à prévoir, p. ex. anonymes inactifs depuis 30 jours). Prérequis : « Allow anonymous sign-ins » activé dans Supabase.

## ADR-028 — Droits explicites sur les tables pour les rôles d'API · Acceptée (2026-11-21)
Bug de production : toutes les pages lisant les données de l'utilisateur affichaient « Une erreur est survenue ». Cause : les projets Supabase récents n'accordent plus automatiquement les droits sur les nouvelles tables à `anon` / `authenticated` (le CLI local, si). `withUserDb()` s'exécute en `authenticated` (ADR-004), d'où « permission denied ». Correctif : migration `role_grants` qui accorde exactement ce que les politiques RLS prévoient (lecture sur les tables de l'utilisateur, écriture sur préférences et intérêts). Reproduit en local en retirant les droits par défaut : 6 tests RLS en échec, puis tous verts avec la migration.

## ADR-029 — Mains guides sur le clavier virtuel · Acceptée (2026-11-21)
Deux mains translucides (SVG) posées sur la rangée de repos (positions physiques, donc valables pour les 6 claviers). Le doigt à utiliser pour le prochain caractère est teinté et rejoint la touche cible ; Maj (main opposée) et AltGr (pouce droit) sont montrés de la même façon ; l'espace allume les deux pouces. Géométrie pure et testée (`typing-engine/hands.ts`), positions des touches mesurées dans le DOM seulement au montage et au redimensionnement. Les mains sont dessinées **sous** les touches : les étiquettes et la touche surlignée restent lisibles (une première version par-dessus masquait le caractère à taper).
