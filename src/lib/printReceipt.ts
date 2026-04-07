/**
 * printReceipt.ts — Thermal (80mm) and A4 PDF print utilities
 * Opens a new browser window with the receipt HTML and triggers window.print()
 */

import { generateZatcaQR, vatFromInclusive, baseFromInclusive, fmtVatAmount } from "./zatca";

export type PrintType = "thermal" | "a4";

// Official SAMA SAR symbol as inline SVG string (for use inside HTML templates)
const SAR = `<svg width="13" height="14.5" viewBox="0 0 1124.14 1256.39" fill="currentColor" style="display:inline-block;vertical-align:-0.15em;margin-right:1px"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/></svg>`;

// ── Data types ──

export interface SessionPrintData {
  invoiceNo: string | number; // string "0001" (new) or legacy number
  itemName: string;
  zoneName: string;
  customerName: string;
  sessionType?: "ps" | "match" | "walkin";
  startTime: number;
  endTime: number;
  duration: number;
  orders: Array<{ name: string; icon: string; price: number }>;
  timePrice: number;
  ordersTotal: number;
  discount: number;
  debtAmount: number;
  total: number;
  payMethod: string;
  cashier: string;
  playerCount: number;
  logo?: string | null;           // base64 data URL or null
  vatNumber?: string;             // ZATCA VAT registration number (optional)
  sellerNameAr?: string;          // Arabic seller name for ZATCA QR
  recordId?: string;              // HistoryRecord.id for receipt URL
}

export interface DebtPrintData {
  name: string;
  phone?: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  note?: string;
  date: number;
  logo?: string | null;
  invoiceNo?: string | number;
}

export interface ShiftReportPrintData {
  businessDate: string;          // "YYYY-MM-DD"
  openedAt: number;
  closedAt: number;
  openedBy: string;
  closedBy: string;
  cashFloat: number;
  sessionCount: number;
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  transferRevenue: number;
  debtTotal: number;
  discountTotal: number;
  netRevenue: number;
  ordersRevenue: number;
  timeRevenue: number;
  heldCount: number;
  heldTotal: number;
  expectedCashInDrawer: number;
  byZone: Record<string, { count: number; rev: number }>;
  itemSales: { name: string; icon: string; qty: number; rev: number }[];
  logo?: string | null;
}

export interface StatsReportPrintData {
  dateLabel: string;             // e.g. "اليوم" or "١ أبريل – ٥ أبريل"
  sessionCount: number;
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  transferRevenue: number;
  debtTotal: number;
  discountTotal: number;
  netRevenue: number;
  ordersRevenue: number;
  timeRevenue: number;
  byZone: Record<string, { count: number; rev: number }>;
  itemSales: { name: string; icon: string; qty: number; rev: number }[];
  logo?: string | null;
}

// ── Formatting helpers ──

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });

const fmtDur = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} ساعة ${m > 0 ? `${m} د` : ""}`;
  return `${m} دقيقة`;
};

const payLabel = (m: string) =>
  ({ cash: "💵 كاش", card: "💳 شبكة", transfer: "📲 تحويل" }[m] ?? m);

const invNo = (n: string | number | undefined) =>
  n != null ? `#${String(n).padStart(4, "0")}` : "----";

// ── Open print window ──
// Uses Blob URL so the popup loads as a real page (better for fonts/images),
// then auto-prints on the window's "load" event (no fixed-delay guessing).

function openAndPrint(html: string, type: PrintType) {
  const dims = type === "thermal" ? "width=380,height=800" : "width=960,height=1200";
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank", dims);
  if (!win) {
    URL.revokeObjectURL(url);
    alert("السماح بفتح النوافذ مطلوب للطباعة\nPlease allow popups for printing.");
    return;
  }
  win.focus();
  // Wait for full page load (fonts + images) before printing
  win.addEventListener("load", () => {
    setTimeout(() => {
      try { win.print(); } catch (_) {}
      // Revoke after a delay so the page stays available if user hits print again
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }, 250);
  });
}

// ══════════════════════════════════════════
// THERMAL — 80mm receipt
// ══════════════════════════════════════════

function thermalSessionHTML(d: SessionPrintData, zatcaQrImg: string | null = null): string {
  const logoHtml = d.logo
    ? `<img src="${d.logo}" style="height:55px;object-fit:contain;display:block;margin:0 auto 6px">`
    : "";

  const line = `<div style="border-top:1px dashed #888;margin:7px 0"></div>`;
  const row = (label: string, val: string) =>
    `<div style="display:flex;justify-content:space-between;margin:3px 0;font-size:12.5px">
       <span style="color:#555">${label}</span>
       <span style="font-weight:600;color:#000">${val}</span>
     </div>`;

  const ordersHtml = d.orders.length
    ? d.orders.map(o => row(`${o.icon} ${o.name}`, `${o.price} ${SAR}`)).join("")
    : `<div style="text-align:center;font-size:11px;color:#888;padding:4px 0">—</div>`;

  // VAT breakdown (only when vatNumber is present)
  const hasVat = !!(zatcaQrImg && d.vatNumber);
  const vatAmt  = hasVat ? vatFromInclusive(d.total) : 0;
  const baseAmt = hasVat ? baseFromInclusive(d.total) : 0;

  const vatSection = hasVat ? `
${line}
${row("المبلغ قبل الضريبة", `${fmtVatAmount(baseAmt)} ${SAR}`)}
${row("ضريبة القيمة المضافة ١٥٪", `${fmtVatAmount(vatAmt)} ${SAR}`)}
${d.vatNumber ? row("الرقم الضريبي", d.vatNumber) : ""}` : "";

  const qrSection = zatcaQrImg ? `
${line}
<div style="text-align:center;margin:6px 0 2px">
  <div style="font-size:9px;color:#888;margin-bottom:4px">فاتورة ضريبية مبسّطة — هيئة الزكاة والضريبة</div>
  <img src="${zatcaQrImg}" style="width:100px;height:100px;display:block;margin:0 auto">
</div>` : "";

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<style>
  @page { margin:3mm 4mm; size:80mm auto; }
  * { box-sizing:border-box; }
  body { font-family:'Courier New',monospace; margin:0; padding:6px 8px; width:72mm; color:#111; font-size:12.5px; }
  @media print { html,body { width:72mm; } }
</style></head><body>
${logoHtml}
<div style="text-align:center;margin-bottom:4px">
  <div style="font-weight:900;font-size:15px;letter-spacing:2px">${d.sellerNameAr || "ALSAMLAH"}</div>
  ${d.sellerNameAr ? `<div style="font-size:10px;letter-spacing:1px;color:#444">ALSAMLAH</div>` : `<div style="font-size:11px;color:#555">مركز الصملة للترفيه</div>`}
</div>
${line}
${row("فاتورة", invNo(d.invoiceNo))}
${row("التاريخ", fmtDate(d.endTime))}
${row("الوقت", fmtTime(d.endTime))}
${line}
${row("العميل", d.customerName)}
${row("المكان", `${d.itemName}`)}
${row("النوع", d.sessionType === "match" ? "⚽ مبارة" : "🎮 PlayStation")}
${d.playerCount > 1 ? row("الأشخاص", `${d.playerCount}`) : ""}
${line}
<div style="font-size:11.5px;font-weight:700;margin-bottom:4px">الطلبات:</div>
${ordersHtml}
${line}
${row("بداية", fmtTime(d.startTime))}
${row("نهاية", fmtTime(d.endTime))}
${row("المدة", fmtDur(d.duration))}
${line}
${row(d.sessionType === "match" ? "⚽ جلسة مبارة" : "⏱ الوقت", `${d.timePrice} ${SAR}`)}
${d.ordersTotal > 0 ? row("☕ الطلبات", `${d.ordersTotal} ${SAR}`) : ""}
${d.discount > 0 ? row("🎁 خصم", `- ${d.discount} ${SAR}`) : ""}
${d.debtAmount > 0 ? row("📋 دين", `${d.debtAmount} ${SAR}`) : ""}
${vatSection}
${line}
<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;margin:4px 0">
  <span>المجموع${hasVat ? " (شامل الضريبة)" : ""}</span><span>${d.total} ${SAR}</span>
</div>
${row("الدفع", payLabel(d.payMethod))}
${d.cashier ? row("الكاشير", d.cashier) : ""}
${qrSection}
${line}
<div style="text-align:center;font-size:11px;color:#555;margin-top:8px;line-height:1.8">
  شكراً لزيارتكم 🙏<br>${d.sellerNameAr || "مركز الصملة للترفيه"}
</div>
<div style="height:16px"></div>
</body></html>`;
}

// ══════════════════════════════════════════
// A4 — Full professional invoice
// ══════════════════════════════════════════

function a4SessionHTML(d: SessionPrintData, zatcaQrImg: string | null = null): string {
  const sellerDisplay = d.sellerNameAr || "مركز الصملة للترفيه";
  const logoSection = d.logo
    ? `<img src="${d.logo}" style="height:70px;object-fit:contain;max-width:260px">`
    : `<div style="font-size:28px;font-weight:900;letter-spacing:2px;color:#6c8cff">AL<span style="color:#1a1a2e">SAMLAH</span></div>
       <div style="font-size:12px;color:#888;margin-top:2px">${sellerDisplay}</div>`;

  const hasVat = !!(zatcaQrImg && d.vatNumber);
  const vatAmt  = hasVat ? vatFromInclusive(d.total) : 0;
  const baseAmt = hasVat ? baseFromInclusive(d.total) : 0;

  const orderRows = d.orders.length
    ? d.orders.map((o, i) =>
        `<tr style="background:${i % 2 === 0 ? "#f7f8ff" : "#fff"}">
           <td style="padding:9px 14px;border-bottom:1px solid #eef0f8">${o.icon} ${o.name}</td>
           <td style="padding:9px 14px;text-align:left;border-bottom:1px solid #eef0f8;font-weight:600">
             ${o.price} ${SAR}
           </td>
         </tr>`).join("")
    : `<tr><td colspan="2" style="padding:14px;text-align:center;color:#bbb">لا توجد طلبات</td></tr>`;

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<style>
  @page { size:A4; margin:18mm 20mm; }
  * { box-sizing:border-box; }
  body { font-family:'Segoe UI',Tahoma,Arial,sans-serif; color:#1a1a2e; margin:0; font-size:13px; line-height:1.5; }
  table { border-collapse:collapse; width:100%; }
  th { background:#6c8cff; color:#fff; padding:10px 14px; text-align:right; font-size:12px; font-weight:600; }
  th:last-child { text-align:left; }
  .section { margin-bottom:22px; }
  .section-title { font-size:12px; font-weight:700; color:#6c8cff; border-bottom:2px solid #6c8cff; padding-bottom:5px; margin-bottom:14px; letter-spacing:0.5px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .field label { display:block; font-size:10.5px; color:#999; margin-bottom:2px; }
  .field span { font-size:13px; font-weight:600; color:#1a1a2e; }
  .total-row td { font-size:17px; font-weight:800; color:#6c8cff; padding:13px 14px; border-top:2px solid #6c8cff; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #6c8cff">
  <div>${logoSection}</div>
  <div style="text-align:left">
    <div style="font-size:26px;font-weight:900;color:#6c8cff;letter-spacing:1px">فاتورة</div>
    <div style="font-size:14px;color:#999;margin-top:2px">${invNo(d.invoiceNo)}</div>
    <div style="font-size:12px;color:#aaa;margin-top:6px">${fmtDate(d.endTime)}</div>
    <div style="font-size:12px;color:#aaa">${fmtTime(d.endTime)}</div>
  </div>
</div>

<!-- Session Info -->
<div class="section">
  <div class="section-title">تفاصيل الجلسة</div>
  <div class="grid2">
    <div class="field"><label>اسم العميل</label><span>${d.customerName}</span></div>
    <div class="field"><label>المكان</label><span>${d.itemName} — ${d.zoneName}</span></div>
    <div class="field"><label>نوع الجلسة</label><span>${d.sessionType === "match" ? "⚽ جلسة مبارة" : "🎮 PlayStation"}</span></div>
    <div class="field"><label>عدد الأشخاص</label><span>${d.playerCount}</span></div>
    <div class="field"><label>بداية الجلسة</label><span>${fmtTime(d.startTime)}</span></div>
    <div class="field"><label>نهاية الجلسة</label><span>${fmtTime(d.endTime)}</span></div>
    <div class="field"><label>المدة الكلية</label><span>${fmtDur(d.duration)}</span></div>
    ${d.cashier ? `<div class="field"><label>الكاشير</label><span>${d.cashier}</span></div>` : ""}
  </div>
</div>

<!-- Orders -->
<div class="section">
  <div class="section-title">الطلبات</div>
  <table>
    <thead><tr><th>الصنف</th><th style="text-align:left">السعر</th></tr></thead>
    <tbody>${orderRows}</tbody>
  </table>
</div>

<!-- Bill Summary -->
<div class="section">
  <div class="section-title">ملخص الفاتورة</div>
  <table>
    <tbody>
      <tr>
        <td style="padding:9px 14px;border-bottom:1px solid #eef0f8">
          ${d.sessionType === "match" ? "⚽ جلسة مبارة (ثابت)" : "⏱ سعر الوقت"}
        </td>
        <td style="padding:9px 14px;text-align:left;border-bottom:1px solid #eef0f8;font-weight:600">
          ${d.timePrice} ${SAR}
        </td>
      </tr>
      ${d.ordersTotal > 0 ? `
      <tr>
        <td style="padding:9px 14px;border-bottom:1px solid #eef0f8">☕ الطلبات</td>
        <td style="padding:9px 14px;text-align:left;border-bottom:1px solid #eef0f8;font-weight:600">${d.ordersTotal} ${SAR}</td>
      </tr>` : ""}
      ${d.discount > 0 ? `
      <tr style="color:#22c55e">
        <td style="padding:9px 14px;border-bottom:1px solid #eef0f8">🎁 خصم</td>
        <td style="padding:9px 14px;text-align:left;border-bottom:1px solid #eef0f8;font-weight:600">− ${d.discount} ${SAR}</td>
      </tr>` : ""}
      ${d.debtAmount > 0 ? `
      <tr style="color:#ef4444">
        <td style="padding:9px 14px;border-bottom:1px solid #eef0f8">📋 مؤجل (دين)</td>
        <td style="padding:9px 14px;text-align:left;border-bottom:1px solid #eef0f8;font-weight:600">${d.debtAmount} ${SAR}</td>
      </tr>` : ""}
      ${hasVat ? `
      <tr style="background:#f0fff4">
        <td style="padding:9px 14px;border-bottom:1px solid #eef0f8;color:#555;font-size:12px">المبلغ قبل الضريبة</td>
        <td style="padding:9px 14px;text-align:left;border-bottom:1px solid #eef0f8;font-size:12px">${fmtVatAmount(baseAmt)} ${SAR}</td>
      </tr>
      <tr style="background:#f0fff4">
        <td style="padding:9px 14px;border-bottom:1px solid #d4ead8;color:#555;font-size:12px">ضريبة القيمة المضافة (١٥٪)</td>
        <td style="padding:9px 14px;text-align:left;border-bottom:1px solid #d4ead8;font-size:12px;color:#22c55e;font-weight:600">${fmtVatAmount(vatAmt)} ${SAR}</td>
      </tr>` : ""}
      <tr class="total-row">
        <td>المجموع${hasVat ? " (شامل الضريبة)" : " الكلي"}</td>
        <td style="text-align:left">${d.total} ${SAR}</td>
      </tr>
      <tr>
        <td style="padding:9px 14px;color:#888">طريقة الدفع</td>
        <td style="padding:9px 14px;text-align:left;font-weight:600">${payLabel(d.payMethod)}</td>
      </tr>
      ${hasVat ? `<tr>
        <td style="padding:9px 14px;color:#888;font-size:12px">الرقم الضريبي</td>
        <td style="padding:9px 14px;text-align:left;font-family:monospace;font-size:12px">${d.vatNumber}</td>
      </tr>` : ""}
    </tbody>
  </table>
</div>

${hasVat && zatcaQrImg ? `
<!-- ZATCA QR -->
<div style="display:flex;align-items:center;gap:18px;margin:20px 0;padding:14px 16px;background:#f7f8ff;border:1px solid #e5e7eb;border-radius:10px">
  <img src="${zatcaQrImg}" style="width:100px;height:100px;flex-shrink:0">
  <div>
    <div style="font-size:11px;font-weight:700;color:#6c8cff;margin-bottom:4px">فاتورة ضريبية مبسّطة</div>
    <div style="font-size:10px;color:#888;line-height:1.7">
      متوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك<br>
      امسح رمز QR للتحقق من الفاتورة
    </div>
    <div style="font-size:10px;color:#aaa;margin-top:4px">${sellerDisplay}</div>
    <div style="font-size:10px;font-family:monospace;color:#aaa">${d.vatNumber}</div>
  </div>
</div>` : ""}

<!-- Footer -->
<div style="text-align:center;margin-top:36px;padding-top:18px;border-top:1px solid #eee;color:#aaa;font-size:11px;line-height:2">
  <div style="font-size:13px;color:#888;font-weight:600">شكراً لزيارتكم — ${sellerDisplay}</div>
  <div>ALSAMLAH Entertainment Center</div>
</div>
</body></html>`;
}

// ══════════════════════════════════════════
// THERMAL — Debt record
// ══════════════════════════════════════════

function thermalDebtHTML(d: DebtPrintData): string {
  const line = `<div style="border-top:1px dashed #888;margin:7px 0"></div>`;
  const row = (label: string, val: string) =>
    `<div style="display:flex;justify-content:space-between;margin:3px 0;font-size:12.5px">
       <span style="color:#555">${label}</span>
       <span style="font-weight:600;color:#000">${val}</span>
     </div>`;

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<style>
  @page { margin:3mm 4mm; size:80mm auto; }
  body { font-family:'Courier New',monospace; margin:0; padding:6px 8px; width:72mm; color:#111; font-size:12.5px; }
</style></head><body>
<div style="text-align:center;margin-bottom:4px">
  <div style="font-weight:900;font-size:15px;letter-spacing:2px">ALSAMLAH</div>
  <div style="font-size:11px;color:#555">مركز الصملة للترفيه</div>
</div>
${line}
<div style="text-align:center;font-weight:700;font-size:13px;margin:4px 0">📋 سجل مديونية</div>
${line}
${row("الاسم", d.name)}
${d.phone ? row("الجوال", d.phone) : ""}
${row("التاريخ", fmtDate(d.date))}
${line}
${row("إجمالي الدين", `${d.amount} ${SAR}`)}
${row("المسدَّد", `${d.paidAmount} ${SAR}`)}
${row("المتبقي", `${d.remaining} ${SAR}`)}
${d.note ? `${line}<div style="font-size:11.5px;color:#555">ملاحظة: ${d.note}</div>` : ""}
${line}
<div style="text-align:center;font-size:11px;color:#555;margin-top:8px">مركز الصملة للترفيه</div>
<div style="height:14px"></div>
</body></html>`;
}

// ══════════════════════════════════════════
// A4 — Debt record
// ══════════════════════════════════════════

function a4DebtHTML(d: DebtPrintData): string {
  const logoSection = d.logo
    ? `<img src="${d.logo}" style="height:60px;object-fit:contain;max-width:240px">`
    : `<div style="font-size:24px;font-weight:900;letter-spacing:2px;color:#6c8cff">AL<span style="color:#1a1a2e">SAMLAH</span></div>`;

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<style>
  @page { size:A4; margin:18mm 20mm; }
  body { font-family:'Segoe UI',Tahoma,Arial,sans-serif; color:#1a1a2e; margin:0; font-size:13px; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #ef4444">
  <div>${logoSection}</div>
  <div style="text-align:left">
    <div style="font-size:24px;font-weight:900;color:#ef4444">سجل مديونية</div>
    <div style="font-size:12px;color:#aaa;margin-top:4px">${fmtDate(d.date)}</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
  <div><div style="font-size:11px;color:#999">اسم العميل</div><div style="font-size:16px;font-weight:700">${d.name}</div></div>
  ${d.phone ? `<div><div style="font-size:11px;color:#999">رقم الجوال</div><div style="font-size:16px;font-weight:700">${d.phone}</div></div>` : ""}
</div>

<table style="border-collapse:collapse;width:100%;margin-bottom:24px">
  <thead><tr style="background:#ef4444">
    <th style="color:#fff;padding:10px 14px;text-align:right">البيان</th>
    <th style="color:#fff;padding:10px 14px;text-align:left">المبلغ</th>
  </tr></thead>
  <tbody>
    <tr style="background:#fff7f7"><td style="padding:10px 14px;border-bottom:1px solid #ffe0e0">إجمالي الدين</td><td style="padding:10px 14px;text-align:left;font-weight:700;border-bottom:1px solid #ffe0e0">${d.amount} ${SAR}</td></tr>
    <tr style="background:#f7fff9"><td style="padding:10px 14px;border-bottom:1px solid #d4ead8;color:#22c55e">المبلغ المسدَّد</td><td style="padding:10px 14px;text-align:left;font-weight:700;border-bottom:1px solid #d4ead8;color:#22c55e">${d.paidAmount} ${SAR}</td></tr>
    <tr><td style="padding:12px 14px;font-size:16px;font-weight:800;border-top:2px solid #ef4444;color:#ef4444">المتبقي</td><td style="padding:12px 14px;text-align:left;font-size:16px;font-weight:800;border-top:2px solid #ef4444;color:#ef4444">${d.remaining} ${SAR}</td></tr>
  </tbody>
</table>

${d.note ? `<div style="background:#f8f8f8;padding:12px 16px;border-radius:6px;font-size:13px;color:#555;border-right:3px solid #ddd"><strong>ملاحظة:</strong> ${d.note}</div>` : ""}

<div style="text-align:center;margin-top:40px;padding-top:16px;border-top:1px solid #eee;color:#aaa;font-size:11px">
  مركز الصملة للترفيه — ALSAMLAH Entertainment Center
</div>
</body></html>`;
}

// ══════════════════════════════════════════
// Public API
// ══════════════════════════════════════════

export async function printSession(data: SessionPrintData, type: PrintType) {
  // Generate ZATCA QR code image (PNG data URL) if VAT is configured
  let zatcaQrImg: string | null = null;
  if (data.vatNumber && data.sellerNameAr) {
    zatcaQrImg = await generateZatcaQR({
      sellerName: data.sellerNameAr,
      vatNumber: data.vatNumber,
      invoiceTimestamp: data.endTime,
      totalWithVat: data.total,
    });
  }
  const html = type === "thermal"
    ? thermalSessionHTML(data, zatcaQrImg)
    : a4SessionHTML(data, zatcaQrImg);
  openAndPrint(html, type);
}

export function printDebt(data: DebtPrintData, type: PrintType) {
  const html = type === "thermal" ? thermalDebtHTML(data) : a4DebtHTML(data);
  openAndPrint(html, type);
}

// ══════════════════════════════════════════
// A4 — Shift / End-of-Day Report
// ══════════════════════════════════════════

function shiftReportHTML(d: ShiftReportPrintData): string {
  const logoSection = d.logo
    ? `<img src="${d.logo}" style="height:60px;object-fit:contain;max-width:220px">`
    : `<div style="font-size:24px;font-weight:900;letter-spacing:2px;color:#6c8cff">AL<span style="color:#1a1a2e">SAMLAH</span></div>`;

  const shiftDuration = (() => {
    const ms = d.closedAt - d.openedAt;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h} ساعة ${m > 0 ? `${m} د` : ""}`;
  })();

  const zoneRows = Object.entries(d.byZone).map(([zone, { count, rev }]) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eef0f8">${zone}</td>
      <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #eef0f8">${count}</td>
      <td style="padding:8px 12px;text-align:left;border-bottom:1px solid #eef0f8;font-weight:600">${rev} ${SAR}</td>
    </tr>`
  ).join("");

  const itemRows = d.itemSales.slice(0, 10).map((s, i) =>
    `<tr style="background:${i % 2 === 0 ? "#f7f8ff" : "#fff"}">
      <td style="padding:7px 12px;border-bottom:1px solid #eef0f8">${s.icon} ${s.name}</td>
      <td style="padding:7px 12px;text-align:center;border-bottom:1px solid #eef0f8;font-weight:600">${s.qty}</td>
      <td style="padding:7px 12px;text-align:left;border-bottom:1px solid #eef0f8;font-weight:600">${s.rev} ${SAR}</td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<style>
  @page { size:A4; margin:15mm 18mm; }
  * { box-sizing:border-box; }
  body { font-family:'Segoe UI',Tahoma,Arial,sans-serif; color:#1a1a2e; margin:0; font-size:12px; line-height:1.5; }
  table { border-collapse:collapse; width:100%; margin-bottom:20px; }
  th { background:#6c8cff; color:#fff; padding:9px 12px; text-align:right; font-size:11px; font-weight:600; }
  th:last-child { text-align:left; }
  .section-title { font-size:11px; font-weight:700; color:#6c8cff; border-bottom:2px solid #6c8cff; padding-bottom:4px; margin:18px 0 12px; letter-spacing:0.5px; }
  .card { background:#f7f8ff; border-radius:8px; padding:12px 14px; }
  .card label { font-size:10px; color:#999; display:block; margin-bottom:2px; }
  .card .val { font-size:16px; font-weight:800; color:#1a1a2e; }
  .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px; }
  .grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
  .highlight { color:#6c8cff; }
  .danger { color:#ef4444; }
  .success { color:#22c55e; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:16px;border-bottom:2px solid #6c8cff">
  <div>${logoSection}</div>
  <div style="text-align:left">
    <div style="font-size:20px;font-weight:900;color:#6c8cff">تقرير نهاية اليوم</div>
    <div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-top:2px">${d.businessDate}</div>
    <div style="font-size:11px;color:#aaa;margin-top:4px">فتح: ${fmtTime(d.openedAt)} — إغلاق: ${fmtTime(d.closedAt)}</div>
    <div style="font-size:11px;color:#aaa">المدة: ${shiftDuration}</div>
  </div>
</div>

<!-- Cash Reconciliation -->
<div class="section-title">تسوية الصندوق</div>
<div class="grid4">
  <div class="card"><label>رصيد الافتتاح</label><div class="val">${d.cashFloat} ${SAR}</div></div>
  <div class="card"><label>إيراد نقدي</label><div class="val success">+ ${d.cashRevenue} ${SAR}</div></div>
  <div class="card" style="background:#f0fff4"><label>المتوقع في الصندوق</label><div class="val highlight">${d.expectedCashInDrawer} ${SAR}</div></div>
  <div class="card"><label>عدد الجلسات</label><div class="val">${d.sessionCount}</div></div>
</div>

<!-- Revenue Summary -->
<div class="section-title">ملخص الإيراد</div>
<div class="grid4">
  <div class="card"><label>إجمالي الإيراد</label><div class="val">${d.totalRevenue} ${SAR}</div></div>
  <div class="card"><label>إيراد الوقت</label><div class="val">${d.timeRevenue} ${SAR}</div></div>
  <div class="card"><label>إيراد الطلبات</label><div class="val">${d.ordersRevenue} ${SAR}</div></div>
  <div class="card"><label>صافي الإيراد</label><div class="val highlight">${d.netRevenue} ${SAR}</div></div>
</div>
<div class="grid3">
  <div class="card"><label>الخصومات</label><div class="val danger">− ${d.discountTotal} ${SAR}</div></div>
  <div class="card"><label>الديون الجديدة</label><div class="val danger">${d.debtTotal} ${SAR}</div></div>
  <div class="card"><label>جلسات معلقة</label><div class="val">${d.heldCount} جلسة / ${d.heldTotal} ${SAR}</div></div>
</div>

<!-- Payment Methods -->
<div class="section-title">طرق الدفع</div>
<div class="grid3">
  <div class="card"><label>💵 نقدي</label><div class="val">${d.cashRevenue} ${SAR}</div></div>
  <div class="card"><label>💳 شبكة</label><div class="val">${d.cardRevenue} ${SAR}</div></div>
  <div class="card"><label>📲 تحويل</label><div class="val">${d.transferRevenue} ${SAR}</div></div>
</div>

${zoneRows ? `
<!-- Zone Breakdown -->
<div class="section-title">حسب القسم</div>
<table>
  <thead><tr><th>القسم</th><th style="text-align:center">الجلسات</th><th style="text-align:left">الإيراد</th></tr></thead>
  <tbody>${zoneRows}</tbody>
</table>` : ""}

${itemRows ? `
<!-- Top Items -->
<div class="section-title">أكثر الأصناف مبيعاً (أعلى ١٠)</div>
<table>
  <thead><tr><th>الصنف</th><th style="text-align:center">الكمية</th><th style="text-align:left">الإيراد</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>` : ""}

<!-- Staff -->
<div style="margin-top:16px;font-size:11px;color:#aaa;display:flex;gap:24px">
  <span>فتح بواسطة: <strong style="color:#1a1a2e">${d.openedBy}</strong></span>
  <span>أغلق بواسطة: <strong style="color:#1a1a2e">${d.closedBy}</strong></span>
</div>

<div style="text-align:center;margin-top:24px;padding-top:14px;border-top:1px solid #eee;color:#aaa;font-size:11px">
  مركز الصملة للترفيه — ALSAMLAH Entertainment Center
</div>
</body></html>`;
}

// ══════════════════════════════════════════
// A4 — Period Stats Report
// ══════════════════════════════════════════

function statsReportHTML(d: StatsReportPrintData): string {
  const logoSection = d.logo
    ? `<img src="${d.logo}" style="height:60px;object-fit:contain;max-width:220px">`
    : `<div style="font-size:24px;font-weight:900;letter-spacing:2px;color:#6c8cff">AL<span style="color:#1a1a2e">SAMLAH</span></div>`;

  const zoneRows = Object.entries(d.byZone).map(([zone, { count, rev }]) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eef0f8">${zone}</td>
      <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #eef0f8">${count}</td>
      <td style="padding:8px 12px;text-align:left;border-bottom:1px solid #eef0f8;font-weight:600">${rev} ${SAR}</td>
    </tr>`
  ).join("");

  const itemRows = d.itemSales.map((s, i) =>
    `<tr style="background:${i % 2 === 0 ? "#f7f8ff" : "#fff"}">
      <td style="padding:7px 12px;border-bottom:1px solid #eef0f8">${s.icon} ${s.name}</td>
      <td style="padding:7px 12px;text-align:center;border-bottom:1px solid #eef0f8;font-weight:600">${s.qty}</td>
      <td style="padding:7px 12px;text-align:left;border-bottom:1px solid #eef0f8;font-weight:600">${s.rev} ${SAR}</td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<style>
  @page { size:A4; margin:15mm 18mm; }
  * { box-sizing:border-box; }
  body { font-family:'Segoe UI',Tahoma,Arial,sans-serif; color:#1a1a2e; margin:0; font-size:12px; line-height:1.5; }
  table { border-collapse:collapse; width:100%; margin-bottom:20px; }
  th { background:#6c8cff; color:#fff; padding:9px 12px; text-align:right; font-size:11px; font-weight:600; }
  th:last-child { text-align:left; }
  .section-title { font-size:11px; font-weight:700; color:#6c8cff; border-bottom:2px solid #6c8cff; padding-bottom:4px; margin:18px 0 12px; }
  .card { background:#f7f8ff; border-radius:8px; padding:12px 14px; }
  .card label { font-size:10px; color:#999; display:block; margin-bottom:2px; }
  .card .val { font-size:16px; font-weight:800; color:#1a1a2e; }
  .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px; }
  .grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
  .highlight { color:#6c8cff; }
  .danger { color:#ef4444; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:16px;border-bottom:2px solid #6c8cff">
  <div>${logoSection}</div>
  <div style="text-align:left">
    <div style="font-size:20px;font-weight:900;color:#6c8cff">تقرير الإيرادات</div>
    <div style="font-size:14px;font-weight:700;color:#1a1a2e;margin-top:2px">${d.dateLabel}</div>
    <div style="font-size:11px;color:#aaa;margin-top:4px">${new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>
</div>

<div class="section-title">ملخص الإيراد</div>
<div class="grid4">
  <div class="card"><label>إجمالي الإيراد</label><div class="val">${d.totalRevenue} ${SAR}</div></div>
  <div class="card"><label>إيراد الوقت</label><div class="val">${d.timeRevenue} ${SAR}</div></div>
  <div class="card"><label>إيراد الطلبات</label><div class="val">${d.ordersRevenue} ${SAR}</div></div>
  <div class="card"><label>صافي الإيراد</label><div class="val highlight">${d.netRevenue} ${SAR}</div></div>
</div>
<div class="grid3">
  <div class="card"><label>عدد الجلسات</label><div class="val">${d.sessionCount}</div></div>
  <div class="card"><label>الخصومات</label><div class="val danger">− ${d.discountTotal} ${SAR}</div></div>
  <div class="card"><label>الديون</label><div class="val danger">${d.debtTotal} ${SAR}</div></div>
</div>

<div class="section-title">طرق الدفع</div>
<div class="grid3">
  <div class="card"><label>💵 نقدي</label><div class="val">${d.cashRevenue} ${SAR}</div></div>
  <div class="card"><label>💳 شبكة</label><div class="val">${d.cardRevenue} ${SAR}</div></div>
  <div class="card"><label>📲 تحويل</label><div class="val">${d.transferRevenue} ${SAR}</div></div>
</div>

${zoneRows ? `
<div class="section-title">حسب القسم</div>
<table>
  <thead><tr><th>القسم</th><th style="text-align:center">الجلسات</th><th style="text-align:left">الإيراد</th></tr></thead>
  <tbody>${zoneRows}</tbody>
</table>` : ""}

${itemRows ? `
<div class="section-title">مبيعات الأصناف</div>
<table>
  <thead><tr><th>الصنف</th><th style="text-align:center">الكمية</th><th style="text-align:left">الإيراد</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>` : ""}

<div style="text-align:center;margin-top:24px;padding-top:14px;border-top:1px solid #eee;color:#aaa;font-size:11px">
  مركز الصملة للترفيه — ALSAMLAH Entertainment Center
</div>
</body></html>`;
}

export function printShiftReport(data: ShiftReportPrintData, _type: PrintType = "a4") {
  openAndPrint(shiftReportHTML(data), "a4");
}

export function printStatsReport(data: StatsReportPrintData, _type: PrintType = "a4") {
  openAndPrint(statsReportHTML(data), "a4");
}
