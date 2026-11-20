import { describe, expect, it } from "vitest";
import { recommend, type RecommendInput } from "@/features/learning/recommend";
import { lessonsFor } from "@/content/lessons";

const base: RecommendInput = {
  skillLevel: "intermediate",
  experience: "intermediate",
  lessons: lessonsFor("fr-azerty"),
  passedLessons: new Set(),
  contentLanguage: "fr",
  interests: ["science", "finance"],
  recentExerciseKeys: [],
};

describe("recommend", () => {
  it("asks for the assessment first", () => {
    expect(recommend({ ...base, skillLevel: null })).toMatchObject({ kind: "assessment", reason: { code: "no_assessment" } });
  });

  it("beginners follow the course, from the first lesson not yet passed", () => {
    const r = recommend({ ...base, skillLevel: "beginner", passedLessons: new Set(["home-index", "home-middle"]) });
    expect(r).toMatchObject({ kind: "lesson", id: "home-ring" });
  });

  it("two-finger typists follow the course even with a decent assessment", () => {
    expect(recommend({ ...base, experience: "never" }).kind).toBe("lesson");
  });

  it("the measured level wins over a modest self-assessment", () => {
    expect(recommend({ ...base, experience: "beginner", skillLevel: "expert" }).kind).toBe("text");
    expect(recommend({ ...base, experience: "never", skillLevel: "advanced" }).kind).toBe("text");
  });

  it("others get a text about their interests, least recently practiced first", () => {
    const r = recommend({ ...base, recentExerciseKeys: ["lib:fr-science-1"] });
    expect(r).toMatchObject({ kind: "text", id: "fr-finance-1" });
  });

  it("falls back to any text in the language when interests have no match", () => {
    const r = recommend({ ...base, interests: [] });
    expect(r.kind).toBe("text");
  });

  it("moves on to texts once every lesson is passed", () => {
    const all = new Set(base.lessons.map((l) => l.id));
    expect(recommend({ ...base, skillLevel: "novice", passedLessons: all }).kind).toBe("text");
  });
});
