// src/hooks/useForecast.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchForecast, type ForecastData } from '../api/forecast';

const CACHE_TTL = 30 * 60 * 1000; // 30分
const forecastCache = new Map<string, { data: ForecastData; fetchedAt: number }>();

export function useForecast(lat: number | null, lon: number | null) {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // stale レスポンスを無視するために、最後にリクエストしたキーを追跡する
  const activeKey = useRef<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (lat === null || lon === null) {
      setData(null);
      return;
    }
    const key = `${lat},${lon}`;
    activeKey.current = key;

    if (!force) {
      const cached = forecastCache.get(key);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        setData(cached.data);
        setLastUpdated(new Date(cached.fetchedAt));
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchForecast(lat, lon);
      if (activeKey.current !== key) return; // stale
      forecastCache.set(key, { data: result, fetchedAt: result.fetchedAt });
      setData(result);
      setLastUpdated(new Date(result.fetchedAt));
    } catch (err: unknown) {
      if (activeKey.current === key) {
        const message = err instanceof Error ? err.message : '予報データを取得できませんでした';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  // lat/lon 変更時は既存データをクリアして再フェッチ
  useEffect(() => {
    setData(null);
    setLastUpdated(null);
    setError(null);
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, error, lastUpdated, refresh };
}
