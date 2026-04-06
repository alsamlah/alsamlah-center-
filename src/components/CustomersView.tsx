"use client";

import { useState } from "react";
import type { Customer } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { fmtMoney, fmtDate } from "@/lib/utils";
import SarSymbol from "./SarSymbol";

interface Props {
  customers: Customer[];
  setCustomers: (c: Customer[]) => void;
  settings: SystemSettings;
  notify: (m: string) => void;
}

export function getTier(points: number): "bronze" | "silver" | "gold" {
  if (points >= 1500) return "gold";
  if (points >= 500) return "silver";
  return "bronze";
}

export function getTierInfo(tier: "bronze" | "silver" | "gold", t: Record<string, string>) {
  if (tier === "gold")   return { label: t.gold,   icon: "🥇", color: "var(--yellow)" };
  if (tier === "silver") return { label: t.silver, icon: "🥈", color: "#94a3b8" };
                         return { label: t.bronze, icon: "🥉", color: "#cd7c54" };
}

export default function CustomersView({ customers, setCustomers, settings, notify }: Props) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = customers.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  ).sort((a, b) => b.lastVisit - a.lastVisit);

  const totalSpentAll = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalPointsAll = customers.reduce((s, c) => s + c.points, 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text)" }}>👥 {t.customers}</h2>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: t.customers, value: String(customers.length), color: "var(--accent)", icon: "👥" },
          { label: t.totalSpent, value: null, money: totalSpentAll, color: "var(--green)", icon: "💰" },
          { label: t.points, value: String(totalPointsAll), color: "var(--yellow)", icon: "⭐" },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <div className="text-lg">{s.icon}</div>
            <div className="font-bold text-sm mt-0.5 flex items-center justify-center gap-0.5" style={{ color: s.color }}>
              {s.money !== undefined ? <>{fmtMoney(s.money)} <SarSymbol size={11} /></> : s.value}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: "var(--text2)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        className="input w-full mb-4"
        placeholder={t.search}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: "var(--text2)", opacity: 0.3 }}>
          {t.noCustomers}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => {
            const tier = getTier(c.points);
            const tierInfo = getTierInfo(tier, t);
            const expanded = expandedId === c.id;
            return (
              <div key={c.id} className="card p-4 anim-fade">
                <button className="w-full text-start" onClick={() => setExpandedId(expanded ? null : c.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                        style={{ background: `color-mix(in srgb, ${tierInfo.color} 15%, transparent)`, color: tierInfo.color }}>
                        {c.name[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div className="font-bold text-sm" style={{ color: "var(--text)" }}>{c.name}</div>
                        <div className="text-xs" style={{ color: "var(--text2)" }}>
                          {c.phone || (isRTL ? "لا يوجد رقم" : "No phone")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-end">
                        <div className="text-xs font-semibold" style={{ color: tierInfo.color }}>{tierInfo.icon} {tierInfo.label}</div>
                        <div className="text-xs" style={{ color: "var(--text2)" }}>⭐ {c.points} {t.points}</div>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text2)" }}>{expanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="mt-4 pt-4 anim-fade" style={{ borderTop: "1px solid var(--border)" }}>
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                      {[
                        { label: t.totalVisits, value: String(c.totalVisits), icon: "🎮" },
                        { label: t.totalSpent, money: c.totalSpent, icon: "💰" },
                        { label: isRTL ? "آخر زيارة" : "Last visit", value: fmtDate(c.lastVisit), icon: "📅" },
                      ].map((row, i) => (
                        <div key={i} className="text-center p-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 4%, transparent)" }}>
                          <div className="text-base">{row.icon}</div>
                          <div className="font-bold mt-0.5 flex items-center justify-center gap-0.5" style={{ color: "var(--text)" }}>
                            {row.money !== undefined ? <>{fmtMoney(row.money)} <SarSymbol size={9} /></> : row.value}
                          </div>
                          <div style={{ color: "var(--text2)" }}>{row.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Loyalty progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-[10px] mb-1" style={{ color: "var(--text2)" }}>
                        <span>{tierInfo.icon} {tierInfo.label}</span>
                        <span>
                          {tier === "gold"
                            ? (isRTL ? "أعلى مستوى" : "Max tier")
                            : tier === "silver"
                            ? `${1500 - c.points} ${isRTL ? "نقطة للذهبي" : "pts to Gold"}`
                            : `${500 - c.points} ${isRTL ? "نقطة للفضي" : "pts to Silver"}`}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{
                          width: `${
                            tier === "gold" ? 100
                            : tier === "silver" ? Math.min(100, ((c.points - 500) / 1000) * 100)
                            : Math.min(100, (c.points / 500) * 100)
                          }%`,
                          background: tierInfo.color,
                        }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] mb-3" style={{ color: "var(--text2)" }}>
                      <span>📅 {isRTL ? "تاريخ التسجيل" : "Member since"}: {fmtDate(c.joinDate)}</span>
                    </div>

                    <div className="flex gap-2">
                      {c.phone && (
                        <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                          className="btn flex-1 py-2 text-xs"
                          style={{ background: "color-mix(in srgb, var(--green) 10%, transparent)", color: "var(--green)", borderColor: "color-mix(in srgb, var(--green) 25%, transparent)" }}>
                          📱 {t.whatsapp}
                        </a>
                      )}
                      <button
                        onClick={() => { setCustomers(customers.filter((x) => x.id !== c.id)); notify(t.deleted); }}
                        className="btn flex-1 py-2 text-xs btn-ghost"
                        style={{ color: "var(--red)", borderColor: "color-mix(in srgb, var(--red) 15%, transparent)" }}>
                        🗑 {t.delete}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
