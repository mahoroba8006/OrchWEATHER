// src/hooks/useHistoricalForecast.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchHistoricalForecast } from '../api/historicalForecast';
import type { ForecastData } from '../api/forecast';
import type { WeatherCodeMode } from '../lib/wmoSeverity';

const historyCache = new Map<string, { data: ForecastData; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1時間（過去データは変わらないのでTTL長め）

export function useHistoricalForecast(
  lat: number | null,
  lon: number | null,
  startDate: string | null,
  mode: WeatherCodeMode = 'severity',
) {
  const [data,    setData]    = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const activeKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (lat === null || lon === null || !startDate) {
      setData(null);
      return;
    }
    const key = `${lat},${lon},${startDate},${mode}`;
    activeKey.current = key;

    const cached = historyCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setData(cached.data);
      return;
    }

    setLoading(true);
    setLoadingStatus('気象データを取得中...');
    setError(null);

    try {
      const result = await fetchHistoricalForecast(lat, lon, startDate, mode);
      if (activeKey.current !== key) return; // stale
      historyCache.set(key, { data: result, fetchedAt: result.fetchedAt });
      setData(result);
    } catch (err: unknown) {
      if (activeKey.current === key) {
        const message = err instanceof Error ? err.message : '気象データを取得できませんでした';
        setError(message);
      }
    } finally {
      if (activeKey.current === key) {
        setLoading(false);
        setLoadingStatus('');
      }
    }
  }, [lat, lon, startDate, mode]);

  useEffect(() => {
    setData(null);
    setError(null);
    load();
  }, [load]);

  return { data, loading, loadingStatus, error };
}
