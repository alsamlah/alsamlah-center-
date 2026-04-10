"use client";

import { useMemo, useEffect, useState } from "react";
import type { HistoryRecord, Session, Floor } from "@/lib/supabase";
import { type SystemSettings, T } from "@/lib/settings";
import { fmtMoney, getBusinessDay } from "@/lib/utils";
import SarSymbol from "@/components/SarSymbol";

interface DashboardViewProps {
  history: HistoryRecord[];
  sessions: Record<string, Session>;
  floors: Floor[];
  settings: SystemSettings;
  logo?: string | null;
  tenantId?: string | null;
}

/* ── helpers ── */

function businessDayRecords(history: HistoryRecord[], dayOffset: number, eodHour: number) {
  const ref = new Date();
  ref.setDate(ref.getDate() + dayOffset);
  const target = getBusinessDay(ref.getTime(), eodHour);
  return history.filter((r) => getBusinessDay(r.endTime, eodHour) === target);
}

function pct(a: number, b: number) {
  if (b === 0) return a > 0 ? 100 : 0;
  return Math.round(((a - b) / b) * 100);
}

/* ── component ── */

export default function DashboardView({ history, sessions, floors, settings, tenantId }: DashboardViewProps) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const eod = settings.endOfDayHour ?? 5;

  /* ── derived data ── */
  const todayRecords = useMemo(() => businessDayRecords(history, 0, eod), [history, eod]);
  const yesterdayRecords = useMemo(() => businessDayRecords(history, -1, eod), [history, eod]);

  // KPI 1: revenue
  const todayRevenue = todayRecords.reduce((s, r) => s + r.total, 0);
  const yesterdayRevenue = yesterdayRecords.reduce((s, r) => s + r.total, 0);
  const revChange = pct(todayRevenue, yesterdayRevenue);

  // KPI 2: occupancy
  const totalItems = useMemo(
    () => floors.reduce((s, f) => s + f.zones.reduce((zs, z) => zs + z.items.length, 0), 0),
    [floors],
  );
  const activeCount = Object.keys(sessions).length;
  const occupancyPct = totalItems > 0 ? Math.round((activeCount / totalItems) * 100) : 0;

  // KPI 3: session count
  const todayCount = todayRecords.length;
  const yesterdayCount = yesterdayRecords.length;
  const countDiff = todayCount - yesterdayCount;

  // KPI 4: avg duration
  const avgDurMin =
    todayRecords.length > 0
      ? Math.round(todayRecords.reduce((s, r) => s + r.duration, 0) / todayRecords.length / 60000)
      : 0;
  const yesterdayAvgDur =
    yesterdayRecords.length > 0
      ? Math.round(yesterdayRecords.reduce((s, r) => s + r.duration, 0) / yesterdayRecords.length / 60000)
      : 0;

  // KPI 5: average rating (fetched from Supabase)
  const [avgRating, setAvgRating] = useState<{ avg: number; count: number } | null>(null);
  useEffect(() => {
    if (!tenantId) return;
    import("@/lib/db").then(({ getAverageRating }) => {
      getAverageRating(tenantId).then(setAvgRating).catch(() => {});
    });
  }, [tenantId]);

  /* ── peak hours ── */
  const peakData = useMemo(() => {
    const hours = new Array(24).fill(0) as number[];
    todayRecords.forEach((r) => {
      const h = new Date(r.startTime).getHours();
      hours[h]++;
    });
    return hours;
  }, [todayRecords]);
  const peakMax = Math.max(...peakData, 1);
  const currentHour = new Date().getHours();

  /* ── revenue by payment method ── */
  const methodTotals = useMemo(() => {
    const m: Record<string, number> = { cash: 0, card: 0, credit: 0, transfer: 0 };
    todayRecords.forEach((r) => {
      if (r.payMethods && r.payMethods.length > 0) {
        r.payMethods.forEach((pm) => {
          const k = pm.method === "mada" ? "card" : pm.method === "credit" ? "credit" : pm.method;
          if (k in m) m[k] += pm.amount;
        });
      } else {
        const k = r.payMethod === "mada" ? "card" : r.payMethod === "credit" ? "credit" : r.payMethod;
        if (k in m) m[k] += r.total;
      }
    });
    return m;
  }, [todayRecords]);
  const methodMax = Math.max(...Object.values(methodTotals), 1);

  const methodMeta: { key: string; label: string; color: string }[] = [
    { key: "cash", label: t.cash, color: "var(--green)" },
    { key: "card", label: t.mada ?? t.card, color: "var(--blue)" },
    { key: "credit", label: t.credit, color: "var(--accent)" },
    { key: "transfer", label: t.transfer, color: "var(--yellow)" },
  ];

  /* ── cashier performance ── */
  const cashierStats = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    todayRecords.forEach((r) => {
      const c = r.cashier || "—";
      if (!map[c]) map[c] = { count: 0, revenue: 0 };
      map[c].count++;
      map[c].revenue += r.total;
    });
    return Object.entries(map)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [todayRecords]);

  /* ── occupancy by zone ── */
  const zoneOccupancy = useMemo(() => {
    const result: { name: string; active: number; total: number }[] = [];
    floors.forEach((f) =>
      f.zones.forEach((z) => {
        const total = z.items.length;
        const active = z.items.filter((it) => sessions[it.id]).length;
        result.push({ name: z.name, active, total });
      }),
    );
    return result;
  }, [floors, sessions]);

  /* ── shared styles ── */
  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "1.35rem", color: "var(--text)" }}>
          {t.dashboard} — {t.today}
        </h2>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.8rem",
            color: "var(--green)",
            background: "color-mix(in srgb, var(--green) 12%, transparent)",
            padding: "3px 10px",
            borderRadius: 20,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--green)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          {t.liveData}
        </span>
      </div>

      {/* ── KPI cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {/* revenue */}
        <KpiCard
          icon="💰"
          label={t.totalRevenue}
          value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {fmtMoney(todayRevenue)} <SarSymbol size={18} />
            </span>
          }
          sub={`${revChange >= 0 ? "+" : ""}${revChange}% ${t.vsYesterday}`}
          subColor={revChange >= 0 ? "var(--green)" : "var(--red)"}
          accentColor="var(--green)"
        />
        {/* occupancy */}
        <div style={{ ...card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                fontSize: "1.1rem",
              }}
            >
              📊
            </span>
            <span style={{ color: "var(--text2)", fontSize: "0.85rem" }}>{t.occupancy}</span>
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            {activeCount}/{totalItems}
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: "color-mix(in srgb, var(--accent) 15%, transparent)",
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${occupancyPct}%`,
                borderRadius: 3,
                background: "var(--accent)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span style={{ color: "var(--text2)", fontSize: "0.78rem" }}>{occupancyPct}%</span>
        </div>
        {/* session count */}
        <KpiCard
          icon="🎫"
          label={t.sessionCount}
          value={<span>{todayCount}</span>}
          sub={`${countDiff >= 0 ? "+" : ""}${countDiff} ${t.vsYesterday}`}
          subColor={countDiff >= 0 ? "var(--green)" : "var(--red)"}
          accentColor="var(--blue)"
        />
        {/* avg duration */}
        <KpiCard
          icon="⏱"
          label={t.avgDuration}
          value={
            <span>
              {avgDurMin} {isRTL ? "د" : "m"}
            </span>
          }
          sub={
            yesterdayAvgDur > 0
              ? `${pct(avgDurMin, yesterdayAvgDur) >= 0 ? "+" : ""}${pct(avgDurMin, yesterdayAvgDur)}% ${t.vsYesterday}`
              : `— ${t.vsYesterday}`
          }
          subColor="var(--text2)"
          accentColor="var(--yellow)"
        />
        {/* avg rating */}
        {avgRating && avgRating.count > 0 && (
          <KpiCard
            icon="⭐"
            label={t.avgRating}
            value={<span>{avgRating.avg.toFixed(1)}</span>}
            sub={`${avgRating.count} ${t.ratingCount}`}
            subColor="var(--text2)"
            accentColor="var(--yellow)"
          />
        )}
      </div>

      {/* ── charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        {/* peak hours */}
        <div style={{ ...card }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "0.95rem", color: "var(--text)" }}>{t.peakHoursChart}</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120 }}>
            {peakData.map((v, h) => (
              <div
                key={h}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 18,
                    height: `${Math.max((v / peakMax) * 100, 2)}%`,
                    borderRadius: "4px 4px 0 0",
                    background:
                      h === currentHour
                        ? "var(--accent)"
                        : v > 0
                          ? "color-mix(in srgb, var(--accent) 50%, transparent)"
                          : "color-mix(in srgb, var(--border) 40%, transparent)",
                    transition: "height 0.3s ease",
                    position: "relative",
                  }}
                  title={`${h}:00 — ${v}`}
                />
              </div>
            ))}
          </div>
          {/* hour labels (every 3h) */}
          <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
            {peakData.map((_, h) => (
              <div
                key={h}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: "0.6rem",
                  color: h === currentHour ? "var(--accent)" : "var(--text2)",
                  fontWeight: h === currentHour ? 700 : 400,
                }}
              >
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>
        </div>

        {/* revenue by method */}
        <div style={{ ...card }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "0.95rem", color: "var(--text)" }}>{t.revenueByMethod}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {methodMeta.map((m) => (
              <div key={m.key}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                    fontSize: "0.85rem",
                  }}
                >
                  <span style={{ color: "var(--text)" }}>{m.label}</span>
                  <span style={{ color: "var(--text2)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                    {fmtMoney(methodTotals[m.key])} <SarSymbol size={12} />
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: "color-mix(in srgb, var(--border) 30%, transparent)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(methodTotals[m.key] / methodMax) * 100}%`,
                      borderRadius: 4,
                      background: m.color,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── bottom row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {/* cashier performance */}
        <div style={{ ...card }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", color: "var(--text)" }}>
            {t.cashierPerformance}
          </h3>
          {cashierStats.length === 0 ? (
            <p style={{ color: "var(--text2)", fontSize: "0.85rem", margin: 0 }}>—</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ color: "var(--text2)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: isRTL ? "right" : "left", padding: "6px 4px", fontWeight: 500 }}>
                    {t.byCashier}
                  </th>
                  <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 500 }}>{t.sessionCount}</th>
                  <th
                    style={{
                      textAlign: isRTL ? "left" : "right",
                      padding: "6px 4px",
                      fontWeight: 500,
                    }}
                  >
                    {t.revenue}
                  </th>
                </tr>
              </thead>
              <tbody>
                {cashierStats.map((c, i) => (
                  <tr key={c.name} style={{ borderBottom: i < cashierStats.length - 1 ? "1px solid var(--border)" : undefined }}>
                    <td style={{ padding: "8px 4px", color: "var(--text)" }}>{c.name}</td>
                    <td style={{ padding: "8px 4px", textAlign: "center", color: "var(--text2)" }}>{c.count}</td>
                    <td
                      style={{
                        padding: "8px 4px",
                        textAlign: isRTL ? "left" : "right",
                        color: "var(--text)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: isRTL ? "flex-start" : "flex-end",
                        gap: 3,
                      }}
                    >
                      {fmtMoney(c.revenue)} <SarSymbol size={12} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* occupancy by zone */}
        <div style={{ ...card }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", color: "var(--text)" }}>{t.byZone}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {zoneOccupancy.map((z) => {
              const zPct = z.total > 0 ? Math.round((z.active / z.total) * 100) : 0;
              return (
                <div key={z.name}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                      fontSize: "0.85rem",
                    }}
                  >
                    <span style={{ color: "var(--text)" }}>{z.name}</span>
                    <span style={{ color: "var(--text2)" }}>
                      {z.active}/{z.total}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "color-mix(in srgb, var(--border) 30%, transparent)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${zPct}%`,
                        borderRadius: 3,
                        background: zPct === 100 ? "var(--red)" : zPct >= 50 ? "var(--yellow)" : "var(--green)",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── KPI card sub-component ── */

function KpiCard({
  icon,
  label,
  value,
  sub,
  subColor,
  accentColor,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  sub: string;
  subColor: string;
  accentColor: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
            fontSize: "1.1rem",
          }}
        >
          {icon}
        </span>
        <span style={{ color: "var(--text2)", fontSize: "0.85rem" }}>{label}</span>
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{value}</div>
      <span style={{ color: subColor, fontSize: "0.78rem" }}>{sub}</span>
    </div>
  );
}
