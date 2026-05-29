/**
 * src/hooks/useJmaWarning.ts
 *
 * 指定地点の気象庁注意報・警報をフェッチする Hook。
 *
 * - jmaAreaCode 未解決時: 取得をスキップ (data = null)
 * - フォアグラウンド復帰 or STALE_MS 経過で自動リフレッシュ
 * - Open-Meteo fetch と独立しているため、呼び出し元で Promise.all 可能
 */

import { useState, useEffect, useRef } from 'react';
import { fetchJmaWarnings, type JmaWarningResult } from '../api/jmaWarning';
import { prefCodeFromAreaCode } from '../lib/jmaAreaResolver';

/** キャッシュが陳腐化するまでの時間 (30分) */
const STALE_MS = 30 * 60 * 1000;

const cache = new Map<string, { data: JmaWarningResult; fetchedAt: number }>();

export function useJmaWarning(jmaAreaCode: string | null | undefined) {
  const [data, setData]     = useState<JmaWarningResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const isMounted           = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!jmaAreaCode) {
      setData(null);
      setError(null);
      return;
    }

    const prefCode = prefCodeFromAreaCode(jmaAreaCode);

    const load = async (force = false) => {
      const cached = cache.get(jmaAreaCode);
      if (!force && cached && Date.now() - cached.fetchedAt < STALE_MS) {
        if (isMounted.current) setData(cached.data);
        return;
      }
      if (isMounted.current) setLoading(true);
      try {
        const result = await fetchJmaWarnings(jmaAreaCode, prefCode);
        cache.set(jmaAreaCode, { data: result, fetchedAt: Date.now() });
        if (isMounted.current) {
          setData(result);
          setError(null);
        }
      } catch (e: unknown) {
        if (isMounted.current) {
          setError(e instanceof Error ? e.message : '気象庁データの取得に失敗しました');
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    load();

    // フォアグラウンド復帰時に STALE なら再取得
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [jmaAreaCode]);

  return { data, loading, error };
}
