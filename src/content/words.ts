/**
 * Frequent words used by speed tests and lesson drills.
 * Speed tests use common words (not passages) so results stay comparable over time.
 */
import type { Locale } from "@/i18n/config";

const fr = `de la le et les des en un une du est que pour qui dans par sur au pas plus avec il ce se
ne sont nous vous ils elle on mais ou son sa ses leur tout faire comme bien aussi peut fait
dit cette sans être avoir deux temps grand jour monde vie homme main place pays année
après avant encore toujours jamais rien chose petit nouveau dernier premier même autre
quand comment pourquoi donc alors ici là très trop peu beaucoup chaque sous entre vers
chez contre depuis pendant ville maison eau terre air feu mot nom idée travail école
livre porte route nuit soir matin heure semaine mois ami femme enfant père mère famille
groupe point part fin cas fois question raison besoin force forme partie histoire effet
donner prendre venir voir savoir pouvoir vouloir aller dire mettre passer trouver rendre
parler aimer croire tenir porter demander rester sembler laisser penser suivre comprendre
connaître devenir sortir entrer partir arriver écrire lire jouer ouvrir vivre apprendre
blanc noir rouge vert bleu clair simple facile long court haut bas fort doux vrai juste
dernier seul plein libre prêt sûr ensemble souvent parfois bientôt déjà enfin presque
mer ciel soleil lune arbre fleur pierre champ jardin rue pont gare marché pain café`;

const en = `the of and to a in is it you that he was for on are as with his they at be this have from
or one had by word but not what all were we when your can said there use an each which she
do how their if will up other about out many then them these so some her would make like
him into time has look two more write go see number no way could people my than first
water been call who oil its now find long down day did get come made may part over new
sound take only little work know place year live me back give most very after thing our
just name good sentence man think say great where help through much before line right too
mean old any same tell boy follow came want show also around form three small set put end
does another well large must big even such because turn here why ask went men read need
land different home us move try kind hand picture again change off play spell air away
animal house point page letter mother answer found study still learn should world high
every near add food between own below country plant last school father keep tree never
start city earth eye light thought head under story saw left few while along might close
something seem next hard open example begin life always those both paper together got`;

export const COMMON_WORDS: Record<Locale, readonly string[]> = {
  fr: fr.split(/\s+/).filter(Boolean),
  en: en.split(/\s+/).filter(Boolean),
};

/** Deterministic PRNG (mulberry32) so a seed reproduces the same exercise. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random sequence of words without immediate repetition. */
export function randomWords(words: readonly string[], count: number, random: () => number): string {
  const out: string[] = [];
  while (out.length < count && words.length > 0) {
    const w = words[Math.floor(random() * words.length)];
    if (w !== out[out.length - 1]) out.push(w);
  }
  return out.join(" ");
}
