/**
 * Keyboard layouts as data (ADR-014).
 *
 * Keys are identified by their physical position (`KeyboardEvent.code`), so the
 * same geometry and finger map serve every layout. Each layout maps a code to the
 * characters produced at levels [base, shift, altgr]. A value prefixed with "dead:"
 * is a dead key (e.g. AZERTY "^" then "e" → "ê").
 *
 * Finger assignments follow standard touch-typing practice. The browser cannot
 * know which finger was actually used — this is a recommendation only.
 *
 * ⚠ Layouts were transcribed from Windows reference layouts; AltGr levels of the
 *   Canadian layouts in particular should be validated by native users before launch.
 */

export type Finger =
  | "l-pinky"
  | "l-ring"
  | "l-middle"
  | "l-index"
  | "thumb"
  | "r-index"
  | "r-middle"
  | "r-ring"
  | "r-pinky";

export type LayoutId = "fr-azerty" | "ca-fr-csa" | "ca-multi" | "us-qwerty" | "uk-qwerty" | "de-qwertz";

type Level = string | undefined;
type KeyLevels = readonly [base: Level, shift?: Level, altgr?: Level];

export type LayoutDefinition = {
  id: LayoutId;
  form: "ansi" | "iso";
  keys: Readonly<Record<string, KeyLevels>>;
};

// ---------------------------------------------------------------------------
// Geometry (shared)
// ---------------------------------------------------------------------------

export const ROWS = {
  E: ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"],
  D: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
  C: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"],
  B: ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"],
} as const;

/** Home-row anchor keys (have a tactile bump on physical keyboards). */
export const HOME_KEYS = new Set(["KeyF", "KeyJ"]);

const COLUMN_FINGERS: Finger[] = [
  "l-pinky", "l-ring", "l-middle", "l-index", "l-index",
  "r-index", "r-index", "r-middle", "r-ring", "r-pinky", "r-pinky", "r-pinky", "r-pinky",
];

export const FINGER_BY_CODE: Readonly<Record<string, Finger>> = (() => {
  const map: Record<string, Finger> = {
    Backquote: "l-pinky",
    IntlBackslash: "l-pinky",
    Backslash: "r-pinky",
    Space: "thumb",
    Enter: "r-pinky",
    ShiftLeft: "l-pinky",
    ShiftRight: "r-pinky",
    AltRight: "thumb",
  };
  ROWS.E.slice(1).forEach((code, i) => (map[code] = COLUMN_FINGERS[i]));
  for (const row of [ROWS.D, ROWS.C, ROWS.B]) row.forEach((code, i) => (map[code] = COLUMN_FINGERS[i]));
  return map;
})();

export const isLeftHand = (f: Finger) => f.startsWith("l-");

// ---------------------------------------------------------------------------
// Dead keys
// ---------------------------------------------------------------------------

const DEAD_COMPOSE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "^": { a: "â", e: "ê", i: "î", o: "ô", u: "û", A: "Â", E: "Ê", I: "Î", O: "Ô", U: "Û", " ": "^" },
  "¨": { a: "ä", e: "ë", i: "ï", o: "ö", u: "ü", y: "ÿ", A: "Ä", E: "Ë", I: "Ï", O: "Ö", U: "Ü", " ": "¨" },
  "`": { a: "à", e: "è", i: "ì", o: "ò", u: "ù", A: "À", E: "È", I: "Ì", O: "Ò", U: "Ù", " ": "`" },
  "´": { a: "á", e: "é", i: "í", o: "ó", u: "ú", y: "ý", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú", " ": "´" },
  "~": { a: "ã", o: "õ", n: "ñ", A: "Ã", O: "Õ", N: "Ñ", " ": "~" },
};

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

/** Letters a–z on their QWERTY positions (base lower-case, shift upper-case). */
function letters(overrides: Record<string, string> = {}): Record<string, KeyLevels> {
  const out: Record<string, KeyLevels> = {};
  for (const ch of "abcdefghijklmnopqrstuvwxyz") {
    const code = `Key${ch.toUpperCase()}`;
    const letter = overrides[code] ?? ch;
    out[code] = [letter, letter.toUpperCase()];
  }
  return out;
}

const US: LayoutDefinition = {
  id: "us-qwerty",
  form: "ansi",
  keys: {
    ...letters(),
    Backquote: ["`", "~"],
    Digit1: ["1", "!"], Digit2: ["2", "@"], Digit3: ["3", "#"], Digit4: ["4", "$"], Digit5: ["5", "%"],
    Digit6: ["6", "^"], Digit7: ["7", "&"], Digit8: ["8", "*"], Digit9: ["9", "("], Digit0: ["0", ")"],
    Minus: ["-", "_"], Equal: ["=", "+"],
    BracketLeft: ["[", "{"], BracketRight: ["]", "}"], Backslash: ["\\", "|"],
    Semicolon: [";", ":"], Quote: ["'", '"'],
    Comma: [",", "<"], Period: [".", ">"], Slash: ["/", "?"],
  },
};

const UK: LayoutDefinition = {
  id: "uk-qwerty",
  form: "iso",
  keys: {
    ...letters(),
    Backquote: ["`", "¬", "¦"],
    Digit1: ["1", "!"], Digit2: ["2", '"'], Digit3: ["3", "£"], Digit4: ["4", "$", "€"], Digit5: ["5", "%"],
    Digit6: ["6", "^"], Digit7: ["7", "&"], Digit8: ["8", "*"], Digit9: ["9", "("], Digit0: ["0", ")"],
    Minus: ["-", "_"], Equal: ["=", "+"],
    BracketLeft: ["[", "{"], BracketRight: ["]", "}"],
    Semicolon: [";", ":"], Quote: ["'", "@"], Backslash: ["#", "~"],
    IntlBackslash: ["\\", "|"],
    Comma: [",", "<"], Period: [".", ">"], Slash: ["/", "?"],
  },
};

const FR_AZERTY: LayoutDefinition = {
  id: "fr-azerty",
  form: "iso",
  keys: {
    ...letters({ KeyQ: "a", KeyA: "q", KeyW: "z", KeyZ: "w", KeyM: "," }),
    KeyE: ["e", "E", "€"],
    Backquote: ["²"],
    Digit1: ["&", "1"],
    Digit2: ["é", "2", "dead:~"],
    Digit3: ['"', "3", "#"],
    Digit4: ["'", "4", "{"],
    Digit5: ["(", "5", "["],
    Digit6: ["-", "6", "|"],
    Digit7: ["è", "7", "dead:`"],
    Digit8: ["_", "8", "\\"],
    Digit9: ["ç", "9", "^"],
    Digit0: ["à", "0", "@"],
    Minus: [")", "°", "]"],
    Equal: ["=", "+", "}"],
    BracketLeft: ["dead:^", "dead:¨"],
    BracketRight: ["$", "£", "¤"],
    Semicolon: ["m", "M"],
    Quote: ["ù", "%"],
    Backslash: ["*", "µ"],
    IntlBackslash: ["<", ">"],
    KeyM: [",", "?"],
    Comma: [";", "."],
    Period: [":", "/"],
    Slash: ["!", "§"],
  },
};

const CA_CSA: LayoutDefinition = {
  id: "ca-fr-csa",
  form: "iso",
  keys: {
    ...letters(),
    KeyZ: ["z", "Z", "«"],
    KeyX: ["x", "X", "»"],
    Backquote: ["/", "\\", "|"],
    Digit1: ["1", "!"], Digit2: ["2", "@"], Digit3: ["3", "#"], Digit4: ["4", "$"], Digit5: ["5", "%"],
    Digit6: ["6", "?"], Digit7: ["7", "&", "{"], Digit8: ["8", "*", "}"], Digit9: ["9", "(", "["],
    Digit0: ["0", ")", "]"],
    Minus: ["-", "_"], Equal: ["=", "+", "¬"],
    BracketLeft: ["dead:^", "dead:¨", "dead:`"],
    BracketRight: ["ç", "Ç", "dead:~"],
    Semicolon: [";", ":", "°"],
    Quote: ["è", "È"],
    Backslash: ["à", "À"],
    IntlBackslash: ["ù", "Ù"],
    Comma: [",", "'", "<"],
    Period: [".", '"', ">"],
    Slash: ["é", "É"],
  },
};

const DE_QWERTZ: LayoutDefinition = {
  id: "de-qwertz",
  form: "iso",
  keys: {
    ...letters({ KeyY: "z", KeyZ: "y" }),
    KeyQ: ["q", "Q", "@"],
    KeyE: ["e", "E", "€"],
    KeyM: ["m", "M", "µ"],
    Backquote: ["dead:^", "°"],
    Digit1: ["1", "!"], Digit2: ["2", '"', "²"], Digit3: ["3", "§", "³"], Digit4: ["4", "$"], Digit5: ["5", "%"],
    Digit6: ["6", "&"], Digit7: ["7", "/", "{"], Digit8: ["8", "(", "["], Digit9: ["9", ")", "]"],
    Digit0: ["0", "=", "}"],
    Minus: ["ß", "?", "\\"],
    Equal: ["dead:´", "dead:`"],
    BracketLeft: ["ü", "Ü"],
    BracketRight: ["+", "*", "~"],
    Semicolon: ["ö", "Ö"],
    Quote: ["ä", "Ä"],
    Backslash: ["#", "'"],
    IntlBackslash: ["<", ">", "|"],
    Comma: [",", ";"], Period: [".", ":"], Slash: ["-", "_"],
  },
};

export const LAYOUTS: Readonly<Record<LayoutId, LayoutDefinition>> = {
  "fr-azerty": FR_AZERTY,
  "ca-fr-csa": CA_CSA,
  // Canadian Multilingual Standard: identical to CSA on the levels we teach (base/shift/AltGr).
  "ca-multi": { ...CA_CSA, id: "ca-multi" },
  "us-qwerty": US,
  "uk-qwerty": UK,
  "de-qwertz": DE_QWERTZ,
};

export const isLayoutId = (v: unknown): v is LayoutId => typeof v === "string" && v in LAYOUTS;

// ---------------------------------------------------------------------------
// Character → key strokes
// ---------------------------------------------------------------------------

export type Stroke = {
  code: string;
  shift: boolean;
  altgr: boolean;
  finger: Finger;
  /** Which Shift key to use (opposite hand), when shift is needed. */
  shiftCode?: "ShiftLeft" | "ShiftRight";
};

type DirectEntry = { code: string; level: 0 | 1 | 2 };

function strokeFor({ code, level }: DirectEntry): Stroke {
  const finger = FINGER_BY_CODE[code] ?? "r-pinky";
  const shift = level === 1;
  return {
    code,
    shift,
    altgr: level === 2,
    finger,
    shiftCode: shift ? (isLeftHand(finger) ? "ShiftRight" : "ShiftLeft") : undefined,
  };
}

const cache = new Map<LayoutId, Map<string, Stroke[]>>();

/** Builds the char → strokes index for a layout (direct keys first, then dead-key compositions). */
function buildIndex(layout: LayoutDefinition): Map<string, Stroke[]> {
  const direct = new Map<string, DirectEntry>();
  const deadKeys = new Map<string, DirectEntry>();

  for (const [code, levels] of Object.entries(layout.keys)) {
    levels.forEach((value, i) => {
      if (!value) return;
      const entry: DirectEntry = { code, level: i as 0 | 1 | 2 };
      if (value.startsWith("dead:")) {
        const accent = value.slice(5);
        if (!deadKeys.has(accent)) deadKeys.set(accent, entry);
      } else if (!direct.has(value) || direct.get(value)!.level > entry.level) {
        direct.set(value, entry); // prefer the simplest way to type a character
      }
    });
  }
  direct.set(" ", { code: "Space", level: 0 });
  direct.set("\n", { code: "Enter", level: 0 });

  const index = new Map<string, Stroke[]>();
  for (const [ch, entry] of direct) index.set(ch, [strokeFor(entry)]);

  for (const [accent, deadEntry] of deadKeys) {
    for (const [baseChar, composed] of Object.entries(DEAD_COMPOSE[accent] ?? {})) {
      if (index.has(composed)) continue;
      const base = direct.get(baseChar);
      if (!base) continue;
      index.set(composed, [strokeFor(deadEntry), strokeFor(base)]);
    }
  }
  return index;
}

/**
 * Key strokes needed to type `ch` on `layoutId`, or null if the layout has no
 * standard way to produce it (the engine still accepts the character).
 */
export function strokesFor(layoutId: LayoutId, ch: string): Stroke[] | null {
  let index = cache.get(layoutId);
  if (!index) {
    index = buildIndex(LAYOUTS[layoutId]);
    cache.set(layoutId, index);
  }
  return index.get(ch) ?? null;
}

/** Label shown on a key cap for a given level (dead keys show their accent). */
export function keyLabel(layoutId: LayoutId, code: string, level: 0 | 1 | 2): string | undefined {
  const value = LAYOUTS[layoutId].keys[code]?.[level];
  return value?.startsWith("dead:") ? value.slice(5) : value;
}

export const isDeadKey = (layoutId: LayoutId, code: string, level: 0 | 1 | 2) =>
  LAYOUTS[layoutId].keys[code]?.[level]?.startsWith("dead:") ?? false;
