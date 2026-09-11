import { useState } from "react";
import { Loader2, Upload, X, Target, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadImage, createTrade, updateTrade } from "@/lib/api";
import { calcPnl, contractSizeOf } from "@/lib/positionSize";
import { formatMoney } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { EMOTIONS, type Trade } from "@/lib/types";

interface TradeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade | null; // null = เพิ่มใหม่
  onSaved: () => void;
  sheet?: string; // "Trades" | "Backtests"
}

const emptyTrade: Trade = {
  id: "",
  date: new Date().toISOString().slice(0, 10),
  symbol: "",
  direction: "LONG",
  entryPrice: "",
  exitPrice: "",
  lotSize: "",
  stopLoss: "",
  takeProfit: "",
  pnl: "",
  setup: "",
  emotion: "",
  notes: "",
  imageUrl: "",
  createdAt: "",
  updatedAt: "",
};

export default function TradeForm({ open, onOpenChange, trade, onSaved, sheet = "Trades" }: TradeFormProps) {
  const isEdit = trade !== null;
  const isBacktest = sheet === "Backtests";
  const [form, setForm] = useState<Trade>(trade ?? emptyTrade);
  const [imagePreview, setImagePreview] = useState<string>(trade?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // รีเซ็ตฟอร์มทุกครั้งที่เปิด เพื่อไม่ให้ค่าเก่าค้าง
  const [lastOpen, setLastOpen] = useState(false);
  if (open && !lastOpen) {
    setForm(trade ?? emptyTrade);
    setImagePreview(trade?.imageUrl ?? "");
    setLastOpen(true);
  } else if (!open && lastOpen) {
    setLastOpen(false);
  }

  const set = <K extends keyof Trade>(key: K, value: Trade[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Backtest: คิดกำไร/ขาดทุนอัตโนมัติจาก entry/exit/lot (ไม่ต้องกรอกเอง)
  const livePnl = calcPnl(form);
  const pnlReady = typeof livePnl === "number";
  const contractSize = contractSizeOf(form.symbol);
  const hitTp = form.takeProfit !== "" && form.exitPrice === form.takeProfit;
  const hitSl = form.stopLoss !== "" && form.exitPrice === form.stopLoss;

  function applyResult(which: "tp" | "sl") {
    const price = which === "tp" ? form.takeProfit : form.stopLoss;
    if (price === "") {
      toast.error(which === "tp" ? "กรอก Take Profit ก่อน" : "กรอก Stop Loss ก่อน");
      return;
    }
    set("exitPrice", price);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกิน 5MB กรุณาย่อรูปก่อนอัปโหลด");
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await uploadImage(file.name, base64);
      set("imageUrl", res.imageUrl ?? "");
      setImagePreview(res.imageUrl ?? "");
      toast.success("อัปโหลดรูปสำเร็จ");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.symbol.trim()) {
      toast.error("กรุณากรอกสินทรัพย์ (Symbol)");
      return;
    }
    // Backtest: บังคับให้คำนวณกำไร/ขาดทุนได้ก่อนบันทึก (ไม่รับกรอกเอง)
    if (isBacktest && !pnlReady) {
      toast.error("กรอก ราคาเข้า, ราคาออก และ Lot ให้ครบ เพื่อคำนวณกำไร/ขาดทุน");
      return;
    }
    const payloadTrade: Trade = isBacktest && pnlReady ? { ...form, pnl: livePnl } : form;
    setSaving(true);
    try {
      if (isEdit) {
        await updateTrade(payloadTrade, sheet);
      } else {
        const { id: _id, createdAt: _c, updatedAt: _u, ...payload } = payloadTrade;
        await createTrade(payload as Trade, sheet);
      }
      toast.success(isEdit ? "แก้ไขเรียบร้อย" : "บันทึกเรียบร้อย");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? (isBacktest ? "แก้ไข Backtest" : "แก้ไขเทรด") : isBacktest ? "เพิ่ม Backtest ใหม่" : "เพิ่มเทรดใหม่"}</DialogTitle>
          <DialogDescription>
            กรอกข้อมูลการเทรด (ช่องที่มี * จำเป็นต้องกรอก)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">วันที่ *</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="symbol">สินทรัพย์ (Symbol) *</Label>
              <Input
                id="symbol"
                placeholder="เช่น XAUUSD"
                value={form.symbol}
                onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>ทิศทาง</Label>
              <Select value={form.direction} onValueChange={(v) => set("direction", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LONG">LONG (ซื้อ)</SelectItem>
                  <SelectItem value="SHORT">SHORT (ขาย)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lotSize">Lot / ขนาด</Label>
              <Input
                id="lotSize"
                type="number"
                step="any"
                min="0"
                placeholder="0.10"
                value={form.lotSize}
                onChange={(e) => set("lotSize", castNum(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              {isBacktest ? (
                <>
                  <Label>กำไร/ขาดทุน (คำนวณอัตโนมัติ)</Label>
                  <div
                    className={cn(
                      "flex h-9 items-center rounded-md border px-3 text-sm font-semibold tabular-nums",
                      !pnlReady
                        ? "text-muted-foreground"
                        : livePnl > 0
                          ? "text-green-600 dark:text-green-500"
                          : livePnl < 0
                            ? "text-red-600 dark:text-red-500"
                            : ""
                    )}
                  >
                    {pnlReady ? formatMoney(livePnl) : "รอข้อมูลครบ"}
                  </div>
                </>
              ) : (
                <>
                  <Label htmlFor="pnl">กำไร/ขาดทุน ($) *</Label>
                  <Input
                    id="pnl"
                    type="number"
                    step="any"
                    placeholder="เช่น 150 หรือ -80"
                    value={form.pnl}
                    onChange={(e) => set("pnl", castNum(e.target.value))}
                    required
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="entryPrice">ราคาเข้า</Label>
              <Input
                id="entryPrice"
                type="number"
                step="any"
                value={form.entryPrice}
                onChange={(e) => set("entryPrice", castNum(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exitPrice">ราคาออก</Label>
              <Input
                id="exitPrice"
                type="number"
                step="any"
                value={form.exitPrice}
                onChange={(e) => set("exitPrice", castNum(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="setup">กลยุทธ์ (Setup)</Label>
              <Input
                id="setup"
                placeholder="เช่น Breakout"
                value={form.setup}
                onChange={(e) => set("setup", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="stopLoss">Stop Loss</Label>
              <Input
                id="stopLoss"
                type="number"
                step="any"
                value={form.stopLoss}
                onChange={(e) => set("stopLoss", castNum(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="takeProfit">Take Profit</Label>
              <Input
                id="takeProfit"
                type="number"
                step="any"
                value={form.takeProfit}
                onChange={(e) => set("takeProfit", castNum(e.target.value))}
              />
            </div>
            {!isBacktest && (
              <div className="grid gap-2">
                <Label>อารมณ์ตอนเทรด</Label>
                <Select value={form.emotion} onValueChange={(v) => set("emotion", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOTIONS.map((emo) => (
                      <SelectItem key={emo} value={emo}>
                        {emo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isBacktest && (
            <div className="grid gap-2">
              <Label>ผลลัพธ์การทดสอบ</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={hitTp ? "default" : "outline"}
                  onClick={() => applyResult("tp")}
                >
                  <Target />
                  โดน TP{form.takeProfit !== "" ? ` (${form.takeProfit})` : ""}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={hitSl ? "default" : "outline"}
                  onClick={() => applyResult("sl")}
                >
                  <ShieldAlert />
                  โดน SL{form.stopLoss !== "" ? ` (${form.stopLoss})` : ""}
                </Button>
                <span className="text-muted-foreground text-xs">
                  กดแล้วตั้งราคาออกให้ — กำไร/ขาดทุนคิดจาก {form.symbol || "symbol"} (1 lot = {contractSize.toLocaleString()} units)
                </span>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="notes">บันทึกบทเรียน / เหตุผลการเข้า</Label>
            <Textarea
              id="notes"
              placeholder="เหตุผลที่เข้าเทรด, สิ่งที่ทำได้ดี, สิ่งที่ควรปรับปรุง..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>{isBacktest ? "รูป Position (chart ตอนเข้าเทรด)" : "รูป Chart"}</Label>
            {imagePreview ? (
              <div className="relative w-fit">
                <img
                  src={imagePreview}
                  alt="chart preview"
                  referrerPolicy="no-referrer"
                  className="max-h-40 rounded-md border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 size-6"
                  onClick={() => {
                    setImagePreview("");
                    set("imageUrl", "");
                  }}
                  aria-label="ลบรูป"
                >
                  <X />
                </Button>
              </div>
            ) : (
              <label className="border-input hover:bg-accent/50 flex h-20 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground">
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" /> กำลังอัปโหลด...
                  </>
                ) : (
                  <>
                    <Upload /> กดเพื่อเลือกรูป (สูงสุด 5MB)
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving && <Loader2 className="animate-spin" />}
              {isEdit ? "บันทึกการแก้ไข" : "เพิ่มเทรด"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function castNum(v: string): number | "" {
  if (v === "") return "";
  const n = parseFloat(v);
  return isNaN(n) ? "" : n;
}
