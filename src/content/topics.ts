/** Interest topics offered at onboarding. Keys are stable identifiers stored in user_interests. */
export const TOPICS = [
  "technology",
  "programming",
  "science",
  "space",
  "nature",
  "health",
  "sports",
  "finance",
  "business",
  "history",
  "travel",
  "cooking",
] as const;

export type TopicKey = (typeof TOPICS)[number];

export const isTopic = (v: unknown): v is TopicKey => typeof v === "string" && (TOPICS as readonly string[]).includes(v);
