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
  HistoryRecord, Debt, Tenant, Branch, SpecialGuest, Customer,
} from "@/lib/supabase";
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
  ] = await Promise.allSettled([
    supabase.from("floors").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("menu_items").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("active_sessions").select("*").eq("tenant_id", tenantId),
    supabase.from("history").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
    supabase.from("debts").select("*").eq("tenant_id", tenantId),
    supabase.from("tenant_settings").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("invoice_counter").select("*").eq("tenant_id", tenantId).limit(1).single(),
    supabase.from("customers").select("*").eq("tenant_id", tenantId).limit(1).single(),
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
  lsSet("als-pins", pins);
  lsSet("als-role-names", roleNames);
  lsSet("als-settings", settings);
  lsSet("als-invoice-counter", String(invoiceCounter));

  return { floors, menu, sessions, orders, history, debts, customers, pins, roleNames, settings, logo, invoiceCounter };
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

export async function getAndIncrementInvoice(tenantId: string): Promise<number> {
  const { data } = await supabase
    .from("invoice_counter")
    .select("counter")
    .eq("tenant_id", tenantId)
    .single();

  const current = data?.counter ?? 1;
  await supabase.from("invoice_counter")
    .update({ counter: current + 1 })
    .eq("tenant_id", tenantId);

  lsSet("als-invoice-counter", String(current + 1));
  return current;
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
