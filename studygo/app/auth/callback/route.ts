import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "../../../utils/supabase/env";
import { createSupabaseServerClient } from "../../../utils/supabase/server";

function safeNextPath(value: string | null, origin: string) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/home";
  }

  const destination = new URL(value, origin);
  return destination.origin === origin
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : "/home";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const providerError = requestUrl.searchParams.get("error");
  if (providerError) {
    const loginUrl = new URL("/", requestUrl.origin);
    loginUrl.searchParams.set(
      "error",
      providerError === "access_denied" ? "auth_cancelled" : "auth_callback_failed",
    );
    return NextResponse.redirect(loginUrl);
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    const loginUrl = new URL("/", requestUrl.origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  if (!getSupabaseConfig()) {
    const loginUrl = new URL("/", requestUrl.origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Supabase OAuth callback failed:", error.message);
    const loginUrl = new URL("/", requestUrl.origin);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(
    new URL(
      safeNextPath(requestUrl.searchParams.get("next"), requestUrl.origin),
      requestUrl.origin,
    ),
  );
}