import type { Trade } from "./types";

export interface EquityPoint {
  index: number;
  date: string;
  equity: number;
}

export interface Stats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number; // 0-100
  netPnl: number;
  profitFactor: number | null;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  avgWin: number;
  avgLoss: number;
  equityCurve: EquityPoint[];
  maxDrawdown: number;
}

function num(v: Trade["pnl"]): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export function computeStats(trades: Trade[], startingCapital = 0): Stats {
  const sorted = [...trades].sort((a, b) => {
    const d = String(a.date).localeCompare(String(b.date));
    return d !== 0 ? d : String(a.createdAt).localeCompare(String(b.createdAt));
  });

  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netPnl = 0;
  let bestTrade: Trade | null = null;
  let worstTrade: Trade | null = null;
  const equityCurve: EquityPoint[] = [];
  let equity = startingCapital;
  let peak = startingCapital;
  let maxDrawdown = 0;

  sorted.forEach((t, i) => {
    const pnl = num(t.pnl);
    netPnl += pnl;
    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losses++;
      grossLoss += Math.abs(pnl);
    }
    if (!bestTrade || pnl > num(bestTrade.pnl)) bestTrade = t;
    if (!worstTrade || pnl < num(worstTrade.pnl)) worstTrade = t;

    equity += pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    equityCurve.push({ index: i + 1, date: String(t.date), equity: Math.round(equity * 100) / 100 });
  });

  return {
    totalTrades: sorted.length,
    wins,
    losses,
    winRate: sorted.length ? (wins / sorted.length) * 100 : 0,
    netPnl,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
    bestTrade,
    worstTrade,
    avgWin: wins ? grossProfit / wins : 0,
    avgLoss: losses ? grossLoss / losses : 0,
    equityCurve,
    maxDrawdown,
  };
}

export interface SetupStat {
  setup: string;
  total: number;
  wins: number;
  winRate: number; // 0-100
  netPnl: number;
}

/** สถิติแยกตามกลยุทธ์ (setup) — ใช้ในหน้า Backtest */
export function setupStats(trades: Trade[]): SetupStat[] {
  const groups = new Map<string, { total: number; wins: number; netPnl: number }>();
  for (const t of trades) {
    const key = t.setup.trim() || "ไม่ระบุกลยุทธ์";
    const g = groups.get(key) ?? { total: 0, wins: 0, netPnl: 0 };
    const pnl = num(t.pnl);
    g.total++;
    if (pnl > 0) g.wins++;
    g.netPnl += pnl;
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([setup, g]) => ({
      setup,
      total: g.total,
      wins: g.wins,
      winRate: (g.wins / g.total) * 100,
      netPnl: g.netPnl,
    }))
    .sort((a, b) => b.total - a.total);
}

export function formatMoney(v: number): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
