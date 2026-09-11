import type { ApiResult, CalendarEvent, NewsItem, Trade } from "./types";

const BASE_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;
/** ถ้าตั้ง Script Property API_TOKEN ฝั่ง Apps Script ไว้ ต้องตั้งค่านี้ให้ตรงกันตอน build */
const API_TOKEN = (import.meta.env.VITE_API_TOKEN as string | undefined) || "";

export const isConfigured = Boolean(BASE_URL);

const withToken = (url: string) => (API_TOKEN ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(API_TOKEN)}` : url);

/**
 * เรียก Apps Script Web App
 * - ใช้ Content-Type: text/plain เพื่อหลบ CORS preflight (Apps Script ไม่ตอบ OPTIONS)
 * - redirect: "follow" เพราะ Apps Script redirect ไปที่ script.googleusercontent.com
 */
async function callApi(body: Record<string, unknown>): Promise<ApiResult> {
  if (!BASE_URL) throw new Error("ยังไม่ได้ตั้งค่า VITE_APPS_SCRIPT_URL ในไฟล์ .env");

  const res = await fetch(BASE_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(API_TOKEN ? { ...body, token: API_TOKEN } : body),
  });

  if (!res.ok) {
    throw new Error(`API error: HTTP ${res.status}`);
  }
  const data = (await res.json()) as ApiResult;
  if (!data.ok) {
    throw new Error(data.error || "เกิดข้อผิดพลาดจาก API");
  }
  return data;
}

export async function listTrades(sheet = "Trades"): Promise<Trade[]> {
  if (!BASE_URL) throw new Error("ยังไม่ได้ตั้งค่า VITE_APPS_SCRIPT_URL ในไฟล์ .env");
  const res = await fetch(withToken(`${BASE_URL}?action=list&sheet=${encodeURIComponent(sheet)}`), { redirect: "follow" });
  if (!res.ok) throw new Error(`API error: HTTP ${res.status}`);
  const data = (await res.json()) as ApiResult;
  if (!data.ok) throw new Error(data.error || "เกิดข้อผิดพลาดจาก API");
  return data.trades ?? [];
}

export function createTrade(trade: Trade, sheet = "Trades"): Promise<ApiResult> {
  return callApi({ action: "create", trade, sheet });
}

export function updateTrade(trade: Trade, sheet = "Trades"): Promise<ApiResult> {
  return callApi({ action: "update", trade, sheet });
}

export function deleteTrade(id: string, sheet = "Trades"): Promise<ApiResult> {
  return callApi({ action: "delete", id, sheet });
}

export function uploadImage(fileName: string, base64: string): Promise<ApiResult> {
  return callApi({ action: "uploadImage", fileName, base64 });
}

/** ดึงปฏิทินข่าวเศรษฐกิจ ForexFactory (ผ่าน Apps Script proxy) */
export async function fetchCalendar(): Promise<CalendarEvent[]> {
  if (!BASE_URL) throw new Error("ยังไม่ได้ตั้งค่า VITE_APPS_SCRIPT_URL ในไฟล์ .env");
  const res = await fetch(withToken(`${BASE_URL}?action=calendar`), { redirect: "follow" });
  if (!res.ok) throw new Error(`API error: HTTP ${res.status}`);
  const data = (await res.json()) as ApiResult;
  if (!data.ok) throw new Error(data.error || "เกิดข้อผิดพลาดจาก API");
  return (data.events ?? []) as CalendarEvent[];
}

/** ดึงข่าวล่าสุดจาก ForexLive RSS (ผ่าน Apps Script proxy) */
export async function fetchNews(): Promise<NewsItem[]> {
  if (!BASE_URL) throw new Error("ยังไม่ได้ตั้งค่า VITE_APPS_SCRIPT_URL ในไฟล์ .env");
  const res = await fetch(withToken(`${BASE_URL}?action=news`), { redirect: "follow" });
  if (!res.ok) throw new Error(`API error: HTTP ${res.status}`);
  const data = (await res.json()) as ApiResult;
  if (!data.ok) throw new Error(data.error || "เกิดข้อผิดพลาดจาก API");
  return (data.items ?? []) as NewsItem[];
}
