import { useEffect, useRef } from "react";

interface TradingViewChartProps {
  symbol: string;
  interval: string;
  dark: boolean;
}

/**
 * ฝัง TradingView Advanced Chart widget (embed ฟรีอย่างเป็นทางการ)
 * สร้าง iframe ใหม่ทุกครั้งที่ symbol/interval/ธีมเปลี่ยน
 */
export default function TradingViewChart({ symbol, interval, dark }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Bangkok",
      theme: dark ? "dark" : "light",
      style: "1",
      locale: "th",
      backgroundColor: dark ? "rgba(20, 20, 20, 1)" : "rgba(255, 255, 255, 1)",
      gridColor: dark ? "rgba(42, 46, 57, 0.5)" : "rgba(240, 243, 250, 0.8)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      isTransparent: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, interval, dark]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container h-full w-full"
      style={{ height: "100%", width: "100%" }}
    />
  );
}
