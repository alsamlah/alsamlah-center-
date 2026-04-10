"use client";

import { useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { submitRating } from "@/lib/db";

function RatingPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const recordId = params.id as string;
  const tenantId = searchParams.get("t") || "";

  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!selected || !tenantId) return;
    setLoading(true);
    setError("");
    try {
      await submitRating(tenantId, recordId, selected, note);
      setSubmitted(true);
    } catch {
      setError("حدث خطأ، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ background: "var(--bg)" }}>
        <div className="text-6xl mb-4">🎉</div>
        <div className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>شكراً لتقييمك!</div>
        <div className="text-sm" style={{ color: "var(--text2)" }}>رأيك يهمنا ويساعدنا على التطوير</div>
        <div className="mt-6 flex gap-1 justify-center">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className="text-4xl" style={{ color: s <= selected ? "#f59e0b" : "var(--border)" }}>★</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "var(--bg)" }} dir="rtl">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥊</div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>مركز الصملة للترفيه</h1>
          <p className="text-sm" style={{ color: "var(--text2)" }}>قيّم تجربتك معنا</p>
        </div>

        {/* Stars */}
        <div className="card p-6 mb-4 text-center">
          <div className="text-sm font-medium mb-4" style={{ color: "var(--text2)" }}>كيف كانت تجربتك؟</div>
          <div className="flex gap-2 justify-center mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setSelected(s)}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                className="text-5xl transition-transform hover:scale-110 active:scale-95"
                style={{ color: s <= (hovered || selected) ? "#f59e0b" : "var(--border)", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>
                ★
              </button>
            ))}
          </div>
          {selected > 0 && (
            <div className="text-sm font-medium mt-2" style={{ color: "#f59e0b" }}>
              {["", "سيء", "مقبول", "جيد", "ممتاز", "رائع!"][selected]}
            </div>
          )}
        </div>

        {/* Note */}
        <div className="card p-4 mb-4">
          <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text2)" }}>ملاحظة (اختياري)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="أخبرنا بتجربتك..."
            rows={3}
            className="input w-full resize-none text-sm"
            style={{ fontFamily: "inherit" }}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-center mb-3" style={{ color: "var(--red)" }}>{error}</div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!selected || loading}
          className="btn btn-primary w-full py-4 text-base font-bold"
          style={{ opacity: (!selected || loading) ? 0.5 : 1 }}>
          {loading ? "..." : "إرسال التقييم ★"}
        </button>
      </div>
    </div>
  );
}

export default function RatingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div style={{ color: "var(--text2)" }}>...</div>
      </div>
    }>
      <RatingPageInner />
    </Suspense>
  );
}
