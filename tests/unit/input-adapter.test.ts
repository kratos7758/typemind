import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachInputAdapter, SENTINEL, type InputSink } from "@/features/typing-engine/input-adapter";

function beforeinput(el: HTMLElement, inputType: string, data: string | null = null, isComposing = false) {
  const event = new InputEvent("beforeinput", { inputType, data, isComposing, cancelable: true, bubbles: true });
  el.dispatchEvent(event);
  return event;
}

describe("input adapter", () => {
  let el: HTMLTextAreaElement;
  let sink: { [K in keyof InputSink]: ReturnType<typeof vi.fn> };
  let detach: () => void;
  const onCommand = vi.fn();

  beforeEach(() => {
    el = document.createElement("textarea");
    document.body.append(el);
    sink = { insert: vi.fn(), deleteBackward: vi.fn(), deleteWordBackward: vi.fn() };
    detach = attachInputAdapter(el, sink as unknown as InputSink, { onCommand });
  });

  afterEach(() => {
    detach();
    el.remove();
    onCommand.mockReset();
  });

  it("starts with the sentinel in the field", () => {
    expect(el.value).toBe(SENTINEL);
  });

  it("forwards typed characters and prevents the DOM change", () => {
    const event = beforeinput(el, "insertText", "é");
    expect(sink.insert).toHaveBeenCalledWith("é");
    expect(event.defaultPrevented).toBe(true);
  });

  it("maps Enter, Backspace and Ctrl+Backspace", () => {
    beforeinput(el, "insertParagraph");
    beforeinput(el, "insertLineBreak");
    beforeinput(el, "deleteContentBackward");
    beforeinput(el, "deleteWordBackward");
    expect(sink.insert).toHaveBeenCalledTimes(2);
    expect(sink.insert).toHaveBeenCalledWith("\n");
    expect(sink.deleteBackward).toHaveBeenCalledOnce();
    expect(sink.deleteWordBackward).toHaveBeenCalledOnce();
  });

  it("blocks paste and drop", () => {
    const paste = beforeinput(el, "insertFromPaste", "copied text");
    expect(paste.defaultPrevented).toBe(true);
    expect(sink.insert).not.toHaveBeenCalled();
  });

  it("commits a composition exactly once, on compositionend", async () => {
    el.dispatchEvent(new CompositionEvent("compositionstart", { data: "" }));
    beforeinput(el, "insertCompositionText", "^", true);
    beforeinput(el, "insertCompositionText", "ê", true);
    el.dispatchEvent(new CompositionEvent("compositionend", { data: "ê" }));
    beforeinput(el, "insertFromComposition", "ê"); // Safari sends this after compositionend
    expect(sink.insert).toHaveBeenCalledTimes(1);
    expect(sink.insert).toHaveBeenCalledWith("ê");
    await Promise.resolve();
    expect(el.value).toBe(SENTINEL);
  });

  it("ignores insertText flagged as composing", () => {
    beforeinput(el, "insertText", "a", true);
    expect(sink.insert).not.toHaveBeenCalled();
  });

  it("restores the sentinel after any input event", () => {
    el.value = " abc";
    el.dispatchEvent(new Event("input"));
    expect(el.value).toBe(SENTINEL);
  });

  it("reports Escape and Tab as commands", () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
    expect(onCommand.mock.calls).toEqual([["escape"], ["tab"]]);
  });

  it("stops listening after detach", () => {
    detach();
    beforeinput(el, "insertText", "a");
    expect(sink.insert).not.toHaveBeenCalled();
    detach = () => {};
  });
});
