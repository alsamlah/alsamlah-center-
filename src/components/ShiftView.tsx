"use client";

import { useState } from "react";
import type { Shift, ShiftRecord, HistoryRecord, UserLogin } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { fmtMoney, fmtD, fmtTime, fmtDate, getBusinessDay } from "@/lib/utils";
import { printShiftReport } from "@/lib/printReceipt";
import SarSymbol from "./SarSymbol";

interface Props {
  currentShift: Shift | null;
  shiftHistory: ShiftRecord[];
  history: HistoryRecord[];
  onOpen: (cashFloat: number) => void;
  onClose: () => void;
  user: UserLogin;
  settings: SystemSettings;
  isManager: boolean;
  now: number;
  lastClosedShift?: ShiftRecord | null;
  onDismissEod?: () => void;
  logo?: string | null;
}

export default function ShiftView({ currentShift, shiftHistory, history, onOpen, onClose, user, settings, isManager, now, lastClosedShift, onDismissEod, logo }: Props) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";

  const [cashFloatInput, setCashFloatInput] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  // Revenue for current open shift (from history records that ended after shift opened)
  const shiftRecords = currentShift
    ? history.filter((h) => h.endTime >= currentShift.openedAt)
    : [];
  const shiftRevenue = shiftRecords.reduce((s, h) => s + h.total, 0);

  const handleOpen = () => {
    const cashFloat = parseFloat(cashFloatInput) || 0;
    onOpen(cashFloat);
    setCashFloatInput("");
  };

  const handleClose = () => {
    onClose();
    setConfirmClose(false);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text)" }}>🕐 {t.shift}</h2>

      {/* ── Current Shift Status ── */}
      {currentShift ? (
        <div className="card p-5 mb-6 anim-fade"
          style={{ borderColor: "color-mix(in srgb, var(--green) 30%, transparent)", background: "color-mix(in srgb, var(--green) 5%, var(--surface))" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full anim-pulse" style={{ background: "var(--green)" }} />
              <span className="font-bold text-base" style={{ color: "var(--green)" }}>{t.shiftOpen}</span>
            </div>
            <span className="text-xs font-mono tabular-nums" style={{ color: "var(--text2)" }}>
              {fmtD(now - currentShift.openedAt)}
            </span>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-xs" style={{ color: "var(--text2)" }}>
              <div className="font-semibold mb-0.5">{t.openedBy}</div>
              <div style={{ color: "var(--text)" }}>{currentShift.openedBy}</div>
            </div>
            <div className="text-xs" style={{ color: "var(--text2)" }}>
              <div className="font-semibold mb-0.5">{isRTL ? "وقت الفتح" : "Opened at"}</div>
              <div style={{ color: "var(--text)" }}>{fmtTime(currentShift.openedAt)}</div>
            </div>
            {currentShift.cashFloat > 0 && (
              <div className="text-xs" style={{ color: "var(--text2)" }}>
                <div className="font-semibold mb-0.5">{t.cashFloat}</div>
                <div className="flex items-center gap-1" style={{ color: "var(--text)" }}>
                  {fmtMoney(currentShift.cashFloat)} <SarSymbol size={11} />
                </div>
              </div>
            )}
            <div className="text-xs" style={{ color: "var(--text2)" }}>
              <div className="font-semibold mb-0.5">{isRTL ? "إيراد المناوبة" : "Shift Revenue"}</div>
              <div className="flex items-center gap-1 font-bold" style={{ color: "var(--green)" }}>
                {fmtMoney(shiftRevenue)} <SarSymbol size={11} />
              </div>
            </div>
          </div>

          {/* Live session count */}
          {shiftRecords.length > 0 && (
            <div className="text-xs mb-4" style={{ color: "var(--text2)" }}>
              {isRTL ? `${shiftRecords.length} جلسة منتهية في هذه المناوبة` : `${shiftRecords.length} sessions completed this shift`}
            </div>
          )}

          {/* Close shift */}
          {!confirmClose ? (
            <button
              onClick={() => isManager ? setConfirmClose(true) : undefined}
              className="btn w-full py-3 font-bold text-sm"
              style={isManager ? {
                background: "color-mix(in srgb, var(--red) 10%, transparent)",
                color: "var(--red)",
                borderColor: "color-mix(in srgb, var(--red) 25%, transparent)",
              } : {
                opacity: 0.35,
                cursor: "not-allowed",
                color: "var(--text2)",
              }}>
              {isManager ? `🔒 ${t.closeShift}` : `🔒 ${t.managerOnlyClose}`}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleClose}
                className="btn btn-danger flex-1 py-3 font-bold text-sm">
                {t.confirmCloseShift}
              </button>
              <button onClick={() => setConfirmClose(false)}
                className="btn flex-1 py-3 text-sm" style={{ color: "var(--text2)" }}>
                {t.cancel}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── Open Shift Form ── */
        <div className="card p-5 mb-6 anim-fade">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--text2)" }}>{t.shiftNone}</span>
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text2)" }}>
              {t.cashFloat} ({isRTL ? "اختياري" : "optional"})
            </label>
            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                type="number"
                min="0"
                placeholder="0"
                value={cashFloatInput}
                onChange={(e) => setCashFloatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOpen()}
                dir="ltr"
              />
              <span style={{ color: "var(--text2)", flexShrink: 0 }}><SarSymbol size={16} /></span>
            </div>
          </div>

          <button onClick={handleOpen} className="btn btn-success w-full py-3 font-bold text-sm">
            ▶ {t.openShift}
          </button>
        </div>
      )}

      {/* ── Shift History ── */}
      <div>
        <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text2)" }}>📋 {t.shiftHistory}</h3>
        {shiftHistory.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: "var(--text2)", opacity: 0.3 }}>
            {t.noShiftHistory}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shiftHistory.slice(0, 20).map((s) => (
              <ShiftCard key={s.id} shift={s} t={t} isRTL={isRTL} logo={logo} eodHour={settings.endOfDayHour ?? 5} />
            ))}
          </div>
        )}
      </div>

      {/* ── End-of-Day Report Modal ── */}
      {lastClosedShift && (
        <EodReportModal shift={lastClosedShift} settings={settings} logo={logo} onDismiss={() => onDismissEod?.()} />
      )}
    </div>
  );
}

// ── End-of-Day Report Modal ────────────────────────────────────────────────────

function EodReportModal({ shift, settings, logo, onDismiss }: {
  shift: ShiftRecord;
  settings: SystemSettings;
  logo?: string | null;
  onDismiss: () => void;
}) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const s = shift.summary;
  const businessDate = getBusinessDay(shift.closedAt, settings.endOfDayHour ?? 5);

  const handlePrint = () => {
    printShiftReport({
      businessDate,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      openedBy: shift.openedBy,
      closedBy: shift.closedBy,
      cashFloat: shift.cashFloat,
      sessionCount: s.sessionCount,
      totalRevenue: s.totalRevenue,
      cashRevenue: s.cashRevenue,
      cardRevenue: s.cardRevenue,
      transferRevenue: s.transferRevenue,
      debtTotal: s.debtTotal,
      discountTotal: s.discountTotal,
      netRevenue: s.netRevenue,
      ordersRevenue: s.ordersRevenue ?? 0,
      timeRevenue: s.timeRevenue ?? 0,
      heldCount: s.heldCount ?? 0,
      heldTotal: s.heldTotal ?? 0,
      expectedCashInDrawer: s.expectedCashInDrawer ?? shift.cashFloat,
      byZone: s.byZone ?? {},
      itemSales: s.itemSales ?? [],
      logo,
    }, "a4");
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-end md:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      dir={isRTL ? "rtl" : "ltr"}>
      <div className="card w-full max-w-lg anim-fade-up overflow-y-auto"
        style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-black" style={{ color: "var(--accent)" }}>
                📊 {t.endOfDay ?? "تقرير نهاية اليوم"}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
                {businessDate} • {fmtTime(shift.openedAt)} — {fmtTime(shift.closedAt)}
              </div>
            </div>
            <button onClick={onDismiss}
              className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
              style={{ background: "var(--input-bg)", color: "var(--text2)" }}>✕</button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Cash reconciliation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3">
              <div className="text-[10px]" style={{ color: "var(--text2)" }}>{t.openingBalance ?? "رصيد الافتتاح"}</div>
              <div className="font-bold text-base flex items-center gap-1 mt-0.5">
                {fmtMoney(shift.cashFloat)} <SarSymbol size={12} />
              </div>
            </div>
            <div className="card p-3" style={{ borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)", background: "color-mix(in srgb, var(--accent) 5%, var(--surface))" }}>
              <div className="text-[10px]" style={{ color: "var(--text2)" }}>{t.expectedDrawer ?? "المتوقع في الصندوق"}</div>
              <div className="font-bold text-base flex items-center gap-1 mt-0.5" style={{ color: "var(--accent)" }}>
                {fmtMoney(s.expectedCashInDrawer ?? shift.cashFloat)} <SarSymbol size={12} />
              </div>
            </div>
          </div>

          {/* Revenue summary */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: isRTL ? "إجمالي الإيراد" : "Total Revenue", val: s.totalRevenue, color: "var(--text)" },
              { label: isRTL ? "صافي الإيراد" : "Net Revenue", val: s.netRevenue, color: "var(--green)" },
              { label: isRTL ? "إيراد الوقت" : "Time Revenue", val: s.timeRevenue ?? 0, color: "var(--text)" },
              { label: isRTL ? "إيراد الطلبات" : "Orders Revenue", val: s.ordersRevenue ?? 0, color: "var(--text)" },
              { label: isRTL ? "الخصومات" : "Discounts", val: s.discountTotal, color: "var(--red)" },
              { label: isRTL ? "الديون" : "Debts", val: s.debtTotal, color: "var(--red)" },
              ...((s.totalRefunds ?? 0) > 0 ? [
                { label: isRTL ? t.totalRefunds ?? "إجمالي المستردات" : "Total Refunds", val: s.totalRefunds!, color: "var(--yellow)" },
                { label: isRTL ? t.netAfterRefunds ?? "الصافي بعد الاسترداد" : "Net After Refunds", val: s.netAfterRefunds!, color: "var(--green)" },
              ] : []),
            ].map(({ label, val, color }) => (
              <div key={label} className="flex justify-between items-center px-3 py-2 rounded-lg text-xs"
                style={{ background: "var(--input-bg)" }}>
                <span style={{ color: "var(--text2)" }}>{label}</span>
                <span className="font-bold flex items-center gap-0.5" style={{ color }}>{fmtMoney(val)} <SarSymbol size={10} /></span>
              </div>
            ))}
          </div>

          {/* Payment methods */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: "💵 " + t.cashRev, val: s.cashRevenue },
              { label: "💳 " + t.cardRev, val: s.cardRevenue },
              { label: "📲 " + t.transferRev, val: s.transferRevenue },
            ].map(({ label, val }) => (
              <div key={label} className="card p-2.5 text-center">
                <div style={{ color: "var(--text2)" }}>{label}</div>
                <div className="font-bold text-sm flex items-center justify-center gap-0.5 mt-0.5">
                  {fmtMoney(val)} <SarSymbol size={10} />
                </div>
              </div>
            ))}
          </div>

          {/* Shift info */}
          <div className="text-xs flex gap-4 flex-wrap" style={{ color: "var(--text2)" }}>
            <span>👤 {s.sessionCount} {isRTL ? "جلسة" : "sessions"}</span>
            <span>⏸ {s.heldCount ?? 0} {isRTL ? "معلق" : "held"}</span>
            <span>⏱ {fmtD(shift.closedAt - shift.openedAt)}</span>
          </div>

          {/* Zone breakdown */}
          {s.byZone && Object.keys(s.byZone).length > 0 && (
            <div>
              <div className="text-xs font-bold mb-2" style={{ color: "var(--text2)" }}>{t.byZone}</div>
              <div className="flex flex-col gap-1">
                {Object.entries(s.byZone).map(([zone, { count, rev }]) => (
                  <div key={zone} className="flex justify-between items-center px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "var(--input-bg)" }}>
                    <span style={{ color: "var(--text)" }}>{zone} <span style={{ color: "var(--text2)" }}>({count})</span></span>
                    <span className="font-bold flex items-center gap-0.5">{fmtMoney(rev)} <SarSymbol size={10} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top items */}
          {s.itemSales && s.itemSales.length > 0 && (
            <div>
              <div className="text-xs font-bold mb-2" style={{ color: "var(--text2)" }}>
                {t.itemSales ?? "مبيعات الأصناف"} ({isRTL ? "أعلى ٥" : "Top 5"})
              </div>
              <div className="flex flex-col gap-1">
                {s.itemSales.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex justify-between items-center px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "var(--input-bg)" }}>
                    <span>{item.icon} {item.name}</span>
                    <span className="flex items-center gap-2">
                      <span style={{ color: "var(--text2)" }}>×{item.qty}</span>
                      <span className="font-bold flex items-center gap-0.5">{fmtMoney(item.rev)} <SarSymbol size={10} /></span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="p-5 pt-0 flex flex-col gap-2">
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="btn flex-1 py-3 font-bold text-sm"
              style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)" }}>
              🖨️ {t.printReport ?? "طباعة التقرير"}
            </button>
            <button onClick={onDismiss}
              className="btn flex-1 py-3 text-sm btn-ghost">
              {t.done}
            </button>
          </div>
          {/* WhatsApp summary share */}
          <button
            onClick={() => {
              const sarUnit = "ر.س";
              const lines = [
                `📊 تقرير نهاية اليوم — ${businessDate}`,
                `🕐 ${fmtTime(shift.openedAt)} — ${fmtTime(shift.closedAt)}`,
                "",
                `✅ عدد الجلسات: ${s.sessionCount}`,
                `💰 إجمالي الإيراد: ${fmtMoney(s.totalRevenue)} ${sarUnit}`,
                `💵 نقدي: ${fmtMoney(s.cashRevenue)} ${sarUnit}`,
                `💳 شبكة: ${fmtMoney(s.cardRevenue)} ${sarUnit}`,
                `📲 تحويل: ${fmtMoney(s.transferRevenue)} ${sarUnit}`,
                s.discountTotal > 0 ? `🏷 خصومات: ${fmtMoney(s.discountTotal)} ${sarUnit}` : "",
                s.debtTotal > 0 ? `📋 ديون جديدة: ${fmtMoney(s.debtTotal)} ${sarUnit}` : "",
                (s.totalRefunds ?? 0) > 0 ? `💸 مستردات: ${fmtMoney(s.totalRefunds!)} ${sarUnit}` : "",
                `✨ صافي الإيراد: ${fmtMoney(s.netAfterRefunds ?? s.netRevenue)} ${sarUnit}`,
                `💵 المتوقع في الصندوق: ${fmtMoney(s.expectedCashInDrawer ?? shift.cashFloat)} ${sarUnit}`,
                "",
                "مركز الصملة للترفيه",
              ].filter(Boolean).join("\n");
              window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, "_blank");
            }}
            className="btn w-full py-3 text-sm"
            style={{ background: "color-mix(in srgb, var(--green) 10%, transparent)", color: "var(--green)", borderColor: "color-mix(in srgb, var(--green) 25%, transparent)" }}>
            📱 {isRTL ? "مشاركة عبر واتساب" : "Share via WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Collapsed shift history card ──
function ShiftCard({ shift, t, isRTL, logo, eodHour }: { shift: ShiftRecord; t: Record<string, string>; isRTL: boolean; logo?: string | null; eodHour: number }) {
  const [open, setOpen] = useState(false);
  const dur = shift.closedAt - shift.openedAt;

  return (
    <div className="card p-4 anim-fade">
      <button className="w-full text-start" onClick={() => setOpen((p) => !p)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text2)" }}>{fmtDate(shift.openedAt)}</span>
            <span className="text-xs font-mono" style={{ color: "var(--text2)" }}>
              {fmtTime(shift.openedAt)} — {fmtTime(shift.closedAt)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm flex items-center gap-1" style={{ color: "var(--green)" }}>
              {fmtMoney(shift.summary.totalRevenue)} <SarSymbol size={11} />
            </span>
            <span className="text-xs" style={{ color: "var(--text2)" }}>{open ? "▲" : "▼"}</span>
          </div>
        </div>
        <div className="flex gap-3 mt-1.5 text-[11px]" style={{ color: "var(--text2)" }}>
          <span>⏱ {fmtD(dur)}</span>
          <span>{t.openedBy}: {shift.openedBy}</span>
          <span>{shift.summary.sessionCount} {isRTL ? "جلسة" : "sessions"}</span>
        </div>
      </button>

      {open && (
        <div className="mt-4 pt-4 grid grid-cols-2 gap-2 text-xs anim-fade" style={{ borderTop: "1px solid var(--border)" }}>
          {[
            { label: t.cashRev, value: shift.summary.cashRevenue, icon: "💵", bold: false },
            { label: t.cardRev, value: shift.summary.cardRevenue, icon: "💳", bold: false },
            { label: t.transferRev, value: shift.summary.transferRevenue, icon: "📲", bold: false },
            { label: t.discount, value: shift.summary.discountTotal, icon: "🏷️", bold: false },
            { label: t.debt, value: shift.summary.debtTotal, icon: "📝", bold: false },
            ...((shift.summary.totalRefunds ?? 0) > 0 ? [
              { label: t.totalRefunds ?? (isRTL ? "مستردات" : "Refunds"), value: shift.summary.totalRefunds!, icon: "💸", bold: false },
            ] : []),
            { label: t.netRevenue, value: shift.summary.netAfterRefunds ?? shift.summary.netRevenue, icon: "✅", bold: true },
          ].map(({ label, value, icon, bold }) => (
            <div key={label} className="flex items-center justify-between px-2 py-1.5 rounded-lg"
              style={{ background: "color-mix(in srgb, var(--accent) 4%, transparent)" }}>
              <span style={{ color: "var(--text2)" }}>{icon} {label}</span>
              <span className={bold ? "font-bold" : ""} style={{ color: bold ? "var(--green)" : "var(--text)" }}>
                <span className="flex items-center gap-0.5">{fmtMoney(value)} <SarSymbol size={10} /></span>
              </span>
            </div>
          ))}
          {shift.cashFloat > 0 && (
            <div className="col-span-2 flex items-center justify-between px-2 py-1.5 rounded-lg text-xs"
              style={{ background: "color-mix(in srgb, var(--blue) 5%, transparent)" }}>
              <span style={{ color: "var(--text2)" }}>🏦 {t.cashFloat}</span>
              <span style={{ color: "var(--blue)" }} className="flex items-center gap-0.5">
                {fmtMoney(shift.cashFloat)} <SarSymbol size={10} />
              </span>
            </div>
          )}
          <div className="col-span-2 text-[10px] text-end" style={{ color: "var(--text2)" }}>
            {t.closedBy}: {shift.closedBy}
          </div>
        </div>
      )}
    </div>
  );
}
