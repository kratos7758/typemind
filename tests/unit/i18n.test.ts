import { describe, expect, it } from "vitest";
import { negotiateLocale } from "@/i18n/config";
import { format } from "@/lib/utils";
import fr from "@/i18n/messages/fr.json";
import en from "@/i18n/messages/en.json";

describe("negotiateLocale", () => {
  it.each([
    [null, "fr"],
    ["en-US,en;q=0.9", "en"],
    ["fr-CA,fr;q=0.9,en;q=0.8", "fr"],
    ["de-DE,de;q=0.9,en;q=0.5", "en"],
    ["es-ES", "fr"],
    ["en;q=0.4,fr;q=0.8", "fr"],
  ])("%s → %s", (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });
});

describe("format", () => {
  it("replaces known placeholders and keeps unknown ones", () => {
    expect(format("Hi {name}, {missing}", { name: "Léa" })).toBe("Hi Léa, {missing}");
  });
});

/** Every key present in French must exist in English and vice versa. */
function keyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

describe("translations", () => {
  it("fr and en dictionaries have the same keys", () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(fr).sort());
  });
});
