import { NextResponse, type NextRequest } from "next/server";
import { isLocale, negotiateLocale } from "@/i18n/config";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

/**
 * 1. Ensures every page URL starts with a supported locale (/fr, /en).
 * 2. Refreshes the Supabase session cookies.
 * 3. Optimistic redirects for protected / guest-only areas.
 *    Real authorization happens next to the data (src/features/auth/dal.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segment = pathname.split("/")[1];

  if (!isLocale(segment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${negotiateLocale(request.headers.get("accept-language"))}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const { response, isAuthenticated, isGuest } = await refreshSupabaseSession(request, NextResponse.next({ request }));
  const rest = pathname.slice(segment.length + 1);

  const isProtected = rest === "/app" || rest.startsWith("/app/") || rest.startsWith("/onboarding");
  if (isProtected && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = `/${segment}/login`;
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Guests (anonymous users) still need these pages: to save their progress or sign in.
  const isGuestOnly = rest === "/login" || rest === "/register";
  if (isGuestOnly && isAuthenticated && !isGuest) {
    const url = request.nextUrl.clone();
    url.pathname = `/${segment}/app`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip API routes, auth callback, Next internals and static files.
  matcher: ["/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
