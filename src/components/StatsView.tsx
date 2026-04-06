"use client";

import { useState, useMemo } from "react";
import type { HistoryRecord, Debt, Session, UserRole } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { fmtMoney, fmtD, getBusinessDay } from "@/lib/utils";
import { printStatsReport } from "@/lib/printReceipt";
import SarSymbol from "./SarSymbol";

interface Props {
  history: HistoryRecord[];
  debts: Debt[];
  sessions: Record<string, Session>;
  role: UserRole;
  settings: SystemSettings;
  logo?: string | null;
  currentBranchId?: string | null;
  currentBranchName?: string | null;
}

type Period = "today" | "week" | "month" | "all";
type SubTab = "overview" | "items";

export default function StatsView({ history, debts, sessions, role, settings, logo, currentBranchId, currentBranchName }: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [allBranches, setAllBranches] = useState(false);
  const now = Date.now();
  const eodHour = settings.endOfDayHour ?? 5;

  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const isManager = role === "manager";

  // Detect multi-branch: does history contain records from >1 branch?
  const hasBranches = isManager && currentBranchId && history.some(
    (h) => h.branchId && h.branchId !== currentBranchId
  );

  // Branch-scoped history: when "this branch", filter records by branchId
  // Legacy records (no branchId) always appear in "this branch" view
  const branchFiltered = allBranches
    ? history
    : history.filter((h) => !h.branchId || h.branchId === currentBranchId);

  const filtered = useMemo(() => branchFiltered.filter((h) => {
    const bDay = getBusinessDay(h.endTime, eodHour);
    const today = getBusinessDay(now, eodHour);
    if (period === "today") return bDay === today;
    if (period === "week") return h.endTime >= now - 7 * 24 * 3600 * 1000;
    if (period === "month") {
      const d = new Date(h.endTime); const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    }
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [branchFiltered, period, eodHour]);

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

  // Item sales aggregate
  const itemMap: Record<string, { name: string; icon: string; qty: number; rev: number }> = {};
  for (const h of filtered) {
    for (const o of (h.orders || [])) {
      if (!itemMap[o.name]) itemMap[o.name] = { name: o.name, icon: o.icon || "", qty: 0, rev: 0 };
      itemMap[o.name].qty++;
      itemMap[o.name].rev += o.price || 0;
    }
  }
  const itemSales = Object.values(itemMap).sort((a, b) => b.qty - a.qty);

  // Period label for print
  const periodLabel = period === "today" ? t.today : period === "week" ? t.week : period === "month" ? t.month : t.all;

  // Debts summary
  const unpaidDebts = debts.filter((d) => !d.paid);
  const totalUnpaidDebt = unpaidDebts.reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  const periodLabels: Record<Period, string> = { today: t.today, week: t.week, month: t.month, all: t.all };

  const handlePrintReport = () => {
    printStatsReport({
      dateLabel: periodLabel,
      sessionCount: totalSessions,
      totalRevenue: totalRev,
      cashRevenue: byCash,
      cardRevenue: byCard,
      transferRevenue: byTransfer,
      debtTotal: totalDebtAmt,
      discountTotal: totalDiscount,
      netRevenue: totalRev - totalDiscount,
      ordersRevenue: ordersRev,
      timeRevenue: timeRev,
      byZone,
      itemSales,
      logo,
    }, "a4");
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>📊 {t.reports}</h2>
          {hasBranches && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <button
                onClick={() => setAllBranches(false)}
                className="btn text-[11px] py-1 px-2.5"
                style={!allBranches ? {
                  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  color: "var(--accent)",
                  borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                } : { color: "var(--text2)" }}>
                🏠 {currentBranchName ?? (isRTL ? "هذا الفرع" : "This Branch")}
              </button>
              <button
                onClick={() => setAllBranches(true)}
                className="btn text-[11px] py-1 px-2.5"
                style={allBranches ? {
                  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  color: "var(--accent)",
                  borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                } : { color: "var(--text2)" }}>
                🌐 {isRTL ? "جميع الفروع" : "All Branches"}
              </button>
            </div>
          )}
        </div>
        <button onClick={handlePrintReport}
          className="btn px-3 py-1.5 text-xs"
          style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)" }}>
          🖨️ {t.printReport ?? "طباعة التقرير"}
        </button>
      </div>

      {/* Period Filter */}
      <div className="flex gap-2 mb-4">
        {(["today", "week", "month", "all"] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className="btn flex-1 py-2.5 text-xs"
            style={{
              background: period === p ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--input-bg)",
              color: period === p ? "var(--accent)" : "var(--text2)",
              borderColor: period === p ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "var(--border)",
            }}>
            {p === "today" ? t.today : p === "week" ? t.week : p === "month" ? t.month : t.all}
          </button>
        ))}
      </div>

      {/* Sub-tab row */}
      <div className="flex gap-2 mb-5">
        {(["overview", "items"] as SubTab[]).map((st) => (
          <button key={st} onClick={() => setSubTab(st)}
            className="btn px-4 py-2 text-xs"
            style={subTab === st ? {
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              color: "var(--accent)",
              borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
            } : { color: "var(--text2)" }}>
            {st === "overview" ? (t.overview ?? (isRTL ? "نظرة عامة" : "Overview")) : (t.itemSales ?? (isRTL ? "مبيعات الأصناف" : "Item Sales"))}
          </button>
        ))}
      </div>

      {subTab === "items" ? (
        /* ── Items Tab ── */
        <div>
          {itemSales.length === 0 ? (
            <div className="text-center py-16" style={{ color: "var(--text2)", opacity: 0.3 }}>
              {isRTL ? "لا توجد مبيعات" : "No item sales"}
            </div>
          ) : (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold" style={{ color: "var(--text)" }}>
                  ☕ {t.itemSales ?? "مبيعات الأصناف"} ({itemSales.length})
                </div>
                <span className="text-xs" style={{ color: "var(--text2)" }}>
                  {t.qty ?? "الكمية"} / {isRTL ? "الإيراد" : "Revenue"}
                </span>
              </div>
              <div className="grid gap-2">
                {itemSales.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
                    style={{ background: i % 2 === 0 ? "var(--input-bg)" : "transparent" }}>
                    <span className="w-6 text-center font-bold" style={{ color: "var(--text2)", opacity: 0.5 }}>{i + 1}</span>
                    <span className="text-base">{item.icon}</span>
                    <span className="flex-1 font-semibold" style={{ color: "var(--text)" }}>{item.name}</span>
                    <span className="font-bold px-2 py-0.5 rounded"
                      style={{ background: "color-mix(in srgb, var(--blue) 10%, transparent)", color: "var(--blue)" }}>
                      ×{item.qty}
                    </span>
                    <span className="font-bold flex items-center gap-0.5" style={{ color: "var(--green)" }}>
                      {fmtMoney(item.rev)} <SarSymbol size={10} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Overview Tab ── */
        <div>

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
      )}
    </div>
  );
}
