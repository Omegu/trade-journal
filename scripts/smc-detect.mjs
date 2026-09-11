#!/usr/bin/env node
/**
 * ตรวจจับโครงสร้าง SMC — port จาก indicator "Smart Money Concepts [LuxAlgo]" (Pine v5, CC BY-NC-SA 4.0)
 * ให้ผลเทียบเคียงกับที่เห็นบน TradingView ได้ เช่น
 *   - Leg/swing engine แบบ LuxAlgo: bearish leg เมื่อ high[size] > highest(size), bullish leg เมื่อ low[size] < lowest(size)
 *   - โครงสร้าง 2 ชั้นต่อ timeframe: internal (size=5) และ swing (size=50) — ตัวละ BOS/CHoCH ของตัวเอง
 *   - BOS/CHoCH เมื่อ close crossover/crossunder ระดับ pivot ที่ยังไม่ถูก crossed (tag ตาม trend bias ปัจจุบัน)
 *   - Order Block: จากช่วง pivot→จุด break เลือกแท่ง parsedHigh สูงสุด (bearish) / parsedLow ต่ำสุด (bullish)
 *     โดยแท่งผันผวนสูง (range ≥ 2×ATR200) จะสลับ high/low ออกจากการเลือก; mitigation ตาม High/Low (default)
 *   - EQH/EQL: pivot ต่อเนื่อง (size=3) ที่ห่างกัน < 0.1×ATR200
 *   - FVG: low > high[2] && close[1] > high[2] (bullish) + auto threshold = 2×ค่าเฉลี่ย |delta%| สะสม; ลบเมื่อถูกทะลุเต็ม
 *   - Premium/Equilibrium/Discount zones + Strong/Weak High/Low จาก trailing extremes ของ swing trend
 *
 * ใช้:  node scripts/smc-detect.mjs analysis/<SYMBOL>-candles.json
 * ออก:  analysis/<SYMBOL>-structure.json
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BULLISH = 1, BEARISH = -1;
const BEARISH_LEG = 0, BULLISH_LEG = 1;
const SWING_SIZE = 50;   // LuxAlgo swingsLengthInput default
const INTERNAL_SIZE = 5; // LuxAlgo internal structure size
const EQ_SIZE = 3;       // LuxAlgo equalHighsLowsLengthInput default
const EQ_THRESHOLD = 0.1; // × ATR200
const MAX_OB = 5;        // จำนวน OB ที่เก็บแสดงต่อฝั่ง (LuxAlgo ใช้ 5)

// ---------- helpers ----------

const iso = (t) => new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC";

function decimalsFor(price) {
  if (price >= 500) return 2;
  if (price >= 20) return 3;
  if (price >= 1) return 4;
  return 6;
}
const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

// ATR แบบ RMA (เหมือน ta.atr) — คืน array ต่อแท่ง
function atrSeries(bars, period = 200) {
  const trs = [bars[0].h - bars[0].l];
  for (let i = 1; i < bars.length; i++) {
    trs.push(Math.max(
      bars[i].h - bars[i].l,
      Math.abs(bars[i].h - bars[i - 1].c),
      Math.abs(bars[i].l - bars[i - 1].c),
    ));
  }
  const n = Math.min(period, bars.length);
  const out = new Array(bars.length).fill(NaN);
  let sum = 0, prev = NaN;
  for (let i = 0; i < bars.length; i++) {
    if (i < n) {
      sum += trs[i];
      if (i === n - 1) { prev = sum / n; out[i] = prev; } // seed = SMA
    } else {
      prev = (prev * (n - 1) + trs[i]) / n;
      out[i] = prev;
    }
  }
  // แท่งก่อน seed เสร็จ: ใช้ค่าเฉลี่ย TR ที่มีอยู่ (fallback เหมือน 'Cumulative Mean Range')
  let cum = 0;
  for (let i = 0; i < bars.length; i++) {
    cum += trs[i];
    if (Number.isNaN(out[i])) out[i] = cum / (i + 1);
  }
  return out;
}

// parsedHigh/parsedLow ตาม LuxAlgo: แท่งผันผวนสูง (range ≥ 2×vol) สลับ high↔low เพื่อไม่ให้ถูกเลือกเป็น OB
function parsedExtremes(bars, atr) {
  return bars.map((b, i) => {
    const volatileBar = b.h - b.l >= 2 * atr[i];
    return {
      high: volatileBar ? b.l : b.h,
      low: volatileBar ? b.h : b.l,
    };
  });
}

// ---------- leg engine (LuxAlgo leg(size)) ----------
// leg = BEARISH เมื่อ high[size] > highest(size แท่งถัดจากมัน), BULLISH เมื่อ low[size] < lowest(...)
// คืน array ของ {i (bar index ของแท่งยืนยัน), change} เฉพาะจุดที่ leg เปลี่ยน
function legChanges(bars, size) {
  const changes = [];
  let leg = BEARISH_LEG;
  for (let i = size; i < bars.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - size + 1; j <= i; j++) {
      if (bars[j].h > hh) hh = bars[j].h;
      if (bars[j].l < ll) ll = bars[j].l;
    }
    let cur = leg;
    if (bars[i - size].h > hh) cur = BEARISH_LEG;
    else if (bars[i - size].l < ll) cur = BULLISH_LEG;
    if (cur !== leg) changes.push({ i, change: cur - leg, newLeg: cur });
    leg = cur;
  }
  return changes;
}

// ---------- structure engine (getCurrentStructure + displayStructure) ----------
// คืน { trend, events, orderBlocks, pivotHigh, pivotLow }
function structureEngine(bars, parsed, changes, size) {
  const pivotHigh = { currentLevel: null, lastLevel: null, crossed: false, barTime: null, barIndex: null };
  const pivotLow = { currentLevel: null, lastLevel: null, crossed: false, barTime: null, barIndex: null };
  let trendBias = 0;
  const events = [];
  const orderBlocks = [];
  const changeByBar = new Map(changes.map((c) => [c.i, c]));

  for (let i = size; i < bars.length; i++) {
    // 1) อัปเดต pivot เมื่อ leg เปลี่ยน (pivot bar คือ i-size)
    const ch = changeByBar.get(i);
    if (ch) {
      const p = ch.newLeg === BULLISH_LEG ? pivotLow : pivotHigh;
      const b = bars[i - size];
      p.lastLevel = p.currentLevel;
      p.currentLevel = ch.newLeg === BULLISH_LEG ? b.l : b.h;
      p.crossed = false;
      p.barTime = b.t;
      p.barIndex = i - size;
    }

    // 2) ตรวจ break: close crossover/crossunder ระดับ pivot ที่ยังไม่ crossed
    //    (ta.crossover(close, level): close > level และ close[1] <= level[1] โดย level[1] = ค่าก่อนอัปเดต)
    const prevClose = bars[i - 1].c;
    if (pivotHigh.currentLevel != null && !pivotHigh.crossed &&
        bars[i].c > pivotHigh.currentLevel && prevClose <= (pivotHigh._prevLevel ?? pivotHigh.currentLevel)) {
      const type = trendBias === BEARISH ? "CHoCH" : "BOS";
      events.push({ type, direction: "bullish", level: pivotHigh.currentLevel, pivotTime: pivotHigh.barTime, time: bars[i].t, close: bars[i].c });
      pivotHigh.crossed = true;
      trendBias = BULLISH;
      storeOb(bars, parsed, orderBlocks, BULLISH, pivotHigh.barIndex, i);
    }
    if (pivotLow.currentLevel != null && !pivotLow.crossed &&
        bars[i].c < pivotLow.currentLevel && prevClose >= (pivotLow._prevLevel ?? pivotLow.currentLevel)) {
      const type = trendBias === BULLISH ? "CHoCH" : "BOS";
      events.push({ type, direction: "bearish", level: pivotLow.currentLevel, pivotTime: pivotLow.barTime, time: bars[i].t, close: bars[i].c });
      pivotLow.crossed = true;
      trendBias = BEARISH;
      storeOb(bars, parsed, orderBlocks, BEARISH, pivotLow.barIndex, i);
    }

    // 3) mitigation แบบ High/Low (default ของ LuxAlgo): bullish OB ถูกลบเมื่อ low < barLow, bearish เมื่อ high > barHigh
    for (let k = orderBlocks.length - 1; k >= 0; k--) {
      const ob = orderBlocks[k];
      if (ob.bias === BULLISH && bars[i].l < ob.barLow) ob.mitigatedAt = bars[i].t;
      if (ob.bias === BEARISH && bars[i].h > ob.barHigh) ob.mitigatedAt = bars[i].t;
    }
    // เก็บ _prevLevel ไว้เทียบ crossover รอบถัดไป
    pivotHigh._prevLevel = pivotHigh.currentLevel;
    pivotLow._prevLevel = pivotLow.currentLevel;
  }

  return { trendBias, events, orderBlocks, pivotHigh, pivotLow };
}

// storeOrdeBlock: เลือกแท่ง parsedHigh สูงสุด (bearish) / parsedLow ต่ำสุด (bullish) ในช่วง pivot→break
function storeOb(bars, parsed, orderBlocks, bias, pivotBarIndex, breakBarIndex) {
  let bestIdx = -1, bestVal = bias === BEARISH ? -Infinity : Infinity;
  for (let j = Math.max(0, pivotBarIndex); j < breakBarIndex; j++) {
    const v = bias === BEARISH ? parsed[j].high : parsed[j].low;
    if (bias === BEARISH ? v > bestVal : v < bestVal) { bestVal = v; bestIdx = j; }
  }
  if (bestIdx < 0) return;
  orderBlocks.unshift({
    bias,
    barHigh: bars[bestIdx].h,
    barLow: bars[bestIdx].l,
    time: bars[bestIdx].t,
    fromBreak: breakBarIndex,
  });
  if (orderBlocks.length > 100) orderBlocks.pop();
}

// ---------- EQH/EQL (getCurrentStructure size=3 + threshold 0.1×ATR) ----------

function equalHighLows(bars, atr, lastAtr) {
  const changes = legChanges(bars, EQ_SIZE);
  const out = { eqh: [], eql: [] };
  let prevHigh = null, prevLow = null;
  const changeByBar = new Map(changes.map((c) => [c.i, c]));
  for (let i = EQ_SIZE; i < bars.length; i++) {
    const ch = changeByBar.get(i);
    if (!ch) continue;
    const b = bars[i - EQ_SIZE];
    if (ch.newLeg === BULLISH_LEG) {
      if (prevLow != null && Math.abs(prevLow - b.l) < EQ_THRESHOLD * lastAtr) {
        out.eql.push({ level: b.l, prevLevel: prevLow, time: b.t });
      }
      prevLow = b.l;
    } else {
      if (prevHigh != null && Math.abs(prevHigh - b.h) < EQ_THRESHOLD * lastAtr) {
        out.eqh.push({ level: b.h, prevLevel: prevHigh, time: b.t });
      }
      prevHigh = b.h;
    }
  }
  return out;
}

// ---------- FVG (drawFairValueGaps เงื่อนไขเดียวกัน + auto threshold) ----------

function fairValueGaps(bars) {
  const gaps = [];
  let cumAbs = 0;
  for (let i = 2; i < bars.length; i++) {
    const lastClose = bars[i - 1].c, lastOpen = bars[i - 1].o;
    const deltaPct = (lastClose - lastOpen) / (lastOpen * 100); // ตามสูตรเดิมของ LuxAlgo
    cumAbs += Math.abs(deltaPct);
    const threshold = (cumAbs / i) * 2; // auto threshold
    const bull = bars[i].l > bars[i - 2].h && lastClose > bars[i - 2].h && deltaPct > threshold;
    const bear = bars[i].h < bars[i - 2].l && lastClose < bars[i - 2].l && -deltaPct > threshold;
    if (bull) gaps.unshift({ bias: BULLISH, top: bars[i].l, bottom: bars[i - 2].h, time: bars[i].t });
    if (bear) gaps.unshift({ bias: BEARISH, top: bars[i - 2].l, bottom: bars[i].h, time: bars[i].t });
    // deleteFairValueGaps: bullish ถูกลบเมื่อ low < bottom, bearish เมื่อ high > top
    for (const g of gaps) {
      if (g.removedAt) continue;
      if (g.bias === BULLISH && bars[i].l < g.bottom) g.removedAt = bars[i].t;
      if (g.bias === BEARISH && bars[i].h > g.top) g.removedAt = bars[i].t;
    }
    if (gaps.length > 200) gaps.pop();
  }
  return gaps;
}

// ---------- trailing extremes + premium/discount (updateTrailingExtremes + drawPremiumDiscountZones) ----------

function trailingExtremes(bars) {
  let top = -Infinity, bottom = Infinity, topTime = null, bottomTime = null;
  for (const b of bars) {
    if (b.h >= top) { top = b.h; topTime = b.t; }        // math.max ทุกแท่ง, จำเวลาของค่าที่ equal ล่าสุด
    if (b.l <= bottom) { bottom = b.l; bottomTime = b.t; }
  }
  const last = bars[bars.length - 1].c;
  const pos = (last - bottom) / (top - bottom); // 0=discount 1=premium
  return {
    top, topTime, bottom, bottomTime,
    equilibrium: (top + bottom) / 2,
    positionPct: pos * 100,
    zone: pos > 0.525 ? "premium" : pos < 0.475 ? "discount" : "equilibrium",
    // zone เข้ม (LuxAlgo วาด 2 โซนแยกจาก EQ band ±2.5%)
    premiumZone: [top, 0.95 * top + 0.05 * bottom],
    discountZone: [0.95 * bottom + 0.05 * top, bottom],
  };
}

// ---------- ต่อ timeframe ----------

function analyzeTf(bars) {
  const d = decimalsFor(bars[bars.length - 1].c);
  const px = (v) => r(v, d);
  const atr = atrSeries(bars, 200);
  const lastAtr = atr[atr.length - 1];
  const parsed = parsedExtremes(bars, atr);

  const run = (size) => {
    const changes = legChanges(bars, size);
    const eng = structureEngine(bars, parsed, changes, size);
    const events = eng.events.slice(-8).map((e) => ({
      type: e.type, direction: e.direction, level: px(e.level), time: iso(e.time),
    }));
    // OB: active = ยังไม่ mitigated; รายงานล่าสุดก่อน + สถานะ
    const obs = eng.orderBlocks.slice(0, MAX_OB).map((o) => ({
      bias: o.bias === BULLISH ? "bullish" : "bearish",
      top: px(o.barHigh), bottom: px(o.barLow),
      time: iso(o.time),
      status: o.mitigatedAt ? "mitigated" : "active",
      mitigatedAt: o.mitigatedAt ? iso(o.mitigatedAt) : null,
    }));
    return {
      trend: eng.trendBias === BULLISH ? "bullish" : eng.trendBias === BEARISH ? "bearish" : "neutral",
      lastEvent: events[events.length - 1] ?? null,
      events,
      pivotHigh: eng.pivotHigh.currentLevel != null ? { level: px(eng.pivotHigh.currentLevel), time: iso(eng.pivotHigh.barTime), crossed: eng.pivotHigh.crossed } : null,
      pivotLow: eng.pivotLow.currentLevel != null ? { level: px(eng.pivotLow.currentLevel), time: iso(eng.pivotLow.barTime), crossed: eng.pivotLow.crossed } : null,
      orderBlocks: obs,
    };
  };

  const eq = equalHighLows(bars, atr, lastAtr);
  const gaps = fairValueGaps(bars)
    .filter((g) => !g.removedAt)
    .slice(0, 8)
    .map((g) => ({
      bias: g.bias === BULLISH ? "bullish" : "bearish",
      top: px(g.top), bottom: px(g.bottom), mid: px((g.top + g.bottom) / 2),
      time: iso(g.time),
    }));
  const tr = trailingExtremes(bars);

  return {
    bars: bars.length,
    window: `${iso(bars[0].t)} → ${iso(bars[bars.length - 1].t)}`,
    lastClose: px(bars[bars.length - 1].c),
    atr200: px(lastAtr),
    swing: run(SWING_SIZE),
    internal: run(INTERNAL_SIZE),
    equalHighsLows: {
      eqh: eq.eqh.slice(-5).map((x) => ({ level: px(x.level), prevLevel: px(x.prevLevel), time: iso(x.time) })),
      eql: eq.eql.slice(-5).map((x) => ({ level: px(x.level), prevLevel: px(x.prevLevel), time: iso(x.time) })),
    },
    fvg: gaps,
    premiumDiscount: {
      top: px(tr.top), topTime: iso(tr.topTime),
      bottom: px(tr.bottom), bottomTime: iso(tr.bottomTime),
      equilibrium: px(tr.equilibrium),
      positionPct: r(tr.positionPct, 1),
      zone: tr.zone,
      strongWeak: null, // เติมด้านล่างหลังรู้ swing trend
    },
  };
}

// ---------- main ----------

const input = process.argv[2];
if (!input) {
  console.error("ใช้: node scripts/smc-detect.mjs analysis/<SYMBOL>-candles.json");
  process.exit(1);
}
const data = JSON.parse(await readFile(path.resolve(process.cwd(), input), "utf8"));

const result = {
  symbol: data.symbol,
  source: data.source,
  generatedAt: new Date().toISOString(),
  lastPrice: data.lastPrice,
  algorithm: "port จาก LuxAlgo Smart Money Concepts (swing=50, internal=5, EQ threshold 0.1×ATR200, FVG auto threshold)",
  timeframes: {
    H4: analyzeTf(data.timeframes.H4.bars),
    H1: analyzeTf(data.timeframes.H1.bars),
    M15: analyzeTf(data.timeframes.M15.bars),
  },
};

// Strong/Weak High/Low ตาม swing trend (LuxAlgo drawHighLowSwings)
for (const tf of Object.values(result.timeframes)) {
  tf.premiumDiscount.strongWeak = {
    high: tf.swing.trend === "bearish" ? "Strong High" : "Weak High",
    low: tf.swing.trend === "bullish" ? "Strong Low" : "Weak Low",
  };
}

const outFile = path.join(ROOT, "analysis", `${data.symbol}-structure.json`);
await writeFile(outFile, JSON.stringify(result, null, 1));

for (const [tf, a] of Object.entries(result.timeframes)) {
  const sw = a.swing.lastEvent;
  const iv = a.internal.lastEvent;
  const activeOb = a.swing.orderBlocks.filter((o) => o.status === "active").length;
  console.log(
    `${tf}: swing ${a.swing.trend.padEnd(8)} (ล่าสุด ${sw ? `${sw.type} ${sw.direction} @ ${sw.level}` : "-"}) | ` +
    `internal ${a.internal.trend} (${iv ? `${iv.type} ${iv.direction} @ ${iv.level}` : "-"}) | ` +
    `OB active ${activeOb} | FVG ${a.fvg.length} | EQH ${a.equalHighsLows.eqh.length}/EQL ${a.equalHighsLows.eql.length} | ` +
    `${a.premiumDiscount.zone} ${a.premiumDiscount.positionPct}%`,
  );
}
console.log(`✓ บันทึก: ${outFile}`);
