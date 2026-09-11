import { useMemo, useState } from "react";
import { Calculator, Plus, Search, Target, TrendingUp, Trophy, Percent } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StatCard from "@/components/StatCard";
import TradeDetail from "@/components/TradeDetail";
import TradeForm from "@/components/TradeForm";
import TradeTable from "@/components/TradeTable";
import PositionSizeCalculator from "@/components/PositionSizeCalculator";
import { useTrades } from "@/hooks/useTrades";
import { deleteTrade } from "@/lib/api";
import { computeStats, formatMoney, setupStats } from "@/lib/stats";
import type { Trade } from "@/lib/types";

interface TradesPageProps {
  sheet?: string; // "Trades" | "Backtests"
  backtest?: boolean;
}

export default function Trades({ sheet = "Trades", backtest = false }: TradesPageProps) {
  const { trades, loading, error, isConfigured, refresh } = useTrades(sheet);

  const [formOpen, setFormOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [detailTrade, setDetailTrade] = useState<Trade | null>(null);
  const [deletingTrade, setDeletingTrade] = useState<Trade | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [symbolFilter, setSymbolFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const stats = useMemo(() => computeStats(trades), [trades]);
  const setups = useMemo(() => (backtest ? setupStats(trades) : []), [backtest, trades]);

  const unit = backtest ? "ไม้" : "เทรด";

  const symbols = useMemo(
    () => [...new Set(trades.map((t) => t.symbol))].sort(),
    [trades]
  );

  const filtered = useMemo(
    () =>
      trades.filter((t) => {
        if (symbolFilter !== "all" && t.symbol !== symbolFilter) return false;
        if (directionFilter !== "all" && t.direction !== directionFilter) return false;
        if (fromDate && String(t.date) < fromDate) return false;
        if (toDate && String(t.date) > toDate) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = `${t.symbol} ${t.setup} ${t.notes} ${t.emotion}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [trades, search, symbolFilter, directionFilter, fromDate, toDate]
  );

  const hasFilters =
    search !== "" || symbolFilter !== "all" || directionFilter !== "all" || fromDate !== "" || toDate !== "";

  if (!isConfigured) {
    return (
      <div className="text-muted-foreground mt-10 text-center text-sm">
        ยังไม่ได้ตั้งค่า VITE_APPS_SCRIPT_URL — ดูวิธีตั้งค่าใน <code className="bg-muted rounded px-1">apps-script/README.md</code>
      </div>
    );
  }

  function openAdd() {
    setEditingTrade(null);
    setFormOpen(true);
  }

  function openEdit(trade: Trade) {
    setEditingTrade(trade);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deletingTrade) return;
    setDeleting(true);
    try {
      await deleteTrade(deletingTrade.id, sheet);
      toast.success("ลบเรียบร้อย");
      setDeletingTrade(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{backtest ? "Backtest" : "บันทึกเทรด"}</h1>
          <p className="text-muted-foreground text-sm">
            ทั้งหมด {trades.length} {unit}{hasFilters ? ` • แสดง ${filtered.length} รายการ` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCalcOpen(true)}>
            <Calculator />
            เครื่องคำนวณ
          </Button>
          <Button onClick={openAdd}>
            <Plus />
            {backtest ? "เพิ่ม Backtest" : "เพิ่มเทรด"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          โหลดข้อมูลไม่สำเร็จ: {error}
          {error.includes("Unknown sheet") && " — ต้องอัปเดต Apps Script (Deploy → Manage deployments → New version) ก่อน ดู apps-script/README.md"}
          <Button variant="outline" size="sm" className="ml-3" onClick={refresh}>
            ลองใหม่
          </Button>
        </div>
      )}

      {/* สรุปสถิติ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`ชนะ ${stats.wins} / แพ้ ${stats.losses}`}
          icon={<Percent className="text-muted-foreground size-5" />}
        />
        <StatCard
          title={backtest ? "กำไรรวม (ทดสอบ)" : "กำไรสุทธิ"}
          value={formatMoney(stats.netPnl)}
          tone={stats.netPnl > 0 ? "profit" : stats.netPnl < 0 ? "loss" : "default"}
          icon={<TrendingUp className="text-muted-foreground size-5" />}
        />
        <StatCard
          title="Profit Factor"
          value={stats.profitFactor === null ? "—" : stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
          sub={stats.avgWin > 0 ? `กำไรเฉลี่ย ${formatMoney(stats.avgWin)}` : undefined}
          icon={<Trophy className="text-muted-foreground size-5" />}
        />
        <StatCard
          title={backtest ? "จำนวนไม้ทดสอบ" : "จำนวนเทรด"}
          value={String(stats.totalTrades)}
          sub={stats.totalTrades > 0 ? `เฉลี่ย ${formatMoney(stats.netPnl / stats.totalTrades)} ต่อไม้` : undefined}
          icon={<Target className="text-muted-foreground size-5" />}
        />
      </div>

      {/* Winrate แยกตามกลยุทธ์ (เฉพาะ Backtest) */}
      {backtest && setups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Winrate แยกตามกลยุทธ์</CardTitle>
            <CardDescription>กลยุทธ์ไหนชนะบ่อยและกำไรดี — นั่นคือตัวเลือกสำหรับเทรดจริง</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>กลยุทธ์ (Setup)</TableHead>
                  <TableHead className="text-right">จำนวนไม้</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead className="text-right">ชนะ/แพ้</TableHead>
                  <TableHead className="text-right">กำไรรวม</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {setups.map((s) => (
                  <TableRow key={s.setup}>
                    <TableCell className="font-medium">{s.setup}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.total}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          s.winRate >= 50
                            ? "text-green-600 dark:text-green-500"
                            : "text-red-600 dark:text-red-500"
                        }
                      >
                        {s.winRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {s.wins}/{s.total - s.wins}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        s.netPnl > 0 ? "text-green-600 dark:text-green-500" : s.netPnl < 0 ? "text-red-600 dark:text-red-500" : ""
                      }`}
                    >
                      {formatMoney(s.netPnl)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ตัวกรอง</CardTitle>
          <CardDescription>กรองรายการเทรดตามสินทรัพย์ ทิศทาง ช่วงวันที่ หรือค้นหาข้อความ</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="ค้นหา symbol / กลยุทธ์ / บันทึก..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={symbolFilter} onValueChange={setSymbolFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="สินทรัพย์" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">สินทรัพย์ทั้งหมด</SelectItem>
              {symbols.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="ทิศทาง" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทิศทางทั้งหมด</SelectItem>
              <SelectItem value="LONG">LONG</SelectItem>
              <SelectItem value="SHORT">SHORT</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            className="w-40"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="จากวันที่"
          />
          <span className="text-muted-foreground text-sm">ถึง</span>
          <Input
            type="date"
            className="w-40"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="ถึงวันที่"
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setSymbolFilter("all");
                setDirectionFilter("all");
                setFromDate("");
                setToDate("");
              }}
            >
              ล้างตัวกรอง
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center">
            {trades.length === 0 ? (
              <>
                <p>{backtest ? "ยังไม่มีรายการ Backtest" : "ยังไม่มีรายการเทรด"}</p>
                <Button onClick={openAdd} size="sm">
                  <Plus />
                  {backtest ? "เพิ่ม Backtest แรกของคุณ" : "เพิ่มเทรดแรกของคุณ"}
                </Button>
              </>
            ) : (
              <p>ไม่พบรายการที่ตรงกับตัวกรอง</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <TradeTable
          trades={filtered}
          onSelect={setDetailTrade}
          onEdit={openEdit}
          onDelete={setDeletingTrade}
        />
      )}

      <TradeForm open={formOpen} onOpenChange={setFormOpen} trade={editingTrade} onSaved={refresh} sheet={sheet} />

      <PositionSizeCalculator open={calcOpen} onOpenChange={setCalcOpen} />

      <TradeDetail trade={detailTrade} onOpenChange={(open) => !open && setDetailTrade(null)} />

      <Dialog open={deletingTrade !== null} onOpenChange={(open) => !open && setDeletingTrade(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              ต้องการลบ {backtest ? "Backtest" : "เทรด"} {deletingTrade?.symbol} วันที่ {deletingTrade?.date} ใช่หรือไม่?
              การกระทำนี้ย้อนกลับไม่ได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTrade(null)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "กำลังลบ..." : "ลบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
