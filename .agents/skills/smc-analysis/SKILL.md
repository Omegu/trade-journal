---
name: smc-analysis
description: วิเคราะห์กราฟเทรดด้วย Smart Money Concepts — Market Structure, BOS, CHoCH, Liquidity, Order Block, FVG, Support/Resistance แบบ top-down H4 เทรนด์ → H1 confirmation → M15 entry พร้อมแผนเทรด Entry/SL/TP/RR/Confidence/Status ใช้เมื่อผู้ใช้ขอวิเคราะห์สัญลักษณ์ เช่น "วิเคราะห์ XAUUSD", "analyze BTCUSDT", "ดูโครงสร้าง EURUSD", "เช็คเทรนด์ทอง/น้ำมัน/ดัชนี/คริปโต"
metadata:
  argument-hint: <symbol เช่น XAUUSD, BTCUSDT, EURUSD, US30>
---

# วิเคราะห์กราฟ SMC (Smart Money Concepts)

สายพาน 3 subagent ทำงาน**ตามลำดับ** (ตัวถัดไปต้องรอไฟล์จากตัวก่อนหน้า):

```
Market-Data → Chart-Analysis → Trade-Analysis → การ์ดแผนเทรด
```

subagent ทั้ง 3 ตัวประกาศไว้ที่ `~/.zcode/agents/` (market-data.md, chart-analysis.md, trade-analysis.md) — system prompt ของแต่ละตัว (บทบาท, กติกาเหล็ก, รูปแบบ output) อยู่ในไฟล์เหล่านั้น หน้าที่ของ main agent แค่ spawn และส่ง task ที่มี symbol + สิ่งที่ต้องทำรอบนั้น

## ขั้นตอนของ Main Agent

1. หา symbol จากข้อความผู้ใช้ (รองรับ: XAUUSD, EURUSD, US30, NAS100, GER40, BTCUSDT, BTC, ETH ฯลฯ — สคริปต์ normalize ให้เอง)
2. Spawn subagent ทีละตัวด้วย Agent tool:
   - ตัวที่ 1: `subagent_type: "Market-Data"` (ถ้าไม่พบชื่อนี้ ให้ fallback เป็น `general-purpose` แล้วคัดลอก prompt จากหัวข้อ "Task prompt" ด้านล่าง)
   - ตัวที่ 2: `subagent_type: "Chart-Analysis"`
   - ตัวที่ 3: `subagent_type: "Trade-Analysis"`
3. ตรวจผลของแต่ละตัวก่อนไปตัวถัดไป — ถ้า fail ให้แจ้ง error ตามจริง ห้ามปลอมข้อมูลหรือวิเคราะห์เองจากความจำ
4. นำการ์ดที่ trade-analysis-agent คืนมาแสดงต่อผู้ใช้ พร้อมเหตุผลย่อและ footer ข้อจำกัด

---

## Task prompt ที่ 1 — Market-Data

```
เตรียมข้อมูลราคา $SYMBOL ใน cwd G:\project\trade:
1. รัน node scripts/fetch-candles.mjs $SYMBOL (fail ซ้ำได้ 1 ครั้ง แล้วรายงาน error และหยุด)
2. รัน node scripts/smc-detect.mjs analysis/$SYMBOL-candles.json
3. ตรวจไฟล์ analysis/$SYMBOL-candles.json + analysis/$SYMBOL-structure.json มีเนื้อหาจริง
4. รายงาน: ราคาล่าสุด + แหล่งข้อมูล + fetchedAt + เวลาแท่ง H1 สุดท้าย, สรุป 1 บรรทัด/TF (state+label+event ล่าสุด+ATR), path ไฟล์ที่สร้าง
```

## Task prompt ที่ 2 — Chart-Analysis

```
วิเคราะห์ $SYMBOL จาก analysis/$SYMBOL-structure.json (แหล่งความจริงหลัก — port LuxAlgo: swing size50 + internal size5 ต่อ TF, OB/EQH-EQL/FVG/premiumDiscount) และ analysis/$SYMBOL-candles.json (ดูเพิ่มเมื่อจำเป็น)
ตามกรอบ top-down ของคุณ: H4 TREND → H1 CONFIRMATION → M15 ENTRY
เขียนรายงานลง analysis/$SYMBOL-report.md แล้วส่งกลับสรุปย่อ 5-8 bullets (มีตัวเลขราคาครบ)
```

## Task prompt ที่ 3 — Trade-Analysis

```
สร้างแผนเทรด $SYMBOL จาก analysis/$SYMBOL-report.md + analysis/$SYMBOL-structure.json
ตามกติกาของคุณ: Bias/Entry/SL/TP1/TP2/RR (คำนวณจริง)/Confidence (แสดงการคิดเลข)/Status + เงื่อนไขรอ (ถ้า WAIT)
เขียน analysis/$SYMBOL-plan.md แล้วส่งกลับการ์ดใน code block ตามรูปแบบที่กำหนด พร้อมเหตุผล 3-5 bullets
```

---

## รูปแบบคำตอบสุดท้ายของ Main Agent

แสดงการ์ดจาก trade-analysis-agent ใน code block + เหตุผลย่อ + โซนสำคัญ (ตารางเล็ก: โซน / ราคา / สถานะ) และปิดท้ายด้วย:

```
ข้อมูล: <yahoo ดีเลย์ ~10-15 นาที | binance เรียลไทม์> ณ <fetchedAt> (เวลาไทย) · ไฟล์รายงาน: analysis/$SYMBOL-plan.md
⚠ เพื่อการศึกษาและวางแผนเท่านั้น ไม่ใช่คำแนะนำการลงทุน
```

## ข้อควรระวัง

- ทุกตัวเลขในคำตอบต้องมีที่มาจากไฟล์ใน analysis/ — ห้ามดึงราคาจากความจำโมเดล
- รัน subagent ตามลำดับเสมอ ห้ามขนาน (ตัวหลังต้องใช้ไฟล์ของตัวก่อน)
- ถ้าผู้ใช้ขอ TF อื่น (เช่น D1/H4/H1) ให้บอกว่าระบบตั้งไว้ที่ H4→H1→M15 และวิเคราะห์ตามที่ระบบรองรับ
- เสริมได้เสมอ: เชื่อมกลับเว็บแอป (คำนวณ lot size จาก SL ด้วย PositionSizeCalculator ใน localhost:5173) เมื่อผู้ใช้ขอ
