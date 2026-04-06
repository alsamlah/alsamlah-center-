import type { Floor, MenuItem, UserRole } from "./supabase";

export const DEFAULT_FLOORS: Floor[] = [
  {
    id: "f1",
    name: "الطابق الأول",
    zones: [
      { id: "rooms", name: "الغرف", icon: "🎮", pricePerHour: 20, minCharge: 30, items: Array.from({ length: 10 }, (_, i) => ({ id: `room-${i + 1}`, name: `غرفة ${i + 1}`, sub: i === 9 ? "PS5 / مباراة" : "PS5" })) },
      { id: "billiard1", name: "بلياردو", icon: "🎱", pricePerHour: 40, minCharge: 30, items: Array.from({ length: 3 }, (_, i) => ({ id: `bill1-${i + 1}`, name: `بلياردو ${i + 1}` })) },
      { id: "chess", name: "شطرنج", icon: "♟️", pricePerHour: 15, minCharge: 30, items: Array.from({ length: 2 }, (_, i) => ({ id: `chess-${i + 1}`, name: `شطرنج ${i + 1}` })) },
      { id: "baloot1", name: "بلوت", icon: "🃏", pricePerHour: 20, minCharge: 30, items: [{ id: "baloot1-1", name: "بلوت 1" }] },
      { id: "boxing", name: "بوكسينج", icon: "🥊", pricePerHour: 25, minCharge: 30, items: [{ id: "boxing-1", name: "بوكسينج" }] },
    ],
  },
  {
    id: "f2",
    name: "الطابق الثاني",
    zones: [
      { id: "billiard2", name: "بلياردو", icon: "🎱", pricePerHour: 40, minCharge: 30, items: Array.from({ length: 2 }, (_, i) => ({ id: `bill2-${i + 1}`, name: `بلياردو ${i + 1}` })) },
      { id: "tennis", name: "تنس طاولة", icon: "🏓", pricePerHour: 25, minCharge: 30, items: Array.from({ length: 4 }, (_, i) => ({ id: `tennis-${i + 1}`, name: `تنس ${i + 1}` })) },
      { id: "baloot2", name: "بلوت", icon: "🃏", pricePerHour: 20, minCharge: 30, items: Array.from({ length: 2 }, (_, i) => ({ id: `baloot2-${i + 1}`, name: `بلوت ${i + 1}` })) },
      { id: "floor", name: "جلسة أرضية", icon: "🛋️", pricePerHour: 30, minCharge: 30, items: Array.from({ length: 2 }, (_, i) => ({ id: `floor-${i + 1}`, name: `جلسة ${i + 1}`, sub: "PS5 + TV" })) },
    ],
  },
];

export const DEFAULT_MENU: MenuItem[] = [
  { id: "m1", name: "ماء", price: 2, cat: "مشروبات", icon: "💧" },
  { id: "m2", name: "بيبسي", price: 5, cat: "مشروبات", icon: "🥤" },
  { id: "m3", name: "ريد بول", price: 12, cat: "مشروبات", icon: "⚡" },
  { id: "m4", name: "شاي", price: 5, cat: "مشروبات", icon: "🍵" },
  { id: "m5", name: "قهوة", price: 8, cat: "مشروبات", icon: "☕" },
  { id: "m6", name: "موهيتو", price: 15, cat: "مشروبات", icon: "🍹" },
  { id: "m7", name: "شيبس", price: 5, cat: "سناكات", icon: "🍿" },
  { id: "m8", name: "ناتشوز", price: 10, cat: "سناكات", icon: "🧀" },
  { id: "m9", name: "ساندويتش", price: 15, cat: "سناكات", icon: "🥪" },
  { id: "m10", name: "دونات", price: 8, cat: "سناكات", icon: "🍩" },
];

// ── Match Session ──
export const MATCH_PRICE = 50;          // Fixed price per match session (SAR)
export const MATCH_ZONE_ID = "rooms";   // Zone ID that supports match sessions
export const ROOM_10_ID = "room-10";    // Room 10 = chairs, coffee order required for match

export const DURATION_OPTS = [
  { label: "٣٠ د", mins: 30 },
  { label: "ساعة", mins: 60 },
  { label: "ساعتين", mins: 120 },
  { label: "٣ ساعات", mins: 180 },
  { label: "مفتوح", mins: 0 },
];

export const PLAYER_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];

export const MENU_ICONS = ["💧", "🥤", "⚡", "🍵", "☕", "🍹", "🧃", "🥛", "🍺", "🧋", "🍿", "🧀", "🥪", "🍩", "🍪", "🍫", "🍬", "🧁", "🍕", "🍔", "🌮", "🥙", "🧇", "🍦", "🎂", "🥜", "🍌", "🍎"];

// ── Login defaults ──
export const DEFAULT_PINS: Record<UserRole, string> = {
  cashier1: "1111",
  cashier2: "2222",
  manager: "1234",
};

export const ROLE_NAMES: Record<UserRole, string> = {
  cashier1: "كاشير ١",
  cashier2: "كاشير ٢",
  manager: "المدير",
};

export const ROLE_LABELS: Record<UserRole, { ar: string; en: string }> = {
  cashier1: { ar: "كاشير", en: "Cashier" },
  cashier2: { ar: "كاشير", en: "Cashier" },
  manager: { ar: "مدير", en: "Manager" },
};

export const DEFAULT_ROLE_NAMES: Record<UserRole, string> = {
  cashier1: "كاشير ١",
  cashier2: "كاشير ٢",
  manager: "المدير",
};

export const ROLE_ICONS: Record<UserRole, string> = {
  cashier1: "💰",
  cashier2: "💰",
  manager: "👑",
};
