# Moteur d'apprentissage (déterministe)

> Code : `src/features/learning/` · Seuils : `LEARNING_CONFIG` dans `profile.ts` · Tests : `tests/unit/learning-profile.test.ts`, `recommend.test.ts`, `tests/integration/sessions.test.ts`.
> Règle d'or : **l'algorithme décide, l'IA rédige.** Aucune statistique n'est produite par un LLM.

## 1. Mesures d'une séance (`typing-engine/stats.ts`)

| Mesure | Formule |
|---|---|
| WPM net | caractères justes du texte final / 5 / minutes actives |
| WPM brut | frappes de caractères / 5 / minutes actives |
| Précision | frappes justes / frappes totales × 100 (une erreur corrigée reste une erreur) |
| Erreurs corrigées / restantes | positions fautives puis justes / positions encore fausses à la fin |
| Régularité | 100 × (1 − coefficient de variation des intervalles), intervalles > 2 s exclus |

Minutes actives = de la **première** à la dernière frappe (ou la limite de temps), pauses exclues. Le serveur **recalcule** WPM et précision à partir des comptes bruts (le client n'est pas cru).

Statistiques par touche / bigramme : seules les **premières tentatives** à une position comptent (les reprises après erreur sont des corrections). Variantes typographiques regroupées (’ → '). Bigrammes : lettres uniquement, en minuscules.

## 2. Agrégats long terme (`key-stats.ts`)

Moyenne mobile exponentielle dont le poids dépend du nombre d'essais de la séance :

```
alphaEff = 1 − (1 − α)^(min(essais, 30) / 10)      α = 0,3
```

1 essai bouge à peine la moyenne ; 10 essais = un pas standard ; 30+ essais = trois pas.

## 3. Profil d'apprentissage (`profile.ts`)

| Élément | Règle |
|---|---|
| Vitesse / précision courantes | EWMA (α = 0,3) des séances ≥ 30 frappes, modes test, texte, précision, adaptatif. **Les leçons sont exclues** (exercices de répétition non représentatifs). |
| Test de niveau fiable | ≥ 60 frappes et précision ≥ 75 %. Il **remplace** la vitesse de référence au lieu de s'y mélanger. |
| Niveau | ≥ 75 MPM expert · ≥ 50 avancé · ≥ 30 intermédiaire · ≥ 15 débutant · sinon découverte. Précision < 85 % → un niveau de moins. |
| Objectif suggéré | vitesse + 15, arrondi à 5, minimum 20 (conservé si l'utilisateur en a fixé un). |
| Touches faibles | ≥ 15 essais et taux d'erreur lissé ≥ 5 %, 6 au maximum, espace exclu. |
| Bigrammes faibles | ≥ 8 essais et taux ≥ 8 %, 6 au maximum. |
| Série | jours **locaux** consécutifs (fuseau du navigateur, enregistré à l'onboarding). |

## 4. Recommandation (`recommend.ts`, seuils dans `RECOMMEND_CONFIG`)

1. Pas de niveau → **test de niveau**.
2. Niveau découverte/débutant, ou « je tape à deux doigts » avec un niveau intermédiaire → **première leçon non réussie** (≥ 90 % de précision).
3. Précision lissée < 90 % → **mode précision** sur un texte d'intérêt.
4. Touches/bigrammes faibles et aucune séance ciblée parmi les 3 dernières → **pratique ciblée** (`adaptive.ts`).
5. Sinon → **texte d'intérêt** le moins récemment pratiqué.

Chaque recommandation porte une **raison** construite uniquement à partir des données mesurées, affichée sous le bouton du tableau de bord (ex. « Ta précision moyenne est de 87 % »).

## 5. Pratique ciblée (`adaptive.ts`)

45 mots réels (mots courants + vocabulaire des textes de la langue), dont ~65 % contiennent une cible ; tirage pondéré par le nombre de cibles (un bigramme compte double). Reproductible (graine).

## 6. Tendances (`trends.ts`)

Moyenne des 5 dernières séances représentatives comparée aux 5 précédentes : ±2 MPM (vitesse), ±1 point (précision). Moins de 10 séances → « pas encore assez de séances ». Une séance exceptionnelle isolée ne change pas la tendance.
