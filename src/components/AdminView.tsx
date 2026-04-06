"use client";

import { useState } from "react";
import type { Floor, MenuItem, UserRole } from "@/lib/supabase";
import type { SystemSettings, ThemeMode, FontFamily, FontSize, Language } from "@/lib/settings";
import { FONTS, FONT_SIZES, T } from "@/lib/settings";
import { MENU_ICONS, ROLE_LABELS } from "@/lib/defaults";
import SarSymbol from "./SarSymbol";
import BusinessProfile from "./BusinessProfile";
import QrCodesTab from "./QrCodesTab";

interface Props {
  floors: Floor[];
  setFloors: React.Dispatch<React.SetStateAction<Floor[]>>;
  menu: MenuItem[];
  setMenu: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  pins: Record<UserRole, string>;
  setPins: React.Dispatch<React.SetStateAction<Record<UserRole, string>>>;
  roleNames: Record<UserRole, string>;
  setRoleNames: React.Dispatch<React.SetStateAction<Record<UserRole, string>>>;
  role: UserRole;
  notify: (msg: string) => void;
  onClearHistory: () => void;
  onClearDebts: () => void;
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  logo: string | null;
  setLogo: (logo: string | null) => void;
  tenantId: string;
}

export default function AdminView({ floors, setFloors, menu, setMenu, pins, setPins, roleNames, setRoleNames, role, notify, onClearHistory, onClearDebts, settings, setSettings, logo, setLogo, tenantId }: Props) {
  const [tab, setTab] = useState("prices");
  const [editItem, setEditItem] = useState<{ id: string; name: string; cat: string; icon: string; price: string } | null>(null);
  const [editIconPicker, setEditIconPicker] = useState(false);
  const [newMenuItem, setNewMenuItem] = useState({ name: "", price: "", cat: settings.lang === "ar" ? "مشروبات" : "Drinks", icon: "🥤" });
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showAddCat, setShowAddCat] = useState(false);
  const [pinEdits, setPinEdits] = useState<Record<string, string>>({});

  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const isManager = role === "manager";
  const menuCats = [...new Set(menu.map((m) => m.cat))];

  if (!isManager) {
    return (
      <div className="p-4 text-center pt-20">
        <div className="text-5xl mb-4">🔒</div>
        <div className="text-sm" style={{ color: "var(--text2)" }}>
          {settings.lang === "ar" ? "الإعدادات متاحة للمدير فقط" : "Settings are only available for the manager"}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "business", label: "🏢 " + (isRTL ? "ملف المركز" : "Business") },
    { id: "prices", label: "💲 " + t.prices },
    { id: "menu", label: "🧾 " + t.menu },
    { id: "qr", label: "📱 " + (isRTL ? "رموز QR" : "QR Codes") },
    { id: "pins", label: "🔑 " + t.pins },
    { id: "settings", label: "🎨 " + t.settings },
    { id: "danger", label: "⚠️ " + t.danger },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text)" }}>⚙️ {t.admin}</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className="btn px-4 py-2.5 text-xs whitespace-nowrap"
            style={{
              background: tab === tb.id ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--input-bg)",
              color: tab === tb.id ? "var(--accent)" : "var(--text2)",
              borderColor: tab === tb.id ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "var(--border)",
            }}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Prices ── */}
      {tab === "prices" && floors.map((f) => (
        <div key={f.id} className="mb-5">
          <div className="text-xs font-semibold mb-2" style={{ color: "var(--text2)" }}>{f.name}</div>
          {f.zones.filter((z) => z.pricePerHour > 0).map((z) => (
            <div key={z.id} className="card p-4 mb-2">
              <div className="flex items-center gap-2 mb-3"><span className="text-lg">{z.icon}</span><span className="text-sm font-bold" style={{ color: "var(--text)" }}>{z.name}</span></div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.pricePerHour}</label>
                  <input type="number" value={z.pricePerHour} onChange={(e) => setFloors((p) => p.map((fl) => fl.id === f.id ? { ...fl, zones: fl.zones.map((zn) => zn.id === z.id ? { ...zn, pricePerHour: Number(e.target.value) } : zn) } : fl))}
                    className="input" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.minDuration}</label>
                  <input type="number" value={z.minCharge} onChange={(e) => setFloors((p) => p.map((fl) => fl.id === f.id ? { ...fl, zones: fl.zones.map((zn) => zn.id === z.id ? { ...zn, minCharge: Number(e.target.value) } : zn) } : fl))}
                    className="input" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* ── Menu ── */}
      {tab === "menu" && (
        <div>
          <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>🧾 {t.menuMgmt}</div>
          {/* Add new item */}
          <div className="card p-5 mb-5">
            <div className="text-xs font-semibold mb-4" style={{ color: "var(--text2)" }}>+ {t.addItem}</div>
            {/* Icon selector */}
            <div className="mb-3">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.icon}</label>
              <button onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl transition-all"
                style={{ background: "var(--input-bg)", border: "2px dashed color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                {newMenuItem.icon}
              </button>
            </div>
            {showIconPicker && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 card">
                {MENU_ICONS.map((ic) => (
                  <button key={ic} onClick={() => { setNewMenuItem({ ...newMenuItem, icon: ic }); setShowIconPicker(false); }}
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all"
                    style={{
                      background: newMenuItem.icon === ic ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent",
                      border: `1px solid ${newMenuItem.icon === ic ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--border)"}`,
                    }}>{ic}</button>
                ))}
              </div>
            )}
            {/* Name + Price */}
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.itemName}</label>
                <input type="text" placeholder={settings.lang === "ar" ? "مثال: كابتشينو" : "e.g. Cappuccino"} value={newMenuItem.name} onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                  className="input" />
              </div>
              <div className="w-24">
                <label className="text-xs font-medium mb-1.5 block flex items-center gap-1" style={{ color: "var(--text2)" }}>{t.price} (<SarSymbol size={12} />)</label>
                <input type="number" placeholder="0" value={newMenuItem.price} onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
                  className="input" />
              </div>
            </div>
            {/* Category */}
            <div className="mb-4">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.category}</label>
              <div className="flex gap-2">
                <select value={newMenuItem.cat} onChange={(e) => setNewMenuItem({ ...newMenuItem, cat: e.target.value })}
                  className="input flex-1">
                  {menuCats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => setShowAddCat(!showAddCat)} className="btn px-3 py-2 text-xs" style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)" }}>+ {t.newCat}</button>
              </div>
            </div>
            {showAddCat && (
              <div className="flex gap-2 mb-4">
                <input type="text" placeholder={settings.lang === "ar" ? "اسم الفئة الجديدة" : "New category name"} value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                  className="input flex-1" />
                <button onClick={() => { if (newCatName) { setNewMenuItem({ ...newMenuItem, cat: newCatName }); setNewCatName(""); setShowAddCat(false); } }}
                  className="btn btn-primary px-4 py-2 text-xs">{t.save}</button>
              </div>
            )}
            <button onClick={() => {
              if (newMenuItem.name && Number(newMenuItem.price) > 0) {
                setMenu((p) => [...p, { id: `m${Date.now()}`, name: newMenuItem.name, price: Number(newMenuItem.price), cat: newMenuItem.cat, icon: newMenuItem.icon }]);
                setNewMenuItem({ name: "", price: "", cat: newMenuItem.cat, icon: "🥤" }); notify(t.addedItem + " ✓");
              }
            }} className="btn btn-primary w-full py-3 text-sm">+ {t.addItem}</button>
          </div>
          {/* Existing items */}
          {menuCats.map((cat) => (
            <div key={cat} className="mb-4">
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--text2)" }}>{cat}</div>
              {menu.filter((m) => m.cat === cat).map((m) => (
                <div key={m.id} className="card mb-2 overflow-hidden">
                  {editItem?.id === m.id ? (
                    /* ── Edit Mode ── */
                    <div className="p-4 anim-fade">
                      <div className="flex items-center gap-2 mb-3">
                        <button onClick={() => setEditIconPicker(!editIconPicker)}
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ background: "var(--input-bg)", border: "2px dashed color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                          {editItem.icon}
                        </button>
                        <input type="text" value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                          className="input flex-1 font-bold" />
                        <input type="number" value={editItem.price} onChange={(e) => setEditItem({ ...editItem, price: e.target.value })}
                          className="input w-20" />
                      </div>
                      {editIconPicker && (
                        <div className="flex flex-wrap gap-1.5 mb-3 p-2 card">
                          {MENU_ICONS.map((ic) => (
                            <button key={ic} onClick={() => { setEditItem({ ...editItem, icon: ic }); setEditIconPicker(false); }}
                              className="w-8 h-8 rounded flex items-center justify-center text-lg transition-all"
                              style={{ background: editItem.icon === ic ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent" }}>{ic}</button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setMenu((p) => p.map((x) => x.id === m.id ? { ...x, name: editItem.name, price: Number(editItem.price), icon: editItem.icon } : x));
                          setEditItem(null); setEditIconPicker(false); notify(t.saved + " ✓");
                        }} className="btn btn-success flex-1 py-2.5 text-xs">✓ {t.save}</button>
                        <button onClick={() => { setEditItem(null); setEditIconPicker(false); }}
                          className="btn btn-ghost py-2.5 px-4 text-xs">{t.cancel}</button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display Mode ── */
                    <div className="p-3 flex items-center gap-2">
                      <span className="text-lg">{m.icon}</span>
                      <span className="text-sm font-bold flex-1" style={{ color: "var(--text)" }}>{m.name}</span>
                      <span className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--yellow)" }}>{m.price} <SarSymbol size={12} /></span>
                      <button onClick={() => { setEditItem({ ...m, price: String(m.price) }); setEditIconPicker(false); }}
                        className="btn px-2.5 py-1 text-[10px]"
                        style={{ background: "color-mix(in srgb, var(--blue) 10%, transparent)", color: "var(--blue)", borderColor: "color-mix(in srgb, var(--blue) 15%, transparent)" }}>
                        ✏️ {t.edit}
                      </button>
                      <button onClick={() => { if (confirm(`${t.delete} ${m.name}?`)) { setMenu((p) => p.filter((x) => x.id !== m.id)); notify(t.deleted + " ✓"); } }}
                        className="btn btn-danger px-2 py-1 text-[10px]">🗑</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── QR Codes ── */}
      {tab === "qr" && <QrCodesTab floors={floors} tenantId={tenantId} />}

      {/* ── PINs & Names ── */}
      {tab === "pins" && (
        <div>
          <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>🔑 {t.pins}</div>
          {(["cashier1", "cashier2", "manager"] as const).map((r) => (
            <div key={r} className="card p-4 mb-3">
              {/* Role label */}
              <div className="text-[10px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--accent)" }}>
                {r === "manager" ? "👑" : "💰"} {isRTL ? ROLE_LABELS[r].ar : ROLE_LABELS[r].en}
              </div>
              {/* Name */}
              <div className="mb-3">
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>
                  {isRTL ? "الاسم" : "Display Name"}
                </label>
                <input type="text" value={roleNames[r]}
                  onChange={(e) => setRoleNames((p) => ({ ...p, [r]: e.target.value }))}
                  className="input" placeholder={isRTL ? "أدخل الاسم..." : "Enter name..."} />
              </div>
              {/* PIN */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>
                  {t.pins} ({t.currentPin}: <span style={{ color: "var(--accent)" }}>{pins[r]}</span>)
                </label>
                <div className="flex gap-2">
                  <input type="password" placeholder={t.newPin} value={pinEdits[r] || ""}
                    onChange={(e) => setPinEdits({ ...pinEdits, [r]: e.target.value })}
                    className="input flex-1" />
                  <button onClick={() => {
                    const newPin = pinEdits[r];
                    if (newPin && newPin.length >= 4) {
                      setPins((p) => ({ ...p, [r]: newPin }));
                      setPinEdits({ ...pinEdits, [r]: "" });
                      notify(t.pinChanged + " ✓");
                    }
                  }} className="btn btn-primary px-4 py-2 text-xs">{t.save}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── System Settings ── */}
      {tab === "settings" && (
        <div>
          <div className="text-sm font-bold mb-5" style={{ color: "var(--text)" }}>🎨 {t.settings}</div>

          {/* Theme */}
          <div className="card p-5 mb-4">
            <label className="text-xs font-semibold mb-3 block" style={{ color: "var(--text2)" }}>{t.theme}</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { id: "dark"        as ThemeMode, icon: "🌙", label: t.darkMode },
                { id: "light"       as ThemeMode, icon: "☀️", label: t.lightMode },
                { id: "system"      as ThemeMode, icon: "💻", label: t.systemMode },
                { id: "claude-dark" as ThemeMode, icon: "🍂", label: t.claudeDarkMode },
                { id: "claude-light"as ThemeMode, icon: "🌿", label: t.claudeLightMode },
              ]).map((th) => (
                <button key={th.id} onClick={() => setSettings((s) => ({ ...s, theme: th.id }))}
                  className="card p-4 text-center transition-all"
                  style={{
                    background: settings.theme === th.id ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--input-bg)",
                    borderColor: settings.theme === th.id ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--border)",
                  }}>
                  <div className="text-3xl mb-2">{th.icon}</div>
                  <div className="text-sm font-bold" style={{ color: settings.theme === th.id ? "var(--accent)" : "var(--text2)" }}>{th.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="card p-5 mb-4">
            <label className="text-xs font-semibold mb-3 block" style={{ color: "var(--text2)" }}>{t.language}</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: "ar" as Language, flag: "🇸🇦", label: "العربية" },
                { id: "en" as Language, flag: "🇬🇧", label: "English" },
              ]).map((lg) => (
                <button key={lg.id} onClick={() => setSettings((s) => ({ ...s, lang: lg.id }))}
                  className="card p-4 text-center transition-all"
                  style={{
                    background: settings.lang === lg.id ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--input-bg)",
                    borderColor: settings.lang === lg.id ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--border)",
                  }}>
                  <div className="text-3xl mb-2">{lg.flag}</div>
                  <div className="text-sm font-bold" style={{ color: settings.lang === lg.id ? "var(--accent)" : "var(--text2)" }}>{lg.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Font Family */}
          <div className="card p-5 mb-4">
            <label className="text-xs font-semibold mb-3 block" style={{ color: "var(--text2)" }}>{t.font}</label>
            <div className="grid gap-2">
              {(Object.keys(FONTS) as FontFamily[]).map((fk) => {
                const f = FONTS[fk];
                return (
                  <button key={fk} onClick={() => setSettings((s) => ({ ...s, font: fk }))}
                    className="card p-4 flex items-center gap-4 transition-all"
                    style={{
                      background: settings.font === fk ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--input-bg)",
                      borderColor: settings.font === fk ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--border)",
                      fontFamily: f.css,
                    }}>
                    <div className="text-2xl font-bold" style={{ color: settings.font === fk ? "var(--accent)" : "var(--text)", fontFamily: f.css }}>Aa</div>
                    <div className="flex-1 text-start">
                      <div className="text-sm font-bold" style={{ color: settings.font === fk ? "var(--accent)" : "var(--text)", fontFamily: f.css }}>{f.name}</div>
                      <div className="text-xs" style={{ color: "var(--text2)", fontFamily: f.css }}>{f.nameAr}</div>
                    </div>
                    {settings.font === fk && <span style={{ color: "var(--accent)" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loyalty Points Ratio */}
          <div className="card p-5 mb-4">
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text2)" }}>⭐ {t.loyaltyPointsRatio}</label>
            <p className="text-[11px] mb-3" style={{ color: "var(--text2)", opacity: 0.6 }}>
              {isRTL ? `كل X ${t.perSAR}` : `Every X ${t.perSAR}`}
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="1000"
                value={settings.loyaltyPointsRatio ?? 50}
                onChange={(e) => setSettings((s) => ({ ...s, loyaltyPointsRatio: Math.max(1, Number(e.target.value) || 50) }))}
                className="input w-28"
                dir="ltr"
              />
              <span className="text-sm" style={{ color: "var(--text2)" }}>
                {isRTL ? `ريال = نقطة` : `SAR = 1 point`}
              </span>
            </div>
          </div>

          {/* End of Day Hour */}
          <div className="card p-5 mb-4">
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text2)" }}>🕐 {t.endOfDayHour}</label>
            <p className="text-[11px] mb-3" style={{ color: "var(--text2)", opacity: 0.6 }}>
              {t.endOfDayHourNote}
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="11"
                value={settings.endOfDayHour ?? 5}
                onChange={(e) => setSettings((s) => ({ ...s, endOfDayHour: Math.max(0, Math.min(11, Number(e.target.value) || 5)) }))}
                className="input w-24"
                dir="ltr"
              />
              <span className="text-sm" style={{ color: "var(--text2)" }}>
                {isRTL ? "صباحاً (0–11)" : "AM (0–11)"}
              </span>
            </div>
          </div>

          {/* Font Size */}
          <div className="card p-5">
            <label className="text-xs font-semibold mb-3 block" style={{ color: "var(--text2)" }}>{t.fontSize}</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(FONT_SIZES) as FontSize[]).map((fs) => {
                const sz = FONT_SIZES[fs];
                return (
                  <button key={fs} onClick={() => setSettings((s) => ({ ...s, fontSize: fs }))}
                    className="card p-4 text-center transition-all"
                    style={{
                      background: settings.fontSize === fs ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--input-bg)",
                      borderColor: settings.fontSize === fs ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--border)",
                    }}>
                    <div className="font-bold mb-1" style={{ color: settings.fontSize === fs ? "var(--accent)" : "var(--text)", fontSize: `${14 * sz.scale}px` }}>
                      {isRTL ? "أ" : "A"}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text2)" }}>{isRTL ? sz.labelAr : sz.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Business Profile ── */}
      {tab === "business" && (
        <BusinessProfile settings={settings} logo={logo} setLogo={setLogo} />
      )}

      {/* ── Danger Zone ── */}
      {tab === "danger" && (
        <div>
          <div className="text-sm font-bold mb-4" style={{ color: "var(--red)" }}>⚠️ {t.dangerZone}</div>
          <button onClick={() => { if (confirm(t.confirmClearHistory)) { onClearHistory(); notify(t.done + " ✓"); } }}
            className="btn btn-danger w-full py-3 text-sm mb-3">🗑 {t.clearHistory}</button>
          <button onClick={() => { if (confirm(t.confirmClearDebts)) { onClearDebts(); notify(t.done + " ✓"); } }}
            className="btn btn-danger w-full py-3 text-sm">🗑 {t.clearDebts}</button>
        </div>
      )}
    </div>
  );
}
