"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { updateTenant, getBranches, upsertBranch, deleteBranch } from "@/lib/db";
import type { Branch } from "@/lib/supabase";
import type { SystemSettings } from "@/lib/settings";
import { T } from "@/lib/settings";

interface Props {
  settings: SystemSettings;
  logo: string | null;
  setLogo: (v: string | null) => void;
}

export default function BusinessProfile({ settings, logo, setLogo }: Props) {
  const { appCtx, refreshAppCtx } = useAuth();
  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";

  const tenant = appCtx?.tenant;

  // ── Tenant name form ──
  const [nameAr, setNameAr] = useState(tenant?.name_ar ?? "");
  const [nameEn, setNameEn] = useState(tenant?.name_en ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // ── Branches ──
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [editingBranch, setEditingBranch] = useState<Partial<Branch> | null>(null);
  const [savingBranch, setSavingBranch] = useState(false);

  // ── Logo ──
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoTab, setLogoTab] = useState<"current" | "upload">("current");

  useEffect(() => {
    if (tenant) {
      setNameAr(tenant.name_ar);
      setNameEn(tenant.name_en);
      loadBranches();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const loadBranches = async () => {
    if (!tenant) return;
    setLoadingBranches(true);
    const list = await getBranches(tenant.id);
    setBranches(list);
    setLoadingBranches(false);
  };

  const saveName = async () => {
    if (!tenant) return;
    setSavingName(true);
    await updateTenant(tenant.id, { name_ar: nameAr.trim(), name_en: nameEn.trim() });
    await refreshAppCtx();
    setSavingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const saveBranch = async () => {
    if (!tenant || !editingBranch?.name?.trim()) return;
    setSavingBranch(true);
    await upsertBranch(tenant.id, editingBranch as Branch & { name: string });
    await loadBranches();
    setEditingBranch(null);
    setSavingBranch(false);
  };

  const handleDeleteBranch = async (id: string) => {
    if (!confirm(isRTL ? "تأكيد حذف الفرع؟" : "Delete branch?")) return;
    await deleteBranch(id);
    await loadBranches();
  };

  const handleLogoFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = e.target?.result as string;
      setLogo(b64);
      try { localStorage.setItem("als-logo", b64); } catch {}
      // Also save to tenant if we want cloud logo
      if (tenant) updateTenant(tenant.id, { logo_url: b64 });
    };
    reader.readAsDataURL(file);
  };

  const handleUseBuiltin = () => {
    fetch("/logo.png")
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const b64 = e.target?.result as string;
          setLogo(b64);
          try { localStorage.setItem("als-logo", b64); } catch {}
        };
        reader.readAsDataURL(blob);
      });
  };

  const handleClearLogo = () => {
    setLogo(null);
    try { localStorage.removeItem("als-logo"); } catch {}
    if (tenant) updateTenant(tenant.id, { logo_url: null });
  };

  return (
    <div className="space-y-6 anim-fade-up" dir={isRTL ? "rtl" : "ltr"}>

      {/* ── Business Name ── */}
      <div className="card p-5">
        <h3 className="font-bold mb-4 text-base flex items-center gap-2" style={{ color: "var(--text)" }}>
          🏢 {isRTL ? "اسم المركز" : "Business Name"}
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text2)" }}>
              {isRTL ? "الاسم بالعربي" : "Arabic Name"}
            </label>
            <input className="input w-full text-right" dir="rtl"
              value={nameAr} onChange={(e) => setNameAr(e.target.value)}
              placeholder="مركز الصملة للترفيه" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text2)" }}>
              {isRTL ? "الاسم بالإنجليزي" : "English Name"}
            </label>
            <input className="input w-full"
              value={nameEn} onChange={(e) => setNameEn(e.target.value)}
              placeholder="ALSAMLAH" />
          </div>
        </div>
        <button className={`btn mt-4 px-6 ${nameSaved ? "btn-success" : "btn-primary"}`}
          onClick={saveName} disabled={savingName}>
          {savingName ? "..." : nameSaved ? (isRTL ? "تم الحفظ ✓" : "Saved ✓") : (isRTL ? "حفظ" : "Save")}
        </button>
      </div>

      {/* ── Logo ── */}
      <div className="card p-5">
        <h3 className="font-bold mb-4 text-base flex items-center gap-2" style={{ color: "var(--text)" }}>
          🖼️ {t.logoSection}
        </h3>

        {/* Current logo preview */}
        {logo && (
          <div className="mb-4 flex items-center gap-4">
            <img src={logo} alt="logo" className="h-16 object-contain rounded-lg"
              style={{ background: "var(--surface)", padding: 8, border: "1px solid var(--border)" }} />
            <button className="btn btn-danger text-xs px-3 py-1.5" onClick={handleClearLogo}>
              {t.clearLogo}
            </button>
          </div>
        )}

        {!logo && (
          <div className="mb-4 flex items-center justify-center rounded-xl py-8"
            style={{ border: "2px dashed var(--border)", background: "var(--surface)" }}>
            <span className="text-sm" style={{ color: "var(--text2)" }}>
              {isRTL ? "لا يوجد لوقو" : "No logo set"}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary text-sm px-4"
            onClick={() => fileRef.current?.click()}>
            {t.uploadLogo}
          </button>
          <button className="btn text-sm px-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={handleUseBuiltin}>
            {t.useBuiltinLogo}
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ""; }} />
      </div>

      {/* ── Branches ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text)" }}>
            🏪 {isRTL ? "الفروع" : "Branches"}
          </h3>
          <button className="btn btn-primary text-sm px-4 py-1.5"
            onClick={() => setEditingBranch({ name: "", address: "", is_active: true, is_main: false })}>
            + {isRTL ? "فرع جديد" : "New Branch"}
          </button>
        </div>

        {/* Branch list */}
        {loadingBranches ? (
          <div className="text-sm py-4 text-center" style={{ color: "var(--text2)" }}>
            {isRTL ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : branches.length === 0 ? (
          <div className="text-sm py-4 text-center" style={{ color: "var(--text2)" }}>
            {isRTL ? "لا توجد فروع بعد" : "No branches yet"}
          </div>
        ) : (
          <div className="space-y-2">
            {branches.map((branch) => (
              <div key={branch.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex-1">
                  <div className="font-semibold text-sm flex items-center gap-2" style={{ color: "var(--text)" }}>
                    {branch.name}
                    {branch.is_main && (
                      <span className="badge text-xs px-2 py-0.5" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
                        {isRTL ? "رئيسي" : "Main"}
                      </span>
                    )}
                    {!branch.is_active && (
                      <span className="badge text-xs px-2 py-0.5" style={{ background: "color-mix(in srgb, var(--red) 10%, transparent)", color: "var(--red)" }}>
                        {isRTL ? "غير نشط" : "Inactive"}
                      </span>
                    )}
                  </div>
                  {branch.address && (
                    <div className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>{branch.address}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="btn text-xs px-2 py-1"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    onClick={() => setEditingBranch({ ...branch })}>
                    ✏️
                  </button>
                  {!branch.is_main && (
                    <button className="btn btn-danger text-xs px-2 py-1"
                      onClick={() => handleDeleteBranch(branch.id)}>
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Branch edit form */}
        {editingBranch && (
          <div className="mt-4 p-4 rounded-xl space-y-3"
            style={{ background: "color-mix(in srgb, var(--accent) 5%, var(--surface))", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)" }}>
            <div className="font-semibold text-sm" style={{ color: "var(--accent)" }}>
              {editingBranch.id ? (isRTL ? "تعديل الفرع" : "Edit Branch") : (isRTL ? "فرع جديد" : "New Branch")}
            </div>
            <input className="input w-full" dir={isRTL ? "rtl" : "ltr"}
              placeholder={isRTL ? "اسم الفرع *" : "Branch name *"}
              value={editingBranch.name ?? ""}
              onChange={(e) => setEditingBranch((p) => ({ ...p!, name: e.target.value }))} />
            <input className="input w-full" dir={isRTL ? "rtl" : "ltr"}
              placeholder={isRTL ? "العنوان (اختياري)" : "Address (optional)"}
              value={editingBranch.address ?? ""}
              onChange={(e) => setEditingBranch((p) => ({ ...p!, address: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text)" }}>
              <input type="checkbox"
                checked={editingBranch.is_active ?? true}
                onChange={(e) => setEditingBranch((p) => ({ ...p!, is_active: e.target.checked }))} />
              {isRTL ? "نشط" : "Active"}
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary text-sm px-4" onClick={saveBranch} disabled={savingBranch}>
                {savingBranch ? "..." : isRTL ? "حفظ" : "Save"}
              </button>
              <button className="btn text-sm px-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                onClick={() => setEditingBranch(null)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Account Info ── */}
      <div className="card p-5">
        <h3 className="font-bold mb-3 text-base flex items-center gap-2" style={{ color: "var(--text)" }}>
          👤 {isRTL ? "الحساب" : "Account"}
        </h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
            {appCtx?.supabaseUser?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {appCtx?.supabaseUser?.email}
            </div>
            <div className="text-xs" style={{ color: "var(--text2)" }}>
              {isRTL ? "مالك المركز" : "Business Owner"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
