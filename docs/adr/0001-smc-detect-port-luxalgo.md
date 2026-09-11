# ตรวจจับโครงสร้างด้วยโค้ด port จาก LuxAlgo, ตัดสินใจด้วย LLM

ระบบวิเคราะห์กราฟ (สายพาน Market-Data → Chart-Analysis → Trade-Analysis) แยกหน้าที่ชัดเจน: การตรวจจับโครงสร้างเชิงกลไก (swing, BOS/CHoCH, OB, FVG, EQH/EQL, premium/discount) ทำด้วยโค้ด JS (`scripts/smc-detect.mjs`) ที่ port ตรงจาก indicator "Smart Money Concepts [LuxAlgo]" (Pine v5) — ไม่ให้ LLM อ่านแท่งเทียนดิบแล้วเดาโครงสร้างเอง ทุกตัวเลขในผลลัพธ์ต้องย้อนไปหาได้จาก `analysis/<SYMBOL>-structure.json`

เหตุผล: LLM นับแท่งเทียน 400 แท่งไม่ได้และมักปลอมตัวเลข — การใช้ LuxAlgo เป็น reference implementation (แทนเขียน heuristic เอง) ทำให้ผลตรวจจับเทียบเคียงกับที่เห็นบน TradingView ได้และตรวจสอบซ้ำได้

ข้อจำกัดที่ยอมรับ: ข้อมูลทอง/ฟอเร็กซ์ใช้ Yahoo Finance (ดีเลย์ ~15 นาที, ทองใช้ฟิวเจอร์ส GC=F เพราะ Yahoo ถอด ticker สปอต XAUUSD=X) และ crypto ใช้ Binance — ทั้งหมดฟรีไม่ต้องมี API key เหมาะกับการวิเคราะห์โครงสร้าง ไม่ใช่ scalping

Consequences: schema ของ structure.json ผูกกับ system prompt ของ agents ที่ `~/.zcode/agents/` (chart-analysis.md, trade-analysis.md) — เปลี่ยน schema ต้องแก้ agent files คู่กัน
