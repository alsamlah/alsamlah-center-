"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { UserRole, UserLogin } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { ROLE_ICONS, ROLE_LABELS } from "@/lib/defaults";
import { T } from "@/lib/settings";

interface Props {
  pins: Record<UserRole, string>;
  roleNames: Record<UserRole, string>;
  onLogin: (user: UserLogin) => void;
  settings: SystemSettings;
}

export default function RoleSelectScreen({ pins, roleNames, onLogin, settings }: Props) {
  const { appCtx, signOut } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const roles: UserRole[] = ["cashier1", "cashier2", "manager"];

  const tenant = appCtx?.tenant;
  const userEmail = appCtx?.supabaseUser?.email;

  const handleNumpad = (n: string) => {
    if (n === "del") { setPin((p) => p.slice(0, -1)); setError(false); return; }
    if (n === "clear") { setPin(""); setError(false); return; }
    if (pin.length >= 6) return;
    const newPin = pin + n;
    setPin(newPin);
    setError(false);
    if (newPin.length === 4 && selectedRole) {
      if (newPin === pins[selectedRole]) {
        setTimeout(() => onLogin({ role: selectedRole, name: roleNames[selectedRole] }), 200);
      } else {
        setTimeout(() => {
          setError(true);
          setShake(true);
          setTimeout(() => { setShake(false); setPin(""); }, 500);
        }, 200);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--bg)" }} dir={isRTL ? "rtl" : "ltr"}>

      {/* Business header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black" style={{ color: "var(--accent)" }}>
          {tenant?.name_ar || "AL"}<span style={{ color: "var(--text)" }}>{!tenant?.name_ar ? "SAMLAH" : ""}</span>
        </h1>
        {tenant?.name_en && tenant.name_ar && (
          <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: "var(--text2)" }}>
            {tenant.name_en}
          </p>
        )}
        {/* Logged-in user badge */}
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs"
          style={{ background: "color-mix(in srgb, var(--green) 10%, transparent)", color: "var(--green)", border: "1px solid color-mix(in srgb, var(--green) 25%, transparent)" }}>
          <span>●</span>
          <span>{userEmail}</span>
        </div>
      </div>

      {/* Role selection */}
      {!selectedRole ? (
        <div className="w-full max-w-md">
          <p className="text-sm text-center mb-6" style={{ color: "var(--text2)" }}>{t.selectRole}</p>
          <div className="grid gap-3">
            {roles.map((role) => (
              <button key={role} onClick={() => setSelectedRole(role)}
                className="card p-5 text-center transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                style={role === "manager" ? {
                  background: "color-mix(in srgb, var(--accent) 6%, var(--surface))",
                  borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
                } : {}}>
                <div className="text-4xl mb-2">{ROLE_ICONS[role]}</div>
                <div className="text-lg font-bold" style={{ color: role === "manager" ? "var(--accent)" : "var(--text)" }}>
                  {roleNames[role]}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text2)" }}>
                  {isRTL ? ROLE_LABELS[role].ar : ROLE_LABELS[role].en}
                  {" • "}
                  {role === "manager" ? t.managerAccess : t.cashierAccess}
                </div>
              </button>
            ))}
          </div>

          {/* Sign out */}
          <button onClick={signOut}
            className="mt-8 w-full text-xs py-2"
            style={{ color: "var(--text2)" }}>
            {isRTL ? "← تسجيل خروج من الحساب" : "Sign out →"}
          </button>
        </div>
      ) : (
        /* PIN entry */
        <div className="w-full max-w-xs">
          <button onClick={() => { setSelectedRole(null); setPin(""); setError(false); }}
            className="text-xs mb-6 flex items-center gap-1" style={{ color: "var(--text2)" }}>
            {isRTL ? "← " : "→ "}{t.back}
          </button>

          <div className="text-center mb-8">
            <div className="text-4xl mb-3">{ROLE_ICONS[selectedRole]}</div>
            <div className="text-xl font-bold" style={{ color: "var(--text)" }}>
              {roleNames[selectedRole]}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text2)" }}>
              {isRTL ? ROLE_LABELS[selectedRole].ar : ROLE_LABELS[selectedRole].en}
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text2)", opacity: 0.6 }}>{t.enterPin}</p>
          </div>

          {/* PIN dots */}
          <div className={`flex justify-center gap-4 mb-8 ${shake ? "anim-shake" : ""}`}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-4 h-4 rounded-full transition-all" style={{
                background: i < pin.length ? (error ? "var(--red)" : "var(--accent)") : "transparent",
                border: `2px solid ${i < pin.length ? (error ? "var(--red)" : "var(--accent)") : "var(--border)"}`,
              }} />
            ))}
          </div>

          {error && (
            <div className="text-xs text-center mb-4" style={{ color: "var(--red)" }}>{t.wrongPin}</div>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "del"].map((n) => (
              <button key={n} onClick={() => handleNumpad(n)}
                className="h-14 rounded-xl text-lg font-semibold transition-all active:scale-95"
                style={{
                  background: n === "clear"
                    ? "color-mix(in srgb, var(--red) 10%, transparent)"
                    : n === "del" ? "var(--surface)" : "var(--surface)",
                  color: n === "clear" ? "var(--red)" : n === "del" ? "var(--text2)" : "var(--text)",
                  border: "1px solid var(--border)",
                  fontSize: n === "clear" || n === "del" ? "13px" : "18px",
                }}>
                {n === "del" ? "⌫" : n === "clear" ? (isRTL ? "مسح" : "CLR") : n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
