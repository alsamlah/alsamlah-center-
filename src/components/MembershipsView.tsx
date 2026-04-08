"use client";

import { useState, useEffect } from "react";
import type { MembershipPlan, MembershipPlanType, Membership, Customer } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { uid, fmtMoney, fmtDate } from "@/lib/utils";
import SarSymbol from "./SarSymbol";

interface MembershipsViewProps {
  membershipPlans: MembershipPlan[];
  setMembershipPlans: (fn: (prev: MembershipPlan[]) => MembershipPlan[]) => void;
  memberships: Membership[];
  setMemberships: (fn: (prev: Membership[]) => Membership[]) => void;
  customers: Customer[];
  isManager: boolean;
  settings: SystemSettings;
  notify: (msg: string) => void;
}

const EMPTY_PLAN = {
  name: "",
  type: "monthly" as MembershipPlanType,
  price: "",
  totalHours: "",
  durationDays: "30",
  discountPercent: "",
  isActive: true,
};

export default function MembershipsView({
  membershipPlans,
  setMembershipPlans,
  memberships,
  setMemberships,
  customers,
  isManager,
  settings,
  notify,
}: MembershipsViewProps) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const [tab, setTab] = useState<"active" | "plans">("active");
  const [search, setSearch] = useState("");
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN);
  const [subCustomerName, setSubCustomerName] = useState("");
  const [subPhone, setSubPhone] = useState("");
  const [subEmail, setSubEmail] = useState("");
  const [subPlanId, setSubPlanId] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);

  // Auto-expiry check on mount and whenever memberships change
  useEffect(() => {
    const now = Date.now();
    let changed = false;
    setMemberships((prev) =>
      prev.map((m) => {
        if (m.status !== "active") return m;
        // Monthly: check endDate
        if (m.endDate && now > m.endDate) {
          changed = true;
          return { ...m, status: "expired" as const };
        }
        // Hours: check usedHours >= totalHours
        if (m.totalHours && m.usedHours >= m.totalHours) {
          changed = true;
          return { ...m, status: "depleted" as const };
        }
        return m;
      })
    );
    if (changed) notify(isRTL ? "تم تحديث حالة العضويات" : "Membership statuses updated");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = memberships.filter(
    (m) =>
      !search ||
      m.customerName.toLowerCase().includes(search.toLowerCase()) ||
      m.planName.toLowerCase().includes(search.toLowerCase())
  );

  const activePlans = membershipPlans.filter((p) => p.isActive);

  // ── Plan CRUD ──
  const savePlan = () => {
    if (!planForm.name.trim()) { notify(isRTL ? "أدخل اسم الخطة" : "Enter plan name"); return; }
    if (!Number(planForm.price)) { notify(isRTL ? "أدخل سعر الخطة" : "Enter plan price"); return; }
    const plan: MembershipPlan = {
      id: editingPlanId || uid(),
      name: planForm.name,
      type: planForm.type,
      price: Number(planForm.price),
      totalHours: planForm.type === "hours" ? Number(planForm.totalHours) || undefined : undefined,
      durationDays: planForm.type === "monthly" ? Number(planForm.durationDays) || 30 : undefined,
      discountPercent: Number(planForm.discountPercent) || undefined,
      isActive: planForm.isActive,
    };
    if (editingPlanId) {
      setMembershipPlans((prev) => prev.map((p) => (p.id === editingPlanId ? plan : p)));
      notify(t.save + " ✓");
    } else {
      setMembershipPlans((prev) => [...prev, plan]);
      notify(t.addPlan + " ✓");
    }
    setPlanForm(EMPTY_PLAN);
    setEditingPlanId(null);
    setShowPlanForm(false);
  };

  const editPlan = (plan: MembershipPlan) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      name: plan.name,
      type: plan.type,
      price: String(plan.price),
      totalHours: plan.totalHours ? String(plan.totalHours) : "",
      durationDays: plan.durationDays ? String(plan.durationDays) : "30",
      discountPercent: plan.discountPercent ? String(plan.discountPercent) : "",
      isActive: plan.isActive,
    });
    setShowPlanForm(true);
  };

  const deletePlan = (id: string) => {
    if (!isManager) return;
    if (confirm(isRTL ? "حذف هذه الخطة؟" : "Delete this plan?")) {
      setMembershipPlans((prev) => prev.filter((p) => p.id !== id));
      notify(t.delete + " ✓");
    }
  };

  // ── Subscribe ──
  const handleSubscribe = () => {
    if (!subCustomerName.trim()) { notify(isRTL ? "أدخل اسم العميل" : "Enter customer name"); return; }
    if (!subPhone.trim()) { notify(isRTL ? "أدخل رقم الجوال" : "Enter phone number"); return; }
    if (!subPlanId) { notify(isRTL ? "اختر خطة" : "Select a plan"); return; }
    const plan = membershipPlans.find((p) => p.id === subPlanId);
    if (!plan) return;

    const existing = customers.find(
      (c) => c.name.toLowerCase() === subCustomerName.trim().toLowerCase()
    );

    const now = Date.now();
    const membership: Membership = {
      id: uid(),
      customerId: existing?.id || uid(),
      customerName: subCustomerName.trim(),
      customerPhone: subPhone.trim(),
      customerEmail: subEmail.trim() || undefined,
      planId: plan.id,
      planName: plan.name,
      startDate: now,
      endDate:
        plan.type === "monthly" && plan.durationDays
          ? now + plan.durationDays * 24 * 60 * 60 * 1000
          : undefined,
      totalHours: plan.type === "hours" ? plan.totalHours : undefined,
      usedHours: 0,
      remainingHours: plan.type === "hours" ? plan.totalHours : undefined,
      status: "active",
      purchasedAt: now,
      purchasedBy: "cashier",
    };

    setMemberships((prev) => [...prev, membership]);
    setSubCustomerName("");
    setSubPhone("");
    setSubEmail("");
    setSubPlanId("");
    setShowSubscribe(false);
    notify(t.subscribeMember + " ✓");
  };

  const onCustomerInput = (val: string) => {
    setSubCustomerName(val);
    if (val.length >= 1) {
      setCustomerSuggestions(
        customers.filter((c) => c.name.toLowerCase().includes(val.toLowerCase())).slice(0, 5)
      );
    } else {
      setCustomerSuggestions([]);
    }
  };

  const statusColor = (s: Membership["status"]) =>
    s === "active"
      ? "var(--green)"
      : s === "expired"
      ? "var(--red)"
      : "var(--yellow)";

  const statusLabel = (s: Membership["status"]) =>
    s === "active" ? t.activePlan : s === "expired" ? t.expired : t.depleted;

  const daysRemaining = (endDate: number) => {
    const diff = endDate - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span style={{ fontSize: "1.3rem" }}>🏅</span>
        {t.memberships}
      </h2>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "0.5rem",
        }}
      >
        <button
          onClick={() => setTab("active")}
          className="btn"
          style={{
            background: tab === "active" ? "var(--accent)" : "transparent",
            color: tab === "active" ? "#fff" : "var(--text2)",
            border: "none",
            fontWeight: tab === "active" ? 600 : 400,
          }}
        >
          {t.memberships}
        </button>
        {isManager && (
          <button
            onClick={() => setTab("plans")}
            className="btn"
            style={{
              background: tab === "plans" ? "var(--accent)" : "transparent",
              color: tab === "plans" ? "#fff" : "var(--text2)",
              border: "none",
              fontWeight: tab === "plans" ? 600 : 400,
            }}
          >
            {t.membershipPlans}
          </button>
        )}
      </div>

      {/* ═══ Active Memberships Tab ═══ */}
      {tab === "active" && (
        <div>
          {/* Search + Subscribe */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder={t.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: "180px" }}
            />
            <button
              className="btn btn-primary"
              onClick={() => setShowSubscribe(true)}
              style={{ whiteSpace: "nowrap" }}
            >
              + {t.subscribeMember}
            </button>
          </div>

          {/* Subscribe Form */}
          {showSubscribe && (
            <div
              className="card anim-fade-up"
              style={{ marginBottom: "1rem", padding: "1rem", position: "relative" }}
            >
              <h3
                style={{
                  fontWeight: 600,
                  color: "var(--text)",
                  marginBottom: "0.75rem",
                  fontSize: "1.05rem",
                }}
              >
                {t.subscribeMember}
              </h3>

              {/* Customer name with suggestions */}
              <div style={{ position: "relative", marginBottom: "0.75rem" }}>
                <input
                  className="input"
                  placeholder={isRTL ? "اسم العميل" : "Customer name"}
                  value={subCustomerName}
                  onChange={(e) => onCustomerInput(e.target.value)}
                  style={{ width: "100%" }}
                />
                {customerSuggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      zIndex: 10,
                      maxHeight: "150px",
                      overflowY: "auto",
                    }}
                  >
                    {customerSuggestions.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSubCustomerName(c.name);
                          if (c.phone) setSubPhone(c.phone);
                          setCustomerSuggestions([]);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          textAlign: isRTL ? "right" : "left",
                          background: "transparent",
                          border: "none",
                          color: "var(--text)",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 12%, transparent)")
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {c.name} {c.phone && <span style={{ color: "var(--text2)" }}>({c.phone})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="text-xs font-bold" style={{ color: "var(--text2)", display: "block", marginBottom: 4 }}>{t.phone} *</label>
                <input
                  className="input"
                  type="tel"
                  placeholder={isRTL ? "05xxxxxxxx" : "05xxxxxxxx"}
                  value={subPhone}
                  onChange={(e) => setSubPhone(e.target.value)}
                  style={{ width: "100%", ...(subPhone.trim() ? {} : { borderColor: "color-mix(in srgb, var(--red) 30%, var(--border))" }) }}
                  dir="ltr"
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="text-xs font-bold" style={{ color: "var(--text2)", display: "block", marginBottom: 4 }}>{isRTL ? "الإيميل" : "Email"}</label>
                <input
                  className="input"
                  type="email"
                  placeholder="example@email.com"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  style={{ width: "100%" }}
                  dir="ltr"
                />
              </div>

              {/* Plan selector */}
              <select
                className="input"
                value={subPlanId}
                onChange={(e) => setSubPlanId(e.target.value)}
                style={{ width: "100%", marginBottom: "0.75rem" }}
              >
                <option value="">{isRTL ? "اختر خطة..." : "Select plan..."}</option>
                {activePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {fmtMoney(p.price)} <SarSymbol size={12} /> (
                    {p.type === "monthly" ? t.monthlyPlan : t.hoursPlan})
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-primary" onClick={handleSubscribe}>
                  {t.save}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowSubscribe(false);
                    setSubCustomerName("");
                    setSubPhone("");
                    setSubEmail("");
                    setSubPlanId("");
                    setCustomerSuggestions([]);
                  }}
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}

          {/* Memberships List */}
          {filtered.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 1rem",
                color: "var(--text2)",
                fontSize: "1rem",
              }}
            >
              🏅 {t.noMemberships}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {filtered.map((m) => (
                <div
                  key={m.id}
                  className="card anim-fade"
                  style={{ padding: "1rem" }}
                >
                  {/* Top row: name + badge */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "1rem" }}>
                        {m.customerName}
                      </span>
                      <span
                        style={{
                          marginInlineStart: "0.5rem",
                          color: "var(--text2)",
                          fontSize: "0.85rem",
                        }}
                      >
                        {m.planName}
                      </span>
                      {(m.customerPhone || m.customerEmail) && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginTop: 2 }}>
                          {m.customerPhone && <span dir="ltr">📱 {m.customerPhone}</span>}
                          {m.customerPhone && m.customerEmail && <span style={{ margin: "0 6px" }}>|</span>}
                          {m.customerEmail && <span dir="ltr">✉️ {m.customerEmail}</span>}
                        </div>
                      )}
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: `color-mix(in srgb, ${statusColor(m.status)} 15%, transparent)`,
                        color: statusColor(m.status),
                        fontWeight: 600,
                        fontSize: "0.78rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "999px",
                      }}
                    >
                      {statusLabel(m.status)}
                    </span>
                  </div>

                  {/* Hours-based membership */}
                  {m.totalHours != null && (
                    <div style={{ marginBottom: "0.5rem" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.82rem",
                          color: "var(--text2)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span>
                          {t.usedHours}: {m.usedHours}h
                        </span>
                        <span>
                          {t.remainingHours}: {Math.max(0, m.totalHours - m.usedHours)}h / {m.totalHours}h
                        </span>
                      </div>
                      <div className="progress-bar" style={{ height: "6px", borderRadius: "3px" }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(100, (m.usedHours / m.totalHours) * 100)}%`,
                            background:
                              m.usedHours >= m.totalHours
                                ? "var(--red)"
                                : m.usedHours / m.totalHours > 0.8
                                ? "var(--yellow)"
                                : "var(--green)",
                            borderRadius: "3px",
                            transition: "width 0.3s",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Monthly-based membership */}
                  {m.endDate != null && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.82rem",
                        color: "var(--text2)",
                      }}
                    >
                      <span>
                        {fmtDate(m.startDate)} → {fmtDate(m.endDate)}
                      </span>
                      <span
                        style={{
                          color: daysRemaining(m.endDate) <= 3 ? "var(--red)" : "var(--text2)",
                          fontWeight: daysRemaining(m.endDate) <= 3 ? 600 : 400,
                        }}
                      >
                        {daysRemaining(m.endDate)} {isRTL ? "يوم" : "days"}
                      </span>
                    </div>
                  )}

                  {/* Purchase info */}
                  <div
                    style={{
                      marginTop: "0.4rem",
                      fontSize: "0.78rem",
                      color: "var(--text2)",
                      opacity: 0.7,
                    }}
                  >
                    {fmtDate(m.purchasedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Plans Tab (manager only) ═══ */}
      {tab === "plans" && isManager && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setPlanForm(EMPTY_PLAN);
                setEditingPlanId(null);
                setShowPlanForm(true);
              }}
            >
              + {t.addPlan}
            </button>
          </div>

          {/* Plan Form */}
          {showPlanForm && (
            <div
              className="card anim-fade-up"
              style={{ marginBottom: "1rem", padding: "1rem" }}
            >
              <h3
                style={{
                  fontWeight: 600,
                  color: "var(--text)",
                  marginBottom: "0.75rem",
                  fontSize: "1.05rem",
                }}
              >
                {editingPlanId ? t.planName : t.addPlan}
              </h3>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                {/* Name */}
                <div>
                  <label className="text-xs font-bold" style={{ color: "var(--text2)", display: "block", marginBottom: 4 }}>{t.planName} *</label>
                  <input
                    className="input"
                    placeholder={isRTL ? "مثال: باقة شهرية ذهبية" : "e.g. Gold Monthly Plan"}
                    value={planForm.name}
                    onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
                    style={!planForm.name.trim() ? { borderColor: "color-mix(in srgb, var(--red) 30%, var(--border))" } : {}}
                  />
                </div>

                {/* Type */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn"
                    onClick={() => setPlanForm((p) => ({ ...p, type: "monthly" }))}
                    style={{
                      flex: 1,
                      background:
                        planForm.type === "monthly"
                          ? "color-mix(in srgb, var(--blue) 20%, transparent)"
                          : "transparent",
                      color: planForm.type === "monthly" ? "var(--blue)" : "var(--text2)",
                      borderColor:
                        planForm.type === "monthly" ? "var(--blue)" : "var(--border)",
                      fontWeight: planForm.type === "monthly" ? 600 : 400,
                    }}
                  >
                    📅 {t.monthlyPlan}
                  </button>
                  <button
                    className="btn"
                    onClick={() => setPlanForm((p) => ({ ...p, type: "hours" }))}
                    style={{
                      flex: 1,
                      background:
                        planForm.type === "hours"
                          ? "color-mix(in srgb, var(--blue) 20%, transparent)"
                          : "transparent",
                      color: planForm.type === "hours" ? "var(--blue)" : "var(--text2)",
                      borderColor:
                        planForm.type === "hours" ? "var(--blue)" : "var(--border)",
                      fontWeight: planForm.type === "hours" ? 600 : 400,
                    }}
                  >
                    ⏱️ {t.hoursPlan}
                  </button>
                </div>

                {/* Price */}
                <div>
                  <label className="text-xs font-bold" style={{ color: "var(--text2)", display: "block", marginBottom: 4 }}>{t.planPrice} *</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type="number"
                    placeholder={isRTL ? "مثال: 200" : "e.g. 200"}
                    value={planForm.price}
                    onChange={(e) => setPlanForm((p) => ({ ...p, price: e.target.value }))}
                    style={{ width: "100%", paddingInlineEnd: "2rem" }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: "50%",
                      transform: "translateY(-50%)",
                      [isRTL ? "left" : "right"]: "0.75rem",
                      color: "var(--text2)",
                    }}
                  >
                    <SarSymbol size={14} />
                  </span>
                </div>
                </div>

                {/* Hours (if hours type) */}
                {planForm.type === "hours" && (
                  <input
                    className="input"
                    type="number"
                    placeholder={t.totalHours}
                    value={planForm.totalHours}
                    onChange={(e) => setPlanForm((p) => ({ ...p, totalHours: e.target.value }))}
                  />
                )}

                {/* Duration (if monthly type) */}
                {planForm.type === "monthly" && (
                  <input
                    className="input"
                    type="number"
                    placeholder={t.durationDays}
                    value={planForm.durationDays}
                    onChange={(e) => setPlanForm((p) => ({ ...p, durationDays: e.target.value }))}
                  />
                )}

                {/* Discount */}
                <input
                  className="input"
                  type="number"
                  placeholder={t.discountPct}
                  value={planForm.discountPercent}
                  onChange={(e) => setPlanForm((p) => ({ ...p, discountPercent: e.target.value }))}
                  min={0}
                  max={100}
                />

                {/* Active toggle */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "var(--text)",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={planForm.isActive}
                    onChange={(e) => setPlanForm((p) => ({ ...p, isActive: e.target.checked }))}
                    style={{ accentColor: "var(--green)" }}
                  />
                  {t.activePlan}
                </label>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-primary" onClick={savePlan}>
                    {t.save}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowPlanForm(false);
                      setEditingPlanId(null);
                      setPlanForm(EMPTY_PLAN);
                    }}
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Plans List */}
          {membershipPlans.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 1rem",
                color: "var(--text2)",
                fontSize: "1rem",
              }}
            >
              📋 {t.noPlans}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {membershipPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="card anim-fade"
                  style={{
                    padding: "1rem",
                    opacity: plan.isActive ? 1 : 0.5,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.1rem" }}>
                        {plan.type === "monthly" ? "📅" : "⏱️"}
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "1rem" }}>
                        {plan.name}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: `color-mix(in srgb, var(--blue) 12%, transparent)`,
                          color: "var(--blue)",
                          fontSize: "0.75rem",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "999px",
                        }}
                      >
                        {plan.type === "monthly" ? t.monthlyPlan : t.hoursPlan}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => editPlan(plan)}
                        style={{ padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => deletePlan(plan.id)}
                        style={{
                          padding: "0.3rem 0.5rem",
                          fontSize: "0.85rem",
                          color: "var(--red)",
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      flexWrap: "wrap",
                      fontSize: "0.85rem",
                      color: "var(--text2)",
                    }}
                  >
                    <span>
                      {t.planPrice}: {fmtMoney(plan.price)} <SarSymbol size={12} />
                    </span>
                    {plan.type === "hours" && plan.totalHours && (
                      <span>
                        {t.totalHours}: {plan.totalHours}h
                      </span>
                    )}
                    {plan.type === "monthly" && plan.durationDays && (
                      <span>
                        {t.durationDays}: {plan.durationDays}
                      </span>
                    )}
                    {plan.discountPercent != null && plan.discountPercent > 0 && (
                      <span style={{ color: "var(--green)" }}>
                        {t.discountPct}: {plan.discountPercent}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
