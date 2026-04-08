/**
 * db.ts — Supabase data layer for ALSAMLAH
 *
 * Strategy: localStorage as instant cache + Supabase as source of truth.
 * Every write goes to localStorage immediately (UI stays instant),
 * then syncs to Supabase in background.
 * On load: Supabase data takes priority over localStorage.
 */

import { supabase } from "@/lib/supabase";
import type {
  Floor, MenuItem, Session, OrderItem,
  HistoryRecord, Debt, Tenant, Branch, SpecialGuest, Customer, Tournament,
  InspectionRegister, Booking, MembershipPlan, Membership, Promotion, MaintenanceLog,
} from "@/lib/supabase";
import { getBusinessDay } from "@/lib/utils";
import { DEFAULT_FLOORS, DEFAULT_MENU, DEFAULT_PINS, DEFAULT_ROLE_NAMES } from "@/lib/defaults";
import type { SystemSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { UserRole } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TenantData {
  floors: Floor[];
  menu: MenuItem[];
  sessions: Record<string, Session>;
  orders: Record<string, OrderItem[]>;
  history: HistoryRecord[];
  debts: Debt[];
  customers: Customer[];
  tournaments: Tournament[];
  registers: InspectionRegister[];
  bookings: Booking[];
  membershipPlans: MembershipPlan[];
  memberships: Membership[];
  promotions: Promotion[];
  maintenanceLogs: MaintenanceLog[];
  pins: Record<UserRole, string>;
  roleNames: Record<UserRole, string>;
  settings: SystemSettings;
  logo: string | null;
  invoiceCounter: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ls(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, val: unknown) {
  try { localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val)); } catch {}
}
function lsRemove(key: string) {
  try { localStorage.removeItem(key); } catch {}
}
function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ── Load all tenant data (Supabase first, localStorage fallback) ──────────────

export async function loadTenantData(
  tenantId: string,
  branchId: string | null,
): Promise<TenantData> {
  // Run all queries in parallel
  const [
    floorsRes,
    menuRes,
    sessionsRes,
    historyRes,
    debtsRes,
    settingsRes,
    counterRes,
    customersRes,
    tournamentsRes,
    registersRes,
    bookingsRes,
    membershipPlansRes,
    membershipsRes,
    promotionsRes,
    maintenanceLogsRes,
  ] = await Promise.allSettled([
    supabase.from("floors").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("menu_items").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("active_sessions").select("*").eq("tenant_id", tenantId),
    supabase.from("history").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
    supabase.from("debts").select("*").eq("tenant_id", tenantId),
    supabase.from("tenant_settings").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("invoice_counter").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("customers").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("tournaments").select("data").eq("tenant_id", tenantId),
    supabase.from("inspection_registers").select("*").eq("tenant_id", tenantId),
    supabase.from("bookings").select("*").eq("tenant_id", tenantId),
    supabase.from("membership_plans").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("memberships").select("*").eq("tenant_id", tenantId),
    supabase.from("promotions").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("maintenance_logs").select("*").eq("tenant_id", tenantId),
  ]);

  // ── Floors ──
  const floorsRow = floorsRes.status === "fulfilled" ? floorsRes.value.data : null;
  const floors: Floor[] = floorsRow?.data ?? parse(ls("als-floors"), DEFAULT_FLOORS);

  // ── Menu ──
  const menuRow = menuRes.status === "fulfilled" ? menuRes.value.data : null;
  const menu: MenuItem[] = menuRow?.data ?? parse(ls("als-menu"), DEFAULT_MENU);

  // ── Active sessions & orders ──
  const sessionsRows = sessionsRes.status === "fulfilled" ? sessionsRes.value.data ?? [] : [];
  let sessions: Record<string, Session> = {};
  let orders: Record<string, OrderItem[]> = {};
  if (sessionsRows.length > 0) {
    for (const row of sessionsRows) {
      sessions[row.item_id] = row.session_data as Session;
      orders[row.item_id] = (row.orders as OrderItem[]) ?? [];
    }
  } else {
    sessions = parse(ls("als-sessions"), {});
    orders = parse(ls("als-orders"), {});
  }

  // ── History ──
  const historyRows = historyRes.status === "fulfilled" ? historyRes.value.data ?? [] : [];
  const history: HistoryRecord[] = historyRows.length > 0
    ? historyRows.map((r) => r.data as HistoryRecord)
    : parse(ls("als-history"), []);

  // ── Debts ──
  const debtsRows = debtsRes.status === "fulfilled" ? debtsRes.value.data ?? [] : [];
  const debts: Debt[] = debtsRows.length > 0
    ? debtsRows.map((r) => r.data as Debt)
    : parse(ls("als-debts"), []);

  // ── Settings, pins, role names ──
  const settingsRow = settingsRes.status === "fulfilled" ? settingsRes.value.data : null;
  const pins: Record<UserRole, string> = settingsRow?.pins
    ?? parse(ls("als-pins"), DEFAULT_PINS);
  const roleNames: Record<UserRole, string> = settingsRow?.role_names
    ?? parse(ls("als-role-names"), DEFAULT_ROLE_NAMES);
  const settings: SystemSettings = (settingsRow?.settings && Object.keys(settingsRow.settings).length > 0)
    ? settingsRow.settings as SystemSettings
    : parse(ls("als-settings"), DEFAULT_SETTINGS);

  // ── Customers ──
  const customersRow = customersRes.status === "fulfilled" ? customersRes.value.data : null;
  const customers: Customer[] = customersRow?.data ?? parse(ls("als-customers"), []);

  // ── Tournaments ──
  const tournamentsRows = tournamentsRes.status === "fulfilled" ? tournamentsRes.value.data ?? [] : [];
  const tournaments: Tournament[] = tournamentsRows.length > 0
    ? tournamentsRows.map((r) => r.data as Tournament)
    : parse(ls("als-tournaments"), []);

  // ── Inspection Registers ──
  const registersRows = registersRes.status === "fulfilled" ? registersRes.value.data ?? [] : [];
  const registers: InspectionRegister[] = registersRows.length > 0
    ? registersRows.map((r) => r.data as InspectionRegister)
    : parse(ls("als-registers"), []);

  // ── Bookings ──
  const bookingsRows = bookingsRes.status === "fulfilled" ? bookingsRes.value.data ?? [] : [];
  const bookings: Booking[] = bookingsRows.length > 0
    ? bookingsRows.map((r) => r.data as Booking)
    : parse(ls("als-bookings"), []);

  // ── Membership Plans ──
  const membershipPlansRow = membershipPlansRes.status === "fulfilled" ? membershipPlansRes.value.data : null;
  const membershipPlans: MembershipPlan[] = membershipPlansRow?.data ?? parse(ls("als-membership-plans"), []);

  // ── Memberships ──
  const membershipsRows = membershipsRes.status === "fulfilled" ? membershipsRes.value.data ?? [] : [];
  const memberships: Membership[] = membershipsRows.length > 0
    ? membershipsRows.map((r) => r.data as Membership)
    : parse(ls("als-memberships"), []);

  // ── Promotions ──
  const promotionsRow = promotionsRes.status === "fulfilled" ? promotionsRes.value.data : null;
  const promotions: Promotion[] = promotionsRow?.data ?? parse(ls("als-promotions"), []);

  // ── Maintenance Logs ──
  const maintenanceLogsRows = maintenanceLogsRes.status === "fulfilled" ? maintenanceLogsRes.value.data ?? [] : [];
  const maintenanceLogs: MaintenanceLog[] = maintenanceLogsRows.length > 0
    ? maintenanceLogsRows.map((r) => r.data as MaintenanceLog)
    : parse(ls("als-maintenance-logs"), []);

  // ── Logo (still stored in tenant row, base64 from localStorage or tenant.logo_url) ──
  const logo: string | null = ls("als-logo");

  // ── Invoice counter ──
  const counterRow = counterRes.status === "fulfilled" ? counterRes.value.data : null;
  const invoiceCounter: number = counterRow?.counter ?? parse(ls("als-invoice-counter"), "1") as unknown as number;

  // Sync loaded data back to localStorage
  lsSet("als-floors", floors);
  lsSet("als-menu", menu);
  lsSet("als-sessions", sessions);
  lsSet("als-orders", orders);
  lsSet("als-history", history);
  lsSet("als-debts", debts);
  lsSet("als-customers", customers);
  lsSet("als-tournaments", tournaments);
  lsSet("als-registers", registers);
  lsSet("als-bookings", bookings);
  lsSet("als-membership-plans", membershipPlans);
  lsSet("als-memberships", memberships);
  lsSet("als-promotions", promotions);
  lsSet("als-maintenance-logs", maintenanceLogs);
  lsSet("als-pins", pins);
  lsSet("als-role-names", roleNames);
  lsSet("als-settings", settings);
  lsSet("als-invoice-counter", String(invoiceCounter));

  return { floors, menu, sessions, orders, history, debts, customers, tournaments, registers, bookings, membershipPlans, memberships, promotions, maintenanceLogs, pins, roleNames, settings, logo, invoiceCounter };
}

// ── Tenant & Business Profile ─────────────────────────────────────────────────

export async function updateTenant(tenantId: string, updates: Partial<Tenant>) {
  await supabase.from("tenants").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", tenantId);
}

export async function getBranches(tenantId: string): Promise<Branch[]> {
  const { data } = await supabase.from("branches").select("*").eq("tenant_id", tenantId).order("is_main", { ascending: false });
  return (data as Branch[]) ?? [];
}

export async function upsertBranch(tenantId: string, branch: Partial<Branch> & { name: string }) {
  if (branch.id) {
    return supabase.from("branches").update(branch).eq("id", branch.id).eq("tenant_id", tenantId).select().single();
  }
  return supabase.from("branches").insert({ ...branch, tenant_id: tenantId }).select().single();
}

export async function deleteBranch(branchId: string) {
  return supabase.from("branches").delete().eq("id", branchId);
}

// ── Floors ────────────────────────────────────────────────────────────────────

export async function syncFloors(tenantId: string, branchId: string | null, floors: Floor[]) {
  lsSet("als-floors", floors);
  await supabase.from("floors").upsert(
    { tenant_id: tenantId, branch_id: branchId, data: floors, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id" }
  );
}

// ── Menu ──────────────────────────────────────────────────────────────────────

export async function syncMenu(tenantId: string, branchId: string | null, menu: MenuItem[]) {
  lsSet("als-menu", menu);
  await supabase.from("menu_items").upsert(
    { tenant_id: tenantId, branch_id: branchId, data: menu, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id" }
  );
}

// ── Active Sessions ───────────────────────────────────────────────────────────

export async function syncSession(
  tenantId: string,
  branchId: string | null,
  itemId: string,
  session: Session,
  orders: OrderItem[],
) {
  await supabase.from("active_sessions").upsert(
    {
      tenant_id: tenantId,
      branch_id: branchId,
      item_id: itemId,
      session_data: session,
      orders,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,item_id" }
  );
}

export async function deleteSession(tenantId: string, itemId: string) {
  await supabase.from("active_sessions")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);
}

// ── History ───────────────────────────────────────────────────────────────────

export async function addHistoryRecord(
  tenantId: string,
  branchId: string | null,
  record: HistoryRecord,
) {
  await supabase.from("history").insert({
    tenant_id: tenantId,
    branch_id: branchId,
    data: record,
  });
}

export async function clearHistory(tenantId: string) {
  await supabase.from("history").delete().eq("tenant_id", tenantId);
  lsRemove("als-history");
}

// ── Debts ─────────────────────────────────────────────────────────────────────

export async function syncDebts(tenantId: string, branchId: string | null, debts: Debt[]) {
  lsSet("als-debts", debts);
  // Delete all and reinsert (simple approach for debts)
  await supabase.from("debts").delete().eq("tenant_id", tenantId);
  if (debts.length > 0) {
    await supabase.from("debts").insert(
      debts.map((d) => ({ tenant_id: tenantId, branch_id: branchId, data: d }))
    );
  }
}

// ── Settings, Pins, Role Names ────────────────────────────────────────────────

export async function syncSettings(
  tenantId: string,
  settings: SystemSettings,
  pins: Record<UserRole, string>,
  roleNames: Record<UserRole, string>,
) {
  lsSet("als-settings", settings);
  lsSet("als-pins", pins);
  lsSet("als-role-names", roleNames);
  await supabase.from("tenant_settings").upsert(
    {
      tenant_id: tenantId,
      settings,
      pins,
      role_names: roleNames,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );
}

// ── Invoice Counter ───────────────────────────────────────────────────────────

/**
 * Fetches the current invoice counter, resets to 1 if the business day has
 * changed, increments it, and returns the current value zero-padded to 4 digits.
 * e.g. "0001", "0042", "1337"
 */
export async function getAndIncrementInvoice(
  tenantId: string,
  eodHour = 5,
): Promise<string> {
  const { data } = await supabase
    .from("invoice_counter")
    .select("counter, last_reset_date")
    .eq("tenant_id", tenantId)
    .single();

  const today = getBusinessDay(Date.now(), eodHour);
  const lastReset: string = (data as { last_reset_date?: string } | null)?.last_reset_date ?? "";
  const dayChanged = lastReset !== today;

  const current = dayChanged ? 1 : (data?.counter ?? 1);
  const next = current + 1;

  await supabase.from("invoice_counter")
    .update({
      counter: next,
      ...(dayChanged ? { last_reset_date: today } : {}),
    })
    .eq("tenant_id", tenantId);

  lsSet("als-invoice-counter", String(next));
  return String(current).padStart(4, "0");
}

// ── History Record Mutations ──────────────────────────────────────────────────

export async function updateHistoryRecord(tenantId: string, record: HistoryRecord) {
  await supabase.from("history")
    .update({ data: record })
    .eq("tenant_id", tenantId)
    .eq("data->>id", record.id);
}

export async function deleteHistoryRecord(tenantId: string, recordId: string) {
  await supabase.from("history")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("data->>id", recordId);
}

// ── Load helpers (used by realtime callbacks) ─────────────────────────────────

export async function loadDebts(tenantId: string): Promise<Debt[]> {
  const { data } = await supabase.from("debts").select("*").eq("tenant_id", tenantId);
  return (data ?? []).map((r) => r.data as Debt);
}

// ── Realtime Subscriptions ────────────────────────────────────────────────────

type RealtimeCallback = (payload: Record<string, unknown>) => void;

export function subscribeToSessions(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`sessions:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "active_sessions",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

export function subscribeToHistory(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`history:${tenantId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "history",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

export function subscribeToDebts(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`debts:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "debts",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

// ── Special Guests ────────────────────────────────────────────────────────────

export async function loadSpecialGuests(tenantId: string): Promise<SpecialGuest[]> {
  const { data } = await supabase.from("special_guests").select("*").eq("tenant_id", tenantId);
  return (data ?? []).map((r) => r.data as SpecialGuest);
}

export async function syncSpecialGuests(tenantId: string, guests: SpecialGuest[]) {
  lsSet("als-special-guests", guests);
  try {
    await supabase.from("special_guests").delete().eq("tenant_id", tenantId);
    if (guests.length > 0) {
      await supabase.from("special_guests").insert(
        guests.map((g) => ({ tenant_id: tenantId, data: g }))
      );
    }
  } catch { /* table may not exist yet */ }
}

export function subscribeToSpecialGuests(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`special_guests:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "special_guests",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

// ── Customers (Loyalty) ───────────────────────────────────────────────────────

export async function loadCustomers(tenantId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();
  if (error || !data) return parse(ls("als-customers"), []);
  const customers = (data.data as Customer[]) ?? [];
  lsSet("als-customers", customers);
  return customers;
}

export async function syncCustomers(tenantId: string, branchId: string | null, customers: Customer[]) {
  lsSet("als-customers", customers);
  await supabase.from("customers").upsert(
    { tenant_id: tenantId, branch_id: branchId, data: customers, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id" }
  );
}

// ── Tournaments ───────────────────────────────────────────────────────────────

export async function loadTournaments(tenantId: string): Promise<Tournament[]> {
  const { data } = await supabase.from("tournaments").select("data").eq("tenant_id", tenantId);
  const tournaments = (data ?? []).map((r) => r.data as Tournament);
  if (tournaments.length > 0) lsSet("als-tournaments", tournaments);
  return tournaments.length > 0 ? tournaments : parse(ls("als-tournaments"), []);
}

export async function upsertTournament(
  tenantId: string,
  branchId: string | null,
  tournament: Tournament,
  allTournaments: Tournament[],
) {
  // Update localStorage with full updated array
  const updated = allTournaments.some((t) => t.id === tournament.id)
    ? allTournaments.map((t) => (t.id === tournament.id ? tournament : t))
    : [...allTournaments, tournament];
  lsSet("als-tournaments", updated);

  // Each tournament is its own row — upsert by id
  await supabase.from("tournaments").upsert(
    {
      id: tournament.id,
      tenant_id: tenantId,
      branch_id: branchId,
      data: tournament,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}

export async function cancelTournament(
  tenantId: string,
  branchId: string | null,
  tournament: Tournament,
  allTournaments: Tournament[],
  cancelledBy: string,
) {
  const cancelled: Tournament = {
    ...tournament,
    status: "cancelled",
    cancelledAt: Date.now(),
    cancelledBy,
  };
  await upsertTournament(tenantId, branchId, cancelled, allTournaments);
  return cancelled;
}

export function subscribeToTournaments(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`tournaments:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "tournaments",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

// ── Inspection Registers ─────────────────────────────────────────────────────

export async function upsertRegister(
  tenantId: string,
  branchId: string | null,
  register: InspectionRegister,
  allRegisters: InspectionRegister[],
) {
  const updated = allRegisters.some((r) => r.type === register.type)
    ? allRegisters.map((r) => (r.type === register.type ? register : r))
    : [...allRegisters, register];
  lsSet("als-registers", updated);

  await supabase.from("inspection_registers").upsert(
    {
      id: register.id,
      tenant_id: tenantId,
      branch_id: branchId,
      register_type: register.type,
      data: register,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,register_type" }
  );
}

export function subscribeToRegisters(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`registers:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "inspection_registers",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

// ── Menu Realtime ────────────────────────────────────────────────────────────

export async function loadMenu(tenantId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();
  if (error || !data) return parse(ls("als-menu"), []);
  const menu = (data.data as MenuItem[]) ?? [];
  lsSet("als-menu", menu);
  return menu;
}

export function subscribeToMenu(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`menu:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "menu_items",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

// ── Floors Realtime ──────────────────────────────────────────────────────────

export async function loadFloors(tenantId: string): Promise<Floor[]> {
  const { data, error } = await supabase
    .from("floors")
    .select("*")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();
  if (error || !data) return parse(ls("als-floors"), []);
  const floors = (data.data as Floor[]) ?? [];
  lsSet("als-floors", floors);
  return floors;
}

export function subscribeToFloors(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`floors:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "floors",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

// ── Customers Realtime ───────────────────────────────────────────────────────

export function subscribeToCustomers(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`customers:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "customers",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

// ── Settings Realtime (for shifts sync) ──────────────────────────────────────

export async function loadSettings(tenantId: string) {
  const { data } = await supabase
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();
  return data;
}

export function subscribeToSettings(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`settings:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "tenant_settings",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

// ── Shift sync (stored in tenant_settings JSONB) ─────────────────────────────

export async function syncShift(
  tenantId: string,
  currentShift: unknown,
  shiftHistory: unknown[],
) {
  try {
    await supabase.from("tenant_settings").update({
      current_shift: currentShift,
      shift_history: shiftHistory.slice(0, 30),
      updated_at: new Date().toISOString(),
    }).eq("tenant_id", tenantId);
  } catch { /* columns may not exist yet */ }
}

export async function loadShiftData(tenantId: string): Promise<{ currentShift: unknown; shiftHistory: unknown[] }> {
  try {
    const { data } = await supabase
      .from("tenant_settings")
      .select("current_shift, shift_history")
      .eq("tenant_id", tenantId)
      .limit(1)
      .single();
    return {
      currentShift: data?.current_shift ?? null,
      shiftHistory: (data?.shift_history as unknown[]) ?? [],
    };
  } catch {
    return { currentShift: null, shiftHistory: [] };
  }
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export async function loadBookings(tenantId: string): Promise<Booking[]> {
  const { data } = await supabase.from("bookings").select("*").eq("tenant_id", tenantId);
  const bookings = (data ?? []).map((r) => r.data as Booking);
  if (bookings.length > 0) lsSet("als-bookings", bookings);
  return bookings.length > 0 ? bookings : parse(ls("als-bookings"), []);
}

export async function syncBookings(tenantId: string, branchId: string | null, bookings: Booking[]) {
  lsSet("als-bookings", bookings);
  try {
    await supabase.from("bookings").delete().eq("tenant_id", tenantId);
    if (bookings.length > 0) {
      await supabase.from("bookings").insert(
        bookings.map((b) => ({ tenant_id: tenantId, branch_id: branchId, data: b }))
      );
    }
  } catch { /* table may not exist yet */ }
}

export function subscribeToBookings(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`bookings:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "bookings",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

// ── Membership Plans ─────────────────────────────────────────────────────────

export async function loadMembershipPlans(tenantId: string): Promise<MembershipPlan[]> {
  const { data, error } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();
  if (error || !data) return parse(ls("als-membership-plans"), []);
  const plans = (data.data as MembershipPlan[]) ?? [];
  lsSet("als-membership-plans", plans);
  return plans;
}

export function subscribeToMembershipPlans(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`membership_plans:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "membership_plans",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

export async function syncMembershipPlans(tenantId: string, branchId: string | null, plans: MembershipPlan[]) {
  lsSet("als-membership-plans", plans);
  try {
    await supabase.from("membership_plans").upsert(
      { tenant_id: tenantId, branch_id: branchId, data: plans, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
  } catch { /* table may not exist yet */ }
}

// ── Memberships ──────────────────────────────────────────────────────────────

export async function loadMemberships(tenantId: string): Promise<Membership[]> {
  const { data } = await supabase.from("memberships").select("*").eq("tenant_id", tenantId);
  const memberships = (data ?? []).map((r) => r.data as Membership);
  if (memberships.length > 0) lsSet("als-memberships", memberships);
  return memberships.length > 0 ? memberships : parse(ls("als-memberships"), []);
}

export function subscribeToMemberships(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`memberships:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "memberships",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

export async function syncMemberships(tenantId: string, branchId: string | null, memberships: Membership[]) {
  lsSet("als-memberships", memberships);
  try {
    await supabase.from("memberships").delete().eq("tenant_id", tenantId);
    if (memberships.length > 0) {
      await supabase.from("memberships").insert(
        memberships.map((m) => ({ tenant_id: tenantId, branch_id: branchId, data: m }))
      );
    }
  } catch { /* table may not exist yet */ }
}

// ── Promotions ───────────────────────────────────────────────────────────────

export async function loadPromotions(tenantId: string): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();
  if (error || !data) return parse(ls("als-promotions"), []);
  const promos = (data.data as Promotion[]) ?? [];
  lsSet("als-promotions", promos);
  return promos;
}

export function subscribeToPromotions(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`promotions:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "promotions",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

export async function syncPromotions(tenantId: string, branchId: string | null, promotions: Promotion[]) {
  lsSet("als-promotions", promotions);
  try {
    await supabase.from("promotions").upsert(
      { tenant_id: tenantId, branch_id: branchId, data: promotions, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    );
  } catch { /* table may not exist yet */ }
}

// ── Maintenance Logs ─────────────────────────────────────────────────────────

export async function loadMaintenanceLogs(tenantId: string): Promise<MaintenanceLog[]> {
  const { data } = await supabase.from("maintenance_logs").select("*").eq("tenant_id", tenantId);
  const logs = (data ?? []).map((r) => r.data as MaintenanceLog);
  if (logs.length > 0) lsSet("als-maintenance-logs", logs);
  return logs.length > 0 ? logs : parse(ls("als-maintenance-logs"), []);
}

export function subscribeToMaintenanceLogs(tenantId: string, cb: RealtimeCallback) {
  return supabase
    .channel(`maintenance_logs:${tenantId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "maintenance_logs",
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => cb(payload as Record<string, unknown>))
    .subscribe();
}

export async function syncMaintenanceLogs(tenantId: string, branchId: string | null, logs: MaintenanceLog[]) {
  lsSet("als-maintenance-logs", logs);
  try {
    await supabase.from("maintenance_logs").delete().eq("tenant_id", tenantId);
    if (logs.length > 0) {
      await supabase.from("maintenance_logs").insert(
        logs.map((l) => ({ tenant_id: tenantId, branch_id: branchId, data: l }))
      );
    }
  } catch { /* table may not exist yet */ }
}
