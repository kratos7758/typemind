/**
 * Decodes browser text input into engine commands (ADR-009).
 *
 * Why a hidden <textarea> + `beforeinput` instead of `keydown`:
 * - `beforeinput.data` is the character the OS layout actually produced
 *   (AZERTY, QWERTZ, dead keys, AltGr…). `keydown.key` is not reliable for that,
 *   and `keyCode`/`keypress` are deprecated.
 * - Composition (dead keys on some platforms, IMEs) cannot be cancelled; we let it
 *   happen and commit the final string once, on `compositionend`, which every
 *   browser fires. Composition-related beforeinput types are ignored to avoid
 *   double counting.
 * - The textarea always holds a SENTINEL so that Backspace on an "empty" field
 *   still produces a `deleteContentBackward` event in every browser.
 */
export const SENTINEL = " ";

export type InputSink = {
  insert(text: string): void;
  deleteBackward(): void;
  deleteWordBackward(): void;
};

export type AdapterCallbacks = {
  /** Escape: pause/resume; Tab: restart (handled by the UI). */
  onCommand?: (command: "escape" | "tab") => void;
};

const IGNORED_TYPES = new Set([
  "insertCompositionText",
  "deleteCompositionText",
  "insertFromComposition",
  "insertReplacementText", // spell-check / autocorrect
  "insertFromPaste",
  "insertFromDrop",
  "insertFromYank",
  "historyUndo",
  "historyRedo",
  "deleteByCut",
  "deleteByDrag",
]);

export function attachInputAdapter(
  el: HTMLTextAreaElement,
  sink: InputSink,
  callbacks: AdapterCallbacks = {},
): () => void {
  let composing = false;

  const reset = () => {
    el.value = SENTINEL;
    el.setSelectionRange(SENTINEL.length, SENTINEL.length);
  };
  reset();

  const onBeforeInput = (event: Event) => {
    const e = event as InputEvent;
    if (composing || e.isComposing || IGNORED_TYPES.has(e.inputType)) {
      // Paste/drop/undo would bypass typing practice: block them when cancelable.
      if (!e.isComposing && !composing && e.cancelable) e.preventDefault();
      return;
    }
    switch (e.inputType) {
      case "insertText":
        if (e.data) sink.insert(e.data);
        break;
      case "insertLineBreak":
      case "insertParagraph":
        sink.insert("\n");
        break;
      case "deleteContentBackward":
        sink.deleteBackward();
        break;
      case "deleteWordBackward":
      case "deleteSoftLineBackward":
      case "deleteHardLineBackward":
        sink.deleteWordBackward();
        break;
      default:
        // Forward deletes, formatting… have no meaning here.
        break;
    }
    if (e.cancelable) e.preventDefault();
    // Some browsers (older Android) don't honour preventDefault on beforeinput:
    // the `input` handler below restores the sentinel either way.
  };

  const onCompositionStart = () => {
    composing = true;
  };

  const onCompositionEnd = (event: CompositionEvent) => {
    composing = false;
    if (event.data) sink.insert(event.data);
    // Let the browser finish its own DOM update first.
    queueMicrotask(reset);
  };

  const onInput = () => {
    if (!composing) reset();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      callbacks.onCommand?.("escape");
    } else if (e.key === "Tab") {
      e.preventDefault();
      callbacks.onCommand?.("tab");
    }
  };

  // Keep the caret after the sentinel even if the user clicks inside the field.
  const onSelect = () => {
    if (!composing && el.selectionStart !== el.value.length) {
      el.setSelectionRange(el.value.length, el.value.length);
    }
  };

  el.addEventListener("beforeinput", onBeforeInput);
  el.addEventListener("compositionstart", onCompositionStart);
  el.addEventListener("compositionend", onCompositionEnd);
  el.addEventListener("input", onInput);
  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("select", onSelect);

  return () => {
    el.removeEventListener("beforeinput", onBeforeInput);
    el.removeEventListener("compositionstart", onCompositionStart);
    el.removeEventListener("compositionend", onCompositionEnd);
    el.removeEventListener("input", onInput);
    el.removeEventListener("keydown", onKeyDown);
    el.removeEventListener("select", onSelect);
  };
}
