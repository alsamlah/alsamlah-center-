"use client";

import { useState } from "react";
import type { MaintenanceLog, Floor, ItemStatus } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { uid, fmtMoney } from "@/lib/utils";
import SarSymbol from "@/components/SarSymbol";

interface MaintenanceViewProps {
  maintenanceLogs: MaintenanceLog[];
  setMaintenanceLogs: (fn: (prev: MaintenanceLog[]) => MaintenanceLog[]) => void;
  floors: Floor[];
  setFloors: (fn: (prev: Floor[]) => Floor[]) => void;
  settings: SystemSettings;
  notify: (msg: string) => void;
  currentUser: string;
}

const STATUS_CYCLE: ItemStatus[] = ["active", "maintenance", "disabled"];

export default function MaintenanceView({
  maintenanceLogs,
  setMaintenanceLogs,
  floors,
  setFloors,
  settings,
  notify,
  currentUser,
}: MaintenanceViewProps) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";

  const [tab, setTab] = useState<"status" | "log">("status");
  const [showLogForm, setShowLogForm] = useState(false);
  const [editLogId, setEditLogId] = useState<string | null>(null);

  // Maintenance note prompt
  const [notePromptItem, setNotePromptItem] = useState<{ itemId: string; zoneName: string; itemName: string } | null>(null);
  const [maintenanceNote, setMaintenanceNote] = useState("");

  // Log form state
  const [logItemId, setLogItemId] = useState("");
  const [logType, setLogType] = useState<"repair" | "routine" | "inspection">("repair");
  const [logDescription, setLogDescription] = useState("");
  const [logCost, setLogCost] = useState(0);
  const [logStatus, setLogStatus] = useState<"pending" | "in-progress" | "completed">("pending");
  const [logPerformedBy, setLogPerformedBy] = useState("");

  // Flatten all items across floors/zones
  const allItems = floors.flatMap(f =>
    f.zones.flatMap(z =>
      z.items.map(item => ({
        ...item,
        zoneName: z.name,
        zoneId: z.id,
        floorName: f.name,
        floorId: f.id,
      }))
    )
  );

  function resetLogForm() {
    setLogItemId("");
    setLogType("repair");
    setLogDescription("");
    setLogCost(0);
    setLogStatus("pending");
    setLogPerformedBy("");
    setEditLogId(null);
    setShowLogForm(false);
  }

  function openEditLog(log: MaintenanceLog) {
    setLogItemId(log.itemId);
    setLogType(log.type);
    setLogDescription(log.description);
    setLogCost(log.cost);
    setLogStatus(log.status);
    setLogPerformedBy(log.performedBy);
    setEditLogId(log.id);
    setShowLogForm(true);
  }

  function handleSaveLog() {
    if (!logItemId || !logDescription.trim()) return;
    const item = allItems.find(i => i.id === logItemId);
    if (!item) return;

    const entry: MaintenanceLog = {
      id: editLogId || uid(),
      itemId: logItemId,
      itemName: item.name,
      zoneName: item.zoneName,
      type: logType,
      description: logDescription.trim(),
      cost: logCost,
      status: logStatus,
      startDate: editLogId
        ? (maintenanceLogs.find(l => l.id === editLogId)?.startDate ?? Date.now())
        : Date.now(),
      endDate: logStatus === "completed" ? Date.now() : undefined,
      performedBy: logPerformedBy.trim() || currentUser,
    };

    if (editLogId) {
      setMaintenanceLogs(prev => prev.map(l => l.id === editLogId ? entry : l));
    } else {
      setMaintenanceLogs(prev => [...prev, entry]);
    }
    notify(t.saved);
    resetLogForm();
  }

  function markCompleted(id: string) {
    setMaintenanceLogs(prev =>
      prev.map(l => l.id === id ? { ...l, status: "completed" as const, endDate: Date.now() } : l)
    );
    notify(t.saved);
  }

  function handleStatusToggle(itemId: string, currentStatus: ItemStatus | undefined) {
    const cur = currentStatus || "active";
    const nextIdx = (STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length;
    const nextStatus = STATUS_CYCLE[nextIdx];

    if (nextStatus === "maintenance") {
      const item = allItems.find(i => i.id === itemId);
      if (item) {
        setNotePromptItem({ itemId, zoneName: item.zoneName, itemName: item.name });
        setMaintenanceNote("");
      }
      return;
    }

    applyStatusChange(itemId, nextStatus);
  }

  function applyStatusChange(itemId: string, newStatus: ItemStatus, note?: string) {
    setFloors(prev =>
      prev.map(f => ({
        ...f,
        zones: f.zones.map(z => ({
          ...z,
          items: z.items.map(item =>
            item.id === itemId
              ? { ...item, status: newStatus, maintenanceNote: note || item.maintenanceNote }
              : item
          ),
        })),
      }))
    );
    notify(t.saved);
  }

  function confirmMaintenanceNote() {
    if (!notePromptItem) return;
    applyStatusChange(notePromptItem.itemId, "maintenance", maintenanceNote.trim() || undefined);
    setNotePromptItem(null);
    setMaintenanceNote("");
  }

  function statusBadge(status: ItemStatus | undefined) {
    const s = status || "active";
    const map: Record<ItemStatus, { icon: string; label: string; color: string }> = {
      active: { icon: "\uD83D\uDFE2", label: isRTL ? "يعمل" : "Active", color: "var(--green)" },
      maintenance: { icon: "\uD83D\uDD27", label: isRTL ? "صيانة" : "Maintenance", color: "var(--yellow)" },
      disabled: { icon: "\u26D4", label: isRTL ? "معطل" : "Disabled", color: "var(--red)" },
    };
    return map[s];
  }

  function logTypeBadge(lt: "repair" | "routine" | "inspection") {
    const map: Record<string, { label: string; color: string }> = {
      repair: { label: t.repair, color: "var(--red)" },
      routine: { label: t.routine, color: "var(--blue)" },
      inspection: { label: t.inspection, color: "var(--yellow)" },
    };
    return map[lt];
  }

  function logStatusBadge(ls: "pending" | "in-progress" | "completed") {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: isRTL ? "قيد الانتظار" : "Pending", color: "var(--yellow)" },
      "in-progress": { label: isRTL ? "جاري العمل" : "In Progress", color: "var(--blue)" },
      completed: { label: isRTL ? "مكتمل" : "Completed", color: "var(--green)" },
    };
    return map[ls];
  }

  const totalCost = maintenanceLogs.reduce((sum, l) => sum + l.cost, 0);

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
    });

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="anim-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <h2 style={{ margin: 0, fontSize: "1.2em" }}>
        {t.maintenance}
      </h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: 10, padding: 3 }}>
        {([
          { id: "status" as const, label: t.maintenanceStatus },
          { id: "log" as const, label: t.maintenanceLog },
        ]).map(tb => (
          <button
            key={tb.id}
            className="btn"
            onClick={() => setTab(tb.id)}
            style={{
              flex: 1,
              background: tab === tb.id ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "transparent",
              color: tab === tb.id ? "var(--accent)" : "var(--text2)",
              fontWeight: tab === tb.id ? 600 : 400,
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: "0.9em",
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* ─── Device Status Tab ─── */}
      {tab === "status" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {allItems.map(item => {
            const badge = statusBadge(item.status);
            return (
              <button
                key={item.id}
                className="card"
                onClick={() => handleStatusToggle(item.id, item.status)}
                style={{
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  cursor: "pointer",
                  textAlign: isRTL ? "right" : "left",
                  border: `1.5px solid color-mix(in srgb, ${badge.color} 30%, var(--border))`,
                  background: `color-mix(in srgb, ${badge.color} 5%, var(--surface))`,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "0.95em" }}>{item.name}</span>
                <span style={{ fontSize: "0.8em", color: "var(--text2)" }}>{item.zoneName}</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.8em",
                    color: badge.color,
                    fontWeight: 500,
                    background: `color-mix(in srgb, ${badge.color} 12%, transparent)`,
                    padding: "2px 8px",
                    borderRadius: 6,
                    alignSelf: "flex-start",
                  }}
                >
                  {badge.icon} {badge.label}
                </span>
                {item.maintenanceNote && item.status === "maintenance" && (
                  <span style={{ fontSize: "0.75em", color: "var(--text2)", fontStyle: "italic" }}>
                    {item.maintenanceNote}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Maintenance note prompt modal */}
      {notePromptItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setNotePromptItem(null)}
        >
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{ padding: 20, maxWidth: 360, width: "90%", display: "flex", flexDirection: "column", gap: 12 }}
          >
            <h3 style={{ margin: 0, fontSize: "1em" }}>
              {notePromptItem.itemName} — {t.inMaintenance}
            </h3>
            <textarea
              className="input"
              placeholder={t.note}
              value={maintenanceNote}
              onChange={e => setMaintenanceNote(e.target.value)}
              rows={3}
              style={{ width: "100%", resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setNotePromptItem(null)}>{t.cancel}</button>
              <button className="btn btn-primary" onClick={confirmMaintenanceNote}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Maintenance Log Tab ─── */}
      {tab === "log" && (
        <>
          {/* Cost summary */}
          {maintenanceLogs.length > 0 && (
            <div
              className="card"
              style={{
                padding: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
              }}
            >
              <span style={{ fontWeight: 500, color: "var(--text2)", fontSize: "0.9em" }}>{t.maintenanceCost}</span>
              <span style={{ fontWeight: 700, fontSize: "1.1em", display: "flex", alignItems: "center", gap: 4 }}>
                {fmtMoney(totalCost)} <SarSymbol size={14} />
              </span>
            </div>
          )}

          {/* Add log button */}
          {!showLogForm && (
            <button
              className="btn btn-primary"
              onClick={() => setShowLogForm(true)}
              style={{ alignSelf: "flex-start", fontSize: "0.9em" }}
            >
              + {t.addMaintenanceLog}
            </button>
          )}

          {/* Add / Edit Log Form */}
          {showLogForm && (
            <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Select item */}
              <select
                className="input"
                value={logItemId}
                onChange={e => setLogItemId(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">{isRTL ? "اختر الجهاز" : "Select Device"}</option>
                {allItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.zoneName}
                  </option>
                ))}
              </select>

              {/* Type */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["repair", "routine", "inspection"] as const).map(lt => {
                  const badge = logTypeBadge(lt);
                  const selected = logType === lt;
                  return (
                    <button
                      key={lt}
                      className="btn"
                      onClick={() => setLogType(lt)}
                      style={{
                        background: selected ? `color-mix(in srgb, ${badge.color} 20%, transparent)` : "var(--surface)",
                        border: `1.5px solid ${selected ? badge.color : "var(--border)"}`,
                        color: selected ? badge.color : "var(--text2)",
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      {badge.label}
                    </button>
                  );
                })}
              </div>

              {/* Description */}
              <textarea
                className="input"
                placeholder={isRTL ? "وصف المشكلة / العمل" : "Description"}
                value={logDescription}
                onChange={e => setLogDescription(e.target.value)}
                rows={3}
                style={{ width: "100%", resize: "vertical" }}
              />

              {/* Cost */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ color: "var(--text2)", minWidth: 80, fontSize: "0.9em" }}>{t.maintenanceCost}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={logCost}
                  onChange={e => setLogCost(Number(e.target.value))}
                  style={{ width: 100 }}
                />
                <SarSymbol size={14} />
              </div>

              {/* Status */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["pending", "in-progress", "completed"] as const).map(ls => {
                  const badge = logStatusBadge(ls);
                  const selected = logStatus === ls;
                  return (
                    <button
                      key={ls}
                      className="btn"
                      onClick={() => setLogStatus(ls)}
                      style={{
                        background: selected ? `color-mix(in srgb, ${badge.color} 20%, transparent)` : "var(--surface)",
                        border: `1.5px solid ${selected ? badge.color : "var(--border)"}`,
                        color: selected ? badge.color : "var(--text2)",
                        fontWeight: selected ? 600 : 400,
                        fontSize: "0.85em",
                      }}
                    >
                      {badge.label}
                    </button>
                  );
                })}
              </div>

              {/* Performed by */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ color: "var(--text2)", minWidth: 80, fontSize: "0.9em" }}>
                  {isRTL ? "بواسطة" : "By"}
                </label>
                <input
                  className="input"
                  value={logPerformedBy}
                  onChange={e => setLogPerformedBy(e.target.value)}
                  placeholder={currentUser}
                  style={{ flex: 1 }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn" onClick={resetLogForm}>{t.cancel}</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveLog}
                  disabled={!logItemId || !logDescription.trim()}
                >
                  {t.save}
                </button>
              </div>
            </div>
          )}

          {/* Log list */}
          {maintenanceLogs.length === 0 && !showLogForm && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>
              {t.noMaintenanceLogs}
            </div>
          )}

          {[...maintenanceLogs]
            .sort((a, b) => b.startDate - a.startDate)
            .map(log => {
              const tb = logTypeBadge(log.type);
              const sb = logStatusBadge(log.status);
              return (
                <div
                  key={log.id}
                  className="card"
                  style={{
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    opacity: log.status === "completed" ? 0.7 : 1,
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{log.itemName}</span>
                      <span style={{ fontSize: "0.8em", color: "var(--text2)" }}>({log.zoneName})</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: "0.75em",
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: `color-mix(in srgb, ${tb.color} 15%, transparent)`,
                          color: tb.color,
                          fontWeight: 500,
                        }}
                      >
                        {tb.label}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75em",
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: `color-mix(in srgb, ${sb.color} 15%, transparent)`,
                          color: sb.color,
                          fontWeight: 500,
                        }}
                      >
                        {sb.label}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ margin: 0, fontSize: "0.9em", color: "var(--text2)" }}>{log.description}</p>

                  {/* Bottom info */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: "0.8em", color: "var(--text2)", alignItems: "center" }}>
                    {log.cost > 0 && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontWeight: 600, color: "var(--text)" }}>
                        {fmtMoney(log.cost)} <SarSymbol size={12} />
                      </span>
                    )}
                    <span>{formatDate(log.startDate)}</span>
                    {log.performedBy && <span>{isRTL ? "بواسطة" : "By"}: {log.performedBy}</span>}
                  </div>

                  {/* Actions */}
                  {log.status !== "completed" && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-success"
                        style={{ fontSize: "0.8em", padding: "4px 10px" }}
                        onClick={() => markCompleted(log.id)}
                      >
                        {isRTL ? "اكتمل" : "Complete"}
                      </button>
                      <button
                        className="btn"
                        style={{ fontSize: "0.8em", padding: "4px 10px" }}
                        onClick={() => openEditLog(log)}
                      >
                        {t.edit}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </>
      )}
    </div>
  );
}
