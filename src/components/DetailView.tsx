"use client";

import { useState } from "react";
import type { Session, MenuItem, OrderItem, Floor, Zone, CalcResult, Customer } from "@/lib/supabase";
import { getTier, getTierInfo } from "./CustomersView";
import type { SystemSettings } from "@/lib/settings";
import { DURATION_OPTS, PLAYER_COUNTS, MATCH_ZONE_ID, ROOM_10_ID, MATCH_PRICE } from "@/lib/defaults";
import { T } from "@/lib/settings";
import { fmtTime, fmtMoney, fmtD } from "@/lib/utils";
import SarSymbol from "./SarSymbol";
import { printSession, type PrintType } from "@/lib/printReceipt";

interface ItemInfo { id: string; name: string; sub?: string; zone: Zone; floor: Floor; }

interface SwitchTarget { id: string; name: string; zoneName: string }
interface Props {
  itemId: string; info: ItemInfo; session: Session | null; orders: OrderItem[]; menu: MenuItem[]; calc: CalcResult | null;
  onBack: () => void; onStartSession: (id: string, name: string, dur: number, pc: number, type?: "ps" | "match" | "walkin", phone?: string) => void;
  onEndSession: (id: string, method: string, debt: number, disc: number, extra?: { payMethods?: Array<{method:string;amount:number}>; splitCount?: number }) => Promise<string | void> | void;
  onAddOrder: (id: string, item: MenuItem) => void; onRemoveOrder: (id: string, oid: string) => void;
  onAddGrace: (id: string, mins: number) => void; onUpdatePlayerCount: (id: string, c: number) => void;
  onUpdateManualPrice?: (id: string, price: number) => void;
  settings: SystemSettings;
  logo?: string | null;
  getInvoiceNo?: () => Promise<string | number>;
  customers?: Customer[];
  onHoldSession?: (id: string, discount: number, keepOccupied: boolean) => Promise<void> | void;
  switchTargets?: SwitchTarget[];
  onSwitchActivity?: (fromItemId: string, toItemId: string) => void;
  onPrepay?: (id: string, amount: number, method: string) => void;
}

export default function DetailView({ itemId, info, session, orders, menu, calc, onBack, onStartSession, onEndSession, onAddOrder, onRemoveOrder, onAddGrace, onUpdatePlayerCount, onUpdateManualPrice, settings, logo, getInvoiceNo, customers, onHoldSession, switchTargets, onSwitchActivity, onPrepay }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuCat, setMenuCat] = useState("");
  const [selDur, setSelDur] = useState(30);
  const [selPc, setSelPc] = useState(1);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [showSwitch, setShowSwitch] = useState(false);
  const [discount, setDiscount] = useState("");
  const [debtAmt, setDebtAmt] = useState("");
  const [sessionType, setSessionType] = useState<"ps" | "match">("ps");
  const [pendingPay, setPendingPay] = useState<{ method: string; debt: number; disc: number; payMethods?: Array<{method:string;amount:number}>; splitCount?: number } | null>(null);
  const [splitCount, setSplitCount] = useState(1);
  const [splitPayMode, setSplitPayMode] = useState(false);
  const [splitParts, setSplitParts] = useState<Array<{amount: string; method: "cash" | "card" | "credit" | "transfer"}>>([{ amount: "", method: "cash" }]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHold, setShowHold] = useState(false);
  const [holdDisc, setHoldDisc] = useState("");
  const [showPrepay, setShowPrepay] = useState(false);
  const [prepayMethod, setPrepayMethod] = useState("cash");

  const isRoomsZone = info.zone.id === MATCH_ZONE_ID;
  const isRoom10 = itemId === ROOM_10_ID;

  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const menuCats = [...new Set(menu.map((m) => m.cat))];
  const activeCat = menuCat || menuCats[0] || "";

  const isPerHit = info.zone.pricingMode === "per-hit";
  const isWalkin = info.zone.pricingMode === "walkin";
  const isManual = info.zone.pricingMode === "manual";
  const zoneTiers = info.zone.priceTiers ?? [];

  // Filter DURATION_OPTS to only show durations that have matching tiers for this zone
  const availableDurations = DURATION_OPTS.filter((d) => {
    if (d.mins === 0) return true; // "مفتوح" always available
    return zoneTiers.some((t) => t.minutes === d.mins);
  });

  // Build labels with prices
  const durLabelsWithPrice = availableDurations.map((d) => {
    const tier = zoneTiers.find((t) => t.minutes === d.mins);
    if (tier) return `${d.label}\n${tier.price} ﷼`;
    return d.label; // "مفتوح"
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="card w-10 h-10 flex items-center justify-center text-sm" style={{ color: "var(--text2)" }}>
          {isRTL ? "→" : "←"}
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>{info.zone.icon} {info.name}</h2>
          <p className="text-xs" style={{ color: "var(--text2)" }}>{info.zone.name} • {info.floor.name}</p>
        </div>
        {session && (session.playerCount || 0) > 0 && (
          <span className="badge px-3 py-1" style={{ background: "color-mix(in srgb, var(--blue) 12%, transparent)", color: "var(--blue)" }}>👤 {session.playerCount}</span>
        )}
      </div>

      {!session ? (
        /* ── Start Session Form ── */
        <div className="card p-6 anim-fade-up">
          <div className="text-base font-bold mb-5" style={{ color: "var(--text)" }}>
            {isWalkin ? "☕" : isManual ? "💆" : "🎮"} {isWalkin ? t.newWalkinOrder : isManual ? t.massageSession : t.startSession}
          </div>
          {/* Walk-in quick start — just customer name (optional) then go */}
          {(isWalkin || isManual) && (
            <div className="mb-4">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.custName} ({isRTL ? "اختياري" : "optional"})</label>
              <input type="text" placeholder={isWalkin ? (isRTL ? "اسم الزبون..." : "Customer name...") : (isRTL ? "اسم الزبون..." : "Customer name...")} value={custName} onChange={(e) => setCustName(e.target.value)} className="input mb-4" />
              <button onClick={() => onStartSession(itemId, custName, 0, 1, isWalkin ? "walkin" : "ps")}
                className="btn w-full py-4 text-base font-bold"
                style={{ background: isWalkin ? "color-mix(in srgb, var(--green) 15%, transparent)" : "color-mix(in srgb, var(--yellow) 15%, transparent)", color: isWalkin ? "var(--green)" : "var(--yellow)", borderColor: isWalkin ? "color-mix(in srgb, var(--green) 30%, transparent)" : "color-mix(in srgb, var(--yellow) 30%, transparent)" }}>
                {isWalkin ? "☕ " : "💆 "}{isWalkin ? t.newWalkinOrder : t.start}
              </button>
            </div>
          )}
          {!isWalkin && !isManual && (<>
          {/* Customer name with autocomplete */}
          <div className="mb-4 relative">
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.custName}</label>
            <input
              type="text"
              placeholder={t.custName + "..."}
              value={custName}
              onChange={(e) => { setCustName(e.target.value); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => setShowSuggestions(true)}
              className="input"
            />
            {/* Autocomplete dropdown */}
            {showSuggestions && custName.length >= 1 && customers && customers.length > 0 && (() => {
              const suggestions = customers
                .filter((c) => c.name.toLowerCase().includes(custName.toLowerCase()))
                .slice(0, 5);
              if (!suggestions.length) return null;
              return (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl overflow-hidden anim-fade"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}>
                  {suggestions.map((c) => {
                    const tier = getTier(c.points);
                    const tierInfo = getTierInfo(tier, t as Record<string, string>);
                    return (
                      <button key={c.id} onMouseDown={() => { setCustName(c.name); setShowSuggestions(false); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-sm transition-all hover:opacity-80"
                        style={{ background: "transparent", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--text)" }}>{c.name}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span style={{ color: "var(--text2)" }}>🎮 {c.totalVisits}</span>
                          <span style={{ color: tierInfo.color }}>{tierInfo.icon} {tierInfo.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            {/* Loyalty badge for matched customer */}
            {custName.length >= 2 && customers && (() => {
              const match = customers.find((c) => c.name.toLowerCase() === custName.toLowerCase());
              if (!match) return null;
              const tier = getTier(match.points);
              const tierInfo = getTierInfo(tier, t as Record<string, string>);
              return (
                <div className="mt-1.5 flex items-center gap-2 text-xs" style={{ color: tierInfo.color }}>
                  {tierInfo.icon} {tierInfo.label} · ⭐ {match.points} {t.points} · 🎮 {match.totalVisits} {t.totalVisits}
                </div>
              );
            })()}
          </div>

          {/* Phone number (optional) */}
          <div className="mb-4">
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>📱 {t.phoneNumber}</label>
            <input type="tel" placeholder={t.phoneNumber + "..."} value={custPhone}
              onChange={(e) => setCustPhone(e.target.value)} className="input" />
          </div>

          {/* Session type toggle — only for rooms zone */}
          {isRoomsZone && (
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text2)" }}>{t.sessionTypeLabel}</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { type: "ps" as const,    icon: "🎮", label: t.psSession },
                  { type: "match" as const, icon: "⚽", label: t.matchSession },
                ] as const).map((opt) => (
                  <button key={opt.type} onClick={() => setSessionType(opt.type)}
                    className="btn py-3 text-sm font-semibold"
                    style={{
                      background: sessionType === opt.type
                        ? opt.type === "ps"
                          ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                          : "color-mix(in srgb, var(--green) 12%, transparent)"
                        : "var(--input-bg)",
                      color: sessionType === opt.type
                        ? opt.type === "ps" ? "var(--accent)" : "var(--green)"
                        : "var(--text2)",
                      borderColor: sessionType === opt.type
                        ? opt.type === "ps"
                          ? "color-mix(in srgb, var(--accent) 25%, transparent)"
                          : "color-mix(in srgb, var(--green) 25%, transparent)"
                        : "var(--border)",
                    }}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Match session info: fixed price + room-10 coffee warning */}
          {sessionType === "match" && (
            <>
              <div className="card p-4 mb-4 flex items-center justify-between"
                style={{ background: "color-mix(in srgb, var(--green) 8%, transparent)", borderColor: "color-mix(in srgb, var(--green) 20%, transparent)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--text2)" }}>⚽ {t.fixedPrice}</span>
                <span className="text-xl font-bold flex items-center gap-1" style={{ color: "var(--green)" }}>
                  {MATCH_PRICE} <SarSymbol />
                </span>
              </div>
              {isRoom10 && (
                <div className="card p-3 mb-4"
                  style={{ background: "color-mix(in srgb, var(--yellow) 8%, transparent)", borderColor: "color-mix(in srgb, var(--yellow) 25%, transparent)" }}>
                  <div className="text-xs font-semibold" style={{ color: "var(--yellow)" }}>☕ {t.coffeeRequired}</div>
                </div>
              )}
            </>
          )}

          {/* Duration picker — only for PS sessions, hidden for per-hit */}
          {sessionType === "ps" && !isPerHit && (
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text2)" }}>{t.duration}</label>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(availableDurations.length, 5)}, 1fr)` }}>
                {availableDurations.map((d, i) => (
                  <button key={d.mins} onClick={() => setSelDur(d.mins)}
                    className="btn py-2 text-xs"
                    style={{
                      background: selDur === d.mins ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--input-bg)",
                      color: selDur === d.mins ? "var(--accent)" : "var(--text2)",
                      borderColor: selDur === d.mins ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "var(--border)",
                      whiteSpace: "pre-line", lineHeight: 1.3,
                    }}>
                    {durLabelsWithPrice[i]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Boxing: hit count input */}
          {isPerHit && (
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text2)" }}>🥊 {t.hitCount} ({info.zone.hitPrice ?? 7.5} ﷼/{t.perHit})</label>
              <input type="number" min={1} value={selPc} onChange={(e) => setSelPc(Math.max(1, Number(e.target.value)))}
                className="input w-24 text-center text-lg" />
              <div className="text-sm mt-1 font-bold" style={{ color: "var(--accent)" }}>
                {fmtMoney(selPc * (info.zone.hitPrice ?? 7.5))} ﷼
              </div>
            </div>
          )}

          {/* People count — hidden for boxing (uses hit count instead) */}
          {!isPerHit && (
            <div className="mb-5">
              <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text2)" }}>
                {isRoomsZone ? t.numPeople : t.players}
              </label>
              <div className="flex gap-2 flex-wrap">
                {PLAYER_COUNTS.map((pc) => (
                  <button key={pc} onClick={() => setSelPc(pc)}
                    className="btn w-11 h-11 text-sm"
                    style={{
                      background: selPc === pc ? "color-mix(in srgb, var(--blue) 12%, transparent)" : "var(--input-bg)",
                      color: selPc === pc ? "var(--blue)" : "var(--text2)",
                      borderColor: selPc === pc ? "color-mix(in srgb, var(--blue) 25%, transparent)" : "var(--border)",
                    }}>
                    {pc}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => onStartSession(itemId, custName, isPerHit ? 0 : selDur, selPc, isRoomsZone ? sessionType : "ps", custPhone || undefined)}
            className="btn btn-primary w-full py-3.5 text-sm"
            style={sessionType === "match" ? { background: "var(--green)", borderColor: "var(--green)" } : {}}>
            {isPerHit ? "🥊" : sessionType === "match" ? "⚽" : "▶"} {t.start}
          </button>
          </>)}
        </div>
      ) : (
        /* ── Active Session ── */
        <div className="grid gap-4">
          {/* Timer / Session Header */}
          <div className={`card p-6 anim-fade ${isWalkin ? "card-active" : isManual ? "" : calc?.isOvertime ? "card-danger" : "card-active"}`}
            style={isManual ? { borderColor: "color-mix(in srgb, var(--yellow) 30%, transparent)", background: "color-mix(in srgb, var(--yellow) 5%, var(--surface))" } : {}}>
            <div className="flex justify-between items-start mb-2">
              <div>
                {isWalkin && <div className="text-xs font-bold mb-1" style={{ color: "var(--green)" }}>☕ {t.walkinSession}</div>}
                {isManual && <div className="text-xs font-bold mb-1" style={{ color: "var(--yellow)" }}>💆 {t.massageSession}</div>}
                {session.sessionType === "match" && (
                  <div className="text-xs font-bold mb-1" style={{ color: "var(--green)" }}>⚽ {t.matchSession}</div>
                )}
                <div className="text-sm font-medium" style={{ color: "var(--text2)" }}>{session.customerName}</div>
                <div className="text-xs" style={{ color: "var(--text2)", opacity: 0.5 }}>{fmtTime(session.startTime)}</div>
              </div>
              {!isWalkin && !isManual && (
                <div className="text-right">
                  <div className="text-4xl md:text-5xl font-bold font-mono tabular-nums"
                    style={{ color: calc?.isOvertime ? "var(--red)" : session.sessionType === "match" ? "var(--green)" : "var(--accent)", letterSpacing: "0.05em" }}>
                    {calc?.isOpen ? fmtD(calc.elapsed) : fmtD(Math.max(0, calc?.remaining || 0))}
                  </div>
                  {calc?.isOvertime && <div className="text-xs font-semibold mt-1" style={{ color: "var(--red)" }}>⚠ {t.overtime}</div>}
                  {calc?.isOpen && session.sessionType !== "match" && <div className="text-xs mt-1" style={{ color: "var(--yellow)" }}>{t.open}</div>}
                </div>
              )}
              {isWalkin && (
                <div className="text-right">
                  <div className="text-xs font-bold" style={{ color: "var(--text2)", opacity: 0.5 }}>{t.noTimeCharge}</div>
                  <div className="text-sm mt-1" style={{ color: "var(--text2)", opacity: 0.4 }}>⏱ {fmtD(calc?.elapsed || 0)}</div>
                </div>
              )}
            </div>

            {/* Manual price input */}
            {isManual && onUpdateManualPrice && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <label className="text-xs font-medium mb-2 block" style={{ color: "var(--text2)" }}>💆 {t.manualPriceLabel}</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number" min={0} step={1}
                    placeholder={t.enterManualPrice}
                    value={session.manualPrice || ""}
                    onChange={(e) => onUpdateManualPrice(itemId, Number(e.target.value) || 0)}
                    className="input text-lg font-bold"
                    style={{ flex: 1, width: 0 }}
                    dir="ltr"
                  />
                  <span style={{ color: "var(--yellow)", flexShrink: 0 }}><SarSymbol size={18} /></span>
                </div>
              </div>
            )}

            {!isWalkin && !isManual && (
              <>
                {!calc?.isOpen && calc && (
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, calc.progress * 100))}%`, background: calc.isOvertime ? "var(--red)" : (calc.progress * 100) < 20 ? "var(--yellow)" : "var(--green)" }} /></div>
                )}
                {(calc?.graceMins || 0) > 0 && <div className="text-xs mt-2" style={{ color: "var(--yellow)" }}>🎁 {calc?.graceMins} {t.freeMin}</div>}
                {session.sessionType !== "match" && (
                  <div className="flex gap-2 mt-4">
                    {[5, 10, 15].map((m) => (
                      <button key={m} onClick={() => onAddGrace(itemId, m)} className="btn btn-ghost flex-1 py-2 text-xs">+{m} {settings.lang === "ar" ? "د" : "m"}</button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs" style={{ color: "var(--text2)" }}>👤</span>
              <div className="flex gap-1">{PLAYER_COUNTS.map((pc) => (
                <button key={pc} onClick={() => onUpdatePlayerCount(itemId, pc)}
                  className="w-7 h-7 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: session.playerCount === pc ? "color-mix(in srgb, var(--blue) 15%, transparent)" : "transparent", color: session.playerCount === pc ? "var(--blue)" : "var(--text2)", border: `1px solid ${session.playerCount === pc ? "color-mix(in srgb, var(--blue) 25%, transparent)" : "var(--border)"}` }}>
                  {pc}
                </button>
              ))}</div>
            </div>
          </div>

          {/* Switch Activity (tennis ↔ billiard only) */}
          {switchTargets && switchTargets.length > 0 && onSwitchActivity && (
            <div className="mb-3">
              {!showSwitch ? (
                <button className="btn w-full text-xs py-2" onClick={() => setShowSwitch(true)}
                  style={{ background: "color-mix(in srgb, var(--blue) 10%, transparent)", color: "var(--blue)", borderColor: "color-mix(in srgb, var(--blue) 25%, transparent)" }}>
                  🔄 {t.switchActivity}
                </button>
              ) : (
                <div className="card p-3">
                  <div className="text-xs font-semibold mb-2" style={{ color: "var(--text2)" }}>{t.switchTo}:</div>
                  <div className="flex flex-wrap gap-2">
                    {switchTargets.map((target) => (
                      <button key={target.id} className="btn btn-primary text-xs py-1.5 px-3"
                        onClick={() => { onSwitchActivity(itemId, target.id); setShowSwitch(false); }}>
                        {target.zoneName} — {target.name}
                      </button>
                    ))}
                  </div>
                  <button className="btn text-xs mt-2" onClick={() => setShowSwitch(false)} style={{ color: "var(--text2)" }}>
                    {isRTL ? "إلغاء" : "Cancel"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Switched from indicator */}
          {session.switchedFrom && (
            <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--blue) 8%, transparent)", color: "var(--blue)" }}>
              🔄 {t.switchedFromLabel}: {session.switchedFrom.itemName}
            </div>
          )}

          {/* Bill */}
          <div className="card p-5">
            <div className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>🧾 {t.bill}</div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: "var(--text2)" }}>
                {session.sessionType === "match" ? `⚽ ${t.matchSession}` : `⏱ ${t.time}`}
              </span>
              <span className="font-semibold flex items-center gap-1" style={{ color: "var(--text)" }}>
                {fmtMoney(calc?.timePrice || 0)} <SarSymbol />
                {session.sessionType === "match" && <span className="text-[9px] opacity-50">{t.fixedPrice}</span>}
              </span>
            </div>
            {orders.length > 0 && orders.map((o) => (
              <div key={o.orderId} className="flex justify-between items-center text-xs mb-0.5">
                <span style={{ color: "var(--text2)" }}>{o.icon} {o.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold" style={{ color: "var(--text)" }}>{fmtMoney(o.price)} <SarSymbol /></span>
                  <button onClick={() => onRemoveOrder(itemId, o.orderId)} className="text-[10px]" style={{ color: "var(--red)" }}>✕</button>
                </div>
              </div>
            ))}
            <div className="flex justify-between text-base font-bold mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              <span>{t.total}</span><span style={{ color: "var(--accent)" }}>{fmtMoney(calc?.total || 0)} <SarSymbol /></span>
            </div>
          </div>

          {/* Add Order */}
          <button onClick={() => setShowMenu(!showMenu)} className={`btn w-full py-3 text-sm ${showMenu ? "btn-ghost" : ""}`}
            style={!showMenu ? { background: "var(--surface)", color: "var(--text2)", borderColor: "var(--border)" } : {}}>
            {showMenu ? "✕ " + t.closeMenu : "☕ " + t.addOrder}
          </button>
          {showMenu && (
            <div className="card p-4 anim-scale">
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {menuCats.map((c) => (
                  <button key={c} onClick={() => setMenuCat(c)} className="btn px-3 py-1.5 text-xs whitespace-nowrap"
                    style={{ background: activeCat === c ? "color-mix(in srgb, var(--yellow) 12%, transparent)" : "var(--input-bg)", color: activeCat === c ? "var(--yellow)" : "var(--text2)", borderColor: activeCat === c ? "color-mix(in srgb, var(--yellow) 20%, transparent)" : "var(--border)" }}>
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {menu.filter((m) => m.cat === activeCat).map((m) => (
                  <button key={m.id} onClick={() => onAddOrder(itemId, m)} className="card p-3 text-center active:scale-95 transition-transform">
                    <div className="text-2xl">{m.icon}</div>
                    <div className="text-[11px] font-semibold mt-1" style={{ color: "var(--text)" }}>{m.name}</div>
                    <div className="text-[11px] font-bold flex items-center justify-center gap-0.5" style={{ color: "var(--yellow)" }}>{m.price} <SarSymbol size={10} /></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End Session */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div className="text-sm font-bold" style={{ color: "var(--text)" }}>✋ {t.endSession}</div>
              <div className="flex gap-2">
                {/* Prepaid button — only if no prepaid yet */}
                {onPrepay && !session.prepaidAmount && (
                  <button onClick={() => setShowPrepay(true)}
                    className="btn px-3 py-1.5 text-xs"
                    style={{ color: "var(--blue)", borderColor: "color-mix(in srgb, var(--blue) 25%, transparent)", background: "color-mix(in srgb, var(--blue) 8%, transparent)" }}>
                    💳 {t.prepay ?? "دفع مقدم"}
                  </button>
                )}
                {onHoldSession && (
                  <button onClick={() => setShowHold(true)}
                    className="btn px-3 py-1.5 text-xs"
                    style={{ color: "var(--yellow)", borderColor: "color-mix(in srgb, var(--yellow) 25%, transparent)", background: "color-mix(in srgb, var(--yellow) 8%, transparent)" }}>
                    ⏸ {t.hold ?? "تعليق"}
                  </button>
                )}
              </div>
            </div>
            {/* Prepaid badge — shown when prepaid is already recorded */}
            {session.prepaidAmount && session.prepaidAmount > 0 && (
              <div className="card p-3 mb-3 flex justify-between items-center text-xs"
                style={{ background: "color-mix(in srgb, var(--blue) 8%, var(--surface))", borderColor: "color-mix(in srgb, var(--blue) 25%, transparent)" }}>
                <span style={{ color: "var(--blue)" }}>✓ {t.prepaidAmountLabel ?? "المدفوع مقدماً"}</span>
                <span className="font-bold flex items-center gap-1" style={{ color: "var(--blue)" }}>
                  {fmtMoney(session.prepaidAmount)} <SarSymbol size={10} />
                  {session.prepaidMethod && <span className="opacity-60 font-normal">({session.prepaidMethod === "cash" ? t.cash : session.prepaidMethod === "card" ? (t.mada ?? "مدى") : session.prepaidMethod === "credit" ? (t.credit ?? "ائتماني") : t.transfer})</span>}
                </span>
              </div>
            )}
            {/* Remaining to pay if prepaid exists */}
            {session.prepaidAmount && session.prepaidAmount > 0 && calc && (
              <div className="card p-3 mb-3 flex justify-between items-center text-xs"
                style={{ background: calc.ordersTotal > 0 ? "color-mix(in srgb, var(--green) 8%, var(--surface))" : "var(--input-bg)" }}>
                <span style={{ color: "var(--text2)" }}>{t.remainingToPay ?? "المتبقي للدفع"}</span>
                <span className="font-bold flex items-center gap-1" style={{ color: calc.ordersTotal > 0 ? "var(--green)" : "var(--text2)" }}>
                  {fmtMoney(Math.max(0, calc.ordersTotal))} <SarSymbol size={10} />
                  {calc.ordersTotal === 0 && <span className="font-normal opacity-60">{t.noAdditionalAmount ?? "لا يوجد إضافي"}</span>}
                </span>
              </div>
            )}
            {/* Discount + Debt + آجل كامل */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--text2)" }}>{t.discount} (<SarSymbol size={11} />)</label>
                <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="input" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--text2)" }}>{t.debt} (<SarSymbol size={11} />)</label>
                <div className="flex gap-1">
                  <input type="number" value={debtAmt} onChange={(e) => setDebtAmt(e.target.value)} placeholder="0" className="input flex-1" />
                  <button
                    onClick={() => setDebtAmt(String(Math.max(0, (calc?.total || 0) - Number(discount || 0))))}
                    className="btn px-2 text-[10px]"
                    style={{ color: "var(--red)", borderColor: "color-mix(in srgb, var(--red) 25%, transparent)", background: "color-mix(in srgb, var(--red) 8%, transparent)", whiteSpace: "nowrap" }}>
                    📋 {t.deferredInvoice ?? "آجل كامل"}
                  </button>
                </div>
              </div>
            </div>

            {/* Bill summary */}
            {(Number(discount) > 0 || Number(debtAmt) > 0) && (
              <div className="card p-3 mb-4 text-xs" style={{ background: "var(--input-bg)" }}>
                {Number(discount) > 0 && <div className="flex justify-between" style={{ color: "var(--blue)" }}><span>{t.discount}</span><span className="flex items-center gap-1">-{discount} <SarSymbol size={11} /></span></div>}
                {Number(debtAmt) > 0 && <div className="flex justify-between" style={{ color: "var(--red)" }}><span>{t.debt}</span><span className="flex items-center gap-1">{debtAmt} <SarSymbol size={11} /></span></div>}
                <div className="flex justify-between font-bold mt-1 pt-1" style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>
                  <span>{t.cashDue}</span><span>{fmtMoney(Math.max(0, (calc?.total || 0) - Number(discount || 0) - Number(debtAmt || 0)))} <SarSymbol /></span>
                </div>
              </div>
            )}

            {/* تقسيم الفاتورة */}
            <div className="card p-3 mb-4" style={{ background: "var(--input-bg)" }}>
              <div className="text-xs font-medium mb-2" style={{ color: "var(--text2)" }}>✂️ {t.splitBill ?? "تقسيم الفاتورة"}</div>
              <div className="flex gap-1.5 flex-wrap">
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => setSplitCount(n)}
                    className="btn px-3 py-1.5 text-xs"
                    style={splitCount === n ? { background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)" } : { color: "var(--text2)" }}>
                    {n}
                  </button>
                ))}
              </div>
              {splitCount > 1 && calc && (
                <div className="text-xs mt-2 font-bold" style={{ color: "var(--green)" }}>
                  {t.perPerson ?? "نصيب كل شخص"}: {fmtMoney(Math.max(0, (calc.total - Number(discount||0) - Number(debtAmt||0)) / splitCount))} <SarSymbol size={11} />
                </div>
              )}
            </div>

            {/* تقسيم طريقة الدفع */}
            <div className="mb-4">
              <button onClick={() => { setSplitPayMode(v => !v); setSplitParts([{ amount: "", method: "cash" }]); }}
                className="btn w-full py-2 text-xs mb-3"
                style={splitPayMode ? { background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)" } : { color: "var(--text2)" }}>
                💰 {t.splitPayment ?? "تقسيم طريقة الدفع"} {splitPayMode ? "✓" : ""}
              </button>

              {splitPayMode ? (() => {
                const totalDue = Math.max(0, (calc?.total || 0) - Number(discount||0) - Number(debtAmt||0));
                const entered = splitParts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const remaining = totalDue - entered;
                const isValid = Math.abs(remaining) < 0.01 && entered > 0;
                const methodIcons: Record<string, string> = { cash: "💵", card: "💳", credit: "💳", transfer: "📲" };
                const methodLabels: Record<string, string> = { cash: t.cash, card: t.mada ?? "مدى", credit: t.credit ?? "ائتماني", transfer: t.transfer };
                return (
                  <div className="card p-3" style={{ background: "var(--input-bg)" }}>
                    <div className="flex flex-col gap-2 mb-3">
                      {splitParts.map((part, i) => (
                        <div key={i}>
                          <div className="flex gap-1.5 items-center mb-1">
                            <span className="text-[10px] font-bold shrink-0" style={{ color: "var(--text2)", minWidth: "1rem", textAlign: "center" }}>{i + 1}</span>
                            <input
                              type="number" min={0} placeholder="0"
                              value={part.amount}
                              onChange={e => setSplitParts(prev => prev.map((p, j) => j === i ? { ...p, amount: e.target.value } : p))}
                              className="input text-sm py-1.5"
                              style={{ flex: 1, width: 0 }}
                              dir="ltr"
                            />
                            {splitParts.length > 1 && (
                              <button onClick={() => setSplitParts(prev => prev.filter((_, j) => j !== i))}
                                className="btn px-2 py-1.5 text-xs shrink-0"
                                style={{ color: "var(--red)", borderColor: "color-mix(in srgb, var(--red) 20%, transparent)" }}>✕</button>
                            )}
                          </div>
                          <div className="flex gap-1 mr-5">
                            {(["cash","card","credit","transfer"] as const).map(m => (
                              <button key={m} onClick={() => setSplitParts(prev => prev.map((p, j) => j === i ? { ...p, method: m } : p))}
                                className="btn text-[10px] px-2 py-1 flex-1"
                                style={part.method === m
                                  ? { background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)" }
                                  : { color: "var(--text2)" }}>
                                {methodIcons[m]} {methodLabels[m]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button onClick={() => setSplitParts(prev => [...prev, { amount: "", method: "cash" }])}
                      className="btn btn-ghost w-full py-1.5 text-xs mb-3">
                      ➕ {isRTL ? "إضافة دفعة" : "Add payment"}
                    </button>

                    <div className="flex justify-between items-center text-xs mb-3 px-1">
                      <span style={{ color: "var(--text2)" }}>{t.paymentTotal ?? "المجموع المدخل"}: <span className="font-bold" style={{ color: "var(--text)" }}>{fmtMoney(entered)}</span> / {fmtMoney(totalDue)} <SarSymbol size={10} /></span>
                      {!isValid && entered > 0 && (
                        <span style={{ color: remaining > 0 ? "var(--red)" : "var(--yellow)" }}>
                          ⚠️ {remaining > 0 ? (t.paymentRemaining ?? "يتبقى") : (isRTL ? "زيادة" : "Over")}: {fmtMoney(Math.abs(remaining))} <SarSymbol size={10} />
                        </span>
                      )}
                      {isValid && <span style={{ color: "var(--green)" }}>✓ {isRTL ? "مكتمل" : "Complete"}</span>}
                    </div>

                    <button
                      disabled={!isValid}
                      onClick={() => {
                        const methods = splitParts
                          .filter(p => Number(p.amount) > 0)
                          .map(p => ({ method: p.method, amount: Number(p.amount) }));
                        const primary = [...methods].sort((a,b) => b.amount - a.amount)[0]?.method ?? "cash";
                        setPendingPay({ method: primary, debt: Number(debtAmt)||0, disc: Number(discount)||0, payMethods: methods, splitCount: splitCount > 1 ? splitCount : undefined });
                      }}
                      className="btn btn-primary w-full py-3 text-sm"
                      style={!isValid ? { opacity: 0.4 } : {}}>
                      ✅ {isRTL ? "تأكيد الدفع" : "Confirm Payment"}
                    </button>
                  </div>
                );
              })() : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { m: "cash", l: "💵 " + t.cash, c: "btn-success" },
                    { m: "card", l: "💳 " + (t.mada ?? "مدى"), c: "btn-ghost" },
                    { m: "credit", l: "💳 " + (t.credit ?? "ائتماني"), c: "" },
                    { m: "transfer", l: "📲 " + t.transfer, c: "" },
                  ].map((pm) => (
                    <button key={pm.m}
                      onClick={() => setPendingPay({ method: pm.m, debt: Number(debtAmt) || 0, disc: Number(discount) || 0, splitCount: splitCount > 1 ? splitCount : undefined })}
                      className={`btn py-3 text-sm ${pm.c}`}
                      style={!pm.c ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 15%, transparent)" } : {}}>
                      {pm.l}
                    </button>
                  ))}
                </div>
              )}</div>
          </div>
        </div>
      )}

      {/* (Handled externally via CashierSystem — nothing more needed here) */}

      {/* ── Prepay Modal ── */}
      {showPrepay && session && calc && onPrepay && (
        <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
          <div className="card p-6 w-full max-w-sm anim-fade-up">
            <div className="text-base font-bold mb-1 text-center" style={{ color: "var(--text)" }}>
              💳 {t.prepay ?? "دفع مقدم"}
            </div>
            <div className="text-xs text-center mb-4" style={{ color: "var(--text2)" }}>
              {isRTL ? "المبلغ الحالي (وقت + طلبات)" : "Current amount (time + orders)"}
            </div>
            {/* Current total */}
            <div className="card p-4 mb-4 text-center"
              style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--surface))", borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)" }}>
              <div className="text-2xl font-bold flex items-center justify-center gap-1" style={{ color: "var(--accent)" }}>
                {fmtMoney(calc.total)} <SarSymbol size={20} />
              </div>
              <div className="text-[10px] mt-1" style={{ color: "var(--text2)" }}>
                {isRTL ? "وقت" : "Time"}: {fmtMoney(calc.timePrice)} + {isRTL ? "طلبات" : "Orders"}: {fmtMoney(calc.ordersTotal)}
              </div>
            </div>
            {/* Payment method */}
            <div className="text-xs font-medium mb-2" style={{ color: "var(--text2)" }}>
              {isRTL ? "طريقة الدفع" : "Payment Method"}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { m: "cash", l: "💵 " + (t.cash ?? "كاش") },
                { m: "card", l: "💳 " + (t.mada ?? "مدى") },
                { m: "credit", l: "💳 " + (t.credit ?? "ائتماني") },
                { m: "transfer", l: "📲 " + (t.transfer ?? "تحويل") },
              ].map((pm) => (
                <button key={pm.m} onClick={() => setPrepayMethod(pm.m)}
                  className="btn py-2.5 text-xs"
                  style={prepayMethod === pm.m
                    ? { background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)" }
                    : { color: "var(--text2)" }}>
                  {pm.l}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onPrepay(itemId, calc.total, prepayMethod);
                  setShowPrepay(false);
                }}
                className="btn btn-primary py-3 text-sm font-bold">
                ✓ {t.prepayConfirm ?? "تأكيد"}
              </button>
              <button onClick={() => setShowPrepay(false)}
                className="btn py-3 text-sm btn-ghost">
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hold Modal ── */}
      {showHold && onHoldSession && session && (
        <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
          <div className="card p-6 w-full max-w-sm anim-fade-up">
            <div className="text-base font-bold mb-1 text-center" style={{ color: "var(--text)" }}>⏸ {t.holdTitle ?? "تعليق الجلسة"}</div>
            <div className="text-xs text-center mb-5" style={{ color: "var(--text2)" }}>{t.roomOccupied ?? "الغرفة مشغولة أو شاغلة؟"}</div>
            <div className="mb-4">
              <label className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--text2)" }}>{t.discount ?? "خصم"} (<SarSymbol size={11} />)</label>
              <input type="number" value={holdDisc} onChange={(e) => setHoldDisc(e.target.value)} placeholder="0" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => { onHoldSession(itemId, Number(holdDisc) || 0, true); setShowHold(false); setHoldDisc(""); }}
                className="btn py-3 text-sm"
                style={{ background: "color-mix(in srgb, var(--yellow) 12%, transparent)", color: "var(--yellow)", borderColor: "color-mix(in srgb, var(--yellow) 25%, transparent)" }}>
                🔒 {t.holdKeepOccupied ?? "تبقى مشغولة"}
              </button>
              <button
                onClick={() => { onHoldSession(itemId, Number(holdDisc) || 0, false); setShowHold(false); setHoldDisc(""); }}
                className="btn py-3 text-sm"
                style={{ background: "color-mix(in srgb, var(--green) 10%, transparent)", color: "var(--green)", borderColor: "color-mix(in srgb, var(--green) 25%, transparent)" }}>
                🔓 {t.holdFreeRoom ?? "تحرير الغرفة"}
              </button>
            </div>
            <button onClick={() => { setShowHold(false); setHoldDisc(""); }}
              className="btn w-full py-2 text-sm btn-ghost">{t.cancel}</button>
          </div>
        </div>
      )}

      {/* ── Print Modal ── */}
      {pendingPay && session && calc && (
        <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
          <div className="card p-6 w-full max-w-sm anim-fade-up">
            <div className="text-base font-bold mb-1 text-center" style={{ color: "var(--text)" }}>🖨️ {t.printReceipt}</div>
            <div className="text-xs text-center mb-5" style={{ color: "var(--text2)" }}>
              {isRTL ? "اختر نوع الطباعة" : "Choose print type"}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { type: "thermal" as PrintType, label: t.thermal },
                { type: "a4" as PrintType, label: t.a4 },
                { type: null, label: t.skip },
              ] as const).map((opt) => (
                <button key={opt.label}
                  onClick={async () => {
                    if (opt.type && session) {
                      printSession({
                        invoiceNo: getInvoiceNo ? await getInvoiceNo() : 0,
                        itemName: info.name,
                        zoneName: info.zone.name,
                        customerName: session.customerName,
                        sessionType: session.sessionType,
                        startTime: session.startTime,
                        endTime: Date.now(),
                        duration: calc.elapsed,
                        orders,
                        timePrice: calc.timePrice,
                        ordersTotal: calc.ordersTotal,
                        discount: pendingPay.disc,
                        debtAmount: pendingPay.debt,
                        total: Math.max(0, calc.total - pendingPay.disc),
                        payMethod: pendingPay.method,
                        cashier: "",
                        playerCount: session.playerCount || 1,
                        logo,
                        vatNumber: settings.vatEnabled ? (settings.vatNumber || "") : "",
                        sellerNameAr: settings.sellerNameAr || "",
                      }, opt.type);
                    }
                    onEndSession(itemId, pendingPay.method, pendingPay.debt, pendingPay.disc, { payMethods: pendingPay.payMethods, splitCount: pendingPay.splitCount });
                    setPendingPay(null);
                  }}
                  className={`btn py-3 text-sm ${opt.type === "thermal" ? "" : opt.type === "a4" ? "" : "btn-ghost"}`}
                  style={opt.type === "thermal"
                    ? { background: "color-mix(in srgb, var(--blue) 10%, transparent)", color: "var(--blue)", borderColor: "color-mix(in srgb, var(--blue) 20%, transparent)" }
                    : opt.type === "a4"
                    ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)" }
                    : {}}>
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                const endTime = Date.now();
                const sarUnit = isRTL ? "ر.س" : "SAR";
                const cashDue = Math.max(0, calc.total - pendingPay.disc - pendingPay.debt);
                const payLabel = isRTL
                  ? (pendingPay.method === "cash" ? "كاش" : pendingPay.method === "card" ? "مدى" : pendingPay.method === "credit" ? "ائتماني" : "تحويل")
                  : pendingPay.method;
                // End session first to get the record ID for receipt URL
                const recordId = await onEndSession(itemId, pendingPay.method, pendingPay.debt, pendingPay.disc, { payMethods: pendingPay.payMethods, splitCount: pendingPay.splitCount });
                setPendingPay(null);
                const receiptUrl = recordId
                  ? `${window.location.origin}/receipt/${recordId}`
                  : null;
                const lines = [
                  isRTL ? "🧾 مركز الصملة للترفيه" : "🧾 ALSAMLAH Entertainment Center",
                  `📍 ${info.name} — ${info.zone.name}`,
                  `👤 ${session.customerName}`,
                  session.playerCount > 1 ? `👥 ${session.playerCount} ${isRTL ? "أشخاص" : "players"}` : "",
                  `🕐 ${fmtTime(session.startTime)} ← ${fmtTime(endTime)} (${fmtD(calc.elapsed)})`,
                  "",
                  `${isRTL ? "وقت اللعب" : "Play time"}: ${fmtMoney(calc.timePrice)} ${sarUnit}`,
                  ...orders.map((o) => `${o.icon} ${o.name}: ${fmtMoney(o.price)} ${sarUnit}`),
                  ...(pendingPay.disc > 0 ? [`🏷 ${t.discount}: -${fmtMoney(pendingPay.disc)} ${sarUnit}`] : []),
                  ...(pendingPay.debt > 0 ? [`📝 ${t.debt}: ${fmtMoney(pendingPay.debt)} ${sarUnit}`] : []),
                  `✅ ${t.total}: ${fmtMoney(cashDue)} ${sarUnit}`,
                  ...(pendingPay.splitCount && pendingPay.splitCount > 1 ? [`✂️ ${isRTL?"مقسّمة على":"Split between"} ${pendingPay.splitCount} — ${isRTL?"نصيب كل شخص":"per person"}: ${fmtMoney(cashDue / pendingPay.splitCount)} ${sarUnit}`] : []),
                  `💳 ${isRTL ? "الدفع" : "Payment"}: ${pendingPay.payMethods ? pendingPay.payMethods.map(m=>`${m.method} ${fmtMoney(m.amount)}`).join(" + ") : payLabel}`,
                  ...(receiptUrl ? ["", `🧾 ${isRTL ? "الإيصال" : "Receipt"}: ${receiptUrl}`] : []),
                ].filter(Boolean).join("\n");
                window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, "_blank");
              }}
              className="btn w-full py-3 text-sm mt-3"
              style={{ background: "color-mix(in srgb, var(--green) 10%, transparent)", color: "var(--green)", borderColor: "color-mix(in srgb, var(--green) 25%, transparent)" }}>
              📱 {t.whatsapp}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
