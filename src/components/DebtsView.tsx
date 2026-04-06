"use client";

import { useState } from "react";
import type { Debt, UserRole } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { uid, fmtMoney, fmtDate, fmtTime } from "@/lib/utils";
import SarSymbol from "./SarSymbol";
import { printDebt } from "@/lib/printReceipt";

interface Props {
  debts: Debt[];
  setDebts: React.Dispatch<React.SetStateAction<Debt[]>>;
  role: UserRole;
  notify: (msg: string) => void;
  settings: SystemSettings;
  logo?: string | null;
}

export default function DebtsView({ debts, setDebts, role, notify, settings, logo }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [expandedDebt, setExpandedDebt] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"unpaid" | "paid" | "all">("unpaid");
  const [newDebt, setNewDebt] = useState({ name: "", phone: "", amount: "", note: "" });
  const [payAmt, setPayAmt] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");

  const t = T[settings.lang];
  const isManager = role === "manager";

  const filtered = debts
    .filter((d) => filter === "all" ? true : filter === "unpaid" ? !d.paid : d.paid)
    .filter((d) => !search || d.name.includes(search) || d.phone?.includes(search));

  const totalUnpaid = debts.filter((d) => !d.paid).reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  const addDebt = () => {
    if (!newDebt.name || !Number(newDebt.amount)) return;
    setDebts((p) => [...p, {
      id: uid(), name: newDebt.name, phone: newDebt.phone, amount: Number(newDebt.amount),
      paidAmount: 0, payments: [], note: newDebt.note, date: Date.now(), paid: false,
    }]);
    setNewDebt({ name: "", phone: "", amount: "", note: "" });
    setShowForm(false);
    notify(t.debtAdded + " ✓");
  };

  const addPayment = (debtId: string) => {
    const amt = Number(payAmt);
    if (!amt || amt <= 0) return;
    setDebts((p) => p.map((d) => {
      if (d.id !== debtId) return d;
      const newPaid = d.paidAmount + amt;
      const isPaid = newPaid >= d.amount;
      return {
        ...d,
        paidAmount: Math.min(newPaid, d.amount),
        paid: isPaid,
        payments: [...d.payments, { id: uid(), amount: amt, date: Date.now(), method: payMethod, note: payNote }],
      };
    }));
    setPayAmt(""); setPayNote(""); setShowPayment(null);
    notify(t.paymentRecorded + " ✓");
  };

  const deleteDebt = (id: string) => {
    if (!isManager) return;
    if (confirm(settings.lang === "ar" ? "حذف هذا الدين؟" : "Delete this debt?")) {
      setDebts((p) => p.filter((d) => d.id !== id));
      notify(t.deleted + " ✓");
    }
  };

  const filterLabels: Record<string, string> = { unpaid: t.unpaid, paid: t.paid, all: t.all };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>💰 {t.debts}</h2>
        <div className="badge px-3 py-1.5" style={{ background: "color-mix(in srgb, var(--red) 12%, transparent)", color: "var(--red)" }}>
          <span className="text-sm font-bold">{fmtMoney(totalUnpaid)} <SarSymbol /></span>
        </div>
      </div>

      {/* Search */}
      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder={"🔍 " + t.search}
        className="input w-full mb-3" />

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(["unpaid", "paid", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="btn px-4 py-2 text-xs"
            style={{
              background: filter === f ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--input-bg)",
              color: filter === f ? "var(--accent)" : "var(--text2)",
              borderColor: filter === f ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "var(--border)",
            }}>
            {filterLabels[f]} {f === "unpaid" ? `(${debts.filter((d) => !d.paid).length})` : ""}
          </button>
        ))}
      </div>

      {/* Add Button */}
      <button onClick={() => setShowForm(true)}
        className="btn w-full py-3 text-sm mb-4"
        style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)" }}>
        + {t.addDebt}
      </button>

      {/* Add Debt Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="card p-6 w-full max-w-sm anim-scale" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-bold mb-5" style={{ color: "var(--text)" }}>💰 {t.addDebt}</div>
            <div className="mb-3">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.custName} *</label>
              <input type="text" value={newDebt.name} onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })}
                placeholder={t.custName + "..."} className="input" />
            </div>
            <div className="mb-3">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.phone}</label>
              <input type="tel" value={newDebt.phone} onChange={(e) => setNewDebt({ ...newDebt, phone: e.target.value })}
                placeholder="05XXXXXXXX" className="input" dir="ltr" />
            </div>
            <div className="mb-3">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.amount} ({t.sar}) *</label>
              <input type="number" value={newDebt.amount} onChange={(e) => setNewDebt({ ...newDebt, amount: e.target.value })}
                placeholder="0" className="input" />
            </div>
            <div className="mb-5">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.note}</label>
              <input type="text" value={newDebt.note} onChange={(e) => setNewDebt({ ...newDebt, note: e.target.value })}
                placeholder={t.note + "..."} className="input" />
            </div>
            <div className="flex gap-2">
              <button onClick={addDebt} className="btn btn-primary flex-1 py-3 text-sm">{t.save}</button>
              <button onClick={() => setShowForm(false)} className="btn btn-ghost py-3 px-5 text-sm">{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* Debts List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--text2)", opacity: 0.4 }}>{filter === "unpaid" ? t.noDebts + " 🎉" : t.noDebts}</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((d) => {
            const remaining = d.amount - d.paidAmount;
            const progress = d.amount > 0 ? (d.paidAmount / d.amount) * 100 : 0;
            return (
              <div key={d.id} className="card overflow-hidden"
                style={d.paid
                  ? { borderColor: "color-mix(in srgb, var(--green) 20%, transparent)" }
                  : { borderColor: "color-mix(in srgb, var(--red) 20%, transparent)" }
                }>
                <div className="p-4 cursor-pointer" onClick={() => setExpandedDebt(expandedDebt === d.id ? null : d.id)}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm" style={{ color: "var(--text)" }}>{d.name}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--text2)" }}>
                        {d.phone && `📱 ${d.phone} • `}{d.note && `${d.note} • `}{fmtDate(d.date)}
                      </div>
                    </div>
                    <div>
                      {d.paid ? (
                        <span className="badge px-2 py-1 text-xs" style={{ background: "color-mix(in srgb, var(--green) 12%, transparent)", color: "var(--green)" }}>✓ {t.paid}</span>
                      ) : (
                        <span className="font-bold text-sm" style={{ color: "var(--red)" }}>{fmtMoney(remaining)} <SarSymbol /></span>
                      )}
                    </div>
                  </div>
                  {/* Progress bar for partial payments */}
                  {!d.paid && d.paidAmount > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] mb-1" style={{ color: "var(--text2)" }}>
                        <span>{t.paid}: {fmtMoney(d.paidAmount)} <SarSymbol /></span>
                        <span>{t.totalDebt}: {fmtMoney(d.amount)} <SarSymbol /></span>
                      </div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%`, background: "var(--green)" }} /></div>
                    </div>
                  )}
                </div>

                {/* Expanded: Payment history + actions */}
                {expandedDebt === d.id && (
                  <div className="p-4 pt-0 anim-fade">
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                      {/* Payment history */}
                      {d.payments && d.payments.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-medium mb-2" style={{ color: "var(--text2)" }}>{t.payHistory}:</div>
                          {d.payments.map((p) => (
                            <div key={p.id} className="flex justify-between text-xs mb-1" style={{ color: "var(--text2)" }}>
                              <span>{fmtDate(p.date)} {fmtTime(p.date)} • {p.method === "cash" ? "💵" : p.method === "card" ? "💳" : "📲"} {p.note && `• ${p.note}`}</span>
                              <span className="font-bold" style={{ color: "var(--green)" }}>{fmtMoney(p.amount)} <SarSymbol /></span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {!d.paid && (
                          <>
                            <button onClick={() => { setShowPayment(showPayment === d.id ? null : d.id); setPayAmt(String(remaining)); }}
                              className="btn btn-success flex-1 py-2.5 text-xs">
                              💵 {t.pay}
                            </button>
                            <button onClick={() => {
                              setDebts((p) => p.map((x) => x.id === d.id ? { ...x, paid: true, paidAmount: x.amount, payments: [...x.payments, { id: uid(), amount: remaining, date: Date.now(), method: "cash", note: settings.lang === "ar" ? "سداد كامل" : "Full payment" }] } : x));
                              notify(t.done + " ✓");
                            }}
                              className="btn py-2.5 px-4 text-xs"
                              style={{ background: "color-mix(in srgb, var(--blue) 12%, transparent)", color: "var(--blue)", borderColor: "color-mix(in srgb, var(--blue) 20%, transparent)" }}>
                              ✓ {t.fullPay}
                            </button>
                          </>
                        )}
                        <button onClick={() => printDebt({ name: d.name, phone: d.phone, amount: d.amount, paidAmount: d.paidAmount, remaining, note: d.note, date: d.date, logo }, "thermal")}
                          className="btn py-2.5 px-3 text-xs" style={{ color: "var(--text2)", borderColor: "var(--border)" }}>🖨️</button>
                        <button onClick={() => printDebt({ name: d.name, phone: d.phone, amount: d.amount, paidAmount: d.paidAmount, remaining, note: d.note, date: d.date, logo }, "a4")}
                          className="btn py-2.5 px-3 text-xs" style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)" }}>📄</button>
                        {isManager && (
                          <button onClick={() => deleteDebt(d.id)}
                            className="btn btn-danger py-2.5 px-4 text-xs">🗑</button>
                        )}
                      </div>

                      {/* Partial Payment Form */}
                      {showPayment === d.id && (
                        <div className="mt-3 card p-4 anim-fade">
                          <div className="text-xs font-medium mb-2" style={{ color: "var(--text2)" }}>{t.pay}</div>
                          <div className="flex gap-2 mb-2">
                            <input type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)}
                              placeholder={t.amount} className="input flex-1" />
                            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                              className="input" style={{ width: "auto" }}>
                              <option value="cash">💵 {t.cash}</option>
                              <option value="card">💳 {t.card}</option>
                              <option value="transfer">📲 {t.transfer}</option>
                            </select>
                          </div>
                          <input type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)}
                            placeholder={t.note + "..."} className="input mb-3" />
                          <button onClick={() => addPayment(d.id)}
                            className="btn btn-success w-full py-2.5 text-sm">{t.pay} {payAmt ? fmtMoney(Number(payAmt)) : ""} {payAmt && <SarSymbol />}</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
