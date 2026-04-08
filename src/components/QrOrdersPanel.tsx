"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { QrOrder } from "@/lib/supabase";
import { registerSW, notifPermission, requestNotifPermission, showOrderNotification } from "@/lib/push";
import SarSymbol from "./SarSymbol";

interface Props {
  tenantId: string | null;
  logo?: string | null;
}

export default function QrOrdersPanel({ tenantId, logo }: Props) {
  const [orders, setOrders] = useState<QrOrder[]>([]);
  const [notifPerm, setNotifPerm] = useState<ReturnType<typeof notifPermission>>("default");
  const logoRef = useRef(logo);
  logoRef.current = logo;


  // Register service worker + sync permission state on mount
  useEffect(() => {
    registerSW();
    setNotifPerm(notifPermission());
  }, []);

  const handleToggleNotif = async () => {
    if (notifPerm === "granted") {
      alert("لإيقاف الإشعارات، افتح إعدادات المتصفح → الأذونات وأوقف الإشعارات لهذا الموقع.");
      return;
    }
    const result = await requestNotifPermission();
    setNotifPerm(result);
  };

  useEffect(() => {
    const loadOrders = async () => {
      let query = supabase
        .from("qr_orders")
        .select("*")
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false });

      if (tenantId) query = query.eq("tenant_id", tenantId);

      const { data } = await query;
      if (data) setOrders(data);
    };
    loadOrders();

    const channel = supabase
      .channel(`qr-orders-${tenantId ?? "all"}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "qr_orders",
        ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {}),
      }, (payload) => {
        const newOrder = payload.new as QrOrder;
        setOrders((prev) => [newOrder, ...prev]);
        // Browser notification (sound handled globally in CashierSystem)
        const isExtend = newOrder.item_icon === "⏰";
        showOrderNotification({
          title: isExtend ? "⏰ طلب تمديد وقت" : `📱 طلب جديد — ${newOrder.room_name}`,
          body: isExtend
            ? `${newOrder.room_name}: ${newOrder.item_name}`
            : `${newOrder.item_icon} ${newOrder.item_name} ×${newOrder.qty}${newOrder.customer_note ? ` — ${newOrder.customer_note}` : ""}`,
          tag: `qr-${newOrder.id}`,
          logo: logoRef.current,
        });
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "qr_orders",
        ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {}),
      }, (payload) => {
        const updated = payload.new as QrOrder;
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "qr_orders",
        ...(tenantId ? { filter: `tenant_id=eq.${tenantId}` } : {}),
      }, (payload) => {
        const deleted = payload.old as QrOrder;
        setOrders((prev) => prev.filter((o) => o.id !== deleted.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("qr_orders").update({ status }).eq("id", id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: status as QrOrder["status"] } : o)));
  };

  const deleteOrder = async (id: string) => {
    await supabase.from("qr_orders").delete().eq("id", id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const clearDelivered = async () => {
    let query = supabase.from("qr_orders").delete().eq("status", "delivered");
    if (tenantId) query = query.eq("tenant_id", tenantId);
    await query;
    setOrders((prev) => prev.filter((o) => o.status !== "delivered"));
  };

  const pending = orders.filter((o) => o.status === "pending");

  const fmtTime = (ts: string) =>
    new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });

  const statusColor: Record<string, string> = {
    pending: "var(--yellow)",
    accepted: "var(--blue)",
    delivered: "var(--green)",
    rejected: "var(--red)",
  };

  const statusLabel: Record<string, string> = {
    pending: "⏳ بانتظار",
    accepted: "✓ جاري التحضير",
    delivered: "✅ تم التوصيل",
    rejected: "✕ مرفوض",
  };

  const isExtend = (o: QrOrder) => o.item_icon === "⏰";

  // Notification button label / style
  const notifBtn = (() => {
    if (notifPerm === "unsupported") return null;
    if (notifPerm === "granted")
      return { label: "🔔 إشعارات مفعّلة", style: { color: "var(--green)", borderColor: "color-mix(in srgb,var(--green) 25%,transparent)", background: "color-mix(in srgb,var(--green) 8%,transparent)" } };
    if (notifPerm === "denied")
      return { label: "🔕 الإشعارات محظورة", style: { color: "var(--text2)", opacity: 0.5, cursor: "default" } };
    return { label: "🔔 تفعيل الإشعارات", style: { color: "var(--accent)", borderColor: "color-mix(in srgb,var(--accent) 25%,transparent)", background: "color-mix(in srgb,var(--accent) 8%,transparent)" } };
  })();

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>📱 طلبات QR الواردة</h2>
        <div className="flex items-center gap-2">
          {notifBtn && (
            <button
              onClick={notifPerm === "denied" ? undefined : handleToggleNotif}
              className="btn text-xs py-1.5 px-3"
              style={notifBtn.style}>
              {notifBtn.label}
            </button>
          )}
          {pending.length > 0 && (
            <span className="badge px-3 py-1.5 anim-pulse"
              style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
              {pending.length} جديد
            </span>
          )}
        </div>
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text2)", opacity: 0.4 }}>لا توجد طلبات QR</div>
      ) : (
        <div className="grid gap-3">
          {orders.map((order) => {
            const extend = isExtend(order);
            return (
              <div key={order.id} className="card p-4 transition-all"
                style={{
                  borderColor: `color-mix(in srgb, ${extend && order.status === "pending" ? "var(--blue)" : statusColor[order.status]} 25%, transparent)`,
                  background: extend && order.status === "pending" ? "color-mix(in srgb, var(--blue) 4%, var(--surface))" : undefined,
                }}>

                {/* Extend badge */}
                {extend && (
                  <div className="text-[10px] font-bold mb-2 px-2 py-0.5 rounded-full inline-block"
                    style={{ background: "color-mix(in srgb, var(--blue) 15%, transparent)", color: "var(--blue)" }}>
                    ⏰ طلب تمديد وقت
                  </div>
                )}

                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{order.item_icon}</span>
                      <span className="font-bold text-sm" style={{ color: extend ? "var(--blue)" : "var(--text)" }}>
                        {order.item_name}
                      </span>
                      {!extend && (
                        <span className="badge px-2 py-0.5 text-xs"
                          style={{ background: "var(--input-bg)", color: "var(--text2)" }}>
                          ×{order.qty}
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-1.5" style={{ color: "var(--text2)" }}>
                      📍 {order.room_name} • {fmtTime(order.created_at)}
                    </div>
                    {order.customer_note && (
                      <div className="text-xs mt-1" style={{ color: "var(--yellow)" }}>💬 {order.customer_note}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {!extend && (
                      <span className="text-sm font-bold flex items-center gap-1" style={{ color: "var(--yellow)" }}>
                        {order.item_price * order.qty} <SarSymbol size={13} />
                      </span>
                    )}
                    <span className="text-[10px] font-semibold"
                      style={{ color: extend && order.status === "pending" ? "var(--blue)" : statusColor[order.status] }}>
                      {statusLabel[order.status]}
                    </span>
                  </div>
                </div>

                {order.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => updateStatus(order.id, "accepted")}
                      className="btn flex-1 py-2.5 text-xs"
                      style={{ background: "color-mix(in srgb, var(--blue) 12%, transparent)", color: "var(--blue)", borderColor: "color-mix(in srgb, var(--blue) 20%, transparent)" }}>
                      {extend ? "⏰ تم التمديد" : "✓ قبول"}
                    </button>
                    <button onClick={() => updateStatus(order.id, "rejected")}
                      className="btn btn-danger py-2.5 px-4 text-xs">✕</button>
                  </div>
                )}

                {order.status === "accepted" && !extend && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => updateStatus(order.id, "delivered")}
                      className="btn btn-success flex-1 py-2.5 text-xs">✅ تم التوصيل</button>
                  </div>
                )}

                {(order.status === "delivered" || order.status === "rejected" || (extend && order.status === "accepted")) && (
                  <button onClick={() => deleteOrder(order.id)}
                    className="text-[10px] mt-2" style={{ color: "var(--text2)", opacity: 0.5 }}>حذف</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {orders.some((o) => o.status === "delivered") && (
        <button onClick={clearDelivered} className="btn btn-ghost w-full py-3 text-xs mt-4">
          🗑 مسح الطلبات المكتملة
        </button>
      )}
    </div>
  );
}
