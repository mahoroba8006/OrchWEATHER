import { useState, useEffect, useRef } from 'react';
import { fetchWeatherData, type WeatherData } from '../api/weather';
import { useAppStore } from '../store';

export interface CompareTarget {
  id: string;
  locationId: string;
  year: number;
}

type TargetSpec = { locationId: string; year: number };

export function useWeatherData(targets: CompareTarget[]) {
  const { locations } = useAppStore();
  const [data, setData] = useState<Record<string, WeatherData>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 直前にフェッチ済みのターゲット仕様を記憶する（id → {locationId, year}）
  const fetchedSpecsRef = useRef<Map<string, TargetSpec>>(new Map());

  useEffect(() => {
    if (targets.length === 0) {
      setData({});
      fetchedSpecsRef.current.clear();
      return;
    }

    // 変更・追加されたターゲットだけ抽出
    const targetsToFetch = targets.filter(target => {
      const prev = fetchedSpecsRef.current.get(target.id);
      return !prev || prev.locationId !== target.locationId || prev.year !== target.year;
    });

    if (targetsToFetch.length === 0) return;

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const promises = targetsToFetch.map(async (target) => {
          const loc = locations.find(l => l.id === target.locationId);
          if (!loc) {
            console.warn(`対象地点が見つかりません(削除済み等): ${target.locationId}`);
            return { id: target.id, result: { year: target.year, daily: [] } as WeatherData };
          }
          const result = await fetchWeatherData(loc.lat, loc.lon, target.year);
          return { id: target.id, result };
        });

        const results = await Promise.all(promises);

        if (isMounted) {
          // フェッチ済み仕様を更新
          targetsToFetch.forEach(t => {
            fetchedSpecsRef.current.set(t.id, { locationId: t.locationId, year: t.year });
          });

          setData(prev => {
            const next: Record<string, WeatherData> = {};
            // 現在のターゲット分だけ残す（削除されたターゲットを除去）
            const currentIds = new Set(targets.map(t => t.id));
            Object.entries(prev).forEach(([id, d]) => {
              if (currentIds.has(id)) next[id] = d;
            });
            // 新規・更新分を上書き
            results.forEach(({ id, result }) => { next[id] = result; });
            return next;
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'データの取得に失敗しました');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [JSON.stringify(targets), locations]);

  return { data, loading, error };
}
