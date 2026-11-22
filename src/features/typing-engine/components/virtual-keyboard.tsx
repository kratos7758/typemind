"use client";

import { memo, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { handsPose, type FingerPose, type HandPose, type Rect } from "../hands";
import {
  FINGER_BY_CODE,
  HOME_KEYS,
  LAYOUTS,
  ROWS,
  keyLabel,
  isDeadKey,
  type Finger,
  type LayoutId,
  type Stroke,
} from "../layouts";

/**
 * Muted per-finger tints, used only on the keyboard diagram.
 * Strength comes from --finger-tint (lower in dark mode, see globals.css).
 */
const tint = (l: number, c: number, h: number) => `oklch(${l} ${c} ${h} / var(--finger-tint))`;
const FINGER_TINT: Record<Finger, string> = {
  "l-pinky": tint(0.8, 0.06, 300),
  "l-ring": tint(0.8, 0.06, 250),
  "l-middle": tint(0.82, 0.06, 200),
  "l-index": tint(0.84, 0.06, 150),
  thumb: tint(0.85, 0.03, 80),
  "r-index": tint(0.86, 0.07, 95),
  "r-middle": tint(0.84, 0.07, 60),
  "r-ring": tint(0.82, 0.07, 30),
  "r-pinky": tint(0.8, 0.07, 0),
};

type Highlight = { step: number; kind: "key" | "modifier" };

function highlights(strokes: readonly Stroke[] | null): Map<string, Highlight> {
  const map = new Map<string, Highlight>();
  strokes?.forEach((s, i) => {
    const step = strokes.length > 1 ? i + 1 : 0;
    map.set(s.code, { step, kind: "key" });
    if (s.shift && s.shiftCode) map.set(s.shiftCode, { step, kind: "modifier" });
    if (s.altgr) map.set("AltRight", { step, kind: "modifier" });
  });
  return map;
}

type KeyProps = {
  code: string;
  layout: LayoutId;
  width?: number;
  label?: string;
  highlight?: Highlight;
};

function Key({ code, layout, width = 1, label, highlight }: KeyProps) {
  const base = label ?? keyLabel(layout, code, 0);
  const shifted = label ? undefined : keyLabel(layout, code, 1);
  const altgr = label ? undefined : keyLabel(layout, code, 2);
  const showShifted = shifted && shifted !== base?.toUpperCase();
  const finger = FINGER_BY_CODE[code];
  const active = Boolean(highlight);

  return (
    <div
      data-code={code}
      data-active={active || undefined}
      style={{ flexGrow: width, flexBasis: 0, background: active ? undefined : finger ? FINGER_TINT[finger] : undefined }}
      className={cn(
        "relative flex h-10 min-w-0 flex-col justify-between rounded-[6px] border px-1.5 py-1 font-mono text-[11px] leading-none select-none sm:h-11",
        active
          ? highlight?.kind === "key"
            ? "border-accent bg-accent text-accent-fg"
            : "border-accent bg-accent-soft text-fg"
          : "border-border text-fg-muted",
      )}
    >
      <span className="flex justify-between">
        <span>{showShifted ? shifted : ""}</span>
        {highlight && highlight.step > 0 ? (
          <span className="rounded-full bg-surface px-1 text-[10px] font-semibold text-accent">{highlight.step}</span>
        ) : null}
      </span>
      <span className="flex items-end justify-between">
        <span
          className={cn(
            "text-[13px]",
            isDeadKey(layout, code, 0) && "italic",
            HOME_KEYS.has(code) && "underline decoration-1 underline-offset-2",
          )}
        >
          {base ?? ""}
        </span>
        {altgr ? <span className="text-[10px] opacity-70">{altgr}</span> : null}
      </span>
    </div>
  );
}

type Props = {
  layout: LayoutId;
  strokes: readonly Stroke[] | null;
  labels: { shift: string; enter: string; space: string; backspace: string; tab: string; caps: string; altgr: string };
  /** Translucent guide hands showing which finger to use. */
  showHands?: boolean;
};

/** Measures key rectangles relative to the keyboard (only on mount, resize, layout change). */
function useKeyRects(layout: LayoutId) {
  const ref = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Map<string, Rect>>(() => new Map());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const origin = root.getBoundingClientRect();
      const next = new Map<string, Rect>();
      root.querySelectorAll<HTMLElement>("[data-code]").forEach((el) => {
        const r = el.getBoundingClientRect();
        next.set(el.dataset.code!, { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height });
      });
      setRects(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [layout]);
  return { ref, rects };
}

/** Opaque (hides overlapping outlines inside a hand), faintly darker than the page. */
const HAND_FILL = "color-mix(in oklab, var(--fg-muted) 14%, var(--bg))";

const capsule = (f: FingerPose) => ({ x1: f.base.x, y1: f.base.y, x2: f.tip.x, y2: f.tip.y });

/**
 * Translucent hands under the key caps: the tinted caps let them show through while every
 * label (and the solid highlighted key) stays readable. One silhouette per hand (thick outline drawn under
 * an opaque fill, then the whole group faded) so overlapping fingers read as a single shape.
 * The finger to use is tinted with the accent colour and reaches the key to press.
 */
function GuideHands({ hands }: { hands: HandPose[] }) {
  const outline = 1.5;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden" data-testid="guide-hands">
      {hands.map((hand) => {
        const palm = hand.palm.map((p) => `${p.x},${p.y}`).join(" ");
        return (
          <g key={hand.side}>
            <g opacity={0.8}>
              <g stroke="var(--fg-muted)" fill="var(--fg-muted)" strokeLinecap="round" strokeLinejoin="round">
                <polygon points={palm} strokeWidth={outline * 2} />
                {hand.fingers.map((f) => (
                  <line key={f.finger} {...capsule(f)} strokeWidth={f.radius * 2 + outline * 2} />
                ))}
              </g>
              <g stroke={HAND_FILL} fill={HAND_FILL} strokeLinecap="round" strokeLinejoin="round">
                <polygon points={palm} strokeWidth={0} />
                {hand.fingers.map((f) => (
                  <line key={f.finger} {...capsule(f)} strokeWidth={f.radius * 2} />
                ))}
              </g>
            </g>
            {hand.fingers
              .filter((f) => f.active)
              .map((f) => (
                <line
                  key={f.finger}
                  data-finger={f.finger}
                  {...capsule(f)}
                  stroke="var(--accent)"
                  strokeOpacity={0.7}
                  strokeWidth={f.radius * 2}
                  strokeLinecap="round"
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Keyboard diagram highlighting the next key(s) to press. Purely presentational. */
export const VirtualKeyboard = memo(function VirtualKeyboard({ layout, strokes, labels, showHands = true }: Props) {
  const { form } = LAYOUTS[layout];
  const hl = highlights(strokes);
  const { ref, rects } = useKeyRects(layout);
  const hands = showHands ? handsPose(rects, strokes) : null;
  const k = (code: string, width?: number, label?: string) => (
    <Key key={code} code={code} layout={layout} width={width} label={label} highlight={hl.get(code)} />
  );

  return (
    <div aria-hidden ref={ref} className="relative mx-auto flex w-full max-w-3xl flex-col gap-1 pb-16">
      {hands ? <GuideHands hands={hands} /> : null}
      <div className="flex gap-1">
        {ROWS.E.map((c) => k(c))}
        {k("Backspace", 2, labels.backspace)}
      </div>
      <div className="flex gap-1">
        {k("Tab", 1.5, labels.tab)}
        {ROWS.D.map((c) => k(c))}
        {form === "ansi" ? k("Backslash", 1.5) : k("EnterTop", 1.5, "")}
      </div>
      <div className="flex gap-1">
        {k("CapsLock", 1.75, labels.caps)}
        {ROWS.C.map((c) => k(c))}
        {form === "iso" ? k("Backslash") : null}
        {k("Enter", form === "iso" ? 1.25 : 2.25, labels.enter)}
      </div>
      <div className="flex gap-1">
        {k("ShiftLeft", form === "iso" ? 1.25 : 2.25, labels.shift)}
        {form === "iso" ? k("IntlBackslash") : null}
        {ROWS.B.map((c) => k(c))}
        {k("ShiftRight", 2.75, labels.shift)}
      </div>
      <div className="flex gap-1">
        <div style={{ flexGrow: 3.75, flexBasis: 0 }} />
        {k("Space", 6.25, labels.space)}
        {k("AltRight", 1.25, labels.altgr)}
        <div style={{ flexGrow: 3.75, flexBasis: 0 }} />
      </div>
    </div>
  );
});
