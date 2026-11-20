/**
 * Built-in exercise library (original texts written for TypeMind).
 * Used when AI generation is unavailable, for the assessment, and as the base of
 * interest-based practice. Typographic apostrophes are fine: the engine accepts "'".
 */
import type { Locale } from "@/i18n/config";
import type { TopicKey } from "./topics";

export type LibraryText = { id: string; language: Locale; topic: TopicKey; title: string; body: string };

const fr: Omit<LibraryText, "language">[] = [
  {
    id: "fr-technology-1",
    topic: "technology",
    title: "La course à la miniaturisation",
    body: "Les premiers ordinateurs occupaient des pièces entières. Aujourd'hui, un téléphone tient dans la poche et dépasse largement leur puissance de calcul. Cette miniaturisation repose sur une idée simple : graver des transistors toujours plus petits sur des puces de silicium. Les ingénieurs approchent désormais des limites physiques de la matière et cherchent de nouvelles pistes pour continuer à progresser.",
  },
  {
    id: "fr-programming-1",
    topic: "programming",
    title: "Écrire pour être relu",
    body: "Un bon programme se lit comme un texte clair. Les noms des variables expliquent leur rôle, les fonctions font une seule chose et les tests vérifient que tout fonctionne encore après chaque modification. Écrire du code, c'est d'abord écrire pour les personnes qui le reliront demain, puis pour la machine qui l'exécutera.",
  },
  {
    id: "fr-science-1",
    topic: "science",
    title: "Pourquoi la glace flotte",
    body: "L'eau est l'une des rares substances qui deviennent moins denses en gelant. C'est pour cette raison que la glace flotte à la surface des lacs. Cette couche isole l'eau située en dessous, qui reste liquide pendant l'hiver. Sans cette propriété étonnante, de nombreux poissons et plantes aquatiques ne survivraient pas aux grands froids.",
  },
  {
    id: "fr-space-1",
    topic: "space",
    title: "Regarder le passé",
    body: "La lumière du Soleil met environ huit minutes pour atteindre la Terre. Quand nous regardons le ciel, nous voyons donc toujours le passé. Certaines étoiles visibles à l'oeil nu sont si lointaines que leur lumière a voyagé pendant des siècles avant d'arriver jusqu'à nous.",
  },
  {
    id: "fr-nature-1",
    topic: "nature",
    title: "Le réveil de la forêt",
    body: "Au printemps, les forêts du Québec se transforment en quelques semaines. Les érables produisent leur sève, les oiseaux migrateurs reviennent du sud et le sol se couvre de jeunes pousses. Observer ce renouveau, c'est comprendre à quel point chaque espèce dépend des autres pour vivre.",
  },
  {
    id: "fr-health-1",
    topic: "health",
    title: "La force de la régularité",
    body: "Marcher trente minutes par jour améliore le sommeil, l'humeur et la concentration. Il n'est pas nécessaire de courir un marathon pour en ressentir les bienfaits : la régularité compte davantage que l'intensité. Le plus difficile reste souvent de commencer, puis de transformer cet effort en habitude.",
  },
  {
    id: "fr-sports-1",
    topic: "sports",
    title: "Lire le jeu",
    body: "Au hockey, une rondelle peut dépasser cent cinquante kilomètres à l'heure lors d'un tir frappé. Les gardiens disposent alors d'une fraction de seconde pour réagir. Leur secret tient moins aux réflexes qu'à la lecture du jeu : ils anticipent la trajectoire bien avant que le tir ne parte.",
  },
  {
    id: "fr-finance-1",
    topic: "finance",
    title: "Les intérêts composés",
    body: "Le principe des intérêts composés est simple : les gains produisent à leur tour des gains. Un petit montant placé tôt et régulièrement peut ainsi devenir important avec le temps. Par exemple, 100 $ placés chaque mois pendant 20 ans représentent 24 000 $ d'épargne, mais leur valeur finale peut être bien supérieure. La patience est souvent plus rentable que la recherche du placement parfait.",
  },
  {
    id: "fr-business-1",
    topic: "business",
    title: "Confirmer une rencontre",
    body: "Bonjour Madame Tremblay,\nJe vous remercie pour votre message de ce matin. Je vous confirme notre rencontre jeudi prochain à 14 h, dans nos bureaux du centre-ville. Vous trouverez ci-joint l'ordre du jour ainsi que le rapport trimestriel. N'hésitez pas à me contacter si vous avez des questions.\nCordialement,\nJulien Martin",
  },
  {
    id: "fr-history-1",
    topic: "history",
    title: "L'imprimerie change le monde",
    body: "L'imprimerie de Gutenberg, vers 1450, a bouleversé la circulation des idées en Europe. Avant elle, chaque livre était copié à la main, ce qui pouvait prendre des mois. En quelques décennies, des millions d'ouvrages ont été imprimés, et la lecture a peu à peu cessé d'être le privilège d'une petite élite.",
  },
  {
    id: "fr-travel-1",
    topic: "travel",
    title: "Le long du fleuve",
    body: "Voyager en train permet de voir défiler les paysages sans se soucier de la route. Entre Montréal et Québec, le trajet longe le fleuve Saint-Laurent et traverse de petits villages aux clochers argentés. On arrive reposé, avec le sentiment d'avoir vraiment parcouru la distance.",
  },
  {
    id: "fr-cooking-1",
    topic: "cooking",
    title: "Des crêpes réussies",
    body: "Pour réussir une pâte à crêpes, mélangez d'abord la farine et les oeufs, puis ajoutez le lait petit à petit en fouettant. Laissez reposer la pâte une heure au frais. Faites chauffer une poêle légèrement beurrée et versez une petite louche de pâte. Retournez la crêpe lorsque les bords commencent à dorer.",
  },
];

const en: Omit<LibraryText, "language">[] = [
  {
    id: "en-technology-1",
    topic: "technology",
    title: "The race to shrink",
    body: "The first computers filled entire rooms. Today, a phone fits in your pocket and is far more powerful than they ever were. This shrinking rests on a simple idea: etch ever smaller transistors onto silicon chips. Engineers are now approaching the physical limits of matter and are searching for new ways to keep making progress.",
  },
  {
    id: "en-programming-1",
    topic: "programming",
    title: "Write code to be read",
    body: "A good program reads like clear prose. Variable names explain their purpose, each function does one thing, and tests confirm that everything still works after every change. Writing code is first about writing for the people who will read it tomorrow, and only then for the machine that will run it.",
  },
  {
    id: "en-science-1",
    topic: "science",
    title: "Why ice floats",
    body: "Water is one of the few substances that becomes less dense when it freezes. That is why ice floats on the surface of lakes. This layer insulates the water beneath it, which stays liquid through the winter. Without this surprising property, many fish and aquatic plants would not survive the cold months.",
  },
  {
    id: "en-space-1",
    topic: "space",
    title: "Looking into the past",
    body: "Sunlight takes about eight minutes to reach the Earth. Whenever we look at the sky, we are seeing the past. Some stars visible to the naked eye are so far away that their light travelled for centuries before it finally reached us.",
  },
  {
    id: "en-nature-1",
    topic: "nature",
    title: "The forest wakes up",
    body: "In spring, the forests of eastern Canada change in just a few weeks. Maple trees send up their sap, migrating birds return from the south, and the ground fills with young shoots. Watching this renewal shows how much every species depends on the others to survive.",
  },
  {
    id: "en-health-1",
    topic: "health",
    title: "The power of routine",
    body: "Walking for thirty minutes a day can improve sleep, mood and focus. You do not need to run a marathon to feel the benefits: consistency matters more than intensity. The hardest part is usually getting started, and then turning that effort into a habit.",
  },
  {
    id: "en-sports-1",
    topic: "sports",
    title: "Reading the play",
    body: "In hockey, a slapshot can send the puck flying at more than ninety miles per hour. Goalies have only a fraction of a second to react. Their secret is less about reflexes than about reading the play: they anticipate the shot long before it is released.",
  },
  {
    id: "en-finance-1",
    topic: "finance",
    title: "Compound interest",
    body: "The idea behind compound interest is simple: your gains start producing gains of their own. A small amount invested early and regularly can grow into something significant over time. For example, saving $100 every month for 20 years adds up to $24,000 in deposits, yet the final value can be much higher. Patience often pays better than chasing the perfect investment.",
  },
  {
    id: "en-business-1",
    topic: "business",
    title: "Confirming a meeting",
    body: "Hello Ms. Patel,\nThank you for your message this morning. I am writing to confirm our meeting next Thursday at 2:00 p.m. at our downtown office. Please find the agenda and the quarterly report attached. Do not hesitate to contact me if you have any questions.\nBest regards,\nDaniel Moore",
  },
  {
    id: "en-history-1",
    topic: "history",
    title: "The press changes everything",
    body: "Gutenberg's printing press, around 1450, transformed the way ideas spread across Europe. Before it, every book was copied by hand, which could take months. Within a few decades, millions of volumes had been printed, and reading slowly stopped being the privilege of a small elite.",
  },
  {
    id: "en-travel-1",
    topic: "travel",
    title: "Along the river",
    body: "Travelling by train lets you watch the scenery roll by without worrying about the road. Between Montreal and Quebec City, the line follows the St. Lawrence River and passes small villages with silver church spires. You arrive rested, with the feeling of having truly covered the distance.",
  },
  {
    id: "en-cooking-1",
    topic: "cooking",
    title: "Perfect pancakes",
    body: "To make a good pancake batter, first whisk the flour and eggs together, then slowly add the milk while stirring. Let the batter rest in the fridge for an hour. Heat a lightly buttered pan and pour in a small ladle of batter. Flip the pancake when the edges start to turn golden.",
  },
];

export const LIBRARY: readonly LibraryText[] = [
  ...fr.map((t) => ({ ...t, language: "fr" as const })),
  ...en.map((t) => ({ ...t, language: "en" as const })),
];

export const getLibraryText = (id: string) => LIBRARY.find((t) => t.id === id);

/** Fixed, comparable texts for the placement test (same for every user of a language). */
export const ASSESSMENT_TEXT: Record<Locale, string> = {
  fr: "Apprendre à taper sans regarder le clavier demande un peu de patience, mais les progrès arrivent vite. Les doigts mémorisent la place de chaque touche, et l'attention peut enfin se porter sur les idées plutôt que sur les lettres. Quelques minutes de pratique chaque jour suffisent pour sentir la différence après deux ou trois semaines. Le plus important est de rester précis : la vitesse vient naturellement avec la régularité.",
  en: "Learning to type without looking at the keyboard takes a little patience, but progress comes quickly. Your fingers memorize where each key is, and your attention can finally move to ideas instead of letters. A few minutes of practice each day is enough to notice a difference after two or three weeks. The most important thing is to stay accurate: speed comes naturally with regular practice.",
};
