# Trade Journal

Webapp บันทึกและรีวิวการเทรด (Trading Journal) ทำด้วย React + shadcn/ui + Tailwind CSS เก็บข้อมูลลง **Google Sheets** ผ่าน **Google Apps Script** — ไม่ต้องมี server หรือ database ของตัวเอง

## ฟีเจอร์

- **Dashboard**: กำไรสุทธิ, Win Rate, Profit Factor, Max Drawdown, เทรดดีที่สุด/แย่ที่สุด, กราฟ Equity Curve, เทรดล่าสุด
- **บันทึกเทรด**: ตารางรายการพร้อม filter (สินทรัพย์ / LONG-SHORT / ช่วงวันที่) และช่องค้นหา
- **Backtest**: บันทึกการทดสอบกลยุทธ์ (ไม้ทดสอบ + รูป position เก็บลง Google Drive) พร้อมสถิติ WinRate, Profit Factor และตาราง **Winrate แยกตามกลยุทธ์** — เอากลยุทธ์ที่ชนะไปเทรดจริง (ต้อง redeploy Apps Script หลังอัปเดตโค้ด)
- **ฟอร์มเทรด**: วันที่, symbol, LONG/SHORT, ราคาเข้า-ออก, lot, SL/TP, กำไร-ขาดทุน, กลยุทธ์, อารมณ์ตอนเทรด, บันทึกบทเรียน
- **แนบรูป chart**: อัปโหลดแล้วเก็บลง Google Drive อัตโนมัติ
- **วิเคราะห์กราฟ SMC** (ใน ZCode): พิมพ์ `วิเคราะห์ XAUUSD` ในแชท — ดูหัวข้อ "การวิเคราะห์กราฟ" ด้านล่าง
- ธีมมืด/สว่าง, UI ภาษาไทย

## เริ่มใช้งาน

### 1. ติดตั้ง

```bash
npm install
```

### 2. ตั้งค่า Google Sheets (ทำครั้งเดียว)

ดูขั้นตอนละเอียดที่ [apps-script/README.md](./apps-script/README.md) — สรุปสั้นๆ:

1. สร้าง Google Sheet แล้วเปิด Extensions → Apps Script
2. วางโค้ดจาก [apps-script/Code.gs](./apps-script/Code.gs)
3. Deploy เป็น Web App (Execute as: **Me**, Access: **Anyone**) แล้วคัดลอก URL

### 3. ตั้งค่า .env

```bash
cp .env.example .env
# แล้วแก้ VITE_APPS_SCRIPT_URL เป็น URL ที่ได้จากการ deploy
```

### 4. รัน

```bash
npm run dev
```

เปิด http://localhost:5173

### 5. ขึ้นออนไลน์ (ไม่ต้องมี hosting แยก)

```bash
npm run build:gas
```

ได้ไฟล์ใน `gas-app/` (Index.html ไฟล์เดียวรวมทั้งแอป + Code.gs + appsscript.json) — คัดลอกไปวางใน Apps Script editor แล้ว deploy ตามขั้นตอนใน [apps-script/README.md](./apps-script/README.md) หัวข้อ "ติดตั้งแบบออนไลน์" จากนั้นเปิด Web app URL ใช้ได้จากทุกอุปกรณ์เลย

## โครงสร้างโปรเจกต์

```
├── apps-script/Code.gs     # Backend (วางใน Apps Script editor ของ Google Sheet)
├── scripts/
│   ├── fetch-candles.mjs   # ดึงแท่งเทียน H4/H1/M15 (Binance = คริปโต, Yahoo = ทอง/ฟอเร็กซ์/ดัชนี)
│   └── smc-detect.mjs      # ตรวจจับโครงสร้าง SMC (Swing, BOS, CHoCH, FVG, OB, Liquidity, S/R)
├── .agents/skills/smc-analysis/SKILL.md  # ตัวขับระบบวิเคราะห์ใน ZCode
├── src/
│   ├── lib/api.ts          # Client เรียก Apps Script
│   ├── lib/types.ts        # Type ของข้อมูลเทรด
│   ├── lib/stats.ts        # คำนวณสถิติ (win rate, equity curve, ...)
│   ├── hooks/useTrades.ts  # Hook โหลดข้อมูลเทรด
│   ├── components/         # UI components
│   └── pages/              # Dashboard, Trades
└── .env                    # VITE_APPS_SCRIPT_URL (สร้างเอง)
```

## การวิเคราะห์กราฟ (ใช้ใน ZCode แชท)

พิมพ์ในแชท ZCode:

```
วิเคราะห์ XAUUSD
```

หรือเรียกผ่าน slash command: `/smc-analysis XAUUSD`

ระบบจะรัน subagent 3 ตัวตามลำดับ:

1. **market-data-agent** — ดึงแท่งเทียน H4/H1/M15 แล้วตรวจจับโครงสร้างด้วยโค้ด (แม่น, ตรวจสอบซ้ำได้)
2. **chart-analysis-agent** — ตีความ top-down: H4 เทรนด์ → H1 confirmation → M15 entry
3. **trade-analysis-agent** — สรุปแผนเทรด: Bias / Entry / SL / TP / RR / Confidence / Status

ตัว subagent ทั้ง 3 ตัวประกาศเป็น ZCode agents ที่ `~/.zcode/agents/` (market-data.md, chart-analysis.md, trade-analysis.md) — แก้บทบาท/กติกาได้ที่ไฟล์เหล่านั้น (ระบบโหลดใหม่ตอนเริ่ม session)

ผลลัพธ์เป็นการ์ดแผนเทรดในแชท + ไฟล์รายงานใน `analysis/` (structure.json, report.md, plan.md)

**สัญลักษณ์ที่รองรับ:** ทอง XAUUSD, เงิน XAGUSD, ฟอเร็กซ์ EURUSD/GBPUSD/USDJPY..., ดัชนี US30/NAS100/SPX500/GER40/UK100, น้ำมัน USOIL, คริปโต BTCUSDT/ETHUSDT... (พิมพ์ BTC ก็ได้ ระบบแปลงเป็น BTCUSDT)

**แหล่งข้อมูล:** คริปโตจาก Binance (เรียลไทม์) · อื่นๆ จาก Yahoo Finance (ฟรี, ดีเลย์ ~10-15 นาที — ทองใช้ฟิวเจอร์ส GC=F ซึ่งเคลื่อนไหวตามสปอตเกือบ 1:1)

**คำเตือน:** ผลการวิเคราะห์เพื่อการศึกษาและวางแผนเท่านั้น ไม่ใช่คำแนะนำการลงทุน

