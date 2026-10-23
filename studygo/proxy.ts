import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./utils/supabase/env";
import { getRequestUrl } from "./utils/request-url";

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(name);
    if (value) {
      target.headers.set(name, value);
    }
  }
}

export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  if (error) {
    console.error("Supabase session verification failed:", error.message);
    const loginUrl = new URL("/", getRequestUrl(request));
    loginUrl.searchParams.set("error", "auth_check_failed");
    const loginResponse = NextResponse.redirect(loginUrl);
    copyCookies(response, loginResponse);
    return loginResponse;
  }

  if (!data?.claims) {
    const loginUrl = new URL("/", getRequestUrl(request));
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const loginResponse = NextResponse.redirect(loginUrl);
    copyCookies(response, loginResponse);
    return loginResponse;
  }

  return response;
}

export const config = {
  matcher: ["/home/:path*", "/study-materials/:path*", "/mock-quiz/:path*", "/quiz-results/:path*"],
};
