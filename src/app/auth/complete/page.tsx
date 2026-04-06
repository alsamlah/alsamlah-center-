"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Client-side OAuth code exchange.
// The PKCE code verifier is in browser localStorage — must run here, not in a server route.
export default function AuthCompletePage() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .finally(() => router.replace("/"));
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center">
        <div className="text-4xl mb-4 font-black" style={{ color: "var(--accent)" }}>
          AL<span style={{ color: "var(--text)" }}>SAMLAH</span>
        </div>
        <div className="text-sm animate-pulse" style={{ color: "var(--text2)" }}>جاري تسجيل الدخول...</div>
      </div>
    </div>
  );
}
