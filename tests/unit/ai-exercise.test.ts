import { describe, expect, it, vi } from "vitest";
import {
  buildExercisePrompt,
  estimateDifficulty,
  isValidationFailure,
  looksLikeLanguage,
  validateExercise,
  type ExerciseRequest,
} from "@/features/ai/exercise";
import { AIError, extractJson, openAICompatibleProvider } from "@/lib/ai/provider";

const req: ExerciseRequest = {
  language: "fr",
  layoutId: "fr-azerty",
  topic: "science",
  skillLevel: "intermediate",
  weakKeys: ["r", "t"],
  weakBigrams: ["tr"],
};

const goodText =
  "Les tremblements de terre se produisent lorsque les plaques de la croûte terrestre se déplacent brusquement. " +
  "Les sismologues mesurent leur force et tentent de prévoir les zones à risque. Grâce à des capteurs très précis, " +
  "ils détectent des vibrations invisibles et transmettent des alertes en quelques secondes pour protéger la population.";

describe("buildExercisePrompt", () => {
  it("includes the topic, the targets and the length for the level", () => {
    const [system, user] = buildExercisePrompt(req);
    expect(system.content).toContain("French");
    expect(system.content).toContain("JSON");
    expect(user.content).toContain("les sciences");
    expect(user.content).toContain("r, t, tr");
    expect(user.content).toContain("between 350 and 550");
  });
});

describe("validateExercise", () => {
  it("accepts a good text and records which targets it covers", () => {
    const v = validateExercise({ title: "« Séismes »", text: goodText, objective: "o", explanation: "e" }, req);
    expect(isValidationFailure(v)).toBe(false);
    if (isValidationFailure(v)) return;
    expect(v.title).toBe("Séismes");
    expect(v.targetChars).toEqual(["r", "t", "tr"]);
    expect(v.difficulty).toBeGreaterThanOrEqual(1);
  });

  it("removes symbols the layout cannot type and joins lines", () => {
    const v = validateExercise({ title: "Test", text: `${goodText} 🚀\nEt voilà ✓ la fin.` }, req);
    expect(isValidationFailure(v)).toBe(false);
    if (!isValidationFailure(v)) {
      expect(v.text).not.toMatch(/[🚀✓\n]/u);
      expect(v.text.endsWith("Et voilà la fin.")).toBe(true);
    }
  });

  it.each([
    [{ title: "x" }, "schema"],
    [{ title: "Titre", text: "Trop court." }, "length"],
    [{ title: "Title", text: "The quick brown fox jumps over the lazy dog and runs to the forest in the evening. ".repeat(5) }, "language"],
  ])("rejects %j as %s", (raw, reason) => {
    expect(validateExercise(raw, req)).toEqual({ ok: false, reason });
  });

  it("rejects letters the layout cannot produce rather than altering words", () => {
    const v = validateExercise({ title: "Titre", text: `${goodText} Le mot ñandú vient d'Amérique du Sud.` }, req);
    expect(v).toEqual({ ok: false, reason: "untypable" });
  });
});

describe("helpers", () => {
  it("language detection", () => {
    expect(looksLikeLanguage(goodText, "fr")).toBe(true);
    expect(looksLikeLanguage(goodText, "en")).toBe(false);
  });

  it("difficulty grows with punctuation, digits and capitals", () => {
    expect(estimateDifficulty("le chat dort sur le tapis")).toBeLessThan(
      estimateDifficulty("En 1450, Gutenberg (Mayence) imprime 180 Bibles ; « Quel succès ! »"),
    );
  });

  it("extractJson tolerates fences and prose", () => {
    expect(extractJson('Voici :\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('{"a": {"b": 2}} trailing')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("no json here")).toThrow(AIError);
  });
});

describe("openAICompatibleProvider", () => {
  const response = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

  it("sends an OpenAI-style request and reads content + usage", async () => {
    const fetchImpl = vi.fn(() =>
      response(200, { choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
    );
    const p = openAICompatibleProvider({ baseUrl: "https://api.example.com/v1/", apiKey: "k", model: "m", fetchImpl });
    const r = await p.completeJson([{ role: "user", content: "hi" }]);
    expect(r).toEqual({ content: '{"ok":true}', inputTokens: 10, outputTokens: 5 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "m", response_format: { type: "json_object" } });
  });

  it.each([
    [429, "http_429"],
    [500, "http_5xx"],
    [401, "http_4xx"],
  ])("maps HTTP %s to %s", async (status, code) => {
    const p = openAICompatibleProvider({ baseUrl: "https://x", apiKey: "k", model: "m", fetchImpl: () => response(status, {}) });
    await expect(p.completeJson([])).rejects.toMatchObject({ code });
  });

  it("reports network failures and empty responses", async () => {
    const broken = openAICompatibleProvider({ baseUrl: "https://x", apiKey: "k", model: "m", fetchImpl: () => Promise.reject(new TypeError("fail")) });
    await expect(broken.completeJson([])).rejects.toMatchObject({ code: "network" });
    const empty = openAICompatibleProvider({ baseUrl: "https://x", apiKey: "k", model: "m", fetchImpl: () => response(200, { choices: [] }) });
    await expect(empty.completeJson([])).rejects.toMatchObject({ code: "bad_response" });
  });
});
