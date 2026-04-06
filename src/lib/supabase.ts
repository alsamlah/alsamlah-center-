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
  durationMins: number;
  graceMins: number;
  playerCount: number;
  sessionType?: "ps" | "match";
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  cat: string;
  icon: string;
}

export interface OrderItem extends MenuItem {
  orderId: string;
  time: number;
}

export interface Zone {
  id: string;
  name: string;
  icon: string;
  pricePerHour: number;
  minCharge: number;
  items: { id: string; name: string; sub?: string }[];
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
  sessionType?: "ps" | "match";
  invoiceNo?: string;                                    // zero-padded "0001", resets daily
  status?: "paid" | "held-occupied" | "held-free";      // undefined = "paid" (backward compat)
  branchId?: string;                                     // branch that created this record (optional for multi-branch filter)
  branchName?: string;
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
    itemSales?: { name: string; icon: string; qty: number; rev: number }[];
    expectedCashInDrawer?: number;
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
  totalVisits: number;
  totalSpent: number;
  points: number;
  joinDate: number;
  lastVisit: number;
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
