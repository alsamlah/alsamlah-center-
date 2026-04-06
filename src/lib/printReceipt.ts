/**
 * printReceipt.ts — Thermal (80mm) and A4 PDF print utilities
 * Opens a new browser window with the receipt HTML and triggers window.print()
 */

export type PrintType = "thermal" | "a4";

// Official SAMA SAR symbol as inline SVG string (for use inside HTML templates)
const SAR = `<svg width="13" height="14.5" viewBox="0 0 1124.14 1256.39" fill="currentColor" style="display:inline-block;vertical-align:-0.15em;margin-right:1px"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/></svg>`;

// ── Data types ──

export interface SessionPrintData {
  invoiceNo: number;
  itemName: string;
  zoneName: string;
  customerName: string;
  sessionType?: "ps" | "match";
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
  logo?: string | null; // base64 data URL or null
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
  invoiceNo?: number;
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

const invNo = (n: number) => `#${String(n).padStart(4, "0")}`;

// ── Open print window ──

function openAndPrint(html: string, type: PrintType) {
  const dims = type === "thermal" ? "width=360,height=800" : "width=900,height=1200";
  const win = window.open("", "_blank", dims);
  if (!win) {
    alert("السماح بفتح النوافذ مطلوب للطباعة\nPlease allow popups for printing.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try { win.print(); } catch (_) {}
  }, 700);
}

// ══════════════════════════════════════════
// THERMAL — 80mm receipt
// ══════════════════════════════════════════

function thermalSessionHTML(d: SessionPrintData): string {
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
  <div style="font-weight:900;font-size:15px;letter-spacing:2px">ALSAMLAH</div>
  <div style="font-size:11px;color:#555">مركز الصملة للترفيه</div>
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
${line}
<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;margin:4px 0">
  <span>المجموع</span><span>${d.total} ${SAR}</span>
</div>
${row("الدفع", payLabel(d.payMethod))}
${d.cashier ? row("الكاشير", d.cashier) : ""}
${line}
<div style="text-align:center;font-size:11px;color:#555;margin-top:8px;line-height:1.8">
  شكراً لزيارتكم 🙏<br>مركز الصملة للترفيه
</div>
<div style="height:16px"></div>
</body></html>`;
}

// ══════════════════════════════════════════
// A4 — Full professional invoice
// ══════════════════════════════════════════

function a4SessionHTML(d: SessionPrintData): string {
  const logoSection = d.logo
    ? `<img src="${d.logo}" style="height:70px;object-fit:contain;max-width:260px">`
    : `<div style="font-size:28px;font-weight:900;letter-spacing:2px;color:#6c8cff">AL<span style="color:#1a1a2e">SAMLAH</span></div>
       <div style="font-size:12px;color:#888;margin-top:2px">مركز الصملة للترفيه</div>`;

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
      <tr class="total-row">
        <td>المجموع الكلي</td>
        <td style="text-align:left">${d.total} ${SAR}</td>
      </tr>
      <tr>
        <td style="padding:9px 14px;color:#888">طريقة الدفع</td>
        <td style="padding:9px 14px;text-align:left;font-weight:600">${payLabel(d.payMethod)}</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- Footer -->
<div style="text-align:center;margin-top:36px;padding-top:18px;border-top:1px solid #eee;color:#aaa;font-size:11px;line-height:2">
  <div style="font-size:13px;color:#888;font-weight:600">شكراً لزيارتكم — مركز الصملة للترفيه</div>
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

export function printSession(data: SessionPrintData, type: PrintType) {
  const html = type === "thermal" ? thermalSessionHTML(data) : a4SessionHTML(data);
  openAndPrint(html, type);
}

export function printDebt(data: DebtPrintData, type: PrintType) {
  const html = type === "thermal" ? thermalDebtHTML(data) : a4DebtHTML(data);
  openAndPrint(html, type);
}
