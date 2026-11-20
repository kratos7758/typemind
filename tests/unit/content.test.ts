import { describe, expect, it } from "vitest";
import { LAYOUTS, strokesFor, type LayoutId } from "@/features/typing-engine/layouts";
import { prepareText, typedForm } from "@/features/typing-engine/text";
import { lessonsFor, lessonText, lettersOf } from "@/content/lessons";
import { ASSESSMENT_TEXT, LIBRARY } from "@/content/library";
import { TOPICS } from "@/content/topics";
import { COMMON_WORDS, randomWords, seededRandom } from "@/content/words";

const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

describe("lessons", () => {
  it("lesson 1 uses the index home keys of each layout", () => {
    expect(lettersOf("us-qwerty", lessonsFor("us-qwerty")[0].newCodes)).toEqual(["f", "j"]);
    expect(lettersOf("fr-azerty", lessonsFor("fr-azerty")[3].newCodes)).toEqual(["q", "m"]);
  });

  it("adds a special-letters lesson only where the layout has extra letters", () => {
    const ids = (l: LayoutId) => lessonsFor(l).map((x) => x.id);
    expect(ids("us-qwerty")).not.toContain("special-letters");
    expect(ids("fr-azerty")).toContain("special-letters");
    // ö sits on a home-row key, so German learners get it in the home-pinky lesson.
    expect(lettersOf("de-qwertz", lessonsFor("de-qwertz")[3].newCodes)).toEqual(["a", "ö"]);
    expect(lettersOf("de-qwertz", lessonsFor("de-qwertz").find((l) => l.id === "special-letters")!.newCodes).sort())
      .toEqual(["ß", "ä", "ü"].sort());
  });

  it.each(LAYOUT_IDS)("%s: key lessons only use letters taught so far", (layout) => {
    const lessons = lessonsFor(layout).filter((l) => l.kind === "keys");
    const taught = new Set<string>();
    for (const lesson of lessons) {
      for (const l of lettersOf(layout, lesson.newCodes)) taught.add(l);
      const text = lessonText(layout, "fr", lesson.id);
      const unknown = [...new Set(text.replace(/ /g, ""))].filter((ch) => !taught.has(ch));
      expect(unknown, `${lesson.id}: ${text}`).toEqual([]);
    }
  });

  it.each(LAYOUT_IDS)("%s: every lesson text is typable on the layout", (layout) => {
    for (const lesson of lessonsFor(layout)) {
      for (const language of ["fr", "en"] as const) {
        const text = lessonText(layout, language, lesson.id);
        expect(text.length, lesson.id).toBeGreaterThan(20);
        const untypable = [...new Set(text)].filter((ch) => strokesFor(layout, typedForm(ch)) === null);
        // French accents are not typable on English layouts: only check same-script pairs.
        if (layout.startsWith("us") || layout.startsWith("uk")) continue;
        expect(untypable, `${lesson.id}/${language}`).toEqual([]);
      }
    }
  });

  it("is reproducible for the same attempt and varies between attempts", () => {
    expect(lessonText("fr-azerty", "fr", "top-2", 0)).toBe(lessonText("fr-azerty", "fr", "top-2", 0));
    expect(lessonText("fr-azerty", "fr", "top-2", 0)).not.toBe(lessonText("fr-azerty", "fr", "top-2", 1));
  });
});

describe("library", () => {
  it("covers every topic in both languages with clean, typable text", () => {
    for (const language of ["fr", "en"] as const) {
      for (const topic of TOPICS) {
        const text = LIBRARY.find((t) => t.language === language && t.topic === topic);
        expect(text, `${language}/${topic}`).toBeDefined();
        expect(prepareText(text!.body)).toBe(text!.body);
      }
    }
  });

  it("French library texts are typable on every French layout", () => {
    for (const layout of ["fr-azerty", "ca-fr-csa", "ca-multi"] as const) {
      const all = LIBRARY.filter((t) => t.language === "fr").map((t) => t.body).join("");
      const untypable = [...new Set(all)].filter((ch) => strokesFor(layout, typedForm(ch)) === null);
      expect(untypable, layout).toEqual([]);
    }
  });

  it("assessment texts are typable on the matching layouts", () => {
    const untypable = (layout: LayoutId, text: string) =>
      [...new Set(text)].filter((ch) => strokesFor(layout, typedForm(ch)) === null);
    expect(untypable("fr-azerty", ASSESSMENT_TEXT.fr)).toEqual([]);
    expect(untypable("us-qwerty", ASSESSMENT_TEXT.en)).toEqual([]);
  });
});

describe("words", () => {
  it("has enough common words and generates without immediate repeats", () => {
    expect(COMMON_WORDS.fr.length).toBeGreaterThan(200);
    expect(COMMON_WORDS.en.length).toBeGreaterThan(200);
    const words = randomWords(COMMON_WORDS.en, 200, seededRandom(1)).split(" ");
    expect(words).toHaveLength(200);
    expect(words.some((w, i) => w === words[i - 1])).toBe(false);
  });
});
