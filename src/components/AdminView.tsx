"use client";

import { useState } from "react";
import type { Floor, Zone, MenuItem, UserRole } from "@/lib/supabase";
import type { SystemSettings, ThemeMode, FontFamily, FontSize, Language } from "@/lib/settings";
import { FONTS, FONT_SIZES, T } from "@/lib/settings";
import { MENU_ICONS, ROLE_LABELS, COUNTER_FLOOR_ID } from "@/lib/defaults";
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
  const [editItem, setEditItem] = useState<{ id: string; name: string; cat: string; icon: string; price: string; trackStock?: boolean; stock?: number; lowStockThreshold?: number } | null>(null);
  const [editIconPicker, setEditIconPicker] = useState(false);
  const [newMenuItem, setNewMenuItem] = useState({ name: "", price: "", cat: settings.lang === "ar" ? "مشروبات" : "Drinks", icon: "🥤", trackStock: false, stock: 0, lowStockThreshold: 5 });
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showAddCat, setShowAddCat] = useState(false);
  const [pinEdits, setPinEdits] = useState<Record<string, string>>({});

  // ── Zone / Floor management state ──
  const [editZoneId, setEditZoneId] = useState<string | null>(null);
  const [editZoneData, setEditZoneData] = useState<Partial<Zone>>({});
  const [showZoneIconPicker, setShowZoneIconPicker] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [addZoneFloorId, setAddZoneFloorId] = useState<string | null>(null);
  const [newZoneData, setNewZoneData] = useState({ name: "", icon: "🎮", pricingMode: "hourly", pricePerHour: 0 });
  const [showNewZoneIconPicker, setShowNewZoneIconPicker] = useState(false);
  const [editFloorId, setEditFloorId] = useState<string | null>(null);
  const [editFloorName, setEditFloorName] = useState("");
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [newFloorName, setNewFloorName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
    { id: "zones", label: "🏗️ " + (isRTL ? "الغرف والأنشطة" : "Zones") },
    { id: "prices", label: "💲 " + t.prices },
    { id: "menu", label: "🧾 " + t.menu },
    { id: "qr", label: "📱 " + (isRTL ? "رموز QR" : "QR Codes") },
    { id: "pins", label: "🔑 " + t.pins },
    { id: "settings", label: "🎨 " + t.settings },
    { id: "danger", label: "⚠️ " + t.danger },
  ];

  const ZONE_ICONS_LIST = ["🎮", "🎱", "♟️", "🃏", "🥊", "🏓", "🛋️", "☕", "💆", "🎯", "🎳", "🎲", "⚽", "🏀", "🎿", "🚗", "🎸", "🎤", "🏋️", "🎬", "🪀", "🎠", "🎡", "🎢", "🀄", "🎭", "🎨", "🎪", "🎰", "🏊", "🧩", "🎻"];
  const PRICING_MODES = [
    { id: "hourly",  label: isRTL ? "بالساعة"       : "Hourly"   },
    { id: "per-hit", label: isRTL ? "بالضربة"       : "Per Hit"  },
    { id: "manual",  label: isRTL ? "يدوي"          : "Manual"   },
    { id: "walkin",  label: isRTL ? "طلبات مباشرة"  : "Walk-in"  },
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

      {/* ── Prices (tiered) ── */}
      {tab === "prices" && floors.map((f) => (
        <div key={f.id} className="mb-5">
          <div className="text-xs font-semibold mb-2" style={{ color: "var(--text2)" }}>{f.name}</div>
          {f.zones.map((z) => (
            <div key={z.id} className="card p-4 mb-2">
              <div className="flex items-center gap-2 mb-3"><span className="text-lg">{z.icon}</span><span className="text-sm font-bold" style={{ color: "var(--text)" }}>{z.name}</span>
                {z.pricingMode === "per-hit" && <span className="badge text-xs" style={{ background: "color-mix(in srgb, var(--yellow) 15%, transparent)", color: "var(--yellow)" }}>🥊 {t.perHit}</span>}
                {z.pricingMode === "manual" && <span className="badge text-xs" style={{ background: "color-mix(in srgb, var(--blue) 15%, transparent)", color: "var(--blue)" }}>💆 {isRTL ? "يدوي" : "Manual"}</span>}
                {z.pricingMode === "walkin" && <span className="badge text-xs" style={{ background: "color-mix(in srgb, var(--green) 15%, transparent)", color: "var(--green)" }}>☕ {isRTL ? "طلبات مباشرة" : "Walk-in"}</span>}
              </div>
              {z.pricingMode === "manual" ? (
                <div className="text-xs py-2 px-3 rounded-lg" style={{ background: "color-mix(in srgb, var(--blue) 8%, transparent)", color: "var(--text2)", border: "1px dashed color-mix(in srgb, var(--blue) 25%, transparent)" }}>
                  {isRTL ? "التسعير يدوي — يُدخل الكاشير السعر أثناء الجلسة" : "Manual pricing — cashier enters price during session"}
                </div>
              ) : z.pricingMode === "walkin" ? (
                <div className="text-xs py-2 px-3 rounded-lg" style={{ background: "color-mix(in srgb, var(--green) 8%, transparent)", color: "var(--text2)", border: "1px dashed color-mix(in srgb, var(--green) 25%, transparent)" }}>
                  {isRTL ? "طلبات مباشرة — بدون رسوم وقت، فقط المنيو" : "Walk-in orders — no time charge, menu only"}
                </div>
              ) : z.pricingMode === "per-hit" ? (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.hitPrice}</label>
                    <input type="number" step="0.5" value={z.hitPrice ?? 7.5} onChange={(e) => setFloors((p) => p.map((fl) => fl.id === f.id ? { ...fl, zones: fl.zones.map((zn) => zn.id === z.id ? { ...zn, hitPrice: Number(e.target.value) } : zn) } : fl))}
                      className="input" />
                  </div>
                </div>
              ) : z.priceTiers?.length ? (
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(z.priceTiers.length, 5)}, 1fr)` }}>
                  {z.priceTiers.map((tier) => {
                    const lbl = tier.minutes >= 720 ? "يوم" : tier.minutes >= 60 ? `${tier.minutes / 60}س` : `${tier.minutes}د`;
                    return (
                      <div key={tier.minutes} className="text-center">
                        <div className="text-[10px] mb-0.5" style={{ color: "var(--text2)" }}>{lbl}</div>
                        <input type="number" value={tier.price}
                          onChange={(e) => setFloors((p) => p.map((fl) => fl.id === f.id ? { ...fl, zones: fl.zones.map((zn) => zn.id === z.id ? { ...zn, priceTiers: (zn.priceTiers ?? []).map((t2) => t2.minutes === tier.minutes ? { ...t2, price: Number(e.target.value) } : t2) } : zn) } : fl))}
                          className="input text-center text-xs" style={{ padding: "4px 2px" }} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.pricePerHour}</label>
                    <input type="number" value={z.pricePerHour} onChange={(e) => setFloors((p) => p.map((fl) => fl.id === f.id ? { ...fl, zones: fl.zones.map((zn) => zn.id === z.id ? { ...zn, pricePerHour: Number(e.target.value) } : zn) } : fl))}
                      className="input" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* ── Zones & Activities ── */}
      {tab === "zones" && (() => {
        const editableFloors = floors.filter((f) => f.id !== COUNTER_FLOOR_ID);
        const pricingLabel = (mode?: string) => {
          if (mode === "manual")  return isRTL ? "يدوي"          : "Manual";
          if (mode === "walkin")  return isRTL ? "مباشر"         : "Walk-in";
          if (mode === "per-hit") return isRTL ? "بالضربة"       : "Per hit";
          return isRTL ? "بالساعة" : "Hourly";
        };
        const closeEditZone = () => { setEditZoneId(null); setEditZoneData({}); setShowZoneIconPicker(false); setNewItemName(""); setDeleteConfirm(null); };
        return (
          <div>
            {editableFloors.map((f) => (
              <div key={f.id} className="mb-7">
                {/* ── Floor header ── */}
                <div className="flex items-center gap-2 mb-3">
                  {editFloorId === f.id ? (
                    <input type="text" value={editFloorName} onChange={(e) => setEditFloorName(e.target.value)}
                      className="input font-bold text-sm" style={{ flex: 1, width: 0 }} autoFocus />
                  ) : (
                    <div className="text-sm font-bold flex-1" style={{ color: "var(--text)" }}>{f.name}</div>
                  )}
                  {editFloorId === f.id ? (
                    <>
                      <button onClick={() => { setFloors((p) => p.map((fl) => fl.id === f.id ? { ...fl, name: editFloorName } : fl)); setEditFloorId(null); notify("✓"); }}
                        className="btn btn-success px-3 py-1.5 text-xs">💾</button>
                      <button onClick={() => setEditFloorId(null)} className="btn px-3 py-1.5 text-xs" style={{ color: "var(--text2)" }}>✕</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditFloorId(f.id); setEditFloorName(f.name); }}
                        className="btn px-3 py-1.5 text-xs" style={{ color: "var(--text2)" }}>✏️</button>
                      {deleteConfirm === `floor:${f.id}` ? (
                        <>
                          <button onClick={() => { setFloors((p) => p.filter((fl) => fl.id !== f.id)); setDeleteConfirm(null); notify(isRTL ? "تم الحذف" : "Deleted"); }}
                            className="btn btn-danger px-3 py-1.5 text-xs">{isRTL ? "تأكيد" : "Yes, delete"}</button>
                          <button onClick={() => setDeleteConfirm(null)} className="btn px-2 py-1.5 text-xs" style={{ color: "var(--text2)" }}>✕</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirm(`floor:${f.id}`)}
                          className="btn px-2 py-1.5 text-xs" style={{ color: "var(--red)" }}>🗑️</button>
                      )}
                    </>
                  )}
                </div>

                {/* ── Zones list ── */}
                {f.zones.map((z) => (
                  <div key={z.id} className="card mb-2 overflow-hidden">
                    {editZoneId === z.id ? (
                      /* ── Edit zone mode ── */
                      <div className="p-4 anim-fade">
                        {/* Icon + Name */}
                        <div className="flex gap-2 mb-3">
                          <button onClick={() => setShowZoneIconPicker(!showZoneIconPicker)}
                            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                            style={{ background: "var(--input-bg)", border: "2px dashed color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                            {editZoneData.icon}
                          </button>
                          <input type="text" value={editZoneData.name || ""} onChange={(e) => setEditZoneData({ ...editZoneData, name: e.target.value })}
                            className="input font-bold" style={{ flex: 1, width: 0 }} placeholder={isRTL ? "اسم النشاط" : "Activity name"} />
                        </div>
                        {showZoneIconPicker && (
                          <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-xl" style={{ background: "var(--input-bg)" }}>
                            {ZONE_ICONS_LIST.map((ic) => (
                              <button key={ic} onClick={() => { setEditZoneData({ ...editZoneData, icon: ic }); setShowZoneIconPicker(false); }}
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all"
                                style={{ background: editZoneData.icon === ic ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent", border: `1px solid ${editZoneData.icon === ic ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--border)"}` }}>
                                {ic}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Pricing mode */}
                        <div className="mb-3">
                          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{isRTL ? "نوع التسعير" : "Pricing mode"}</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {PRICING_MODES.map((pm) => (
                              <button key={pm.id} onClick={() => setEditZoneData({ ...editZoneData, pricingMode: pm.id as Zone["pricingMode"] })}
                                className="btn py-2 text-xs"
                                style={{ background: editZoneData.pricingMode === pm.id ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--input-bg)", color: editZoneData.pricingMode === pm.id ? "var(--accent)" : "var(--text2)", borderColor: editZoneData.pricingMode === pm.id ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "var(--border)" }}>
                                {pm.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Price input based on mode */}
                        {(editZoneData.pricingMode === "hourly" || !editZoneData.pricingMode) && (
                          <div className="mb-3">
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.pricePerHour} (<SarSymbol size={11} />)</label>
                            <input type="number" value={editZoneData.pricePerHour ?? 0} onChange={(e) => setEditZoneData({ ...editZoneData, pricePerHour: Number(e.target.value) })} className="input" />
                          </div>
                        )}
                        {editZoneData.pricingMode === "per-hit" && (
                          <div className="mb-3">
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.hitPrice} (<SarSymbol size={11} />/{isRTL ? "ضربة" : "hit"})</label>
                            <input type="number" step="0.5" value={editZoneData.hitPrice ?? 0} onChange={(e) => setEditZoneData({ ...editZoneData, hitPrice: Number(e.target.value) })} className="input" />
                          </div>
                        )}
                        {/* Items */}
                        <div className="mb-3">
                          <div className="text-xs font-medium mb-2" style={{ color: "var(--text2)" }}>
                            {isRTL ? "العناصر" : "Items"} ({(editZoneData.items || []).length})
                          </div>
                          <div className="flex flex-col gap-1 mb-2">
                            {(editZoneData.items || []).map((item) => (
                              <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--input-bg)" }}>
                                <span className="flex-1 text-sm" style={{ color: "var(--text)" }}>{item.name}</span>
                                <button onClick={() => setEditZoneData({ ...editZoneData, items: (editZoneData.items || []).filter((i) => i.id !== item.id) })}
                                  className="text-xs px-1" style={{ color: "var(--red)" }}>✕</button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input type="text" placeholder={isRTL ? "اسم العنصر الجديد..." : "New item name..."}
                              value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && newItemName.trim()) { setEditZoneData({ ...editZoneData, items: [...(editZoneData.items || []), { id: `item-${Date.now()}`, name: newItemName.trim() }] }); setNewItemName(""); } }}
                              className="input text-sm" style={{ flex: 1, width: 0 }} />
                            <button onClick={() => { if (newItemName.trim()) { setEditZoneData({ ...editZoneData, items: [...(editZoneData.items || []), { id: `item-${Date.now()}`, name: newItemName.trim() }] }); setNewItemName(""); } }}
                              className="btn btn-primary px-4 py-2 text-xs">+</button>
                          </div>
                        </div>
                        {/* Save / Cancel / Delete */}
                        <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                          <button onClick={() => {
                            setFloors((p) => p.map((fl) => fl.id === f.id ? { ...fl, zones: fl.zones.map((zn) => zn.id === z.id ? { ...zn, ...editZoneData } as Zone : zn) } : fl));
                            closeEditZone(); notify("✓");
                          }} className="btn btn-success flex-1 py-2 text-xs">💾 {t.save}</button>
                          <button onClick={closeEditZone} className="btn flex-1 py-2 text-xs" style={{ color: "var(--text2)" }}>
                            ✕ {isRTL ? "إلغاء" : "Cancel"}
                          </button>
                          {deleteConfirm === `zone:${f.id}:${z.id}` ? (
                            <button onClick={() => { setFloors((p) => p.map((fl) => fl.id === f.id ? { ...fl, zones: fl.zones.filter((zn) => zn.id !== z.id) } : fl)); closeEditZone(); notify(isRTL ? "تم حذف النشاط" : "Zone deleted"); }}
                              className="btn btn-danger px-3 py-2 text-xs">{isRTL ? "تأكيد الحذف" : "Confirm delete"}</button>
                          ) : (
                            <button onClick={() => setDeleteConfirm(`zone:${f.id}:${z.id}`)}
                              className="btn px-3 py-2 text-xs" style={{ color: "var(--red)", borderColor: "color-mix(in srgb, var(--red) 20%, transparent)" }}>🗑️</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* ── View mode ── */
                      <button onClick={() => { closeEditZone(); setEditZoneId(z.id); setEditZoneData({ ...z }); }}
                        className="w-full flex items-center gap-3 p-4 transition-all text-start hover:opacity-80">
                        <span className="text-xl flex-shrink-0">{z.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{z.name}</div>
                          <div className="text-xs" style={{ color: "var(--text2)" }}>
                            {z.items.length} {isRTL ? "عنصر" : "items"} · {pricingLabel(z.pricingMode)}
                          </div>
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: "var(--text2)" }}>✏️ {isRTL ? "تعديل" : "Edit"}</span>
                      </button>
                    )}
                  </div>
                ))}

                {/* ── Add zone to this floor ── */}
                {addZoneFloorId === f.id ? (
                  <div className="card p-4 mb-1 anim-fade" style={{ borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)" }}>
                    <div className="text-xs font-semibold mb-3" style={{ color: "var(--accent)" }}>+ {isRTL ? "نشاط جديد" : "New Activity"}</div>
                    <div className="flex gap-2 mb-3">
                      <button onClick={() => setShowNewZoneIconPicker(!showNewZoneIconPicker)}
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: "var(--input-bg)", border: "2px dashed color-mix(in srgb, var(--accent) 30%, transparent)" }}>
                        {newZoneData.icon}
                      </button>
                      <input type="text" value={newZoneData.name} onChange={(e) => setNewZoneData({ ...newZoneData, name: e.target.value })}
                        placeholder={isRTL ? "اسم النشاط (مثال: جاكارو)" : "Name (e.g. Jackaro)"}
                        className="input" style={{ flex: 1, width: 0 }} autoFocus />
                    </div>
                    {showNewZoneIconPicker && (
                      <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-xl" style={{ background: "var(--input-bg)" }}>
                        {ZONE_ICONS_LIST.map((ic) => (
                          <button key={ic} onClick={() => { setNewZoneData({ ...newZoneData, icon: ic }); setShowNewZoneIconPicker(false); }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                            style={{ background: newZoneData.icon === ic ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent", border: `1px solid ${newZoneData.icon === ic ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--border)"}` }}>
                            {ic}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{isRTL ? "نوع التسعير" : "Pricing mode"}</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {PRICING_MODES.map((pm) => (
                          <button key={pm.id} onClick={() => setNewZoneData({ ...newZoneData, pricingMode: pm.id })}
                            className="btn py-2 text-xs"
                            style={{ background: newZoneData.pricingMode === pm.id ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--input-bg)", color: newZoneData.pricingMode === pm.id ? "var(--accent)" : "var(--text2)", borderColor: newZoneData.pricingMode === pm.id ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "var(--border)" }}>
                            {pm.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {newZoneData.pricingMode === "hourly" && (
                      <div className="mb-3">
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.pricePerHour} (<SarSymbol size={11} />)</label>
                        <input type="number" value={newZoneData.pricePerHour} onChange={(e) => setNewZoneData({ ...newZoneData, pricePerHour: Number(e.target.value) })} className="input" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => {
                        if (!newZoneData.name.trim()) return;
                        const zone: Zone = { id: `zone-${Date.now()}`, name: newZoneData.name.trim(), icon: newZoneData.icon, pricePerHour: newZoneData.pricePerHour, minCharge: 0, pricingMode: newZoneData.pricingMode as Zone["pricingMode"], items: [] };
                        setFloors((p) => p.map((fl) => fl.id === f.id ? { ...fl, zones: [...fl.zones, zone] } : fl));
                        setAddZoneFloorId(null); setNewZoneData({ name: "", icon: "🎮", pricingMode: "hourly", pricePerHour: 0 }); setShowNewZoneIconPicker(false);
                        notify(isRTL ? "تمت إضافة النشاط ✓" : "Zone added ✓");
                      }} className="btn btn-primary flex-1 py-2.5 text-sm">+ {isRTL ? "إضافة" : "Add"}</button>
                      <button onClick={() => { setAddZoneFloorId(null); setNewZoneData({ name: "", icon: "🎮", pricingMode: "hourly", pricePerHour: 0 }); setShowNewZoneIconPicker(false); }}
                        className="btn px-4 py-2.5 text-sm" style={{ color: "var(--text2)" }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAddZoneFloorId(f.id); setEditZoneId(null); }}
                    className="btn w-full py-3 text-sm"
                    style={{ background: "color-mix(in srgb, var(--accent) 5%, transparent)", color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)", borderStyle: "dashed" }}>
                    + {isRTL ? "أضف نشاطاً لهذا الطابق" : "Add Activity to Floor"}
                  </button>
                )}
              </div>
            ))}

            {/* ── Add new floor ── */}
            <div className="mt-2">
              {showAddFloor ? (
                <div className="card p-4 anim-fade" style={{ borderColor: "color-mix(in srgb, var(--blue) 25%, transparent)" }}>
                  <div className="text-xs font-semibold mb-3" style={{ color: "var(--blue)" }}>🏢 {isRTL ? "طابق جديد" : "New Floor"}</div>
                  <div className="flex gap-2">
                    <input type="text" value={newFloorName} onChange={(e) => setNewFloorName(e.target.value)}
                      placeholder={isRTL ? "مثال: الطابق الثالث" : "e.g. Third Floor"} className="input" style={{ flex: 1, width: 0 }} autoFocus />
                    <button onClick={() => {
                      if (!newFloorName.trim()) return;
                      const counter = floors.find((f) => f.id === COUNTER_FLOOR_ID);
                      const rest = floors.filter((f) => f.id !== COUNTER_FLOOR_ID);
                      setFloors(counter ? [...rest, { id: `floor-${Date.now()}`, name: newFloorName.trim(), zones: [] }, counter] : [...rest, { id: `floor-${Date.now()}`, name: newFloorName.trim(), zones: [] }]);
                      setNewFloorName(""); setShowAddFloor(false); notify(isRTL ? "تمت إضافة الطابق ✓" : "Floor added ✓");
                    }} className="btn btn-primary px-4 py-2 text-sm">{isRTL ? "إضافة" : "Add"}</button>
                    <button onClick={() => { setShowAddFloor(false); setNewFloorName(""); }} className="btn px-3 py-2 text-sm" style={{ color: "var(--text2)" }}>✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddFloor(true)}
                  className="btn w-full py-3 text-sm"
                  style={{ background: "color-mix(in srgb, var(--blue) 5%, transparent)", color: "var(--blue)", borderColor: "color-mix(in srgb, var(--blue) 20%, transparent)", borderStyle: "dashed" }}>
                  🏢 + {isRTL ? "أضف طابقاً جديداً" : "Add New Floor"}
                </button>
              )}
            </div>
          </div>
        );
      })()}

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
            {/* Stock tracking */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={newMenuItem.trackStock} onChange={(e) => setNewMenuItem({ ...newMenuItem, trackStock: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]" />
                <span className="text-xs font-medium" style={{ color: "var(--text2)" }}>📦 {t.trackStock}</span>
              </label>
            </div>
            {newMenuItem.trackStock && (
              <div className="flex gap-3 mb-4 anim-fade">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.stock}</label>
                  <input type="number" min="0" placeholder="0" value={newMenuItem.stock || ""} onChange={(e) => setNewMenuItem({ ...newMenuItem, stock: Number(e.target.value) })}
                    className="input" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.lowStockAlert}</label>
                  <input type="number" min="0" placeholder="5" value={newMenuItem.lowStockThreshold || ""} onChange={(e) => setNewMenuItem({ ...newMenuItem, lowStockThreshold: Number(e.target.value) })}
                    className="input" />
                </div>
              </div>
            )}
            <button onClick={() => {
              if (newMenuItem.name && Number(newMenuItem.price) > 0) {
                const item: MenuItem = { id: `m${Date.now()}`, name: newMenuItem.name, price: Number(newMenuItem.price), cat: newMenuItem.cat, icon: newMenuItem.icon };
                if (newMenuItem.trackStock) { item.trackStock = true; item.stock = newMenuItem.stock || 0; item.lowStockThreshold = newMenuItem.lowStockThreshold || 5; }
                setMenu((p) => [...p, item]);
                setNewMenuItem({ name: "", price: "", cat: newMenuItem.cat, icon: "🥤", trackStock: false, stock: 0, lowStockThreshold: 5 }); notify(t.addedItem + " ✓");
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
                          className="input font-bold" style={{ flex: 1, width: 0 }} />
                        <input type="number" value={editItem.price} onChange={(e) => setEditItem({ ...editItem, price: e.target.value })}
                          className="input" style={{ width: "5rem", flexShrink: 0 }} />
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
                      {/* Stock tracking (edit mode) */}
                      <div className="mb-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={!!editItem.trackStock} onChange={(e) => setEditItem({ ...editItem, trackStock: e.target.checked })}
                            className="w-4 h-4 rounded accent-[var(--accent)]" />
                          <span className="text-xs font-medium" style={{ color: "var(--text2)" }}>📦 {t.trackStock}</span>
                        </label>
                      </div>
                      {editItem.trackStock && (
                        <div className="flex gap-3 mb-3 anim-fade">
                          <div className="flex-1">
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.stock}</label>
                            <input type="number" min="0" value={editItem.stock ?? 0} onChange={(e) => setEditItem({ ...editItem, stock: Number(e.target.value) })}
                              className="input" />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text2)" }}>{t.lowStockAlert}</label>
                            <input type="number" min="0" value={editItem.lowStockThreshold ?? 5} onChange={(e) => setEditItem({ ...editItem, lowStockThreshold: Number(e.target.value) })}
                              className="input" />
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => {
                          const updated: Partial<MenuItem> = { name: editItem.name, price: Number(editItem.price), icon: editItem.icon, trackStock: !!editItem.trackStock };
                          if (editItem.trackStock) { updated.stock = editItem.stock ?? 0; updated.lowStockThreshold = editItem.lowStockThreshold ?? 5; } else { updated.stock = undefined; updated.lowStockThreshold = undefined; }
                          setMenu((p) => p.map((x) => x.id === m.id ? { ...x, ...updated } : x));
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
                      {m.trackStock && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={
                          (m.stock ?? 0) === 0
                            ? { background: "color-mix(in srgb, var(--red) 15%, transparent)", color: "var(--red)" }
                            : (m.stock ?? 0) <= (m.lowStockThreshold ?? 5)
                              ? { background: "color-mix(in srgb, var(--yellow) 15%, transparent)", color: "var(--yellow)" }
                              : { background: "color-mix(in srgb, var(--green) 10%, transparent)", color: "var(--green)" }
                        }>
                          {(m.stock ?? 0) === 0 ? t.outOfStock : (m.stock ?? 0) <= (m.lowStockThreshold ?? 5) ? `⚠️ ${t.lowStock}` : `📦 ${m.stock}`}
                        </span>
                      )}
                      <button onClick={() => { setEditItem({ ...m, price: String(m.price), trackStock: m.trackStock, stock: m.stock, lowStockThreshold: m.lowStockThreshold }); setEditIconPicker(false); }}
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
                className="input"
                style={{ width: "7rem", flexShrink: 0 }}
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
                className="input"
                style={{ width: "6rem", flexShrink: 0 }}
                dir="ltr"
              />
              <span className="text-sm" style={{ color: "var(--text2)" }}>
                {isRTL ? "صباحاً (0–11)" : "AM (0–11)"}
              </span>
            </div>
          </div>

          {/* ── VAT / ZATCA ── */}
          <div className="card p-5" style={{ borderColor: settings.vatEnabled ? "color-mix(in srgb, var(--green) 30%, transparent)" : undefined }}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold" style={{ color: "var(--text2)" }}>
                🧾 {t.vatSection}
              </label>
              {/* Toggle */}
              <button
                onClick={() => setSettings((s) => ({ ...s, vatEnabled: !s.vatEnabled }))}
                className="text-xs px-3 py-1 rounded-full font-bold transition-all"
                style={settings.vatEnabled
                  ? { background: "color-mix(in srgb, var(--green) 15%, transparent)", color: "var(--green)", border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)" }
                  : { background: "var(--input-bg)", color: "var(--text2)", border: "1px solid var(--border)" }}>
                {settings.vatEnabled ? (isRTL ? "✓ مفعّل" : "✓ Enabled") : (isRTL ? "معطّل" : "Disabled")}
              </button>
            </div>
            <p className="text-[11px] mb-4" style={{ color: "var(--text2)", opacity: 0.6 }}>
              {t.vatEnabledNote}
            </p>

            {settings.vatEnabled && (
              <div className="flex flex-col gap-4">
                {/* VAT Number */}
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text2)" }}>
                    {t.vatNumber}
                  </label>
                  <p className="text-[11px] mb-2" style={{ color: "var(--text2)", opacity: 0.55 }}>
                    {t.vatNumberNote}
                  </p>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="300000000000003"
                    value={settings.vatNumber ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, vatNumber: e.target.value.replace(/\D/g, "").slice(0, 15) }))}
                    className="input w-full"
                    dir="ltr"
                  />
                  {settings.vatNumber && settings.vatNumber.length === 15 && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--green)" }}>✓ {isRTL ? "رقم صحيح (١٥ رقم)" : "Valid (15 digits)"}</p>
                  )}
                  {settings.vatNumber && settings.vatNumber.length > 0 && settings.vatNumber.length !== 15 && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--red)" }}>
                      {isRTL ? `${settings.vatNumber.length}/15 رقم` : `${settings.vatNumber.length}/15 digits`}
                    </p>
                  )}
                </div>

                {/* Seller Name Arabic */}
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text2)" }}>
                    {t.sellerNameAr}
                  </label>
                  <p className="text-[11px] mb-2" style={{ color: "var(--text2)", opacity: 0.55 }}>
                    {t.sellerNameArNote}
                  </p>
                  <input
                    type="text"
                    placeholder={isRTL ? "مركز الصملة للترفيه" : "Al Samlah Entertainment Center"}
                    value={settings.sellerNameAr ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, sellerNameAr: e.target.value }))}
                    className="input w-full"
                    dir="rtl"
                  />
                </div>
              </div>
            )}
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
