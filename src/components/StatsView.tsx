"use client";

import { useState } from "react";
import type { HistoryRecord, Debt, Session, UserRole } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { fmtMoney, fmtD, fmtDate, isSameDay, isThisWeek, isThisMonth } from "@/lib/utils";
import SarSymbol from "./SarSymbol";

interface Props {
  history: HistoryRecord[];
  debts: Debt[];
  sessions: Record<string, Session>;
  role: UserRole;
  settings: SystemSettings;
}

type Period = "today" | "week" | "month" | "all";

export default function StatsView({ history, debts, sessions, role, settings }: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const now = Date.now();

  const t = T[settings.lang];
  const isManager = role === "manager";

  const filtered = history.filter((h) => {
    if (period === "today") return isSameDay(h.endTime, now);
    if (period === "week") return isThisWeek(h.endTime);
    if (period === "month") return isThisMonth(h.endTime);
    return true;
  });

  const totalRev = filtered.reduce((s, h) => s + h.total, 0);
  const totalSessions = filtered.length;
  const totalOrders = filtered.reduce((s, h) => s + h.orders.length, 0);
  const totalTime = filtered.reduce((s, h) => s + h.duration, 0);
  const totalPeople = filtered.reduce((s, h) => s + (h.playerCount || 1), 0);
  const totalDiscount = filtered.reduce((s, h) => s + (h.discount || 0), 0);
  const totalDebtAmt = filtered.reduce((s, h) => s + (h.debtAmount || 0), 0);

  const activeCount = Object.keys(sessions).length;
  const activePeople = Object.values(sessions).reduce((s, sess) => s + (sess.playerCount || 1), 0);

  // By payment method
  const byCash = filtered.filter((h) => h.payMethod === "cash").reduce((s, h) => s + h.total, 0);
  const byCard = filtered.filter((h) => h.payMethod === "card").reduce((s, h) => s + h.total, 0);
  const byTransfer = filtered.filter((h) => h.payMethod === "transfer").reduce((s, h) => s + h.total, 0);

  // By zone
  const byZone: Record<string, { count: number; rev: number }> = {};
  filtered.forEach((h) => {
    if (!byZone[h.zoneName]) byZone[h.zoneName] = { count: 0, rev: 0 };
    byZone[h.zoneName].count++;
    byZone[h.zoneName].rev += h.total;
  });

  // By cashier
  const byCashier: Record<string, { count: number; rev: number }> = {};
  filtered.forEach((h) => {
    const c = h.cashier || (settings.lang === "ar" ? "غير محدد" : "Unknown");
    if (!byCashier[c]) byCashier[c] = { count: 0, rev: 0 };
    byCashier[c].count++;
    byCashier[c].rev += h.total;
  });

  // Top customers
  const byCust: Record<string, { count: number; rev: number }> = {};
  filtered.forEach((h) => {
    if (!byCust[h.customerName]) byCust[h.customerName] = { count: 0, rev: 0 };
    byCust[h.customerName].count++;
    byCust[h.customerName].rev += h.total;
  });
  const topCust = Object.entries(byCust).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);

  // Orders revenue
  const ordersRev = filtered.reduce((s, h) => s + h.ordersTotal, 0);
  const timeRev = filtered.reduce((s, h) => s + h.timePrice, 0);

  // Debts summary
  const unpaidDebts = debts.filter((d) => !d.paid);
  const totalUnpaidDebt = unpaidDebts.reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  const periodLabels: Record<Period, string> = { today: t.today, week: t.week, month: t.month, all: t.all };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text)" }}>📊 {t.reports}</h2>

      {/* Period Filter */}
      <div className="flex gap-2 mb-6">
        {(["today", "week", "month", "all"] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className="btn flex-1 py-2.5 text-xs"
            style={{
              background: period === p ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--input-bg)",
              color: period === p ? "var(--accent)" : "var(--text2)",
              borderColor: period === p ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "var(--border)",
            }}>
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {[
          { l: t.revenue, v: <>{fmtMoney(totalRev)} <SarSymbol /></>, c: "var(--green)", i: "💰" },
          { l: t.sessions, v: String(totalSessions), c: "var(--accent)", i: "🎮" },
          { l: t.visitors, v: String(totalPeople), c: "var(--blue)", i: "👤" },
          { l: t.orders, v: String(totalOrders), c: "var(--yellow)", i: "🧾" },
          { l: t.totalTime, v: fmtD(totalTime), c: "var(--blue)", i: "⏱" },
          { l: t.activeNow, v: `${activeCount} (${activePeople}👤)`, c: "var(--accent)", i: "🏠" },
        ].map((s, i) => (
          <div key={i} className="card p-4 text-center">
            <div className="text-xl">{s.i}</div>
            <div className="text-base md:text-lg font-bold mt-1" style={{ color: s.c }}>{s.v}</div>
            <div className="text-[10px] font-medium mt-0.5" style={{ color: "var(--text2)" }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Revenue Breakdown */}
      <div className="card p-5 mb-4">
        <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>💰 {t.revenueDetails}</div>
        <div className="grid gap-2">
          <div className="flex justify-between text-xs"><span style={{ color: "var(--text2)" }}>⏱ {t.timeRev}</span><span className="font-semibold" style={{ color: "var(--text)" }}>{fmtMoney(timeRev)} <SarSymbol /></span></div>
          <div className="flex justify-between text-xs"><span style={{ color: "var(--text2)" }}>☕ {t.ordersRev}</span><span className="font-semibold" style={{ color: "var(--text)" }}>{fmtMoney(ordersRev)} <SarSymbol /></span></div>
          {totalDiscount > 0 && <div className="flex justify-between text-xs"><span style={{ color: "var(--blue)" }}>🏷 {t.discounts}</span><span className="font-semibold" style={{ color: "var(--blue)" }}>-{fmtMoney(totalDiscount)} <SarSymbol /></span></div>}
          {totalDebtAmt > 0 && <div className="flex justify-between text-xs"><span style={{ color: "var(--red)" }}>💳 {t.newDebts}</span><span className="font-semibold" style={{ color: "var(--red)" }}>{fmtMoney(totalDebtAmt)} <SarSymbol /></span></div>}
          <div className="flex justify-between text-sm font-bold pt-3 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text)" }}>{t.net}</span><span style={{ color: "var(--green)" }}>{fmtMoney(totalRev)} <SarSymbol /></span>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="card p-5 mb-4">
        <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>💳 {t.payMethods}</div>
        <div className="grid gap-3">
          {[
            { l: "💵 " + t.cash, v: byCash, c: "var(--green)" },
            { l: "💳 " + t.card, v: byCard, c: "var(--blue)" },
            { l: "📲 " + t.transfer, v: byTransfer, c: "var(--accent)" },
          ].map((m, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1.5">
                <span style={{ color: "var(--text2)" }}>{m.l}</span>
                <span className="font-semibold" style={{ color: "var(--text)" }}>{fmtMoney(m.v)} <SarSymbol /></span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${totalRev > 0 ? (m.v / totalRev) * 100 : 0}%`, background: m.c }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* By Zone */}
        {Object.keys(byZone).length > 0 && (
          <div className="card p-5">
            <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>📍 {t.byZone}</div>
            <div className="grid gap-2">
              {Object.entries(byZone).sort((a, b) => b[1].rev - a[1].rev).map(([zone, data]) => (
                <div key={zone} className="flex justify-between text-xs">
                  <span style={{ color: "var(--text2)" }}>{zone} <span style={{ opacity: 0.5 }}>({data.count} {t.session})</span></span>
                  <span className="font-semibold" style={{ color: "var(--text)" }}>{fmtMoney(data.rev)} <SarSymbol /></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By Cashier (manager only) */}
        {isManager && Object.keys(byCashier).length > 0 && (
          <div className="card p-5">
            <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>👤 {t.byCashier}</div>
            <div className="grid gap-2">
              {Object.entries(byCashier).sort((a, b) => b[1].rev - a[1].rev).map(([cashier, data]) => (
                <div key={cashier} className="flex justify-between text-xs">
                  <span style={{ color: "var(--text2)" }}>{cashier} <span style={{ opacity: 0.5 }}>({data.count} {t.session})</span></span>
                  <span className="font-semibold" style={{ color: "var(--text)" }}>{fmtMoney(data.rev)} <SarSymbol /></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top Customers */}
      {topCust.length > 0 && (
        <div className="card p-5 mb-4">
          <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>⭐ {t.topCustomers}</div>
          <div className="grid gap-2">
            {topCust.map(([name, data], i) => (
              <div key={name} className="flex justify-between items-center text-xs">
                <span style={{ color: "var(--text2)" }}>
                  <span className="font-bold" style={{ color: "var(--accent)" }}>{i + 1}.</span> {name}
                  <span style={{ opacity: 0.5 }}> ({data.count} {t.visit})</span>
                </span>
                <span className="font-semibold" style={{ color: "var(--text)" }}>{fmtMoney(data.rev)} <SarSymbol /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debt Summary */}
      <div className="card p-5">
        <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>💰 {t.debtSummary}</div>
        <div className="grid gap-2">
          <div className="flex justify-between text-xs"><span style={{ color: "var(--text2)" }}>{t.debtors}</span><span className="font-semibold" style={{ color: "var(--text)" }}>{unpaidDebts.length}</span></div>
          <div className="flex justify-between text-xs"><span style={{ color: "var(--red)" }}>{t.totalDebt}</span><span className="font-bold" style={{ color: "var(--red)" }}>{fmtMoney(totalUnpaidDebt)} <SarSymbol /></span></div>
        </div>
      </div>
    </div>
  );
}
