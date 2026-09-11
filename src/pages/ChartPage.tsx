import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import TradingViewChart from "@/components/TradingViewChart";
import { cn } from "@/lib/utils";

const POPULAR_SYMBOLS = [
  { label: "ทองคำ", symbol: "OANDA:XAUUSD" },
  { label: "เงิน", symbol: "OANDA:XAGUSD" },
  { label: "BTC", symbol: "BINANCE:BTCUSDT" },
  { label: "ETH", symbol: "BINANCE:ETHUSDT" },
  { label: "EURUSD", symbol: "OANDA:EURUSD" },
  { label: "USDJPY", symbol: "OANDA:USDJPY" },
  { label: "US30", symbol: "CAPITALCOM:US30" },
  { label: "NAS100", symbol: "CAPITALCOM:US100" },
  { label: "น้ำมัน", symbol: "TVC:USOIL" },
];

const INTERVALS = [
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
];

export default function ChartPage() {
  const [symbolInput, setSymbolInput] = useState("OANDA:XAUUSD");
  const [symbol, setSymbol] = useState("OANDA:XAUUSD");
  const [interval, setIntervalValue] = useState("60");
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains("dark"));

  // sync ธีมตาม html.dark (สลับธีมที่ header ได้ตลอด)
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (symbolInput.trim()) setSymbol(symbolInput.trim().toUpperCase());
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">กราฟ</h1>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            className="w-56"
            placeholder="เช่น OANDA:XAUUSD"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            aria-label="Symbol"
          />
          <button type="submit" className="sr-only">
            โหลด
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-1">
          {POPULAR_SYMBOLS.map((s) => (
            <button
              key={s.symbol}
              onClick={() => {
                setSymbol(s.symbol);
                setSymbolInput(s.symbol);
              }}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer hover:bg-accent",
                symbol === s.symbol && "bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {s.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setIntervalValue(iv.value)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer hover:bg-accent",
                interval === iv.value && "bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border">
        <TradingViewChart symbol={symbol} interval={interval} dark={dark} />
      </div>
    </div>
  );
}
