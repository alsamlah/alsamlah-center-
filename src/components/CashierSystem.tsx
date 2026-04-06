"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DEFAULT_FLOORS, DEFAULT_MENU, DEFAULT_PINS, DEFAULT_ROLE_NAMES, MATCH_PRICE } from "@/lib/defaults";
import { DEFAULT_SETTINGS, FONTS, FONT_SIZES, THEMES, T } from "@/lib/settings";
import type { Floor, MenuItem, Session, OrderItem, HistoryRecord, Debt, UserLogin, UserRole, CalcResult, Shift, ShiftRecord, Customer, SpecialGuest, Tournament, InspectionRegister } from "@/lib/supabase";
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
  const [floors, setFloors] = useState<Floor[]>(DEFAULT_FLOORS);
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

  // ── UI state ──
  const [view, setView] = useState("main");
  const [selItem, setSelItem] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [selFloor, setSelFloor] = useState("f1");
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(false);

  // Track if we've loaded from Supabase for this tenant
  const loadedTenantRef = useRef<string | null>(null);
  // Suppress re-syncing data that arrived from realtime (prevents infinite loop)
  const realtimeSkipRef = useRef({ debts: false, specialGuests: false });

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
  }, []);

  // ── Load from Supabase when tenant is ready (overrides localStorage) ──
  useEffect(() => {
    if (!appCtx?.tenant?.id) return;
    if (loadedTenantRef.current === appCtx.tenant.id) return;
    loadedTenantRef.current = appCtx.tenant.id;
    setDbLoading(true);
    loadTenantData(appCtx.tenant.id, appCtx.branch?.id ?? null).then((data) => {
      setFloors(data.floors);
      setMenu(data.menu);
      setSessions(data.sessions);
      setOrders(data.orders);
      setHistory(data.history);
      setDebts(data.debts);
      setCustomers(data.customers);
      setTournaments(data.tournaments);
      setRegisters(data.registers);
      setPins(data.pins);
      setRoleNames(data.roleNames);
      setSettings(data.settings);
      if (data.logo) setLogo(data.logo);
      setInvoiceCounter(data.invoiceCounter);
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

  // Supabase background syncs (non-blocking)
  useEffect(() => {
    if (!tenantId || dbLoading) return;
    syncFloors(tenantId, branchId, floors).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    syncMenu(tenantId, branchId, menu).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, tenantId]);

  useEffect(() => {
    if (!tenantId || dbLoading) return;
    syncSettings(tenantId, settings, pins, roleNames).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, pins, roleNames, tenantId]);

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
    syncCustomers(tenantId, branchId, customers).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, tenantId]);

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

    return () => {
      sessionsSub.unsubscribe();
      historySub.unsubscribe();
      debtsSub.unsubscribe();
      specialGuestsSub.unsubscribe();
      tournamentsSub.unsubscribe();
      registersSub.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

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
    // ── Match session: flat fixed price, always open (counts up) ──
    if (sess.sessionType === "match") {
      return { remaining: elapsed, elapsed, progress: -1, timePrice: MATCH_PRICE, ordersTotal, total: MATCH_PRICE + ordersTotal, isOvertime: false, isOpen: true, graceMins: 0 };
    }
    // ── PlayStation / hourly session ──
    const info = getInfo(itemId), pph = info?.zone?.pricePerHour || 0, minC = info?.zone?.minCharge || 0;
    const elMins = elapsed / 60000, grace = sess.graceMins || 0, isOpen = sess.durationMins === 0;
    let remaining = 0, progress = 1, isOvertime = false;
    if (!isOpen) { const ta = sess.durationMins + grace; remaining = (ta * 60000) - elapsed; progress = ta > 0 ? Math.max(0, Math.min(1, remaining / (ta * 60000))) : 1; isOvertime = remaining <= 0; }
    else { remaining = elapsed; progress = -1; }
    const billMins = Math.max(elMins - grace, 0), chargeMins = Math.max(billMins, minC);
    const timePrice = pph > 0 ? Math.ceil((chargeMins / 60) * pph) : 0;
    return { remaining, elapsed, progress, timePrice, ordersTotal, total: timePrice + ordersTotal, isOvertime, isOpen, graceMins: grace };
  };

  const startSession = (itemId: string, name: string, dur: number, pc: number, type: "ps" | "match" = "ps") => {
    const newSess: Session = {
      startTime: Date.now(),
      customerName: name || (settings.lang === "ar" ? "زائر" : "Guest"),
      durationMins: type === "match" ? 0 : dur,
      graceMins: 0,
      playerCount: pc || 1,
      sessionType: type,
    };
    setSessions((p) => ({ ...p, [itemId]: newSess }));
    const curOrders = orders[itemId] || [];
    setOrders((p) => ({ ...p, [itemId]: curOrders }));
    // Supabase sync
    if (tenantId) syncSession(tenantId, branchId, itemId, newSess, curOrders).catch(() => {});
    notify(t.sessionStarted + " ✓");
  };

  const updatePlayerCount = (itemId: string, count: number) => {
    setSessions((p) => {
      const updated = { ...p, [itemId]: { ...p[itemId], playerCount: count } };
      if (tenantId) syncSession(tenantId, branchId, itemId, updated[itemId], orders[itemId] || []).catch(() => {});
      return updated;
    });
  };

  const addGrace = (itemId: string, mins: number) => {
    setSessions((p) => {
      const updated = { ...p, [itemId]: { ...p[itemId], graceMins: (p[itemId]?.graceMins || 0) + mins } };
      if (tenantId) syncSession(tenantId, branchId, itemId, updated[itemId], orders[itemId] || []).catch(() => {});
      return updated;
    });
    notify(`+${mins} ${t.freeMin} ✓`);
  };

  const addOrder = (itemId: string, mi: MenuItem) => {
    const newItem = { ...mi, orderId: uid(), time: Date.now() };
    setOrders((p) => {
      const updated = { ...p, [itemId]: [...(p[itemId] || []), newItem] };
      if (tenantId && sessions[itemId]) syncSession(tenantId, branchId, itemId, sessions[itemId], updated[itemId]).catch(() => {});
      return updated;
    });
    notify(`${mi.name} ✓`);
  };

  const removeOrder = (itemId: string, oid: string) => {
    setOrders((p) => {
      const updated = { ...p, [itemId]: (p[itemId] || []).filter((o) => o.orderId !== oid) };
      if (tenantId && sessions[itemId]) syncSession(tenantId, branchId, itemId, sessions[itemId], updated[itemId]).catch(() => {});
      return updated;
    });
  };

  const endSession = async (itemId: string, payMethod: string, debtAmt: number, discount: number): Promise<string> => {
    const sess = sessions[itemId]; if (!sess) return "";
    const tot = calcTotal(itemId), info = getInfo(itemId), finalT = Math.max(0, tot.total - (discount || 0));
    // Generate invoice number at session-end time (not print time)
    const invoiceNo = await getInvoiceNo();
    const record: HistoryRecord = {
      id: uid(), itemId, itemName: info?.name || "", zoneName: info?.zone?.name || "",
      customerName: sess.customerName, startTime: sess.startTime, endTime: Date.now(),
      duration: tot.elapsed, timePrice: tot.timePrice, orders: orders[itemId] || [],
      ordersTotal: tot.ordersTotal, total: finalT, payMethod, debtAmount: debtAmt || 0,
      discount: discount || 0, graceMins: sess.graceMins || 0, playerCount: sess.playerCount || 1,
      cashier: user?.name || "", sessionType: sess.sessionType || "ps",
      invoiceNo, status: "paid",
      branchId: appCtx?.branch?.id, branchName: appCtx?.branch?.name,
    };
    setHistory((p) => [record, ...p]);
    // Supabase: add to history + remove session
    if (tenantId) {
      addHistoryRecord(tenantId, branchId, record).catch(() => {});
      deleteSession(tenantId, itemId).catch(() => {});
    }
    if ((debtAmt || 0) > 0) {
      const newDebt = { id: uid(), name: sess.customerName, phone: "", amount: debtAmt, paidAmount: 0, payments: [], note: `${info?.name}`, date: Date.now(), paid: false };
      setDebts((p) => [...p, newDebt]);
    }
    // ── Loyalty: update or create customer record ──
    const guestNames = ["زائر", "Guest"];
    if (sess.customerName && !guestNames.includes(sess.customerName)) {
      const ratio = settings.loyaltyPointsRatio || 50;
      const earnedPoints = Math.floor(finalT / ratio);
      setCustomers((prev) => {
        const idx = prev.findIndex((c) => c.name.toLowerCase() === sess.customerName.toLowerCase());
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], totalVisits: updated[idx].totalVisits + 1, totalSpent: updated[idx].totalSpent + finalT, points: updated[idx].points + earnedPoints, lastVisit: Date.now() };
          return updated;
        }
        return [...prev, { id: uid(), name: sess.customerName, phone: "", totalVisits: 1, totalSpent: finalT, points: earnedPoints, joinDate: Date.now(), lastVisit: Date.now() }];
      });
    }
    setSessions((p) => { const n = { ...p }; delete n[itemId]; return n; });
    setOrders((p) => { const n = { ...p }; delete n[itemId]; return n; });
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

  const openShift = (cashFloat: number) => {
    const shift: Shift = { id: uid(), openedAt: Date.now(), openedBy: user?.name || "", cashFloat };
    setCurrentShift(shift);
    notify(t.shiftOpened + " ✓");
  };

  const closeShift = () => {
    if (!currentShift) return;
    const closeTime = Date.now();
    const recs = history.filter((h) => h.endTime >= currentShift.openedAt && h.endTime <= closeTime);
    const paidRecs = recs.filter((h) => (h.status ?? "paid") === "paid");
    const totalRevenue = paidRecs.reduce((s, h) => s + h.total, 0);
    const cashRevenue = paidRecs.filter((h) => h.payMethod === "cash").reduce((s, h) => s + h.total, 0);
    const cardRevenue = paidRecs.filter((h) => h.payMethod === "card").reduce((s, h) => s + h.total, 0);
    const transferRevenue = paidRecs.filter((h) => h.payMethod === "transfer").reduce((s, h) => s + h.total, 0);
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
        debtTotal,
        discountTotal,
        netRevenue: totalRevenue - discountTotal,
        ordersRevenue,
        timeRevenue,
        heldCount,
        heldTotal,
        byZone,
        itemSales,
        expectedCashInDrawer,
      },
    };
    setShiftHistory((p) => [record, ...p.slice(0, 29)]);
    setCurrentShift(null);
    setLastClosedShift(record);
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
    { id: "qr", icon: "📱", label: t.qr, show: true },
    { id: "history", icon: "📋", label: t.history, show: true },
    { id: "debts", icon: "💰", label: t.debts, show: true },
    { id: "customers", icon: "👥", label: t.customers, show: true },
    { id: "special-guests", icon: "👁", label: t.specialGuests, show: true },
    { id: "tournaments", icon: "🏆", label: t.tournaments, show: true },
    { id: "registers", icon: "📋", label: t.registers, show: true },
    { id: "stats", icon: "📊", label: t.stats, show: true },
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
            <button key={n.id} onClick={() => { setView(n.id); setSelItem(null); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{ background: view === n.id ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent", color: view === n.id ? "var(--accent)" : "var(--text2)" }}>
              <span className="text-lg">{n.icon}</span>
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

            {/* Floor Tabs + Scan button */}
            <div className="flex gap-2 mb-6 items-center">
              {floors.map((f) => (
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
                    {zone.pricePerHour > 0 && <span className="mr-auto text-xs flex items-center gap-1" style={{ color: "var(--text2)", opacity: 0.5 }}><SarSymbol size={12} /> {zone.pricePerHour}{t.perHour}</span>}
                    {zone.pricePerHour === 0 && <span className="mr-auto text-xs" style={{ color: "var(--text2)", opacity: 0.5 }}>{t.free}</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {zone.items.map((item) => {
                      const isAct = !!sessions[item.id], sess = sessions[item.id], tot = isAct ? calcTotal(item.id) : null;
                      const isOT = tot?.isOvertime, isOp = tot?.isOpen;
                      return (
                        <div key={item.id} onClick={() => { setSelItem(item.id); setView("detail"); }}
                          className={`card p-4 cursor-pointer relative overflow-hidden anim-fade ${isOT ? "card-danger" : isAct ? "card-active" : ""}`}
                          style={{ minHeight: 120 }}>
                          {isAct && <div className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} w-2 h-2 rounded-full anim-pulse`} style={{ background: isOT ? "var(--red)" : "var(--green)" }} />}
                          <div className="font-bold text-sm" style={{ color: "var(--text)" }}>{item.name}</div>
                          {item.sub && <div className="text-[10px] mt-0.5" style={{ color: "var(--text2)", opacity: 0.5 }}>{item.sub}</div>}
                          {isAct && sess && tot ? (
                            <div className="mt-3">
                              {sess.sessionType === "match" && (
                                <div className="text-[9px] font-bold mb-1" style={{ color: "var(--green)" }}>⚽ {t.matchSession}</div>
                              )}
                              <div className="text-[10px]" style={{ color: "var(--text2)" }}>{sess.customerName}</div>
                              <div className="text-2xl font-bold mt-1 font-mono tabular-nums" style={{ color: sess.sessionType === "match" ? "var(--green)" : isOT ? "var(--red)" : "var(--accent)", letterSpacing: "0.05em" }}>
                                {isOp ? fmtD(tot.elapsed) : fmtD(Math.max(0, tot.remaining))}
                              </div>
                              {isOT && <div className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--red)" }}>⚠ {t.overtime}</div>}
                              {!isOp && sess.sessionType !== "match" && (
                                <div className="progress-bar mt-2">
                                  <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, tot.progress * 100))}%`, background: isOT ? "var(--red)" : (tot.progress * 100) < 20 ? "var(--yellow)" : "var(--green)" }} />
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs font-bold flex items-center gap-1" style={{ color: sess.sessionType === "match" ? "var(--green)" : "var(--blue)" }}>{fmtMoney(tot.total)} <SarSymbol size={12} /></span>
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
          return <DetailView itemId={selItem} info={info} session={sessions[selItem] || null} orders={orders[selItem] || []} menu={menu} calc={sessions[selItem] ? calcTotal(selItem) : null} onBack={() => { setView("main"); setSelItem(null); }} onStartSession={startSession} onEndSession={endSession} onAddOrder={addOrder} onRemoveOrder={removeOrder} onAddGrace={addGrace} onUpdatePlayerCount={updatePlayerCount} settings={settings} logo={logo} getInvoiceNo={getInvoiceNo} customers={customers} onHoldSession={holdSession} />;
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
          />
        )}

        {view === "shift" && <ShiftView currentShift={currentShift} shiftHistory={shiftHistory} history={history} onOpen={openShift} onClose={closeShift} user={user} settings={settings} isManager={isManager} now={now} lastClosedShift={lastClosedShift} onDismissEod={() => setLastClosedShift(null)} logo={logo} />}
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
        {view === "stats" && <StatsView history={history} debts={debts} sessions={sessions} role={user.role} settings={settings} logo={logo} currentBranchId={appCtx?.branch?.id} currentBranchName={appCtx?.branch?.name} />}
        {view === "admin" && <AdminView floors={floors} setFloors={setFloors} menu={menu} setMenu={setMenu} pins={pins} setPins={setPins} roleNames={roleNames} setRoleNames={setRoleNames} role={user.role} notify={notify} onClearHistory={() => setHistory([])} onClearDebts={() => setDebts([])} settings={settings} setSettings={setSettings} logo={logo} setLogo={setLogo} tenantId={tenantId ?? ""} />}
      </main>

      {/* ═══ MOBILE BOTTOM NAV ═══ */}
      <div className="mobile-nav fixed bottom-0 left-0 right-0 z-[200] px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]"
        style={{ background: "var(--nav-bg)", backdropFilter: "blur(20px)", borderTop: "1px solid var(--border)" }}>
        <div className="flex gap-1">
          {navItems.map((n) => (
            <button key={n.id} onClick={() => { setView(n.id); setSelItem(null); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all"
              style={{ background: view === n.id ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent", color: view === n.id ? "var(--accent)" : "var(--text2)", opacity: view === n.id ? 1 : 0.4 }}>
              <span className="text-lg">{n.icon}</span>
              <span className="text-[9px] font-semibold">{n.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
