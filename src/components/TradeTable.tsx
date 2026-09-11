import { ArrowDownRight, ArrowUpRight, Eye, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/stats";
import type { Trade } from "@/lib/types";

interface TradeTableProps {
  trades: Trade[];
  onSelect: (trade: Trade) => void;
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
}

export default function TradeTable({ trades, onSelect, onEdit, onDelete }: TradeTableProps) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>วันที่</TableHead>
            <TableHead>สินทรัพย์</TableHead>
            <TableHead>ทิศทาง</TableHead>
            <TableHead className="text-right">ราคาเข้า</TableHead>
            <TableHead className="text-right">ราคาออก</TableHead>
            <TableHead className="text-right">Lot</TableHead>
            <TableHead>กลยุทธ์</TableHead>
            <TableHead className="text-right">กำไร/ขาดทุน</TableHead>
            <TableHead className="w-28 text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((t) => {
            const pnl = typeof t.pnl === "number" ? t.pnl : parseFloat(t.pnl) || 0;
            const isWin = pnl > 0;
            return (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => onSelect(t)}>
                <TableCell>{t.date}</TableCell>
                <TableCell className="font-medium">{t.symbol}</TableCell>
                <TableCell>
                  <Badge
                    variant={t.direction === "LONG" ? "secondary" : "outline"}
                    className="gap-1"
                  >
                    {t.direction === "LONG" ? (
                      <ArrowUpRight className="text-green-600 dark:text-green-500" />
                    ) : (
                      <ArrowDownRight className="text-red-600 dark:text-red-500" />
                    )}
                    {t.direction}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{t.entryPrice}</TableCell>
                <TableCell className="text-right tabular-nums">{t.exitPrice}</TableCell>
                <TableCell className="text-right tabular-nums">{t.lotSize}</TableCell>
                <TableCell>{t.setup}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    isWin ? "text-green-600 dark:text-green-500" : pnl < 0 ? "text-red-600 dark:text-red-500" : ""
                  )}
                >
                  {formatMoney(pnl)}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => onSelect(t)} aria-label="ดูรายละเอียด">
                    <Eye />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(t)} aria-label="แก้ไข">
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-600"
                    onClick={() => onDelete(t)}
                    aria-label="ลบ"
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
