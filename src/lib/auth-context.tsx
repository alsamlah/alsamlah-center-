"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { AppContext, Tenant, Branch, TenantUser } from "@/lib/supabase";

// ── What the context provides ──
interface AuthContextValue {
  // Supabase session state
  supabaseReady: boolean;     // true once we've checked session
  isAuthenticated: boolean;   // true = Supabase user exists
  appCtx: AppContext | null;  // full tenant context after setup
  ctxLoading: boolean;        // true while loadAppContext is running (prevents setup flash)

  // Actions
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshAppCtx: () => Promise<void>;
  createTenant: (nameAr: string, nameEn: string) => Promise<AppContext | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

// ── Load tenant context for the current Supabase user ──
async function loadAppContext(userId: string, userEmail?: string): Promise<AppContext | null> {
  // 1. Get tenant_user record
  const { data: tu, error: tuErr } = await supabase
    .from("tenant_users")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (tuErr || !tu) return null;

  // 2. Get tenant
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tu.tenant_id)
    .single();

  if (tErr || !tenant) return null;

  // 3. Get branch (if assigned)
  let branch: Branch | null = null;
  if (tu.branch_id) {
    const { data: b } = await supabase
      .from("branches")
      .select("*")
      .eq("id", tu.branch_id)
      .single();
    branch = b ?? null;
  }

  return {
    tenant: tenant as Tenant,
    branch,
    tenantUser: tu as TenantUser,
    supabaseUser: { id: userId, email: userEmail },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [appCtx, setAppCtx] = useState<AppContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);

  const refreshAppCtx = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAppCtx(null); return; }
    const ctx = await loadAppContext(user.id, user.email ?? undefined);
    setAppCtx(ctx);
  }, []);

  // ── Bootstrap: check existing session + subscribe to auth changes ──
  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setCtxLoading(true);
        const ctx = await loadAppContext(session.user.id, session.user.email ?? undefined);
        setAppCtx(ctx);
        setCtxLoading(false);
      }
      setSupabaseReady(true);
    }).catch(() => {
      setSupabaseReady(true);
    });

    // Fallback: if Supabase is unreachable, show auth screen after 5s
    const fallback = setTimeout(() => setSupabaseReady(true), 5000);

    // Listen for auth changes (login, logout, OAuth callback, token refresh).
    // Without this, the app does not react when the user signs in via OAuth,
    // signs out from another tab, or has their session refreshed/expired.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setCtxLoading(true);
        const ctx = await loadAppContext(session.user.id, session.user.email ?? undefined);
        setAppCtx(ctx);
        setCtxLoading(false);
      } else {
        setIsAuthenticated(false);
        setAppCtx(null);
        setCtxLoading(false);
      }
      setSupabaseReady(true);
    });

    return () => {
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  // ── Sign in with Google OAuth ──
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  // ── Sign in with email/password ──
  const signInWithEmail = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  // ── Sign up with email/password ──
  const signUpWithEmail = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  };

  // ── Sign out ──
  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setAppCtx(null);
  };

  // ── Create tenant for a new user (first time setup) ──
  // Uses a SECURITY DEFINER RPC to bypass RLS (new users have no tenant yet)
  const createTenant = async (nameAr: string, nameEn: string): Promise<AppContext | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Call the server-side function that creates tenant + branch + tenant_user atomically
    const { data: rpcData, error: rpcErr } = await supabase
      .rpc("create_tenant_for_user", { p_name_ar: nameAr, p_name_en: nameEn });

    if (rpcErr || !rpcData) {
      console.error("createTenant RPC error:", rpcErr);
      return null;
    }

    // Now fetch full context with the new tenant/branch/user records
    const ctx = await loadAppContext(user.id, user.email ?? undefined);
    if (ctx) setAppCtx(ctx);
    return ctx;
  };

  return (
    <AuthContext.Provider value={{
      supabaseReady,
      isAuthenticated,
      appCtx,
      ctxLoading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshAppCtx,
      createTenant,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
