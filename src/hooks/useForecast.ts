// src/hooks/useForecast.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchForecast, type ForecastData } from '../api/forecast';
import type { WeatherCodeMode } from '../lib/wmoSeverity';

const CACHE_TTL = 30 * 60 * 1000; // 30分
const forecastCache = new Map<string, { data: ForecastData; fetchedAt: number }>();

export function useForecast(lat: number | null, lon: number | null, mode: WeatherCodeMode = 'severity') {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // stale レスポンスを無視するために、最後にリクエストしたキーを追跡する
  const activeKey = useRef<string | null>(null);
  const inflightRef = useRef(0);

  const load = useCallback(async (force: boolean) => {
    if (lat === null || lon === null) {
      setData(null);
      return;
    }
    const key = `${lat},${lon},${mode}`;
    activeKey.current = key;

    if (!force) {
      const cached = forecastCache.get(key);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        setData(cached.data);
        setLastUpdated(new Date(cached.fetchedAt));
        return;
      }
    }

    inflightRef.current++;
    setLoading(true);
    setLoadingStatus('天気予報を取得中...');
    setError(null);

    try {
      const result = await fetchForecast(lat, lon, mode);
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
      inflightRef.current--;
      if (inflightRef.current === 0) {
        setLoading(false);
        setLoadingStatus('');
      }
    }
  }, [lat, lon, mode]);

  // lat/lon 変更時は既存データをクリアして再フェッチ
  useEffect(() => {
    setData(null);
    setLastUpdated(null);
    setError(null);
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, loadingStatus, error, lastUpdated, refresh };
}
