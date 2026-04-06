"use client";

import { useState } from "react";
import type { SpecialGuest, SpecialGuestType } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { uid, fmtTime, fmtDate, fmtD } from "@/lib/utils";

interface Props {
  guests: SpecialGuest[];
  setGuests: (g: SpecialGuest[]) => void;
  currentUser: string;
  settings: SystemSettings;
  notify: (m: string) => void;
}

// ── Guest type config ──────────────────────────────────────────────────────────
export const GUEST_TYPE_CONFIG: Record<SpecialGuestType, { icon: string; color: string; labelAr: string; labelEn: string; urgent: boolean }> = {
  family:       { icon: "👨‍👩‍👧", color: "var(--blue)",   labelAr: "عائلة",                  labelEn: "Family",                   urgent: false },
  friend:       { icon: "🤝",    color: "var(--accent)", labelAr: "صديق مقرب",              labelEn: "Close Friend",             urgent: false },
  influencer:   { icon: "⭐",    color: "var(--yellow)", labelAr: "مشهور / مؤثر",            labelEn: "Influencer",               urgent: false },
  vip:          { icon: "👑",    color: "var(--yellow)", labelAr: "VIP",                    labelEn: "VIP",                      urgent: false },
  security:     { icon: "👮",    color: "var(--text2)",  labelAr: "أمن / شرطة",              labelEn: "Security / Police",        urgent: false },
  municipality: { icon: "🏛️",   color: "var(--red)",    labelAr: "مراقب أمانة الرياض",      labelEn: "Municipality Inspector",   urgent: true  },
  authority:    { icon: "🎭",    color: "var(--red)",    labelAr: "مراقب هيئة الترفيه",      labelEn: "Authority Inspector",      urgent: true  },
};

export function isInspectorType(type: SpecialGuestType) {
  return type === "municipality" || type === "authority";
}

export default function SpecialGuestsView({ guests, setGuests, currentUser, settings, notify }: Props) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState<{ name: string; type: SpecialGuestType; notes: string }>({
    name: "", type: "family", notes: "",
  });

  const active = guests.filter((g) => g.leftAt === null).sort((a, b) => b.arrivedAt - a.arrivedAt);
  const past   = guests.filter((g) => g.leftAt !== null).sort((a, b) => b.arrivedAt - a.arrivedAt);

  const addGuest = () => {
    if (!form.name.trim()) return;
    const newGuest: SpecialGuest = {
      id: uid(), name: form.name.trim(), type: form.type,
      notes: form.notes.trim(), arrivedAt: Date.now(), leftAt: null, registeredBy: currentUser,
    };
    setGuests([newGuest, ...guests]);
    setForm({ name: "", type: "family", notes: "" });
    setShowForm(false);
    notify(isRTL ? "تم تسجيل الزائر ✓" : "Guest registered ✓");
  };

  const markLeft = (id: string) => {
    setGuests(guests.map((g) => g.id === id ? { ...g, leftAt: Date.now() } : g));
    notify(isRTL ? "تم تسجيل المغادرة ✓" : "Departure recorded ✓");
  };

  const gLabel = (type: SpecialGuestType) => isRTL ? GUEST_TYPE_CONFIG[type].labelAr : GUEST_TYPE_CONFIG[type].labelEn;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>👁 {t.specialGuests}</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="btn btn-primary px-4 py-2 text-sm">
          {showForm ? "✕" : `+ ${t.addGuest}`}
        </button>
      </div>

      {/* ── Inspector Alert (within view) ── */}
      {active.some((g) => isInspectorType(g.type)) && (
        <div className="card p-4 mb-5 anim-pulse"
          style={{ background: "color-mix(in srgb, var(--red) 12%, transparent)", borderColor: "color-mix(in srgb, var(--red) 40%, transparent)" }}>
          <div className="flex items-center gap-2 font-bold" style={{ color: "var(--red)" }}>
            <span className="text-lg">⚠️</span>
            <span>{t.inspectorAlert}</span>
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--red)", opacity: 0.8 }}>
            {active.filter((g) => isInspectorType(g.type)).map((g) => (
              <span key={g.id} className="me-3">{GUEST_TYPE_CONFIG[g.type].icon} {g.name} — {GUEST_TYPE_CONFIG[g.type][isRTL ? "labelAr" : "labelEn"]}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Register Form ── */}
      {showForm && (
        <div className="card p-5 mb-6 anim-fade-up">
          <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>+ {t.addGuest}</div>

          {/* Name */}
          <div className="mb-3">
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>
              {isRTL ? "اسم الزائر" : "Guest Name"} *
            </label>
            <input className="input w-full" placeholder={isRTL ? "أدخل الاسم..." : "Enter name..."} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addGuest()} />
          </div>

          {/* Type selector */}
          <div className="mb-3">
            <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text2)" }}>
              {isRTL ? "نوع الزائر" : "Guest Type"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(GUEST_TYPE_CONFIG) as SpecialGuestType[]).map((type) => {
                const cfg = GUEST_TYPE_CONFIG[type];
                const sel = form.type === type;
                return (
                  <button key={type} onClick={() => setForm({ ...form, type })}
                    className="btn py-2.5 text-xs text-start flex items-center gap-2"
                    style={{
                      background: sel ? `color-mix(in srgb, ${cfg.color} 12%, transparent)` : "var(--input-bg)",
                      color: sel ? cfg.color : "var(--text2)",
                      borderColor: sel ? `color-mix(in srgb, ${cfg.color} 30%, transparent)` : "var(--border)",
                    }}>
                    <span>{cfg.icon}</span>
                    <span>{isRTL ? cfg.labelAr : cfg.labelEn}</span>
                    {cfg.urgent && <span className="ms-auto text-[9px] font-bold" style={{ color: "var(--red)" }}>!</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>
              {t.note} ({isRTL ? "اختياري" : "optional"})
            </label>
            <input className="input w-full" placeholder={isRTL ? "ملاحظات..." : "Notes..."} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <button onClick={addGuest} disabled={!form.name.trim()}
            className="btn btn-primary w-full py-3 text-sm"
            style={{ opacity: form.name.trim() ? 1 : 0.4 }}>
            {GUEST_TYPE_CONFIG[form.type].icon} {isRTL ? "تسجيل الزائر" : "Register Guest"}
          </button>
        </div>
      )}

      {/* ── Active Guests ── */}
      <div className="mb-6">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "var(--text2)" }}>
          🟢 {t.activeGuests}
          {active.length > 0 && (
            <span className="badge px-2 py-0.5 text-xs" style={{ background: "color-mix(in srgb, var(--green) 15%, transparent)", color: "var(--green)" }}>
              {active.length}
            </span>
          )}
        </h3>

        {active.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: "var(--text2)", opacity: 0.3 }}>
            {t.noActiveGuests}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((g) => {
              const cfg = GUEST_TYPE_CONFIG[g.type];
              return (
                <div key={g.id} className="card p-4 anim-fade"
                  style={cfg.urgent ? {
                    borderColor: "color-mix(in srgb, var(--red) 35%, transparent)",
                    background: "color-mix(in srgb, var(--red) 5%, var(--surface))",
                  } : {}}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${cfg.color} 12%, transparent)` }}>
                        {cfg.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm" style={{ color: "var(--text)" }}>{g.name}</div>
                        <div className="text-xs font-semibold mt-0.5" style={{ color: cfg.color }}>{gLabel(g.type)}</div>
                        {g.notes && (
                          <div className="text-xs mt-1" style={{ color: "var(--text2)" }}>📝 {g.notes}</div>
                        )}
                        <div className="flex gap-3 mt-1.5 text-[11px]" style={{ color: "var(--text2)" }}>
                          <span>🕐 {fmtTime(g.arrivedAt)}</span>
                          <span>⏱ {fmtD(Date.now() - g.arrivedAt)}</span>
                          <span>👤 {g.registeredBy}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => markLeft(g.id)}
                      className="btn px-3 py-2 text-xs flex-shrink-0"
                      style={{
                        color: "var(--text2)",
                        borderColor: "var(--border)",
                        background: "var(--input-bg)",
                      }}>
                      🚪 {t.markLeft}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Visit History (collapsible) ── */}
      {past.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between py-2 text-sm font-bold mb-3"
            style={{ color: "var(--text2)" }}>
            <span>📋 {t.pastGuests} ({past.length})</span>
            <span>{showHistory ? "▲" : "▼"}</span>
          </button>
          {showHistory && (
            <div className="flex flex-col gap-2 anim-fade">
              {past.slice(0, 30).map((g) => {
                const cfg = GUEST_TYPE_CONFIG[g.type];
                return (
                  <div key={g.id} className="card p-3 anim-fade" style={{ opacity: 0.7 }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cfg.icon}</span>
                        <div>
                          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{g.name}</span>
                          <span className="text-xs ms-2" style={{ color: cfg.color }}>{gLabel(g.type)}</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-end" style={{ color: "var(--text2)" }}>
                        <div>{fmtDate(g.arrivedAt)}</div>
                        <div>{fmtTime(g.arrivedAt)} — {g.leftAt ? fmtTime(g.leftAt) : "?"}</div>
                      </div>
                    </div>
                    {g.notes && <div className="text-xs mt-1" style={{ color: "var(--text2)" }}>📝 {g.notes}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
