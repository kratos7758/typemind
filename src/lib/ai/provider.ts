/**
 * AI provider abstraction (ADR-002). One implementation speaks the OpenAI-compatible
 * Chat Completions API, which most free/low-cost providers expose (Groq, OpenRouter,
 * Google Gemini, Ollama, …). No SDK: a typed fetch keeps the dependency surface small.
 */
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompletionResult = {
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type AIErrorCode = "timeout" | "network" | "http_4xx" | "http_429" | "http_5xx" | "bad_response";

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AIError";
  }
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** Asks for a JSON object; returns the raw text (validated by the caller). */
  completeJson(messages: ChatMessage[], options?: { maxTokens?: number; temperature?: number }): Promise<CompletionResult>;
}

export type OpenAICompatibleConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
};

export function openAICompatibleProvider(config: OpenAICompatibleConfig): AIProvider {
  const doFetch = config.fetchImpl ?? fetch;
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    name: "openai-compatible",
    model: config.model,
    async completeJson(messages, options = {}) {
      let response: Response;
      try {
        response = await doFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({
            model: config.model,
            messages,
            temperature: options.temperature ?? 0.8,
            max_tokens: options.maxTokens ?? 900,
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(config.timeoutMs ?? 25_000),
        });
      } catch (error) {
        const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        throw new AIError(isTimeout ? "timeout" : "network", isTimeout ? "AI request timed out" : "AI network error");
      }

      if (!response.ok) {
        const code: AIErrorCode =
          response.status === 429 ? "http_429" : response.status >= 500 ? "http_5xx" : "http_4xx";
        throw new AIError(code, `AI provider returned HTTP ${response.status}`);
      }

      const body = (await response.json().catch(() => null)) as {
        choices?: { message?: { content?: unknown } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      } | null;
      const content = body?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new AIError("bad_response", "Empty AI response");
      return {
        content,
        inputTokens: body?.usage?.prompt_tokens ?? null,
        outputTokens: body?.usage?.completion_tokens ?? null,
      };
    },
  };
}

/** Extracts a JSON object from model output (tolerates ```json fences and stray prose). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AIError("bad_response", "No JSON object in AI response");
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AIError("bad_response", "Malformed JSON in AI response");
  }
}
