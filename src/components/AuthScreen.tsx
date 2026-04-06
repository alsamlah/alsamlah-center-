"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

// ── Google Icon SVG ──
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

type Mode = "login" | "signup" | "setup";

interface SetupData {
  nameAr: string;
  nameEn: string;
}

interface AuthScreenProps {
  needsSetup?: boolean; // true when user is authenticated but has no tenant yet
}

export default function AuthScreen({ needsSetup = false }: AuthScreenProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, createTenant, appCtx, signOut } = useAuth();

  const [mode, setMode] = useState<Mode>(needsSetup ? "setup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Setup mode (first-time tenant creation)
  const [setup, setSetup] = useState<SetupData>({ nameAr: "مركز الصملة للترفيه", nameEn: "ALSAMLAH" });

  const handleEmail = async () => {
    setError(null);
    setLoading(true);
    let err: string | null = null;
    if (mode === "login") {
      err = await signInWithEmail(email, password);
    } else if (mode === "signup") {
      err = await signUpWithEmail(email, password);
      if (!err) setInfo("تم إرسال رسالة تأكيد لبريدك الإلكتروني — تحقق منه ثم ارجع لتسجيل الدخول");
    }
    if (err) setError(err);
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    await signInWithGoogle();
    setLoading(false);
  };

  const handleSetup = async () => {
    if (!setup.nameAr.trim()) { setError("أدخل اسم المركز بالعربي"); return; }
    setError(null);
    setLoading(true);
    const ctx = await createTenant(setup.nameAr.trim(), setup.nameEn.trim() || "ALSAMLAH");
    setLoading(false);
    if (!ctx) setError("حدث خطأ أثناء إنشاء المركز");
  };

  // ── Setup screen ──
  if (mode === "setup") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "var(--bg)" }} dir="rtl">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🏢</div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>إعداد مركزك</h1>
            <p className="text-sm mt-2" style={{ color: "var(--text2)" }}>أدخل معلومات مركزك لتبدأ</p>
          </div>
          <div className="card p-6 flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text2)" }}>اسم المركز (عربي) *</label>
              <input className="input w-full text-right" dir="rtl"
                value={setup.nameAr}
                onChange={(e) => setSetup((p) => ({ ...p, nameAr: e.target.value }))}
                placeholder="مركز الصملة للترفيه" />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text2)" }}>اسم المركز (إنجليزي)</label>
              <input className="input w-full"
                value={setup.nameEn}
                onChange={(e) => setSetup((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="ALSAMLAH" />
            </div>
            {error && <p className="text-sm text-center" style={{ color: "var(--red)" }}>{error}</p>}
            <button className="btn btn-primary w-full py-3 text-base font-bold mt-2"
              onClick={handleSetup} disabled={loading}>
              {loading ? "جاري الإنشاء..." : "إنشاء المركز ✓"}
            </button>
            <button className="btn w-full py-2 text-sm mt-1"
              style={{ color: "var(--text2)", background: "transparent" }}
              onClick={signOut} disabled={loading}>
              ← تسجيل الخروج وتغيير الحساب
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Login / Signup screen ──
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--bg)" }} dir="rtl">

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black tracking-tight" style={{ color: "var(--accent)" }}>
          AL<span style={{ color: "var(--text)" }}>SAMLAH</span>
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--text2)" }}>نظام إدارة مراكز الترفيه</p>
      </div>

      <div className="w-full max-w-sm">
        {/* Tab toggle */}
        <div className="flex mb-6 p-1 rounded-xl" style={{ background: "var(--surface)" }}>
          {(["login", "signup"] as Mode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(null); setInfo(null); }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: mode === m ? "var(--accent)" : "transparent",
                color: mode === m ? "#fff" : "var(--text2)",
              }}>
              {m === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {/* Google */}
          <button onClick={handleGoogle} disabled={loading}
            className="btn w-full py-3 flex items-center justify-center gap-3 font-semibold"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <GoogleIcon />
            <span>{mode === "login" ? "الدخول بـ Google" : "التسجيل بـ Google"}</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs" style={{ color: "var(--text2)" }}>أو</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          {/* Email */}
          <input className="input w-full text-right" dir="rtl" type="email"
            placeholder="البريد الإلكتروني"
            value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} />

          {/* Password */}
          <input className="input w-full text-right" dir="rtl" type="password"
            placeholder="كلمة المرور"
            value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleEmail()} />

          {/* Error / Info */}
          {error && <p className="text-xs text-center" style={{ color: "var(--red)" }}>{error}</p>}
          {info && <p className="text-xs text-center" style={{ color: "var(--green)" }}>{info}</p>}

          {/* Submit */}
          <button onClick={handleEmail} disabled={loading || !email || !password}
            className="btn btn-primary w-full py-3 font-bold text-base">
            {loading ? "..." : mode === "login" ? "دخول" : "إنشاء الحساب"}
          </button>
        </div>

        {/* First-time setup hint */}
        {mode === "signup" && (
          <p className="text-xs text-center mt-4" style={{ color: "var(--text2)" }}>
            بعد إنشاء الحساب وتأكيد الإيميل، ستُنشئ مركزك وتبدأ مباشرة.
          </p>
        )}
      </div>
    </div>
  );
}
