#!/usr/bin/env node
/**
 * ดึงแท่งเทียน H4 / H1 / M15 สำหรับสัญลักษณ์ที่ร้องขอ
 * - Crypto (ลงท้าย USDT/USDC/FDUSD) → Binance klines (เรียลไทม์, ไม่ต้องมี key)
 * - อื่น ๆ (XAUUSD, EURUSD, US30, หุ้น) → Yahoo Finance chart API (ฟรี, ดีเลย์ ~10-15 นาที)
 *   แล้วรวมแท่ง 1h → 4h เอง เพราะ Yahoo ไม่มี interval 4h
 *
 * ใช้:  node scripts/fetch-candles.mjs <SYMBOL> [barsPerTf=200]
 * ออก:  analysis/<SYMBOL>-candles.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "analysis");
const TIMEOUT_MS = 20000;

// ---------- symbol ----------

const CRYPTO_ALIASES = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", XRP: "XRPUSDT",
  BNB: "BNBUSDT", DOGE: "DOGEUSDT", ADA: "ADAUSDT", AVAX: "AVAXUSDT",
};
const CRYPTO_QUOTE = /(USDT|USDC|FDUSD)$/;

const YAHOO_ALIASES = {
  US30: "^DJI", DJ30: "^DJI", DOW: "^DJI",
  NAS100: "^NDX", US100: "^NDX", NASDAQ: "^NDX",
  SPX500: "^GSPC", US500: "^GSPC", SP500: "^GSPC",
  GER40: "^GDAXI", DAX: "^GDAXI", DE40: "^GDAXI",
  UK100: "^FTSE", JP225: "^N225", JPN225: "^N225", US2000: "^RUT",
  // โลหะมีแพลตฟอร์ม: Yahoo ถอด XAUUSD=X แล้ว (404) — ใช้ฟิวเจอร์ส COMEX ซึ่งเคลื่อนไหวตามสปอตเกือบ 1:1
  XAUUSD: "GC=F", GOLD: "GC=F",
  XAGUSD: "SI=F", SILVER: "SI=F", XPTUSD: "PL=F",
  USOIL: "CL=F", WTI: "CL=F", UKOIL: "BZ=F",
};

function normalizeSymbol(raw) {
  let s = String(raw).trim().toUpperCase();
  if (s.includes(":")) s = s.split(":").pop(); // OANDA:XAUUSD → XAUUSD
  return s.replace(/[\s/\-_]/g, "");
}

function isCrypto(sym) {
  return CRYPTO_QUOTE.test(sym) || CRYPTO_ALIASES[sym] != null;
}

function yahooTicker(sym) {
  if (YAHOO_ALIASES[sym]) return YAHOO_ALIASES[sym];
  if (/^[A-Z]{6}$/.test(sym)) return `${sym}=X`; // คู่ฟอเร็กซ์ เช่น EURUSD → EURUSD=X
  return sym; // หุ้น/ETF ใช้ ticker ตรงๆ
}

// ---------- fetchers ----------

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function yahooChart(ticker, interval, range) {
  let lastErr;
  for (const host of ["query1", "query2"]) {
    const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false`;
    try {
      const json = await fetchJson(url);
      const r = json?.chart?.result?.[0];
      if (!r) {
        lastErr = new Error(json?.chart?.error?.description || "Yahoo ไม่คืนข้อมูล (ticker อาจผิด)");
        continue;
      }
      return r;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function yahooBars(result) {
  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const bars = [];
  for (let i = 0; i < ts.length; i++) {
    const { open: o, high: h, low: l, close: c } = q;
    if ([o?.[i], h?.[i], l?.[i], c?.[i]].some((v) => v == null)) continue;
    bars.push({ t: ts[i] * 1000, o: o[i], h: h[i], l: l[i], c: c[i], v: q.volume?.[i] ?? 0 });
  }
  return bars;
}

const BINANCE_HOSTS = [
  "https://api.binance.com",
  "https://data-api.binance.vision",
  "https://api1.binance.com",
];

async function binanceKlines(symbol, interval, limit) {
  let lastErr;
  for (const host of BINANCE_HOSTS) {
    try {
      const rows = await fetchJson(`${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      if (!Array.isArray(rows) || rows.length === 0) {
        lastErr = new Error("Binance ไม่คืนข้อมูล (symbol อาจผิด)");
        continue;
      }
      return rows.map((r) => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ---------- รวมแท่งเล็กเป็นแท่งใหญ่ (1h → 4h) ----------

function aggregate(bars, bucketMs) {
  const out = [];
  let cur = null;
  for (const b of bars) {
    const bucket = Math.floor(b.t / bucketMs) * bucketMs;
    if (!cur || cur.t !== bucket) {
      if (cur && cur._n === bucketMs / 3600000) out.push(cur); // ข้าม bucket ที่ยังไม่ครบจำนวนแท่งต้นทาง
      cur = { t: bucket, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, _n: 1 };
    } else {
      cur.h = Math.max(cur.h, b.h);
      cur.l = Math.min(cur.l, b.l);
      cur.c = b.c;
      cur.v += b.v;
      cur._n++;
    }
  }
  if (cur && cur._n === bucketMs / 3600000) out.push(cur);
  for (const b of out) delete b._n;
  return out;
}

const trim = (bars, n) => (bars.length > n ? bars.slice(-n) : bars);

// ---------- main ----------

const [rawSymbol, barsArg] = process.argv.slice(2);
if (!rawSymbol) {
  console.error("ใช้: node scripts/fetch-candles.mjs <SYMBOL> [bars]  เช่น XAUUSD, BTCUSDT, EURUSD");
  process.exit(1);
}
const symbol0 = normalizeSymbol(rawSymbol);
const symbol = CRYPTO_ALIASES[symbol0] || symbol0;
// สูงเพื่อให้ swing structure (size=50 ของ LuxAlgo) มีประวัติย้อนหลังพอสำหรับยืนยัน pivot + crossover
const LIMIT = Math.min(Math.max(parseInt(barsArg, 10) || 400, 50), 500);

let out;
try {
  if (isCrypto(symbol0)) {
    console.log(`→ ดึงจาก Binance: ${symbol}`);
    const [h4, h1, m15] = await Promise.all([
      binanceKlines(symbol, "4h", LIMIT),
      binanceKlines(symbol, "1h", LIMIT),
      binanceKlines(symbol, "15m", LIMIT),
    ]);
    out = {
      symbol, source: "binance", fetchedAt: new Date().toISOString(),
      lastPrice: h1[h1.length - 1].c,
      timeframes: {
        H4: { interval: "4h", bars: h4 },
        H1: { interval: "1h", bars: h1 },
        M15: { interval: "15m", bars: m15 },
      },
    };
  } else {
    const ticker = yahooTicker(symbol);
    console.log(`→ ดึงจาก Yahoo Finance: ${symbol} (${ticker})`);
    const [r15, r1h] = await Promise.all([
      yahooChart(ticker, "15m", "60d"), // 15m จำกัดสูงสุด 60 วัน
      yahooChart(ticker, "1h", "6mo"),
    ]);
    const b15 = yahooBars(r15);
    const b1h = yahooBars(r1h);
    if (b15.length < 30 || b1h.length < 60) {
      console.error(`✗ ข้อมูลน้อยเกินไป (15m: ${b15.length} แท่ง, 1h: ${b1h.length} แท่ง) — ตรวจสอบ symbol`);
      process.exit(1);
    }
    const b4h = aggregate(b1h, 4 * 3600000);
    out = {
      symbol, source: "yahoo", yahooTicker: ticker, note: "ดีเลย์ ~10-15 นาที",
      fetchedAt: new Date().toISOString(),
      lastPrice: b1h[b1h.length - 1].c,
      timeframes: {
        H4: { interval: "4h (รวมจาก 1h)", bars: trim(b4h, LIMIT) },
        H1: { interval: "1h", bars: trim(b1h, LIMIT) },
        M15: { interval: "15m", bars: trim(b15, LIMIT) },
      },
    };
  }
} catch (e) {
  console.error(`✗ ดึงข้อมูล ${symbol} ไม่สำเร็จ: ${e.message}`);
  console.error("  ตรวจ symbol อีกครั้ง (ทอง XAUUSD, ฟอเร็กซ์ EURUSD, ดัชนี US30/NAS100, คริปโต BTCUSDT)");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, `${symbol}-candles.json`);
await writeFile(outFile, JSON.stringify(out));

const tfInfo = Object.entries(out.timeframes)
  .map(([tf, d]) => {
    const first = new Date(d.bars[0].t).toISOString().slice(0, 16).replace("T", " ");
    const last = new Date(d.bars[d.bars.length - 1].t).toISOString().slice(0, 16).replace("T", " ");
    return `  ${tf.padEnd(3)} ${String(d.bars.length).padStart(3)} แท่ง  ${first} → ${last} UTC`;
  })
  .join("\n");
const displayPrice = (v) => (v >= 500 ? v.toFixed(2) : v >= 20 ? v.toFixed(3) : v >= 1 ? v.toFixed(4) : v.toFixed(6));
console.log(`✓ ${symbol} ราคาล่าสุด ${displayPrice(out.lastPrice)} (${out.source})`);
console.log(tfInfo);
console.log(`✓ บันทึก: ${outFile}`);
