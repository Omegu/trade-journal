import { useCallback, useEffect, useState } from "react";
import { isConfigured, listTrades } from "@/lib/api";
import type { Trade } from "@/lib/types";

export function useTrades(sheet = "Trades") {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setTrades(await listTrades(sheet));
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [sheet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { trades, loading, error, isConfigured, refresh, setTrades };
}
