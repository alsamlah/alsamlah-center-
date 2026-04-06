"use client";

import { useState, useEffect, useRef } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import type { Floor } from "@/lib/supabase";

interface Props {
  floors: Floor[];
  tenantId: string;
}

function escapeHtml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

export default function QrCodesTab({ floors, tenantId }: Props) {
  const [origin, setOrigin] = useState("");
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const allItems = floors.flatMap((f) => f.zones.flatMap((z) => z.items));

  if (allItems.length === 0) {
    return (
      <div className="text-center py-16 text-sm" style={{ color: "var(--text2)", opacity: 0.4 }}>
        لا توجد غرف أو أصناف مضافة
      </div>
    );
  }

  const handlePrint = (itemId: string, itemName: string) => {
    const canvas = canvasRefs.current[itemId];
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const safeName = escapeHtml(itemName);

    const html = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${safeName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { display: flex; flex-direction: column; align-items: center; justify-content: center;
           min-height: 100vh; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; padding: 32px;
                border: 2px solid #e5e7eb; border-radius: 16px; gap: 16px; }
    img { width: 220px; height: 220px; }
    h2 { font-size: 20px; font-weight: 800; color: #111; text-align: center; }
    p { font-size: 13px; color: #6b7280; text-align: center; }
    @media print { @page { margin: 20mm; } }
  </style>
</head>
<body>
  <div class="qr-wrap">
    <img src="${dataUrl}" alt="QR Code" />
    <h2>${safeName}</h2>
    <p>امسح الكود لطلب من مكانك</p>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div>
      <div className="text-sm font-bold mb-5" style={{ color: "var(--text)" }}>
        📱 رموز QR للغرف والأصناف
      </div>
      <p className="text-xs mb-6" style={{ color: "var(--text2)", opacity: 0.7 }}>
        اطبع رمز QR لكل غرفة وضعه على الطاولة — العميل يمسحه ويطلب مباشرة من هاتفه
      </p>

      {floors.map((floor) => (
        <div key={floor.id} className="mb-8">
          <div className="text-xs font-bold mb-3 px-1" style={{ color: "var(--text2)" }}>
            {floor.name}
          </div>

          {floor.zones.map((zone) => (
            <div key={zone.id} className="mb-5">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="text-base">{zone.icon}</span>
                <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{zone.name}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {zone.items.map((item) => {
                  const qrUrl = origin ? `${origin}/order/${item.id}?t=${tenantId}` : "";
                  return (
                    <div key={item.id} className="card p-4 flex flex-col items-center gap-3 text-center">
                      {/* Hidden canvas for print data URL extraction */}
                      {origin && (
                        <QRCodeCanvas
                          value={qrUrl}
                          size={200}
                          ref={(el) => { canvasRefs.current[item.id] = el; }}
                          style={{ display: "none" }}
                        />
                      )}

                      {/* Visible QR */}
                      {origin ? (
                        <QRCodeSVG
                          value={qrUrl}
                          size={100}
                          bgColor="transparent"
                          fgColor="var(--text)"
                        />
                      ) : (
                        <div className="w-[100px] h-[100px] rounded-lg" style={{ background: "var(--input-bg)" }} />
                      )}

                      <div className="text-xs font-bold" style={{ color: "var(--text)" }}>
                        {item.name}
                      </div>

                      <button
                        onClick={() => handlePrint(item.id, item.name)}
                        disabled={!origin}
                        className="btn w-full py-2 text-[11px]"
                        style={{
                          background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                          color: "var(--accent)",
                          borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
                        }}
                      >
                        🖨️ طباعة
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
