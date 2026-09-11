# Module ใหม่: เมนู Backtest (บันทึก + สถิติ winrate + รูป position ลง Google Drive)

**หลักการ (ponytail):** backtest entry ใช้ schema เดียวกับ Trade ทุกคอลัมน์ (ช่อง setup = กลยุทธ์, imageUrl = รูป position, ซ่อนช่องอารมณ์) → reuse backend CRUD, computeStats, TradeForm, TradeTable ได้แทบทั้งหมด แค่ route ชีตใหม่ "Backtests"

## รูป position → Google Drive (ใช้ระบบเดิมที่มีอยู่แล้ว)

- ฟอร์ม Backtest มีช่อง **แนบรูป position** (รูปหน้าจอ chart ตอนเข้าเทรด) — อัปโหลดผ่าน action `uploadImage` เดิมของ Apps Script:
  แปลงเป็น base64 → สร้างไฟล์ใน **Google Drive โฟลเดอร์ "Trade Journal Images"** → setSharing ANYONE_WITH_LINK → เก็บ URL (`drive.google.com/thumbnail?id=...&sz=w1200`) ลงคอลัมน์ imageUrl ของชีต Backtests
- ตาราง/หน้ารายละเอียดแสดงรูปด้วย URL นี้ (กดดูรูปเต็มได้) — เหมือนหน้าบันทึกเทรดที่ใช้อยู่ทุกอย่าง

## 1. Backend — `apps-script/Code.gs`

- `getSheet_(name)` รับชื่อชีต (default "Trades") — ชีต **"Backtests"** สร้างอัตโนมัติพร้อม header ชุดเดียวกัน (คอลัมน์ imageUrl เก็บลิงก์รูป Drive)
- listTrades_/createTrade_/updateTrade_/deleteTrade_ รับ sheetName (default "Trades")
- `GET ?action=list&sheet=Backtests` และ POST body เพิ่ม field `sheet`
- `uploadImage_` ใช้เดิมทั้งหมด (Drive)
- ⚠ ผู้ใช้ต้อง **redeploy Apps Script (New version)** หลังแก้ — หน้าเว็บแสดง error พร้อมคำแนะนำถ้ายังไม่ redeploy

## 2. Frontend

- `src/lib/api.ts` — listTrades/createTrade/updateTrade/deleteTrade เพิ่ม optional param `sheet = "Trades"` (uploadImage เดิมไม่แตะ)
- `src/lib/types.ts` — `export type Backtest = Trade`
- `src/hooks/useTrades.ts` — รับ param `sheet = "Trades"`
- `src/lib/stats.ts` — เพิ่ม `setupStats(trades)` คืน [{setup, total, wins, winRate, netPnl}] (~15 บรรทัด)
- `src/components/TradeForm.tsx` — prop optional `hideEmotion?: boolean` (ช่องแนบรูป position ใช้ UI เดิมที่มีอยู่)
- `src/pages/Trades.tsx` — รับ props `{ sheet = "Trades", backtest = false }` (ไฟล์เดียวใช้ 2 route — ไม่ clone): useTrades(sheet), TradeForm(hideEmotion), การ์ดสรุปเดิม (WinRate/PF/กำไรรวม), โหมด backtest เพิ่มตาราง **Winrate แยกตามกลยุทธ์**
- `src/App.tsx` — `/backtests` → `<Trades sheet="Backtests" backtest />`
- `src/components/Layout.tsx` — เมนู "Backtest" (ไอคอน FlaskConical)
- README อัปเดตสั้นๆ

## การทดสอบ

1. `npm run build` ผ่าน
2. หลังผู้ใช้ redeploy: ทดสอบ /backtests จริง — สร้าง/แก้/ลบ, **อัปโหลดรูป position ลง Drive แล้วเห็นรูปในตาราง/รายละเอียด**, winrate + ตารางแยกกลยุทธ์ถูกต้อง, /trades เดิมไม่พัง
3. ยังไม่ redeploy: error state ชัดเจน

## ไม่ทำ (YAGNI)

ผลลัพธ์ WIN/LOSS/BE แยก, RR วางแผน, R multiple, watchlist — ขอเมื่อใช้จริงแล้วขาดจริง