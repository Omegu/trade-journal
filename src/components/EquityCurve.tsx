import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/lib/stats";

export default function EquityCurve({ data }: { data: EquityPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        ยังไม่มีข้อมูลเทรด
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis
          dataKey="index"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v: number) => `$${v}`}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--popover-foreground)",
          }}
          labelFormatter={(label) => `เทรดที่ ${label}`}
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Equity"]}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#equityFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
