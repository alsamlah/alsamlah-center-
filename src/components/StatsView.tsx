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

  /* ── Excel Export (Power BI Level) ── */
  const handleExcelExport = () => {
    const ar = isRTL;
    const esc = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    const mkBar = (val: number, max: number, len = 14) => {
      if (max === 0) return "";
      const filled = Math.round((val / max) * len);
      return "\u2588".repeat(filled) + "\u2591".repeat(len - filled);
    };

    type TdOpts = { bold?: boolean; bg?: string; color?: string; align?: string; size?: number; colspan?: number; pad?: number };
    const td = (v: string | number, opts: TdOpts = {}) => {
      const s = [
        "font-family:Arial,sans-serif",
        `padding:${opts.pad ?? 7}px 10px`,
        "border:1px solid #d1d5db",
        "vertical-align:middle",
        opts.bold ? "font-weight:700" : "",
        opts.bg ? `background:${opts.bg}` : "",
        opts.color ? `color:${opts.color}` : "",
        opts.align ? `text-align:${opts.align}` : "",
        opts.size ? `font-size:${opts.size}px` : "",
      ].filter(Boolean).join(";");
      const span = opts.colspan ? ` colspan="${opts.colspan}"` : "";
      return `<td${span} style="${s}">${esc(v)}</td>`;
    };
    const gap = (cols: number) => `<tr style="height:10px">${Array(cols).fill(`<td style="border:none;padding:0"></td>`).join("")}</tr>`;
    const secHeader = (title: string, cols: number, bg = "#1e40af") =>
      `<tr>${td(title, { colspan: cols, bold: true, bg, color: "#ffffff", size: 13, pad: 10 })}</tr>`;

    const nowDate = new Date();
    const exportDate = nowDate.toLocaleDateString("ar-SA");
    const exportTime = nowDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

    // ═══════════════════════════════════════════
    // SHEET 1 — DASHBOARD
    // ═══════════════════════════════════════════
    const C1 = 8;
    let s1 = `<div id="sheet1"><table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;direction:rtl;font-family:Arial">`;

    // Title bar
    s1 += `<tr>${td(ar ? `\uD83D\uDCCA \u0645\u0631\u0643\u0632 \u0627\u0644\u0635\u0645\u0644\u0629 \u2014 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645` : "\uD83D\uDCCA ALSAMLAH \u2014 Dashboard", { colspan: C1, bold: true, bg: "#0f172a", color: "#ffffff", size: 16, pad: 14 })}</tr>`;
    s1 += `<tr>${td(`${ar ? "\u0627\u0644\u0641\u062A\u0631\u0629" : "Period"}: ${periodLabel}   |   ${ar ? "\u0627\u0644\u062A\u0627\u0631\u064A\u062E" : "Date"}: ${exportDate}   |   ${ar ? "\u0648\u0642\u062A \u0627\u0644\u062A\u0635\u062F\u064A\u0631" : "Exported"}: ${exportTime}`, { colspan: C1, bg: "#1e293b", color: "#94a3b8", size: 11 })}</tr>`;
    s1 += gap(C1);

    // KPI section header
    s1 += secHeader(ar ? "\uD83D\uDCC8 \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629" : "\uD83D\uDCC8 Key Performance Indicators", C1, "#1e40af");
    s1 += gap(C1);

    // KPI label row
    const kpiLabels = [
      { label: ar ? "\uD83D\uDCB0 \u0627\u0644\u0625\u064A\u0631\u0627\u062F \u0627\u0644\u0643\u0644\u064A" : "\uD83D\uDCB0 Total Revenue", bg: "#166534", fg: "#dcfce7" },
      { label: ar ? "\uD83C\uDFAE \u0627\u0644\u062C\u0644\u0633\u0627\u062A" : "\uD83C\uDFAE Sessions", bg: "#1e40af", fg: "#dbeafe" },
      { label: ar ? "\uD83D\uDC65 \u0627\u0644\u0632\u0648\u0627\u0631" : "\uD83D\uDC65 Visitors", bg: "#581c87", fg: "#f3e8ff" },
      { label: ar ? "\uD83E\uDDFE \u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629" : "\uD83E\uDDFE Avg Bill", bg: "#854d0e", fg: "#fef3c7" },
      { label: ar ? "\u23F1 \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0648\u0642\u062A" : "\u23F1 Total Time", bg: "#0f766e", fg: "#ccfbf1" },
      { label: ar ? "\uD83D\uDCE6 \u0627\u0644\u0637\u0644\u0628\u0627\u062A" : "\uD83D\uDCE6 Orders", bg: "#075985", fg: "#e0f2fe" },
      { label: ar ? "\uD83D\uDCB8 \u0627\u0644\u062E\u0635\u0648\u0645\u0627\u062A" : "\uD83D\uDCB8 Discounts", bg: "#7f1d1d", fg: "#fee2e2" },
      { label: ar ? "\uD83D\uDCCB \u0627\u0644\u062F\u064A\u0648\u0646" : "\uD83D\uDCCB Debts", bg: "#713f12", fg: "#fef9c3" },
    ];
    s1 += `<tr>${kpiLabels.map(k => td(k.label, { bold: true, bg: k.bg, color: k.fg, size: 10, align: "center" })).join("")}</tr>`;

    const kpiVals = [
      `${fmt(totalRev)} \uFDFC`,
      fmt(totalSessions),
      fmt(totalPeople),
      `${avgBill.toFixed(1)} \uFDFC`,
      fmtD(totalTime),
      fmt(totalOrders),
      `${fmt(totalDiscount)} \uFDFC`,
      `${fmt(totalDebtAmt)} \uFDFC`,
    ];
    const kpiBgs = ["#dcfce7","#dbeafe","#f3e8ff","#fef3c7","#ccfbf1","#e0f2fe","#fee2e2","#fef9c3"];
    const kpiFgs = ["#166534","#1e40af","#581c87","#854d0e","#0f766e","#075985","#7f1d1d","#713f12"];
    s1 += `<tr>${kpiVals.map((v, i) => td(v, { bold: true, bg: kpiBgs[i], color: kpiFgs[i], size: 18, align: "center", pad: 12 })).join("")}</tr>`;
    s1 += gap(C1);

    // Revenue breakdown
    s1 += secHeader(ar ? "\uD83D\uDCB5 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0625\u064A\u0631\u0627\u062F" : "\uD83D\uDCB5 Revenue Breakdown", C1, "#0f766e");
    s1 += `<tr>${[ar?"\u0627\u0644\u0628\u0646\u062F":"Item", ar?"\u0627\u0644\u0645\u0628\u0644\u063A (\uFDFC)":"Amount (SAR)", ar?"\u0627\u0644\u0646\u0633\u0628\u0629":"Ratio", ar?"\u0631\u0633\u0645 \u0628\u064A\u0627\u0646\u064A":"Visual","","","",""].map((h,i) => td(h, { bold: true, bg: "#f1f5f9", color: "#374151", align: i>1?"center":"" })).join("")}</tr>`;
    const revMax = Math.max(timeRev, ordersRev, 1);
    [
      { label: ar ? "\u23F1 \u0625\u064A\u0631\u0627\u062F \u0627\u0644\u0648\u0642\u062A" : "\u23F1 Time Revenue", val: timeRev, bg: "#dcfce7", fg: "#166534" },
      { label: ar ? "\uD83D\uDCE6 \u0625\u064A\u0631\u0627\u062F \u0627\u0644\u0637\u0644\u0628\u0627\u062A" : "\uD83D\uDCE6 Orders Revenue", val: ordersRev, bg: "#dbeafe", fg: "#1e40af" },
      { label: ar ? "\uD83D\uDCB8 \u0627\u0644\u062E\u0635\u0648\u0645\u0627\u062A" : "\uD83D\uDCB8 Discounts", val: totalDiscount, bg: "#fee2e2", fg: "#7f1d1d" },
      { label: ar ? "\uD83D\uDCCB \u0627\u0644\u062F\u064A\u0648\u0646" : "\uD83D\uDCCB Debts", val: totalDebtAmt, bg: "#fef9c3", fg: "#713f12" },
    ].forEach(r => {
      const pct = totalRev > 0 ? Math.round((r.val / totalRev) * 100) : 0;
      s1 += `<tr>${td(r.label,{bg:r.bg,color:r.fg,bold:true})}${td(`${fmt(r.val)} \uFDFC`,{align:"center",bold:true})}${td(`${pct}%`,{align:"center",color:r.fg})}${td(mkBar(r.val,revMax),{color:r.fg,colspan:5,size:10})}</tr>`;
    });
    s1 += `<tr>${td(ar?"\u2705 \u0627\u0644\u0635\u0627\u0641\u064A":"\u2705 Net",{bold:true,bg:"#166534",color:"#fff"})}${td(`${fmt(totalRev-totalDiscount-totalDebtAmt)} \uFDFC`,{bold:true,bg:"#166534",color:"#fff",align:"center"})}${td("",{bg:"#166534",colspan:6})}</tr>`;
    s1 += gap(C1);

    // Payment methods
    s1 += secHeader(ar ? "\uD83D\uDCB3 \u0637\u0631\u0642 \u0627\u0644\u062F\u0641\u0639" : "\uD83D\uDCB3 Payment Methods", C1, "#1e40af");
    s1 += `<tr>${[ar?"\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639":"Method", ar?"\u0627\u0644\u0645\u0628\u0644\u063A":"Amount", ar?"\u0627\u0644\u062C\u0644\u0633\u0627\u062A":"Sessions", ar?"\u0627\u0644\u0646\u0633\u0628\u0629":"Ratio", ar?"\u0631\u0633\u0645 \u0628\u064A\u0627\u0646\u064A":"Visual","","",""].map((h,i) => td(h, { bold: true, bg: "#f1f5f9", color: "#374151", align: i>0?"center":"" })).join("")}</tr>`;
    const cashCnt = filtered.filter(h => h.payMethod === "cash").length;
    const cardCnt = filtered.filter(h => h.payMethod === "card").length;
    const xfrCnt  = filtered.filter(h => h.payMethod === "transfer").length;
    const payMax  = Math.max(byCash, byCard, byTransfer, 1);
    [
      { label: ar?"\uD83D\uDCB5 \u0646\u0642\u062F":"\uD83D\uDCB5 Cash", val: byCash, cnt: cashCnt, bg: "#dcfce7", fg: "#166534" },
      { label: ar?"\uD83D\uDCB3 \u0634\u0628\u0643\u0629":"\uD83D\uDCB3 Card", val: byCard, cnt: cardCnt, bg: "#dbeafe", fg: "#1e40af" },
      { label: ar?"\uD83D\uDD04 \u062A\u062D\u0648\u064A\u0644":"\uD83D\uDD04 Transfer", val: byTransfer, cnt: xfrCnt, bg: "#fef9c3", fg: "#854d0e" },
    ].forEach(r => {
      const pct = totalRev > 0 ? Math.round((r.val / totalRev) * 100) : 0;
      s1 += `<tr>${td(r.label,{bg:r.bg,color:r.fg,bold:true})}${td(`${fmt(r.val)} \uFDFC`,{align:"center"})}${td(fmt(r.cnt),{align:"center"})}${td(`${pct}%`,{align:"center",bold:true,color:r.fg})}${td(mkBar(r.val,payMax),{color:r.fg,colspan:4,size:10})}</tr>`;
    });
    s1 += gap(C1);

    // Zone performance
    s1 += secHeader(ar ? "\uD83C\uDFC6 \u0623\u062F\u0627\u0621 \u0627\u0644\u0623\u0642\u0633\u0627\u0645" : "\uD83C\uDFC6 Zone Performance", C1, "#581c87");
    s1 += `<tr>${[ar?"#":"#", ar?"\u0627\u0644\u0642\u0633\u0645":"Zone", ar?"\u0627\u0644\u062C\u0644\u0633\u0627\u062A":"Sessions", ar?"\u0627\u0644\u0625\u064A\u0631\u0627\u062F (\uFDFC)":"Revenue", ar?"\u0627\u0644\u0645\u062A\u0648\u0633\u0637":"Avg", ar?"\u0627\u0644\u0646\u0633\u0628\u0629":"Share", ar?"\u0631\u0633\u0645 \u0628\u064A\u0627\u0646\u064A":"Visual",""].map((h,i) => td(h, { bold: true, bg: "#f1f5f9", color: "#374151", align: i>1?"center":"" })).join("")}</tr>`;
    const zoneMax2 = zoneSorted.length > 0 ? zoneSorted[0][1].rev : 1;
    const zBgs = ["#fef3c7","#dcfce7","#dbeafe","#f3e8ff","#fce7f3","#ccfbf1","#ffedd5","#e0f2fe"];
    const zFgs = ["#854d0e","#166534","#1e40af","#581c87","#9d174d","#0f766e","#9a3412","#075985"];
    zoneSorted.forEach(([z, d], i) => {
      const pct = totalRev > 0 ? (d.rev / totalRev * 100).toFixed(1) : "0.0";
      const avg = d.count > 0 ? (d.rev / d.count).toFixed(1) : "0";
      const bg  = i % 2 === 0 ? "#f8fafc" : "#ffffff";
      s1 += `<tr>${td(i+1,{bg:zBgs[i%8],color:zFgs[i%8],bold:true,align:"center"})}${td(z,{bg,bold:i===0})}${td(fmt(d.count),{bg,align:"center"})}${td(`${fmt(d.rev)} \uFDFC`,{bg,align:"center",bold:true})}${td(`${avg} \uFDFC`,{bg,align:"center"})}${td(`${pct}%`,{bg,align:"center",color:"#581c87",bold:true})}${td(mkBar(d.rev,zoneMax2,12),{bg,color:zFgs[i%8],size:10})}${td("",{bg})}</tr>`;
    });
    s1 += `<tr>${td(ar?"\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A":"TOTAL",{bold:true,bg:"#0f172a",color:"#fff",colspan:2})}${td(fmt(totalSessions),{bold:true,bg:"#0f172a",color:"#fff",align:"center"})}${td(`${fmt(totalRev)} \uFDFC`,{bold:true,bg:"#0f172a",color:"#22c55e",align:"center"})}${td(`${avgBill.toFixed(1)} \uFDFC`,{bold:true,bg:"#0f172a",color:"#fff",align:"center"})}${td("100%",{bold:true,bg:"#0f172a",color:"#fff",align:"center"})}${td("",{bg:"#0f172a",colspan:2})}</tr>`;

    // Item sales
    if (itemSales.length > 0) {
      s1 += gap(C1);
      s1 += secHeader(ar ? "\uD83C\uDF7D\uFE0F \u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0623\u0635\u0646\u0627\u0641" : "\uD83C\uDF7D\uFE0F Item Sales", C1, "#075985");
      s1 += `<tr>${[ar?"#":"#", ar?"\u0627\u0644\u0635\u0646\u0641":"Item", ar?"\u0627\u0644\u0643\u0645\u064A\u0629":"Qty", ar?"\u0627\u0644\u0625\u064A\u0631\u0627\u062F":"Revenue", ar?"\u0633\u0639\u0631 \u0627\u0644\u0648\u062D\u062F\u0629":"Avg Price", ar?"\u0631\u0633\u0645 \u0628\u064A\u0627\u0646\u064A":"Visual","",""].map((h,i) => td(h,{bold:true,bg:"#f1f5f9",color:"#374151",align:i>1?"center":""})).join("")}</tr>`;
      const iMax = itemSales.length > 0 ? itemSales[0].qty : 1;
      itemSales.slice(0, 15).forEach((it, i) => {
        const bg  = i % 2 === 0 ? "#f8fafc" : "#ffffff";
        const avgP = it.qty > 0 ? (it.rev / it.qty).toFixed(1) : "0";
        s1 += `<tr>${td(i+1,{bg,align:"center",color:"#6b7280",size:10})}${td(`${it.icon} ${it.name}`,{bg,size:10})}${td(fmt(it.qty),{bg,align:"center",bold:true,size:10})}${td(`${fmt(it.rev)} \uFDFC`,{bg,align:"center",size:10})}${td(`${avgP} \uFDFC`,{bg,align:"center",size:10})}${td(mkBar(it.qty,iMax,12),{bg,color:"#075985",size:10})}${td("",{bg,colspan:2})}</tr>`;
      });
    }

    s1 += gap(C1);
    s1 += `<tr>${td(ar?`\u062A\u0645 \u0627\u0644\u062A\u0635\u062F\u064A\u0631 \u0628\u062A\u0627\u0631\u064A\u062E ${exportDate} \u2014 \u0645\u0631\u0643\u0632 \u0627\u0644\u0635\u0645\u0644\u0629 \u0644\u0644\u062A\u0631\u0641\u064A\u0647`:`Exported ${exportDate} \u2014 ALSAMLAH Entertainment Center`,{colspan:C1,color:"#94a3b8",size:10,bg:"#0f172a",align:"center"})}</tr>`;
    s1 += `</table></div>`;

    // ═══════════════════════════════════════════
    // SHEET 2 — SUMMARY
    // ═══════════════════════════════════════════
    const C2 = 6;
    let s2 = `<div id="sheet2"><table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;direction:rtl;font-family:Arial">`;
    s2 += `<tr>${td(ar?`\uD83D\uDCCB \u0645\u0644\u062E\u0635 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u2014 ${periodLabel}`:` \uD83D\uDCCB Summary \u2014 ${periodLabel}`,{colspan:C2,bold:true,bg:"#0f172a",color:"#fff",size:15,pad:14})}</tr>`;
    s2 += gap(C2);

    // Zone table
    s2 += secHeader(ar?"\uD83C\uDFC6 \u0627\u0644\u0625\u064A\u0631\u0627\u062F \u062D\u0633\u0628 \u0627\u0644\u0642\u0633\u0645":"\uD83C\uDFC6 Revenue by Zone", C2, "#1e40af");
    s2 += `<tr>${[ar?"#":"#",ar?"\u0627\u0644\u0642\u0633\u0645":"Zone",ar?"\u0627\u0644\u062C\u0644\u0633\u0627\u062A":"Sessions",ar?"\u0627\u0644\u0625\u064A\u0631\u0627\u062F (\uFDFC)":"Revenue",ar?"\u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629":"Avg Bill",ar?"% \u0645\u0646 \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A":"% Share"].map((h,i)=>td(h,{bold:true,bg:"#1e40af",color:"#fff",align:i>1?"center":""})).join("")}</tr>`;
    zoneSorted.forEach(([z, d], i) => {
      const pct = totalRev > 0 ? (d.rev/totalRev*100).toFixed(1) : "0.0";
      const avg = d.count > 0 ? (d.rev/d.count).toFixed(1) : "0";
      const bg  = i === 0 ? "#dcfce7" : i % 2 === 0 ? "#f8fafc" : "#fff";
      s2 += `<tr>${td(i+1,{bg,align:"center",color:"#6b7280"})}${td(z,{bg,bold:i===0})}${td(fmt(d.count),{bg,align:"center"})}${td(`${fmt(d.rev)} \uFDFC`,{bg,align:"center",bold:true,color:i===0?"#166534":"#374151"})}${td(`${avg} \uFDFC`,{bg,align:"center"})}${td(`${pct}%`,{bg,align:"center",bold:i===0,color:"#1e40af"})}</tr>`;
    });
    s2 += `<tr>${td(ar?"\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A":"TOTAL",{bold:true,bg:"#0f172a",color:"#fff",colspan:2})}${td(fmt(totalSessions),{bold:true,bg:"#0f172a",color:"#fff",align:"center"})}${td(`${fmt(totalRev)} \uFDFC`,{bold:true,bg:"#0f172a",color:"#22c55e",align:"center"})}${td(`${avgBill.toFixed(1)} \uFDFC`,{bold:true,bg:"#0f172a",color:"#fff",align:"center"})}${td("100%",{bold:true,bg:"#0f172a",color:"#fff",align:"center"})}</tr>`;
    s2 += gap(C2);

    // Cashier table
    if (isManager && Object.keys(byCashier).length > 0) {
      s2 += secHeader(ar?"\uD83D\uDC64 \u0627\u0644\u0623\u062F\u0627\u0621 \u062D\u0633\u0628 \u0627\u0644\u0643\u0627\u0634\u064A\u0631":"\uD83D\uDC64 Performance by Cashier", C2, "#0f766e");
      s2 += `<tr>${[ar?"\u0627\u0644\u0643\u0627\u0634\u064A\u0631":"Cashier",ar?"\u0627\u0644\u062C\u0644\u0633\u0627\u062A":"Sessions",ar?"\u0627\u0644\u0625\u064A\u0631\u0627\u062F":"Revenue",ar?"\u0627\u0644\u0645\u062A\u0648\u0633\u0637":"Avg Bill",ar?"% \u0627\u0644\u0645\u0633\u0627\u0647\u0645\u0629":"Contribution",""].map(h=>td(h,{bold:true,bg:"#0f766e",color:"#fff",align:"center"})).join("")}</tr>`;
      Object.entries(byCashier).sort((a,b)=>b[1].rev-a[1].rev).forEach(([c, d], i) => {
        const pct = totalRev > 0 ? (d.rev/totalRev*100).toFixed(1) : "0.0";
        const avg = d.count > 0 ? (d.rev/d.count).toFixed(1) : "0";
        const bg  = i % 2 === 0 ? "#f0fdfa" : "#fff";
        s2 += `<tr>${td(c,{bg,bold:i===0})}${td(fmt(d.count),{bg,align:"center"})}${td(`${fmt(d.rev)} \uFDFC`,{bg,align:"center",bold:true,color:"#0f766e"})}${td(`${avg} \uFDFC`,{bg,align:"center"})}${td(`${pct}%`,{bg,align:"center"})}${td("",{bg})}</tr>`;
      });
      s2 += gap(C2);
    }

    // Top customers
    if (topCust.length > 0) {
      s2 += secHeader(ar?"\u2B50 \u0623\u0643\u062B\u0631 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0625\u0646\u0641\u0627\u0642\u064B\u0627":"\u2B50 Top Customers", C2, "#854d0e");
      s2 += `<tr>${[ar?"#":"#",ar?"\u0627\u0644\u0639\u0645\u064A\u0644":"Customer",ar?"\u0627\u0644\u0632\u064A\u0627\u0631\u0627\u062A":"Visits",ar?"\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0625\u0646\u0641\u0627\u0642":"Total Spend",ar?"\u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u0632\u064A\u0627\u0631\u0629":"Avg/Visit",""].map((h,i)=>td(h,{bold:true,bg:"#fef3c7",color:"#854d0e",align:i>1?"center":""})).join("")}</tr>`;
      const medals = ["\uD83E\uDD47","\uD83E\uDD48","\uD83E\uDD49"];
      topCust.forEach(([name, d], i) => {
        const avg = d.count > 0 ? (d.rev/d.count).toFixed(1) : "0";
        const bg  = i === 0 ? "#fef9c3" : i === 1 ? "#f3f4f6" : i === 2 ? "#fff7ed" : i % 2 === 0 ? "#fefce8" : "#fff";
        s2 += `<tr>${td(medals[i]??(i+1),{bg,align:"center",bold:i<3})}${td(name,{bg,bold:i<3})}${td(fmt(d.count),{bg,align:"center"})}${td(`${fmt(d.rev)} \uFDFC`,{bg,align:"center",bold:i<3,color:i===0?"#854d0e":"#374151"})}${td(`${avg} \uFDFC`,{bg,align:"center"})}${td("",{bg})}</tr>`;
      });
      s2 += gap(C2);
    }

    // Debts summary
    s2 += secHeader(ar?"\uD83D\uDD34 \u0645\u0644\u062E\u0635 \u0627\u0644\u062F\u064A\u0648\u0646":"\uD83D\uDD34 Debts Summary", C2, "#7f1d1d");
    const totAllDebts = debts.reduce((s,d)=>s+d.amount,0);
    const totPaid     = debts.reduce((s,d)=>s+d.paidAmount,0);
    s2 += `<tr>${td(ar?"\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u062F\u064A\u0646\u064A\u0646":"Total Debtors",{bold:true,bg:"#fee2e2",color:"#7f1d1d"})}${td(fmt(unpaidDebts.length),{align:"center",bold:true})}${td(ar?"\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062F\u064A\u0648\u0646":"Total Debt",{bold:true,bg:"#fee2e2",color:"#7f1d1d"})}${td(`${fmt(totAllDebts)} \uFDFC`,{align:"center",bold:true})}${td(ar?"\u0627\u0644\u0645\u062F\u0641\u0648\u0639":"Paid",{bold:true,bg:"#dcfce7",color:"#166534"})}${td(`${fmt(totPaid)} \uFDFC`,{align:"center",bold:true,color:"#166534"})}</tr>`;
    s2 += `<tr>${td(ar?"\u0627\u0644\u0645\u062A\u0628\u0642\u064A \u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0641\u0648\u0639":"Remaining Unpaid",{bold:true,bg:"#7f1d1d",color:"#fff",colspan:4})}${td(`${fmt(totalUnpaidDebt)} \uFDFC`,{bold:true,bg:"#7f1d1d",color:"#fff",align:"center",colspan:2})}</tr>`;

    s2 += gap(C2);
    s2 += `<tr>${td(ar?`\u0645\u0631\u0643\u0632 \u0627\u0644\u0635\u0645\u0644\u0629 \u2014 ${exportDate}`:`ALSAMLAH \u2014 ${exportDate}`,{colspan:C2,color:"#94a3b8",size:10,bg:"#0f172a",align:"center"})}</tr>`;
    s2 += `</table></div>`;

    // ═══════════════════════════════════════════
    // SHEET 3 — DETAILED
    // ═══════════════════════════════════════════
    const C3 = 18;
    let s3 = `<div id="sheet3"><table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;direction:rtl;font-family:Arial">`;
    s3 += `<tr>${td(ar?`\uD83D\uDCDD \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062A\u0641\u0635\u064A\u0644\u064A \u2014 ${periodLabel} (${totalSessions} ${ar?"\u062C\u0644\u0633\u0629":"sessions"})`:` \uD83D\uDCDD Detailed \u2014 ${periodLabel} (${totalSessions} sessions)`,{colspan:C3,bold:true,bg:"#0f172a",color:"#fff",size:14,pad:12})}</tr>`;

    const dh = [
      ar?"#":"#", ar?"\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629":"Invoice#",
      ar?"\u0627\u0644\u062A\u0627\u0631\u064A\u062E":"Date", ar?"\u0627\u0644\u0628\u062F\u0627\u064A\u0629":"Start", ar?"\u0627\u0644\u0646\u0647\u0627\u064A\u0629":"End", ar?"\u0627\u0644\u0645\u062F\u0629":"Duration",
      ar?"\u0627\u0644\u063A\u0631\u0641\u0629/\u0627\u0644\u0639\u0646\u0635\u0631":"Item", ar?"\u0627\u0644\u0642\u0633\u0645":"Zone",
      ar?"\u0627\u0644\u0639\u0645\u064A\u0644":"Customer", ar?"\u0627\u0644\u062C\u0648\u0627\u0644":"Phone",
      ar?"\u0627\u0644\u0644\u0627\u0639\u0628\u0648\u0646":"Players",
      ar?"\u0625\u064A\u0631\u0627\u062F \u0627\u0644\u0648\u0642\u062A":"Time Rev", ar?"\u0627\u0644\u0637\u0644\u0628\u0627\u062A":"Orders",
      ar?"\u062E\u0635\u0645":"Disc", ar?"\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A":"Total",
      ar?"\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639":"Payment", ar?"\u0627\u0644\u0643\u0627\u0634\u064A\u0631":"Cashier", ar?"\u0627\u0644\u062D\u0627\u0644\u0629":"Status",
    ];
    s3 += `<tr>${dh.map(h=>td(h,{bold:true,bg:"#1e293b",color:"#e2e8f0",align:"center",size:10})).join("")}</tr>`;

    const detailRows = [...filtered].sort((a,b)=>b.endTime-a.endTime);
    let grandTotal = 0;
    detailRows.forEach((h, i) => {
      const dEnd   = new Date(h.endTime);
      const dStart = new Date(h.startTime);
      const bg     = i % 2 === 0 ? "#f8fafc" : "#fff";
      const payBg  = h.payMethod === "cash" ? "#dcfce7" : h.payMethod === "card" ? "#dbeafe" : "#fef9c3";
      const payFg  = h.payMethod === "cash" ? "#166534" : h.payMethod === "card" ? "#1e40af" : "#854d0e";
      const payLbl = h.payMethod === "cash" ? (ar?"\uD83D\uDCB5 \u0646\u0642\u062F":"\uD83D\uDCB5 Cash") : h.payMethod === "card" ? (ar?"\uD83D\uDCB3 \u0634\u0628\u0643\u0629":"\uD83D\uDCB3 Card") : (ar?"\uD83D\uDD04 \u062A\u062D\u0648\u064A\u0644":"\uD83D\uDD04 Transfer");
      const stBg   = !h.status||h.status==="paid" ? "#dcfce7" : "#fef9c3";
      const stFg   = !h.status||h.status==="paid" ? "#166534" : "#854d0e";
      const stLbl  = !h.status||h.status==="paid" ? (ar?"\u2705 \u0645\u062F\u0641\u0648\u0639":"\u2705 Paid") : (ar?"\u23F8 \u0645\u0648\u0642\u0648\u0641":"\u23F8 Held");
      grandTotal  += h.total;
      s3 += `<tr>`;
      s3 += td(i+1,{bg,align:"center",color:"#9ca3af",size:10});
      s3 += td(h.invoiceNo??"-",{bg,align:"center",bold:true,color:"#6366f1",size:10});
      s3 += td(dEnd.toLocaleDateString("ar-SA"),{bg,align:"center",size:10});
      s3 += td(dStart.toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit",hour12:true}),{bg,align:"center",size:10});
      s3 += td(dEnd.toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit",hour12:true}),{bg,align:"center",size:10});
      s3 += td(fmtD(h.duration),{bg,align:"center",size:10});
      s3 += td(h.itemName,{bg,size:10});
      s3 += td(h.zoneName,{bg,size:10,color:"#6366f1"});
      s3 += td(h.customerName||(ar?"\u0632\u0627\u0626\u0631":"Visitor"),{bg,size:10});
      s3 += td(h.phone??"-",{bg,size:10,color:"#6b7280"});
      s3 += td(h.playerCount||1,{bg,align:"center",size:10});
      s3 += td(`${fmt(h.timePrice)} \uFDFC`,{bg,align:"center",size:10});
      s3 += td(`${fmt(h.ordersTotal)} \uFDFC`,{bg,align:"center",size:10});
      s3 += td(h.discount?`${fmt(h.discount)} \uFDFC`:"-",{bg,align:"center",size:10,color:h.discount?"#dc2626":"#9ca3af"});
      s3 += td(`${fmt(h.total)} \uFDFC`,{bg,align:"center",bold:true,size:10,color:"#166534"});
      s3 += td(payLbl,{bg:payBg,color:payFg,align:"center",bold:true,size:10});
      s3 += td(h.cashier||"-",{bg,size:10});
      s3 += td(stLbl,{bg:stBg,color:stFg,align:"center",bold:true,size:10});
      s3 += `</tr>`;
    });

    // Grand total row
    const totTimeRev   = filtered.reduce((s,h)=>s+h.timePrice,0);
    const totOrdersRev = filtered.reduce((s,h)=>s+h.ordersTotal,0);
    const totDisc      = filtered.reduce((s,h)=>s+(h.discount||0),0);
    s3 += `<tr>${td(ar?"\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0643\u0644\u064A":"GRAND TOTAL",{bold:true,bg:"#0f172a",color:"#fff",colspan:11,align:"center"})}${td(`${fmt(totTimeRev)} \uFDFC`,{bold:true,bg:"#0f172a",color:"#22c55e",align:"center"})}${td(`${fmt(totOrdersRev)} \uFDFC`,{bold:true,bg:"#0f172a",color:"#22c55e",align:"center"})}${td(`${fmt(totDisc)} \uFDFC`,{bold:true,bg:"#0f172a",color:"#ef4444",align:"center"})}${td(`${fmt(grandTotal)} \uFDFC`,{bold:true,bg:"#166534",color:"#fff",align:"center",size:12})}${td("",{bg:"#0f172a",colspan:3})}</tr>`;

    s3 += gap(C3);
    s3 += `<tr>${td(ar?`\u0645\u0631\u0643\u0632 \u0627\u0644\u0635\u0645\u0644\u0629 \u2014 \u062A\u0635\u062F\u064A\u0631 ${exportDate}`:`ALSAMLAH \u2014 Export ${exportDate}`,{colspan:C3,color:"#94a3b8",size:10,bg:"#0f172a",align:"center"})}</tr>`;
    s3 += `</table></div>`;

    // ── Assemble & download ──
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>${ar?"\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645":"Dashboard"}</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>${ar?"\u0627\u0644\u0645\u0644\u062E\u0635":"Summary"}</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>${ar?"\u0627\u0644\u062A\u0641\u0635\u064A\u0644\u064A":"Detailed"}</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>body{font-family:Arial,sans-serif}table{border-collapse:collapse}</style>
</head><body>${s1}${s2}${s3}</body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `\u062A\u0642\u0631\u064A\u0631_${periodLabel}_${new Date().toISOString().slice(0,10)}.xls`;
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
