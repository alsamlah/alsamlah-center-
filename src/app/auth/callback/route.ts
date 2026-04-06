import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Forward the OAuth code to the client-side handler (/auth/complete).
// exchangeCodeForSession must run in the browser (PKCE verifier lives in localStorage).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    return NextResponse.redirect(`${origin}/auth/complete?code=${encodeURIComponent(code)}`);
  }
  return NextResponse.redirect(`${origin}/`);
}
