/**
 * Text helpers shared by the engine and the UI.
 * Pure functions, no DOM, no React.
 */

/**
 * Prepares exercise text: NFC, unified line breaks, trailing whitespace removed,
 * "…" → "...", and ligatures that no standard layout can type (œ, æ) spelled out.
 */
export function prepareText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/…/g, "...")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "Oe")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "Ae")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Splits into user-perceived characters (code points; NFC keeps accents composed). */
export function toChars(text: string): string[] {
  return Array.from(text.normalize("NFC"));
}

/**
 * Characters that are hard or impossible to type on common layouts are accepted
 * under their keyboard equivalent. The displayed text keeps the original glyph.
 */
const EQUIVALENTS: Record<string, readonly string[]> = {
  "’": ["'"], // ’
  "‘": ["'"], // ‘
  "ʼ": ["'"], // ʼ
  "“": ['"'], // “
  "”": ['"'], // ”
  "«": ['"'], // «
  "»": ['"'], // »
  "–": ["-"], // –
  "—": ["-"], // —
  "−": ["-"], // −
  " ": [" "], // no-break space (French typography)
  " ": [" "], // narrow no-break space
  " ": [" "], // thin space
  // Accented capitals have no key on standard French AZERTY: the unaccented capital
  // (common practice in France) is accepted. Layouts that have them still show them.
  "É": ["E"],
  "È": ["E"],
  "Ê": ["E"],
  "À": ["A"],
  "Â": ["A"],
  "Ç": ["C"],
  "Ù": ["U"],
  "Î": ["I"],
  "Ô": ["O"],
};

export function charsMatch(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  return EQUIVALENTS[expected]?.includes(actual) ?? false;
}

/** The character a user should press for `expected` (used for keyboard hints). */
export function typedForm(expected: string): string {
  return EQUIVALENTS[expected]?.[0] ?? expected;
}

export const isWhitespace = (ch: string) => /\s/.test(typedForm(ch));
