"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; exact?: boolean };

const linkClass = (active: boolean) =>
  cn(
    "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
    active ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg",
  );

function Links({ items, pathname }: { items: Item[]; pathname: string | null }) {
  return (
    <nav className="flex w-max items-center gap-1">
      {items.map((item) => {
        const active = pathname !== null && (item.exact ? pathname === item.href : pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveLinks({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  // On narrow screens the nav scrolls horizontally: keep the current page's link in view.
  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <div ref={ref}>
      <Links items={items} pathname={pathname} />
    </div>
  );
}

/**
 * Primary navigation. The active state depends on the URL (request-time data), so it
 * streams in behind Suspense; the fallback renders the same links without highlighting.
 */
export function AppNav({ items }: { items: Item[] }) {
  return (
    <Suspense fallback={<Links items={items} pathname={null} />}>
      <ActiveLinks items={items} />
    </Suspense>
  );
}
