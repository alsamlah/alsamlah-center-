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
  // maybeSingle() returns null cleanly for new users (no row yet) instead of
  // throwing 406 — the AuthScreen "setup tenant" flow handles the null case.
  const { data: tu, error: tuErr } = await supabase
    .from("tenant_users")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (tuErr || !tu) return null;

  // 2. Get tenant
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tu.tenant_id)
    .single();

  if (tErr || !tenant) return null;

  // 3. Get branch (if assigned)
  // Defense in depth: also filter by tenant_id so a misconfigured RLS policy
  // can never return another tenant's branch.
  let branch: Branch | null = null;
  if (tu.branch_id) {
    const { data: b } = await supabase
      .from("branches")
      .select("*")
      .eq("id", tu.branch_id)
      .eq("tenant_id", tu.tenant_id)
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
    // Helper: load tenant context with hard timeout. Without this guard,
    // a hung Supabase request (network blip, tenant_users query that never
    // resolves) leaves the UI on the loading screen forever — the previous
    // 5-second supabaseReady fallback only opened the auth gate but the
    // ctxLoading gate stayed closed, so the app kept showing "Loading...".
    const safeLoad = async (userId: string, email?: string) => {
      setCtxLoading(true);
      try {
        const ctx = await Promise.race([
          loadAppContext(userId, email),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("loadAppContext timeout")), 8000)),
        ]);
        setAppCtx(ctx);
      } catch (err) {
        console.error("[auth] loadAppContext failed:", err);
        setAppCtx(null);
      } finally {
        setCtxLoading(false);
      }
    };

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setIsAuthenticated(true);
        await safeLoad(session.user.id, session.user.email ?? undefined);
      }
      setSupabaseReady(true);
    }).catch((err) => {
      console.error("[auth] getSession failed:", err);
      setCtxLoading(false);
      setSupabaseReady(true);
    });

    // Hard fallback: if Supabase auth is completely unreachable after 5s,
    // open BOTH gates (supabaseReady + ctxLoading) so the user at minimum
    // sees the AuthScreen instead of an indefinite loading spinner.
    const fallback = setTimeout(() => {
      setSupabaseReady(true);
      setCtxLoading(false);
    }, 5000);

    // Listen for auth changes. Critical: handle each event type narrowly,
    // because the previous "any event → reload appCtx" approach caused two
    // problems in production:
    //   1) TOKEN_REFRESHED fires every ~hour. Reloading appCtx on each one
    //      meant a brief loading flash, AND if the reload failed (network
    //      blip) appCtx was set to null → cashier dumped onto the SETUP
    //      screen mid-shift every hour.
    //   2) onAuthStateChange ALSO fires INITIAL_SESSION immediately on
    //      subscribe, racing with the getSession() call above.
    //
    // Strategy: only reload appCtx on actual user-identity TRANSITIONS
    // (SIGNED_IN with a different userId, or first INITIAL_SESSION). For
    // TOKEN_REFRESHED / USER_UPDATED keep the existing appCtx untouched.
    const loadedUserIdRef = { current: null as string | null };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        loadedUserIdRef.current = null;
        setIsAuthenticated(false);
        setAppCtx(null);
        setCtxLoading(false);
        setSupabaseReady(true);
        return;
      }

      if (session?.user) {
        setIsAuthenticated(true);
        // Only (re)load appCtx if the userId changed — same user firing
        // TOKEN_REFRESHED / USER_UPDATED / duplicate INITIAL_SESSION events
        // doesn't need a reload (their tenant context hasn't changed).
        if (loadedUserIdRef.current !== session.user.id) {
          loadedUserIdRef.current = session.user.id;
          await safeLoad(session.user.id, session.user.email ?? undefined);
        }
      }
      // If session is null but event isn't SIGNED_OUT (rare — usually a
      // momentary refresh blip): do NOT clear appCtx. If it's a real logout
      // SIGNED_OUT will arrive and we'll handle it above.
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
