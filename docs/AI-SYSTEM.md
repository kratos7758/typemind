# Système IA

> Code : `src/lib/ai/provider.ts`, `src/features/ai/` · Tests : `tests/unit/ai-exercise.test.ts`, `tests/integration/ai-generation.test.ts`.
> Principe : **l'algorithme décide quoi travailler, l'IA rédige.** Le modèle ne produit jamais de statistiques ni de décisions pédagogiques.

## 1. Activer un fournisseur (gratuit pour commencer)

Tout fournisseur exposant l'API **OpenAI Chat Completions** convient. Dans `.env.local` :

```
AI_PROVIDER=openai-compatible
AI_BASE_URL=<URL de base, ex. …/v1>
AI_API_KEY=<clé du fournisseur>
AI_MODEL=<identifiant du modèle>
# Optionnel, pour le suivi des coûts (USD par million de jetons) :
AI_PRICE_INPUT_PER_MTOK_USD=0
AI_PRICE_OUTPUT_PER_MTOK_USD=0
```

Exemples de fournisseurs compatibles avec une offre gratuite : Groq, Google Gemini (point d'accès « OpenAI compatibility »), OpenRouter (modèles `:free`), Ollama en local (`http://localhost:11434/v1`). Vérifier sur leur documentation l'URL exacte, le nom du modèle, les limites gratuites et que le mode `response_format: json_object` est accepté.

Sans configuration (`AI_PROVIDER=none`), l'application l'indique clairement et propose un texte de la bibliothèque. **Aucune réponse IA n'est jamais simulée.**

## 2. Chaîne de génération (`generate.ts`)

1. Droits lus côté serveur (`getEntitlements`, plan actif sinon Free).
2. **Quota atomique** (`consumeQuota`) : `UPDATE … SET used = used + 1 WHERE used < quota_limit RETURNING`. Testé avec 6 requêtes simultanées sur un quota de 3 → exactement 3 succès.
3. Prompt (`buildExercisePrompt`) : langue, sujet, longueur selon le niveau, touches et bigrammes faibles **calculés par le moteur**, consignes de qualité et de sécurité (14 ans et +), sortie JSON.
4. Validation (`validateExercise`) : schéma Zod ; suppression des symboles non tapables sur le clavier de l'utilisateur ; refus si une **lettre** n'est pas tapable (on ne modifie jamais un mot) ; longueur ; contrôle de langue (mots-outils) ; calcul de la difficulté et des cibles réellement couvertes.
5. Une nouvelle tentative si la sortie est invalide ou mal formée ; pas de nouvelle tentative sur une erreur réseau/HTTP.
6. Succès → exercice **privé** (`exercises.owner_id`, RLS) + journal `ai_generations` (jetons, coût estimé — jamais le texte du prompt).
7. Échec → **quota remboursé**, journal `failed`/`invalid_output` avec le code d'erreur.

## 3. Quotas par plan

Stockés dans `subscription_plans.entitlements` (`aiGenerationsPerMonth`) : Free 3, Pro 150 (hypothèse). Période mensuelle UTC. Si le plan baisse en cours de mois, la limite stockée ne descend jamais sous ce qui a déjà été consommé.

## 4. Limites connues

- Pas de modération automatique du texte généré en dehors des consignes du prompt et des contrôles ci-dessus : à ajouter avant d'ouvrir l'IA aux 14-17 ans à grande échelle.
- Contrôle de langue heuristique (mots-outils) : suffisant pour détecter une mauvaise langue, pas une mauvaise qualité.
- Coach conversationnel (V2) : non implémenté ; les recommandations du tableau de bord sont déterministes et expliquées à partir des données.
