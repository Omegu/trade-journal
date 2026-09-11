# ตั้งค่า Google Apps Script Backend

Backend ของ Trade Journal ใช้ Google Apps Script ที่ผูกกับ Google Sheet — ไม่ต้องสมัคร Google Cloud หรือใช้ API key ใดๆ

## ขั้นตอนติดตั้ง (ทำครั้งเดียว)

### 1. สร้าง Google Sheet

1. ไปที่ [sheets.new](https://sheets.new) สร้าง Spreadsheet ใหม่ ตั้งชื่อว่า `Trade Journal` (หรือชื่ออื่นก็ได้)

### 2. ใส่โค้ด Apps Script

1. ในเมนูเลือก **ส่วนขยาย (Extensions) → Apps Script**
2. ลบโค้ดเดิมในไฟล์ `Code.gs` ทั้งหมด
3. คัดลอกเนื้อหาจากไฟล์ [`Code.gs`](./Code.gs) ในโฟลเดอร์นี้ วางลงไป แล้วกดบันทึก (Ctrl+S)

### 3. Deploy เป็น Web App

1. กดปุ่ม **Deploy (ปรับใช้) → New deployment (การปรับใช้ใหม่)** มุมขวาบน
2. กดรูปเฟืองข้าง "Select type" เลือก **Web app (เว็บแอป)**
3. ตั้งค่า:
   - **Description**: `Trade Journal API`
   - **Execute as (ดำเนินการในฐานะ)**: `Me (ฉัน)` ← สำคัญ
   - **Who has access (ใครเข้าถึงได้)**: `Anyone (ทุกคน)` ← สำคัญ (URL นี้เป็นความลับเฉพาะที่มี id ยาว ใครไม่รู้ URL ก็เรียกไม่ได้)
4. กด **Deploy** แล้วอนุญาตสิทธิ์ (Authorize access) — เลือก account ของคุณ จะขึ้นเตือน "Google hasn't verified this app" ให้กด **Advanced → Go to ... (unsafe)** แล้วกด Allow
   - สิทธิ์ที่ขอคือ: จัดการ Spreadsheet ที่ผูกไว้, จัดการไฟล์ใน Drive (เก็บรูป chart), เชื่อมต่อภายนอก
5. คัดลอก **Web app URL** ที่ได้ (หน้าตาแบบ `https://script.google.com/macros/s/AKfycb.../exec`)

### 4. ตั้งค่า Frontend

1. ที่โปรเจกต์นี้ คัดลอก `.env.example` เป็น `.env`
2. ใส่ URL ที่คัดลอกไว้:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
```

3. รัน `npm run dev` แล้วเปิด http://localhost:5173

## ติดตั้งแบบออนไลน์ — ใช้แอปได้ทุกที่ (เสิร์ฟหน้าเว็บจาก Apps Script เลย)

ไม่ต้องมี hosting แยก: build หน้าเว็บทั้งหมดเป็นไฟล์เดียวแล้วให้ Apps Script เสิร์ฟ พร้อม API ตัวเดียวกัน — เปิด URL เดียวจบทั้งแอปและข้อมูล

### 1. Build ชุดไฟล์สำหรับ GAS

```bash
npm run build:gas
```

ได้โฟลเดอร์ `gas-app/` 3 ไฟล์:
- `Code.gs` — backend (คัดลอกจาก apps-script/Code.gs)
- `Index.html` — หน้าเว็บทั้งแอปรวมเป็นไฟล์เดียว (inline CSS/JS แล้ว)
- `appsscript.json` — manifest (timezone, สิทธิ์ web app)

> ⚠ ตรวจว่า `.env` มี `VITE_APPS_SCRIPT_URL` เป็น URL ของ **deployment นี้** ก่อน build เพราะ URL จะถูกฝังในไฟล์ที่ build แล้ว

### 2. วางไฟล์ใน Apps Script

1. เปิด Google Sheet → **Extensions → Apps Script**
2. **Code.gs**: ลบโค้ดเดิม วางเนื้อหาจาก `gas-app/Code.gs`
3. **Index.html**: กด **+ (ไฟล์ใหม่) → HTML** ตั้งชื่อไฟล์ว่า `Index` (ไม่ต้องพิมพ์ .html) แล้ววางเนื้อหาจาก `gas-app/Index.html`
4. **appsscript.json**: กดรูปเฟือง **Project Settings** → ติ๊ก **Show "appsscript.json" manifest file in editor** แล้ววางเนื้อหาจาก `gas-app/appsscript.json`
   (ถ้าไม่ตั้งก็ได้ — ค่า default ใช้ได้ แต่ timezone อาจเป็น UTC ทำให้วันที่เพี้ยน)

### 3. Deploy

เหมือนหัวข้อ "Deploy เป็น Web App" ด้านบน (Execute as: **Me**, Who has access: **Anyone**)

### 4. เปิดใช้งาน

เปิด Web app URL (`.../exec`) ตรงๆ ในเบราว์เซอร์ — จะเห็นหน้าเว็บแอปเลย ใช้ได้ทั้งมือถือและคอม โดยไม่ต้องรัน `npm run dev`
- เมนูในแอปจะเป็นรูปแบบ `#/trades`, `#/backtests` (HashRouter) เพื่อให้รีเฟรชหน้าที่ไหนก็ได้ไม่ 404

### อัปเดตเวอร์ชันออนไลน์ภายหลัง

1. แก้โค้ด → `npm run build:gas`
2. วาง `Index.html` (และ `Code.gs` ถ้าแก้) ทับของเดิมใน Apps Script editor
3. **Deploy → Manage deployments → deployment เดิม → Edit → Version: New version → Deploy** (URL เดิมไม่เปลี่ยน)

## โครงสร้างข้อมูล

แอปจะสร้างแท็บชื่อ **Trades** ในชีตให้อัตโนมัติเมื่อบันทึกเทรดแรก (หรือเปิด `?action=list` ครั้งแรก) พร้อมรูปและรูป chart จะเก็บในโฟลเดอร์ **Trade Journal Images** บน Google Drive ของคุณ

คุณสามารถแก้ไขข้อมูลในชีตโดยตรงได้ แต่**ห้ามแก้ลำดับคอลัมน์** (A–P) เพราะแอปอ้างอิงตำแหน่งคอลัมน์ตามที่กำหนดใน `Code.gs`

## อัปเดตโค้ดภายหลัง

หากแก้ไข `Code.gs` (รวมถึงการเพิ่มฟีเจอร์ปฏิทินข่าว ForexFactory):

1. วางโค้ดใหม่ลงใน Apps Script editor แล้วบันทึก
2. กด **Deploy → Manage deployments → เลือก deployment เดิม → Edit (รูปดินสอ) → Version: New version → Deploy**
   (อย่าสร้าง deployment ใหม่ ไม่งั้น URL จะเปลี่ยน)

> หมายเหตุ: ปฏิทินข่าวในเว็บแอปดึงข้อมูลจาก feed ทางการของ ForexFactory (faireconomy.media) ผ่านสคริปต์นี้ พร้อม cache 10 นาที — ต้อง redeploy ตามขั้นตอนด้านบนจึงจะใช้งานได้

## แก้ปัญหาที่พบบ่อย

| ปัญหา | วิธีแก้ |
|---|---|
| หน้าเว็บบอก "ยังไม่ได้ตั้งค่า API" | ตรวจว่า `.env` มี `VITE_APPS_SCRIPT_URL` และ restart dev server (`npm run dev` ใหม่) |
| กดปุ่มแล้ว error / โหลดไม่ได้ | เปิด Web app URL ตรงๆ ในเบราว์เซอร์ ถ้าขึ้น `{"ok":true,...}` แปลว่า backend ปกติ — ลอง redeploy เป็น New version |
| สิทธิ์ (authorization) ผิดพลาด | Deploy ต้องตั้ง Execute as = **Me** และ Who has access = **Anyone** |
| รูปไม่แสดง | รูปต้อง share เป็น "Anyone with the link" — สคริปต์ทำให้อัตโนมัติแล้ว ลองอัปโหลดใหม่ |
