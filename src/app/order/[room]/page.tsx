"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SarSymbol from "@/components/SarSymbol";
import { DEFAULT_MENU } from "@/lib/defaults";
import type { MenuItem } from "@/lib/supabase";

const EXTEND_OPTIONS = [
  { mins: 30,  label: "٣٠ دقيقة",  icon: "⏱" },
  { mins: 60,  label: "ساعة",       icon: "⏰" },
  { mins: 90,  label: "ساعة ونص",  icon: "⏰" },
  { mins: 120, label: "ساعتين",     icon: "⏰" },
];

function OrderPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.room as string;
  const tenantId = searchParams.get("t");
  const roomName = searchParams.get("name")
    ? decodeURIComponent(searchParams.get("name")!)
    : decodeURIComponent(roomId).replace(/-/g, " ");

  const [menu, setMenu] = useState<MenuItem[]>(DEFAULT_MENU);
  const [cat, setCat] = useState("مشروبات");
  const [cart, setCart] = useState<{ item: MenuItem; qty: number }[]>([]);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  // extend time
  const [extendMins, setExtendMins] = useState<number | null>(null);
  const [extendNote, setExtendNote] = useState("");

  // Load live menu from Supabase if tenant ID is present
  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("menu_items")
      .select("data")
      .eq("tenant_id", tenantId)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.data && Array.isArray(data.data)) {
          const loaded = data.data as MenuItem[];
          setMenu(loaded);
          // Reset category to first available
          if (loaded.length > 0) setCat(loaded[0].cat);
        }
      });
  }, [tenantId]);

  const isExtendTab = cat === "__extend__";
  const cats = [...new Set(menu.map((m) => m.cat))];
  const cartTotal = cart.reduce((s, c) => s + c.item.price * c.qty, 0);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) return prev.map((c) => (c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { item, qty: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === itemId);
      if (existing && existing.qty > 1) return prev.map((c) => (c.item.id === itemId ? { ...c, qty: c.qty - 1 } : c));
      return prev.filter((c) => c.item.id !== itemId);
    });
  };

  const sendOrder = async () => {
    if (cart.length === 0) return;
    setSending(true);
    try {
      const rows = cart.map((c) => ({
        room_id: roomId,
        room_name: roomName,
        item_name: c.item.name,
        item_icon: c.item.icon,
        item_price: c.item.price,
        qty: c.qty,
        status: "pending",
        customer_note: note || null,
        tenant_id: tenantId || null,
      }));
      await supabase.from("qr_orders").insert(rows);
      setSent(true);
      setCart([]);
      setNote("");
    } catch (e) {
      console.error(e);
    }
    setSending(false);
  };

  const sendExtend = async () => {
    if (!extendMins) return;
    setSending(true);
    try {
      const opt = EXTEND_OPTIONS.find((o) => o.mins === extendMins)!;
      await supabase.from("qr_orders").insert({
        room_id: roomId,
        room_name: roomName,
        item_name: `تمديد ${opt.label}`,
        item_icon: "⏰",
        item_price: 0,
        qty: 1,
        status: "pending",
        customer_note: extendNote || null,
        tenant_id: tenantId || null,
      });
      setSent(true);
      setExtendMins(null);
      setExtendNote("");
    } catch (e) {
      console.error(e);
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-black text-ctext mb-2">تم إرسال طلبك!</h1>
          <p className="text-ctext2 text-sm mb-6">طلبك وصل للكاشير وبيجهز لك</p>
          <button onClick={() => setSent(false)} className="bg-accent text-white font-bold py-3 px-8 rounded-xl text-sm">
            طلب مرة ثانية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-32">
      {/* Header */}
      <div className="bg-surface sticky top-0 z-50 border-b border-white/5 px-4 py-4">
        <div className="text-center">
          <h1 className="text-xl font-black">
            <span className="text-accent">AL</span>
            <span className="text-ctext2">SAMLAH</span>
          </h1>
          <p className="text-xs text-ctext2/50 mt-1">اطلب من مكانك</p>
        </div>
        <div className="mt-3 bg-accent/10 border border-accent/20 rounded-xl py-2 px-4 text-center">
          <span className="text-accent font-bold text-sm">📍 {roomName}</span>
        </div>
      </div>

      {/* Categories + Extend tab */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto pb-1">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${
              cat === c
                ? "bg-cyellow/10 text-cyellow border-cyellow/20"
                : "bg-bg2 text-ctext2/40 border-white/5"
            }`}
          >
            {c}
          </button>
        ))}
        {/* Extend time tab */}
        <button
          onClick={() => setCat("__extend__")}
          className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-all ${
            isExtendTab
              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
              : "bg-bg2 text-ctext2/40 border-white/5"
          }`}
        >
          ⏰ تمديد الوقت
        </button>
      </div>

      {/* Extend Time View */}
      {isExtendTab ? (
        <div className="px-4 mt-5">
          <p className="text-xs text-ctext2/50 text-center mb-4">اختر مدة التمديد المطلوبة</p>
          <div className="grid grid-cols-2 gap-3">
            {EXTEND_OPTIONS.map((opt) => (
              <button
                key={opt.mins}
                onClick={() => setExtendMins(extendMins === opt.mins ? null : opt.mins)}
                className={`rounded-2xl p-5 text-center border transition-all ${
                  extendMins === opt.mins
                    ? "border-blue-500/40 bg-blue-500/10"
                    : "bg-surface border-white/5"
                }`}
              >
                <div className="text-3xl">{opt.icon}</div>
                <div className={`text-sm font-bold mt-2 ${extendMins === opt.mins ? "text-blue-400" : "text-ctext"}`}>
                  {opt.label}
                </div>
              </button>
            ))}
          </div>

          {extendMins && (
            <div className="mt-4 animate-fade-in">
              <input
                value={extendNote}
                onChange={(e) => setExtendNote(e.target.value)}
                placeholder="ملاحظة للكاشير (اختياري)..."
                className="w-full bg-surface border border-white/5 rounded-xl px-4 py-3 text-xs text-ctext mb-3 outline-none placeholder:text-ctext2/30"
              />
              <button
                onClick={sendExtend}
                disabled={sending}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-sm disabled:opacity-50"
              >
                {sending ? "جاري الإرسال..." : `⏰ طلب تمديد ${EXTEND_OPTIONS.find((o) => o.mins === extendMins)?.label}`}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Menu Items */
        <div className="grid grid-cols-2 gap-3 px-4 mt-4">
          {menu
            .filter((m) => m.cat === cat)
            .map((m) => {
              const inCart = cart.find((c) => c.item.id === m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => addToCart(m)}
                  className={`relative bg-surface border rounded-2xl p-4 text-center transition-all ${
                    inCart ? "border-accent/30 bg-accent/5" : "border-white/5"
                  }`}
                >
                  {inCart && (
                    <div className="absolute top-2 left-2 bg-accent text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      {inCart.qty}
                    </div>
                  )}
                  <div className="text-3xl">{m.icon}</div>
                  <div className="text-sm font-bold mt-2 text-ctext">{m.name}</div>
                  <div className="text-xs font-extrabold text-cyellow mt-1 flex items-center justify-center gap-0.5">{m.price} <SarSymbol size={10} /></div>
                </button>
              );
            })}
        </div>
      )}

      {/* Cart Footer (food orders only) */}
      {!isExtendTab && cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-lg border-t border-white/5 p-4 z-50 animate-fade-in">
          {/* Cart Items */}
          <div className="flex flex-wrap gap-2 mb-3">
            {cart.map((c) => (
              <div key={c.item.id} className="flex items-center gap-2 bg-bg2 rounded-lg px-3 py-1.5 border border-white/5">
                <span className="text-sm">{c.item.icon}</span>
                <span className="text-xs font-bold text-ctext">{c.item.name}</span>
                <span className="text-xs text-ctext2">×{c.qty}</span>
                <button onClick={() => removeFromCart(c.item.id)} className="text-cred text-xs font-bold mr-1">✕</button>
              </div>
            ))}
          </div>

          {/* Note */}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة (اختياري)..."
            className="w-full bg-bg2 border border-white/5 rounded-lg px-3 py-2 text-xs text-ctext mb-3 outline-none placeholder:text-ctext2/30"
          />

          {/* Send Button */}
          <button
            onClick={sendOrder}
            disabled={sending}
            className="w-full bg-accent text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? "جاري الإرسال..." : <><span>إرسال الطلب • {cartTotal}</span> <SarSymbol size={13} /></>}
          </button>
        </div>
      )}
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-sm" style={{ color: "var(--text2)", opacity: 0.5 }}>جاري التحميل...</div>
      </div>
    }>
      <OrderPageInner />
    </Suspense>
  );
}
