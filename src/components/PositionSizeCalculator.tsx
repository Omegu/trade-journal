import { useEffect, useMemo, useState } from "react";
import { Calculator, Bitcoin, CandlestickChart, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calcCfdSize,
  calcCryptoSize,
  CFD_PRESETS,
  fetchQuoteRate,
  quoteCurrencyOf,
} from "@/lib/positionSize";
import { loadSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/stats";
import { cn } from "@/lib/utils";

interface PositionSizeCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SlUnit = "price" | "pips";

const CUSTOM = "__custom__";

export default function PositionSizeCalculator({ open, onOpenChange }: PositionSizeCalculatorProps) {
  // ค่าร่วมสองแท็บ
  const [balance, setBalance] = useState("");
  const [riskPercent, setRiskPercent] = useState("1");
  // crypto
  const [cryptoEntry, setCryptoEntry] = useState("");
  const [cryptoSl, setCryptoSl] = useState("");
  // cfd
  const [presetSymbol, setPresetSymbol] = useState<string>("XAUUSD");
  const [contractSize, setContractSize] = useState("100");
  const [pipSize, setPipSize] = useState("0.1");
  const [slUnit, setSlUnit] = useState<SlUnit>("price");
  const [cfdEntry, setCfdEntry] = useState("");
  const [cfdSl, setCfdSl] = useState("");
  const [quoteRate, setQuoteRate] = useState("1");
  const [rateStatus, setRateStatus] = useState<"idle" | "fetching" | "ok" | "failed">("idle");

  const preset = CFD_PRESETS.find((p) => p.symbol === presetSymbol);

  // prefill ยอดบัญชี/ความเสี่ยงจาก settings เมื่อเปิด หรือเมื่อมีการบันทึก settings ขณะเปิดอยู่
  useEffect(() => {
    const apply = () => {
      const s = loadSettings();
      if (s.capital) setBalance(String(s.capital));
      if (s.riskPercent) setRiskPercent(String(s.riskPercent));
    };
    if (open) apply();
    window.addEventListener("tj-settings-changed", apply);
    return () => window.removeEventListener("tj-settings-changed", apply);
  }, [open]);

  // เลือก preset → auto-fill contract/pip และดึงอัตรา quote ถ้าไม่ใช่ USD
  useEffect(() => {
    if (presetSymbol === CUSTOM || !preset) return;
    setContractSize(String(preset.contractSize));
    setPipSize(String(preset.pipSize));
  }, [presetSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const quote = presetSymbol === CUSTOM ? null : quoteCurrencyOf(presetSymbol);
  const needsRate = quote !== null && quote !== "USD";

  useEffect(() => {
    if (!needsRate || !quote) return;
    let cancelled = false;
    setRateStatus("fetching");
    fetchQuoteRate(quote).then((rate) => {
      if (cancelled) return;
      if (rate) {
        setQuoteRate(String(Number(rate.toFixed(6))));
        setRateStatus("ok");
      } else {
        setRateStatus("failed");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [quote, needsRate]);

  const n = (v: string) => parseFloat(v) || 0;

  const sharedBalanceError = n(balance) <= 0 ? "กรุณากรอกยอดเงินในบัญชี" : null;
  const sharedRiskError =
    n(riskPercent) <= 0 || n(riskPercent) > 100 ? "ความเสี่ยงต้องอยู่ระหว่าง 0–100%" : null;

  const crypto = useMemo(
    () =>
      calcCryptoSize({
        balance: n(balance),
        riskPercent: n(riskPercent),
        entry: n(cryptoEntry),
        stopLoss: n(cryptoSl),
      }),
    [balance, riskPercent, cryptoEntry, cryptoSl]
  );

  const cfd = useMemo(
    () =>
      calcCfdSize({
        balance: n(balance),
        riskPercent: n(riskPercent),
        contractSize: n(contractSize),
        pipSize: n(pipSize),
        slUnit,
        slValue: n(cfdSl),
        quoteRate: n(quoteRate),
      }),
    [balance, riskPercent, contractSize, pipSize, slUnit, cfdSl, quoteRate]
  );

  const cfdError =
    sharedBalanceError ??
    sharedRiskError ??
    (n(contractSize) <= 0
      ? "กรุณากรอกขนาดสัญญา (Contract Size)"
      : n(pipSize) <= 0
      ? "กรุณากรอกขนาด pip (Pip Size)"
      : n(cfdSl) <= 0
      ? slUnit === "pips"
        ? "กรุณากรอก Stop Loss (pips)"
        : "กรุณากรอก Stop Loss"
      : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-5" />
            เครื่องคำนวณ Position Size
          </DialogTitle>
          <DialogDescription>
            คำนวณขนาด position จากยอดเงินที่ยอมเสี่ยง (สมมติบัญชี USD)
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="crypto">
          <TabsList className="w-full">
            <TabsTrigger value="crypto">
              <Bitcoin />
              Crypto
            </TabsTrigger>
            <TabsTrigger value="cfd">
              <CandlestickChart />
              CFD / Forex
            </TabsTrigger>
          </TabsList>

          {/* ---------- Crypto ---------- */}
          <TabsContent value="crypto" className="grid gap-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ps-balance">ยอดเงินในบัญชี ($)</Label>
                <Input
                  id="ps-balance"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="10000"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ps-risk">ความเสี่ยงต่อเทรด (%)</Label>
                <Input
                  id="ps-risk"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ps-entry">ราคาเข้า</Label>
                <Input
                  id="ps-entry"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="60000"
                  value={cryptoEntry}
                  onChange={(e) => setCryptoEntry(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ps-sl">Stop Loss</Label>
                <Input
                  id="ps-sl"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="58000"
                  value={cryptoSl}
                  onChange={(e) => setCryptoSl(e.target.value)}
                />
              </div>
            </div>
            <ResultArea error={sharedBalanceError ?? sharedRiskError ?? (n(cryptoEntry) <= 0 ? "กรุณากรอกราคาเข้า" : n(cryptoSl) <= 0 ? "กรุณากรอก Stop Loss" : null)}>
              {crypto && (
                <ResultGrid
                  main={{ label: "จำนวนเหรียญที่ควรซื้อ", value: formatUnits(crypto.units) }}
                  direction={crypto.direction}
                  rows={[
                    ["ยอดเสี่ยง", formatMoney(crypto.riskAmount)],
                    ["ระยะ SL", crypto.distance.toLocaleString("en-US")],
                    ["มูลค่า position", formatMoney(crypto.positionValue)],
                  ]}
                />
              )}
            </ResultArea>
          </TabsContent>

          {/* ---------- CFD / Forex ---------- */}
          <TabsContent value="cfd" className="grid gap-4 pt-2">
            <div className="grid gap-2">
              <Label>สินทรัพย์ (Preset)</Label>
              <Select
                value={presetSymbol}
                onValueChange={(v) => {
                  setPresetSymbol(v);
                  if (v === CUSTOM) setQuoteRate("1");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="เลือกสินทรัพย์" />
                </SelectTrigger>
                <SelectContent>
                  {CFD_PRESETS.map((p) => (
                    <SelectItem key={p.symbol} value={p.symbol}>
                      {p.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM}>กำหนดเอง</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ps-balance-cfd">ยอดเงินในบัญชี ($)</Label>
                <Input
                  id="ps-balance-cfd"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="10000"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ps-risk-cfd">ความเสี่ยงต่อเทรด (%)</Label>
                <Input
                  id="ps-risk-cfd"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contractSize">ขนาดสัญญาต่อ 1 lot</Label>
                <Input
                  id="contractSize"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="เช่น 100, 100000"
                  value={contractSize}
                  onChange={(e) => setContractSize(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pipSize">ขนาด 1 pip (ราคา)</Label>
                <Input
                  id="pipSize"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="เช่น 0.1, 0.0001"
                  value={pipSize}
                  onChange={(e) => setPipSize(e.target.value)}
                />
              </div>
            </div>
            <p className="text-muted-foreground -mt-2 text-xs">
              ค่า default มาจาก MT5 มาตรฐาน (ทอง = 100 oz, forex = 100,000) — ดูจาก spec โบรกเกอร์แล้วแก้ได้
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>หน่วยของ Stop Loss</Label>
                <Select value={slUnit} onValueChange={(v) => setSlUnit(v as SlUnit)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">ระยะราคา ($)</SelectItem>
                    <SelectItem value="pips">Pips</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {slUnit === "price" ? (
                <div className="grid gap-2">
                  <Label htmlFor="cfdSl">Stop Loss (ราคา)</Label>
                  <Input
                    id="cfdSl"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="2390"
                    value={cfdSl}
                    onChange={(e) => setCfdSl(e.target.value)}
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="cfdSlPips">Stop Loss (pips)</Label>
                  <Input
                    id="cfdSlPips"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="100"
                    value={cfdSl}
                    onChange={(e) => setCfdSl(e.target.value)}
                  />
                </div>
              )}
            </div>

            {slUnit === "price" && (
              <div className="grid gap-2">
                <Label htmlFor="cfdEntry">ราคาเข้า (ใช้หาทิศทาง)</Label>
                <Input
                  id="cfdEntry"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="2400"
                  value={cfdEntry}
                  onChange={(e) => setCfdEntry(e.target.value)}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="quoteRate">
                อัตรา quote → USD
                {quote && needsRate && (
                  <span className="text-muted-foreground font-normal">
                    ({presetSymbol} quote เป็น {quote})
                  </span>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="quoteRate"
                  type="number"
                  step="any"
                  min="0"
                  value={quoteRate}
                  onChange={(e) => setQuoteRate(e.target.value)}
                />
                {rateStatus === "fetching" && (
                  <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                คู่ที่ quote เป็น USD ใช้ 1 — คู่ JPY เช่น USDJPY ให้ใส่อัตรา USD/JPY (ดึงอัตโนมัติให้
                {rateStatus === "failed" && <span className="text-red-600 dark:text-red-500"> ดึงไม่สำเร็จ กรุณาใส่เอง</span>}
                )
              </p>
            </div>

            <ResultArea error={cfdError}>
              {cfd && (
                <ResultGrid
                  main={{ label: "ขนาด Position (lots)", value: formatLots(cfd.lots) }}
                  direction={
                    slUnit === "price" && n(cfdEntry) > 0
                      ? n(cfdSl) < n(cfdEntry)
                        ? "LONG"
                        : "SHORT"
                      : null
                  }
                  rows={[
                    ["ยอดเสี่ยง", formatMoney(cfd.riskAmount)],
                    ["Pip value ต่อ 1 lot", formatMoney(cfd.pipValueUsd)],
                    ["ระยะ SL", `${cfd.slPips.toLocaleString("en-US")} pips (${cfd.slPriceDistance.toLocaleString("en-US")})`],
                    ["ขาดทุน/1 lot ถ้าโดน SL", formatMoney(cfd.lossPerLot)],
                  ]}
                />
              )}
            </ResultArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ResultArea({
  error,
  children,
}: {
  error: string | null;
  children: React.ReactNode;
}) {
  if (error) {
    return (
      <div className="bg-muted/50 text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
        {error}
      </div>
    );
  }
  return children;
}

function ResultGrid({
  main,
  direction,
  rows,
}: {
  main: { label: string; value: string };
  direction: "LONG" | "SHORT" | null;
  rows: [string, string][];
}) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">{main.label}</span>
        {direction && (
          <Badge
            variant={direction === "LONG" ? "secondary" : "outline"}
            className={cn(direction === "SHORT" && "text-red-600 dark:text-red-500")}
          >
            {direction}
          </Badge>
        )}
      </div>
      <div
        className={cn(
          "mt-1 text-3xl font-bold tabular-nums",
          direction === "LONG" ? "text-green-600 dark:text-green-500" : direction === "SHORT" ? "text-red-600 dark:text-red-500" : ""
        )}
      >
        {main.value}
      </div>
      <div className="mt-3 grid gap-1 border-t pt-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatUnits(units: number): string {
  if (units >= 1000) return units.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (units >= 1) return units.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return units.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function formatLots(lots: number): string {
  return lots.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}
