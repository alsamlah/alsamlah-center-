import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Tenant / Multi-tenant ──
export interface Tenant {
  id: string;
  name_ar: string;
  name_en: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  is_main: boolean;
  created_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  user_id: string;
  role: string;
  display_name: string | null;
  created_at: string;
}

// ── Auth / Login (role within tenant) ──
export type UserRole = "cashier1" | "cashier2" | "manager";
export interface UserLogin {
  role: UserRole;
  name: string;
}

// ── App context (what is loaded after full login) ──
export interface AppContext {
  tenant: Tenant;
  branch: Branch | null;   // null = no branch selected (single-location business)
  tenantUser: TenantUser;
  supabaseUser: { id: string; email?: string };
}

// ── Core data models ──
export interface Session {
  startTime: number;
  customerName: string;
  phone?: string;
  durationMins: number;
  graceMins: number;
  playerCount: number;
  sessionType?: "ps" | "match" | "walkin";
  manualPrice?: number;
  switchedFrom?: { itemId: string; itemName: string; switchedAt: number };
  prepaidAmount?: number;
  prepaidMethod?: string;
  prepaidAt?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  cat: string;
  icon: string;
  // Inventory tracking
  stock?: number;
  lowStockThreshold?: number;
  trackStock?: boolean;
}

export interface OrderItem extends MenuItem {
  orderId: string;
  time: number;
}

export interface PriceTier {
  minutes: number;
  price: number;
}

export interface Zone {
  id: string;
  name: string;
  icon: string;
  pricePerHour: number;
  minCharge: number;
  priceTiers?: PriceTier[];
  pricingMode?: "hourly" | "tiered" | "per-hit" | "walkin" | "manual";
  hitPrice?: number;
  items: { id: string; name: string; sub?: string; status?: ItemStatus; maintenanceNote?: string }[];
}

export interface Floor {
  id: string;
  name: string;
  zones: Zone[];
}

export interface HistoryRecord {
  id: string;
  itemId: string;
  itemName: string;
  zoneName: string;
  customerName: string;
  phone?: string;
  startTime: number;
  endTime: number;
  duration: number;
  timePrice: number;
  orders: MenuItem[];
  ordersTotal: number;
  total: number;
  payMethod: string;
  debtAmount: number;
  discount: number;
  graceMins: number;
  playerCount: number;
  cashier: string;
  sessionType?: "ps" | "match" | "walkin";
  switchedFrom?: string;                                 // item name if activity was switched
  invoiceNo?: string;                                    // zero-padded "0001", resets daily
  status?: "paid" | "held-occupied" | "held-free";      // undefined = "paid" (backward compat)
  branchId?: string;                                     // branch that created this record (optional for multi-branch filter)
  branchName?: string;
  // Split payment — multiple methods contributing to the total
  payMethods?: Array<{ method: string; amount: number }>;
  // Split bill — cosmetic, one receipt showing per-person amount
  splitCount?: number;
  splitAmount?: number;                                  // total / splitCount
  // Prepaid amount collected at session start
  prepaidAmount?: number;
  prepaidMethod?: string;
  // Manager correction — record a refund when cashier overcharged
  correction?: {
    originalTotal: number;
    correctedTotal: number;
    refundAmount: number;
    refundMethod: "cash" | "transfer";
    refundBy: string;
    refundDate: number;
    note?: string;
  };
}

export interface DebtPayment {
  id: string;
  amount: number;
  date: number;
  method: string;
  note: string;
}

export interface Debt {
  id: string;
  name: string;
  phone: string;
  amount: number;
  paidAmount: number;
  payments: DebtPayment[];
  note: string;
  date: number;
  paid: boolean;
}

// ── QR Orders ──
export interface QrOrder {
  id: string;
  room_id: string;
  room_name: string;
  item_name: string;
  item_icon: string;
  item_price: number;
  qty: number;
  status: "pending" | "accepted" | "rejected" | "delivered";
  customer_note: string | null;
  created_at: string;
  tenant_id: string | null;
}

// ── Shift Management ──
export interface Shift {
  id: string;
  openedAt: number;
  openedBy: string;
  cashFloat: number;
}

export interface ShiftRecord extends Shift {
  closedAt: number;
  closedBy: string;
  summary: {
    sessionCount: number;
    totalRevenue: number;
    cashRevenue: number;
    cardRevenue: number;
    transferRevenue: number;
    debtTotal: number;
    discountTotal: number;
    netRevenue: number;
    // Extended fields (added for day management — may be absent in old records)
    ordersRevenue?: number;
    timeRevenue?: number;
    heldCount?: number;
    heldTotal?: number;
    byZone?: Record<string, { count: number; rev: number }>;
    byCashier?: Record<string, { count: number; rev: number }>;
    itemSales?: { name: string; icon: string; qty: number; rev: number }[];
    expectedCashInDrawer?: number;
    totalRefunds?: number;
    netAfterRefunds?: number;
    // Mada debit card (card method) fees
    madaRevenue?: number;
    madaCount?: number;
    madaFees?: number;
    // Credit card fees
    creditRevenue?: number;
    creditFees?: number;
  };
}

// ── Special Guests ──
export type SpecialGuestType = "family" | "friend" | "influencer" | "security" | "municipality" | "authority" | "vip";

export interface SpecialGuest {
  id: string;
  name: string;
  type: SpecialGuestType;
  notes: string;
  arrivedAt: number;
  leftAt: number | null;
  registeredBy: string;
}

// ── Customer Loyalty ──
export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  totalVisits: number;
  totalSpent: number;
  points: number;
  joinDate: number;
  lastVisit: number;
  linkedDebtIds?: string[];
  membershipId?: string;
}

// ── Item Status (Maintenance) ──
export type ItemStatus = "active" | "maintenance" | "disabled";

// ── Maintenance Logs ──
export interface MaintenanceLog {
  id: string;
  itemId: string;
  itemName: string;
  zoneName: string;
  type: "repair" | "routine" | "inspection";
  description: string;
  cost: number;
  status: "pending" | "in-progress" | "completed";
  startDate: number;
  endDate?: number;
  performedBy: string;
  notes?: string;
}

// ── Bookings ──
export interface Booking {
  id: string;
  itemId: string;
  itemName: string;
  customerName: string;
  phone?: string;
  date: number;
  durationMins: number;
  notes?: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  createdBy: string;
  createdAt: number;
  customerId?: string;
}

// ── Membership Plans ──
export type MembershipPlanType = "monthly" | "hours";

export interface MembershipPlan {
  id: string;
  name: string;
  type: MembershipPlanType;
  price: number;
  totalHours?: number;
  durationDays?: number;
  discountPercent?: number;
  isActive: boolean;
}

export interface Membership {
  id: string;
  customerId: string;
  customerName: string;
  planId: string;
  planName: string;
  startDate: number;
  endDate?: number;
  totalHours?: number;
  usedHours: number;
  remainingHours?: number;
  status: "active" | "expired" | "depleted";
  purchasedAt: number;
  purchasedBy: string;
}

// ── Promotions ──
export type PromotionType = "happy-hour" | "weekend" | "coupon";

export interface Promotion {
  id: string;
  name: string;
  type: PromotionType;
  discountPercent: number;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
  couponCode?: string;
  maxUses?: number;
  usedCount: number;
  validFrom: number;
  validTo: number;
  isActive: boolean;
  zoneIds?: string[];
}

// ── Tournaments ──
export type TournamentType = "ps" | "billiard" | "chess" | "tennis" | "baloot" | "other";
export type TournamentFormat = "single-elimination" | "round-robin";

export interface TournamentParticipant {
  id: string;
  name: string;
  phone?: string;
  isTeam: boolean;
  teamMembers?: string[];       // display names of team members
  seed?: number;
  isBye?: boolean;              // bracket placeholder — never shown in UI
  status: "registered" | "checked-in" | "eliminated" | "disqualified" | "winner";
  entryPaid: boolean;
  entryPayMethod?: "cash" | "card" | "transfer";
  entryPaidAt?: number;
  entryPaidBy?: string;
}

export interface TournamentMatch {
  id: string;
  round: number;
  matchNumber: number;
  participant1Id: string | null;
  participant2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  isByeMatch?: boolean;         // auto-advanced, not shown to cashier
  location?: string;            // free text e.g. "طاولة 3"
  status: "pending" | "active" | "completed";
  startTime: number | null;
  endTime: number | null;
}

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  format: TournamentFormat;
  status: "registration" | "active" | "completed" | "cancelled";
  maxParticipants: number;
  teamSize?: number;
  entryFee: number;             // 0 = free
  prizePool?: string;
  notes?: string;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  createdAt: number;
  createdBy: string;
  startedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  cancelledBy: string | null;
  winnerId: string | null;
  branchId?: string;
}

// ── Calc result ──
export interface CalcResult {
  remaining: number;
  elapsed: number;
  progress: number;
  timePrice: number;
  ordersTotal: number;
  total: number;
  isOvertime: boolean;
  isOpen: boolean;
  graceMins: number;
}

// ── Inspection Registers ────────────────────────────────────────────────────

export type RegisterType = "equipment" | "cleaning" | "playstation" | "pestcontrol"

export interface RegisterColumn {
  key: string
  label: string          // Arabic display label
  labelEn: string        // English display label
  type: "text" | "date" | "select" | "status"
  options?: string[]     // for "select" type
}

export interface RegisterSchema {
  name: string           // Arabic name
  nameEn: string         // English name
  icon: string
  columns: RegisterColumn[]
  statusOptions: string[]
}

export interface RegisterEntry {
  id: string
  fields: Record<string, string>
  status: "ok" | "pending" | "issue"
  createdAt: number
  updatedAt: number
}

export interface InspectionRegister {
  id: string
  type: RegisterType
  entries: RegisterEntry[]
  updatedAt: number
  updatedBy: string
  branchId?: string
}
