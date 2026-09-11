export type Direction = "LONG" | "SHORT";

export interface Trade {
  id: string;
  date: string; // yyyy-MM-dd
  symbol: string;
  direction: Direction | string;
  entryPrice: number | "";
  exitPrice: number | "";
  lotSize: number | "";
  stopLoss: number | "";
  takeProfit: number | "";
  pnl: number | "";
  setup: string;
  emotion: string;
  notes: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

/** Backtest ใช้ชีต+คอลัมน์ชุดเดียวกับ Trade — setup = กลยุทธ์, imageUrl = รูป position */
export type Backtest = Trade;

export interface ApiResult {
  ok: boolean;
  error?: string;
  trades?: Trade[];
  trade?: Trade;
  imageUrl?: string;
  events?: CalendarEvent[];
  items?: NewsItem[];
}

export const EMOTIONS = [
  "Calm",
  "Confident",
  "Greedy",
  "Fearful",
  "FOMO",
  "Revenge",
  "Impatient",
] as const;

export interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string; // เช่น "Sun, 06 Sep 2026 12:49:21 GMT"
  snippet?: string;
}
