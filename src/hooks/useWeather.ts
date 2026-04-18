import { useState, useEffect } from 'react';
import { fetchWeatherData, type WeatherData } from '../api/weather';
import { useAppStore } from '../store';

export interface CompareTarget {
  id: string;
  locationId: string;
  year: number;
}

export function useWeatherData(targets: CompareTarget[]) {
  const { locations } = useAppStore();
  const [data, setData] = useState<Record<string, WeatherData>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (targets.length === 0) {
      setData({});
      return;
    }

    let isMounted = true;
    
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      const newData: Record<string, WeatherData> = {};
      
      try {
        const promises = targets.map(async (target) => {
          const loc = locations.find(l => l.id === target.locationId);
          if (!loc) {
            console.warn(`対象地点が見つかりません(削除済み等): ${target.locationId}`);
            return { id: target.id, result: { year: target.year, daily: [] } };
          }
          
          const result = await fetchWeatherData(
            loc.lat,
            loc.lon,
            target.year
          );
          
          return { id: target.id, result };
        });

        const results = await Promise.all(promises);
        
        if (isMounted) {
          results.forEach(({ id, result }) => {
            newData[id] = result;
          });
          setData(newData);
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

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(targets), locations]); 

  return { data, loading, error };
}
