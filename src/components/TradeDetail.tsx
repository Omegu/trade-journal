import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { Trade } from "@/lib/types";

interface TradeDetailProps {
  trade: Trade | null;
  onOpenChange: (open: boolean) => void;
}

export default function TradeDetail({ trade, onOpenChange }: TradeDetailProps) {
  if (!trade) return null;
  const pnl = typeof trade.pnl === "number" ? trade.pnl : parseFloat(trade.pnl) || 0;
  const isWin = pnl > 0;

  return (
    <Dialog open={trade !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {trade.symbol}
            <Badge variant="outline" className="gap-1">
              {trade.direction === "LONG" ? (
                <ArrowUpRight className="text-green-600 dark:text-green-500" />
              ) : (
                <ArrowDownRight className="text-red-600 dark:text-red-500" />
              )}
              {trade.direction}
            </Badge>
            <Badge variant={isWin ? "secondary" : "destructive"} className={cn(!isWin && pnl === 0 && "bg-muted text-muted-foreground")}>
              {formatMoney(pnl)}
            </Badge>
          </DialogTitle>
          <DialogDescription>เทรดวันที่ {trade.date}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <Field label="ราคาเข้า" value={String(trade.entryPrice)} />
          <Field label="ราคาออก" value={String(trade.exitPrice)} />
          <Field label="Lot / ขนาด" value={String(trade.lotSize)} />
          <Field label="Stop Loss" value={String(trade.stopLoss)} />
          <Field label="Take Profit" value={String(trade.takeProfit)} />
          <Field label="กลยุทธ์" value={trade.setup} />
        </div>

        {(trade.emotion || trade.notes) && (
          <>
            <Separator />
            {trade.emotion && (
              <div>
                <div className="text-muted-foreground mb-1 text-xs">อารมณ์ตอนเทรด</div>
                <Badge variant="outline">{trade.emotion}</Badge>
              </div>
            )}
            {trade.notes && (
              <div>
                <div className="text-muted-foreground mb-1 text-xs">บันทึกบทเรียน</div>
                <p className="text-sm whitespace-pre-wrap">{trade.notes}</p>
              </div>
            )}
          </>
        )}

        {trade.imageUrl && (
          <>
            <Separator />
            <img
              src={trade.imageUrl}
              alt={`chart ${trade.symbol} ${trade.date}`}
              referrerPolicy="no-referrer"
              className="w-full rounded-md border"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-medium">{value || "-"}</div>
    </div>
  );
}
