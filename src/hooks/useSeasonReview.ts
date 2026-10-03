// src/hooks/useSeasonReview.ts
//
// 今年のあゆみ＋節気ふりかえりのデータ。予報の取得完了後に、必要な年の実績を1リクエストで取得する
// （予報と通信を取り合わない。archive API は同時接続数に上限があり、年ごとの並列取得は 429 になる）。
// 非ブロッキング: 失敗・計算不能は hidden（エラー表示しない）。
//
// 状態は「どの key の結果か」を持ち、描画時に key 比較で導出する（effect 内で同期 setState しない）。
// 地点切替直後は useForecast がまだ旧地点の予報を返すため、予報の取得地点が今の地点と一致するまで
// 取得を始めない（予報より先に走らせない・新予報の到着後に重複取得しない）。
import { useEffect, useRef, useState } from 'react';
import { fetchDailyActuals } from '../api/weather';
import { addDays } from '../lib/dateUtils';
import type { ForecastData } from '../api/forecast';
import {
  buildDayMap, computeSeasonView, fromArchive, fromForecastPast, requiredYears, type SeasonView,
} from '../lib/seasonReview';
import { jstDateString } from '../lib/sky';

export type SeasonState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'hidden' }
  | { status: 'ready'; view: SeasonView };

export function useSeasonReview(lat: number | null, lon: number | null, forecast: ForecastData | null): SeasonState {
  const today = jstDateString(new Date());
  const forecastMatches = forecast !== null && lat !== null && lon !== null && forecast.lat === lat && forecast.lon === lon;
  const key = forecast && forecastMatches ? `${lat},${lon},${today},${forecast.fetchedAt}` : null;
  const [result, setResult] = useState<{ key: string; view: SeasonView | null } | null>(null);

  // 最新の予報を ref で読む（参照は毎回変わりうるため effect の依存には key だけを使う）
  const forecastRef = useRef(forecast);
  forecastRef.current = forecast;

  useEffect(() => {
    if (key === null || lat === null || lon === null) return;
    const fill = fromForecastPast(forecastRef.current?.pastDaily ?? []);
    let cancelled = false;
    fetchDailyActuals(lat, lon, `${requiredYears(today)[0]}-01-01`, addDays(today, -1))
      .then(days => {
        if (cancelled) return;
        const map = buildDayMap(fromArchive(days), fill);
        setResult({ key, view: computeSeasonView(map, today) });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, view: null });
      });
    return () => { cancelled = true; };
    // key に lat・lon・today・予報の取得時刻が含まれる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (lat === null || lon === null || !forecast) return { status: 'idle' };
  // 予報が今の地点に追いつくまで（key === null）と、取得中は骨組み
  if (key === null || !result || result.key !== key) return { status: 'loading' };
  return result.view ? { status: 'ready', view: result.view } : { status: 'hidden' };
}
