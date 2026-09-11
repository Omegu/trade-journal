/**
 * สูตรคำนวณ Position Size
 *
 * สมมติฐาน: บัญชีเป็น USD
 * - Crypto:  units = ยอดเสี่ยง / ระยะราคา (เข้า − SL)
 * - CFD:     lots = ยอดเสี่ยง / (SL pips × pipValue)
 *   โดย pipValue (USD/lot) = pipSize × contractSize ÷ quoteRate
 *   quoteRate ใช้เมื่อคู่เงิน quote ไม่ใช่ USD (เช่น USDJPY = 150 → pip value เป็นเยน ต้องหาร 150)
 *   ค่า contract/pip ขึ้นกับโบรกเกอร์แต่ละเจ้า แก้ได้ในหน้าคำนวณ
 *   อ้างอิงแนวทางเดียวกับ CFD Lot Calculator [MT5 Optimized] (TradingView)
 */

export interface PositionSizeInput {
  balance: number;
  riskPercent: number;
  entry: number;
  stopLoss: number;
}

export interface PositionSizeResult {
  riskAmount: number; // จำนวนเงินที่ยอมเสี่ยง
  distance: number; // ระยะราคาจากราคาเข้าถึง SL
  direction: "LONG" | "SHORT";
}

export function riskAmountOf(balance: number, riskPercent: number): number {
  return (balance * riskPercent) / 100;
}

export function directionOf(entry: number, stopLoss: number): "LONG" | "SHORT" {
  return stopLoss < entry ? "LONG" : "SHORT";
}

export function validate(input: PositionSizeInput): string | null {
  if (input.balance <= 0) return "กรุณากรอกยอดเงินในบัญชี";
  if (input.riskPercent <= 0 || input.riskPercent > 100) return "ความเสี่ยงต้องอยู่ระหว่าง 0–100%";
  if (input.entry <= 0) return "กรุณากรอกราคาเข้า";
  if (input.stopLoss <= 0) return "กรุณากรอก Stop Loss";
  if (input.entry === input.stopLoss) return "ราคาเข้าและ Stop Loss ห้ามเท่ากัน";
  return null;
}

/** Crypto: คำนวณเป็นจำนวนเหรียญ (units) */
export function calcCryptoSize(
  input: PositionSizeInput
): (PositionSizeResult & { units: number; positionValue: number }) | null {
  const distance = Math.abs(input.entry - input.stopLoss);
  if (validate(input)) return null;

  const riskAmount = riskAmountOf(input.balance, input.riskPercent);
  const units = riskAmount / distance;
  return {
    riskAmount,
    distance,
    direction: directionOf(input.entry, input.stopLoss),
    units,
    positionValue: units * input.entry,
  };
}

// ---------- CFD ----------

export interface CfdPreset {
  symbol: string;
  label: string;
  contractSize: number; // จำนวนหน่วยต่อ 1 lot
  pipSize: number; // ขนาด 1 pip/point ในหน่วยราคา
}

/** Preset ค่ามาตรฐาน MT5 — แก้ได้ตาม spec ของโบรกเกอร์จริง */
export const CFD_PRESETS: CfdPreset[] = [
  { symbol: "XAUUSD", label: "ทองคำ (XAUUSD)", contractSize: 100, pipSize: 0.1 },
  { symbol: "XAGUSD", label: "เงิน (XAGUSD)", contractSize: 5000, pipSize: 0.01 },
  { symbol: "EURUSD", label: "ยูโร/ดอลลาร์ (EURUSD)", contractSize: 100_000, pipSize: 0.0001 },
  { symbol: "GBPUSD", label: "ปอนด์/ดอลลาร์ (GBPUSD)", contractSize: 100_000, pipSize: 0.0001 },
  { symbol: "AUDUSD", label: "ออสเตรเลีย/ดอลลาร์ (AUDUSD)", contractSize: 100_000, pipSize: 0.0001 },
  { symbol: "USDJPY", label: "ดอลลาร์/เยน (USDJPY)", contractSize: 100_000, pipSize: 0.01 },
  { symbol: "EURJPY", label: "ยูโร/เยน (EURJPY)", contractSize: 100_000, pipSize: 0.01 },
  { symbol: "GBPJPY", label: "ปอนด์/เยน (GBPJPY)", contractSize: 100_000, pipSize: 0.01 },
  { symbol: "US30", label: "ดัชนีดาวโจนส์ (US30)", contractSize: 1, pipSize: 1 },
  { symbol: "NAS100", label: "ดัชนี Nasdaq (NAS100)", contractSize: 1, pipSize: 1 },
  { symbol: "SPX500", label: "ดัชนี S&P 500 (SPX500)", contractSize: 1, pipSize: 1 },
  { symbol: "GER40", label: "ดัชนีเยอรมนี (GER40)", contractSize: 1, pipSize: 1 },
  { symbol: "UK100", label: "ดัชนีอังกฤษ (UK100)", contractSize: 1, pipSize: 1 },
  { symbol: "USOIL", label: "น้ำมันดิบ WTI (USOIL)", contractSize: 1_000, pipSize: 0.01 },
];

/** คู่ที่ quote ไม่ใช่ USD — pip value อยู่ในสกุล quote ต้องแปลงเป็น USD */
export function quoteCurrencyOf(symbol: string): string | null {
  // เช่น EURJPY -> JPY, USDJPY -> JPY (ตัด 3 ตัวแรก)
  if (symbol.length !== 6) return null;
  return symbol.slice(3);
}

/** contract size ต่อ 1 lot ของ symbol ตาม preset CFD — symbol ที่ไม่รู้จักถือเป็น 1 (เช่น crypto) */
export function contractSizeOf(symbol: string): number {
  const s = symbol.trim().toUpperCase();
  return CFD_PRESETS.find((p) => p.symbol === s)?.contractSize ?? 1;
}

/**
 * กำไร/ขาดทุนจาก entry → exit (คิดตามทิศทาง, lot, contract size ของ symbol)
 * คืน "" ถ้ากรอกไม่ครบ (คำนวณไม่ได้)
 */
export function calcPnl(t: {
  symbol: string;
  direction: string;
  entryPrice: number | "";
  exitPrice: number | "";
  lotSize: number | "";
}): number | "" {
  const num = (v: number | "") => (typeof v === "number" && !isNaN(v) ? v : null);
  const entry = num(t.entryPrice);
  const exit = num(t.exitPrice);
  const lot = num(t.lotSize);
  if (entry === null || exit === null || lot === null) return "";
  const dir = t.direction === "SHORT" ? -1 : 1;
  return Math.round((exit - entry) * dir * lot * contractSizeOf(t.symbol) * 100) / 100;
}

export interface CfdCalcInput {
  balance: number;
  riskPercent: number;
  contractSize: number;
  pipSize: number;
  /** หน่วยของ SL ที่ผู้ใช้กรอก: ระยะราคา ($) หรือ pips */
  slUnit: "price" | "pips";
  /** ค่า SL ตามหน่วยที่เลือก (ระยะราคา หรือ จำนวน pips) */
  slValue: number;
  /** อัตราแลกเปลี่ยน quote → USD เช่น USDJPY = 150 (คู่ USD quote ใช้ 1) */
  quoteRate?: number;
}

export interface CfdCalcResult {
  riskAmount: number;
  lots: number;
  pipValueUsd: number; // มูลค่า 1 pip ต่อ 1 lot เป็น USD
  slPriceDistance: number; // ระยะ SL เป็นราคา
  slPips: number; // ระยะ SL เป็น pips
  lossPerLot: number; // ขาดทุนต่อ 1 lot ถ้าโดน SL (USD)
}

/**
 * คำนวณ lots แบบ CFD — รองรับ SL ทั้งแบบ pips และระยะราคา พร้อมแปลง quote currency
 * คืน null เมื่อ input ไม่ครบ/ไม่ถูกต้อง
 */
export function calcCfdSize(input: CfdCalcInput): CfdCalcResult | null {
  const { balance, riskPercent, contractSize, pipSize, slUnit, slValue } = input;
  const rate = input.quoteRate && input.quoteRate > 0 ? input.quoteRate : 1;
  if (balance <= 0 || riskPercent <= 0 || riskPercent > 100 || contractSize <= 0 || pipSize <= 0) {
    return null;
  }
  if (slValue <= 0) return null;

  const slPriceDistance = slUnit === "pips" ? slValue * pipSize : slValue;
  const slPips = slUnit === "pips" ? slValue : slValue / pipSize;

  const riskAmount = riskAmountOf(balance, riskPercent);
  const pipValueUsd = (pipSize * contractSize) / rate;
  const lossPerLot = slPips * pipValueUsd;
  if (lossPerLot <= 0) return null;

  return {
    riskAmount,
    lots: riskAmount / lossPerLot,
    pipValueUsd,
    slPriceDistance,
    slPips,
    lossPerLot,
  };
}

/**
 * ดึงอัตราแลกเปลี่ยน quote → USD ในรูปแบบ "quote ต่อ 1 USD" (เช่น JPY = 156.2)
 * API คืนค่า 1 quote = ? USD (rates.USD) จึงต้อง invert
 */
export async function fetchQuoteRate(quote: string): Promise<number | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${quote}`);
    if (!res.ok) return null;
    const data = await res.json();
    const usdPerQuote = data?.rates?.USD;
    if (typeof usdPerQuote !== "number" || usdPerQuote <= 0) return null;
    return 1 / usdPerQuote;
  } catch {
    return null;
  }
}
