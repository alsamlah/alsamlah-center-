"use client";

import { useState } from "react";
import type { Promotion, PromotionType } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { uid } from "@/lib/utils";

interface PromotionsViewProps {
  promotions: Promotion[];
  setPromotions: (fn: (prev: Promotion[]) => Promotion[]) => void;
  isManager: boolean;
  settings: SystemSettings;
  notify: (msg: string) => void;
}

const DAY_LABELS_AR = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];
const DAY_LABELS_EN = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

export default function PromotionsView({ promotions, setPromotions, isManager, settings, notify }: PromotionsViewProps) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const dayLabels = isRTL ? DAY_LABELS_AR : DAY_LABELS_EN;

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<PromotionType>("happy-hour");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("17:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");

  function resetForm() {
    setName("");
    setType("happy-hour");
    setDiscountPercent(10);
    setStartTime("14:00");
    setEndTime("17:00");
    setDaysOfWeek([]);
    setCouponCode("");
    setMaxUses(undefined);
    setValidFrom("");
    setValidTo("");
    setEditId(null);
    setShowForm(false);
  }

  function openEdit(p: Promotion) {
    setName(p.name);
    setType(p.type);
    setDiscountPercent(p.discountPercent);
    setStartTime(p.startTime || "14:00");
    setEndTime(p.endTime || "17:00");
    setDaysOfWeek(p.daysOfWeek || []);
    setCouponCode(p.couponCode || "");
    setMaxUses(p.maxUses);
    setValidFrom(p.validFrom ? new Date(p.validFrom).toISOString().slice(0, 10) : "");
    setValidTo(p.validTo ? new Date(p.validTo).toISOString().slice(0, 10) : "");
    setEditId(p.id);
    setShowForm(true);
  }

  function handleSave() {
    if (!name.trim()) return;

    const promo: Promotion = {
      id: editId || uid(),
      name: name.trim(),
      type,
      discountPercent,
      startTime: type === "happy-hour" ? startTime : undefined,
      endTime: type === "happy-hour" ? endTime : undefined,
      daysOfWeek: type === "weekend" ? daysOfWeek : undefined,
      couponCode: type === "coupon" ? couponCode.trim().toUpperCase() : undefined,
      maxUses: maxUses || undefined,
      usedCount: editId ? (promotions.find(p => p.id === editId)?.usedCount ?? 0) : 0,
      validFrom: validFrom ? new Date(validFrom).getTime() : Date.now(),
      validTo: validTo ? new Date(validTo).getTime() : Date.now() + 30 * 86400000,
      isActive: true,
    };

    if (editId) {
      setPromotions(prev => prev.map(p => p.id === editId ? promo : p));
    } else {
      setPromotions(prev => [...prev, promo]);
    }
    notify(t.saved);
    resetForm();
  }

  function toggleActive(id: string) {
    setPromotions(prev =>
      prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p)
    );
  }

  function deletePromo(id: string) {
    setPromotions(prev => prev.filter(p => p.id !== id));
    notify(t.deleted);
  }

  function toggleDay(day: number) {
    setDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  const typeBadge = (pt: PromotionType) => {
    const map: Record<PromotionType, { bg: string; label: string }> = {
      "happy-hour": { bg: "var(--yellow)", label: t.happyHour },
      "weekend": { bg: "var(--blue)", label: t.weekendDeal },
      "coupon": { bg: "var(--accent)", label: t.coupon },
    };
    return map[pt];
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(isRTL ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="anim-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: "1.2em" }}>
          {t.promotions}
        </h2>
        {isManager && !showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ fontSize: "0.9em" }}>
            + {t.addPromotion}
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Name */}
          <input
            className="input"
            placeholder={t.promotions}
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: "100%" }}
          />

          {/* Type selector */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["happy-hour", "weekend", "coupon"] as PromotionType[]).map(pt => {
              const badge = typeBadge(pt);
              const selected = type === pt;
              return (
                <button
                  key={pt}
                  className="btn"
                  onClick={() => setType(pt)}
                  style={{
                    background: selected ? `color-mix(in srgb, ${badge.bg} 20%, transparent)` : "var(--surface)",
                    border: `1.5px solid ${selected ? badge.bg : "var(--border)"}`,
                    color: selected ? badge.bg : "var(--text2)",
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {badge.label}
                </button>
              );
            })}
          </div>

          {/* Discount percent */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ color: "var(--text2)", minWidth: 90, fontSize: "0.9em" }}>{t.discountPercent}</label>
            <input
              className="input"
              type="number"
              min={1}
              max={100}
              value={discountPercent}
              onChange={e => setDiscountPercent(Number(e.target.value))}
              style={{ width: 80 }}
            />
            <span style={{ color: "var(--text2)" }}>%</span>
          </div>

          {/* Happy hour: time range */}
          {type === "happy-hour" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ color: "var(--text2)", fontSize: "0.85em" }}>{t.startTimeLabel}</label>
                <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ color: "var(--text2)", fontSize: "0.85em" }}>{t.endTimeLabel}</label>
                <input className="input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          {/* Weekend: days of week */}
          {type === "weekend" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {dayLabels.map((label, i) => (
                <button
                  key={i}
                  className="btn"
                  onClick={() => toggleDay(i)}
                  style={{
                    background: daysOfWeek.includes(i) ? "color-mix(in srgb, var(--blue) 20%, transparent)" : "var(--surface)",
                    border: `1.5px solid ${daysOfWeek.includes(i) ? "var(--blue)" : "var(--border)"}`,
                    color: daysOfWeek.includes(i) ? "var(--blue)" : "var(--text2)",
                    padding: "4px 10px",
                    fontSize: "0.85em",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Coupon code */}
          {type === "coupon" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ color: "var(--text2)", minWidth: 90, fontSize: "0.9em" }}>{t.couponCode}</label>
              <input
                className="input"
                placeholder="SAVE20"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value)}
                style={{ width: 160, fontFamily: "monospace", textTransform: "uppercase" }}
              />
            </div>
          )}

          {/* Max uses */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ color: "var(--text2)", minWidth: 90, fontSize: "0.9em" }}>
              {isRTL ? "الحد الأقصى" : "Max Uses"}
            </label>
            <input
              className="input"
              type="number"
              min={0}
              placeholder={isRTL ? "غير محدود" : "Unlimited"}
              value={maxUses ?? ""}
              onChange={e => setMaxUses(e.target.value ? Number(e.target.value) : undefined)}
              style={{ width: 100 }}
            />
          </div>

          {/* Valid dates */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ color: "var(--text2)", fontSize: "0.85em" }}>{t.validFrom}</label>
              <input className="input" type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ color: "var(--text2)", fontSize: "0.85em" }}>{t.validTo}</label>
              <input className="input" type="date" value={validTo} onChange={e => setValidTo(e.target.value)} />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={resetForm}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
              {t.save}
            </button>
          </div>
        </div>
      )}

      {/* Promotions list */}
      {promotions.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>
          {t.noPromotions}
        </div>
      )}

      {promotions.map(p => {
        const badge = typeBadge(p.type);
        const isExpired = p.validTo < Date.now();
        return (
          <div
            key={p.id}
            className="card"
            style={{
              padding: 14,
              opacity: p.isActive && !isExpired ? 1 : 0.55,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* Top row: name + badge + toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: "1.05em" }}>{p.name}</span>
                <span
                  className="badge"
                  style={{
                    background: `color-mix(in srgb, ${badge.bg} 18%, transparent)`,
                    color: badge.bg,
                    border: `1px solid color-mix(in srgb, ${badge.bg} 30%, transparent)`,
                    fontSize: "0.75em",
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                >
                  {badge.label}
                </span>
                {isExpired && (
                  <span style={{ fontSize: "0.75em", color: "var(--red)" }}>
                    {isRTL ? "منتهي" : "Expired"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Toggle switch */}
                <button
                  onClick={() => toggleActive(p.id)}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    border: "none",
                    background: p.isActive ? "var(--green)" : "var(--border)",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      [p.isActive ? (isRTL ? "right" : "left") : (isRTL ? "left" : "right")]: p.isActive ? "auto" : 2,
                      [p.isActive ? (isRTL ? "left" : "right") : (isRTL ? "right" : "left")]: p.isActive ? 2 : "auto",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "white",
                      transition: "all 0.2s",
                      insetInlineStart: p.isActive ? "auto" : 2,
                      insetInlineEnd: p.isActive ? 2 : "auto",
                    }}
                  />
                </button>
                {isManager && (
                  <>
                    <button className="btn" style={{ padding: "2px 8px", fontSize: "0.8em" }} onClick={() => openEdit(p)}>
                      {t.edit}
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: "2px 8px", fontSize: "0.8em" }}
                      onClick={() => deletePromo(p.id)}
                    >
                      {t.delete}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Details */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: "0.85em", color: "var(--text2)" }}>
              <span style={{ color: "var(--green)", fontWeight: 600 }}>
                {p.discountPercent}% {isRTL ? "خصم" : "off"}
              </span>

              {p.type === "happy-hour" && p.startTime && p.endTime && (
                <span>{p.startTime} — {p.endTime}</span>
              )}

              {p.type === "weekend" && p.daysOfWeek && p.daysOfWeek.length > 0 && (
                <span>{p.daysOfWeek.map(d => dayLabels[d]).join(", ")}</span>
              )}

              {p.type === "coupon" && p.couponCode && (
                <span style={{
                  fontFamily: "monospace",
                  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  padding: "1px 6px",
                  borderRadius: 4,
                  color: "var(--accent)",
                }}>
                  {p.couponCode}
                </span>
              )}

              <span>
                {formatDate(p.validFrom)} — {formatDate(p.validTo)}
              </span>

              {p.maxUses != null && (
                <span>
                  {p.usedCount}/{p.maxUses} {isRTL ? "استخدام" : "uses"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
