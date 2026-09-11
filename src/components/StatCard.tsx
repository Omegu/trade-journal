import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  tone?: "default" | "profit" | "loss";
  icon?: React.ReactNode;
}

export default function StatCard({ title, value, sub, tone = "default", icon }: StatCardProps) {
  return (
    <div className="bg-card text-card-foreground flex flex-col gap-1 rounded-xl border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">{title}</span>
        {icon}
      </div>
      <span
        className={cn(
          "text-2xl font-bold tabular-nums",
          tone === "profit" && "text-green-600 dark:text-green-500",
          tone === "loss" && "text-red-600 dark:text-red-500"
        )}
      >
        {value}
      </span>
      {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
    </div>
  );
}
