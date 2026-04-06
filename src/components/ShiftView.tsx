"use client";

import { useState } from "react";
import type { Shift, ShiftRecord, HistoryRecord, UserLogin } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { fmtMoney, fmtD, fmtTime, fmtDate } from "@/lib/utils";
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
}

export default function ShiftView({ currentShift, shiftHistory, history, onOpen, onClose, user, settings, isManager, now }: Props) {
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
              <ShiftCard key={s.id} shift={s} t={t} isRTL={isRTL} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Collapsed shift history card ──
function ShiftCard({ shift, t, isRTL }: { shift: ShiftRecord; t: Record<string, string>; isRTL: boolean }) {
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
            { label: t.cashRev, value: shift.summary.cashRevenue, icon: "💵" },
            { label: t.cardRev, value: shift.summary.cardRevenue, icon: "💳" },
            { label: t.transferRev, value: shift.summary.transferRevenue, icon: "📲" },
            { label: t.discount, value: shift.summary.discountTotal, icon: "🏷️" },
            { label: t.debt, value: shift.summary.debtTotal, icon: "📝" },
            { label: t.netRevenue, value: shift.summary.netRevenue, icon: "✅", bold: true },
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
