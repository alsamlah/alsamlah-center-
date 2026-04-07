"use client";

import { useState, useMemo } from "react";
import type { HistoryRecord } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { fmtTime, fmtDate, fmtMoney, fmtD, getBusinessDay } from "@/lib/utils";
import { printSession } from "@/lib/printReceipt";
import SarSymbol from "./SarSymbol";

interface Props {
  history: HistoryRecord[];
  settings: SystemSettings;
  logo?: string | null;
  isManager: boolean;
  onEdit: (updated: HistoryRecord) => void;
  onDelete: (id: string) => void;
  onCompleteHeld: (record: HistoryRecord) => void;
  onClearHistory?: () => void;
  onCorrection?: (recordId: string, correctedTotal: number, refundMethod: "cash" | "transfer", note?: string) => void;
}

type Period = "all" | "today" | "week" | "month" | "range";

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCsv(records: HistoryRecord[], lang: string) {
  const isAr = lang === "ar";
  const headers = isAr
    ? ["رقم الفاتورة", "الغرفة", "القسم", "العميل", "الكاشير", "البداية", "النهاية", "المدة (د)", "وقت", "طلبات", "خصم", "دين", "المجموع", "الدفع", "الحالة"]
    : ["Invoice", "Room", "Zone", "Customer", "Cashier", "Start", "End", "Duration(m)", "Time", "Orders", "Discount", "Debt", "Total", "Payment", "Status"];

  const rows = records.map((h) => [
    h.invoiceNo ?? "----",
    h.itemName,
    h.zoneName,
    h.customerName,
    h.cashier ?? "",
    new Date(h.startTime).toLocaleString(isAr ? "ar-SA" : "en-US"),
    new Date(h.endTime).toLocaleString(isAr ? "ar-SA" : "en-US"),
    Math.round(h.duration / 60000),
    h.timePrice,
    h.ordersTotal,
    h.discount ?? 0,
    h.debtAmount ?? 0,
    h.total,
    h.payMethod,
    h.status ?? "paid",
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `history-${Date.now()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ record, settings, logo, onSave, onClose }: {
  record: HistoryRecord;
  settings: SystemSettings;
  logo?: string | null;
  onSave: (updated: HistoryRecord) => void;
  onClose: () => void;
}) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const [custName, setCustName] = useState(record.customerName);
  const [payMethod, setPayMethod] = useState(record.payMethod);
  const [discount, setDiscount] = useState(String(record.discount ?? 0));
  const [total, setTotal] = useState(String(record.total));
  const [orders, setOrders] = useState(record.orders ?? []);

  const handleSave = () => {
    onSave({
      ...record,
      customerName: custName,
      payMethod,
      discount: Number(discount) || 0,
      total: Number(total) || record.total,
      orders,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-end md:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="card p-6 w-full max-w-md anim-fade-up" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-base font-bold mb-4" style={{ color: "var(--text)" }}>
          ✏️ {t.editInvoice} {record.invoiceNo ? `#${record.invoiceNo}` : ""}
        </div>

        {/* Customer name */}
        <div className="mb-3">
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text2)" }}>{t.custName}</label>
          <input value={custName} onChange={(e) => setCustName(e.target.value)} className="input" />
        </div>

        {/* Order lines */}
        <div className="mb-3">
          <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text2)" }}>{t.editOrderLines ?? t.orders}</label>
          {orders.length === 0 && (
            <div className="text-xs text-center py-2" style={{ color: "var(--text2)", opacity: 0.4 }}>—</div>
          )}
          {orders.map((o, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5 p-2 rounded-lg"
              style={{ background: "var(--input-bg)" }}>
              <span>{o.icon}</span>
              <span className="flex-1 text-xs" style={{ color: "var(--text)" }}>{o.name}</span>
              <span className="text-xs flex items-center gap-0.5" style={{ color: "var(--text2)" }}>{o.price} <SarSymbol size={10} /></span>
              <button onClick={() => setOrders((p) => p.filter((_, j) => j !== i))}
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ color: "var(--red)", background: "color-mix(in srgb, var(--red) 10%, transparent)" }}>
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Payment method */}
        <div className="mb-3">
          <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text2)" }}>{t.payMethods}</label>
          <div className="grid grid-cols-3 gap-2">
            {[{ m: "cash", l: "💵 " + t.cash }, { m: "card", l: "💳 " + t.card }, { m: "transfer", l: "📲 " + t.transfer }].map((pm) => (
              <button key={pm.m} onClick={() => setPayMethod(pm.m)}
                className="btn py-2 text-xs"
                style={payMethod === pm.m ? {
                  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                  color: "var(--accent)",
                  borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
                } : {}}>
                {pm.l}
              </button>
            ))}
          </div>
        </div>

        {/* Discount + Total override */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--text2)" }}>
              {t.discount} (<SarSymbol size={10} />)
            </label>
            <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="input" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--text2)" }}>
              {t.totalOverride ?? t.total} (<SarSymbol size={10} />)
            </label>
            <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} className="input" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} className="btn btn-primary flex-1 py-3 text-sm">{t.save}</button>
          <button onClick={onClose} className="btn btn-ghost flex-1 py-3 text-sm">{t.cancel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Complete-Held Modal ───────────────────────────────────────────────────────

function CompleteHeldModal({ record, settings, onComplete, onClose }: {
  record: HistoryRecord;
  settings: SystemSettings;
  onComplete: (payMethod: string) => void;
  onClose: () => void;
}) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  return (
    <div className="fixed inset-0 z-[600] flex items-end md:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
      <div className="card p-6 w-full max-w-sm anim-fade-up" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-base font-bold mb-1 text-center" style={{ color: "var(--text)" }}>
          💳 {t.completePayment}
        </div>
        <div className="text-xs text-center mb-5" style={{ color: "var(--text2)" }}>
          {record.itemName} — {record.customerName}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[{ m: "cash", l: "💵 " + t.cash }, { m: "card", l: "💳 " + t.card }, { m: "transfer", l: "📲 " + t.transfer }].map((pm) => (
            <button key={pm.m} onClick={() => onComplete(pm.m)}
              className="btn py-3 text-xs">
              {pm.l}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="btn btn-ghost w-full py-2 text-sm">{t.cancel}</button>
      </div>
    </div>
  );
}

// ── Correction Modal ──────────────────────────────────────────────────────────

function CorrectionModal({ record, settings, onConfirm, onClose }: {
  record: HistoryRecord;
  settings: SystemSettings;
  onConfirm: (correctedTotal: number, refundMethod: "cash" | "transfer", note?: string) => void;
  onClose: () => void;
}) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const [correctedInput, setCorrectedInput] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "transfer">("cash");
  const [note, setNote] = useState("");

  const corrected = parseFloat(correctedInput) || 0;
  const refundAmt = record.total - corrected;
  const valid = corrected >= 0 && corrected < record.total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="card p-5 w-full max-w-sm" style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <h3 className="font-bold text-base mb-4" style={{ color: "var(--yellow)" }}>
          💸 {t.correction} — #{record.invoiceNo}
        </h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between p-2 rounded" style={{ background: "color-mix(in srgb, var(--surface) 80%, transparent)" }}>
            <span style={{ color: "var(--text2)" }}>{t.originalTotal}</span>
            <span className="font-bold">{fmtMoney(record.total)}</span>
          </div>

          <div>
            <label className="block mb-1 text-xs" style={{ color: "var(--text2)" }}>{t.correctedAmount}</label>
            <input
              className="input w-full"
              type="number"
              min={0}
              max={record.total - 0.01}
              step={0.01}
              placeholder="0"
              value={correctedInput}
              onChange={(e) => setCorrectedInput(e.target.value)}
              dir="ltr"
            />
          </div>

          {correctedInput && corrected >= 0 && corrected < record.total && (
            <div className="p-2 rounded text-sm font-bold" style={{ background: "color-mix(in srgb, var(--red) 10%, transparent)", color: "var(--red)" }}>
              {t.refundAmt}: {fmtMoney(refundAmt)}
            </div>
          )}

          <div>
            <label className="block mb-1 text-xs" style={{ color: "var(--text2)" }}>{t.refundMethodLabel}</label>
            <div className="flex gap-2">
              {(["cash", "transfer"] as const).map((m) => (
                <button key={m} onClick={() => setRefundMethod(m)}
                  className="btn flex-1 py-2 text-sm"
                  style={refundMethod === m ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}}>
                  {m === "cash" ? "💵 " : "📲 "}{isRTL ? (m === "cash" ? "نقد" : "تحويل") : (m === "cash" ? "Cash" : "Transfer")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-1 text-xs" style={{ color: "var(--text2)" }}>{isRTL ? "ملاحظة (اختياري)" : "Note (optional)"}</label>
            <input className="input w-full" type="text" value={note} onChange={(e) => setNote(e.target.value)} dir={isRTL ? "rtl" : "ltr"} />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button className="btn btn-ghost flex-1 py-2 text-sm" onClick={onClose}>{t.cancel}</button>
          <button disabled={!valid} onClick={() => onConfirm(corrected, refundMethod, note || undefined)}
            className="btn flex-1 py-2 text-sm font-bold"
            style={valid ? { background: "var(--yellow)", color: "#1a1a00", borderColor: "var(--yellow)" } : { opacity: 0.4 }}>
            {t.confirmRefund}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HistoryView({ history, settings, logo, isManager, onEdit, onDelete, onCompleteHeld, onClearHistory, onCorrection }: Props) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const eodHour = settings.endOfDayHour ?? 5;

  // ── Filter state ──
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── Bulk select state ──
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Edit / complete-held / correction state ──
  const [editRecord, setEditRecord] = useState<HistoryRecord | null>(null);
  const [completeRecord, setCompleteRecord] = useState<HistoryRecord | null>(null);
  const [correctionRecord, setCorrectionRecord] = useState<HistoryRecord | null>(null);

  // ── Filtered records ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const today = getBusinessDay(Date.now(), eodHour);
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600 * 1000;

    return history.filter((h) => {
      // Period filter
      const bDay = getBusinessDay(h.endTime, eodHour);
      if (period === "today" && bDay !== today) return false;
      if (period === "week" && h.endTime < weekAgo) return false;
      if (period === "month") {
        const d = new Date(h.endTime);
        const n = new Date();
        if (d.getMonth() !== n.getMonth() || d.getFullYear() !== n.getFullYear()) return false;
      }
      if (period === "range") {
        if (dateFrom && bDay < dateFrom) return false;
        if (dateTo && bDay > dateTo) return false;
      }

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        if (
          !h.itemName?.toLowerCase().includes(q) &&
          !h.customerName?.toLowerCase().includes(q) &&
          !h.zoneName?.toLowerCase().includes(q) &&
          !h.cashier?.toLowerCase().includes(q) &&
          !(h.invoiceNo ?? "").toString().toLowerCase().includes(q)
        ) return false;
      }

      return true;
    });
  }, [history, period, dateFrom, dateTo, search, eodHour]);

  // ── Bulk helpers ──────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => setSelected(new Set(filtered.map((h) => h.id)));
  const clearSel = () => setSelected(new Set());

  const selectPeriodGroup = (p: Period) => {
    const eod = settings.endOfDayHour ?? 5;
    const today = getBusinessDay(Date.now(), eod);
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    const ids = history.filter((h) => {
      const bDay = getBusinessDay(h.endTime, eod);
      if (p === "today") return bDay === today;
      if (p === "week") return h.endTime >= weekAgo;
      if (p === "month") {
        const d = new Date(h.endTime); const n = new Date();
        return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
      }
      return false;
    }).map((h) => h.id);
    setSelected(new Set(ids));
  };

  const selectedRecords = filtered.filter((h) => selected.has(h.id));

  // ── Status badge ─────────────────────────────────────────────────────────
  const statusBadge = (h: HistoryRecord) => {
    if ((h.status ?? "paid") === "paid") return null;
    const isOccupied = h.status === "held-occupied";
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded ms-1"
        style={{
          background: "color-mix(in srgb, var(--yellow) 15%, transparent)",
          color: "var(--yellow)",
        }}>
        ⏸ {isOccupied ? (t.heldOccupied ?? "معلق-مشغول") : (t.heldFree ?? "معلق-شاغل")}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>📋 {t.history}</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setBulkMode((p) => !p); clearSel(); }}
            className="btn px-3 py-1.5 text-xs"
            style={bulkMode ? {
              background: "color-mix(in srgb, var(--accent) 15%, transparent)",
              color: "var(--accent)",
              borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
            } : { color: "var(--text2)" }}>
            ☑️ {t.bulkSelect}
          </button>
          {isManager && onClearHistory && (
            <button
              onClick={() => { if (confirm(t.confirmClearHistory)) onClearHistory(); }}
              className="btn px-3 py-1.5 text-xs btn-ghost"
              style={{ color: "var(--red)" }}>
              🗑 {t.clearHistory}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`🔍 ${t.search}`}
          className="input w-full"
        />
      </div>

      {/* Period chips */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {(["all", "today", "week", "month", "range"] as Period[]).map((p) => {
          const labels: Record<Period, string> = {
            all: t.all, today: t.today, week: t.week, month: t.month, range: t.dateRange,
          };
          return (
            <button key={p} onClick={() => setPeriod(p)}
              className="btn px-3 py-1.5 text-xs"
              style={period === p ? {
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                color: "var(--accent)",
                borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
              } : { color: "var(--text2)" }}>
              {labels[p]}
            </button>
          );
        })}
      </div>

      {/* Date range pickers */}
      {period === "range" && (
        <div className="flex gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text2)" }}>{t.dateFrom}</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="input text-xs py-1.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text2)" }}>{t.dateTo}</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="input text-xs py-1.5" />
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="card p-3 mb-4 anim-fade flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold" style={{ color: "var(--text2)" }}>
            {selected.size} {isRTL ? "محدد" : "selected"}
          </span>
          <button onClick={selectAll} className="btn px-2 py-1 text-xs" style={{ color: "var(--text2)" }}>{t.selectAll}</button>
          <button onClick={() => selectPeriodGroup("today")} className="btn px-2 py-1 text-xs" style={{ color: "var(--text2)" }}>{t.selectToday}</button>
          <button onClick={() => selectPeriodGroup("week")} className="btn px-2 py-1 text-xs" style={{ color: "var(--text2)" }}>{t.selectWeek}</button>
          <button onClick={() => selectPeriodGroup("month")} className="btn px-2 py-1 text-xs" style={{ color: "var(--text2)" }}>{t.selectMonth}</button>
          <button onClick={clearSel} className="btn px-2 py-1 text-xs" style={{ color: "var(--text2)" }}>{t.clearSelection}</button>
          <div className="ms-auto flex gap-2">
            <button onClick={() => exportCsv(selectedRecords.length > 0 ? selectedRecords : filtered, settings.lang)}
              className="btn px-3 py-1.5 text-xs"
              style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)" }}>
              📊 {t.exportCsv}
            </button>
            {isManager && selected.size > 0 && (
              <button onClick={() => {
                if (confirm(`${isRTL ? "حذف" : "Delete"} ${selected.size} ${isRTL ? "سجل؟" : "records?"}`)) {
                  selected.forEach((id) => onDelete(id));
                  clearSel();
                }
              }}
                className="btn px-3 py-1.5 text-xs"
                style={{ color: "var(--red)", borderColor: "color-mix(in srgb, var(--red) 20%, transparent)" }}>
                🗑 {t.bulkDelete ?? t.delete}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Export CSV button (when not in bulk mode) */}
      {!bulkMode && filtered.length > 0 && (
        <div className="flex justify-end mb-3">
          <button onClick={() => exportCsv(filtered, settings.lang)}
            className="btn px-3 py-1.5 text-xs"
            style={{ color: "var(--text2)", borderColor: "var(--border)" }}>
            📊 {t.exportCsv}
          </button>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: "var(--text2)", opacity: 0.3 }}>
          {t.noHistory}
        </div>
      )}

      {/* History cards */}
      <div className="grid gap-3">
        {filtered.slice(0, 200).map((h) => {
          const isHeld = (h.status ?? "paid") !== "paid";
          const isSelected = selected.has(h.id);
          return (
            <div key={h.id}
              className={`card p-4 anim-fade`}
              style={isSelected ? { borderColor: "var(--accent)", outline: "2px solid color-mix(in srgb, var(--accent) 40%, transparent)" } : isHeld ? { borderColor: "color-mix(in srgb, var(--yellow) 25%, transparent)" } : {}}>

              {/* Top row */}
              <div className="flex justify-between items-start gap-2">
                {/* Checkbox (bulk mode) */}
                {bulkMode && (
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(h.id)}
                    className="mt-0.5 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  {/* Invoice number + name */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {h.invoiceNo && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded"
                        style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
                        #{h.invoiceNo}
                      </span>
                    )}
                    <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{h.itemName}</span>
                    {h.sessionType === "match" && <span className="text-[10px]" style={{ color: "var(--green)" }}>⚽</span>}
                    {statusBadge(h)}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
                    {h.customerName}
                    {(h.playerCount || 0) > 0 && <span className="ms-1.5" style={{ color: "var(--blue)" }}>👤{h.playerCount}</span>}
                  </div>
                </div>

                {/* Total + print buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-bold text-sm flex items-center gap-0.5" style={{ color: isHeld ? "var(--yellow)" : "var(--green)" }}>
                    {fmtMoney(h.total)} <SarSymbol size={11} />
                  </span>
                  <button onClick={() => printSession({
                    invoiceNo: h.invoiceNo ?? 0, itemName: h.itemName, zoneName: h.zoneName,
                    customerName: h.customerName, sessionType: h.sessionType, startTime: h.startTime,
                    endTime: h.endTime, duration: h.duration, orders: h.orders, timePrice: h.timePrice,
                    ordersTotal: h.ordersTotal, discount: h.discount || 0, debtAmount: h.debtAmount || 0,
                    total: h.total, payMethod: h.payMethod, cashier: h.cashier || "",
                    playerCount: h.playerCount || 1, logo,
                    vatNumber: settings.vatEnabled ? (settings.vatNumber || "") : "",
                    sellerNameAr: settings.sellerNameAr || "",
                  }, "thermal")}
                    className="btn px-2 py-1 text-[10px]" style={{ color: "var(--text2)", borderColor: "var(--border)" }}>🖨️</button>
                  <button onClick={() => printSession({
                    invoiceNo: h.invoiceNo ?? 0, itemName: h.itemName, zoneName: h.zoneName,
                    customerName: h.customerName, sessionType: h.sessionType, startTime: h.startTime,
                    endTime: h.endTime, duration: h.duration, orders: h.orders, timePrice: h.timePrice,
                    ordersTotal: h.ordersTotal, discount: h.discount || 0, debtAmount: h.debtAmount || 0,
                    total: h.total, payMethod: h.payMethod, cashier: h.cashier || "",
                    playerCount: h.playerCount || 1, logo,
                    vatNumber: settings.vatEnabled ? (settings.vatNumber || "") : "",
                    sellerNameAr: settings.sellerNameAr || "",
                  }, "a4")}
                    className="btn px-2 py-1 text-[10px]"
                    style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)" }}>📄</button>
                </div>
              </div>

              {/* Detail row */}
              <div className="flex gap-3 mt-2 flex-wrap text-[11px]" style={{ color: "var(--text2)" }}>
                <span>📅 {fmtDate(h.endTime)}</span>
                <span>⏱ {fmtD(h.duration)}</span>
                <span>🕐 {fmtTime(h.startTime)}–{fmtTime(h.endTime)}</span>
                <span>{h.payMethod === "cash" ? "💵" : h.payMethod === "card" ? "💳" : h.payMethod === "held" ? "⏸" : "📲"}</span>
                {h.cashier && <span>👤 {h.cashier}</span>}
                {(h.discount || 0) > 0 && <span style={{ color: "var(--blue)" }}>{t.discount}: {h.discount}</span>}
                {(h.debtAmount || 0) > 0 && <span style={{ color: "var(--red)" }}>{t.debt}: {h.debtAmount}</span>}
              </div>

              {/* Action row for held or manager */}
              {(isHeld || isManager) && (
                <div className="flex gap-2 mt-3 pt-2 flex-wrap"
                  style={{ borderTop: "1px solid var(--border)" }}>
                  {isHeld && (
                    <button onClick={() => setCompleteRecord(h)}
                      className="btn px-3 py-1.5 text-xs"
                      style={{ color: "var(--green)", borderColor: "color-mix(in srgb, var(--green) 25%, transparent)", background: "color-mix(in srgb, var(--green) 8%, transparent)" }}>
                      💳 {t.completePayment}
                    </button>
                  )}
                  {isManager && (
                    <>
                      <button onClick={() => setEditRecord(h)}
                        className="btn px-3 py-1.5 text-xs"
                        style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)" }}>
                        ✏️ {t.editInvoice}
                      </button>
                      {onCorrection && !h.correction && (h.status ?? "paid") === "paid" && (
                        <button onClick={() => setCorrectionRecord(h)}
                          className="btn px-3 py-1.5 text-xs"
                          style={{ color: "var(--yellow)", borderColor: "color-mix(in srgb, var(--yellow) 25%, transparent)", background: "color-mix(in srgb, var(--yellow) 8%, transparent)" }}>
                          💸 {t.correction}
                        </button>
                      )}
                      {h.correction && (
                        <span className="badge text-xs px-2 py-1"
                          style={{ background: "color-mix(in srgb, var(--yellow) 15%, transparent)", color: "var(--yellow)" }}>
                          ✏️ {isRTL ? `مُصحَّح — استرداد ${fmtMoney(h.correction.refundAmount)}` : `Corrected — refund ${fmtMoney(h.correction.refundAmount)}`}
                        </span>
                      )}
                      <button onClick={() => {
                        if (confirm(isRTL ? "حذف هذا السجل؟" : "Delete this record?")) onDelete(h.id);
                      }}
                        className="btn px-3 py-1.5 text-xs"
                        style={{ color: "var(--red)", borderColor: "color-mix(in srgb, var(--red) 20%, transparent)" }}>
                        🗑 {t.deleteInvoice}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {editRecord && (
        <EditModal
          record={editRecord}
          settings={settings}
          logo={logo}
          onSave={onEdit}
          onClose={() => setEditRecord(null)}
        />
      )}

      {completeRecord && (
        <CompleteHeldModal
          record={completeRecord}
          settings={settings}
          onComplete={(payMethod) => {
            const updated: HistoryRecord = { ...completeRecord, payMethod, status: "paid" };
            onCompleteHeld(updated);
            setCompleteRecord(null);
          }}
          onClose={() => setCompleteRecord(null)}
        />
      )}

      {correctionRecord && onCorrection && (
        <CorrectionModal
          record={correctionRecord}
          settings={settings}
          onConfirm={(correctedTotal, refundMethod, note) => {
            onCorrection(correctionRecord.id, correctedTotal, refundMethod, note);
            setCorrectionRecord(null);
          }}
          onClose={() => setCorrectionRecord(null)}
        />
      )}
    </div>
  );
}
