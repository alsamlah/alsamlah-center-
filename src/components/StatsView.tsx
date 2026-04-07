"use client";

import { useState, useMemo } from "react";
import type { HistoryRecord, Debt, Session, UserRole } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { fmtMoney, fmtD, fmtTime, fmtDate, getBusinessDay } from "@/lib/utils";
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
type StatsTab = "dashboard" | "summary" | "detailed";

const ZONE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];
const PAY_COLORS: Record<string, string> = { cash: "#22c55e", card: "#6366f1", transfer: "#f59e0b" };

/* ── SVG Donut Chart ── */
function DonutChart({ data, size = 160 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const R = 50, CX = 60, CY = 60, STROKE = 25;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        {data.filter(d => d.value > 0).map((d, i) => {
          const pct = d.value / total;
          const dash = `${pct * C} ${C}`;
          const el = (
            <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={d.color}
              strokeWidth={STROKE} strokeDasharray={dash} strokeDashoffset={-offset}
              transform={`rotate(-90 ${CX} ${CY})`} />
          );
          offset += pct * C;
          return el;
        })}
        <text x={CX} y={CY - 4} textAnchor="middle" style={{ fontSize: 12, fill: "var(--text)", fontWeight: 700 }}>
          {fmtMoney(total)}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" style={{ fontSize: 7, fill: "var(--text2)" }}>&#xFDFC;</text>
      </svg>
    </div>
  );
}

/* ── Legend for donut ── */
function DonutLegend({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
      {data.filter(d => d.value > 0).map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text2)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
          {d.label} {Math.round((d.value / total) * 100)}%
        </div>
      ))}
    </div>
  );
}

export default function StatsView({ history, debts, sessions, role, settings, logo, currentBranchId, currentBranchName }: Props) {
  const [period, setPeriod] = useState<Period>("today");
  const [tab, setTab] = useState<StatsTab>("dashboard");
  const [allBranches, setAllBranches] = useState(false);
  const now = Date.now();
  const eodHour = settings.endOfDayHour ?? 5;

  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const isManager = role === "manager";

  // Detect multi-branch
  const hasBranches = isManager && currentBranchId && history.some(
    (h) => h.branchId && h.branchId !== currentBranchId
  );

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

  /* ── Aggregations ── */
  const totalRev = filtered.reduce((s, h) => s + h.total, 0);
  const totalSessions = filtered.length;
  const totalOrders = filtered.reduce((s, h) => s + h.orders.length, 0);
  const totalTime = filtered.reduce((s, h) => s + h.duration, 0);
  const totalPeople = filtered.reduce((s, h) => s + (h.playerCount || 1), 0);
  const totalDiscount = filtered.reduce((s, h) => s + (h.discount || 0), 0);
  const totalDebtAmt = filtered.reduce((s, h) => s + (h.debtAmount || 0), 0);
  const avgBill = totalSessions > 0 ? totalRev / totalSessions : 0;

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
  const topCust = Object.entries(byCust).sort((a, b) => b[1].rev - a[1].rev).slice(0, 10);

  // Orders revenue / time revenue
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

  // Sorted zone entries
  const zoneSorted = Object.entries(byZone).sort((a, b) => b[1].rev - a[1].rev);

  // Donut data
  const zoneDonutData = zoneSorted.map(([z, d], i) => ({ label: z, value: d.rev, color: ZONE_COLORS[i % ZONE_COLORS.length] }));
  const payDonutData = [
    { label: t.cash, value: byCash, color: PAY_COLORS.cash },
    { label: t.card, value: byCard, color: PAY_COLORS.card },
    { label: t.transfer, value: byTransfer, color: PAY_COLORS.transfer },
  ];

  /* ── Print ── */
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

  /* ── Excel Export ── */
  const handleExcelExport = () => {
    const esc = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cell = (v: string | number, bold = false, bg = "", color = "", align = "") => {
      let style = "";
      if (bold || bg || color || align) {
        const parts: string[] = [];
        if (bold) parts.push("font-weight:700");
        if (bg) parts.push(`background:${bg}`);
        if (color) parts.push(`color:${color}`);
        if (align) parts.push(`text-align:${align}`);
        style = ` style="${parts.join(";")}"`;
      }
      return `<td${style}>${esc(v)}</td>`;
    };

    // Sheet 1: Dashboard KPIs + zone table
    let s1 = `<div id="sheet1"><table border="1" cellpadding="6" style="border-collapse:collapse;direction:rtl">`;
    s1 += `<tr>${cell(isRTL ? "لوحة التحكم — " + periodLabel : "Dashboard — " + periodLabel, true, "#6366f1", "#fff")}<td></td><td></td><td></td></tr>`;
    s1 += `<tr>${cell("")}${cell("")}${cell("")}${cell("")}</tr>`;
    s1 += `<tr>${cell(isRTL ? "الإيراد" : "Revenue", true, "#dcfce7")}${cell(totalRev)}${cell(isRTL ? "الجلسات" : "Sessions", true, "#dbeafe")}${cell(totalSessions)}</tr>`;
    s1 += `<tr>${cell(isRTL ? "الزوار" : "Visitors", true, "#f3e8ff")}${cell(totalPeople)}${cell(isRTL ? "متوسط الفاتورة" : "Avg Bill", true, "#fef3c7")}${cell(avgBill.toFixed(1))}</tr>`;
    s1 += `<tr>${cell("")}${cell("")}${cell("")}${cell("")}</tr>`;
    s1 += `<tr>${cell(isRTL ? "القسم" : "Zone", true)}${cell(isRTL ? "الجلسات" : "Sessions", true)}${cell(isRTL ? "الإيراد" : "Revenue", true)}${cell(isRTL ? "المتوسط" : "Avg", true)}</tr>`;
    zoneSorted.forEach(([z, d]) => {
      s1 += `<tr>${cell(z)}${cell(d.count)}${cell(d.rev)}${cell(d.count > 0 ? (d.rev / d.count).toFixed(1) : "0")}</tr>`;
    });
    s1 += `</table></div>`;

    // Sheet 2: Summary (zone + cashier + top customers)
    let s2 = `<div id="sheet2"><table border="1" cellpadding="6" style="border-collapse:collapse;direction:rtl">`;
    s2 += `<tr>${cell(isRTL ? "ملخص الإيرادات حسب القسم" : "Revenue by Zone", true, "#e0e7ff")}<td></td><td></td><td></td></tr>`;
    s2 += `<tr>${cell(isRTL ? "القسم" : "Zone", true)}${cell(isRTL ? "الجلسات" : "Sessions", true)}${cell(isRTL ? "الإيراد" : "Revenue", true)}${cell(isRTL ? "المتوسط" : "Avg", true)}</tr>`;
    zoneSorted.forEach(([z, d]) => {
      s2 += `<tr>${cell(z)}${cell(d.count)}${cell(d.rev)}${cell(d.count > 0 ? (d.rev / d.count).toFixed(1) : "0")}</tr>`;
    });
    s2 += `<tr>${cell("")}${cell("")}${cell("")}${cell("")}</tr>`;
    if (isManager) {
      s2 += `<tr>${cell(isRTL ? "حسب الكاشير" : "By Cashier", true, "#e0e7ff")}<td></td><td></td><td></td></tr>`;
      s2 += `<tr>${cell(isRTL ? "الكاشير" : "Cashier", true)}${cell(isRTL ? "الجلسات" : "Sessions", true)}${cell(isRTL ? "الإيراد" : "Revenue", true)}${cell("")}</tr>`;
      Object.entries(byCashier).sort((a, b) => b[1].rev - a[1].rev).forEach(([c, d]) => {
        s2 += `<tr>${cell(c)}${cell(d.count)}${cell(d.rev)}${cell("")}</tr>`;
      });
      s2 += `<tr>${cell("")}${cell("")}${cell("")}${cell("")}</tr>`;
    }
    s2 += `<tr>${cell(isRTL ? "أفضل العملاء" : "Top Customers", true, "#e0e7ff")}<td></td><td></td><td></td></tr>`;
    s2 += `<tr>${cell("#", true)}${cell(isRTL ? "العميل" : "Customer", true)}${cell(isRTL ? "الزيارات" : "Visits", true)}${cell(isRTL ? "الإيراد" : "Revenue", true)}</tr>`;
    topCust.forEach(([name, data], i) => {
      s2 += `<tr>${cell(i + 1)}${cell(name)}${cell(data.count)}${cell(data.rev)}</tr>`;
    });
    s2 += `</table></div>`;

    // Sheet 3: Detailed
    let s3 = `<div id="sheet3"><table border="1" cellpadding="4" style="border-collapse:collapse;font-size:11px;direction:rtl">`;
    const hdr = [
      "#", isRTL ? "التاريخ" : "Date", isRTL ? "الوقت" : "Time", isRTL ? "العنصر" : "Item",
      isRTL ? "القسم" : "Zone", isRTL ? "العميل" : "Customer", isRTL ? "المدة" : "Duration",
      isRTL ? "إيراد الوقت" : "Time", isRTL ? "الطلبات" : "Orders", isRTL ? "خصم" : "Disc.",
      isRTL ? "الإجمالي" : "Total", isRTL ? "الدفع" : "Pay", isRTL ? "الكاشير" : "Cashier"
    ];
    s3 += `<tr>${hdr.map(h => cell(h, true, "#f1f5f9")).join("")}</tr>`;
    const sortedFiltered = [...filtered].sort((a, b) => b.endTime - a.endTime);
    sortedFiltered.forEach((h, i) => {
      const d = new Date(h.endTime);
      const bg = i % 2 === 0 ? "" : "#f9fafb";
      s3 += `<tr>`;
      s3 += cell(i + 1, false, bg);
      s3 += cell(d.toLocaleDateString("ar-SA"), false, bg);
      s3 += cell(d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true }), false, bg);
      s3 += cell(h.itemName, false, bg);
      s3 += cell(h.zoneName, false, bg);
      s3 += cell(h.customerName, false, bg);
      s3 += cell(fmtD(h.duration), false, bg);
      s3 += cell(h.timePrice, false, bg);
      s3 += cell(h.ordersTotal, false, bg);
      s3 += cell(h.discount || 0, false, bg);
      s3 += cell(h.total, false, bg);
      s3 += cell(h.payMethod === "cash" ? (isRTL ? "كاش" : "Cash") : h.payMethod === "card" ? (isRTL ? "شبكة" : "Card") : (isRTL ? "تحويل" : "Transfer"), false, bg);
      s3 += cell(h.cashier || "-", false, bg);
      s3 += `</tr>`;
    });
    s3 += `</table></div>`;

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>${isRTL ? "لوحة التحكم" : "Dashboard"}</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>${isRTL ? "ملخص" : "Summary"}</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>${isRTL ? "تفصيلي" : "Detailed"}</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>${s1}${s2}${s3}</body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${periodLabel}_${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Tab labels ── */
  const tabLabels: Record<StatsTab, string> = {
    dashboard: isRTL ? "لوحة التحكم" : "Dashboard",
    summary: isRTL ? "ملخص" : "Summary",
    detailed: isRTL ? "تفصيلي" : "Detailed",
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            📊 {t.reports}
          </h2>
          {hasBranches && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <button onClick={() => setAllBranches(false)}
                className="btn text-[11px] py-1 px-2.5"
                style={!allBranches ? {
                  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  color: "var(--accent)",
                  borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                } : { color: "var(--text2)" }}>
                {currentBranchName ?? (isRTL ? "هذا الفرع" : "This Branch")}
              </button>
              <button onClick={() => setAllBranches(true)}
                className="btn text-[11px] py-1 px-2.5"
                style={allBranches ? {
                  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  color: "var(--accent)",
                  borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                } : { color: "var(--text2)" }}>
                {isRTL ? "جميع الفروع" : "All Branches"}
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleExcelExport}
            className="btn px-3 py-1.5 text-xs"
            style={{ color: "var(--green)", borderColor: "color-mix(in srgb, var(--green) 20%, transparent)" }}>
            📥 {t.exportCsv ?? "Excel"}
          </button>
          <button onClick={handlePrintReport}
            className="btn px-3 py-1.5 text-xs"
            style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)" }}>
            🖨️ {t.printReport ?? "A4"}
          </button>
        </div>
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

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(["dashboard", "summary", "detailed"] as StatsTab[]).map((st) => (
          <button key={st} onClick={() => setTab(st)}
            className="btn px-4 py-2 text-xs"
            style={tab === st ? {
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              color: "var(--accent)",
              borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
            } : { color: "var(--text2)" }}>
            {st === "dashboard" ? "📊 " : st === "summary" ? "📋 " : "📄 "}{tabLabels[st]}
          </button>
        ))}
      </div>

      {/* ══════════ TAB 1: DASHBOARD ══════════ */}
      {tab === "dashboard" && (
        <div className="anim-fade">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: t.revenue, value: fmtMoney(totalRev), icon: "💰", color: "var(--green)", borderColor: "#22c55e" },
              { label: t.sessions, value: String(totalSessions), icon: "🎮", color: "var(--blue)", borderColor: "#3b82f6" },
              { label: t.visitors, value: String(totalPeople), icon: "👤", color: "#8b5cf6", borderColor: "#8b5cf6" },
              { label: isRTL ? "متوسط الفاتورة" : "Avg Bill", value: avgBill.toFixed(1), icon: "📊", color: "var(--yellow)", borderColor: "#f59e0b" },
            ].map((kpi, i) => (
              <div key={i} className="card p-4 relative overflow-hidden"
                style={{
                  borderInlineStart: `4px solid ${kpi.borderColor}`,
                  background: `color-mix(in srgb, ${kpi.borderColor} 5%, var(--surface))`,
                }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-medium mb-1" style={{ color: "var(--text2)" }}>{kpi.label}</div>
                    <div className="text-xl font-bold flex items-center gap-1" style={{ color: kpi.color }}>
                      {kpi.value}
                      {i === 0 && <SarSymbol size={14} />}
                      {i === 3 && <SarSymbol size={12} />}
                    </div>
                  </div>
                  <span className="text-2xl opacity-30">{kpi.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Breakdown mini row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { l: t.timeRev, v: timeRev, i: "⏱" },
              { l: t.ordersRev, v: ordersRev, i: "☕" },
              { l: t.discounts, v: totalDiscount, i: "🏷" },
              { l: t.activeNow, v: `${activeCount} (${activePeople}👤)`, i: "🏠", raw: true },
            ].map((m, i) => (
              <div key={i} className="card p-3 text-center">
                <div className="text-lg">{m.i}</div>
                <div className="text-sm font-bold mt-0.5 flex items-center justify-center gap-0.5" style={{ color: "var(--text)" }}>
                  {m.raw ? (m.v as string) : <>{fmtMoney(m.v as number)} <SarSymbol size={10} /></>}
                </div>
                <div className="text-[10px]" style={{ color: "var(--text2)" }}>{m.l}</div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Donut: Revenue by Zone */}
            {zoneSorted.length > 0 && (
              <div className="card p-5">
                <div className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>
                  📍 {t.byZone}
                </div>
                <DonutChart data={zoneDonutData} size={170} />
                <DonutLegend data={zoneDonutData} />
              </div>
            )}

            {/* Donut: Payment Methods */}
            {totalRev > 0 && (
              <div className="card p-5">
                <div className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>
                  💳 {t.payMethods}
                </div>
                <DonutChart data={payDonutData} size={170} />
                <DonutLegend data={payDonutData} />
              </div>
            )}
          </div>

          {/* Payment Method Cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {([
              { label: t.cash, icon: "💵", value: byCash, color: PAY_COLORS.cash },
              { label: t.card, icon: "💳", value: byCard, color: PAY_COLORS.card },
              { label: t.transfer, icon: "📲", value: byTransfer, color: PAY_COLORS.transfer },
            ]).map((pm, i) => {
              const pct = totalRev > 0 ? (pm.value / totalRev) * 100 : 0;
              return (
                <div key={i} className="card p-4"
                  style={{ background: `color-mix(in srgb, ${pm.color} 6%, var(--surface))` }}>
                  <div className="text-lg mb-1">{pm.icon}</div>
                  <div className="text-sm font-bold flex items-center gap-0.5" style={{ color: pm.color }}>
                    {fmtMoney(pm.value)} <SarSymbol size={10} />
                  </div>
                  <div className="text-[10px] mb-2" style={{ color: "var(--text2)" }}>{pm.label}</div>
                  <div className="progress-bar" style={{ height: 4 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: pm.color }} />
                  </div>
                  <div className="text-[10px] mt-1 font-semibold" style={{ color: pm.color }}>{pct.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════ TAB 2: SUMMARY ══════════ */}
      {tab === "summary" && (
        <div className="anim-fade">
          {/* Revenue by Zone Table */}
          {zoneSorted.length > 0 && (
            <div className="card p-5 mb-5">
              <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
                📍 {isRTL ? "الإيرادات حسب القسم" : "Revenue by Zone"}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      {[isRTL ? "القسم" : "Zone", isRTL ? "الجلسات" : "Sessions", isRTL ? "الإيراد" : "Revenue", isRTL ? "المتوسط" : "Avg/Session"].map((h, i) => (
                        <th key={i} style={{ padding: "8px 12px", textAlign: isRTL ? "right" : "left", color: "var(--text2)", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zoneSorted.map(([zone, data], i) => (
                      <tr key={zone} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--input-bg)" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--text)" }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: ZONE_COLORS[i % ZONE_COLORS.length], marginInlineEnd: 6 }} />
                          {zone}
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--text2)" }}>{data.count}</td>
                        <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--green)" }}>
                          <span className="flex items-center gap-0.5">{fmtMoney(data.rev)} <SarSymbol size={10} /></span>
                        </td>
                        <td style={{ padding: "8px 12px", color: "var(--text2)" }}>
                          {data.count > 0 ? (data.rev / data.count).toFixed(1) : "0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* By Cashier (manager only) */}
          {isManager && Object.keys(byCashier).length > 0 && (
            <div className="card p-5 mb-5">
              <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>👤 {t.byCashier}</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      {[isRTL ? "الكاشير" : "Cashier", isRTL ? "الجلسات" : "Sessions", isRTL ? "الإيراد" : "Revenue"].map((h, i) => (
                        <th key={i} style={{ padding: "8px 12px", textAlign: isRTL ? "right" : "left", color: "var(--text2)", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byCashier).sort((a, b) => b[1].rev - a[1].rev).map(([cashier, data], i) => (
                      <tr key={cashier} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--input-bg)" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--text)" }}>{cashier}</td>
                        <td style={{ padding: "8px 12px", color: "var(--text2)" }}>{data.count}</td>
                        <td style={{ padding: "8px 12px", fontWeight: 700, color: "var(--green)" }}>
                          <span className="flex items-center gap-0.5">{fmtMoney(data.rev)} <SarSymbol size={10} /></span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Customers */}
          {topCust.length > 0 && (
            <div className="card p-5 mb-5">
              <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
                ⭐ {t.topCustomers} (Top 10)
              </div>
              <div className="grid gap-2">
                {topCust.map(([name, data], i) => (
                  <div key={name} className="flex justify-between items-center text-xs px-2 py-2 rounded-lg"
                    style={{ background: i % 2 === 0 ? "var(--input-bg)" : "transparent" }}>
                    <span style={{ color: "var(--text)" }}>
                      <span className="font-bold" style={{ color: "var(--accent)", marginInlineEnd: 4 }}>{i + 1}.</span>
                      {name}
                      <span style={{ color: "var(--text2)", opacity: 0.6, marginInlineStart: 4 }}>({data.count} {t.visit})</span>
                    </span>
                    <span className="font-bold flex items-center gap-0.5" style={{ color: "var(--green)" }}>
                      {fmtMoney(data.rev)} <SarSymbol size={10} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debt Summary */}
          <div className="card p-5">
            <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>💰 {t.debtSummary}</div>
            <div className="grid gap-2">
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--text2)" }}>{t.debtors}</span>
                <span className="font-semibold" style={{ color: "var(--text)" }}>{unpaidDebts.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--red)" }}>{t.totalDebt}</span>
                <span className="font-bold flex items-center gap-0.5" style={{ color: "var(--red)" }}>
                  {fmtMoney(totalUnpaidDebt)} <SarSymbol size={10} />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ TAB 3: DETAILED ══════════ */}
      {tab === "detailed" && (
        <div className="anim-fade">
          {filtered.length === 0 ? (
            <div className="text-center py-16" style={{ color: "var(--text2)", opacity: 0.3 }}>
              {t.noHistory}
            </div>
          ) : (
            <div className="card p-3" style={{ overflowX: "auto" }}>
              <div className="text-xs font-semibold mb-3 px-2" style={{ color: "var(--text2)" }}>
                {filtered.length} {isRTL ? "جلسة" : "sessions"}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {[
                      "#",
                      isRTL ? "التاريخ" : "Date",
                      isRTL ? "الوقت" : "Time",
                      isRTL ? "العنصر" : "Item",
                      isRTL ? "القسم" : "Zone",
                      isRTL ? "العميل" : "Customer",
                      isRTL ? "المدة" : "Duration",
                      isRTL ? "الوقت" : "Time $",
                      isRTL ? "طلبات" : "Orders",
                      isRTL ? "خصم" : "Disc.",
                      isRTL ? "الإجمالي" : "Total",
                      isRTL ? "الدفع" : "Pay",
                      isRTL ? "الكاشير" : "Cashier",
                    ].map((h, i) => (
                      <th key={i} style={{
                        padding: "6px 8px", textAlign: isRTL ? "right" : "left",
                        color: "var(--text2)", fontWeight: 600, whiteSpace: "nowrap",
                        background: "var(--input-bg)", position: "sticky", top: 0,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...filtered].sort((a, b) => b.endTime - a.endTime).map((h, i) => {
                    const d = new Date(h.endTime);
                    const payLabel = h.payMethod === "cash" ? t.cash : h.payMethod === "card" ? t.card : t.transfer;
                    return (
                      <tr key={h.id || i} style={{
                        borderBottom: "1px solid var(--border)",
                        background: i % 2 === 0 ? "transparent" : "var(--input-bg)",
                      }}>
                        <td style={{ padding: "6px 8px", color: "var(--text2)" }}>{i + 1}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text)", whiteSpace: "nowrap" }}>
                          {d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
                        </td>
                        <td style={{ padding: "6px 8px", color: "var(--text2)", whiteSpace: "nowrap" }}>
                          {d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true })}
                        </td>
                        <td style={{ padding: "6px 8px", color: "var(--text)", fontWeight: 600 }}>{h.itemName}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text2)" }}>{h.zoneName}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text)" }}>{h.customerName}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text2)", whiteSpace: "nowrap" }}>{fmtD(h.duration)}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text)" }}>{fmtMoney(h.timePrice)}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text)" }}>{fmtMoney(h.ordersTotal)}</td>
                        <td style={{ padding: "6px 8px", color: h.discount ? "var(--blue)" : "var(--text2)" }}>
                          {h.discount ? fmtMoney(h.discount) : "-"}
                        </td>
                        <td style={{ padding: "6px 8px", fontWeight: 700, color: "var(--green)" }}>
                          {fmtMoney(h.total)}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <span style={{
                            fontSize: 10, padding: "2px 6px", borderRadius: 4,
                            background: `color-mix(in srgb, ${PAY_COLORS[h.payMethod] || "var(--accent)"} 12%, transparent)`,
                            color: PAY_COLORS[h.payMethod] || "var(--accent)",
                          }}>{payLabel}</span>
                        </td>
                        <td style={{ padding: "6px 8px", color: "var(--text2)" }}>{h.cashier || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
