import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpenText,
  CandlestickChart,
  FlaskConical,
  LayoutDashboard,
  Moon,
  Newspaper,
  Settings,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SettingsDialog from "@/components/SettingsDialog";

export default function Layout() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpenText className="size-5" />
            <span>Trade Journal</span>
          </div>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/" end className={({ isActive }) => (isActive ? "bg-accent text-accent-foreground" : "")}>
                <LayoutDashboard />
                Dashboard
              </NavLink>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/trades" className={({ isActive }) => (isActive ? "bg-accent text-accent-foreground" : "")}>
                <BookOpenText />
                บันทึกเทรด
              </NavLink>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/backtests" className={({ isActive }) => (isActive ? "bg-accent text-accent-foreground" : "")}>
                <FlaskConical />
                Backtest
              </NavLink>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/chart" className={({ isActive }) => (isActive ? "bg-accent text-accent-foreground" : "")}>
                <CandlestickChart />
                กราฟ
              </NavLink>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/news" className={({ isActive }) => (isActive ? "bg-accent text-accent-foreground" : "")}>
                <Newspaper />
                ข่าว
              </NavLink>
            </Button>
          </nav>
          <div className="ml-auto flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="ตั้งค่าทุน"
            >
              <Settings />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark((d) => !d)}
              aria-label="สลับธีม"
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
