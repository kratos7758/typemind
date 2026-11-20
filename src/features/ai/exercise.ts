/**
 * AI exercise generation — prompt and output validation (pure, unit-tested).
 * The learning engine decides WHAT to practice (targets, level); the model only writes text.
 */
import { z } from "zod";
import type { Locale } from "@/i18n/config";
import type { ChatMessage } from "@/lib/ai/provider";
import { strokesFor, type LayoutId } from "@/features/typing-engine/layouts";
import { prepareText, typedForm } from "@/features/typing-engine/text";
import type { SkillLevel } from "@/features/learning/profile";
import type { TopicKey } from "@/content/topics";

export type ExerciseRequest = {
  language: Locale;
  layoutId: LayoutId;
  topic: TopicKey;
  skillLevel: SkillLevel | null;
  weakKeys: readonly string[];
  weakBigrams: readonly string[];
};

const LENGTH_BY_LEVEL: Record<SkillLevel | "unknown", [number, number]> = {
  novice: [200, 320],
  beginner: [250, 400],
  intermediate: [350, 550],
  advanced: [450, 700],
  expert: [550, 850],
  unknown: [300, 450],
};

const TOPIC_NAMES: Record<Locale, Record<TopicKey, string>> = {
  fr: {
    technology: "la technologie", programming: "la programmation", science: "les sciences", space: "l'espace",
    nature: "la nature", health: "la santé", sports: "le sport", finance: "la finance personnelle",
    business: "le monde professionnel", history: "l'histoire", travel: "le voyage", cooking: "la cuisine",
  },
  en: {
    technology: "technology", programming: "programming", science: "science", space: "space",
    nature: "nature", health: "health", sports: "sports", finance: "personal finance",
    business: "the workplace", history: "history", travel: "travel", cooking: "cooking",
  },
};

export function buildExercisePrompt(req: ExerciseRequest): ChatMessage[] {
  const [min, max] = LENGTH_BY_LEVEL[req.skillLevel ?? "unknown"];
  const language = req.language === "fr" ? "French" : "English";
  const targets = [...req.weakKeys, ...req.weakBigrams];

  const system = [
    "You write short typing-practice texts for an educational app used by people aged 14 and over.",
    `Write in natural, correct ${language}${req.language === "fr" ? " (standard French spelling, no regional slang)" : ""}.`,
    "The text must be interesting, factual and readable: a short informative passage, not a list.",
    "Never repeat letters or words artificially to hit targets; quality comes first.",
    "Use only letters, digits, spaces and common punctuation (. , ; : ! ? ' \" - ( )). No emoji, no markdown, no bullet points, no line breaks.",
    "Do not include personal data, URLs, violence, sexual content, or advice that could be harmful.",
    'Reply with a JSON object only: {"title": string, "text": string, "objective": string, "explanation": string}.',
    `"objective" and "explanation" are one short sentence each, in ${language}, addressed to the learner.`,
  ].join("\n");

  const user = [
    `Topic: ${TOPIC_NAMES[req.language][req.topic]}.`,
    `Length of "text": between ${min} and ${max} characters.`,
    targets.length
      ? `The learner struggles with these characters or letter pairs: ${targets.join(", ")}. Choose vocabulary where they appear naturally and often.`
      : "No specific weak keys yet: use varied, everyday vocabulary.",
    `Learner level: ${req.skillLevel ?? "unknown"}. ${
      req.skillLevel === "novice" || req.skillLevel === "beginner"
        ? "Prefer short sentences and common words."
        : "Normal sentence length is fine."
    }`,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export const aiExerciseSchema = z.object({
  title: z.string().trim().min(3).max(80),
  text: z.string().trim().min(1).max(3000),
  objective: z.string().trim().max(200).optional(),
  explanation: z.string().trim().max(300).optional(),
});

export type ValidatedExercise = {
  title: string;
  text: string;
  objective: string | null;
  explanation: string | null;
  targetChars: string[];
  difficulty: number;
};

export type ValidationFailure = { ok: false; reason: "schema" | "length" | "language" | "untypable" };

const LANGUAGE_MARKERS: Record<Locale, string[]> = {
  fr: [" le ", " la ", " les ", " de ", " des ", " et ", " est ", " un ", " une ", " pour "],
  en: [" the ", " and ", " of ", " to ", " is ", " in ", " a ", " for ", " with "],
};

/** At least three distinct function words of the expected language. */
export function looksLikeLanguage(text: string, language: Locale): boolean {
  const padded = ` ${text.toLowerCase()} `;
  return LANGUAGE_MARKERS[language].filter((m) => padded.includes(m)).length >= 3;
}

/** Rough 1–10 difficulty from punctuation, digits, capitals, accents and word length. */
export function estimateDifficulty(text: string): number {
  const chars = Array.from(text);
  const ratio = (re: RegExp) => chars.filter((c) => re.test(c)).length / chars.length;
  const words = text.split(/\s+/).filter(Boolean);
  const avgWord = words.reduce((a, w) => a + w.length, 0) / Math.max(1, words.length);
  const score =
    2 + ratio(/[.,;:!?'"()-]/) * 40 + ratio(/\d/) * 60 + ratio(/\p{Lu}/u) * 30 + ratio(/[^\x00-\x7F]/) * 40 + (avgWord - 4) * 0.8;
  return Math.min(10, Math.max(1, Math.round(score)));
}

/**
 * Validates and cleans model output. Symbols the layout cannot produce are removed;
 * letters it cannot produce make the text invalid (we never silently change words).
 */
export function validateExercise(raw: unknown, req: ExerciseRequest): ValidatedExercise | ValidationFailure {
  const parsed = aiExerciseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "schema" };

  let text = prepareText(parsed.data.text.replace(/\s*\n+\s*/g, " "));
  text = Array.from(text)
    .filter((ch) => /\p{L}/u.test(ch) || strokesFor(req.layoutId, ch) || strokesFor(req.layoutId, typedForm(ch)))
    .join("")
    .replace(/ {2,}/g, " ")
    .trim();

  const [min, max] = LENGTH_BY_LEVEL[req.skillLevel ?? "unknown"];
  const length = Array.from(text).length;
  if (length < min * 0.6 || length > max * 1.6) return { ok: false, reason: "length" };
  if (!looksLikeLanguage(text, req.language)) return { ok: false, reason: "language" };

  const untypableLetters = Array.from(new Set(text)).filter(
    (ch) => /\p{L}/u.test(ch) && !strokesFor(req.layoutId, ch) && !strokesFor(req.layoutId, typedForm(ch)),
  );
  if (untypableLetters.length) return { ok: false, reason: "untypable" };

  const lower = text.toLowerCase();
  const targetChars = [...req.weakKeys, ...req.weakBigrams].filter((t) => lower.includes(t.toLowerCase()));

  return {
    title: parsed.data.title.replace(/["«»]/g, "").trim(),
    text,
    objective: parsed.data.objective ?? null,
    explanation: parsed.data.explanation ?? null,
    targetChars,
    difficulty: estimateDifficulty(text),
  };
}

export const isValidationFailure = (v: ValidatedExercise | ValidationFailure): v is ValidationFailure =>
  "ok" in v && v.ok === false;
