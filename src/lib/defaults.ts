import type { Floor, MenuItem, UserRole, BoxingTokenData } from "./supabase";

// ── Price tiers per zone type ──
const PS_TIERS = [
  { minutes: 30, price: 20 }, { minutes: 60, price: 30 }, { minutes: 90, price: 40 },
  { minutes: 120, price: 55 }, { minutes: 150, price: 65 }, { minutes: 180, price: 70 },
  { minutes: 210, price: 80 }, { minutes: 240, price: 85 }, { minutes: 720, price: 99 },
];
const TENNIS_BILLIARD_TIERS = [
  { minutes: 30, price: 15 }, { minutes: 60, price: 25 }, { minutes: 90, price: 35 }, { minutes: 120, price: 45 },
];
const BALOOT_TIERS = [
  { minutes: 30, price: 15 }, { minutes: 60, price: 20 }, { minutes: 90, price: 30 }, { minutes: 120, price: 40 },
];
const CHESS_TIERS = [
  { minutes: 30, price: 10 }, { minutes: 60, price: 20 }, { minutes: 90, price: 30 }, { minutes: 120, price: 40 },
];

export const COUNTER_FLOOR_ID = "counter-floor";
export const COUNTER_ZONE_ID = "counter";
export const MASSAGE_ZONE_ID = "massage";

export const COUNTER_FLOOR: Floor = {
  id: COUNTER_FLOOR_ID,
  name: "☕ طلبات مباشرة",
  zones: [
    {
      id: COUNTER_ZONE_ID,
      name: "كاونتر",
      icon: "☕",
      pricePerHour: 0,
      minCharge: 0,
      pricingMode: "walkin",
      items: [
        { id: "counter-1", name: "كاونتر 1" },
        { id: "counter-2", name: "كاونتر 2" },
        { id: "counter-3", name: "كاونتر 3" },
        { id: "counter-4", name: "كاونتر 4" },
      ],
    },
  ],
};

export const DEFAULT_FLOORS: Floor[] = [
  {
    id: "f1",
    name: "الطابق الأول",
    zones: [
      { id: "rooms", name: "الغرف", icon: "🎮", pricePerHour: 20, minCharge: 30, priceTiers: PS_TIERS, pricingMode: "tiered", items: Array.from({ length: 10 }, (_, i) => ({ id: `room-${i + 1}`, name: `غرفة ${i + 1}`, sub: i === 9 ? "PS5 / مباراة" : "PS5" })) },
      { id: "billiard1", name: "بلياردو", icon: "🎱", pricePerHour: 25, minCharge: 30, priceTiers: TENNIS_BILLIARD_TIERS, pricingMode: "tiered", items: Array.from({ length: 3 }, (_, i) => ({ id: `bill1-${i + 1}`, name: `بلياردو ${i + 1}` })) },
      { id: "chess", name: "شطرنج", icon: "♟️", pricePerHour: 20, minCharge: 30, priceTiers: CHESS_TIERS, pricingMode: "tiered", items: Array.from({ length: 2 }, (_, i) => ({ id: `chess-${i + 1}`, name: `شطرنج ${i + 1}` })) },
      { id: "baloot1", name: "بلوت", icon: "🃏", pricePerHour: 20, minCharge: 30, priceTiers: BALOOT_TIERS, pricingMode: "tiered", items: [{ id: "baloot1-1", name: "بلوت 1" }] },
      { id: "boxing", name: "بوكسينج", icon: "🥊", pricePerHour: 0, minCharge: 0, pricingMode: "token", items: [{ id: "boxing-1", name: "بوكسينج" }] },
      { id: MASSAGE_ZONE_ID, name: "مساج", icon: "💆", pricePerHour: 0, minCharge: 0, pricingMode: "manual", items: [{ id: "massage-1", name: "كرسي مساج 1" }, { id: "massage-2", name: "كرسي مساج 2" }] },
    ],
  },
  {
    id: "f2",
    name: "الطابق الثاني",
    zones: [
      { id: "billiard2", name: "بلياردو", icon: "🎱", pricePerHour: 25, minCharge: 30, priceTiers: TENNIS_BILLIARD_TIERS, pricingMode: "tiered", items: Array.from({ length: 2 }, (_, i) => ({ id: `bill2-${i + 1}`, name: `بلياردو ${i + 1}` })) },
      { id: "tennis", name: "تنس طاولة", icon: "🏓", pricePerHour: 25, minCharge: 30, priceTiers: TENNIS_BILLIARD_TIERS, pricingMode: "tiered", items: Array.from({ length: 4 }, (_, i) => ({ id: `tennis-${i + 1}`, name: `تنس ${i + 1}` })) },
      { id: "baloot2", name: "بلوت", icon: "🃏", pricePerHour: 20, minCharge: 30, priceTiers: BALOOT_TIERS, pricingMode: "tiered", items: Array.from({ length: 2 }, (_, i) => ({ id: `baloot2-${i + 1}`, name: `بلوت ${i + 1}` })) },
      { id: "floor", name: "جلسة أرضية", icon: "🛋️", pricePerHour: 20, minCharge: 30, priceTiers: PS_TIERS, pricingMode: "tiered", items: Array.from({ length: 2 }, (_, i) => ({ id: `floor-${i + 1}`, name: `جلسة ${i + 1}`, sub: "PS5 + TV" })) },
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
  { id: "m11", name: "وحدة تحكم إضافية", price: 5, cat: "إضافات", icon: "🎮" },
  { id: "m12", name: "مضرب تنس إضافي", price: 5, cat: "إضافات", icon: "🏓" },
  { id: "m13", name: "واي فاي (ساعة)", price: 5, cat: "إضافات", icon: "📶" },
];

// ── Match Session ──
export const MATCH_PRICE = 50;          // Fixed price per match session (SAR)
export const MATCH_ZONE_ID = "rooms";   // Zone ID that supports match sessions
export const ROOM_10_ID = "room-10";    // Room 10 = chairs, coffee order required for match

export const DURATION_OPTS = [
  { label: "٣٠ د", mins: 30 },
  { label: "ساعة", mins: 60 },
  { label: "١.٥ ساعة", mins: 90 },
  { label: "ساعتين", mins: 120 },
  { label: "٢.٥ ساعة", mins: 150 },
  { label: "٣ ساعات", mins: 180 },
  { label: "٣.٥ ساعة", mins: 210 },
  { label: "٤ ساعات", mins: 240 },
  { label: "يوم مفتوح", mins: 720 },
  { label: "مفتوح", mins: 0 },
];

export const TIER_GRACE_MINUTES = 10; // grace before jumping to next tier

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

// ── Boxing Token Defaults ──
export const DEFAULT_BOXING_TOKENS: BoxingTokenData = { balance: 0, log: [] };
export const BOXING_ZONE_ID = "boxing";

export const ROLE_ICONS: Record<UserRole, string> = {
  cashier1: "💰",
  cashier2: "💰",
  manager: "👑",
};
