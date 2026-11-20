import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookies on each request.
 * This is an optimistic layer only: authorization is re-checked next to the data (DAL).
 */
export async function refreshSupabaseSession(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { response, isAuthenticated: false };

  let current = response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        const next = NextResponse.next({ request });
        // Preserve anything the caller already put on the response (e.g. rewrites/headers).
        current.headers.forEach((v, k) => next.headers.set(k, v));
        for (const { name, value, options } of cookiesToSet) next.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) next.headers.set(k, v);
        current = next;
      },
    },
  });

  // getClaims() validates the JWT; never trust getSession() on the server.
  const { data } = await supabase.auth.getClaims();
  return { response: current, isAuthenticated: Boolean(data?.claims?.sub) };
}
