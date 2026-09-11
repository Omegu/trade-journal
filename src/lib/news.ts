/** ข้อมูลปฏิทินข่าวเศรษฐกิจจาก ForexFactory (faireconomy.media feed) */

export type Impact = "High" | "Medium" | "Low" | "Holiday";

export interface CalendarEvent {
  title: string;
  country: string; // รหัสสกุลเงิน เช่น USD, EUR, "All"
  date: string; // ISO 8601 เช่น 2026-09-10T08:30:00-04:00
  impact: Impact | string;
  forecast: string;
  previous: string;
}

export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CHF", "CAD", "NZD", "CNY"] as const;

export const IMPACTS: Impact[] = ["High", "Medium", "Low", "Holiday"];

const IMPACT_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900",
  Medium: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border-orange-200 dark:border-orange-900",
  Low: "bg-muted text-muted-foreground border-border",
  Holiday: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400 border-sky-200 dark:border-sky-900",
};

export function impactStyle(impact: string): string {
  return IMPACT_STYLES[impact] ?? IMPACT_STYLES.Low;
}

/** แปลงเวลาใน feed (มี timezone offset ติดมา) เป็น Date */
export function eventDate(event: CalendarEvent): Date {
  return new Date(event.date);
}

/** แสดงเวลาแบบเวลาไทย เช่น 19:30 */
export function formatTimeTh(event: CalendarEvent): string {
  const d = eventDate(event);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

/** แสดงวันที่แบบเวลาไทย เช่น "พฤ 10 ก.ย." */
export function formatDayTh(event: CalendarEvent): string {
  const d = eventDate(event);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  });
}

/** key สำหรับจัดกลุ่มตามวัน (เวลาไทย) เช่น 2026-09-10 */
export function dayKey(event: CalendarEvent): string {
  const d = eventDate(event);
  if (isNaN(d.getTime())) return "unknown";
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
}

/** จัดกลุ่ม events ตามวัน (เวลาไทย) เรียงตามเวลา */
export function groupByDay(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const groups = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = dayKey(ev);
    const list = groups.get(key) ?? [];
    list.push(ev);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** เวลาข่าวแบบเวลาไทย เช่น 19:49 (รับ input เป็นค่าที่ new Date() อ่านได้) */
export function newsTimeTh(pubDate: string): string {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

/** วันที่ข่าวแบบเวลาไทย เช่น "7 ก.ย." */
export function newsDayTh(pubDate: string): string {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  });
}

/** อายุข่าวแบบสั้น เช่น "5 นาที", "2 ชม.", "3 วัน" (สำหรับข่าวใหม่กว่า 1 วัน) */
export function newsAge(pubDate: string): string | null {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return null;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 0) return null;
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาที`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชม.`;
  return null; // เก่ากว่าวัน ให้แสดงวันที่แทน
}
