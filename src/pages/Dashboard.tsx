import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpenText,
  Calculator,
  CircleDollarSign,
  Percent,
  Scale,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import EquityCurve from "@/components/EquityCurve";
import StatCard from "@/components/StatCard";
import PositionSizeCalculator from "@/components/PositionSizeCalculator";
import { useTrades } from "@/hooks/useTrades";
import { computeStats, formatMoney } from "@/lib/stats";
import { loadSettings } from "@/lib/settings";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { trades, loading, error, isConfigured, refresh } = useTrades();
  const [calcOpen, setCalcOpen] = useState(false);
  const [capital, setCapital] = useState<number>(() => loadSettings().capital ?? 0);

  useEffect(() => {
    const apply = () => setCapital(loadSettings().capital ?? 0);
    window.addEventListener("tj-settings-changed", apply);
    return () => window.removeEventListener("tj-settings-changed", apply);
  }, []);

  const stats = useMemo(() => computeStats(trades, capital), [trades, capital]);

  const recent = useMemo(() => trades.slice(0, 5), [trades]);

  if (!isConfigured) return <NotConfigured />;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            สรุปผลการเทรดทั้งหมด{capital > 0 ? ` • ทุนเริ่มต้น ${formatMoney(capital)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCalcOpen(true)}>
            <Calculator />
            เครื่องคำนวณ
          </Button>
          <Button asChild>
            <Link to="/trades">
              <BookOpenText />
              ไปที่บันทึกเทรด
            </Link>
          </Button>
        </div>
      </div>

      <PositionSizeCalculator open={calcOpen} onOpenChange={setCalcOpen} />

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          โหลดข้อมูลไม่สำเร็จ: {error}
          <Button variant="outline" size="sm" className="ml-3" onClick={refresh}>
            ลองใหม่
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="กำไรสุทธิ (Net P/L)"
              value={formatMoney(stats.netPnl)}
              tone={stats.netPnl > 0 ? "profit" : stats.netPnl < 0 ? "loss" : "default"}
              icon={<CircleDollarSign className="text-muted-foreground size-4" />}
              sub={`${stats.totalTrades} เทรด`}
            />
            <StatCard
              title="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
              icon={<Percent className="text-muted-foreground size-4" />}
              sub={`ชนะ ${stats.wins} / แพ้ ${stats.losses} เทรด`}
            />
            <StatCard
              title="Profit Factor"
              value={stats.profitFactor === null ? "-" : stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
              icon={<Scale className="text-muted-foreground size-4" />}
              sub={`Max Drawdown ${formatMoney(-stats.maxDrawdown)}`}
            />
            <StatCard
              title="เทรดดีที่สุด / แย่ที่สุด"
              value={`${stats.bestTrade ? formatMoney(Number(stats.bestTrade.pnl)) : "-"}`}
              icon={<Trophy className="text-muted-foreground size-4" />}
              tone={stats.bestTrade && Number(stats.bestTrade.pnl) > 0 ? "profit" : "default"}
              sub={`แย่ที่สุด ${stats.worstTrade ? formatMoney(Number(stats.worstTrade.pnl)) : "-"}`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Equity Curve</CardTitle>
              <CardDescription>
                {capital > 0 ? `Equity เริ่มจากทุน ${formatMoney(capital)} + กำไรสะสม` : "กำไรสะสมรวมทุกเทรด เรียงตามวันที่"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EquityCurve data={stats.equityCurve} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>เทรดล่าสุด</CardTitle>
              <CardDescription>5 รายการล่าสุด</CardDescription>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <EmptyState />
              ) : (
                <RecentList trades={recent} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function RecentList({ trades }: { trades: Trade[] }) {
  return (
    <div className="divide-y">
      {trades.map((t) => {
        const pnl = Number(t.pnl) || 0;
        return (
          <div key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="text-muted-foreground w-24 tabular-nums">{t.date}</span>
            <span className="w-24 font-medium">{t.symbol}</span>
            <Badge variant={t.direction === "LONG" ? "secondary" : "outline"} className="gap-1">
              {t.direction === "LONG" ? (
                <ArrowUpRight className="text-green-600 dark:text-green-500" />
              ) : (
                <ArrowDownRight className="text-red-600 dark:text-red-500" />
              )}
              {t.direction}
            </Badge>
            {t.setup && <span className="text-muted-foreground hidden sm:inline">{t.setup}</span>}
            <span
              className={cn(
                "ml-auto font-semibold tabular-nums",
                pnl > 0 ? "text-green-600 dark:text-green-500" : pnl < 0 ? "text-red-600 dark:text-red-500" : ""
              )}
            >
              {formatMoney(pnl)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 py-10 text-center">
      <BookOpenText className="size-10 opacity-40" />
      <p>ยังไม่มีรายการเทรด</p>
      <Button asChild size="sm">
        <Link to="/trades">เพิ่มเทรดแรกของคุณ</Link>
      </Button>
    </div>
  );
}

function NotConfigured() {
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <CardHeader>
        <CardTitle>ยังไม่ได้ตั้งค่า Google Sheets API</CardTitle>
        <CardDescription>
          แอปนี้เก็บข้อมูลผ่าน Google Apps Script ที่ผูกกับ Google Sheet ของคุณ
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <ol className="list-decimal space-y-2 pl-5">
          <li>สร้าง Google Sheet แล้ววางโค้ดจาก <code className="bg-muted rounded px-1">apps-script/Code.gs</code></li>
          <li>Deploy เป็น Web App (Execute as: Me, Access: Anyone)</li>
          <li>คัดลอก Web app URL มาใส่ในไฟล์ <code className="bg-muted rounded px-1">.env</code> ที่ชื่อ <code className="bg-muted rounded px-1">VITE_APPS_SCRIPT_URL</code></li>
          <li>รีสตาร์ท dev server แล้วรีเฟรชหน้านี้</li>
        </ol>
        <p className="text-muted-foreground mt-4">
          ดูขั้นตอนละเอียดได้ในไฟล์ <code className="bg-muted rounded px-1">apps-script/README.md</code>
        </p>
      </CardContent>
    </Card>
  );
}
