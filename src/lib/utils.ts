export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });

/** Formats number only — use <Price> or <SarSymbol> for the currency icon */
export const fmtMoney = (n: number) => n.toFixed(0);

export const fmtD = (ms: number) => {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });

export const fmtDateShort = (ts: number) =>
  new Date(ts).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });

export const isSameDay = (ts1: number, ts2: number) =>
  new Date(ts1).toDateString() === new Date(ts2).toDateString();

export const isThisWeek = (ts: number) => {
  const now = new Date();
  const d = new Date(ts);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
};

export const isThisMonth = (ts: number) => {
  const now = new Date();
  const d = new Date(ts);
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

/**
 * Returns the "business day" date string "YYYY-MM-DD".
 * Hours 0 – (eodHour-1) belong to the PREVIOUS calendar day.
 * e.g. 2AM on Apr 7 with eodHour=5 → "2026-04-06"
 */
export function getBusinessDay(ts = Date.now(), eodHour = 5): string {
  const d = new Date(ts);
  if (d.getHours() < eodHour) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
