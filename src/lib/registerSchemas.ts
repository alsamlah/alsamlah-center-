/**
 * registerSchemas.ts — Column definitions for each inspection register type
 */

import type { RegisterType, RegisterSchema } from "@/lib/supabase";

export const REGISTER_SCHEMAS: Record<RegisterType, RegisterSchema> = {
  equipment: {
    name: "صيانة الأجهزة",
    nameEn: "Equipment Maintenance",
    icon: "🔧",
    statusOptions: ["تعمل", "معلق", "عطل"],
    columns: [
      { key: "deviceName", label: "اسم الجهاز", labelEn: "Device Name", type: "text" },
      { key: "deviceId", label: "الرقم التعريفي", labelEn: "Device ID", type: "text" },
      { key: "location", label: "الموقع", labelEn: "Location", type: "text" },
      { key: "maintenanceType", label: "نوع الصيانة", labelEn: "Maintenance Type", type: "select", options: ["دورية", "طارئة", "وقائية"] },
      { key: "description", label: "الوصف", labelEn: "Description", type: "text" },
      { key: "date", label: "التاريخ", labelEn: "Date", type: "date" },
      { key: "technician", label: "الفني", labelEn: "Technician", type: "text" },
      { key: "notes", label: "ملاحظات", labelEn: "Notes", type: "text" },
    ],
  },
  cleaning: {
    name: "النظافة",
    nameEn: "Cleaning",
    icon: "🧹",
    statusOptions: ["تم", "معلق", "متأخر"],
    columns: [
      { key: "area", label: "المنطقة", labelEn: "Area", type: "text" },
      { key: "task", label: "المهمة", labelEn: "Task", type: "text" },
      { key: "frequency", label: "التكرار", labelEn: "Frequency", type: "select", options: ["يومي", "أسبوعي", "نصف شهري", "شهري"] },
      { key: "date", label: "التاريخ", labelEn: "Date", type: "date" },
      { key: "responsible", label: "المسؤول", labelEn: "Responsible", type: "text" },
      { key: "materials", label: "مواد التنظيف", labelEn: "Materials", type: "text" },
      { key: "notes", label: "ملاحظات", labelEn: "Notes", type: "text" },
    ],
  },
  playstation: {
    name: "البلايستيشن",
    nameEn: "PlayStation",
    icon: "🎮",
    statusOptions: ["جاهز", "معلق", "عطل"],
    columns: [
      { key: "deviceNum", label: "رقم الجهاز", labelEn: "Device #", type: "text" },
      { key: "version", label: "الإصدار", labelEn: "Version", type: "select", options: ["PS5", "PS4", "PS4 Pro"] },
      { key: "location", label: "الموقع", labelEn: "Location", type: "text" },
      { key: "checkType", label: "الفحص", labelEn: "Check Type", type: "select", options: ["فحص دوري", "إصلاح", "تنظيف", "تحديث"] },
      { key: "action", label: "الإجراء", labelEn: "Action", type: "text" },
      { key: "date", label: "التاريخ", labelEn: "Date", type: "date" },
      { key: "technician", label: "الفني", labelEn: "Technician", type: "text" },
      { key: "notes", label: "ملاحظات", labelEn: "Notes", type: "text" },
    ],
  },
  pestcontrol: {
    name: "رش المبيدات",
    nameEn: "Pest Control",
    icon: "🪲",
    statusOptions: ["تم", "مجدول", "متأخر"],
    columns: [
      { key: "area", label: "المنطقة", labelEn: "Area", type: "text" },
      { key: "pesticide", label: "نوع المبيد", labelEn: "Pesticide", type: "text" },
      { key: "company", label: "شركة الرش", labelEn: "Company", type: "text" },
      { key: "date", label: "التاريخ", labelEn: "Date", type: "date" },
      { key: "nextDate", label: "الرشة القادمة", labelEn: "Next Date", type: "date" },
      { key: "responsible", label: "المسؤول", labelEn: "Responsible", type: "text" },
      { key: "notes", label: "ملاحظات", labelEn: "Notes", type: "text" },
    ],
  },
};

export const REGISTER_TYPES: RegisterType[] = ["equipment", "cleaning", "playstation", "pestcontrol"];

export function getStatusColor(status: string): string {
  if (["تعمل", "تم", "جاهز"].includes(status)) return "var(--green)";
  if (["معلق", "مجدول", "قريب"].includes(status)) return "var(--yellow)";
  return "var(--red)";
}

export function getStatusBg(status: string): string {
  if (["تعمل", "تم", "جاهز"].includes(status)) return "color-mix(in srgb, var(--green) 15%, transparent)";
  if (["معلق", "مجدول", "قريب"].includes(status)) return "color-mix(in srgb, var(--yellow) 15%, transparent)";
  return "color-mix(in srgb, var(--red) 15%, transparent)";
}
