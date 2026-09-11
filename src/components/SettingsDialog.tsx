import { useEffect, useState } from "react";
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
import { loadSettings, saveSettings } from "@/lib/settings";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export default function SettingsDialog({ open, onOpenChange, onSaved }: SettingsDialogProps) {
  const [capital, setCapital] = useState("");
  const [riskPercent, setRiskPercent] = useState("1");

  useEffect(() => {
    if (!open) return;
    const saved = loadSettings();
    setCapital(saved.capital ? String(saved.capital) : "");
    setRiskPercent(saved.riskPercent ? String(saved.riskPercent) : "1");
  }, [open]);

  function handleSave() {
    const cap = parseFloat(capital);
    const risk = parseFloat(riskPercent);
    if (isNaN(cap) || cap <= 0) {
      toast.error("กรุณากรอกยอดทุนให้ถูกต้อง");
      return;
    }
    if (isNaN(risk) || risk <= 0 || risk > 100) {
      toast.error("ความเสี่ยงต้องอยู่ระหว่าง 0–100%");
      return;
    }
    saveSettings({ capital: cap, riskPercent: risk });
    toast.success("บันทึกการตั้งค่าแล้ว");
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ตั้งค่าทุน</DialogTitle>
          <DialogDescription>
            ใช้ prefill ให้เครื่องคำนวณ Position Size และเป็นจุดเริ่มต้นของ Equity Curve
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="settings-capital">ยอดทุนเริ่มต้น ($)</Label>
            <Input
              id="settings-capital"
              type="number"
              step="any"
              min="0"
              placeholder="10000"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="settings-risk">ความเสี่ยง default ต่อเทรด (%)</Label>
            <Input
              id="settings-risk"
              type="number"
              step="any"
              min="0"
              max="100"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button onClick={handleSave}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
