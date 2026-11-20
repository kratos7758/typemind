# Facturation (Stripe)

> Code : `src/features/billing/`, `src/app/api/stripe/webhook/route.ts`, `scripts/stripe-setup.mts`.
> Tests : `tests/unit/billing-plans.test.ts`, `tests/integration/stripe-webhook.test.ts`, `tests/integration/stripe-checkout.test.ts` (stripe-mock), `tests/e2e/phase4.spec.ts`.

## 1. Activer Stripe en mode test (gratuit)

1. Créer un compte Stripe et rester en **mode test**.
2. Dans `.env.local` : `STRIPE_SECRET_KEY=sk_test_…`
3. Créer les prix : `npm run stripe:setup` (lit les prix dans `subscription_plans`, crée le produit et les prix avec les lookup keys `typemind_pro_monthly` / `typemind_pro_yearly`, idempotent ; refuse une clé live sauf `ALLOW_LIVE=1`).
4. Webhooks en local avec la CLI Stripe : `stripe listen --forward-to localhost:3000/api/stripe/webhook`, puis copier le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`.
   Événements utilisés : `checkout.session.completed`, `customer.subscription.created|updated|deleted|paused|resumed`.
5. Tableau de bord Stripe → **Customer Portal** : autoriser résiliation, changement mensuel ↔ annuel, mise à jour de la carte, factures.
6. Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.

Sans `STRIPE_SECRET_KEY`, l'application affiche « paiement non activé » et ne propose aucun bouton d'achat. **Aucun paiement n'est jamais simulé.**

## 2. Flux

```
Abonnement → Server Action (session vérifiée) → client Stripe (créé une fois, idempotency key)
  → Checkout (metadata.userId côté serveur) → paiement chez Stripe
  → webhook signé → transaction : event id enregistré + abonnement mis à jour → droits Pro
```

- **Le webhook fait foi**, pas la page de retour : `?checkout=success` affiche seulement un message d'attente.
- **Signature vérifiée** sur le corps brut (`Stripe.webhooks.constructEvent`) avant tout traitement.
- **Idempotence** : `stripe_events.id` inséré dans la même transaction que l'effet ; un événement rejoué ne fait rien. En cas d'erreur → 500 → Stripe réessaie.
- **Ordre** : `subscriptions.stripe_updated_at` garde la date du dernier événement appliqué ; un événement plus ancien arrivé en retard est ignoré.
- **Plan** : déduit de la lookup key du prix (repli : `subscription_plans.stripe_price_id`). Prix inconnu → ignoré et journalisé.
- **Droits** (`entitlements.ts`) : accès Pro si statut `active`, `trialing` ou `past_due` (période de relance des paiements) ; sinon Free. Statut Stripe inconnu → aucun accès.
- Un second abonnement est refusé tant qu'un abonnement donne accès (changement de formule via le portail).

## 3. Suppression de compte

Résiliation immédiate de l'abonnement Stripe (plus aucun prélèvement), puis suppression de l'utilisateur ; toutes ses lignes sont supprimées en cascade. Le client Stripe et les factures restent chez Stripe (obligations comptables).

## 4. Taxes

Les prix sont affichés hors taxes (« taxes en sus selon ta province »). Avant la mise en production : activer **Stripe Tax** (TPS/TVH/TVQ) ou faire valider le traitement fiscal par un comptable.
