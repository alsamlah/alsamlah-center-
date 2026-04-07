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

  /* ── Excel Export (exceljs — proper .xlsx, 4 sheets, Saudi Green palette) ── */
  const handleExcelExport = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ExcelJS = (await import("exceljs")).default as any;
    const wb = new ExcelJS.Workbook();

    // ── Color palette (Saudi Green + Gold, inspired by ScanTracker) ──
    const C = {
      headerDark:  "FF0F2A1D",
      header1:     "FF1B4332",
      header2:     "FF2D6A4F",
      gold:        "FFD4A276",
      goldLight:   "FFFDF6ED",
      greenLight:  "FFDCFCE7",
      blueLight:   "FFDBEAFE",
      redLight:    "FFFEE2E2",
      amberLight:  "FFFEF9C3",
      tealLight:   "FFCCFBF1",
      purpleLight: "FFF3E8FF",
      row1:        "FFF9F8F6",
      row2:        "FFFFFFFF",
      text:        "FF111827",
      textMuted:   "FF6B7280",
      border:      "FFE8E4DF",
      success:     "FF059669",
      successText: "FF166534",
      danger:      "FFDC2626",
      warning:     "FFD97706",
      white:       "FFFFFFFF",
      goldText:    "FF92400E",
    };

    type CellStyleOpts = { bold?: boolean; size?: number; color?: string; bg?: string; align?: "left"|"center"|"right"; italic?: boolean; wrap?: boolean };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyStyle = (cell: any, opts: CellStyleOpts) => {
      cell.font = { bold: opts.bold ?? false, size: opts.size ?? 10, color: { argb: opts.color ?? C.text }, name: "Arial", italic: opts.italic };
      if (opts.bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.bg } };
      cell.alignment = { horizontal: opts.align ?? "right", vertical: "middle", readingOrder: "rightToLeft", wrapText: opts.wrap };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brd = (cell: any, color = C.border) => {
      const b = { style: "thin", color: { argb: color } };
      cell.border = { top: b, bottom: b, left: b, right: b };
    };

    const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    const mkBar = (val: number, max: number, len = 14) => {
      if (max === 0) return "";
      const filled = Math.round((val / max) * len);
      return "█".repeat(filled) + "░".repeat(len - filled);
    };

    const ar = isRTL;
    const nowDate = new Date();
    const exportDate = nowDate.toLocaleDateString("ar-SA");
    const exportTime = nowDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gc = (ws: any, r: number, c: number) => ws.getRow(r).getCell(c);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (cell: any, opts: { bold?: boolean; sz?: number; fg?: string; bg?: string; al?: "left"|"center"|"right" }) => {
      cell.font = { bold: opts.bold, size: opts.sz ?? 10, color: { argb: opts.fg ?? C.text }, name: "Arial" };
      if (opts.bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.bg } };
      cell.alignment = { horizontal: opts.al ?? "right", vertical: "middle", readingOrder: "rightToLeft" };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bd = (cell: any, color = C.border) => { const s = { style: "thin", color: { argb: color } }; cell.border = { top: s, bottom: s, left: s, right: s }; };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const secHdr = (ws: any, r: number, nc: number, title: string, bg: string) => {
      ws.mergeCells(r,1,r,nc); gc(ws,r,1).value=title; st(gc(ws,r,1),{bold:true,sz:12,fg:C.white,bg,al:"center"}); ws.getRow(r).height=22;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colHdr = (ws: any, r: number, headers: string[], bg: string, fg = C.white) => {
      headers.forEach((h,i)=>{ gc(ws,r,i+1).value=h; st(gc(ws,r,i+1),{bold:true,sz:10,fg,bg,al:"center"}); bd(gc(ws,r,i+1),bg); }); ws.getRow(r).height=18;
    };

    // ═══════ SHEET 1: Dashboard ═══════
    const ws1 = wb.addWorksheet(ar?"لوحة التحكم":"Dashboard");
    ws1.views=[{rightToLeft:ar}];
    ws1.columns=[{width:22},{width:16},{width:16},{width:16},{width:16},{width:16},{width:16},{width:22}];
    ws1.mergeCells(1,1,1,8); gc(ws1,1,1).value=ar?"📊 مركز الصملة — لوحة التحكم":"📊 ALSAMLAH — Dashboard";
    st(gc(ws1,1,1),{bold:true,sz:16,fg:C.white,bg:C.headerDark,al:"center"}); ws1.getRow(1).height=30;
    ws1.mergeCells(2,1,2,8); gc(ws1,2,1).value=`${ar?"الفترة":"Period"}: ${periodLabel}   |   ${ar?"التاريخ":"Date"}: ${exportDate}   |   ${ar?"وقت التصدير":"Exported"}: ${exportTime}`;
    st(gc(ws1,2,1),{sz:10,fg:"FF94A3B8",bg:"FF1E293B",al:"center"}); ws1.getRow(2).height=18;
    let r1=4;
    ws1.mergeCells(r1,1,r1,8); gc(ws1,r1,1).value=ar?"📈 المؤشرات الرئيسية":"📈 Key Performance Indicators";
    st(gc(ws1,r1,1),{bold:true,sz:13,fg:C.white,bg:C.header1,al:"center"}); ws1.getRow(r1).height=24; r1++;
    const kpiDefs=[
      {label:ar?"💰 الإيراد الكلي":"💰 Total Revenue",   bg:C.header2,  fg:C.greenLight,  val:`${fmt(totalRev)} ﷼`},
      {label:ar?"🎮 الجلسات":"🎮 Sessions",              bg:"FF1E40AF", fg:C.blueLight,   val:fmt(totalSessions)},
      {label:ar?"👥 الزوار":"👥 Visitors",               bg:"FF581C87", fg:C.purpleLight, val:fmt(totalPeople)},
      {label:ar?"🍽️ متوسط الفاتورة":"🍽️ Avg Bill",     bg:"FF854D0E", fg:C.amberLight,  val:`${avgBill.toFixed(1)} ﷼`},
      {label:ar?"⏱ إجمالي الوقت":"⏱ Total Time",       bg:"FF0F766E", fg:C.tealLight,   val:fmtD(totalTime)},
      {label:ar?"📦 الطلبات":"📦 Orders",                bg:"FF075985", fg:"FFE0F2FE",    val:fmt(totalOrders)},
      {label:ar?"💸 الخصومات":"💸 Discounts",            bg:"FF7F1D1D", fg:C.redLight,    val:`${fmt(totalDiscount)} ﷼`},
      {label:ar?"📋 الديون":"📋 Debts",                  bg:"FF713F12", fg:C.amberLight,  val:`${fmt(totalDebtAmt)} ﷼`},
    ];
    kpiDefs.forEach((k,i)=>{ const c=gc(ws1,r1,i+1); c.value=k.label; st(c,{bold:true,sz:9,fg:k.fg,bg:k.bg,al:"center"}); bd(c,k.bg); }); ws1.getRow(r1).height=20; r1++;
    kpiDefs.forEach((k,i)=>{ const c=gc(ws1,r1,i+1); c.value=k.val; st(c,{bold:true,sz:18,fg:k.bg,bg:k.fg,al:"center"}); bd(c,C.border); }); ws1.getRow(r1).height=36; r1+=2;
    secHdr(ws1,r1,8,ar?"💵 تفاصيل الإيراد":"💵 Revenue Breakdown","FF0F766E"); r1++;
    colHdr(ws1,r1,[ar?"البند":"Item",ar?"المبلغ (﷼)":"Amount",ar?"النسبة":"Ratio",ar?"رسم بياني":"Visual","","","",""],"FFF1F5F9",C.text); r1++;
    const revMax=Math.max(timeRev,ordersRev,1);
    [{label:ar?"⏱ إيراد الوقت":"⏱ Time Rev",val:timeRev,bg:C.greenLight,fg:C.successText},{label:ar?"📦 إيراد الطلبات":"📦 Orders Rev",val:ordersRev,bg:C.blueLight,fg:"FF1E40AF"},{label:ar?"💸 الخصومات":"💸 Discounts",val:totalDiscount,bg:C.redLight,fg:C.danger},{label:ar?"📋 الديون":"📋 Debts",val:totalDebtAmt,bg:C.amberLight,fg:C.warning}].forEach(rv=>{
      const pct=totalRev>0?Math.round((rv.val/totalRev)*100):0;
      gc(ws1,r1,1).value=rv.label; st(gc(ws1,r1,1),{bold:true,sz:10,fg:rv.fg,bg:rv.bg,al:"right"}); bd(gc(ws1,r1,1));
      gc(ws1,r1,2).value=`${fmt(rv.val)} ﷼`; st(gc(ws1,r1,2),{bold:true,sz:10,fg:rv.fg,bg:C.row1,al:"center"}); bd(gc(ws1,r1,2));
      gc(ws1,r1,3).value=`${pct}%`; st(gc(ws1,r1,3),{sz:10,fg:rv.fg,bg:C.row1,al:"center"}); bd(gc(ws1,r1,3));
      ws1.mergeCells(r1,4,r1,8); gc(ws1,r1,4).value=mkBar(rv.val,revMax,28); st(gc(ws1,r1,4),{sz:9,fg:rv.fg,bg:C.row1}); bd(gc(ws1,r1,4));
      ws1.getRow(r1).height=18; r1++;
    });
    ws1.mergeCells(r1,1,r1,2); gc(ws1,r1,1).value=ar?"✅ الصافي":"✅ Net"; st(gc(ws1,r1,1),{bold:true,sz:11,fg:C.white,bg:C.header2,al:"center"});
    gc(ws1,r1,3).value=`${fmt(totalRev-totalDiscount-totalDebtAmt)} ﷼`; st(gc(ws1,r1,3),{bold:true,sz:11,fg:C.white,bg:C.header2,al:"center"});
    ws1.mergeCells(r1,4,r1,8); st(gc(ws1,r1,4),{bg:C.header2}); ws1.getRow(r1).height=20; r1+=2;
    secHdr(ws1,r1,8,ar?"💳 طرق الدفع":"💳 Payment Methods","FF1E40AF"); r1++;
    colHdr(ws1,r1,[ar?"طريقة الدفع":"Method",ar?"المبلغ":"Amount",ar?"الجلسات":"Sessions",ar?"النسبة":"Ratio",ar?"رسم بياني":"Visual","","",""],"FFF1F5F9",C.text); r1++;
    const cashCntE=filtered.filter(h=>h.payMethod==="cash").length;
    const cardCntE=filtered.filter(h=>h.payMethod==="card").length;
    const xfrCntE =filtered.filter(h=>h.payMethod==="transfer").length;
    const payMaxE =Math.max(byCash,byCard,byTransfer,1);
    [{label:ar?"💵 نقد":"💵 Cash",val:byCash,cnt:cashCntE,bg:C.greenLight,fg:C.successText},{label:ar?"💳 شبكة":"💳 Card",val:byCard,cnt:cardCntE,bg:C.blueLight,fg:"FF1E40AF"},{label:ar?"🔄 تحويل":"🔄 Transfer",val:byTransfer,cnt:xfrCntE,bg:C.amberLight,fg:C.goldText}].forEach(pm=>{
      const pct=totalRev>0?Math.round((pm.val/totalRev)*100):0;
      gc(ws1,r1,1).value=pm.label; st(gc(ws1,r1,1),{bold:true,sz:10,fg:pm.fg,bg:pm.bg,al:"right"}); bd(gc(ws1,r1,1));
      gc(ws1,r1,2).value=`${fmt(pm.val)} ﷼`; st(gc(ws1,r1,2),{sz:10,fg:pm.fg,bg:C.row1,al:"center"}); bd(gc(ws1,r1,2));
      gc(ws1,r1,3).value=fmt(pm.cnt); st(gc(ws1,r1,3),{sz:10,fg:C.text,bg:C.row1,al:"center"}); bd(gc(ws1,r1,3));
      gc(ws1,r1,4).value=`${pct}%`; st(gc(ws1,r1,4),{bold:true,sz:10,fg:pm.fg,bg:C.row1,al:"center"}); bd(gc(ws1,r1,4));
      ws1.mergeCells(r1,5,r1,8); gc(ws1,r1,5).value=mkBar(pm.val,payMaxE,24); st(gc(ws1,r1,5),{sz:9,fg:pm.fg,bg:C.row1}); bd(gc(ws1,r1,5));
      ws1.getRow(r1).height=18; r1++;
    });
    r1++;
    secHdr(ws1,r1,8,ar?"🏆 أداء الأقسام":"🏆 Zone Performance","FF581C87"); r1++;
    colHdr(ws1,r1,[ar?"#":"#",ar?"القسم":"Zone",ar?"الجلسات":"Sessions",ar?"الإيراد (﷼)":"Revenue",ar?"المتوسط":"Avg",ar?"النسبة":"Share",ar?"رسم بياني":"Visual",""],"FFF1F5F9",C.text); r1++;
    const zMax=zoneSorted.length>0?zoneSorted[0][1].rev:1;
    const zBgs=[C.amberLight,C.greenLight,C.blueLight,C.purpleLight,"FFFCE7F3",C.tealLight,"FFFFEDD5","FFE0F2FE"];
    const zFgs=[C.goldText,C.successText,"FF1E40AF","FF581C87","FF9D174D","FF0F766E","FF9A3412","FF075985"];
    zoneSorted.forEach(([z,d],i)=>{
      const pct=totalRev>0?(d.rev/totalRev*100).toFixed(1):"0.0";
      const avg=d.count>0?(d.rev/d.count).toFixed(1):"0";
      const bg=i%2===0?C.row1:C.row2;
      gc(ws1,r1,1).value=i+1; st(gc(ws1,r1,1),{bold:true,sz:10,fg:zFgs[i%8],bg:zBgs[i%8],al:"center"}); bd(gc(ws1,r1,1));
      gc(ws1,r1,2).value=z; st(gc(ws1,r1,2),{bold:i===0,sz:10,fg:C.text,bg,al:"right"}); bd(gc(ws1,r1,2));
      gc(ws1,r1,3).value=fmt(d.count); st(gc(ws1,r1,3),{sz:10,fg:C.text,bg,al:"center"}); bd(gc(ws1,r1,3));
      gc(ws1,r1,4).value=`${fmt(d.rev)} ﷼`; st(gc(ws1,r1,4),{bold:true,sz:10,fg:C.text,bg,al:"center"}); bd(gc(ws1,r1,4));
      gc(ws1,r1,5).value=`${avg} ﷼`; st(gc(ws1,r1,5),{sz:10,fg:C.text,bg,al:"center"}); bd(gc(ws1,r1,5));
      gc(ws1,r1,6).value=`${pct}%`; st(gc(ws1,r1,6),{bold:true,sz:10,fg:"FF581C87",bg,al:"center"}); bd(gc(ws1,r1,6));
      gc(ws1,r1,7).value=mkBar(d.rev,zMax,16); st(gc(ws1,r1,7),{sz:9,fg:zFgs[i%8],bg}); bd(gc(ws1,r1,7));
      gc(ws1,r1,8).value=""; st(gc(ws1,r1,8),{bg}); bd(gc(ws1,r1,8));
      ws1.getRow(r1).height=18; r1++;
    });
    ws1.mergeCells(r1,1,r1,2); gc(ws1,r1,1).value=ar?"الإجمالي":"TOTAL"; st(gc(ws1,r1,1),{bold:true,sz:10,fg:C.white,bg:C.headerDark,al:"center"});
    gc(ws1,r1,3).value=fmt(totalSessions); st(gc(ws1,r1,3),{bold:true,sz:10,fg:C.white,bg:C.headerDark,al:"center"});
    gc(ws1,r1,4).value=`${fmt(totalRev)} ﷼`; st(gc(ws1,r1,4),{bold:true,sz:10,fg:"FF22C55E",bg:C.headerDark,al:"center"});
    gc(ws1,r1,5).value=`${avgBill.toFixed(1)} ﷼`; st(gc(ws1,r1,5),{bold:true,sz:10,fg:C.white,bg:C.headerDark,al:"center"});
    gc(ws1,r1,6).value="100%"; st(gc(ws1,r1,6),{bold:true,sz:10,fg:C.white,bg:C.headerDark,al:"center"});
    ws1.mergeCells(r1,7,r1,8); st(gc(ws1,r1,7),{bg:C.headerDark}); ws1.getRow(r1).height=20; r1+=2;
    ws1.mergeCells(r1,1,r1,8); gc(ws1,r1,1).value=ar?`تم التصدير بتاريخ ${exportDate} — مركز الصملة للترفيه`:`Exported ${exportDate} — ALSAMLAH Entertainment Center`;
    st(gc(ws1,r1,1),{sz:9,fg:"FF94A3B8",bg:C.headerDark,al:"center"}); ws1.getRow(r1).height=16;

    // ═══════ SHEET 2: Summary ═══════
    const ws2=wb.addWorksheet(ar?"ملخص":"Summary");
    ws2.views=[{rightToLeft:ar}];
    ws2.columns=[{width:6},{width:28},{width:14},{width:16},{width:16},{width:14}];
    ws2.mergeCells(1,1,1,6); gc(ws2,1,1).value=ar?`📋 ملخص التقرير — ${periodLabel}`:`📋 Summary — ${periodLabel}`;
    st(gc(ws2,1,1),{bold:true,sz:15,fg:C.white,bg:C.headerDark,al:"center"}); ws2.getRow(1).height=28;
    let r2=3;
    const s2H=(title:string,bg:string)=>{secHdr(ws2,r2,6,title,bg);r2++;};
    s2H(ar?"🏆 الإيراد حسب القسم":"🏆 Revenue by Zone","FF1E40AF");
    colHdr(ws2,r2,[ar?"#":"#",ar?"القسم":"Zone",ar?"الجلسات":"Sessions",ar?"الإيراد (﷼)":"Revenue",ar?"متوسط الفاتورة":"Avg Bill",ar?"% من الإجمالي":"% Share"],"FF1E40AF"); r2++;
    zoneSorted.forEach(([z,d],i)=>{
      const pct=totalRev>0?(d.rev/totalRev*100).toFixed(1):"0.0"; const avg=d.count>0?(d.rev/d.count).toFixed(1):"0";
      const bg=i===0?C.greenLight:i%2===0?C.row1:C.row2;
      [i+1,z,d.count,`${fmt(d.rev)} ﷼`,`${avg} ﷼`,`${pct}%`].forEach((v,ci)=>{ gc(ws2,r2,ci+1).value=v; st(gc(ws2,r2,ci+1),{bold:ci===1&&i===0,sz:10,fg:ci===3&&i===0?C.successText:C.text,bg,al:ci>1?"center":"right"}); bd(gc(ws2,r2,ci+1)); });
      ws2.getRow(r2).height=18; r2++;
    });
    ws2.mergeCells(r2,1,r2,2);
    [ar?"الإجمالي":"TOTAL","",fmt(totalSessions),`${fmt(totalRev)} ﷼`,`${avgBill.toFixed(1)} ﷼`,"100%"].forEach((v,ci)=>{ if(ci===1)return; gc(ws2,r2,ci+1).value=v; st(gc(ws2,r2,ci+1),{bold:true,sz:10,fg:ci===3?"FF22C55E":C.white,bg:C.headerDark,al:"center"}); });
    ws2.getRow(r2).height=20; r2+=2;
    if (isManager && Object.keys(byCashier).length>0) {
      s2H(ar?"👤 الأداء حسب الكاشير":"👤 Performance by Cashier","FF0F766E");
      colHdr(ws2,r2,[ar?"الكاشير":"Cashier",ar?"الجلسات":"Sessions",ar?"الإيراد":"Revenue",ar?"المتوسط":"Avg Bill",ar?"% المساهمة":"Contribution",""],"FF0F766E"); r2++;
      Object.entries(byCashier).sort((a,b)=>b[1].rev-a[1].rev).forEach(([c,d],i)=>{
        const pct=totalRev>0?(d.rev/totalRev*100).toFixed(1):"0.0"; const avg=d.count>0?(d.rev/d.count).toFixed(1):"0";
        const bg=i%2===0?"FFF0FDF4":C.row2;
        [c,d.count,`${fmt(d.rev)} ﷼`,`${avg} ﷼`,`${pct}%`,""].forEach((v,ci)=>{ gc(ws2,r2,ci+1).value=v; st(gc(ws2,r2,ci+1),{bold:ci===2&&i===0,sz:10,fg:ci===2?"FF0F766E":C.text,bg,al:ci>0?"center":"right"}); bd(gc(ws2,r2,ci+1)); });
        ws2.getRow(r2).height=18; r2++;
      }); r2++;
    }
    if (topCust.length>0) {
      s2H(ar?"⭐ أكثر العملاء إنفاقاً":"⭐ Top Customers","FF854D0E");
      colHdr(ws2,r2,[ar?"#":"#",ar?"العميل":"Customer",ar?"الزيارات":"Visits",ar?"إجمالي الإنفاق":"Total Spend",ar?"متوسط الزيارة":"Avg/Visit",""],"FFF3E8F9",C.goldText); r2++;
      const medals=["🥇","🥈","🥉"];
      topCust.forEach(([name,d],i)=>{
        const avg=d.count>0?(d.rev/d.count).toFixed(1):"0";
        const bg=i===0?C.amberLight:i===1?"FFF3F4F6":i===2?"FFFFF7ED":i%2===0?"FFFEFCE8":C.row2;
        [medals[i]??(i+1),name,d.count,`${fmt(d.rev)} ﷼`,`${avg} ﷼`,""].forEach((v,ci)=>{ gc(ws2,r2,ci+1).value=v; st(gc(ws2,r2,ci+1),{bold:i<3,sz:10,fg:ci===3&&i===0?C.goldText:C.text,bg,al:ci>1?"center":"right"}); bd(gc(ws2,r2,ci+1)); });
        ws2.getRow(r2).height=18; r2++;
      }); r2++;
    }
    s2H(ar?"🔴 ملخص الديون":"🔴 Debts Summary","FF7F1D1D");
    const totAllDebts2=debts.reduce((s,d)=>s+d.amount,0); const totPaid2=debts.reduce((s,d)=>s+d.paidAmount,0);
    [ar?"إجمالي المدينين":"Total Debtors",fmt(unpaidDebts.length),ar?"إجمالي الديون":"Total Debt",`${fmt(totAllDebts2)} ﷼`,ar?"المدفوع":"Paid",`${fmt(totPaid2)} ﷼`].forEach((v,ci)=>{ gc(ws2,r2,ci+1).value=v; st(gc(ws2,r2,ci+1),{bold:ci%2===0,sz:10,fg:ci%2===0?"FF7F1D1D":C.text,bg:ci%2===0?C.redLight:C.row1,al:ci%2===0?"right":"center"}); bd(gc(ws2,r2,ci+1)); });
    ws2.getRow(r2).height=18; r2++;
    ws2.mergeCells(r2,1,r2,4); gc(ws2,r2,1).value=ar?"المتبقي غير المدفوع":"Remaining Unpaid"; st(gc(ws2,r2,1),{bold:true,sz:10,fg:C.white,bg:"FF7F1D1D",al:"center"});
    ws2.mergeCells(r2,5,r2,6); gc(ws2,r2,5).value=`${fmt(totalUnpaidDebt)} ﷼`; st(gc(ws2,r2,5),{bold:true,sz:10,fg:C.white,bg:"FF7F1D1D",al:"center"}); ws2.getRow(r2).height=20; r2+=2;
    ws2.mergeCells(r2,1,r2,6); gc(ws2,r2,1).value=ar?`مركز الصملة — ${exportDate}`:`ALSAMLAH — ${exportDate}`; st(gc(ws2,r2,1),{sz:9,fg:"FF94A3B8",bg:C.headerDark,al:"center"}); ws2.getRow(r2).height=16;

    // ═══════ SHEET 3: Invoice Details ═══════
    const ws3=wb.addWorksheet(ar?"تفاصيل الفواتير":"Invoice Details");
    ws3.views=[{rightToLeft:ar}];
    ws3.columns=[{width:5},{width:12},{width:12},{width:10},{width:10},{width:10},{width:18},{width:14},{width:16},{width:13},{width:8},{width:12},{width:12},{width:10},{width:12},{width:14},{width:12},{width:10}];
    ws3.mergeCells(1,1,1,18); gc(ws3,1,1).value=ar?`📝 تفاصيل الفواتير — ${periodLabel} (${totalSessions} فاتورة)`:`📝 Invoice Details — ${periodLabel} (${totalSessions} invoices)`;
    st(gc(ws3,1,1),{bold:true,sz:14,fg:C.white,bg:C.headerDark,al:"center"}); ws3.getRow(1).height=26;
    [ar?"#":"#",ar?"رقم الفاتورة":"Invoice#",ar?"التاريخ":"Date",ar?"البداية":"Start",ar?"النهاية":"End",ar?"المدة":"Duration",ar?"الغرفة":"Item",ar?"القسم":"Zone",ar?"العميل":"Customer",ar?"الجوال":"Phone",ar?"اللاعبون":"Players",ar?"إيراد الوقت":"Time Rev",ar?"الطلبات":"Orders",ar?"خصم":"Disc",ar?"الإجمالي":"Total",ar?"طريقة الدفع":"Payment",ar?"الكاشير":"Cashier",ar?"الحالة":"Status"].forEach((h,i)=>{ gc(ws3,2,i+1).value=h; st(gc(ws3,2,i+1),{bold:true,sz:9,fg:"FFE2E8F0",bg:"FF1E293B",al:"center"}); bd(gc(ws3,2,i+1),"FF1E293B"); });
    ws3.getRow(2).height=18;
    let r3=3; const detailRows=[...filtered].sort((a,b)=>b.endTime-a.endTime); let grandTotal=0;
    detailRows.forEach((h,i)=>{
      const dEnd=new Date(h.endTime); const dStart=new Date(h.startTime);
      const bg=i%2===0?C.row1:C.row2;
      const payBg=h.payMethod==="cash"?C.greenLight:h.payMethod==="card"?C.blueLight:C.amberLight;
      const payFg=h.payMethod==="cash"?C.successText:h.payMethod==="card"?"FF1E40AF":C.goldText;
      const payLbl=h.payMethod==="cash"?(ar?"💵 نقد":"💵 Cash"):h.payMethod==="card"?(ar?"💳 شبكة":"💳 Card"):(ar?"🔄 تحويل":"🔄 Transfer");
      const stBg=!h.status||h.status==="paid"?C.greenLight:C.amberLight;
      const stFg=!h.status||h.status==="paid"?C.successText:C.goldText;
      const stLbl=!h.status||h.status==="paid"?(ar?"✅ مدفوع":"✅ Paid"):(ar?"⏸ معلق":"⏸ Held");
      grandTotal+=h.total;
      const corrTag=h.correction?" ✏️":"";
      const vals=[i+1,(h.invoiceNo??"-")+corrTag,dEnd.toLocaleDateString("ar-SA"),dStart.toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit",hour12:true}),dEnd.toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit",hour12:true}),fmtD(h.duration),h.itemName,h.zoneName,h.customerName||(ar?"زائر":"Visitor"),h.phone??"-",h.playerCount||1,`${fmt(h.timePrice)} ﷼`,`${fmt(h.ordersTotal)} ﷼`,h.discount?`${fmt(h.discount)} ﷼`:"-",`${fmt(h.total)} ﷼`+(h.correction?` → ${fmt(h.correction.correctedTotal)} ﷼`:""),payLbl,h.cashier||"-",stLbl];
      const fgs=[C.textMuted,"FF6366F1",C.text,C.text,C.text,C.text,C.text,"FF6366F1",C.text,C.textMuted,C.text,C.text,C.text,h.discount?C.danger:C.textMuted,C.successText,payFg,C.text,stFg];
      const bgs=[bg,bg,bg,bg,bg,bg,bg,bg,bg,bg,bg,bg,bg,bg,h.correction?C.amberLight:bg,payBg,bg,stBg];
      vals.forEach((v,ci)=>{ gc(ws3,r3,ci+1).value=v; st(gc(ws3,r3,ci+1),{bold:ci===14,sz:9,fg:fgs[ci],bg:bgs[ci],al:"center"}); bd(gc(ws3,r3,ci+1)); });
      ws3.getRow(r3).height=17; r3++;
    });
    const totTR=filtered.reduce((s,h)=>s+h.timePrice,0); const totOR=filtered.reduce((s,h)=>s+h.ordersTotal,0); const totDR=filtered.reduce((s,h)=>s+(h.discount||0),0);
    ws3.mergeCells(r3,1,r3,11); gc(ws3,r3,1).value=ar?"الإجمالي الكلي":"GRAND TOTAL"; st(gc(ws3,r3,1),{bold:true,sz:10,fg:C.white,bg:C.headerDark,al:"center"});
    gc(ws3,r3,12).value=`${fmt(totTR)} ﷼`; st(gc(ws3,r3,12),{bold:true,sz:10,fg:"FF22C55E",bg:C.headerDark,al:"center"});
    gc(ws3,r3,13).value=`${fmt(totOR)} ﷼`; st(gc(ws3,r3,13),{bold:true,sz:10,fg:"FF22C55E",bg:C.headerDark,al:"center"});
    gc(ws3,r3,14).value=`${fmt(totDR)} ﷼`; st(gc(ws3,r3,14),{bold:true,sz:10,fg:"FFEF4444",bg:C.headerDark,al:"center"});
    gc(ws3,r3,15).value=`${fmt(grandTotal)} ﷼`; st(gc(ws3,r3,15),{bold:true,sz:12,fg:"FF22C55E",bg:C.header2,al:"center"});
    ws3.mergeCells(r3,16,r3,18); st(gc(ws3,r3,16),{bg:C.headerDark}); ws3.getRow(r3).height=20; r3+=2;
    ws3.mergeCells(r3,1,r3,18); gc(ws3,r3,1).value=ar?`مركز الصملة — تصدير ${exportDate}`:`ALSAMLAH — Export ${exportDate}`; st(gc(ws3,r3,1),{sz:9,fg:"FF94A3B8",bg:C.headerDark,al:"center"}); ws3.getRow(r3).height=16;

    // ═══════ SHEET 4: Analytics ═══════
    const ws4=wb.addWorksheet(ar?"تحليل الأصناف والأوقات":"Analytics");
    ws4.views=[{rightToLeft:ar}];
    ws4.columns=[{width:6},{width:28},{width:12},{width:14},{width:14},{width:24},{width:10}];
    ws4.mergeCells(1,1,1,7); gc(ws4,1,1).value=ar?`🔬 تحليل الأصناف والأوقات — ${periodLabel}`:`🔬 Analytics — ${periodLabel}`;
    st(gc(ws4,1,1),{bold:true,sz:15,fg:C.white,bg:C.headerDark,al:"center"}); ws4.getRow(1).height=28;
    let r4=3;
    const s4H=(title:string,bg:string)=>{secHdr(ws4,r4,7,title,bg);r4++;};
    if (itemSales.length>0) {
      s4H(ar?"🍽️ مبيعات الأصناف (الكوفي شوب)":"🍽️ Menu Item Sales","FF075985");
      colHdr(ws4,r4,[ar?"#":"#",ar?"الصنف":"Item",ar?"الكمية":"Qty",ar?"الإيراد (﷼)":"Revenue",ar?"متوسط السعر":"Avg Price",ar?"رسم بياني":"Visual Bar",""],"FF075985"); r4++;
      const iMax=itemSales[0].qty;
      itemSales.slice(0,20).forEach((it,i)=>{
        const avg=it.qty>0?(it.rev/it.qty).toFixed(1):"0"; const bg=i%2===0?"FFE0F2FE":C.row2;
        [i+1,`${it.icon} ${it.name}`,it.qty,`${fmt(it.rev)} ﷼`,`${avg} ﷼`,mkBar(it.qty,iMax,28),""].forEach((v,ci)=>{ gc(ws4,r4,ci+1).value=v; st(gc(ws4,r4,ci+1),{bold:ci===2,sz:10,fg:ci===5?"FF075985":C.text,bg,al:ci>1?"center":"right"}); bd(gc(ws4,r4,ci+1)); });
        ws4.getRow(r4).height=17; r4++;
      });
      const totQ=itemSales.reduce((s,it)=>s+it.qty,0); const totR4=itemSales.reduce((s,it)=>s+it.rev,0);
      ws4.mergeCells(r4,1,r4,2); gc(ws4,r4,1).value=ar?"الإجمالي":"TOTAL"; st(gc(ws4,r4,1),{bold:true,sz:10,fg:C.white,bg:"FF075985",al:"center"});
      gc(ws4,r4,3).value=fmt(totQ); st(gc(ws4,r4,3),{bold:true,sz:10,fg:C.white,bg:"FF075985",al:"center"});
      gc(ws4,r4,4).value=`${fmt(totR4)} ﷼`; st(gc(ws4,r4,4),{bold:true,sz:10,fg:"FF22C55E",bg:"FF075985",al:"center"});
      ws4.mergeCells(r4,5,r4,7); st(gc(ws4,r4,5),{bg:"FF075985"}); ws4.getRow(r4).height=20; r4+=2;
    }
    const roomMap:Record<string,{sessions:number;rev:number;dur:number}>={};
    filtered.forEach(h=>{ if(!roomMap[h.itemName])roomMap[h.itemName]={sessions:0,rev:0,dur:0}; roomMap[h.itemName].sessions++; roomMap[h.itemName].rev+=h.total; roomMap[h.itemName].dur+=h.duration; });
    const roomSorted=Object.entries(roomMap).sort((a,b)=>b[1].sessions-a[1].sessions);
    if (roomSorted.length>0) {
      s4H(ar?"🎮 أداء الغرف والعناصر":"🎮 Room / Item Performance",C.header2);
      colHdr(ws4,r4,[ar?"#":"#",ar?"الغرفة / العنصر":"Room / Item",ar?"الجلسات":"Sessions",ar?"الإيراد (﷼)":"Revenue",ar?"متوسط المدة":"Avg Duration",ar?"رسم بياني":"Visual",""],C.header2); r4++;
      const rMax=roomSorted[0][1].sessions;
      roomSorted.slice(0,20).forEach(([name,d],i)=>{
        const avgDur=d.sessions>0?fmtD(Math.round(d.dur/d.sessions)):"0"; const bg=i%2===0?C.greenLight:C.row2;
        [i+1,name,d.sessions,`${fmt(d.rev)} ﷼`,avgDur,mkBar(d.sessions,rMax,28),""].forEach((v,ci)=>{ gc(ws4,r4,ci+1).value=v; st(gc(ws4,r4,ci+1),{bold:ci===2,sz:10,fg:ci===5?C.successText:C.text,bg,al:ci>1?"center":"right"}); bd(gc(ws4,r4,ci+1)); });
        ws4.getRow(r4).height=17; r4++;
      }); r4++;
    }
    const hourMap:Record<number,number>={};
    for(let h=0;h<24;h++) hourMap[h]=0;
    filtered.forEach(rec=>{ const hr=new Date(rec.startTime).getHours(); hourMap[hr]=(hourMap[hr]||0)+1; });
    const maxHour=Math.max(...Object.values(hourMap),1);
    const top3Hrs=Object.entries(hourMap).sort((a,b)=>b[1]-a[1]).slice(0,3).filter(([,c])=>c>0);
    s4H(ar?"🕐 توزيع الجلسات حسب الساعة":"🕐 Hourly Session Distribution","FF4F46E5");
    if (top3Hrs.length>0) {
      ws4.mergeCells(r4,1,r4,7); gc(ws4,r4,1).value=(ar?"⭐ أوقات الذروة: ":"⭐ Peak Hours: ")+top3Hrs.map(([h,c])=>`${h}:00 (${c})`).join("   |   ");
      st(gc(ws4,r4,1),{bold:true,sz:10,fg:C.goldText,bg:C.amberLight,al:"center"}); bd(gc(ws4,r4,1)); ws4.getRow(r4).height=18; r4++;
    }
    colHdr(ws4,r4,[ar?"الساعة":"Hour",ar?"الجلسات":"Sessions",ar?"% من اليوم":"% of Day",ar?"مستوى النشاط":"Activity","","",""],"FF4F46E5"); r4++;
    for(let h=0;h<24;h++) {
      const cnt=hourMap[h]||0; const pct=totalSessions>0?((cnt/totalSessions)*100).toFixed(1):"0.0";
      const isTop=top3Hrs.some(([th])=>Number(th)===h); const bg=isTop?C.amberLight:cnt>0?"FFE0E7FF":C.row1;
      const hLbl=`${String(h).padStart(2,"0")}:00 – ${String(h+1).padStart(2,"0")}:00`;
      gc(ws4,r4,1).value=hLbl; st(gc(ws4,r4,1),{bold:isTop,sz:9,fg:isTop?C.goldText:C.text,bg,al:"center"}); bd(gc(ws4,r4,1));
      gc(ws4,r4,2).value=cnt; st(gc(ws4,r4,2),{bold:isTop,sz:10,fg:isTop?C.goldText:cnt>0?"FF4F46E5":C.textMuted,bg,al:"center"}); bd(gc(ws4,r4,2));
      gc(ws4,r4,3).value=`${pct}%`; st(gc(ws4,r4,3),{sz:9,fg:C.textMuted,bg,al:"center"}); bd(gc(ws4,r4,3));
      ws4.mergeCells(r4,4,r4,7); gc(ws4,r4,4).value=cnt>0?mkBar(cnt,maxHour,36):""; st(gc(ws4,r4,4),{sz:9,fg:isTop?"FFD97706":"FF4F46E5",bg}); bd(gc(ws4,r4,4));
      ws4.getRow(r4).height=16; r4++;
    }
    r4++;
    const playerDist:Record<number,number>={};
    filtered.forEach(h=>{ const p=h.playerCount||1; playerDist[p]=(playerDist[p]||0)+1; });
    if (Object.keys(playerDist).length>0) {
      s4H(ar?"👥 توزيع عدد اللاعبين":"👥 Player Count Distribution","FF7C3AED");
      colHdr(ws4,r4,[ar?"عدد اللاعبين":"Players",ar?"الجلسات":"Sessions",ar?"النسبة":"Ratio",ar?"رسم بياني":"Visual","","",""],"FF7C3AED"); r4++;
      const pMax=Math.max(...Object.values(playerDist),1);
      Object.entries(playerDist).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([p,cnt],i)=>{
        const pct=totalSessions>0?((cnt/totalSessions)*100).toFixed(1):"0.0"; const bg=i%2===0?"FFF3E8FF":C.row2;
        gc(ws4,r4,1).value=`${p} ${ar?"لاعب":"player(s)"}`; st(gc(ws4,r4,1),{bold:true,sz:10,fg:"FF7C3AED",bg,al:"center"}); bd(gc(ws4,r4,1));
        gc(ws4,r4,2).value=cnt; st(gc(ws4,r4,2),{bold:true,sz:10,fg:C.text,bg,al:"center"}); bd(gc(ws4,r4,2));
        gc(ws4,r4,3).value=`${pct}%`; st(gc(ws4,r4,3),{sz:10,fg:C.textMuted,bg,al:"center"}); bd(gc(ws4,r4,3));
        ws4.mergeCells(r4,4,r4,7); gc(ws4,r4,4).value=mkBar(cnt,pMax,36); st(gc(ws4,r4,4),{sz:9,fg:"FF7C3AED",bg}); bd(gc(ws4,r4,4));
        ws4.getRow(r4).height=17; r4++;
      }); r4++;
    }
    ws4.mergeCells(r4,1,r4,7); gc(ws4,r4,1).value=ar?`مركز الصملة — تصدير ${exportDate}`:`ALSAMLAH — Export ${exportDate}`; st(gc(ws4,r4,1),{sz:9,fg:"FF94A3B8",bg:C.headerDark,al:"center"}); ws4.getRow(r4).height=16;

    // ── Download ──
    const buffer=await wb.xlsx.writeBuffer();
    const blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=`تقرير_${periodLabel}_${new Date().toISOString().slice(0,10)}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Tab labels  /* ── Tab labels ── */
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
