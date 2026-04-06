"use client";

/**
 * /receipt/[id]?t=[tenantId]
 * Public customer-facing receipt page — no login required.
 * Fetches the HistoryRecord from Supabase by JSONB id field.
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { HistoryRecord } from "@/lib/supabase";
import { generateZatcaQR, vatFromInclusive, baseFromInclusive } from "@/lib/zatca";
import SarSymbol from "@/components/SarSymbol";

// ── SAR SVG inline for standalone page (no layout dependency) ──
const SAR = (
  <svg width="13" height="14.5" viewBox="0 0 1124.14 1256.39"
    fill="currentColor" style={{ display: "inline-block", verticalAlign: "-0.15em", marginRight: 1 }}>
    <path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/>
    <path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/>
  </svg>
);

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

const fmtDur = (ms: number) => {
  const totalMins = Math.round(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h} ساعة و${m} دقيقة`;
  if (h > 0) return `${h} ساعة`;
  return `${m} دقيقة`;
};

const payLabel: Record<string, string> = {
  cash: "💵 نقدي",
  card: "💳 شبكة",
  transfer: "📲 تحويل",
  held: "⏸ معلق",
};

type LoadState = "loading" | "found" | "notfound" | "error";

export default function ReceiptPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const recordId = params.id as string;
  const tenantId = searchParams.get("t");

  const [record, setRecord] = useState<HistoryRecord | null>(null);
  const [tenantName, setTenantName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [vatNumber, setVatNumber] = useState<string | null>(null);
  const [zatcaQrImg, setZatcaQrImg] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!recordId) { setState("notfound"); return; }

    const load = async () => {
      try {
        // Fetch the specific history row by data->>'id'
        let q = supabase
          .from("history")
          .select("data, tenant_id")
          .filter("data->>id", "eq", recordId)
          .limit(1);

        if (tenantId) q = q.eq("tenant_id", tenantId);

        const { data: rows, error } = await q;
        if (error || !rows || rows.length === 0) { setState("notfound"); return; }

        const rec = rows[0].data as HistoryRecord;
        const tid = rows[0].tenant_id as string;
        setRecord(rec);

        // Fetch tenant name + logo + VAT settings
        const [tenantRes, settingsRes] = await Promise.all([
          supabase.from("tenants").select("name_ar, logo_url").eq("id", tid).single(),
          supabase.from("tenant_settings").select("settings").eq("tenant_id", tid).single(),
        ]);

        if (tenantRes.data) {
          setTenantName(tenantRes.data.name_ar || "مركز الصملة للترفيه");
          setLogoUrl(tenantRes.data.logo_url);
        }

        // Extract VAT info from tenant_settings
        const sysSettings = settingsRes.data?.settings as Record<string, unknown> | null;
        const vat = sysSettings?.vatNumber as string | undefined;
        const seller = (sysSettings?.sellerNameAr as string | undefined)
          || tenantRes.data?.name_ar || "مركز الصملة للترفيه";
        const vatEnabled = sysSettings?.vatEnabled as boolean | undefined;

        if (vatEnabled && vat && vat.length === 15) {
          setVatNumber(vat);
          // Generate ZATCA QR
          const qrImg = await generateZatcaQR({
            sellerName: seller,
            vatNumber: vat,
            invoiceTimestamp: rec.endTime,
            totalWithVat: rec.total,
          });
          if (qrImg) setZatcaQrImg(qrImg);
        }

        setState("found");
      } catch {
        setState("error");
      }
    };

    load();
  }, [recordId, tenantId]);

  // ── Loading ──
  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl"
        style={{ background: "#0f0f12", color: "#aaa" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧾</div>
          <div style={{ fontSize: 14 }}>جاري تحميل الإيصال…</div>
        </div>
      </div>
    );
  }

  // ── Not found / Error ──
  if (state !== "found" || !record) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl"
        style={{ background: "#0f0f12", color: "#aaa" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
            لم يُعثر على الإيصال
          </div>
          <div style={{ fontSize: 13 }}>
            {state === "error" ? "حدث خطأ أثناء التحميل" : "الرابط غير صحيح أو الإيصال محذوف"}
          </div>
        </div>
      </div>
    );
  }

  const isHeld = record.status === "held-occupied" || record.status === "held-free";

  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#0f0f20 0%,#1a1a35 100%)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "20px 16px 40px",
      fontFamily: "'Segoe UI',Tahoma,Arial,sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#fff",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(135deg,#6c8cff 0%,#a78bfa 100%)",
          padding: "28px 24px 24px",
          textAlign: "center",
          color: "#fff",
        }}>
          {logoUrl ? (
            <img src={logoUrl} alt="logo"
              style={{ height: 52, objectFit: "contain", marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
          ) : (
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}>
              🎮 ALSAMLAH
            </div>
          )}
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 16 }}>
            {tenantName || "مركز الصملة للترفيه"}
          </div>
          <div style={{
            background: "rgba(255,255,255,0.15)",
            borderRadius: 10,
            padding: "10px 16px",
            display: "inline-block",
          }}>
            <div style={{ fontSize: 11, opacity: 0.8 }}>رقم الفاتورة</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3 }}>
              {record.invoiceNo ? `#${record.invoiceNo}` : "---"}
            </div>
          </div>
        </div>

        {/* ── Status badge for held ── */}
        {isHeld && (
          <div style={{
            background: "#fef3c7",
            color: "#92400e",
            textAlign: "center",
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
          }}>
            ⏸ جلسة معلقة — بانتظار اكتمال الدفع
          </div>
        )}

        <div style={{ padding: "20px 20px 24px" }}>
          {/* ── Date / Time ── */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#888",
            marginBottom: 18,
            padding: "10px 14px",
            background: "#f8f9ff",
            borderRadius: 10,
          }}>
            <span>📅 {fmtDate(record.endTime)}</span>
            <span>⏰ {fmtTime(record.endTime)}</span>
          </div>

          {/* ── Session Info ── */}
          <Section title="تفاصيل الجلسة">
            <Row label="العميل" value={record.customerName} />
            <Row label="المكان" value={`${record.itemName} — ${record.zoneName}`} />
            <Row label="النوع" value={record.sessionType === "match" ? "⚽ جلسة مبارة" : "🎮 PlayStation"} />
            <Row label="عدد الأشخاص" value={String(record.playerCount || 1)} />
            <Row label="وقت البداية" value={fmtTime(record.startTime)} />
            <Row label="وقت النهاية" value={fmtTime(record.endTime)} />
            <Row label="المدة" value={fmtDur(record.duration)} />
          </Section>

          {/* ── Orders ── */}
          {record.orders && record.orders.length > 0 && (
            <Section title="الطلبات">
              {record.orders.map((o, i) => (
                <Row key={i} label={`${o.icon || "☕"} ${o.name}`} value={<>{o.price} {SAR}</>} />
              ))}
            </Section>
          )}

          {/* ── Bill ── */}
          <Section title="ملخص الفاتورة">
            <Row label={record.sessionType === "match" ? "⚽ جلسة مبارة" : "⏱ سعر الوقت"}
              value={<>{record.timePrice} {SAR}</>} />
            {record.ordersTotal > 0 && (
              <Row label="☕ الطلبات" value={<>{record.ordersTotal} {SAR}</>} />
            )}
            {(record.discount || 0) > 0 && (
              <Row label="🎁 خصم"
                value={<span style={{ color: "#22c55e" }}>− {record.discount} {SAR}</span>} />
            )}
            {(record.debtAmount || 0) > 0 && (
              <Row label="📋 مؤجل"
                value={<span style={{ color: "#ef4444" }}>{record.debtAmount} {SAR}</span>} />
            )}
            {/* VAT breakdown */}
            {vatNumber && (
              <>
                <div style={{ borderTop: "1px dashed #e5e7eb", margin: "8px 0" }} />
                <Row
                  label="المبلغ قبل الضريبة"
                  value={<>{baseFromInclusive(record.total).toFixed(2)} {SAR}</>}
                />
                <Row
                  label="ضريبة القيمة المضافة (١٥٪)"
                  value={<span style={{ color: "#22c55e" }}>{vatFromInclusive(record.total).toFixed(2)} {SAR}</span>}
                />
                <Row label="الرقم الضريبي" value={<span style={{ fontFamily: "monospace", fontSize: 11 }}>{vatNumber}</span>} />
              </>
            )}
          </Section>

          {/* ── Total ── */}
          <div style={{
            background: "linear-gradient(135deg,#6c8cff15,#a78bfa15)",
            border: "2px solid #6c8cff",
            borderRadius: 14,
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 11, color: "#888" }}>
                {vatNumber ? "الإجمالي شامل الضريبة" : "المجموع الكلي"}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#6c8cff" }}>
                {record.total} {SAR}
              </div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, color: "#888" }}>طريقة الدفع</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e", marginTop: 2 }}>
                {payLabel[record.payMethod] || record.payMethod}
              </div>
            </div>
          </div>

          {/* ── ZATCA QR Code ── */}
          {zatcaQrImg && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "#f8f9ff",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 16,
            }}>
              <img src={zatcaQrImg} alt="ZATCA QR"
                style={{ width: 90, height: 90, flexShrink: 0, borderRadius: 8 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6c8cff", marginBottom: 3 }}>
                  فاتورة ضريبية مبسّطة
                </div>
                <div style={{ fontSize: 10, color: "#aaa", lineHeight: 1.7 }}>
                  متوافقة مع متطلبات<br />
                  هيئة الزكاة والضريبة والجمارك
                </div>
              </div>
            </div>
          )}

          {/* ── Cashier ── */}
          {record.cashier && (
            <div style={{ textAlign: "center", fontSize: 11, color: "#bbb", marginBottom: 20 }}>
              خدمك: <strong style={{ color: "#888" }}>{record.cashier}</strong>
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{
            textAlign: "center",
            paddingTop: 16,
            borderTop: "1px dashed #e5e7eb",
            color: "#bbb",
            fontSize: 12,
            lineHeight: 1.8,
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>🙏</div>
            <div style={{ fontWeight: 700, color: "#888" }}>شكراً لزيارتكم</div>
            <div>{tenantName || "مركز الصملة للترفيه"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small reusable sub-components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#6c8cff",
        borderBottom: "1px solid #e5e7eb",
        paddingBottom: 6,
        marginBottom: 10,
        letterSpacing: 0.5,
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, alignItems: "center" }}>
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{value}</span>
    </div>
  );
}
