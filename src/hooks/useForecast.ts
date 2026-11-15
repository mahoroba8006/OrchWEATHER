// src/hooks/useForecast.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchForecast, type ForecastData } from '../api/forecast';
import { loadStoredForecast, saveStoredForecast } from '../lib/forecastStore';

const CACHE_TTL = 30 * 60 * 1000; // 30分
const forecastCache = new Map<string, { data: ForecastData; fetchedAt: number }>();

export function useForecast(lat: number | null, lon: number | null) {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // stale レスポンスを無視するために、最後にリクエストしたキーを追跡する
  const activeKey = useRef<string | null>(null);
  const inflightRef = useRef(0);
  // 取得中の地点（画面の復帰などで同じ地点を重ねて取りに行かない）
  const inflightKeys = useRef(new Set<string>());

  const load = useCallback(async (force: boolean) => {
    if (lat === null || lon === null) {
      setData(null);
      return;
    }
    const key = `${lat},${lon}`;
    activeKey.current = key;

    if (!force) {
      let cached = forecastCache.get(key);
      // 開き直した直後はメモリが空。前回取れた予報を通信を待たずに見せる
      if (!cached) {
        const stored = loadStoredForecast(lat, lon);
        if (stored) {
          cached = { data: stored, fetchedAt: stored.fetchedAt };
          forecastCache.set(key, cached);
        }
      }
      if (cached) {
        setData(cached.data);
        setLastUpdated(new Date(cached.fetchedAt));
        if (Date.now() - cached.fetchedAt < CACHE_TTL) return;
        // 古ければ表示したまま裏で取り直す
      }
      if (inflightKeys.current.has(key)) return;
    }

    inflightRef.current++;
    inflightKeys.current.add(key);
    setLoading(true);
    setLoadingStatus('天気予報を取得中...');
    setError(null);

    try {
      const result = await fetchForecast(lat, lon);
      forecastCache.set(key, { data: result, fetchedAt: result.fetchedAt });
      saveStoredForecast(result, lat, lon);
      if (activeKey.current !== key) return; // stale
      setData(result);
      setLastUpdated(new Date(result.fetchedAt));
    } catch (err: unknown) {
      if (activeKey.current === key) {
        const message = err instanceof Error ? err.message : '予報データを取得できませんでした';
        setError(message);
      }
    } finally {
      inflightKeys.current.delete(key);
      inflightRef.current--;
      if (inflightRef.current === 0) {
        setLoading(false);
        setLoadingStatus('');
      }
    }
  }, [lat, lon]);

  // lat/lon 変更時は既存データをクリアして再フェッチ
  useEffect(() => {
    setData(null);
    setLastUpdated(null);
    setError(null);
    load(false);
  }, [load]);

  // 画面を前に戻したとき・通信が戻ったときに、古ければ取り直す（新しければ何もしない）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(false);
    };
    const onOnline = () => load(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, loading, loadingStatus, error, lastUpdated, refresh };
}
