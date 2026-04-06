"use client";

import React, { useState } from "react";
import type { InspectionRegister, RegisterEntry, RegisterType, UserRole } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";
import { uid } from "@/lib/utils";
import { REGISTER_SCHEMAS, REGISTER_TYPES, getStatusColor, getStatusBg } from "@/lib/registerSchemas";

interface Props {
  registers: InspectionRegister[];
  settings: SystemSettings;
  role: UserRole;
  logo: string | null;
  notify: (msg: string) => void;
  onUpsert: (register: InspectionRegister) => void;
}

export default function RegistersView({ registers, settings, role, logo, notify, onUpsert }: Props) {
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const isManager = role === "manager";

  const [activeTab, setActiveTab] = useState<RegisterType>("equipment");
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RegisterEntry | null>(null);

  const schema = REGISTER_SCHEMAS[activeTab];
  const register = registers.find((r) => r.type === activeTab);
  const entries = register?.entries ?? [];

  // ── Get or create register for active tab ──
  function getOrCreateRegister(): InspectionRegister {
    if (register) return register;
    return {
      id: uid(),
      type: activeTab,
      entries: [],
      updatedAt: Date.now(),
      updatedBy: role,
    };
  }

  function handleSaveEntry(fields: Record<string, string>, status: "ok" | "pending" | "issue") {
    const reg = getOrCreateRegister();
    const now = Date.now();

    if (editingEntry) {
      const updated: InspectionRegister = {
        ...reg,
        entries: reg.entries.map((e) =>
          e.id === editingEntry.id ? { ...e, fields, status, updatedAt: now } : e
        ),
        updatedAt: now,
        updatedBy: role,
      };
      onUpsert(updated);
    } else {
      const newEntry: RegisterEntry = {
        id: uid(),
        fields,
        status,
        createdAt: now,
        updatedAt: now,
      };
      const updated: InspectionRegister = {
        ...reg,
        entries: [...reg.entries, newEntry],
        updatedAt: now,
        updatedBy: role,
      };
      onUpsert(updated);
    }

    setShowForm(false);
    setEditingEntry(null);
    notify(t.regSaved);
  }

  function handleDeleteEntry(entryId: string) {
    if (!confirm(t.confirmDeleteEntry)) return;
    const reg = getOrCreateRegister();
    const updated: InspectionRegister = {
      ...reg,
      entries: reg.entries.filter((e) => e.id !== entryId),
      updatedAt: Date.now(),
      updatedBy: role,
    };
    onUpsert(updated);
    notify(t.regDeleted);
  }

  function handleExportExcel() {
    const schemaName = isRTL ? schema.name : schema.nameEn;
    const today = new Date().toISOString().slice(0, 10);
    const cols = schema.columns;
    const statusLabel = isRTL ? "الحالة" : "Status";

    const headerHtml = `
      <tr>
        <td colspan="${cols.length + 2}" style="text-align:center;font-size:18px;font-weight:bold;padding:12px;">
          ${logo ? `<img src="${logo}" height="60" style="display:block;margin:0 auto 8px;"/>` : ""}
          مركز الصملة الترفيهي - الرياض
        </td>
      </tr>
      <tr>
        <td colspan="${cols.length + 2}" style="text-align:center;font-size:14px;font-weight:bold;padding:4px;">
          ${schemaName}
        </td>
      </tr>
      <tr>
        <td colspan="${cols.length + 2}" style="text-align:center;font-size:12px;padding:4px 4px 12px;">
          التاريخ: ${today}
        </td>
      </tr>
    `;

    const colHeaders = `<tr style="background:#2563eb;color:#fff;font-weight:bold;">
      <th style="padding:6px;border:1px solid #ccc;">م</th>
      ${cols.map((c) => `<th style="padding:6px;border:1px solid #ccc;">${isRTL ? c.label : c.labelEn}</th>`).join("")}
      <th style="padding:6px;border:1px solid #ccc;">${statusLabel}</th>
    </tr>`;

    const rows = entries.map((entry, i) => {
      const statusText = schema.statusOptions.find((_, idx) =>
        (["ok", "pending", "issue"] as const)[idx] === entry.status
      ) ?? entry.status;
      const bgColor = entry.status === "ok" ? "#d1fae5" : entry.status === "pending" ? "#fef3c7" : "#fee2e2";

      return `<tr>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${i + 1}</td>
        ${cols.map((c) => `<td style="padding:4px;border:1px solid #ccc;">${entry.fields[c.key] ?? ""}</td>`).join("")}
        <td style="padding:4px;border:1px solid #ccc;background:${bgColor};text-align:center;">${statusText}</td>
      </tr>`;
    }).join("");

    const html = `
      <html dir="rtl"><head><meta charset="utf-8"></head>
      <body>
        <table style="border-collapse:collapse;width:100%;font-family:Tahoma,sans-serif;">
          ${headerHtml}
          ${colHeaders}
          ${rows}
        </table>
      </body></html>
    `;

    const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema.name}_${today}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Tab labels ──
  const tabLabels: Record<RegisterType, string> = {
    equipment: isRTL ? "🔧 صيانة الأجهزة" : "🔧 Equipment",
    cleaning: isRTL ? "🧹 النظافة" : "🧹 Cleaning",
    playstation: isRTL ? "🎮 البلايستيشن" : "🎮 PlayStation",
    pestcontrol: isRTL ? "🪲 رش المبيدات" : "🪲 Pest Control",
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ padding: "1rem", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>📋 {t.registers}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => { setEditingEntry(null); setShowForm(true); }}>
            + {t.addEntry}
          </button>
          <button className="btn" onClick={handleExportExcel} style={{ background: "color-mix(in srgb, var(--green) 15%, transparent)", color: "var(--green)" }}>
            📥 {t.exportExcel}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: "1rem", paddingBottom: 4 }}>
        {REGISTER_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => { setActiveTab(type); setShowForm(false); setEditingEntry(null); }}
            className="btn"
            style={{
              background: activeTab === type ? "var(--accent)" : "var(--surface)",
              color: activeTab === type ? "#fff" : "var(--text)",
              whiteSpace: "nowrap",
              fontSize: "0.85rem",
              padding: "6px 12px",
            }}
          >
            {tabLabels[type]}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <EntryForm
          schema={schema}
          entry={editingEntry}
          isRTL={isRTL}
          t={t}
          onSave={handleSaveEntry}
          onCancel={() => { setShowForm(false); setEditingEntry(null); }}
        />
      )}

      {/* Table */}
      {entries.length === 0 && !showForm ? (
        <div className="card" style={{ textAlign: "center", padding: "2rem", color: "var(--text2)" }}>
          {t.noEntries}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
                <th style={thStyle}>م</th>
                {schema.columns.map((col) => (
                  <th key={col.key} style={thStyle}>
                    {isRTL ? col.label : col.labelEn}
                  </th>
                ))}
                <th style={thStyle}>{isRTL ? "الحالة" : "Status"}</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const statusText = schema.statusOptions[
                  entry.status === "ok" ? 0 : entry.status === "pending" ? 1 : 2
                ] ?? entry.status;

                return (
                  <tr key={entry.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={tdStyle}>{i + 1}</td>
                    {schema.columns.map((col) => (
                      <td key={col.key} style={tdStyle}>{entry.fields[col.key] ?? ""}</td>
                    ))}
                    <td style={tdStyle}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        background: getStatusBg(statusText),
                        color: getStatusColor(statusText),
                      }}>
                        {statusText}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      <button
                        className="btn"
                        style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                        onClick={() => { setEditingEntry(entry); setShowForm(true); }}
                      >✏️</button>
                      {isManager && (
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: "0.75rem", padding: "2px 6px", marginInlineStart: 4 }}
                          onClick={() => handleDeleteEntry(entry.id)}
                        >🗑</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── EntryForm ─────────────────────────────────────────────────────────────────

interface FormProps {
  schema: (typeof REGISTER_SCHEMAS)[RegisterType];
  entry: RegisterEntry | null;
  isRTL: boolean;
  t: Record<string, string>;
  onSave: (fields: Record<string, string>, status: "ok" | "pending" | "issue") => void;
  onCancel: () => void;
}

function EntryForm({ schema, entry, isRTL, t, onSave, onCancel }: FormProps) {
  const [fields, setFields] = useState<Record<string, string>>(entry?.fields ?? {});
  const [status, setStatus] = useState<"ok" | "pending" | "issue">(entry?.status ?? "ok");

  function setField(key: string, val: string) {
    setFields((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div className="card" style={{ marginBottom: "1rem", padding: "1rem" }}>
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
        {entry ? t.editEntry : t.addEntry}
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
        {schema.columns.map((col) => (
          <div key={col.key}>
            <label style={{ fontSize: "0.8rem", color: "var(--text2)", display: "block", marginBottom: 2 }}>
              {isRTL ? col.label : col.labelEn}
            </label>
            {col.type === "select" && col.options ? (
              <select
                className="input"
                value={fields[col.key] ?? ""}
                onChange={(e) => setField(col.key, e.target.value)}
                style={{ width: "100%", fontSize: "0.85rem" }}
              >
                <option value="">—</option>
                {col.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : col.type === "date" ? (
              <input
                type="date"
                className="input"
                value={fields[col.key] ?? ""}
                onChange={(e) => setField(col.key, e.target.value)}
                style={{ width: "100%", fontSize: "0.85rem" }}
              />
            ) : (
              <input
                type="text"
                className="input"
                value={fields[col.key] ?? ""}
                onChange={(e) => setField(col.key, e.target.value)}
                style={{ width: "100%", fontSize: "0.85rem" }}
              />
            )}
          </div>
        ))}
        <div>
          <label style={{ fontSize: "0.8rem", color: "var(--text2)", display: "block", marginBottom: 2 }}>
            {t.regStatus}
          </label>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as "ok" | "pending" | "issue")}
            style={{ width: "100%", fontSize: "0.85rem" }}
          >
            <option value="ok">{schema.statusOptions[0]}</option>
            <option value="pending">{schema.statusOptions[1]}</option>
            <option value="issue">{schema.statusOptions[2]}</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onCancel}>{isRTL ? "إلغاء" : "Cancel"}</button>
        <button className="btn btn-primary" onClick={() => onSave(fields, status)}>
          {isRTL ? "حفظ" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: "8px 6px",
  textAlign: "start",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text2)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "6px",
  fontSize: "0.85rem",
};
