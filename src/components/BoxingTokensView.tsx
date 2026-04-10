"use client";
import { useState } from "react";
import type { BoxingTokenData } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { fmtDate, fmtTime } from "@/lib/utils";

interface Props {
  boxingTokens: BoxingTokenData | null;
  settings: SystemSettings;
  isRTL: boolean;
  currentUser: string;
  onAddTokens: (amount: number, note?: string) => void;
}

export default function BoxingTokensView({ boxingTokens, settings, isRTL, onAddTokens }: Props) {
  const t = T[settings.lang];
  const [addAmount, setAddAmount] = useState(10);
  const [addNote, setAddNote] = useState("");
  const [added, setAdded] = useState(false);

  const balance = boxingTokens?.balance ?? 0;
  const threshold = settings.alertThreshold ?? 10;
  const isLow = balance <= threshold;
  const log = boxingTokens?.log ?? [];

  const handleAdd = () => {
    if (addAmount <= 0) return;
    onAddTokens(addAmount, addNote || undefined);
    setAddNote("");
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      <h2 className="text-xl font-bold mb-5">🥊 {t.boxingTokens}</h2>

      {/* Balance card */}
      <div
        className="card p-6 text-center mb-5"
        style={isLow ? {
          borderColor: "color-mix(in srgb, var(--yellow) 45%, transparent)",
          background: "color-mix(in srgb, var(--yellow) 8%, var(--surface))",
        } : {}}
      >
        <div
          className="text-7xl font-black mb-2 leading-none"
          style={{ color: isLow ? "var(--yellow)" : "var(--accent)" }}
        >
          {balance}
        </div>
        <div className="text-sm mt-1" style={{ color: "var(--text2)" }}>
          {t.tokensRemaining}
        </div>
        {isLow && (
          <div className="mt-4 text-xs font-semibold px-4 py-2 rounded-lg"
            style={{ color: "var(--yellow)", background: "color-mix(in srgb, var(--yellow) 12%, transparent)" }}>
            ⚠️ {t.lowTokenAlert}
          </div>
        )}
      </div>

      {/* Add tokens section */}
      <div className="card p-4 mb-5">
        <div className="text-sm font-bold mb-3">{t.addTokens}</div>

        {/* Quick preset buttons */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {[10, 20, 50, 100].map((n) => (
            <button
              key={n}
              onClick={() => setAddAmount(n)}
              className="btn px-4 py-2 text-sm font-semibold"
              style={{
                background: addAmount === n
                  ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                  : "var(--input-bg)",
                color: addAmount === n ? "var(--accent)" : "var(--text2)",
                borderColor: addAmount === n
                  ? "color-mix(in srgb, var(--accent) 35%, transparent)"
                  : "var(--border)",
              }}
            >
              +{n}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="number"
            min={1}
            value={addAmount}
            onChange={(e) => setAddAmount(Math.max(1, Number(e.target.value)))}
            className="input w-24 text-center font-bold"
          />
          <input
            type="text"
            placeholder={isRTL ? "ملاحظة (اختياري)" : "Note (optional)"}
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
            className="input flex-1"
          />
        </div>

        <button
          onClick={handleAdd}
          className="btn btn-primary w-full py-3 font-bold"
          style={added ? { background: "var(--green)", borderColor: "var(--green)" } : {}}
        >
          {added ? `✓ ${t.tokenAdded}` : `+ ${t.addTokens} (${addAmount})`}
        </button>
      </div>

      {/* Settings summary */}
      <div className="card p-4 mb-5">
        <div className="flex justify-between items-center text-xs" style={{ color: "var(--text2)" }}>
          <span>📅 {t.monthlyTokens}: <strong style={{ color: "var(--text)" }}>{settings.monthlyTokens ?? 50}</strong></span>
          <span>⚠️ {t.alertThreshold}: <strong style={{ color: "var(--text)" }}>{settings.alertThreshold ?? 10}</strong></span>
        </div>
      </div>

      {/* Usage log */}
      <div className="card p-4">
        <div className="text-sm font-bold mb-3">{t.tokenLog}</div>
        {log.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: "var(--text2)", opacity: 0.5 }}>
            {t.noTokenLog}
          </div>
        ) : (
          <div className="space-y-0 max-h-96 overflow-y-auto">
            {log.map((entry, idx) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 py-2.5 text-xs"
                style={{
                  borderBottom: idx < log.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <span
                  className="font-black text-base min-w-[36px] text-center"
                  style={{ color: entry.type === "deduct" ? "var(--red)" : "var(--green)" }}
                >
                  {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ color: "var(--text)" }}>
                    {entry.note || (entry.type === "deduct"
                      ? (isRTL ? "إنهاء جلسة" : "Session end")
                      : (isRTL ? "إضافة رصيد" : "Tokens added"))}
                  </div>
                  <div style={{ color: "var(--text2)" }}>
                    {entry.by} · {fmtDate(entry.date)} {fmtTime(entry.date)}
                  </div>
                </div>
                <div className="text-right shrink-0" style={{ color: "var(--text2)" }}>
                  <div className="font-semibold" style={{ color: "var(--text)" }}>{entry.balanceAfter}</div>
                  <div style={{ fontSize: "0.65rem" }}>{isRTL ? "متبقي" : "left"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
