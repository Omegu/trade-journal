# Trade Journal — วิเคราะห์กราฟ SMC

ระบบวิเคราะห์กราฟด้วย Smart Money Concepts ที่ port กลไกจาก indicator "Smart Money Concepts [LuxAlgo]" ร่วมกับสายพาน 3 subagent (ดึงข้อมูล → วิเคราะห์ → สร้างแผนเทรด) ที่รันใน ZCode แชท

## Language

### โครงสร้างราคา (port จาก LuxAlgo)

**Swing Structure**:
โครงสร้างใหญ่ที่ยืนยันด้วยแท่ง 50 แท่ง (size=50) — ตอบช้าแต่นิยามเทรนด์หลักของ timeframe
_Avoid_: โครงสร้างหลัก, major structure

**Internal Structure**:
โครงสร้าง real-time ยืนยันด้วยแท่ง 5 แท่ง (size=5) — ตอบไว ใช้อ่านจังหวะล่าสุด
_Avoid_: minor structure, micro structure

**BOS** (Break of Structure):
ราคาปิดทะลุระดับ swing ใน**ทิศทางเดียวกับ**เทรนด์ปัจจุบัน — ยืนยันเทรนด์เดิมต่อ
_Avoid_: การทะลุ, breakout (ลอยๆ)

**CHoCH** (Change of Character):
ราคาปิดทะลุระดับ swing ใน**ทิศทางตรงข้าม**กับเทรนด์ปัจจุบัน — สัญญาณเทรนด์อาจพลิก
_Avoid_: reversal, พลิกเทรนด์

**Order Block (OB)**:
แท่งเทียนต้นทางของ impulse ที่ทำให้เกิด BOS/CHoCH (แท่งสวนทางที่แรงสุดในช่วง pivot→break) มีสถานะ active หรือ mitigated (ราคาย้อนกลับมาทะลุแท่งแล้ว)
_Avoid_: demand zone, supply zone (ใช้เมื่อพูดถึงกลุ่ม OB+FVG รวมกัน)

**FVG** (Fair Value Gap):
ช่องว่างราคา 3 แท่งที่ยังไม่ถูกราคาวิ่งทะลุเต็ม (bullish/bearish)
_Avoid_: imbalance, gap (ลอยๆ)

**EQH / EQL** (Equal Highs / Equal Lows):
swing สองจุดขึ้นไปที่ระดับใกล้กัน (< 0.1×ATR200) — liquidity pool ที่ตลาดมักวิ่งมากวาด
_Avoid_: double top, double bottom

**Premium / Discount Zone**:
ตำแหน่งราคาในช่วง trailing extremes ของ timeframe — premium = ครึ่งบนเหนือ equilibrium, discount = ครึ่งล่าง
_Avoid_: overbought/oversold

**Strong / Weak High-Low**:
ป้ายกำกับ trailing extremes ตาม swing trend — bearish → Strong High, bullish → Strong Low (ฝั่งตรงข้ามคือ Weak)

**Sweep**:
แท่งที่ไส้แทงทะลุ swing แต่ปิดกลับ — การกวาด liquidity (stop hunt) ก่อนราคาวิ่งสวนทาง
_Avoid_: stop hunt (ใช้สลับกันได้แต่ sweep เป็นคำ canonical)

### ผลลัพธ์ของสายพาน

**Bias**:
ทิศทางของแผนเทรด (LONG/SHORT/NEUTRAL) ตัดสินด้วยกติกา 3 ขั้น: H4 swing+internal ตรงกัน → ใช้ทิศนั้น | ขัดกัน → ดู H1 | H1 ก็ขัด → NEUTRAL
_Avoid_: เทรนด์ (สงวนไว้เรียกโครงสร้าง swing/internal), ทิศทาง (ลอยๆ)

**Status**:
ENTRY = ราคาอยู่ในโซน entry หรือห่างไม่เกิน 1×ATR ของ TF entry + internal ตรงทิศ Bias + ข้อมูลสด | WAIT = ทุกกรณีอื่น รวมถึงข้อมูลเก่ากว่า 24 ชม.
_Avoid_: สัญญาณเข้า, READY

**Confidence**:
ความมั่นใจ 0-100% ที่ต้องแสดงตารางการคิดคะแนนใน Trade Plan และตัวเลขรวมต้องตรงกับผลรวมจริง
_Avoid_: ความแม่น, ความน่าจะเป็น

**การ์ดแผนเทรด** (Trade Card):
บล็อกสรุปสุดท้ายที่ trade-analysis-agent คืน: Bias / Entry / SL / TP1 / TP2 / RR / Confidence / Status
_Avoid_: ผลวิเคราะห์ (คลุมเครือ — ครอบคลุม report ด้วย)

**Structure Report**:
ไฟล์ analysis/<SYMBOL>-report.md ที่ chart-analysis-agent เขียน — โครงสร้าง+โซน โดย**ไม่ตัดสิน** Bias
_Avoid_: แผนเทรด (สงวนไว้เรียก Trade Plan)

**Trade Plan**:
ไฟล์ analysis/<SYMBOL>-plan.md ที่ trade-analysis-agent เขียน — ตัดสินใจเทรดทั้งหมด
_Avoid_: รายงาน
