"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_FLOORS, DEFAULT_MENU, DEFAULT_PINS, DEFAULT_ROLE_NAMES, DEFAULT_BOXING_TOKENS, MATCH_PRICE, TIER_GRACE_MINUTES, COUNTER_FLOOR, COUNTER_FLOOR_ID } from "@/lib/defaults";
import { DEFAULT_SETTINGS, FONTS, FONT_SIZES, THEMES, T } from "@/lib/settings";
import { supabase } from "@/lib/supabase";
import type { Floor, MenuItem, Session, OrderItem, HistoryRecord, Debt, UserLogin, UserRole, CalcResult, Shift, ShiftRecord, Customer, SpecialGuest, Tournament, InspectionRegister, Booking, MembershipPlan, Membership, Promotion, MaintenanceLog, BoxingTokenData, BoxingTokenEntry } from "@/lib/supabase";
import type { SystemSettings, ThemeMode, FontFamily, FontSize, Language } from "@/lib/settings";
import { uid, fmtTime, fmtMoney, fmtD } from "@/lib/utils";
import { printSession } from "@/lib/printReceipt";
import { useAuth } from "@/lib/auth-context";
import {
  loadTenantData, syncFloors, syncMenu, syncSession, deleteSession,
  addHistoryRecord, syncDebts, syncSettings, getAndIncrementInvoice, clearHistory,
  loadDebts, subscribeToSessions, subscribeToHistory, subscribeToDebts,
  syncSpecialGuests, loadSpecialGuests, subscribeToSpecialGuests,
  syncCustomers,
  upsertTournament, loadTournaments, subscribeToTournaments, cancelTournament,
  upsertRegister, subscribeToRegisters,
  updateHistoryRecord as updateHistoryRecordDB,
  deleteHistoryRecord as deleteHistoryRecordDB,
  syncBookings, syncMembershipPlans, syncMemberships, syncPromotions, syncMaintenanceLogs,
  loadMenu, subscribeToMenu, loadFloors, subscribeToFloors,
  subscribeToCustomers, loadCustomers,
  subscribeToBookings, loadBookings,
  subscribeToMembershipPlans, loadMembershipPlans,
  subscribeToMemberships, loadMemberships,
  subscribeToPromotions, loadPromotions,
  subscribeToMaintenanceLogs, loadMaintenanceLogs,
  subscribeToSettings, syncShift, loadShiftData,
  syncBoxingTokens, loadBoxingTokenData,
} from "@/lib/db";
import AuthScreen from "./AuthScreen";
import RoleSelectScreen from "./RoleSelectScreen";
import DetailView from "./DetailView";
import HistoryView from "./HistoryView";
import DebtsView from "./DebtsView";
import StatsView from "./StatsView";
import AdminView from "./AdminView";
import QrOrdersPanel from "./QrOrdersPanel";
import ShiftView from "./ShiftView";
import CustomersView from "./CustomersView";
import ScannerModal from "./ScannerModal";
import SpecialGuestsView, { GUEST_TYPE_CONFIG, isInspectorType } from "./SpecialGuestsView";
import TournamentsView from "./TournamentsView";
import RegistersView from "./RegistersView";
import DashboardView from "./DashboardView";
import BookingsView from "./BookingsView";
import MembershipsView from "./MembershipsView";
import PromotionsView from "./PromotionsView";
import MaintenanceView from "./MaintenanceView";
import BoxingTokensView from "./BoxingTokensView";
import SarSymbol from "./SarSymbol";

export default function CashierSystem() {
  // ── Supabase Auth context ──
  const { supabaseReady, isAuthenticated, appCtx, ctxLoading, signOut } = useAuth();

  // ── Role / PIN login (after Supabase auth) ──
  const [user, setUser] = useState<UserLogin | null>(null);
  const [pins, setPins] = useState<Record<UserRole, string>>(DEFAULT_PINS);
  const [roleNames, setRoleNames] = useState<Record<UserRole, string>>(DEFAULT_ROLE_NAMES);

  // ── Settings ──
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  // ── Core state ──
  const [floors, setFloors] = useState<Floor[]>([...DEFAULT_FLOORS, COUNTER_FLOOR]);
  const [menu, setMenu] = useState<MenuItem[]>(DEFAULT_MENU);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [orders, setOrders] = useState<Record<string, OrderItem[]>>({});
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  // ── Logo + invoice counter ──
  const [logo, setLogo] = useState<string | null>(null);
  const [invoiceCounter, setInvoiceCounter] = useState(1);

  // ── Shift management ──
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<ShiftRecord[]>([]);
  const [lastClosedShift, setLastClosedShift] = useState<ShiftRecord | null>(null);

  // ── Customer loyalty ──
  const [customers, setCustomers] = useState<Customer[]>([]);

  // ── Special guests ──
  const [specialGuests, setSpecialGuests] = useState<SpecialGuest[]>([]);

  // ── Tournaments ──
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registers, setRegisters] = useState<InspectionRegister[]>([]);

  // ── New features state ──
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);

  // ── Boxing token system ──
  const [boxingTokens, setBoxingTokens] = useState<BoxingTokenData | null>(null);

  // ── UI state ──
  const [view, setView] = useState("main");
  const [selItem, setSelItem] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [selFloor, setSelFloor] = useState("f1");
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(false);

  // ── Sync health tracking ──
  const [syncFailed, setSyncFailed] = useState(false);

  // ── QR notification state ──
  const [pendingQrCount, setPendingQrCount] = useState(0);
  const [qrToast, setQrToast] = useState<{ room_name: string; item_name: string; item_icon: string } | null>(null);

  // ── Alarm state: rooms with active alarm (< 5 min remaining) ──
  const [alarmItemIds, setAlarmItemIds] = useState<Set<string>>(new Set());
  const alarmSoundRef = useRef<number>(0); // counter for repeating alarm sound

  // ── Sound + warning tracking ──
  const warnedItemsRef = useRef<Set<string>>(new Set());

  // Track if we've loaded from Supabase for this tenant
  const loadedTenantRef = useRef<string | null>(null);
  // Suppress re-syncing data that arrived from realtime (prevents infinite loop)
  const realtimeSkipRef = useRef({
    debts: false, specialGuests: false,
    membershipPlans: false, memberships: false, promotions: false,
    maintenanceLogs: false, bookings: false, customers: false,
    floors: false, menu: false, boxingTokens: false,
  });

  const t = T[settings.lang];
  const isRTL = settings.lang === "ar";
  const isManager = user?.role === "manager";

  // ── Apply settings to DOM ──
  useEffect(() => {
    // Resolve actual theme (system → detect OS preference)
    let resolvedTheme: string = settings.theme;
    if (settings.theme === "system") {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", settings.lang);
    document.documentElement.style.setProperty("--font", FONTS[settings.font].css);
    document.documentElement.style.setProperty("--font-scale", String(FONT_SIZES[settings.fontSize].scale));
  }, [settings, isRTL]);

  // ── Listen for OS theme changes when "system" mode is active ──
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  // ── Load from localStorage (instant boot cache) ──
  useEffect(() => {
    try { const v = localStorage.getItem("als-floors"); if (v) setFloors(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-menu"); if (v) setMenu(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-sessions"); if (v) setSessions(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-orders"); if (v) setOrders(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-history"); if (v) setHistory(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-debts"); if (v) setDebts(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-pins"); if (v) setPins(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-role-names"); if (v) setRoleNames(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-user"); if (v) setUser(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-settings"); if (v) setSettings(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-logo"); if (v) setLogo(v); } catch {}
    try { const v = localStorage.getItem("als-invoice-counter"); if (v) setInvoiceCounter(Number(v) || 1); } catch {}
    try { const v = localStorage.getItem("als-shift"); if (v) setCurrentShift(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-shift-history"); if (v) setShiftHistory(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-customers"); if (v) setCustomers(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-special-guests"); if (v) setSpecialGuests(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-tournaments"); if (v) setTournaments(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-registers"); if (v) setRegisters(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-bookings"); if (v) setBookings(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-membership-plans"); if (v) setMembershipPlans(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-memberships"); if (v) setMemberships(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-promotions"); if (v) setPromotions(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-maintenance-logs"); if (v) setMaintenanceLogs(JSON.parse(v)); } catch {}
    try { const v = localStorage.getItem("als-boxing-tokens"); if (v) setBoxingTokens(JSON.parse(v)); } catch {}
  }, []);

  // ── Load from Supabase when tenant is ready (overrides localStorage) ──
  useEffect(() => {
    if (!appCtx?.tenant?.id) return;
    if (loadedTenantRef.current === appCtx.tenant.id) return;
    loadedTenantRef.current = appCtx.tenant.id;
    setDbLoading(true);
    loadTenantData(appCtx.tenant.id, appCtx.branch?.id ?? null).then((data) => {
      // Always ensure counter floor is present (virtual floor, not stored in DB)
      const hasCounter = data.floors.some((f) => f.id === COUNTER_FLOOR_ID);
      // Migrate: add priceTiers from defaults if missing (zones that should have tiered pricing)
      const tiersMigrated = (hasCounter ? data.floors : [...data.floors, COUNTER_FLOOR]).map((f) => ({
        ...f,
        zones: f.zones.map((z) => {
          if (z.priceTiers?.length || z.pricingMode === "walkin" || z.pricingMode === "manual" || z.pricingMode === "per-hit" || z.pricingMode === "token") return z;
          // Find matching default zone to copy tiers from
          const defZone = DEFAULT_FLOORS.flatMap((df) => df.zones).find((dz) => dz.id === z.id);
          if (defZone?.priceTiers) return { ...z, priceTiers: defZone.priceTiers, pricingMode: defZone.pricingMode || "tiered" };
          return z;
        }),
      }));

      // ── Migration: merge floor 2 into floor 1 (single-floor layout) ──
      // Renumbers items per owner's request:
      //   bill2-1 → "بلياردو 4", bill2-2 → "بلياردو 5"
      //   baloot2-1 → "بلوت 2",  baloot2-2 → "بلوت 3"   (sequential 1-2-3)
      //   floor-1 → "غرفة 11",  floor-2 → "غرفة 12"  (moved into rooms zone)
      //   tennis zone → copied as-is to floor 1
      // IDs are preserved so active sessions + history stay intact.
      type ZoneItem = Floor["zones"][number]["items"][number];
      const renameLegacyItem = (item: ZoneItem): ZoneItem => {
        switch (item.id) {
          case "bill2-1": return { ...item, name: "بلياردو 4" };
          case "bill2-2": return { ...item, name: "بلياردو 5" };
          case "baloot2-1": return { ...item, name: "بلوت 2" };
          case "baloot2-2": return { ...item, name: "بلوت 3" };
          case "floor-1": return { ...item, name: "غرفة 11", sub: "PS5 + TV" };
          case "floor-2": return { ...item, name: "غرفة 12", sub: "PS5 + TV" };
          default: return item;
        }
      };
      const f2 = tiersMigrated.find((f) => f.id === "f2");
      let migratedFloors = tiersMigrated;
      if (f2) {
        const f1 = tiersMigrated.find((f) => f.id === "f1");
        if (f1) {
          const billiard2 = f2.zones.find((z) => z.id === "billiard2");
          const baloot2 = f2.zones.find((z) => z.id === "baloot2");
          const floorZone = f2.zones.find((z) => z.id === "floor");
          const tennisZone = f2.zones.find((z) => z.id === "tennis");

          const mergedF1Zones = f1.zones.map((z) => {
            if (z.id === "billiard1" && billiard2) {
              const existing = new Set(z.items.map((i) => i.id));
              const newItems = billiard2.items.map(renameLegacyItem).filter((i) => !existing.has(i.id));
              return { ...z, items: [...z.items, ...newItems] };
            }
            if (z.id === "baloot1" && baloot2) {
              const existing = new Set(z.items.map((i) => i.id));
              const newItems = baloot2.items.map(renameLegacyItem).filter((i) => !existing.has(i.id));
              return { ...z, items: [...z.items, ...newItems] };
            }
            if (z.id === "rooms" && floorZone) {
              const existing = new Set(z.items.map((i) => i.id));
              const newItems = floorZone.items.map(renameLegacyItem).filter((i) => !existing.has(i.id));
              return { ...z, items: [...z.items, ...newItems] };
            }
            return z;
          });

          // Append tennis zone if not already on floor 1
          const f1HasTennis = mergedF1Zones.some((z) => z.id === "tennis");
          const finalF1Zones = f1HasTennis || !tennisZone ? mergedF1Zones : [...mergedF1Zones, tennisZone];

          const updatedF1 = { ...f1, name: "الصالة", zones: finalF1Zones };
          migratedFloors = tiersMigrated
            .filter((f) => f.id !== "f2")
            .map((f) => (f.id === "f1" ? updatedF1 : f));
        }
      }
      // ── Idempotent post-merge rename: fixes tenants who already ran the old
      //    migration which left baloot2-1/baloot2-2 named "بلوت 3"/"بلوت 4".
      //    Runs every load; no-op once names are correct. ──
      migratedFloors = migratedFloors.map((f) => ({
        ...f,
        zones: f.zones.map((z) => ({
          ...z,
          items: z.items.map((item) => {
            if (item.id === "baloot2-1" && item.name !== "بلوت 2") return { ...item, name: "بلوت 2" };
            if (item.id === "baloot2-2" && item.name !== "بلوت 3") return { ...item, name: "بلوت 3" };
            return item;
          }),
        })),
      }));
      setFloors(migratedFloors);
      setMenu(data.menu);
      // Merge: prev wins for sessions created during the DB loading window (not yet in Supabase).
      // data.sessions already merges LS+Supabase (see db.ts), so this only protects the loading gap.
      setSessions((prev) => ({ ...data.sessions, ...prev }));
      setOrders((prev) => ({ ...data.orders, ...prev }));
      setHistory(data.history);
      setDebts(data.debts);
      setCustomers(data.customers);
      setTournaments(data.tournaments);
      setRegisters(data.registers);
      setBookings(data.bookings);
      setMembershipPlans(data.membershipPlans);
      setMemberships(data.memberships);
      setPromotions(data.promotions);
      setMaintenanceLogs(data.maintenanceLogs);
      setPins(data.pins);
      setRoleNames(data.roleNames);
      setSettings(data.settings);
      if (data.logo) setLogo(data.logo);
      setInvoiceCounter(data.invoiceCounter);
      if (data.boxingTokens) setBoxingTokens(data.boxingTokens);
      // Load shift data from Supabase and merge with localStorage.
      // Supabase wins on conflict, but unsynced shift records (network failure) survive.
      loadShiftData(appCtx.tenant.id).then(({ currentShift: cs, shiftHistory: sh }) => {
        if (cs !== undefined && cs !== null) setCurrentShift(cs as Shift);
        const supaShifts = (sh && Array.isArray(sh) ? sh : []) as ShiftRecord[];
        if (supaShifts.length > 0) {
          setShiftHistory((prevLS) => {
            const byId = new Map<string, ShiftRecord>();
            for (const s of prevLS) if (s.id) byId.set(s.id, s);
            for (const s of supaShifts) if (s.id) byId.set(s.id, s); // Supabase wins
            return Array.from(byId.values()).sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
          });
        }
      }).catch(() => {});
      setDbLoading(false);
    }).catch((err) => {
      // If Supabase load fails entirely, fall back to localStorage (already loaded at mount).
      // setDbLoading(false) is critical — without it the UI hangs indefinitely.
      console.error("[loadTenantData] failed, using localStorage fallback:", err);
      setDbLoading(false);
    });
  }, [appCtx]);

  const saveLS = useCallback((k: string, v: unknown) => {
    try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); } catch {}
  }, []);

  const tenantId = appCtx?.tenant?.id ?? null;
  const branchId = appCtx?.branch?.id ?? null;

  // localStorage saves (instant)
  useEffect(() => { saveLS("als-floors", floors); }, [floors, saveLS]);
  useEffect(() => { saveLS("als-menu", menu); }, [menu, saveLS]);
  useEffect(() => { saveLS("als-sessions", sessions); }, [sessions, saveLS]);
  useEffect(() => { saveLS("als-orders", orders); }, [orders, saveLS]);
  useEffect(() => { saveLS("als-history", history); }, [history, saveLS]);
  useEffect(() => { saveLS("als-debts", debts); }, [debts, saveLS]);
  useEffect(() => { saveLS("als-pins", pins); }, [pins, saveLS]);
  useEffect(() => { saveLS("als-role-names", roleNames); }, [roleNames, saveLS]);
  useEffect(() => { if (user) saveLS("als-user", user); }, [user, saveLS]);
  useEffect(() => { saveLS("als-settings", settings); }, [settings, saveLS]);
  useEffect(() => { if (logo) saveLS("als-logo", logo); else { try { localStorage.removeItem("als-logo"); } catch {} } }, [logo, saveLS]);
  useEffect(() => { saveLS("als-invoice-counter", String(invoiceCounter)); }, [invoiceCounter, saveLS]);
  useEffect(() => { if (currentShift) saveLS("als-shift", currentShift); else { try { localStorage.removeItem("als-shift"); } catch {} } }, [currentShift, saveLS]);
  useEffect(() => { saveLS("als-shift-history", shiftHistory); }, [shiftHistory, saveLS]);
  useEffect(() => { saveLS("als-customers", customers); }, [customers, saveLS]);
  useEffect(() => { saveLS("als-special-guests", specialGuests); }, [specialGuests, saveLS]);
  useEffect(() => { saveLS("als-bookings", bookings); }, [bookings, saveLS]);
  useEffect(() => { saveLS("als-membership-plans", membershipPlans); }, [membershipPlans, saveLS]);
  useEffect(() => { saveLS("als-memberships", memberships); }, [memberships, saveLS]);
  useEffect(() => { saveLS("als-promotions", promotions); }, [promotions, saveLS]);
  useEffect(() => { saveLS("als-maintenance-logs", maintenanceLogs); }, [maintenanceLogs, saveLS]);
  useEffect(() => { if (boxingTokens) saveLS("als-boxing-tokens", boxingTokens); }, [boxingTokens, saveLS]);

  // ── Emergency flush: write sessions + orders to localStorage synchronously before unload ──
  // React's useEffect is async — if the user refreshes before the effect fires, the latest
  // state is lost. This handler guarantees the last known state hits localStorage.
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem("als-sessions", JSON.stringify(sessions));
        localStorage.setItem("als-orders", JSON.stringify(orders));
      } catch {}
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [sessions, orders]);

  // Supabase background syncs (non-blocking)
  useEffect(() => {
    if (!tenantId || dbLoading) return;
    if (realtimeSkipRef.current.floors) { realtimeSkipRef.current.floors = false; return; }
    syncFloors(tenantId, branchId, floors).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    if (realtimeSkipRef.current.menu) { realtimeSkipRef.current.menu = false; return; }
    syncMenu(tenantId, branchId, menu).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    syncSettings(tenantId, settings, pins, roleNames).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, pins, roleNames, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading || !boxingTokens) return;
    if (realtimeSkipRef.current.boxingTokens) { realtimeSkipRef.current.boxingTokens = false; return; }
    syncBoxingTokens(tenantId, boxingTokens).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxingTokens, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    if (realtimeSkipRef.current.debts) { realtimeSkipRef.current.debts = false; return; }
    syncDebts(tenantId, branchId, debts).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debts, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    if (realtimeSkipRef.current.specialGuests) { realtimeSkipRef.current.specialGuests = false; return; }
    syncSpecialGuests(tenantId, specialGuests).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialGuests, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    if (realtimeSkipRef.current.customers) { realtimeSkipRef.current.customers = false; return; }
    syncCustomers(tenantId, branchId, customers).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    if (realtimeSkipRef.current.bookings) { realtimeSkipRef.current.bookings = false; return; }
    syncBookings(tenantId, branchId, bookings).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    if (realtimeSkipRef.current.membershipPlans) { realtimeSkipRef.current.membershipPlans = false; return; }
    syncMembershipPlans(tenantId, branchId, membershipPlans).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipPlans, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    if (realtimeSkipRef.current.memberships) { realtimeSkipRef.current.memberships = false; return; }
    syncMemberships(tenantId, branchId, memberships).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    if (realtimeSkipRef.current.promotions) { realtimeSkipRef.current.promotions = false; return; }
    syncPromotions(tenantId, branchId, promotions).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promotions, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    if (realtimeSkipRef.current.maintenanceLogs) { realtimeSkipRef.current.maintenanceLogs = false; return; }
    syncMaintenanceLogs(tenantId, branchId, maintenanceLogs).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintenanceLogs, tenantId]);

  // ── Realtime: multi-device sync ──────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;

    // Sessions: INSERT/UPDATE → apply new session+orders; DELETE → remove
    const sessionsSub = subscribeToSessions(tenantId, (payload) => {
      const p = payload as { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };
      if (p.eventType === "DELETE") {
        const itemId = p.old.item_id as string;
        setSessions((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
        setOrders((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
      } else {
        const itemId = p.new.item_id as string;
        const session = p.new.session_data as Session;
        const rowOrders = (p.new.orders as OrderItem[]) ?? [];
        setSessions((prev) => ({ ...prev, [itemId]: session }));
        setOrders((prev) => ({ ...prev, [itemId]: rowOrders }));
      }
    });

    // History: INSERT → prepend if not already present (guard against own-device duplicate)
    const historySub = subscribeToHistory(tenantId, (payload) => {
      const p = payload as { eventType: string; new: Record<string, unknown> };
      if (p.eventType === "INSERT") {
        const record = p.new.data as HistoryRecord;
        setHistory((prev) => {
          if (prev.some((r) => r.id === record.id)) return prev;
          return [record, ...prev];
        });
      }
    });

    // Debts: any change → reload all debts fresh from Supabase; flag skips re-sync
    const debtsSub = subscribeToDebts(tenantId, () => {
      loadDebts(tenantId).then((fresh) => {
        realtimeSkipRef.current.debts = true;
        setDebts(fresh);
      }).catch(() => {});
    });

    // Special guests: any change → reload fresh (for multi-device inspector alerts)
    const specialGuestsSub = subscribeToSpecialGuests(tenantId, () => {
      loadSpecialGuests(tenantId).then((fresh) => {
        realtimeSkipRef.current.specialGuests = true;
        setSpecialGuests(fresh);
      }).catch(() => {});
    });

    // Tournaments: each event carries one tournament row — merge into local state
    const tournamentsSub = subscribeToTournaments(tenantId, (payload) => {
      const p = payload as { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };
      if (p.eventType === "DELETE") {
        const id = p.old.id as string;
        setTournaments((prev) => prev.filter((t) => t.id !== id));
      } else {
        const updated = p.new.data as Tournament;
        setTournaments((prev) => {
          const exists = prev.some((t) => t.id === updated.id);
          return exists ? prev.map((t) => t.id === updated.id ? updated : t) : [...prev, updated];
        });
      }
    });

    const registersSub = subscribeToRegisters(tenantId, (payload) => {
      const p = payload as { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };
      if (p.eventType !== "DELETE") {
        const updated = p.new.data as InspectionRegister;
        setRegisters((prev) => {
          const exists = prev.some((r) => r.type === updated.type);
          return exists ? prev.map((r) => r.type === updated.type ? updated : r) : [...prev, updated];
        });
      }
    });

    // Menu: any change → reload fresh menu from Supabase
    const menuSub = subscribeToMenu(tenantId, () => {
      loadMenu(tenantId).then((fresh) => {
        if (fresh.length > 0) {
          realtimeSkipRef.current.menu = true;
          setMenu(fresh);
        }
      }).catch(() => {});
    });

    // Floors: any change → reload fresh floors from Supabase
    const floorsSub = subscribeToFloors(tenantId, () => {
      loadFloors(tenantId).then((fresh) => {
        if (fresh.length > 0) {
          realtimeSkipRef.current.floors = true;
          const hasCounter = fresh.some((f) => f.id === COUNTER_FLOOR_ID);
          setFloors(hasCounter ? fresh : [...fresh, COUNTER_FLOOR]);
        }
      }).catch(() => {});
    });

    // Customers: any change → reload
    const customersSub = subscribeToCustomers(tenantId, () => {
      loadCustomers(tenantId).then((fresh) => {
        realtimeSkipRef.current.customers = true;
        setCustomers(fresh);
      }).catch(() => {});
    });

    // Bookings: any change → reload
    const bookingsSub = subscribeToBookings(tenantId, () => {
      loadBookings(tenantId).then((fresh) => {
        realtimeSkipRef.current.bookings = true;
        setBookings(fresh);
      }).catch(() => {});
    });

    // Membership Plans: any change → reload
    const plansSub = subscribeToMembershipPlans(tenantId, () => {
      loadMembershipPlans(tenantId).then((fresh) => {
        realtimeSkipRef.current.membershipPlans = true;
        setMembershipPlans(fresh);
      }).catch(() => {});
    });

    // Memberships: any change → reload
    const membershipsSub = subscribeToMemberships(tenantId, () => {
      loadMemberships(tenantId).then((fresh) => {
        realtimeSkipRef.current.memberships = true;
        setMemberships(fresh);
      }).catch(() => {});
    });

    // Promotions: any change → reload
    const promosSub = subscribeToPromotions(tenantId, () => {
      loadPromotions(tenantId).then((fresh) => {
        realtimeSkipRef.current.promotions = true;
        setPromotions(fresh);
      }).catch(() => {});
    });

    // Maintenance Logs: any change → reload
    const maintSub = subscribeToMaintenanceLogs(tenantId, () => {
      loadMaintenanceLogs(tenantId).then((fresh) => {
        realtimeSkipRef.current.maintenanceLogs = true;
        setMaintenanceLogs(fresh);
      }).catch(() => {});
    });

    // Settings (includes shifts): any change → reload shift data
    const settingsSub = subscribeToSettings(tenantId, () => {
      loadShiftData(tenantId).then(({ currentShift: cs, shiftHistory: sh }) => {
        if (cs !== undefined) setCurrentShift(cs as Shift | null);
        if (sh) setShiftHistory(sh as ShiftRecord[]);
      }).catch(() => {});
      // Also reload boxing tokens (stored in same tenant_settings row)
      loadBoxingTokenData(tenantId).then((bt) => {
        if (bt) {
          realtimeSkipRef.current.boxingTokens = true;
          setBoxingTokens(bt);
        }
      }).catch(() => {});
    });

    return () => {
      sessionsSub.unsubscribe();
      historySub.unsubscribe();
      debtsSub.unsubscribe();
      specialGuestsSub.unsubscribe();
      tournamentsSub.unsubscribe();
      registersSub.unsubscribe();
      menuSub.unsubscribe();
      floorsSub.unsubscribe();
      customersSub.unsubscribe();
      bookingsSub.unsubscribe();
      plansSub.unsubscribe();
      membershipsSub.unsubscribe();
      promosSub.unsubscribe();
      maintSub.unsubscribe();
      settingsSub.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // ── Sound system ──────────────────────────────────────────────────────────────
  const playTone = (freq: number, duration: number, type: OscillatorType = "sine", vol = 0.4) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = type;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(); osc.stop(ctx.currentTime + duration);
    } catch { /* AudioContext may be blocked until user interaction */ }
  };

  const playSound = (sound: "qrOrder" | "sessionOpen" | "timeWarning") => {
    if (sound === "qrOrder") {
      playTone(880, 0.15); setTimeout(() => playTone(1100, 0.2), 160);
    } else if (sound === "sessionOpen") {
      playTone(660, 0.1); setTimeout(() => playTone(880, 0.15), 110);
    } else if (sound === "timeWarning") {
      [0, 220, 440].forEach((d) => setTimeout(() => playTone(440, 0.12, "square", 0.3), d));
    }
  };

  // ── QR orders global subscription (badge + sound + toast) ──────────────────
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`qr-global-${tenantId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "qr_orders",
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        const o = payload.new as { room_name: string; item_name: string; item_icon: string; status: string };
        setPendingQrCount((p) => p + 1);
        playSound("qrOrder");
        setQrToast({ room_name: o.room_name, item_name: o.item_name, item_icon: o.item_icon });
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "qr_orders",
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        const o = payload.new as { status: string };
        if (o.status !== "pending") setPendingQrCount((p) => Math.max(0, p - 1));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    const iv = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      const newAlarms = new Set(alarmItemIds);
      let alarmsChanged = false;

      Object.entries(sessions).forEach(([itemId, sess]) => {
        if (!sess || sess.durationMins === 0) return; // open sessions skip
        const elapsed = ts - sess.startTime;
        const grace = sess.graceMins || 0;
        const totalMs = (sess.durationMins + grace) * 60000;
        const remaining = totalMs - elapsed;

        // ── WhatsApp at 10 minutes (one-time) ──
        const whatsappMins = settings.whatsappNotifyMins ?? 10;
        if (remaining > 0 && remaining <= whatsappMins * 60000 && !warnedItemsRef.current.has(itemId)) {
          warnedItemsRef.current.add(itemId);
          if (sess.phone) {
            const itemName = floors.flatMap((f) => f.zones.flatMap((z) => z.items)).find((i) => i.id === itemId)?.name || itemId;
            const minsLeft = Math.ceil(remaining / 60000);
            const msg = settings.lang === "ar"
              ? `مرحباً ${sess.customerName}، جلستك في ${itemName} ستنتهي خلال ${minsLeft} دقائق. شكراً لزيارتكم - مركز الصملة للترفيه`
              : `Hi ${sess.customerName}, your session at ${itemName} will end in ${minsLeft} minutes. Thank you - ALSAMLAH Entertainment`;
            const phone = sess.phone.replace(/\D/g, "").replace(/^0/, "966");
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
          }
        }

        // ── Persistent alarm at 5 minutes ──
        if (remaining > 0 && remaining <= 5 * 60000) {
          if (!newAlarms.has(itemId)) {
            newAlarms.add(itemId);
            alarmsChanged = true;
            playSound("timeWarning"); // first alarm sound
          }
        }
        // Auto-remove alarm when session ends or goes overtime
        if (remaining <= 0 && newAlarms.has(itemId)) {
          newAlarms.delete(itemId);
          alarmsChanged = true;
        }
      });

      // Remove alarms for sessions that no longer exist
      for (const id of newAlarms) {
        if (!sessions[id]) { newAlarms.delete(id); alarmsChanged = true; }
      }
      if (alarmsChanged) setAlarmItemIds(newAlarms);

      // ── Repeat alarm sound every 10 seconds for active alarms ──
      alarmSoundRef.current++;
      if (alarmSoundRef.current % 10 === 0 && newAlarms.size > 0) {
        playSound("timeWarning");
      }

      // ── Repeat QR sound every 15 seconds for pending orders ──
      if (alarmSoundRef.current % 15 === 0 && pendingQrCount > 0) {
        playSound("qrOrder");
      }
    }, 1000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, alarmItemIds, pendingQrCount]);

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const getInvoiceNo = async (): Promise<string> => {
    const eodHour = settings.endOfDayHour ?? 5;
    if (tenantId) {
      const n = await getAndIncrementInvoice(tenantId, eodHour);
      return n;
    }
    // Offline fallback: use local counter, zero-padded
    const n = invoiceCounter;
    setInvoiceCounter((p) => p + 1);
    return String(n).padStart(4, "0");
  };

  const getInfo = (itemId: string) => {
    for (const f of floors) for (const z of f.zones) {
      const it = z.items.find((i) => i.id === itemId);
      if (it) return { ...it, zone: z, floor: f };
    }
    return null;
  };

  const calcTotal = (itemId: string): CalcResult => {
    const sess = sessions[itemId];
    if (!sess) return { remaining: 0, elapsed: 0, progress: 1, timePrice: 0, ordersTotal: 0, total: 0, isOvertime: false, isOpen: false, graceMins: 0 };
    const elapsed = now - sess.startTime;
    const ords = orders[itemId] || [], ordersTotal = ords.reduce((s, o) => s + o.price, 0);
    const info = getInfo(itemId), zone = info?.zone;
    const grace = sess.graceMins || 0;

    // ── Match session: flat fixed price ──
    if (sess.sessionType === "match") {
      return { remaining: elapsed, elapsed, progress: -1, timePrice: MATCH_PRICE, ordersTotal, total: MATCH_PRICE + ordersTotal, isOvertime: false, isOpen: true, graceMins: 0 };
    }

    // ── Walk-in / counter: orders only, no time charge ──
    if (zone?.pricingMode === "walkin" || sess.sessionType === "walkin") {
      return { remaining: elapsed, elapsed, progress: -1, timePrice: 0, ordersTotal, total: ordersTotal, isOvertime: false, isOpen: true, graceMins: 0 };
    }

    // ── Manual pricing: cashier enters price ──
    if (zone?.pricingMode === "manual") {
      const timePrice = sess.manualPrice || 0;
      return { remaining: elapsed, elapsed, progress: -1, timePrice, ordersTotal, total: timePrice + ordersTotal, isOvertime: false, isOpen: true, graceMins: 0 };
    }

    // ── Boxing: token mode — tokenCount × tokenPrice, deduct tokens at session end ──
    if (zone?.pricingMode === "token") {
      const tokenCount = sess.playerCount ?? 1;
      const tokenPrice = zone.hitPrice ?? 7.5;
      const timePrice = tokenCount * tokenPrice;
      return { remaining: 0, elapsed, progress: 1, timePrice, ordersTotal, total: timePrice + ordersTotal, isOvertime: false, isOpen: false, graceMins: 0 };
    }

    // ── Boxing: per-hit pricing (legacy) ──
    if (zone?.pricingMode === "per-hit") {
      const hits = sess.playerCount || 1;
      const timePrice = Math.round(hits * (zone.hitPrice || 7.5) * 10) / 10;
      return { remaining: 0, elapsed, progress: 1, timePrice, ordersTotal, total: timePrice + ordersTotal, isOvertime: false, isOpen: false, graceMins: 0 };
    }

    // ── Tiered pricing ──
    const elMins = elapsed / 60000, isOpen = sess.durationMins === 0;
    let remaining = 0, progress = 1, isOvertime = false;
    if (!isOpen) { const ta = sess.durationMins + grace; remaining = (ta * 60000) - elapsed; progress = ta > 0 ? Math.max(0, Math.min(1, remaining / (ta * 60000))) : 1; isOvertime = remaining <= 0; }
    else { remaining = elapsed; progress = -1; }

    let timePrice = 0;

    // ── Multi-segment pricing (switched activities) ──
    if (sess.pricingSegments && sess.pricingSegments.length > 0) {
      for (const seg of sess.pricingSegments) {
        const segEnd = seg.endTime || now;
        const segDur = Math.max(0, (segEnd - seg.startTime) / 60000);
        timePrice += seg.pricePerHour > 0 ? Math.ceil((segDur / 60) * seg.pricePerHour) : 0;
      }
    } else {
      // ── Single-zone pricing (no switch) ──
      const tiers = zone?.priceTiers;
      if (tiers?.length) {
        // Fixed duration → use exact tier price
        if (!isOpen && sess.durationMins > 0) {
          const tier = tiers.find((t) => t.minutes === sess.durationMins);
          timePrice = tier ? tier.price : tiers[tiers.length - 1].price;
        } else {
          // Open session → find tier based on elapsed + grace
          const billable = Math.max(elMins - grace, 0);
          const sorted = [...tiers].sort((a, b) => a.minutes - b.minutes);
          timePrice = sorted[0]?.price ?? 0;
          for (const tier of sorted) {
            if (billable <= tier.minutes + TIER_GRACE_MINUTES) { timePrice = tier.price; break; }
            timePrice = tier.price;
          }
        }
      } else {
        // Fallback: hourly calculation
        const pph = zone?.pricePerHour || 0, minC = zone?.minCharge || 0;
        const billMins = Math.max(elMins - grace, 0), chargeMins = Math.max(billMins, minC);
        timePrice = pph > 0 ? Math.ceil((chargeMins / 60) * pph) : 0;
      }
    }

    return { remaining, elapsed, progress, timePrice, ordersTotal, total: timePrice + ordersTotal, isOvertime, isOpen, graceMins: grace };
  };

  const startSession = (itemId: string, name: string, dur: number, pc: number, type: "ps" | "match" | "walkin" = "ps", phone?: string) => {
    const info = getInfo(itemId);
    const isBoxing = info?.zone?.pricingMode === "per-hit" || info?.zone?.pricingMode === "token";
    const isWalkin = info?.zone?.pricingMode === "walkin" || type === "walkin";
    const isManual = info?.zone?.pricingMode === "manual";
    const newSess: Session = {
      startTime: Date.now(),
      customerName: name || (settings.lang === "ar" ? "زائر" : "Guest"),
      phone,
      durationMins: type === "match" || isBoxing || isWalkin || isManual ? 0 : dur,
      graceMins: 0,
      playerCount: pc || 1,
      sessionType: isWalkin ? "walkin" : isBoxing ? "ps" : type,
    };
    setSessions((p) => ({ ...p, [itemId]: newSess }));
    const curOrders = orders[itemId] || [];
    setOrders((p) => ({ ...p, [itemId]: curOrders }));
    // Supabase sync
    if (tenantId) syncSession(tenantId, branchId, itemId, newSess, curOrders)
      .then(() => setSyncFailed(false))
      .catch(() => setSyncFailed(true));
    playSound("sessionOpen");
    notify(t.sessionStarted + " ✓");
  };

  // ── Switch Activity (tennis ↔ billiard) ──
  const switchActivity = (fromItemId: string, toItemId: string) => {
    const sess = sessions[fromItemId];
    if (!sess) return;
    const fromInfo = getInfo(fromItemId);
    const toInfo = getInfo(toItemId);
    const switchTime = Date.now();

    // Build pricing segments: close current segment + open new one
    const existingSegments: import("@/lib/supabase").PricingSegment[] = sess.pricingSegments || [];
    // If no segments yet, create the initial one (from session start until now)
    if (existingSegments.length === 0 && fromInfo) {
      existingSegments.push({
        zoneId: fromInfo.zone.id,
        zoneName: fromInfo.zone.name,
        itemId: fromItemId,
        itemName: fromInfo.name,
        pricePerHour: fromInfo.zone.pricePerHour,
        startTime: sess.startTime,
      });
    }
    // Close the last segment
    if (existingSegments.length > 0) {
      existingSegments[existingSegments.length - 1].endTime = switchTime;
    }
    // Add new segment for the target activity
    const newSegments = [
      ...existingSegments,
      {
        zoneId: toInfo?.zone.id || "",
        zoneName: toInfo?.zone.name || "",
        itemId: toItemId,
        itemName: toInfo?.name || toItemId,
        pricePerHour: toInfo?.zone.pricePerHour || 0,
        startTime: switchTime,
      },
    ];

    const movedSess: Session = {
      ...sess,
      switchedFrom: { itemId: fromItemId, itemName: fromInfo?.name || fromItemId, switchedAt: switchTime },
      pricingSegments: newSegments,
    };
    const movedOrders = orders[fromItemId] || [];
    // Remove from old, add to new
    setSessions((p) => { const n = { ...p }; delete n[fromItemId]; n[toItemId] = movedSess; return n; });
    setOrders((p) => { const n = { ...p }; delete n[fromItemId]; n[toItemId] = movedOrders; return n; });
    if (tenantId) {
      deleteSession(tenantId, fromItemId).catch(() => {});
      syncSession(tenantId, branchId, toItemId, movedSess, movedOrders)
        .then(() => setSyncFailed(false))
        .catch(() => setSyncFailed(true));
    }
    setSelItem(toItemId);
    notify(t.switchActivity + " ✓");
  };

  const getSwitchTargets = (itemId: string) => {
    const info = getInfo(itemId);
    if (!info) return [];
    // Allow switching to ANY available item in ANY zone (except same zone, walk-in, and counter)
    const targets: { id: string; name: string; zoneName: string; pricePerHour: number }[] = [];
    for (const f of floors) for (const z of f.zones) {
      if (z.id === info.zone.id) continue;
      if (z.pricingMode === "walkin") continue;
      if (f.id === COUNTER_FLOOR_ID) continue;
      for (const it of z.items) {
        if (!sessions[it.id] && it.status !== "maintenance" && it.status !== "disabled") {
          targets.push({ id: it.id, name: it.name, zoneName: z.name, pricePerHour: z.pricePerHour });
        }
      }
    }
    return targets;
  };

  const updatePlayerCount = (itemId: string, count: number) => {
    setSessions((p) => {
      const updated = { ...p, [itemId]: { ...p[itemId], playerCount: count } };
      if (tenantId) syncSession(tenantId, branchId, itemId, updated[itemId], orders[itemId] || [])
        .then(() => setSyncFailed(false)).catch(() => setSyncFailed(true));
      return updated;
    });
  };

  const updateManualPrice = (itemId: string, price: number) => {
    setSessions((p) => {
      const updated = { ...p, [itemId]: { ...p[itemId], manualPrice: price } };
      if (tenantId) syncSession(tenantId, branchId, itemId, updated[itemId], orders[itemId] || [])
        .then(() => setSyncFailed(false)).catch(() => setSyncFailed(true));
      return updated;
    });
  };

  const addGrace = (itemId: string, mins: number) => {
    setSessions((p) => {
      const updated = { ...p, [itemId]: { ...p[itemId], graceMins: (p[itemId]?.graceMins || 0) + mins } };
      if (tenantId) syncSession(tenantId, branchId, itemId, updated[itemId], orders[itemId] || [])
        .then(() => setSyncFailed(false)).catch(() => setSyncFailed(true));
      return updated;
    });
    notify(`+${mins} ${t.freeMin} ✓`);
  };

  const addOrder = (itemId: string, mi: MenuItem) => {
    const newItem = { ...mi, orderId: uid(), time: Date.now() };
    setOrders((p) => {
      const updated = { ...p, [itemId]: [...(p[itemId] || []), newItem] };
      if (tenantId && sessions[itemId]) syncSession(tenantId, branchId, itemId, sessions[itemId], updated[itemId])
        .then(() => setSyncFailed(false)).catch(() => setSyncFailed(true));
      return updated;
    });
    // Auto-decrement stock if tracking is enabled for this menu item
    if (mi.trackStock && (mi.stock ?? 0) > 0) {
      setMenu((prev) => prev.map((m) => m.id === mi.id ? { ...m, stock: Math.max(0, (m.stock ?? 0) - 1) } : m));
    }
    notify(`${mi.name} ✓`);
  };

  const removeOrder = (itemId: string, oid: string) => {
    setOrders((p) => {
      const updated = { ...p, [itemId]: (p[itemId] || []).filter((o) => o.orderId !== oid) };
      if (tenantId && sessions[itemId]) syncSession(tenantId, branchId, itemId, sessions[itemId], updated[itemId])
        .then(() => setSyncFailed(false)).catch(() => setSyncFailed(true));
      return updated;
    });
  };

  const handlePrepay = (itemId: string, amount: number, method: string) => {
    setSessions((p) => {
      const updated = { ...p, [itemId]: { ...p[itemId], prepaidAmount: amount, prepaidMethod: method, prepaidAt: Date.now() } };
      if (tenantId) syncSession(tenantId, branchId, itemId, updated[itemId], orders[itemId] ?? [])
        .then(() => setSyncFailed(false)).catch(() => setSyncFailed(true));
      return updated;
    });
    notify((isRTL ? "تم الدفع المقدم" : "Advance payment recorded") + " ✓");
  };

  const endSession = async (itemId: string, payMethod: string, debtAmt: number, discount: number, extra?: { payMethods?: Array<{method: string; amount: number}>; splitCount?: number }): Promise<string> => {
    const sess = sessions[itemId]; if (!sess) return "";
    const tot = calcTotal(itemId), info = getInfo(itemId), finalT = Math.max(0, tot.total - (discount || 0));
    // Generate invoice number at session-end time (not print time)
    const invoiceNo = await getInvoiceNo();
    // Determine primary pay method: largest amount if split, else passed method
    const primaryMethod = extra?.payMethods?.length
      ? extra.payMethods.reduce((a, b) => (b.amount > a.amount ? b : a)).method
      : payMethod;
    const record: HistoryRecord = {
      id: uid(), itemId, itemName: info?.name || "", zoneName: info?.zone?.name || "",
      customerName: sess.customerName, phone: sess.phone, startTime: sess.startTime, endTime: Date.now(),
      duration: tot.elapsed, timePrice: tot.timePrice, orders: orders[itemId] || [],
      ordersTotal: tot.ordersTotal, total: finalT, payMethod: primaryMethod, debtAmount: debtAmt || 0,
      discount: discount || 0, graceMins: sess.graceMins || 0, playerCount: sess.playerCount || 1,
      cashier: user?.name || "", sessionType: sess.sessionType || "ps",
      switchedFrom: sess.switchedFrom?.itemName,
      invoiceNo, status: "paid",
      branchId: appCtx?.branch?.id, branchName: appCtx?.branch?.name,
      ...(extra?.payMethods?.length ? { payMethods: extra.payMethods } : {}),
      ...(extra?.splitCount && extra.splitCount > 1 ? { splitCount: extra.splitCount, splitAmount: parseFloat((finalT / extra.splitCount).toFixed(2)) } : {}),
    };
    setHistory((p) => [record, ...p]);
    // Supabase: add to history + remove session
    if (tenantId) {
      addHistoryRecord(tenantId, branchId, record).catch(() => {});
      deleteSession(tenantId, itemId).catch(() => {});
    }
    let newDebtId: string | null = null;
    if ((debtAmt || 0) > 0) {
      newDebtId = uid();
      const newDebt = { id: newDebtId, name: sess.customerName, phone: sess.phone || "", amount: debtAmt, paidAmount: 0, payments: [], note: `${info?.name}`, date: Date.now(), paid: false };
      setDebts((p) => [...p, newDebt]);
    }
    // ── Loyalty: update or create customer record + auto-link debts ──
    const guestNames = ["زائر", "Guest"];
    if (sess.customerName && !guestNames.includes(sess.customerName)) {
      const ratio = settings.loyaltyPointsRatio || 50;
      const earnedPoints = Math.floor(finalT / ratio);
      setCustomers((prev) => {
        const idx = prev.findIndex((c) => c.name.toLowerCase() === sess.customerName.toLowerCase());
        if (idx >= 0) {
          const updated = [...prev];
          const existingDebtIds = updated[idx].linkedDebtIds || [];
          updated[idx] = {
            ...updated[idx],
            totalVisits: updated[idx].totalVisits + 1,
            totalSpent: updated[idx].totalSpent + finalT,
            points: updated[idx].points + earnedPoints,
            lastVisit: Date.now(),
            phone: sess.phone || updated[idx].phone,
            linkedDebtIds: newDebtId ? [...existingDebtIds, newDebtId] : existingDebtIds,
          };
          return updated;
        }
        // New customer — check for referral and award welcome points + referrer bonus
        const referralWelcome = settings.referralWelcomePoints ?? 50;
        const referralBonus = settings.referralBonusPoints ?? 100;
        const newCustomer = {
          id: uid(), name: sess.customerName, phone: sess.phone || "",
          totalVisits: 1, totalSpent: finalT, points: earnedPoints + referralWelcome,
          joinDate: Date.now(), lastVisit: Date.now(),
          linkedDebtIds: newDebtId ? [newDebtId] : [],
        };
        // Award referral bonus to existing customer who referred this one (if any)
        const withBonus = prev.map((c) => {
          // find referrer linked to this new customer via referredBy (already set before session)
          if (c.id && prev.some((x) => x.referredBy === c.id && x.name.toLowerCase() === sess.customerName.toLowerCase())) {
            return { ...c, points: c.points + referralBonus, referralCount: (c.referralCount ?? 0) + 1 };
          }
          return c;
        });
        return [...withBonus, newCustomer];
      });
    }
    // ── Boxing token deduction — deduct tokenCount (playerCount) tokens ──
    if (info?.zone?.pricingMode === "token") {
      const tokenCount = sess.playerCount ?? 1;
      const cur = boxingTokens ?? DEFAULT_BOXING_TOKENS;
      const newBalance = Math.max(0, cur.balance - tokenCount);
      const tokenEntry: BoxingTokenEntry = {
        id: uid(), date: Date.now(), type: "deduct", amount: -tokenCount,
        by: user?.name || user?.role || "",
        note: isRTL ? `إنهاء جلسة: ${info.name} (${tokenCount} عملة)` : `Session end: ${info.name} (${tokenCount} token${tokenCount > 1 ? "s" : ""})`,
        balanceAfter: newBalance,
      };
      const updatedTokens: BoxingTokenData = {
        balance: newBalance,
        log: [tokenEntry, ...cur.log].slice(0, 100),
      };
      setBoxingTokens(updatedTokens);
      if (tenantId) syncBoxingTokens(tenantId, updatedTokens).catch(() => {});
    }
    setSessions((p) => { const n = { ...p }; delete n[itemId]; return n; });
    setOrders((p) => { const n = { ...p }; delete n[itemId]; return n; });
    warnedItemsRef.current.delete(itemId);
    setAlarmItemIds((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
    notify(t.sessionEnded + " ✓"); setView("main"); setSelItem(null);
    return record.id;
  };

  // ── Hold session ──────────────────────────────────────────────────────────────
  const holdSession = async (itemId: string, discount: number, keepOccupied: boolean) => {
    const sess = sessions[itemId]; if (!sess) return;
    const tot = calcTotal(itemId), info = getInfo(itemId);
    const finalT = Math.max(0, tot.total - (discount || 0));
    const invoiceNo = await getInvoiceNo();
    const record: HistoryRecord = {
      id: uid(), itemId, itemName: info?.name || "", zoneName: info?.zone?.name || "",
      customerName: sess.customerName, startTime: sess.startTime, endTime: Date.now(),
      duration: tot.elapsed, timePrice: tot.timePrice, orders: orders[itemId] || [],
      ordersTotal: tot.ordersTotal, total: finalT, payMethod: "held",
      debtAmount: 0, discount: discount || 0, graceMins: sess.graceMins || 0,
      playerCount: sess.playerCount || 1, cashier: user?.name || "",
      sessionType: sess.sessionType || "ps", invoiceNo,
      status: keepOccupied ? "held-occupied" : "held-free",
      branchId: appCtx?.branch?.id, branchName: appCtx?.branch?.name,
    };
    setHistory((p) => [record, ...p]);
    if (tenantId) addHistoryRecord(tenantId, branchId, record).catch(() => {});

    if (!keepOccupied) {
      // Free the room
      if (tenantId) deleteSession(tenantId, itemId).catch(() => {});
      setSessions((p) => { const n = { ...p }; delete n[itemId]; return n; });
      setOrders((p) => { const n = { ...p }; delete n[itemId]; return n; });
    }
    notify(isRTL ? "تم تعليق الجلسة ⏸" : "Session held ⏸");
    setView("main"); setSelItem(null);
  };

  // ── Edit / Delete history record (manager only, guarded in HistoryView UI) ──
  const editHistoryRecord = (updated: HistoryRecord) => {
    setHistory((p) => p.map((r) => r.id === updated.id ? updated : r));
    if (tenantId) updateHistoryRecordDB(tenantId, updated).catch(() => {});
  };

  const deleteHistoryRecordLocal = (recordId: string) => {
    setHistory((p) => p.filter((r) => r.id !== recordId));
    if (tenantId) deleteHistoryRecordDB(tenantId, recordId).catch(() => {});
  };

  const handleCorrection = (recordId: string, correctedTotal: number, refundMethod: "cash" | "transfer", note?: string) => {
    setHistory((prev) => prev.map((r) => {
      if (r.id !== recordId) return r;
      const updated: HistoryRecord = {
        ...r,
        correction: {
          originalTotal: r.total,
          correctedTotal,
          refundAmount: r.total - correctedTotal,
          refundMethod,
          refundBy: user?.name || "",
          refundDate: Date.now(),
          note,
        },
      };
      if (tenantId) updateHistoryRecordDB(tenantId, updated).catch(() => {});
      return updated;
    }));
    notify(t.refundRecorded + " ✓");
  };

  // Role logout (back to role selection, stay authenticated with Supabase)
  const handleLogout = () => {
    setUser(null);
    try { localStorage.removeItem("als-user"); } catch {}
    setView("main");
  };

  // Full sign out (from Supabase too)
  const handleSignOut = async () => {
    setUser(null);
    try { localStorage.removeItem("als-user"); } catch {}
    setView("main");
    await signOut();
  };

  const addBoxingTokens = (amount: number, note?: string) => {
    setBoxingTokens((prev) => {
      const cur = prev ?? DEFAULT_BOXING_TOKENS;
      const newBalance = Math.max(0, cur.balance + amount);
      const entry: BoxingTokenEntry = {
        id: uid(), date: Date.now(),
        type: amount > 0 ? "add" : "deduct",
        amount, by: user?.name || user?.role || "",
        note, balanceAfter: newBalance,
      };
      return { balance: newBalance, log: [entry, ...cur.log].slice(0, 100) };
    });
  };

  const openShift = (cashFloat: number) => {
    const shift: Shift = { id: uid(), openedAt: Date.now(), openedBy: user?.name || "", cashFloat };
    setCurrentShift(shift);
    if (tenantId) syncShift(tenantId, shift, shiftHistory).catch(() => {});
    notify(t.shiftOpened + " ✓");
  };

  const closeShift = (actualCashInDrawer?: number) => {
    if (!currentShift) return;
    const closeTime = Date.now();
    const recs = history.filter((h) => h.endTime >= currentShift.openedAt && h.endTime <= closeTime);
    const paidRecs = recs.filter((h) => (h.status ?? "paid") === "paid");
    const totalRevenue = paidRecs.reduce((s, h) => s + h.total, 0);
    const cashRevenue = paidRecs.filter((h) => h.payMethod === "cash").reduce((s, h) => s + h.total, 0);
    const cardRevenue = paidRecs.filter((h) => h.payMethod === "card").reduce((s, h) => s + h.total, 0);
    const transferRevenue = paidRecs.filter((h) => h.payMethod === "transfer").reduce((s, h) => s + h.total, 0);
    const creditRevenue = paidRecs.filter((h) => h.payMethod === "credit").reduce((s, h) => s + h.total, 0);
    const debtTotal = paidRecs.reduce((s, h) => s + (h.debtAmount || 0), 0);
    const discountTotal = paidRecs.reduce((s, h) => s + (h.discount || 0), 0);
    const ordersRevenue = paidRecs.reduce((s, h) => s + (h.ordersTotal || 0), 0);
    const timeRevenue = paidRecs.reduce((s, h) => s + (h.timePrice || 0), 0);
    const heldRecs = recs.filter((h) => h.status === "held-occupied" || h.status === "held-free");
    const heldCount = heldRecs.length;
    const heldTotal = heldRecs.reduce((s, h) => s + h.total, 0);
    // Zone breakdown
    const byZone: Record<string, { count: number; rev: number }> = {};
    for (const h of paidRecs) {
      if (!byZone[h.zoneName]) byZone[h.zoneName] = { count: 0, rev: 0 };
      byZone[h.zoneName].count++;
      byZone[h.zoneName].rev += h.total;
    }
    // Item sales aggregate
    const itemMap: Record<string, { name: string; icon: string; qty: number; rev: number }> = {};
    for (const h of paidRecs) {
      for (const o of (h.orders || [])) {
        if (!itemMap[o.name]) itemMap[o.name] = { name: o.name, icon: o.icon || "", qty: 0, rev: 0 };
        itemMap[o.name].qty++;
        itemMap[o.name].rev += o.price || 0;
      }
    }
    const itemSales = Object.values(itemMap).sort((a, b) => b.qty - a.qty);
    const expectedCashInDrawer = currentShift.cashFloat + cashRevenue;
    const totalRefunds = paidRecs.reduce((s, h) => s + (h.correction?.refundAmount || 0), 0);
    // Cashier breakdown
    const byCashier: Record<string, { count: number; rev: number }> = {};
    for (const h of paidRecs) {
      const c = h.cashier || (isRTL ? "غير محدد" : "Unknown");
      if (!byCashier[c]) byCashier[c] = { count: 0, rev: 0 };
      byCashier[c].count++;
      byCashier[c].rev += h.total;
    }
    // Mada (card) fees: 0.008 SAR per transaction, capped at 160 SAR/day
    const madaRecs = paidRecs.filter((h) => h.payMethod === "card" || (h.payMethods?.some((m) => m.method === "card")));
    const madaCount = madaRecs.length;
    const madaFees = Math.min(madaCount * 0.008, 160);
    const madaRevenue = cardRevenue;
    // Credit card fees: 2.5%
    const creditFees = creditRevenue * 0.025;

    const record: ShiftRecord = {
      ...currentShift,
      closedAt: closeTime,
      closedBy: user?.name || "",
      summary: {
        sessionCount: paidRecs.length,
        totalRevenue,
        cashRevenue,
        cardRevenue,
        transferRevenue,
        creditRevenue: creditRevenue > 0 ? creditRevenue : undefined,
        debtTotal,
        discountTotal,
        netRevenue: totalRevenue - discountTotal,
        ordersRevenue,
        timeRevenue,
        heldCount,
        heldTotal,
        byZone,
        byCashier: Object.keys(byCashier).length > 0 ? byCashier : undefined,
        itemSales,
        expectedCashInDrawer,
        totalRefunds: totalRefunds > 0 ? totalRefunds : undefined,
        netAfterRefunds: totalRefunds > 0 ? totalRevenue - discountTotal - totalRefunds : undefined,
        madaRevenue: madaRevenue > 0 ? madaRevenue : undefined,
        madaCount: madaCount > 0 ? madaCount : undefined,
        madaFees: madaFees > 0 ? madaFees : undefined,
        creditFees: creditFees > 0 ? creditFees : undefined,
        actualCashInDrawer: actualCashInDrawer != null ? actualCashInDrawer : undefined,
        cashDiscrepancy: actualCashInDrawer != null ? actualCashInDrawer - expectedCashInDrawer : undefined,
      },
    };
    const newHistory = [record, ...shiftHistory.slice(0, 29)];
    setShiftHistory(newHistory);
    setCurrentShift(null);
    setLastClosedShift(record);
    if (tenantId) syncShift(tenantId, null, newHistory).catch(() => {});
    notify(t.shiftClosedMsg + " ✓");
  };

  const activeCount = Object.keys(sessions).length;
  const totalPeople = Object.values(sessions).reduce((s, sess) => s + (sess.playerCount || 1), 0);
  const todayRev = history.filter((h) => new Date(h.endTime).toDateString() === new Date().toDateString()).reduce((s, h) => s + h.total, 0);

  // ── Loading: Supabase session check OR tenant context loading ──
  if (!supabaseReady || ctxLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <div className="text-4xl mb-4 font-black" style={{ color: "var(--accent)" }}>AL<span style={{ color: "var(--text)" }}>SAMLAH</span></div>
          <div className="text-sm animate-pulse" style={{ color: "var(--text2)" }}>جاري التحميل...</div>
        </div>
      </div>
    );
  }

  // ── Not authenticated with Supabase ──
  if (!isAuthenticated) return <AuthScreen />;

  // ── Authenticated but no tenant setup yet ──
  if (!appCtx) return <AuthScreen needsSetup />;

  // ── Have tenant but no role/PIN selected ──
  if (!user) return (
    <RoleSelectScreen
      pins={pins}
      roleNames={roleNames}
      onLogin={(u) => { setUser(u); saveLS("als-user", u); }}
      settings={settings}
    />
  );

  const navItems = [
    { id: "main", icon: "🏠", label: t.home, show: true },
    { id: "shift", icon: "🕐", label: t.shift, show: true },
    { id: "boxing-tokens", icon: "🥊", label: t.boxingTokens, show: true },
    { id: "qr", icon: "📱", label: t.qr, show: true },
    { id: "history", icon: "📋", label: t.history, show: true },
    { id: "debts", icon: "💰", label: t.debts, show: true },
    { id: "customers", icon: "👥", label: t.customers, show: true },
    { id: "special-guests", icon: "👁", label: t.specialGuests, show: true },
    { id: "tournaments", icon: "🏆", label: t.tournaments, show: true },
    { id: "registers", icon: "📋", label: t.registers, show: true },
    { id: "dashboard", icon: "📊", label: t.dashboard, show: isManager },
    { id: "bookings", icon: "📅", label: t.bookings, show: true },
    { id: "memberships", icon: "🎫", label: t.memberships, show: true },
    { id: "promotions", icon: "⏰", label: t.promotions, show: isManager },
    { id: "maintenance", icon: "🔧", label: t.maintenance, show: isManager },
    { id: "stats", icon: "📈", label: t.stats, show: true },
    { id: "admin", icon: "⚙️", label: t.admin, show: isManager },
  ].filter((n) => n.show);

  return (
    <div className="app-shell" dir={isRTL ? "rtl" : "ltr"}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] anim-fade">
          <div className="badge px-5 py-2.5 text-sm" style={{ background: "var(--green)", color: "#fff", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}>
            {toast}
          </div>
        </div>
      )}

      {/* QR order toast (visible on all views) */}
      {qrToast && (
        <div className="fixed z-[998] anim-fade-up"
          style={{ bottom: 80, [isRTL ? "right" : "left"]: 16, cursor: "pointer" }}
          onClick={() => { setView("qr"); setPendingQrCount(0); setQrToast(null); }}>
          <div className="card px-4 py-3 flex items-center gap-3"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)", background: "color-mix(in srgb, var(--accent) 12%, var(--surface))", minWidth: 220, boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}>
            <span className="text-2xl">{qrToast.item_icon || "📱"}</span>
            <div>
              <div className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                {isRTL ? "طلب جديد" : "New Order"}
              </div>
              <div className="text-xs" style={{ color: "var(--text)" }}>
                📍 {qrToast.room_name} — {qrToast.item_name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ALARM BANNER — sessions with < 5 min remaining ═══ */}
      {alarmItemIds.size > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[997] anim-fade" style={{ maxWidth: 500, width: "90%" }}>
          <div className="card px-4 py-3" style={{
            borderColor: "color-mix(in srgb, var(--red) 50%, transparent)",
            background: "color-mix(in srgb, var(--red) 12%, var(--surface))",
            boxShadow: "0 8px 30px rgba(239,68,68,0.2)",
          }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: "var(--red)" }}>
                🔔 {isRTL ? "تنبيه — وقت الجلسة يوشك على الانتهاء" : "Alert — Session time ending soon"}
              </span>
              <button onClick={() => setAlarmItemIds(new Set())}
                className="btn text-xs px-3 py-1"
                style={{ background: "color-mix(in srgb, var(--red) 15%, transparent)", color: "var(--red)", borderColor: "color-mix(in srgb, var(--red) 25%, transparent)" }}>
                🔕 {isRTL ? "إيقاف الكل" : "Stop All"}
              </button>
            </div>
            {Array.from(alarmItemIds).map((itemId) => {
              const sess = sessions[itemId];
              const info = getInfo(itemId);
              if (!sess || !info) return null;
              const remaining = (sess.durationMins + (sess.graceMins || 0)) * 60000 - (now - sess.startTime);
              const minsLeft = Math.max(0, Math.ceil(remaining / 60000));
              return (
                <div key={itemId} className="flex items-center justify-between py-1.5"
                  style={{ borderTop: "1px solid color-mix(in srgb, var(--red) 10%, transparent)" }}>
                  <div>
                    <span className="text-xs font-bold" style={{ color: "var(--text)" }}>
                      {info.name}
                    </span>
                    <span className="text-xs mx-2" style={{ color: "var(--text2)" }}>{sess.customerName}</span>
                    <span className="text-xs font-bold" style={{ color: "var(--red)" }}>
                      ⏱ {isRTL ? `باقي ${minsLeft} د` : `${minsLeft}m left`}
                    </span>
                  </div>
                  <button onClick={() => setAlarmItemIds((prev) => { const n = new Set(prev); n.delete(itemId); return n; })}
                    className="text-[10px] px-2 py-0.5 rounded"
                    style={{ background: "color-mix(in srgb, var(--text2) 10%, transparent)", color: "var(--text2)", border: "none", cursor: "pointer" }}>
                    {isRTL ? "إيقاف" : "Dismiss"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ BOXING TOKEN LOW BALANCE BANNER ═══ */}
      {boxingTokens !== null && boxingTokens.balance <= (settings.alertThreshold ?? 10) && (
        <div className="fixed z-[996] anim-fade" style={{ top: alarmItemIds.size > 0 ? 130 : 16, left: "50%", transform: "translateX(-50%)", maxWidth: 500, width: "90%" }}>
          <div className="card px-4 py-3 flex items-center justify-between gap-3"
            style={{
              borderColor: "color-mix(in srgb, var(--yellow) 50%, transparent)",
              background: "color-mix(in srgb, var(--yellow) 10%, var(--surface))",
              boxShadow: "0 8px 30px rgba(251,191,36,0.15)",
            }}>
            <div>
              <div className="text-xs font-bold" style={{ color: "var(--yellow)" }}>
                🥊 {t.lowTokenAlert}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
                {boxingTokens.balance} {t.tokensRemaining}
              </div>
            </div>
            <button
              onClick={() => setView("boxing-tokens")}
              className="btn px-3 py-1.5 text-xs font-semibold shrink-0"
              style={{ color: "var(--yellow)", borderColor: "color-mix(in srgb, var(--yellow) 30%, transparent)", background: "color-mix(in srgb, var(--yellow) 10%, transparent)" }}
            >
              {t.addTokens}
            </button>
          </div>
        </div>
      )}

      {/* ═══ LOW STOCK BANNER ═══ */}
      {(() => {
        const lowStockItems = menu.filter((m) => m.trackStock && (m.stock ?? 0) <= (m.lowStockThreshold ?? 5));
        if (lowStockItems.length === 0) return null;
        return (
          <div className="fixed z-[995] anim-fade" style={{ bottom: 72, left: isRTL ? 16 : "auto", right: isRTL ? "auto" : 16 }}>
            <button onClick={() => setView("admin")} className="card px-3 py-2 flex items-center gap-2"
              style={{ borderColor: "color-mix(in srgb, var(--red) 40%, transparent)", background: "color-mix(in srgb, var(--red) 8%, var(--surface))", cursor: "pointer" }}>
              <span>📦</span>
              <span className="text-xs font-semibold" style={{ color: "var(--red)" }}>
                {lowStockItems.length} {t.itemsNeedReorder}
              </span>
            </button>
          </div>
        );
      })()}

      {/* ═══ DESKTOP SIDEBAR NAV ═══ */}
      <nav className="app-nav">
        <div className="text-center mb-8">
          {logo
            ? <img src={logo} alt="Logo" className="h-10 mx-auto mb-1 object-contain" />
            : <h1 className="text-xl font-bold" style={{ color: "var(--accent)" }}>AL<span style={{ color: "var(--text)" }}>SAMLAH</span></h1>
          }
          <p className="text-xs mt-1" style={{ color: "var(--text2)" }}>{t.appSub}</p>
        </div>
        <div className="flex flex-col gap-1 flex-1">
          {navItems.map((n) => (
            <button key={n.id} onClick={() => { setView(n.id); setSelItem(null); if (n.id === "qr") setPendingQrCount(0); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{ background: view === n.id ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent", color: view === n.id ? "var(--accent)" : "var(--text2)" }}>
              <span className="text-lg relative">
                {n.icon}
                {n.id === "qr" && pendingQrCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center anim-pulse"
                    style={{ background: "var(--red)", color: "#fff", fontSize: 8 }}>
                    {pendingQrCount > 9 ? "9+" : pendingQrCount}
                  </span>
                )}
              </span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}>
              {user.role === "manager" ? "👑" : "💰"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{user.name}</div>
              {appCtx?.supabaseUser?.email && (
                <div className="text-[10px] truncate" style={{ color: "var(--text2)" }}>{appCtx.supabaseUser.email}</div>
              )}
            </div>
            <button onClick={handleLogout} className="text-xs px-2 py-1 rounded-lg" style={{ color: "var(--text2)" }} title={isRTL ? "تغيير الدور" : "Change role"}>⇄</button>
          </div>
          {/* Sign out from Supabase completely */}
          <button onClick={handleSignOut} className="w-full text-xs px-3 py-2 text-start flex items-center gap-2 rounded-lg mt-1 transition-all hover:opacity-70"
            style={{ color: "var(--red)", opacity: 0.6 }}>
            <span>⎋</span>
            <span>{isRTL ? "تسجيل خروج كامل" : "Sign out"}</span>
          </button>
          {/* Sync status indicator — warns cashier if Supabase write failed */}
          {syncFailed && (
            <div className="mt-2 px-3 py-2 rounded-lg text-[10px] flex items-center gap-1.5 anim-fade"
              style={{ background: "color-mix(in srgb, var(--red) 12%, transparent)", color: "var(--red)", border: "1px solid color-mix(in srgb, var(--red) 25%, transparent)" }}>
              <span className="anim-pulse inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--red)" }} />
              <span>{isRTL ? "⚠️ فشل الحفظ — لا تغلق الصفحة" : "⚠️ Save failed — don't close"}</span>
            </div>
          )}
        </div>
      </nav>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="app-main">

        {/* ── Inspector Alert Banner (sticky, all views) ── */}
        {specialGuests.some((g) => g.leftAt === null && isInspectorType(g.type)) && (
          <div className="sticky top-0 z-[300] px-4 py-2.5 flex items-center justify-between gap-3 anim-fade"
            style={{ background: "var(--red)", color: "#fff" }}>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="anim-pulse inline-block w-2 h-2 rounded-full bg-white" />
              ⚠️ {t.inspectorAlert}
              <span className="text-xs font-normal opacity-80">
                {specialGuests.filter((g) => g.leftAt === null && isInspectorType(g.type)).map((g) => (
                  <span key={g.id} className="me-2">{GUEST_TYPE_CONFIG[g.type].icon} {g.name}</span>
                ))}
              </span>
            </div>
            <button onClick={() => setView("special-guests")}
              className="text-xs font-bold underline opacity-80 hover:opacity-100 flex-shrink-0">
              {isRTL ? "عرض" : "View"}
            </button>
          </div>
        )}

        {/* ═══ MAIN VIEW ═══ */}
        {view === "main" && (
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex-1">
                {/* Center title — styled text, no image */}
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h1 dir="rtl" className="text-2xl md:text-4xl font-black tracking-tight leading-none"
                    style={{
                      background: `linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, var(--green)) 100%)`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      filter: "drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 40%, transparent))",
                    }}>
                    {appCtx?.tenant?.name_ar || "مركز الصملة للترفيه"}
                  </h1>
                  <span className="text-xs md:text-sm font-bold tracking-[0.25em] uppercase"
                    style={{ color: "var(--text2)", letterSpacing: "0.2em" }}>
                    {appCtx?.tenant?.name_en || "ALSAMLAH"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs" style={{ color: "var(--text2)" }}>{user.name}</span>
                  <button onClick={handleLogout} className="text-xs md:hidden" style={{ color: "var(--red)", opacity: 0.6 }}>{t.logout}</button>
                </div>
              </div>
              {/* Stats Cards */}
              <div className="flex gap-3 flex-wrap">
                {/* Special guests indicator */}
                {specialGuests.filter((g) => g.leftAt === null).length > 0 && (
                  <button onClick={() => setView("special-guests")}
                    className="card px-3 py-2 text-center min-w-[80px] cursor-pointer transition-all hover:opacity-80 anim-fade"
                    style={specialGuests.some((g) => g.leftAt === null && isInspectorType(g.type)) ? {
                      borderColor: "color-mix(in srgb, var(--red) 40%, transparent)",
                      background: "color-mix(in srgb, var(--red) 8%, var(--surface))",
                    } : {
                      borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                      background: "color-mix(in srgb, var(--accent) 5%, var(--surface))",
                    }}>
                    <div className="text-lg">👁</div>
                    <div className="text-lg font-bold mt-0.5"
                      style={{ color: specialGuests.some((g) => g.leftAt === null && isInspectorType(g.type)) ? "var(--red)" : "var(--accent)" }}>
                      {specialGuests.filter((g) => g.leftAt === null).length}
                    </div>
                    <div className="text-[10px] font-medium" style={{ color: "var(--text2)" }}>
                      {isRTL ? "زوار خاصون" : "Special"}
                    </div>
                  </button>
                )}
                {/* Shift status badge */}
                <button onClick={() => setView("shift")}
                  className="card px-3 py-2 text-center min-w-[80px] cursor-pointer transition-all hover:opacity-80"
                  style={currentShift ? {
                    borderColor: "color-mix(in srgb, var(--green) 30%, transparent)",
                    background: "color-mix(in srgb, var(--green) 6%, var(--surface))",
                  } : { opacity: 0.5 }}>
                  <div className="text-lg">{currentShift ? "🟢" : "⏸"}</div>
                  <div className="text-[10px] font-semibold mt-0.5" style={{ color: currentShift ? "var(--green)" : "var(--text2)" }}>
                    {currentShift ? (isRTL ? "مناوبة" : "Shift") : (isRTL ? "لا مناوبة" : "No shift")}
                  </div>
                </button>
                {[
                  { label: t.active, value: activeCount, color: "var(--accent)", icon: "⚡" },
                  { label: t.person, value: totalPeople, color: "var(--blue)", icon: "👤" },
                  { label: t.today, value: <>{fmtMoney(todayRev)} <SarSymbol /></>, color: "var(--green)", icon: "💰" },
                ].map((s, i) => (
                  <div key={i} className="card px-4 py-3 text-center min-w-[90px]">
                    <div className="text-lg">{s.icon}</div>
                    <div className="text-lg md:text-xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] font-medium" style={{ color: "var(--text2)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ Manager KPI Strip ═══ */}
            {isManager && (() => {
              const totalItems = floors.filter((f) => f.id !== COUNTER_FLOOR_ID).reduce((s, f) => s + f.zones.reduce((zs, z) => zs + z.items.length, 0), 0);
              const occupancyPct = totalItems > 0 ? Math.round((activeCount / totalItems) * 100) : 0;
              const yesterdayRev = history.filter((h) => {
                const d = new Date(h.endTime);
                const y = new Date(); y.setDate(y.getDate() - 1);
                return d.toDateString() === y.toDateString();
              }).reduce((s, h) => s + h.total, 0);
              const revChange = yesterdayRev > 0 ? Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 100) : 0;
              const todayHist = history.filter((h) => new Date(h.endTime).toDateString() === new Date().toDateString());
              const avgDur = todayHist.length > 0 ? Math.round(todayHist.reduce((s, h) => s + h.duration, 0) / todayHist.length / 60000) : 0;
              const hourCounts: Record<number, number> = {};
              todayHist.forEach((h) => { const hr = new Date(h.startTime).getHours(); hourCounts[hr] = (hourCounts[hr] || 0) + 1; });
              const peakHr = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
              return (
                <div className="flex gap-3 mb-4 flex-wrap" style={{ direction: isRTL ? "rtl" : "ltr" }}>
                  {[
                    { icon: "📊", label: t.occupancy, value: `${activeCount}/${totalItems}`, sub: `${occupancyPct}%`, color: "var(--accent)", barPct: occupancyPct },
                    { icon: "📈", label: t.vsYesterday, value: revChange >= 0 ? `↑ ${revChange}%` : `↓ ${Math.abs(revChange)}%`, sub: `${isRTL ? "أمس" : "Yesterday"}: ${fmtMoney(yesterdayRev)}`, color: revChange >= 0 ? "var(--green)" : "var(--red)", barPct: 0 },
                    { icon: "🕐", label: t.peakHour, value: peakHr ? `${Number(peakHr[0]) > 12 ? Number(peakHr[0]) - 12 : peakHr[0]} ${Number(peakHr[0]) >= 12 ? (isRTL ? "م" : "PM") : (isRTL ? "ص" : "AM")}` : "—", sub: peakHr ? `${peakHr[1]} ${t.sessions}` : "", color: "var(--yellow)", barPct: 0 },
                    { icon: "⏱", label: t.avgDuration, value: `${avgDur} ${isRTL ? "د" : "m"}`, sub: todayHist.length > 0 ? `${todayHist.length} ${t.sessions}` : "", color: "var(--blue)", barPct: 0 },
                  ].map((k, i) => (
                    <div key={i} className="card px-3 py-2 flex items-center gap-3 flex-1 min-w-[140px]"
                      style={{ background: `color-mix(in srgb, ${k.color} 5%, var(--surface))`, borderColor: `color-mix(in srgb, ${k.color} 12%, transparent)` }}>
                      <div className="text-xl w-9 h-9 flex items-center justify-center rounded-lg"
                        style={{ background: `color-mix(in srgb, ${k.color} 10%, transparent)` }}>{k.icon}</div>
                      <div>
                        <div className="text-[10px]" style={{ color: "var(--text2)" }}>{k.label}</div>
                        <div className="text-sm font-bold" style={{ color: k.color }}>{k.value}</div>
                        {k.sub && <div className="text-[9px]" style={{ color: "var(--text2)" }}>{k.sub}</div>}
                        {k.barPct > 0 && (
                          <div className="w-12 h-1 rounded mt-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded" style={{ width: `${k.barPct}%`, background: k.color }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Floor Tabs + Scan button — tabs hidden when only one non-counter floor exists */}
            <div className="flex gap-2 mb-6 items-center flex-wrap">
              {floors.filter((f) => f.id !== COUNTER_FLOOR_ID).length > 1 && floors.filter((f) => f.id !== COUNTER_FLOOR_ID).map((f) => (
                <button key={f.id} onClick={() => setSelFloor(f.id)}
                  className="btn px-5 py-2.5 text-sm"
                  style={{
                    background: selFloor === f.id ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface)",
                    color: selFloor === f.id ? "var(--accent)" : "var(--text2)",
                    borderColor: selFloor === f.id ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "var(--border)",
                  }}>
                  {f.name}
                </button>
              ))}
              <button onClick={() => setShowScanner(true)} className="btn px-3 py-2.5 text-sm ms-auto"
                style={{ color: "var(--text2)", borderColor: "var(--border)" }} title={t.scanQr}>
                📷
              </button>
            </div>

            {/* Zones */}
            {floors.find((f) => f.id === selFloor)?.zones.map((zone) => {
              const actZ = zone.items.filter((i) => sessions[i.id]).length;
              const zonePeople = zone.items.reduce((s, i) => s + (sessions[i.id]?.playerCount || 0), 0);
              return (
                <div key={zone.id} className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{zone.icon}</span>
                    <span className="text-base font-bold" style={{ color: "var(--text)" }}>{zone.name}</span>
                    {actZ > 0 && <span className="badge" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>{actZ} {t.active}</span>}
                    {zonePeople > 0 && <span className="badge" style={{ background: "color-mix(in srgb, var(--blue) 12%, transparent)", color: "var(--blue)" }}>👤 {zonePeople}</span>}
                    {zone.pricingMode === "manual" && <span className="badge text-[10px]" style={{ background: "color-mix(in srgb, var(--yellow) 15%, transparent)", color: "var(--yellow)" }}>💆 {t.manualPricing}</span>}
                    {zone.pricePerHour > 0 && <span className="mr-auto text-xs flex items-center gap-1" style={{ color: "var(--text2)", opacity: 0.5 }}><SarSymbol size={12} /> {zone.pricePerHour}{t.perHour}</span>}
                    {zone.pricePerHour === 0 && zone.pricingMode !== "manual" && zone.pricingMode !== "walkin" && <span className="mr-auto text-xs" style={{ color: "var(--text2)", opacity: 0.5 }}>{t.free}</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {zone.items.map((item) => {
                      const isAct = !!sessions[item.id], sess = sessions[item.id], tot = isAct ? calcTotal(item.id) : null;
                      const isOT = tot?.isOvertime, isOp = tot?.isOpen;
                      const isManualZone = zone.pricingMode === "manual";
                      const isMaint = item.status === "maintenance";
                      const isDisabled = item.status === "disabled";
                      const isNearEnd = isAct && !isOp && tot && tot.remaining > 0 && tot.remaining <= 10 * 60000;
                      const isAlarm = alarmItemIds.has(item.id);
                      const itemBooking = bookings.find((b) => b.itemId === item.id && b.status === "upcoming");
                      const custMembership = isAct && sess ? memberships.find((m) => m.status === "active" && customers.find((c) => c.id === m.customerId && c.name === sess.customerName)) : null;
                      return (
                        <div key={item.id} onClick={() => {
                          if (isMaint || isDisabled) return;
                          setSelItem(item.id); setView("detail");
                        }}
                          className={`card p-4 cursor-pointer relative overflow-hidden anim-fade ${isOT ? "card-danger" : isNearEnd ? "card-warning" : isAct ? "card-active" : ""}`}
                          style={{
                            minHeight: 120,
                            ...(isMaint ? { borderColor: "color-mix(in srgb, var(--yellow) 25%, transparent)", background: "color-mix(in srgb, var(--yellow) 4%, var(--surface))", opacity: 0.75 } : {}),
                            ...(isDisabled ? { borderColor: "color-mix(in srgb, var(--red) 20%, transparent)", opacity: 0.5 } : {}),
                          }}>
                          {/* Maintenance badge */}
                          {isMaint && (
                            <div className={`absolute top-1.5 ${isRTL ? "right-1.5" : "left-1.5"} text-[8px] font-bold px-1.5 py-0.5 rounded`}
                              style={{ background: "color-mix(in srgb, var(--yellow) 15%, transparent)", color: "var(--yellow)" }}>
                              🔧 {t.inMaintenance}
                            </div>
                          )}
                          {isDisabled && (
                            <div className={`absolute top-1.5 ${isRTL ? "right-1.5" : "left-1.5"} text-[8px] font-bold px-1.5 py-0.5 rounded`}
                              style={{ background: "color-mix(in srgb, var(--red) 15%, transparent)", color: "var(--red)" }}>
                              ⛔ {t.disabled}
                            </div>
                          )}
                          {/* Booking badge */}
                          {itemBooking && !isAct && (
                            <div className={`absolute top-1.5 ${isRTL ? "left-1.5" : "right-1.5"} text-[8px] font-bold px-1.5 py-0.5 rounded`}
                              style={{ background: "color-mix(in srgb, var(--blue) 12%, transparent)", color: "var(--blue)" }}>
                              📅 {new Date(itemBooking.date).toLocaleTimeString(isRTL ? "ar" : "en", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          )}
                          {/* Member badge */}
                          {custMembership && (
                            <div className={`absolute top-1.5 ${isRTL ? "right-1.5" : "left-1.5"} text-[8px] font-bold px-1.5 py-0.5 rounded`}
                              style={{ background: "color-mix(in srgb, var(--yellow) 12%, transparent)", color: "var(--yellow)" }}>
                              ⭐ {t.memberBadge}
                            </div>
                          )}
                          {isAct && <div className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} w-2 h-2 rounded-full anim-pulse`} style={{ background: isOT ? "var(--red)" : isNearEnd ? "var(--red)" : "var(--green)" }} />}
                          <div className="font-bold text-sm" style={{ color: isMaint ? "var(--yellow)" : "var(--text)" }}>{item.name}</div>
                          {item.sub && <div className="text-[10px] mt-0.5" style={{ color: "var(--text2)", opacity: 0.5 }}>{item.sub}</div>}
                          {isAct && sess && tot ? (
                            <div className="mt-3">
                              {sess.sessionType === "match" && (
                                <div className="text-[9px] font-bold mb-1" style={{ color: "var(--green)" }}>⚽ {t.matchSession}</div>
                              )}
                              <div className="text-[10px]" style={{ color: "var(--text2)" }}>{sess.customerName}</div>
                              {isManualZone ? (
                                <div className="mt-1">
                                  <div className="text-[10px]" style={{ color: "var(--yellow)" }}>💆 {t.openSession}</div>
                                  <div className="text-sm font-bold flex items-center gap-1 mt-1" style={{ color: "var(--yellow)" }}>
                                    {sess.manualPrice ? <>{fmtMoney(sess.manualPrice)} <SarSymbol size={10} /></> : <span style={{ opacity: 0.5 }}>{t.enterManualPrice}</span>}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="text-2xl font-bold mt-1 font-mono tabular-nums" style={{ color: sess.sessionType === "match" ? "var(--green)" : sess.sessionType === "walkin" ? "var(--green)" : isOT ? "var(--red)" : isNearEnd ? "var(--red)" : "var(--accent)", letterSpacing: "0.05em" }}>
                                    {isOp ? fmtD(tot.elapsed) : fmtD(Math.max(0, tot.remaining))}
                                  </div>
                                  {isOT && <div className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--red)" }}>⚠ {t.overtime}</div>}
                                  {!isOp && sess.sessionType !== "match" && (
                                    <div className="progress-bar mt-2">
                                      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, tot.progress * 100))}%`, background: isOT ? "var(--red)" : (tot.progress * 100) < 20 ? "var(--yellow)" : "var(--green)" }} />
                                    </div>
                                  )}
                                </>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs font-bold flex items-center gap-1" style={{ color: sess.sessionType === "match" || sess.sessionType === "walkin" ? "var(--green)" : isManualZone ? "var(--yellow)" : "var(--blue)" }}>{fmtMoney(tot.total)} <SarSymbol size={12} /></span>
                                {(sess.playerCount || 0) > 0 && <span className="text-[10px]" style={{ color: "var(--blue)" }}>👤{sess.playerCount}</span>}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 text-xs" style={{ color: "var(--text2)", opacity: 0.3 }}>{t.press}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* ── Counter / Walk-in Orders Section ── */}
            {(() => {
              const counterZone = floors.find((f) => f.id === COUNTER_FLOOR_ID)?.zones[0];
              if (!counterZone) return null;
              const activeCounter = counterZone.items.filter((i) => sessions[i.id]).length;
              return (
                <div className="mt-4 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">☕</span>
                    <span className="text-base font-bold" style={{ color: "var(--text)" }}>{t.walkinZone}</span>
                    {activeCounter > 0 && <span className="badge" style={{ background: "color-mix(in srgb, var(--green) 12%, transparent)", color: "var(--green)" }}>{activeCounter} {t.active}</span>}
                    <span className="mr-auto text-xs" style={{ color: "var(--text2)", opacity: 0.5 }}>{t.noTimeCharge}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {counterZone.items.map((item) => {
                      const isAct = !!sessions[item.id], sess = sessions[item.id], tot = isAct ? calcTotal(item.id) : null;
                      return (
                        <div key={item.id} onClick={() => { setSelItem(item.id); setView("detail"); }}
                          className={`card p-4 cursor-pointer relative overflow-hidden anim-fade ${isAct ? "card-active" : ""}`}
                          style={{ minHeight: 100 }}>
                          {isAct && <div className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} w-2 h-2 rounded-full anim-pulse`} style={{ background: "var(--green)" }} />}
                          <div className="font-bold text-sm" style={{ color: "var(--text)" }}>{item.name}</div>
                          {isAct && sess && tot ? (
                            <div className="mt-2">
                              <div className="text-[10px]" style={{ color: "var(--text2)" }}>{sess.customerName}</div>
                              <div className="text-sm font-bold flex items-center gap-1 mt-1" style={{ color: "var(--green)" }}>{fmtMoney(tot.total)} <SarSymbol size={11} /></div>
                              {(tot.ordersTotal === 0) && <div className="text-[10px] mt-0.5" style={{ color: "var(--text2)", opacity: 0.5 }}>☕ {t.addOrder}</div>}
                            </div>
                          ) : (
                            <div className="mt-3 text-xs" style={{ color: "var(--text2)", opacity: 0.4 }}>+ {t.newWalkinOrder}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ SCANNER MODAL ═══ */}
        {showScanner && (
          <ScannerModal
            settings={settings}
            onClose={() => setShowScanner(false)}
            onScan={(value) => {
              setShowScanner(false);
              // Find item by scanned ID across all floors
              for (const f of floors) for (const z of f.zones) {
                const it = z.items.find((i) => i.id === value);
                if (it) { setSelItem(value); setView("detail"); return; }
              }
              notify(isRTL ? `لم يُعثر على: ${value}` : `Not found: ${value}`);
            }}
          />
        )}

        {/* ═══ DETAIL VIEW ═══ */}
        {view === "detail" && selItem && (() => {
          const info = getInfo(selItem);
          if (!info) return null;
          return <DetailView itemId={selItem} info={info} session={sessions[selItem] || null} orders={orders[selItem] || []} menu={menu} calc={sessions[selItem] ? calcTotal(selItem) : null} onBack={() => { setView("main"); setSelItem(null); }} onStartSession={startSession} onEndSession={endSession} onAddOrder={addOrder} onRemoveOrder={removeOrder} onAddGrace={addGrace} onUpdatePlayerCount={updatePlayerCount} onUpdateManualPrice={updateManualPrice} settings={settings} logo={logo} getInvoiceNo={getInvoiceNo} customers={customers} onHoldSession={holdSession} switchTargets={sessions[selItem] ? getSwitchTargets(selItem) : []} onSwitchActivity={switchActivity} onPrepay={handlePrepay} tenantId={tenantId ?? undefined} />;
        })()}

        {view === "qr" && <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto"><QrOrdersPanel tenantId={tenantId} logo={logo} /></div>}

        {view === "history" && (
          <HistoryView
            history={history}
            settings={settings}
            logo={logo}
            isManager={isManager}
            onEdit={editHistoryRecord}
            onDelete={deleteHistoryRecordLocal}
            onCompleteHeld={(record) => {
              // Re-open payment flow: treat as a fresh endSession on the held record
              // Simply edit the record's status to "paid"
              const updated: HistoryRecord = { ...record, status: "paid" };
              editHistoryRecord(updated);
            }}
            onClearHistory={isManager ? () => {
              setHistory([]);
              if (tenantId) clearHistory(tenantId).catch(() => {});
            } : undefined}
            onCorrection={isManager ? handleCorrection : undefined}
          />
        )}

        {view === "shift" && <ShiftView currentShift={currentShift} shiftHistory={shiftHistory} history={history} onOpen={openShift} onClose={closeShift} user={user} settings={settings} isManager={isManager} now={now} lastClosedShift={lastClosedShift} onDismissEod={() => setLastClosedShift(null)} logo={logo} notify={notify} />}
        {view === "debts" && <DebtsView debts={debts} setDebts={setDebts} role={user.role} notify={notify} settings={settings} logo={logo} />}
        {view === "customers" && <CustomersView customers={customers} setCustomers={setCustomers} settings={settings} notify={notify} />}
        {view === "special-guests" && <SpecialGuestsView guests={specialGuests} setGuests={setSpecialGuests} currentUser={user.name} settings={settings} notify={notify} />}
        {view === "tournaments" && (
          <TournamentsView
            tournaments={tournaments}
            settings={settings}
            role={user.role}
            notify={notify}
            onUpsert={(tour) => {
              setTournaments((prev) => {
                const exists = prev.some((t) => t.id === tour.id);
                return exists ? prev.map((t) => t.id === tour.id ? tour : t) : [...prev, tour];
              });
              if (tenantId) upsertTournament(tenantId, branchId, tour, tournaments).catch(() => {});
            }}
            onCancel={(id) => {
              const tour = tournaments.find((t) => t.id === id);
              if (!tour || !tenantId) return;
              cancelTournament(tenantId, branchId, tour, tournaments, user.name).then((cancelled) => {
                setTournaments((prev) => prev.map((t) => t.id === id ? cancelled : t));
              }).catch(() => {});
            }}
          />
        )}
        {view === "registers" && (
          <RegistersView
            registers={registers}
            settings={settings}
            role={user.role}
            logo={logo}
            notify={notify}
            onUpsert={(reg) => {
              setRegisters((prev) => {
                const exists = prev.some((r) => r.type === reg.type);
                return exists ? prev.map((r) => r.type === reg.type ? reg : r) : [...prev, reg];
              });
              if (tenantId) upsertRegister(tenantId, branchId, reg, registers).catch(() => {});
            }}
          />
        )}
        {view === "dashboard" && <DashboardView history={history} sessions={sessions} floors={floors} settings={settings} logo={logo} tenantId={tenantId ?? undefined} />}
        {view === "bookings" && <BookingsView bookings={bookings} setBookings={setBookings} floors={floors} sessions={sessions} currentUser={user.name} settings={settings} notify={notify} />}
        {view === "memberships" && <MembershipsView membershipPlans={membershipPlans} setMembershipPlans={setMembershipPlans} memberships={memberships} setMemberships={setMemberships} customers={customers} isManager={isManager} settings={settings} notify={notify} />}
        {view === "promotions" && <PromotionsView promotions={promotions} setPromotions={setPromotions} isManager={isManager} settings={settings} notify={notify} />}
        {view === "maintenance" && <MaintenanceView maintenanceLogs={maintenanceLogs} setMaintenanceLogs={setMaintenanceLogs} floors={floors} setFloors={setFloors} settings={settings} notify={notify} currentUser={user.name} />}
        {view === "boxing-tokens" && <BoxingTokensView boxingTokens={boxingTokens} settings={settings} isRTL={isRTL} currentUser={user.name} onAddTokens={addBoxingTokens} />}
        {view === "stats" && <StatsView history={history} debts={debts} sessions={sessions} role={user.role} settings={settings} logo={logo} currentBranchId={appCtx?.branch?.id} currentBranchName={appCtx?.branch?.name} />}
        {view === "admin" && <AdminView floors={floors} setFloors={setFloors} menu={menu} setMenu={setMenu} pins={pins} setPins={setPins} roleNames={roleNames} setRoleNames={setRoleNames} role={user.role} notify={notify} onClearHistory={() => setHistory([])} onClearDebts={() => setDebts([])} settings={settings} setSettings={setSettings} logo={logo} setLogo={setLogo} tenantId={tenantId ?? ""} boxingTokens={boxingTokens} onAddBoxingTokens={addBoxingTokens} />}
      </main>

      {/* ═══ MOBILE BOTTOM NAV ═══ */}
      <div className="mobile-nav fixed bottom-0 left-0 right-0 z-[200] px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]"
        style={{ background: "var(--nav-bg)", backdropFilter: "blur(20px)", borderTop: "1px solid var(--border)" }}>
        <div className="flex gap-1">
          {navItems.map((n) => (
            <button key={n.id} onClick={() => { setView(n.id); setSelItem(null); if (n.id === "qr") setPendingQrCount(0); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all"
              style={{ background: view === n.id ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent", color: view === n.id ? "var(--accent)" : "var(--text2)", opacity: view === n.id ? 1 : 0.4 }}>
              <span className="text-lg relative">
                {n.icon}
                {n.id === "qr" && pendingQrCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ background: "var(--red)", color: "#fff", fontSize: 8 }}>
                    {pendingQrCount > 9 ? "9+" : pendingQrCount}
                  </span>
                )}
              </span>
              <span className="text-[9px] font-semibold">{n.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
