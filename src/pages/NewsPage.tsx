import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCalendar, fetchNews } from "@/lib/api";
import {
  CURRENCIES,
  formatTimeTh,
  groupByDay,
  impactStyle,
  newsAge,
  newsDayTh,
  newsTimeTh,
  type CalendarEvent,
  type Impact,
} from "@/lib/news";
import type { NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const IMPACT_FILTERS: Impact[] = ["High", "Medium", "Low", "Holiday"];

// สีของชิปกรองตามระดับความอันตรายต่อทุน: High=แดงเข้ม, Medium=ส้ม, Low=เทา, Holiday=ฟ้า
const IMPACT_CHIP_ACTIVE: Record<string, string> = {
  High: "bg-red-600 text-white hover:bg-red-600 border-red-600",
  Medium: "bg-orange-500 text-white hover:bg-orange-500 border-orange-500",
  Low: "bg-primary text-primary-foreground hover:bg-primary",
  Holiday: "bg-sky-500 text-white hover:bg-sky-500 border-sky-500",
};
const IMPACT_CHIP_INACTIVE: Record<string, string> = {
  High: "border-red-300 text-red-600 dark:border-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950",
  Medium:
    "border-orange-300 text-orange-600 dark:border-orange-800 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950",
  Low: "",
  Holiday:
    "border-sky-300 text-sky-600 dark:border-sky-800 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950",
};

export default function NewsPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);

  const [weekFilter, setWeekFilter] = useState<"this" | "next" | "all">("this");
  const [impactFilter, setImpactFilter] = useState<Impact[]>([...IMPACT_FILTERS]);
  const [currencyFilter, setCurrencyFilter] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await fetchCalendar());
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดปฏิทินข่าวไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError(null);
    try {
      setNewsItems(await fetchNews());
    } catch (err) {
      setNewsError(err instanceof Error ? err.message : "โหลดข่าวไม่สำเร็จ");
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadNews();
  }, [load, loadNews]);

  const filtered = useMemo(() => {
    const monday = getMonday(new Date());
    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);

    return events
      .filter((ev) => {
        if (weekFilter !== "all") {
          const d = new Date(ev.date);
          if (isNaN(d.getTime())) return false;
          if (weekFilter === "this" && d >= nextMonday) return false;
          if (weekFilter === "next" && d < nextMonday) return false;
        }
        if (impactFilter.length > 0 && impactFilter.length < IMPACT_FILTERS.length) {
          if (!impactFilter.includes(ev.impact as Impact)) return false;
        }
        if (currencyFilter.length > 0 && !currencyFilter.includes(ev.country)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, weekFilter, impactFilter, currencyFilter]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  // แท็บวัน — default เป็นวันนี้ (ถ้ามี) ไม่งั้นเลือกวันแรก
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  useEffect(() => {
    if (groups.length === 0) {
      setSelectedDay(null);
      return;
    }
    if (groups.some(([k]) => k === selectedDay)) return;
    const today = new Date().toLocaleDateString("sv-SE");
    setSelectedDay(groups.some(([k]) => k === today) ? today : groups[0][0]);
  }, [groups, selectedDay]);

  const dayEvents = useMemo(
    () => groups.find(([k]) => k === selectedDay)?.[1] ?? [],
    [groups, selectedDay]
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Newspaper className="size-6" />
            ข่าว & ปฏิทินเศรษฐกิจ
          </h1>
          <p className="text-muted-foreground text-sm">
            ปฏิทินข่าวจาก{" "}
            <a
              href="https://www.forexfactory.com/calendar"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              ForexFactory
            </a>{" "}
            (เวลาไทย) + ข่าวจาก TradingView
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            load();
            loadNews();
          }}
          disabled={loading || newsLoading}
        >
          <RefreshCw className={cn((loading || newsLoading) && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      {/* ตัวกรอง */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-1">
          {(
            [
              ["this", "สัปดาห์นี้"],
              ["next", "สัปดาห์หน้า"],
              ["all", "ทั้งหมด"],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} active={weekFilter === value} onClick={() => setWeekFilter(value)}>
              {label}
            </Chip>
          ))}
        </div>
        <span className="h-5 w-px bg-border" />
        <div className="flex flex-wrap items-center gap-1">
          {IMPACT_FILTERS.map((imp) => (
            <Chip
              key={imp}
              active={impactFilter.includes(imp)}
              onClick={() =>
                setImpactFilter((prev) =>
                  prev.includes(imp) ? prev.filter((p) => p !== imp) : [...prev, imp]
                )
              }
              activeClass={IMPACT_CHIP_ACTIVE[imp]}
              inactiveClass={IMPACT_CHIP_INACTIVE[imp]}
            >
              {imp === "High" ? "High Impact ⚠" : imp === "Holiday" ? "วันหยุด" : imp}
            </Chip>
          ))}
        </div>
        <span className="h-5 w-px bg-border" />
        <div className="flex flex-wrap items-center gap-1">
          {CURRENCIES.map((cur) => (
            <Chip
              key={cur}
              active={currencyFilter.includes(cur)}
              onClick={() =>
                setCurrencyFilter((prev) =>
                  prev.includes(cur) ? prev.filter((p) => p !== cur) : [...prev, cur]
                )
              }
            >
              {cur}
            </Chip>
          ))}
        </div>
      </div>

      {/* แท็บวัน */}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {groups.map(([day, evs]) => {
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent",
                  selectedDay === day
                    ? "bg-primary text-primary-foreground hover:bg-primary"
                    : "text-muted-foreground"
                )}
              >
                {formatDayTab(day)}
                <span className={cn("ml-1.5 opacity-70", evs.some((e) => e.impact === "High") && "text-red-600 dark:text-red-500")}>
                  {evs.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ปฏิทินของวันที่เลือก */}
      {loading ? (
        <div className="grid gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-6 text-sm">
            <span className="text-red-600 dark:text-red-500">โหลดปฏิทินข่าวไม่สำเร็จ: {error}</span>
            <span className="text-muted-foreground">
              หากยังไม่ได้อัปเดต Apps Script (ฟีเจอร์ปฏิทินข่าว) ให้วางโค้ด
              <code className="bg-muted mx-1 rounded px-1">apps-script/Code.gs</code>
              ใหม่แล้ว Deploy เป็น New version — ดูขั้นตอนใน apps-script/README.md
            </span>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw />
              ลองใหม่
            </Button>
          </CardContent>
        </Card>
      ) : !selectedDay || dayEvents.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            ไม่พบข่าวที่ตรงกับตัวกรอง
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="bg-muted/50 flex items-center gap-4 border-b px-4 py-2 text-xs font-semibold">
            {formatDayHeader(selectedDay)}
          </div>
          {dayEvents.map((ev, idx) => (
            <div
              key={`${ev.title}-${ev.date}-${idx}`}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm",
                idx > 0 && "border-t",
                ev.impact === "High" &&
                  "bg-red-100/70 dark:bg-red-950/40 border-l-4 border-l-red-500 dark:border-l-red-500"
              )}
            >
              <span className="text-muted-foreground w-14 tabular-nums">{formatTimeTh(ev)}</span>
              <span className="w-12 font-semibold">{ev.country}</span>
              <span className={cn("min-w-0 flex-1", ev.impact === "Holiday" && "text-muted-foreground")}>
                {ev.title}
              </span>
              <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", impactStyle(ev.impact))}>
                {ev.impact === "Holiday" ? "หยุด" : ev.impact}
              </span>
              <div className="hidden gap-6 text-xs tabular-nums sm:flex">
                <span>
                  <span className="text-muted-foreground">Forecast </span>
                  <span className="font-medium">{ev.forecast || "-"}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Previous </span>
                  <span className="font-medium">{ev.previous || "-"}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ข่าวล่าสุด ForexLive */}
      <Card>
        <CardHeader>
          <CardTitle>ข่าวล่าสุด (ForexLive)</CardTitle>
          <CardDescription>
            Breaking news สาย forex จาก{" "}
            <a
              href="https://investinglive.com/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              ForexLive / investinglive.com
            </a>{" "}
            (RSS)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {newsLoading ? (
            <div className="grid gap-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : newsError ? (
            <div className="flex flex-col items-start gap-3 text-sm">
              <span className="text-red-600 dark:text-red-500">โหลดข่าวไม่สำเร็จ: {newsError}</span>
              <span className="text-muted-foreground">
                หากยังไม่ได้อัปเดต Apps Script (ฟีเจอร์ข่าว + ปฏิทิน) ให้วางโค้ด
                <code className="bg-muted mx-1 rounded px-1">apps-script/Code.gs</code>
                ใหม่แล้ว Deploy เป็น New version — ดูขั้นตอนใน apps-script/README.md
              </span>
              <Button variant="outline" size="sm" onClick={loadNews}>
                <RefreshCw />
                ลองใหม่
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {newsItems.map((item, idx) => {
                const age = newsAge(item.pubDate);
                return (
                  <a
                    key={`${item.link}-${idx}`}
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:bg-accent/50 flex items-start gap-3 py-2.5 transition-colors"
                  >
                    <div className="text-muted-foreground w-20 shrink-0 text-xs tabular-nums">
                      <div>{newsTimeTh(item.pubDate)}</div>
                      <div>{newsDayTh(item.pubDate)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5 font-medium">
                        <span className="min-w-0">{item.title}</span>
                        <ExternalLink className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                      </div>
                      {item.snippet && (
                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{item.snippet}</p>
                      )}
                    </div>
                    {age && (
                      <span className="bg-muted text-muted-foreground shrink-0 rounded-md px-2 py-0.5 text-xs">
                        {age}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Chip({
  active,
  onClick,
  activeClass,
  inactiveClass,
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeClass?: string;
  inactiveClass?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
        active
          ? cn("bg-primary text-primary-foreground hover:bg-primary", activeClass)
          : cn("text-muted-foreground hover:bg-accent", inactiveClass)
      )}
    >
      {children}
    </button>
  );
}

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function formatDayHeader(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** ชื่อแท็บสั้นๆ เช่น "จ. 7 ก.ย." (แสดง "วันนี้" ถ้าเป็นวันปัจจุบัน) */
function formatDayTab(dayKey: string): string {
  const today = new Date().toLocaleDateString("sv-SE");
  if (dayKey === today) return "วันนี้";
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
}
