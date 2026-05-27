// src/hooks/useHistoricalForecast.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchHistoricalForecast } from '../api/historicalForecast';
import type { ForecastData } from '../api/forecast';

const historyCache = new Map<string, { data: ForecastData; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1時間（過去データは変わらないのでTTL長め）

export function useHistoricalForecast(
  lat: number | null,
  lon: number | null,
  startDate: string | null,
) {
  const [data,    setData]    = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const activeKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (lat === null || lon === null || !startDate) {
      setData(null);
      return;
    }
    const key = `${lat},${lon},${startDate}`;
    activeKey.current = key;

    const cached = historyCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setData(cached.data);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchHistoricalForecast(lat, lon, startDate);
      if (activeKey.current !== key) return; // stale
      historyCache.set(key, { data: result, fetchedAt: result.fetchedAt });
      setData(result);
    } catch (err: unknown) {
      if (activeKey.current === key) {
        const message = err instanceof Error ? err.message : '気象データを取得できませんでした';
        setError(message);
      }
    } finally {
      if (activeKey.current === key) setLoading(false);
    }
  }, [lat, lon, startDate]);

  useEffect(() => {
    setData(null);
    setError(null);
    load();
  }, [load]);

  return { data, loading, error };
}
