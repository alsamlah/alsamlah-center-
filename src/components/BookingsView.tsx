"use client";
import { useState, useMemo, useEffect } from "react";
import { T, type SystemSettings } from "@/lib/settings";
import { uid } from "@/lib/utils";
import type { Booking, Floor, Session } from "@/lib/supabase";

interface BookingsViewProps {
  bookings: Booking[];
  setBookings: (fn: (prev: Booking[]) => Booking[]) => void;
  floors: Floor[];
  sessions: Record<string, Session>;
  currentUser: string;
  settings: SystemSettings;
  notify: (msg: string) => void;
}

const DURATION_OPTIONS = [30, 60, 120, 180];

export default function BookingsView({
  bookings,
  setBookings,
  floors,
  sessions,
  currentUser,
  settings,
  notify,
}: BookingsViewProps) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";

  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<"upcoming" | "all">("upcoming");

  // Form state
  const [selectedItem, setSelectedItem] = useState("");
  const [custName, setCustName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMins, setDurationMins] = useState(60);
  const [notes, setNotes] = useState("");

  // Flatten all items from floors for the room dropdown
  const allItems = useMemo(() => {
    const items: { id: string; name: string; zoneName: string }[] = [];
    for (const floor of floors) {
      for (const zone of floor.zones) {
        for (const item of zone.items) {
          items.push({ id: item.id, name: item.name, zoneName: zone.name });
        }
      }
    }
    return items;
  }, [floors]);

  // Auto-update booking statuses
  useEffect(() => {
    const now = Date.now();
    let changed = false;
    setBookings((prev) =>
      prev.map((b) => {
        if (b.status === "upcoming" || b.status === "active") {
          const endTime = b.date + b.durationMins * 60000;
          if (endTime < now) {
            changed = true;
            return { ...b, status: "completed" as const };
          }
        }
        return b;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setSelectedItem("");
    setCustName("");
    setPhone("");
    setDate("");
    setTime("");
    setDurationMins(60);
    setNotes("");
    setShowForm(false);
  };

  const handleSave = () => {
    if (!selectedItem || !custName.trim() || !date || !time) return;

    // Check if room has an active session
    if (sessions[selectedItem]) {
      notify(t.roomOccupied);
      return;
    }

    const dateTime = new Date(`${date}T${time}`).getTime();
    if (isNaN(dateTime)) return;

    const itemInfo = allItems.find((i) => i.id === selectedItem);
    if (!itemInfo) return;

    const newBooking: Booking = {
      id: uid(),
      itemId: selectedItem,
      itemName: itemInfo.name,
      customerName: custName.trim(),
      phone: phone.trim() || undefined,
      date: dateTime,
      durationMins,
      notes: notes.trim() || undefined,
      status: "upcoming",
      createdBy: currentUser,
      createdAt: Date.now(),
    };

    setBookings((prev) => [...prev, newBooking]);
    notify(t.saved);
    resetForm();
  };

  const handleCancel = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "cancelled" as const } : b))
    );
    notify(t.done);
  };

  // Filtered & sorted bookings
  const displayBookings = useMemo(() => {
    const now = Date.now();
    let list = [...bookings];

    // Auto-mark completed
    list = list.map((b) => {
      if (b.status === "cancelled") return b;
      const endTime = b.date + b.durationMins * 60000;
      if (endTime < now && b.status !== "completed") {
        return { ...b, status: "completed" as const };
      }
      return b;
    });

    if (tab === "upcoming") {
      list = list.filter((b) => b.status === "upcoming" || b.status === "active");
      list.sort((a, b) => a.date - b.date);
    } else {
      list.sort((a, b) => b.date - a.date);
    }

    return list;
  }, [bookings, tab]);

  const statusColor = (s: Booking["status"]) => {
    switch (s) {
      case "upcoming": return "var(--blue)";
      case "active": return "var(--green)";
      case "completed": return "var(--text2)";
      case "cancelled": return "var(--red)";
    }
  };

  const statusLabel = (s: Booking["status"]) => {
    switch (s) {
      case "upcoming": return t.booked;
      case "active": return t.active;
      case "completed": return t.done;
      case "cancelled": return t.cancel;
    }
  };

  const fmtDuration = (mins: number) => {
    if (mins < 60) return isRTL ? `${mins} د` : `${mins}m`;
    const h = mins / 60;
    return isRTL ? `${h} ساعة` : `${h}h`;
  };

  const fmtBookingDate = (ts: number) =>
    new Date(ts).toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const fmtBookingTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(isRTL ? "ar-SA" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ padding: "1rem", maxWidth: 700, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)" }}>
          {t.bookings}
        </h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          style={{ fontSize: "0.85rem" }}
        >
          {showForm ? t.cancel : t.newBooking}
        </button>
      </div>

      {/* Booking Form */}
      {showForm && (
        <div
          className="card anim-fade-up"
          style={{ padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          {/* Room selection */}
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text2)", marginBottom: 4, display: "block" }}>
              {t.switchTo}
            </label>
            <select
              className="input"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">--</option>
              {allItems.map((item) => (
                <option key={item.id} value={item.id} disabled={!!sessions[item.id]}>
                  {item.name} — {item.zoneName} {sessions[item.id] ? `(${t.roomOccupied})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Customer name */}
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text2)", marginBottom: 4, display: "block" }}>
              {t.custName}
            </label>
            <input
              className="input"
              type="text"
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {/* Phone */}
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text2)", marginBottom: 4, display: "block" }}>
              {t.phone}
            </label>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {/* Date + Time row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", color: "var(--text2)", marginBottom: 4, display: "block" }}>
                {t.bookingDate}
              </label>
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.8rem", color: "var(--text2)", marginBottom: 4, display: "block" }}>
                {t.bookingTime}
              </label>
              <input
                className="input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text2)", marginBottom: 4, display: "block" }}>
              {t.duration}
            </label>
            <select
              className="input"
              value={durationMins}
              onChange={(e) => setDurationMins(Number(e.target.value))}
              style={{ width: "100%" }}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {fmtDuration(d)}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text2)", marginBottom: 4, display: "block" }}>
              {t.note}
            </label>
            <input
              className="input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!selectedItem || !custName.trim() || !date || !time}
              style={{ flex: 1 }}
            >
              {t.save}
            </button>
            <button className="btn btn-ghost" onClick={resetForm} style={{ flex: 1 }}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["upcoming", "all"] as const).map((key) => (
          <button
            key={key}
            className="btn"
            onClick={() => setTab(key)}
            style={{
              background: tab === key ? "var(--accent)" : "transparent",
              color: tab === key ? "#fff" : "var(--text2)",
              fontSize: "0.85rem",
              fontWeight: tab === key ? 600 : 400,
            }}
          >
            {key === "upcoming" ? t.upcomingBookings : t.all}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {displayBookings.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text2)", padding: "3rem 1rem" }}>
          {t.noBookings}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {displayBookings.map((b) => (
            <div
              key={b.id}
              className="card anim-fade"
              style={{
                padding: "0.85rem 1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
            >
              {/* Left side: info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "0.95rem" }}>
                    {b.itemName}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: `color-mix(in srgb, ${statusColor(b.status)} 18%, transparent)`,
                      color: statusColor(b.status),
                      fontSize: "0.7rem",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {statusLabel(b.status)}
                  </span>
                </div>

                <div style={{ color: "var(--text2)", fontSize: "0.82rem", marginTop: 4 }}>
                  {b.customerName}
                  {b.phone && <span style={{ opacity: 0.7 }}> &middot; {b.phone}</span>}
                </div>

                <div style={{ color: "var(--text2)", fontSize: "0.78rem", marginTop: 4, display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span>{fmtBookingDate(b.date)}</span>
                  <span>{fmtBookingTime(b.date)}</span>
                  <span>{fmtDuration(b.durationMins)}</span>
                </div>

                {b.notes && (
                  <div style={{ color: "var(--text2)", fontSize: "0.75rem", marginTop: 4, fontStyle: "italic", opacity: 0.8 }}>
                    {b.notes}
                  </div>
                )}
              </div>

              {/* Cancel button */}
              {b.status === "upcoming" && (
                <button
                  className="btn btn-danger"
                  onClick={() => handleCancel(b.id)}
                  style={{ fontSize: "0.75rem", whiteSpace: "nowrap", padding: "4px 10px" }}
                >
                  {t.cancelBooking}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
