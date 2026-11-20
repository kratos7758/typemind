import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at first use.
 * Missing optional integrations (AI, Stripe) disable the feature explicitly
 * instead of pretending it works.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().startsWith("postgres"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

  AI_PROVIDER: z.enum(["none", "openai-compatible"]).default("none"),
  AI_BASE_URL: z.url().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  /** Test-only override to target stripe-mock (e.g. 127.0.0.1:12111 over http). */
  STRIPE_API_HOST: z.string().optional(),
  STRIPE_API_PORT: z.coerce.number().int().optional(),
  STRIPE_API_PROTOCOL: z.enum(["http", "https"]).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  // `KEY=` in a .env file yields "", which means "not set" for us.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const parsed = serverSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment. Check .env.local (see .env.example): ${fields}`);
  }
  if (parsed.data.AI_PROVIDER === "openai-compatible") {
    const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = parsed.data;
    if (!AI_BASE_URL || !AI_API_KEY || !AI_MODEL) {
      throw new Error("AI_PROVIDER=openai-compatible requires AI_BASE_URL, AI_API_KEY and AI_MODEL.");
    }
  }
  cached = parsed.data;
  return cached;
}
