import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Trades from "@/pages/Trades";
import ChartPage from "@/pages/ChartPage";
import NewsPage from "@/pages/NewsPage";

// HashRouter (ไม่ใช่ BrowserRouter) เพื่อให้ route อยู่รอดเวลารีเฟรชบน static host
// และบน Google Apps Script ที่เสิร์ฟเป็นไฟล์เดียว (#/trades, #/backtests)
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/backtests" element={<Trades sheet="Backtests" backtest />} />
          <Route path="/chart" element={<ChartPage />} />
          <Route path="/news" element={<NewsPage />} />
        </Route>
      </Routes>
      <Toaster position="top-center" richColors />
    </HashRouter>
  );
}
