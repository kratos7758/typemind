import Link from "next/link";

/** Wordmark: the blinking caret is the brand signature (typing cursor). */
export function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-baseline gap-0.5 text-lg font-semibold tracking-tight text-fg">
      TypeMind
      <span aria-hidden className="inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-accent" />
    </Link>
  );
}
